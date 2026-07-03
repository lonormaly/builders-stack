// `bsp` / `builders-stack-provision` — the CLI.
//
// FLOW (interactive): read .env.example (the var manifest) → figure out which
// providers this repo needs (recipe.envVars ∩ manifest) → per provider: reuse a
// stored root cred from ~/.builders-stack and re-validate it, else deep-link +
// paste + validate with a colored scope report and a retry loop → store root
// creds + stage per-repo env values → optionally auto-provision cloud resources
// → merge .env.local → summary table.
//
// FLOW (--json / --non-interactive): no prompts. Read creds from ~/.builders-stack
// + process env + --set flags, validate what's present, emit one JSON object: the
// plan, validation results, and exactly what a human still has to create (with the
// deep-links). This is how an agent guides the user.
//
// Root creds (a Cloudflare token, a Neon key) are the SAME across every repo, so
// they live once in ~/.builders-stack (à la ~/.aws) and get reused. Per-repo values
// (a scoped account id, a generated secret) live only in that repo's .env.local.

import { join } from "node:path";
import {
  intro,
  outro,
  log,
  note,
  spinner,
  isCancel,
  cancel,
  password,
  select,
} from "@clack/prompts";
import pc from "picocolors";
import { RECIPES } from "./recipes/index";
import type { Recipe, ValidateResult } from "./recipe";
import { parseEnvExample } from "./env-file";
import { upsertEnvLocal } from "./env-file";
import { getConfigDir, resolveRootCreds, setProviderCreds } from "./config-store";

interface Flags {
  json: boolean;
  provision: boolean;
  help: boolean;
  cwd: string;
  envExample: string;
  envLocal: string;
  domain?: string;
  /** --set KEY=VALUE (repeatable) — feed creds to the non-interactive path. */
  set: Record<string, string>;
}

function parseFlags(argv: string[]): Flags {
  const has = (f: string) => argv.includes(f);
  const val = (f: string) => {
    const i = argv.indexOf(f);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const cwd = val("--cwd") ?? process.cwd();
  const set: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--set" && argv[i + 1]) {
      const eq = argv[i + 1]!.indexOf("=");
      if (eq > 0) set[argv[i + 1]!.slice(0, eq)] = argv[i + 1]!.slice(eq + 1);
    }
  }
  return {
    json: has("--json") || has("--non-interactive"),
    provision: has("--provision"),
    help: has("--help") || has("-h"),
    cwd,
    envExample: val("--env-example") ?? join(cwd, ".env.example"),
    envLocal: val("--env-local") ?? join(cwd, ".env.local"),
    domain: val("--domain"),
    set,
  };
}

function repoNameFromCwd(cwd: string): string {
  return cwd.split("/").filter(Boolean).at(-1) ?? "app";
}

/**
 * The recipes this repo actually needs: a recipe applies when ANY of its envVars
 * appears in the manifest. (GoDaddy stays registered but won't run for a repo whose
 * .env.example has no GODADDY_* var.) Returns the applicable recipes IN REGISTRY
 * ORDER plus the manifest vars no recipe owns (the "manual" list).
 */
function selectRecipes(manifestKeys: string[]): {
  recipes: Recipe[];
  uncovered: string[];
} {
  const keys = new Set(manifestKeys);
  const recipes = RECIPES.filter((r) => r.envVars.some((v) => keys.has(v)));
  const owned = new Set(recipes.flatMap((r) => r.envVars));
  const uncovered = manifestKeys.filter((k) => !owned.has(k));
  return { recipes, uncovered };
}

/**
 * Keys we must collect for a recipe = its env vars PLUS any rootCredKeys that
 * aren't env vars (e.g. PostHog's POSTHOG_PERSONAL_API_KEY — validation-only, never
 * written to .env.local but stored as a reusable root cred).
 */
function keysToCollect(recipe: Recipe): string[] {
  const extra = (recipe.rootCredKeys ?? []).filter((k) => !recipe.envVars.includes(k));
  return [...recipe.envVars, ...extra];
}

// ── interactive flow ────────────────────────────────────────────────────────

