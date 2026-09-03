#!/usr/bin/env bun
// check-changelog.ts — the CHANGELOG law: a PR that touches product code must
// add its own line to CHANGELOG.md's `## Unreleased` section, in the same
// diff. See docs/stack/changelog.md and AGENTS.md § "CHANGELOG — enforced".
//
// Trigger surface: apps/, libs/, services/, scripts/, ops/, .wt0*, Tiltfile,
// tilt_*.sh — the same "does this touch product code" question
// ops/ci/fast.ts's other gates ask, so this file is the one source of truth
// both `matches` (imported into fast.ts's gateInputs) and the standalone CLI
// below read from. A diff that touches none of it (docs-only, CI/workflow
// config, root package metadata, …) needs no entry and passes silently.
// Dependabot PRs are exempt too — routine dependency bumps aren't worth a
// changelog line — and the exemption is reported, not just applied quietly.
//
//   bun scripts/check-changelog.ts BASE HEAD

import { spawnSync } from "node:child_process";

const TRIGGER_PREFIXES = ["apps/", "libs/", "services/", "scripts/", "ops/", ".wt0"];

export function touchesTriggerSurface(path: string): boolean {
  return (
    TRIGGER_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
    path === "Tiltfile" ||
    /^tilt_.*\.sh$/.test(path)
  );
}

/** Content of the `## Unreleased` section — between its heading and the next
 * `## ` heading, or EOF — trimmed. "" if the file has no such section. */
export function unreleasedSection(changelog: string): string {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.trim() === "## Unreleased");
  if (start === -1) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
}

/** True when head's Unreleased section carries a change base's didn't. */
export function addedUnreleasedEntry(baseChangelog: string, headChangelog: string): boolean {
  const after = unreleasedSection(headChangelog);
  return after.length > 0 && after !== unreleasedSection(baseChangelog);
}

export function isDependabotActor(actor: string | undefined): boolean {
  return /^dependabot(\[bot\])?$/.test(actor ?? "");
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

function fileAt(ref: string, path: string): string {
  const result = spawnSync("git", ["show", `${ref}:${path}`], { encoding: "utf8" });
  return result.status === 0 ? result.stdout : "";
}

function main(): void {
  const [base, head] = process.argv.slice(2);
  if (!base || !head) {
    console.error("usage: bun scripts/check-changelog.ts BASE HEAD");
    process.exit(2);
  }

  const relevant = changedFiles(base, head).filter(touchesTriggerSurface);
  if (relevant.length === 0) {
    console.log(
      "✓ check:changelog — no apps/, libs/, services/, scripts/, ops/, .wt0*, Tiltfile, or " +
        "tilt_*.sh changes; nothing to log (docs-only changes are exempt).",
    );
    return;
  }

  const actor = process.env.GITHUB_ACTOR;
  if (isDependabotActor(actor)) {
    console.log(`✓ check:changelog — exempt: dependabot PR (actor "${actor}").`);
    return;
  }

  if (!addedUnreleasedEntry(fileAt(base, "CHANGELOG.md"), fileAt(head, "CHANGELOG.md"))) {
    console.error(`\n✖ check:changelog — ${relevant.length} file(s) changed product code:\n`);
    for (const path of relevant) console.error(`  • ${path}`);
    console.error(
      '\nCHANGELOG.md needs its own line under "## Unreleased" in this diff. ' +
        "See docs/stack/changelog.md.\n",
    );
    process.exit(1);
  }

  console.log("✓ check:changelog — CHANGELOG.md's Unreleased section changed in this diff.");
}

if (import.meta.main) main();
