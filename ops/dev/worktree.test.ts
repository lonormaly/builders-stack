import { afterEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const fixtures: string[] = [];
const sourceRoot = resolve(import.meta.dir, "../..");

function run(cwd: string, command: string[], env: Record<string, string> = {}) {
  return Bun.spawnSync(command, {
    cwd,
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
}

function git(cwd: string, ...args: string[]) {
  const result = run(cwd, ["git", ...args]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString() || result.stdout.toString());
  }
  return result.stdout.toString().trim();
}

function setupRepository() {
  const fixture = mkdtempSync(join(tmpdir(), "builders-stack-worktree-"));
  fixtures.push(fixture);
  const repo = join(fixture, "repo");
  const remote = join(fixture, "origin.git");
  const fakeBin = join(fixture, "bin");
  mkdirSync(join(repo, "ops", "dev"), { recursive: true });
  mkdirSync(fakeBin);

  cpSync(join(sourceRoot, "ops", "dev", "worktree.sh"), join(repo, "ops", "dev", "worktree.sh"));
  chmodSync(join(repo, "ops", "dev", "worktree.sh"), 0o755);
  writeFileSync(
    join(repo, "package.json"),
    `${JSON.stringify({ name: "fixture", private: true, packageManager: "bun@1.3.14" }, null, 2)}\n`,
  );
  writeFileSync(join(repo, ".wt0-version"), "0.1.8\n");
  writeFileSync(join(repo, "bun.lock"), '{\n  "lockfileVersion": 1\n}\n');
  writeFileSync(join(repo, "bunfig.toml"), '[install]\nlinker = "isolated"\nglobalStore = true\n');
  writeFileSync(join(repo, ".gitignore"), "node_modules/\n.builders-stack-worktree\n.env.local\n");
  writeFileSync(
    join(fakeBin, "bun"),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then printf '%s\\n' "\${FAKE_BUN_VERSION:-1.3.14}"; exit 0; fi
if [[ "\${1:-}" == "install" ]]; then
  mkdir -p node_modules/.bun "\${FAKE_SHARED_STORE:?}"
  ln -s "\${FAKE_SHARED_STORE}" node_modules/.bun/fixture@1.0.0
  exit 0
fi
exit 64
`,
  );
  chmodSync(join(fakeBin, "bun"), 0o755);
  writeFileSync(
    join(fakeBin, "wt0"),
    `#!/usr/bin/env bash
set -euo pipefail
case "\${1:-}" in
  --version) printf 'wt0 0.1.8\n'; exit 0 ;;
  --help) exit 0 ;;
  create)
    branch="$2"; shift 2; target=""; base="HEAD"
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --path) target="$2"; shift 2 ;;
        --base) base="$2"; shift 2 ;;
        --ephemeral | --require-cow) shift ;;
        *) exit 64 ;;
      esac
    done
    git worktree add -b "$branch" "$target" "$base" >/dev/null
    ;;
  prepare)
    target="$2"
    (cd "$target" && bun install --frozen-lockfile)
    ;;
  doctor) exit 0 ;;
  remove)
    target="$2"
    git worktree remove "$target"
    ;;
  prune) git worktree prune ;;
  *) exit 64 ;;
esac
`,
  );
  chmodSync(join(fakeBin, "wt0"), 0o755);

  git(fixture, "init", "--bare", remote);
  git(fixture, "init", "-b", "main", repo);
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Worktree Test");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "initial");
  git(repo, "remote", "add", "origin", remote);
  git(repo, "push", "-u", "origin", "main");

  return {
    fixture,
    repo,
    script: join(repo, "ops", "dev", "worktree.sh"),
    env: {
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
      FAKE_SHARED_STORE: join(fixture, "shared-store"),
      WORKTREE_ZERO_BIN: join(fakeBin, "wt0"),
    },
    managedRoot: join(dirname(repo), "repo-worktrees"),
  };
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

describe("managed worktree lifecycle", () => {
  test("creates a shared-store install and only removes merged, clean work", () => {
    const { repo, script, env, managedRoot } = setupRepository();
    const branch = "feat/shared-store";
    const worktree = join(managedRoot, "feat-shared-store");

    const created = run(repo, [script, branch], env);
    expect(created.exitCode).toBe(0);
    expect(existsSync(join(worktree, ".builders-stack-worktree"))).toBe(true);
    expect(existsSync(join(worktree, "node_modules", ".bun", "fixture@1.0.0"))).toBe(true);

    git(worktree, "config", "user.email", "test@example.com");
    git(worktree, "config", "user.name", "Worktree Test");
    writeFileSync(join(worktree, "feature.txt"), "ready\n");
    git(worktree, "add", "feature.txt");
    git(worktree, "commit", "-m", "feat: ready");
    const featureCommit = git(worktree, "rev-parse", "HEAD");

    const refused = run(repo, [script, "--rm", branch], env);
    expect(refused.exitCode).not.toBe(0);
    expect(refused.stderr.toString()).toContain("not in origin/main");
    expect(existsSync(worktree)).toBe(true);

    writeFileSync(join(repo, "main.txt"), "different parent\n");
    git(repo, "add", "main.txt");
    git(repo, "commit", "-m", "chore: move main");
    git(repo, "cherry-pick", featureCommit);
    git(repo, "push", "origin", "main");

    writeFileSync(join(worktree, ".env.local"), "keep=this\n");
    const localFileRefused = run(repo, [script, "--rm", branch], env);
    expect(localFileRefused.exitCode).not.toBe(0);
    expect(localFileRefused.stderr.toString()).toContain(".env.local");
    unlinkSync(join(worktree, ".env.local"));

    const removed = run(repo, [script, "--rm", branch], env);
    if (removed.exitCode !== 0) {
      throw new Error(removed.stderr.toString() || removed.stdout.toString());
    }
    expect(removed.exitCode).toBe(0);
    expect(existsSync(worktree)).toBe(false);
    expect(git(repo, "show-ref", "--verify", `refs/heads/${branch}`)).toContain(featureCommit);
  }, 30_000);

  test("rejects an old Bun, dirty removal, and work above the cap", () => {
    const { repo, script, env, managedRoot } = setupRepository();

    const oldBun = run(repo, [script, "feat/old-bun"], { ...env, FAKE_BUN_VERSION: "1.3.12" });
    expect(oldBun.exitCode).not.toBe(0);
    expect(oldBun.stderr.toString()).toContain("Bun 1.3.14 is required");
    expect(existsSync(join(managedRoot, "feat-old-bun"))).toBe(false);

    expect(run(repo, [script, "feat/dirty"], env).exitCode).toBe(0);
    const dirtyWorktree = join(managedRoot, "feat-dirty");
    writeFileSync(join(dirtyWorktree, "not-committed.txt"), "keep me\n");
    const dirtyRemoval = run(repo, [script, "--rm", "feat/dirty"], env);
    expect(dirtyRemoval.exitCode).not.toBe(0);
    expect(dirtyRemoval.stderr.toString()).toContain("uncommitted or untracked work");

    const capped = run(repo, [script, "feat/too-many"], {
      ...env,
      BUILDERS_STACK_MAX_WORKTREES: "1",
    });
    expect(capped.exitCode).not.toBe(0);
    expect(capped.stderr.toString()).toContain("limit 1");
  }, 30_000);
});