async function runInteractive(flags: Flags): Promise<void> {
  intro(pc.inverse(pc.bold(" builders-stack ")) + " " + pc.dim("provision — keys in, cloud out"));

  const manifest = parseEnvExample(flags.envExample);
  if (manifest.length === 0) {
    cancel(`No .env.example found at ${flags.envExample} — run from a repo root or pass --cwd.`);
    process.exit(1);
  }

  const { recipes, uncovered } = selectRecipes(manifest.map((v) => v.key));
  log.step(
    `${pc.bold(String(recipes.length))} provider(s) needed by ${pc.cyan(
      repoNameFromCwd(flags.cwd),
    )} ` + pc.dim(`(${manifest.length} vars in .env.example)`),
  );
  if (recipes.length === 0) {
    outro(pc.yellow("No known providers for this repo. Nothing to do."));
    return;
  }

  const collected: Record<string, string> = {};
  const summary: SummaryRow[] = [];

  for (const recipe of recipes) {
    log.step(`${pc.bold(recipe.title)} ${pc.dim(`· ${recipe.mode}`)}`);

    // generate-mode: mint locally, no prompt, no validate.
    if (recipe.mode === "generate") {
      const minted = recipe.generate ? recipe.generate() : {};
      for (const [k, v] of Object.entries(minted)) collected[k] = v;
      log.success(pc.green(`✓ generated ${recipe.envVars.join(", ")}`));
      summary.push({ service: recipe.title, status: "generated", where: ".env.local" });
      continue;
    }

    // Reuse stored root creds across repos, else acquire (with validate + retry).
    let creds = resolveRootCreds(recipe.id, recipe.rootCredKeys);
    let reused = false;
    if (creds) {
      const s = spinner();
      s.start(`Found ${recipe.title} in ~/.builders-stack — re-validating…`);
      const result = recipe.validate ? await recipe.validate(creds) : { ok: true };
      s.stop(formatValidate(recipe, result));
      if (result.ok) {
        reused = true;
      } else {
        printScopeReport(recipe, result);
        log.warn("Stored credential no longer valid — let's replace it.");
        creds = null;
      }
    }

    if (!creds) {
      creds = await acquireWithRetry(recipe);
      if (!creds) {
        log.warn(`Skipped ${recipe.title}.`);
        summary.push({ service: recipe.title, status: "skipped", where: "—" });
        continue;
      }
    }

    // Persist root creds (reused next repo) + stage per-repo env values.
    persistRootCreds(recipe, creds);
    for (const key of recipe.envVars) {
      if (creds[key] !== undefined) collected[key] = creds[key]!;
    }

    // Auto-provision (optional, --provision): create the cloud resource now.
    if (flags.provision && recipe.mode === "auto" && recipe.autoProvision) {
      const s = spinner();
      s.start(`Provisioning ${recipe.title}…`);
      try {
        const produced = await recipe.autoProvision(creds, {
          repoName: repoNameFromCwd(flags.cwd),
          domain: flags.domain,
          log: (m) => s.message(m),
        });
        for (const [k, v] of Object.entries(produced)) collected[k] = v;
        s.stop(pc.green(`✓ provisioned ${recipe.title}`));
        summary.push({
          service: recipe.title,
          status: reused ? "reused → provisioned" : "provisioned",
          where: rootStore(recipe),
        });
        continue;
      } catch (err) {
        s.stop(pc.red(`✗ ${recipe.title} provisioning failed`));
        log.error(err instanceof Error ? err.message : String(err));
        summary.push({
          service: recipe.title,
          status: "provision failed",
          where: rootStore(recipe),
        });
        continue;
      }
    }

    summary.push({
      service: recipe.title,
      status: reused ? "reused ✓" : "validated ✓",
      where: rootStore(recipe),
    });
  }

  // Write .env.local (idempotent) + print the summary table.
  const { written, unchanged } = upsertEnvLocal(flags.envLocal, collected);
  log.success(
    `Wrote ${pc.bold(String(written.length))} var(s) to ${pc.dim(flags.envLocal)}` +
      (unchanged.length ? pc.dim(` (${unchanged.length} unchanged)`) : ""),
  );
  note(renderSummary(summary), "Summary");

  if (uncovered.length) {
    note(
      uncovered.map((k) => `  ${pc.yellow("·")} ${k}`).join("\n"),
      "Set these by hand (no provider covers them)",
    );
  }

  const next: string[] = [];
  if (!flags.provision && recipes.some((r) => r.mode === "auto" && "autoProvision" in r)) {
    next.push(
      `Re-run with ${pc.cyan("--provision")} to auto-create cloud resources (Neon DB, etc.).`,
    );
  }
  next.push(`Boot the stack: ${pc.cyan("./tilt_up.sh")}`);
  outro(pc.green("Done. ") + next.join(" "));
}

