#!/usr/bin/env bun
// ops/ci/fast.ts — the commit gate: plan the smallest honest set of checks for
// this diff, then run them in parallel.
//
// It answers one question quickly — did this change break the code it can
// affect? — and nothing else. Database rebuilds, production builds and
// repository-wide security scans belong to .github/workflows/release-proof.yml,
// which starts clean and remains the final authority.
//
// THE PLAN IS THE POINT. Every whole-repository gate here reads a known set of
// files. Running one whose inputs did not move proves nothing and costs seconds,
// so each gate runs only when a file it actually reads changed — the same
// affected rule Nx applies to code, applied to the checkers. A docs-only commit
// therefore builds no graph and runs no gate; a root-input change runs all of
// them.
//
//   bun ops/ci/fast.ts <base> <head>

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { touchesTriggerSurface } from "../../scripts/check-changelog";
import { nxCacheEnv } from "./nx-cache";

export type FastCheck =
  | "check:agent-readability"
  | "check:changelog"
  | "check:deployables"
  | "check:seo"
  | "check:typescript"
  | "check:worktrees";

export interface FastPlan {
  boundaryFiles: string[];
  checks: FastCheck[];
  formatFiles: string[];
  lintFiles: string[];
  runNx: boolean;
}

const FORMAT_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".json",
  ".jsonc",
  ".jsx",
  ".md",
  ".mdx",
  ".scss",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const CODE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const WORKSPACE_PREFIXES = ["apps/", "libs/", "packages/", "services/"];

// nx.json's `sharedGlobals` plus the two files that decide what Nx may look at
// and how dependencies resolve. Changing any one of these moves EVERY task hash
// in the workspace, so the plan stops being selective and runs everything.
// Keep this list equal to nx.json's sharedGlobals — a `sharedGlobals` entry
// missing here makes the planner under-run, and one added here that Nx does not
// hash only makes it over-run.
const GRAPH_INPUTS = new Set([
  ".nxignore",
  "bun.lock",
  "bunfig.toml",
  "eslint.config.mjs",
  "nx.json",
  "package.json",
  "scripts/typecheck-native.sh",
  "tsconfig.base.json",
]);

function extension(path: string): string {
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  return dot > slash ? path.slice(dot) : "";
}

function startsWithAny(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path.startsWith(prefix));
}

// One entry per whole-repository gate, naming the files that gate reads. Add a
// gate to package.json and it belongs here too, with a test in fast.test.ts —
// a gate nobody listed is a gate that never runs on the change that breaks it.
const gateInputs: ReadonlyArray<{
  check: FastCheck;
  matches: (path: string) => boolean;
}> = [
  {
    check: "check:seo",
    matches: (path) =>
      path === "scripts/check-seo.ts" || path.startsWith("libs/seo/") || path.startsWith("apps/"),
  },
  {
    // Builds + starts every app to crawl it, so it's the priciest gate this planner
    // runs — but the spec is about what an agent gets over HTTP, which only a build
    // can prove. Same trigger surface as check:seo (any app or the seo lib, which
    // owns the markdown-mirror/content-negotiation plumbing every app shares).
    check: "check:agent-readability",
    matches: (path) =>
      path === "scripts/check-agent-readability.ts" ||
      path.startsWith("libs/seo/") ||
      path.startsWith("apps/"),
  },
  {
    check: "check:deployables",
    matches: (path) =>
      path === "scripts/check-deployables.ts" ||
      path === "ops/deploy/deployables.json" ||
      path === "ops/deploy/build-images.sh" ||
      /^(apps|services)\/[^/]+\/package\.json$/.test(path),
  },
  {
    check: "check:typescript",
    matches: (path) =>
      path === "scripts/check-typescript.ts" ||
      path === "scripts/typecheck-native.sh" ||
      path.endsWith("/package.json"),
  },
  {
    // CHANGELOG.md's own diff content decides pass/fail (dependabot exemption
    // included) — that needs the base/head range, not just a file list, so
    // main() below special-cases this one check's invocation. `matches` here
    // only decides whether the gate is relevant at all, same as every other
    // gate, reusing the one trigger-surface definition scripts/check-changelog.ts
    // itself checks against.
    check: "check:changelog",
    matches: (path) => path === "scripts/check-changelog.ts" || touchesTriggerSurface(path),
  },
  {
    check: "check:worktrees",
    matches: (path) =>
      path === "scripts/check-worktrees.ts" ||
      path === ".tool-versions" ||
      path.startsWith("ops/dev/"),
  },
];