interface SummaryRow {
  service: string;
  status: string;
  where: string;
}

function rootStore(recipe: Recipe): string {
  return recipe.rootCredKeys?.length ? "~/.builders-stack + .env.local" : ".env.local";
}

function renderSummary(rows: SummaryRow[]): string {
  const w = (s: string, n: number) => s + " ".repeat(Math.max(0, n - stripAnsi(s).length));
  const colored = (status: string) => {
    if (/fail|✗/.test(status)) return pc.red(status);
    if (/skip/.test(status)) return pc.yellow(status);
    return pc.green(status);
  };
  const head = pc.dim(w("SERVICE", 20)) + pc.dim(w("STATUS", 24)) + pc.dim("STORED");
  const body = rows.map((r) => w(r.service, 20) + w(colored(r.status), 24) + pc.dim(r.where));
  return [head, ...body].join("\n");
}

function stripAnsi(s: string): string {
  // ponytail: tiny inline strip so column widths ignore color codes; a full
  // ansi-regex dep isn't worth it for one alignment helper.
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Acquire a guided recipe's creds with a validate-and-retry loop. On a failed
 * probe we show the colored scope report and offer: retry (re-paste) / open the
 * token page / skip.
 */
async function acquireWithRetry(recipe: Recipe): Promise<Record<string, string> | null> {
  showGuidance(recipe);

  for (;;) {
    const creds = await promptCreds(recipe);
    if (!creds) return null; // user chose to skip

    let result: ValidateResult = { ok: true };
    if (recipe.validate) {
      const s = spinner();
      s.start(`Validating ${recipe.title}…`);
      result = await recipe.validate(creds);
      s.stop(formatValidate(recipe, result));
    }

    if (result.ok) return creds;

    printScopeReport(recipe, result);

    const choice = await select({
      message: `${recipe.title} didn't validate. What now?`,
      options: [
        { value: "retry", label: "Retry — re-paste the credential" },
        { value: "open", label: `Open the token page (${recipe.tokenCreateUrl ?? "docs"})` },
        { value: "skip", label: "Skip this provider" },
      ],
    });
    if (isCancel(choice)) {
      cancel("Cancelled.");
      process.exit(1);
    }
    if (choice === "skip") return null;
    if (choice === "open" && recipe.tokenCreateUrl) openBrowser(recipe.tokenCreateUrl);
    // loop → re-prompt
  }
}

function showGuidance(recipe: Recipe): void {
  const lines: string[] = [];
  if (recipe.tokenCreateUrl)
    lines.push(`${pc.bold("Create a token:")} ${pc.underline(pc.cyan(recipe.tokenCreateUrl))}`);
  if (recipe.requiredScopes?.length) {
    lines.push("");
    lines.push(pc.bold("Tick these scopes:"));
    for (const s of recipe.requiredScopes) lines.push(`  ${pc.cyan("▸")} ${s}`);
  }
  if (recipe.docsUrl) {
    lines.push("");
    lines.push(pc.dim(`Docs: ${recipe.docsUrl}`));
  }
  if (lines.length) note(lines.join("\n"), recipe.title);
}

/** Password-prompt each key we need; empty first key = skip the whole provider. */
async function promptCreds(recipe: Recipe): Promise<Record<string, string> | null> {
  const out: Record<string, string> = {};
  const keys = keysToCollect(recipe);
  for (const key of keys) {
    const answer = await password({ message: key });
    if (isCancel(answer)) {
      cancel("Cancelled.");
      process.exit(1);
    }
    const v = (answer ?? "").trim();
    if (!v) {
      // Empty on the very first key = the user is skipping this whole provider.
      // Empty on a later key = leave that (optional) key blank and continue.
      if (Object.keys(out).length === 0) return null;
      continue;
    }
    out[key] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** Green ✓ for each granted scope, red ✗ for each missing one. */
function printScopeReport(recipe: Recipe, r: ValidateResult): void {
  const lines: string[] = [];
  if (r.detail) lines.push(pc.dim(r.detail));
  for (const s of r.scopes ?? []) lines.push(pc.green(`  ✓ ${s}`));
  for (const m of r.missing ?? []) lines.push(pc.red(`  ✗ MISSING  ${m}`));
  if (lines.length) note(lines.join("\n"), `${recipe.title} — scope report`);
}

function persistRootCreds(recipe: Recipe, creds: Record<string, string>): void {
  if (!recipe.rootCredKeys?.length) return;
  const subset = Object.fromEntries(
    recipe.rootCredKeys.filter((k) => k in creds).map((k) => [k, creds[k]!]),
  );
  if (Object.keys(subset).length) setProviderCreds(recipe.id, subset);
}

function formatValidate(recipe: Recipe, r: ValidateResult): string {
  if (r.ok) return pc.green(`✓ ${recipe.title}${r.detail ? pc.dim(` — ${r.detail}`) : ""}`);
  const miss = r.missing?.length ? pc.red(` (missing: ${r.missing.join(", ")})`) : "";
  return pc.red(`✗ ${recipe.title}${r.detail ? ` — ${r.detail}` : ""}`) + miss;
}

function openBrowser(url: string): void {
  // ponytail: best-effort open; if it fails the URL is already printed above.
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  import("node:child_process")
    .then(({ spawn }) => spawn(cmd, [url], { stdio: "ignore", detached: true }).unref())
    .catch(() => {});
}

// ── non-interactive (--json) flow ───────────────────────────────────────────
//
// Agent-driven: no prompts. Creds come from ~/.builders-stack + process env +
// --set flags. We validate what's fully present and emit ONE structured object:
// per provider its status + (if blocked) the deep-link/scopes a human must action,
// and a top-level `nextActions` an agent can read aloud to the user.

type JsonStatus =
  | "generate"
  | "reused"
  | "valid"
  | "invalid"
  | "needs-human"
  | "provisioned"
  | "provision-failed";

interface JsonRecipeReport {
  id: string;
  title: string;
  mode: Recipe["mode"];
  status: JsonStatus;
  providedVars: string[];
  missingVars: string[];
  source: "stored" | "env" | "generated" | "mixed" | "none";
  validate?: ValidateResult;
  /** Present when status === "needs-human": what to click. */
  action?: { tokenCreateUrl?: string; docsUrl?: string; requiredScopes?: string[] };
}

async function runJson(flags: Flags): Promise<void> {
  const manifest = parseEnvExample(flags.envExample);
  const { recipes, uncovered } = selectRecipes(manifest.map((v) => v.key));

  const reports: JsonRecipeReport[] = [];
  const collected: Record<string, string> = {};

  for (const recipe of recipes) {
    const stored = resolveRootCreds(recipe.id, recipe.rootCredKeys) ?? {};
    const keys = keysToCollect(recipe);
    const creds: Record<string, string> = { ...stored };
    let fromEnv = false;
    for (const key of keys) {
      const v = flags.set[key] ?? process.env[key];
      if (v) {
        creds[key] = v;
        fromEnv = true;
      }
    }
    const provided = keys.filter((k) => creds[k] !== undefined);
    const missing = keys.filter((k) => creds[k] === undefined);

    // generate-mode: it's never "missing" — we can mint it.
    if (recipe.mode === "generate") {
      const minted = recipe.generate ? recipe.generate() : {};
      for (const [k, v] of Object.entries(minted)) collected[k] = v;
      reports.push({
        id: recipe.id,
        title: recipe.title,
        mode: recipe.mode,
        status: "generate",
        providedVars: Object.keys(minted),
        missingVars: [],
        source: "generated",
      });
      continue;
    }

    const source: JsonRecipeReport["source"] =
      Object.keys(stored).length && fromEnv
        ? "mixed"
        : Object.keys(stored).length
          ? "stored"
          : fromEnv
            ? "env"
            : "none";

    if (missing.length) {
      reports.push({
        id: recipe.id,
        title: recipe.title,
        mode: recipe.mode,
        status: "needs-human",
        providedVars: provided,
        missingVars: missing,
        source,
        action: {
          tokenCreateUrl: recipe.tokenCreateUrl,
          docsUrl: recipe.docsUrl,
          requiredScopes: recipe.requiredScopes,
        },
      });
      continue;
    }

    let validate: ValidateResult | undefined;
    if (recipe.validate) validate = await recipe.validate(creds);
    const ok = validate ? validate.ok : true;
    if (ok)
      for (const key of recipe.envVars) if (creds[key] !== undefined) collected[key] = creds[key]!;

    reports.push({
      id: recipe.id,
      title: recipe.title,
      mode: recipe.mode,
      status: ok ? (source === "stored" ? "reused" : "valid") : "invalid",
      providedVars: provided,
      missingVars: [],
      source,
      validate,
      action: ok
        ? undefined
        : {
            tokenCreateUrl: recipe.tokenCreateUrl,
            docsUrl: recipe.docsUrl,
            requiredScopes: recipe.requiredScopes,
          },
    });
  }

  const nextActions = reports
    .filter((r) => r.status === "needs-human" || r.status === "invalid")
    .map((r) => ({
      service: r.title,
      why:
        r.status === "invalid"
          ? "credential present but failed validation"
          : `missing ${r.missingVars.join(", ")}`,
      open: r.action?.tokenCreateUrl ?? r.action?.docsUrl,
      scopes: r.action?.requiredScopes,
    }));

  const plan = {
    repo: repoNameFromCwd(flags.cwd),
    envExample: flags.envExample,
    configDir: getConfigDir(),
    manifestVars: manifest.map((v) => v.key),
    uncoveredVars: uncovered,
    recipes: reports,
    resolvedVars: Object.keys(collected).sort(),
    ready: reports.every(
      (r) =>
        r.status !== "needs-human" && r.status !== "invalid" && r.status !== "provision-failed",
    ),
    nextActions,
  };
  process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
}

// ── help ─────────────────────────────────────────────────────────────────────

function printHelp(): void {
  const b = pc.bold;
  process.stdout.write(
    `
${pc.inverse(b(" builders-stack "))} ${pc.dim("provision")}

Acquire, validate, and store the API keys a builders-stack repo needs, then
optionally auto-provision the cloud resources. Root creds live in ${pc.cyan("~/.builders-stack")}
(reused across repos, like ~/.aws) — per-repo values go to ${pc.cyan(".env.local")}.

${b("USAGE")}
  bsp [options]
  npx @builders-stack/provision [options]

${b("OPTIONS")}
  ${pc.cyan("--provision")}          After validating, auto-create cloud resources (Neon DB, DNS…).
  ${pc.cyan("--json")}               Non-interactive: emit a JSON plan (agent mode). No prompts.
  ${pc.cyan("--non-interactive")}    Alias for --json.
  ${pc.cyan("--set KEY=VALUE")}      Feed a credential to --json mode (repeatable).
  ${pc.cyan("--cwd <dir>")}          Repo root (default: current dir).
  ${pc.cyan("--env-example <path>")} Manifest file (default: <cwd>/.env.example).
  ${pc.cyan("--env-local <path>")}   Output file (default: <cwd>/.env.local).
  ${pc.cyan("--domain <domain>")}    Custom domain, for DNS-provisioning providers.
  ${pc.cyan("-h, --help")}           This help.

${b("EXAMPLES")}
  ${pc.dim("# Interactive setup of the current repo")}
  bsp
  ${pc.dim("# Let an agent see what's still missing")}
  bsp --json
  ${pc.dim("# Set up + create the Neon database in one shot")}
  bsp --provision
`,
  );
}

// ── entry ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    return;
  }
  if (flags.json) {
    await runJson(flags);
    return;
  }
  await runInteractive(flags);
}

main().catch((err) => {
  // ponytail: single top-level catch — recipes throw on unexpected failures, we
  // surface + exit non-zero. Upgrade path: per-recipe isolation if one flaky
  // provider should not abort the whole run.
  console.error(pc.red("provision failed:"), err instanceof Error ? err.message : err);
  process.exit(1);
});