export function planFastChecks(files: readonly string[]): FastPlan {
  const existing = files.filter((path) => path.length > 0);
  const formatFiles = existing.filter((path) => FORMAT_EXTENSIONS.has(extension(path)));
  const lintFiles = existing.filter((path) => CODE_EXTENSIONS.has(extension(path)));
  const boundaryFiles = lintFiles.filter((path) => startsWithAny(path, WORKSPACE_PREFIXES));
  const rootGraphChanged = existing.some((path) => GRAPH_INPUTS.has(path));
  const runNx =
    rootGraphChanged || existing.some((path) => startsWithAny(path, WORKSPACE_PREFIXES));

  const checks = rootGraphChanged
    ? gateInputs.map(({ check }) => check)
    : gateInputs.filter(({ matches }) => existing.some(matches)).map(({ check }) => check);

  return { boundaryFiles, checks, formatFiles, lintFiles, runNx };
}

function changedFiles(base: string, head: string): string[] {
  const result = spawnSync("git", ["diff", "--name-only", "--diff-filter=ACMR", "-z", base, head], {
    encoding: "buffer",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout.toString().split("\0").filter(Boolean);
}

async function main(): Promise<void> {
  const [base, head] = process.argv.slice(2);
  if (!base || !head) {
    console.error("usage: bun ops/ci/fast.ts BASE HEAD");
    process.exit(2);
  }

  const plan = planFastChecks(changedFiles(base, head));

  // Serve the seeded answers before any Nx client starts. A root-input change
  // invalidates every task hash in the workspace, and recomputing that graph on
  // a small runner measured 10-14 minutes upstream. A dev machine computes those
  // answers ahead of time with ops/ci/seed-cache.ts and leaves them in this
  // directory, so the runner replays them. Off entirely when STACK_CI_CACHE_ROOT
  // is unset, which is every laptop and every GitHub-hosted runner: a hand-run of
  // this file gets the plain local Nx cache.
  const cacheRoot = process.env.STACK_CI_CACHE_ROOT;
  const cache = nxCacheEnv(cacheRoot ? join(cacheRoot, "nx-remote") : undefined);
  Object.assign(process.env, cache.env);

  // Build the graph once before the CPU-heavy checkers start, so the boundary
  // lint and `nx affected` below read an on-disk graph instead of racing to
  // compute the same one twice.
  //
  // Spawned asynchronously, NOT with spawnSync: the cache server above lives on
  // THIS process's event loop, and a synchronous child freezes it. Nx then hangs
  // on its own store request with no error at all — measured upstream as one
  // completed task in seventeen minutes.
  if (plan.runNx) {
    const graph = Bun.spawn(["bunx", "nx", "show", "projects"], {
      env: process.env,
      stderr: "ignore",
      stdout: "ignore",
    });
    const status = await graph.exited;
    if (status !== 0) process.exit(status);
  }

  const commands: string[][] = [];
  if (plan.formatFiles.length > 0) commands.push(["bunx", "oxfmt", "--check", ...plan.formatFiles]);
  if (plan.lintFiles.length > 0) commands.push(["bunx", "oxlint", ...plan.lintFiles]);
  // ESLint is the ONLY module-boundary check (@nx/enforce-module-boundaries).
  // Oxlint above is the fast whole-file pass; it does not know the graph.
  if (plan.boundaryFiles.length > 0) commands.push(["bunx", "eslint", ...plan.boundaryFiles]);
  if (plan.runNx) {
    commands.push([
      "bunx",
      "nx",
      "affected",
      "-t",
      "typecheck,test",
      `--base=${base}`,
      `--head=${head}`,
      "--parallel=3",
      "--output-style=static",
    ]);
  }
  for (const check of plan.checks) {
    // check:changelog reads CHANGELOG.md's own diff (and the dependabot
    // exemption) against this exact range — every other gate reads only the
    // working tree, so it alone needs base/head passed through.
    commands.push(
      check === "check:changelog"
        ? ["bun", "scripts/check-changelog.ts", base, head]
        : ["bun", "run", check],
    );
  }
  // The planner is part of the merge gate. Its own tests are always cheap enough
  // to run and are what stop a new path from silently skipping a gate.
  commands.push(["bun", "test", "ops/ci/fast.test.ts"]);

  const children = commands.map((command) =>
    Bun.spawn(command, { env: process.env, stderr: "inherit", stdout: "inherit" }),
  );
  const statuses = await Promise.all(children.map((child) => child.exited));
  cache.stop();
  if (statuses.some((status) => status !== 0)) process.exit(1);
  // Every checker has exited and flushed its inherited output. Exit now so a
  // client handle opened by a checker cannot keep the successful job alive.
  process.exit(0);
}

if (import.meta.main) await main();
