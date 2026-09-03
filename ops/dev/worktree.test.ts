import { afterEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const fixtures: string[] = [];
const sourceRoot = resolve(import.meta.dir, "../..");
const wt0Version = readFileSync(join(sourceRoot, ".wt0-version"), "utf8").trim();

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
  writeFileSync(join(repo, ".wt0-version"), `${wt0Version}\n`);
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
  --version) printf 'wt0 ${wt0Version}\n'; exit 0 ;;
  --help) exit 0 ;;
  create)
    branch="$2"; shift 2; target=""; base="HEAD"
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --path) target="$2"; shift 2 ;;
        --base) base="$2"; shift 2 ;;
        --ephemeral | --require-cow) shift ;;
        --owner | --require-free | --idempotency-key) shift 2 ;;
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
  fleet)
    if [[ -n "\${FAKE_WT0_FLEET_JSON:-}" ]]; then
      printf '%s' "$FAKE_WT0_FLEET_JSON"
    else
      printf '{"runtimes":[]}'
    fi
    ;;
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

describe("has_live_cwd", () => {
  test("refuses removal while a live process has its cwd inside the worktree", () => {
    const { repo, script, env, managedRoot } = setupRepository();
    const branch = "feat/live-cwd";
    const worktree = join(managedRoot, "feat-live-cwd");

    expect(run(repo, [script, branch], env).exitCode).toBe(0);

    const liveProc = Bun.spawn(["sleep", "30"], {
      cwd: worktree,
      stdout: "ignore",
      stderr: "ignore",
    });
    try {
      const refused = run(repo, [script, "--rm", branch], env);
      expect(refused.exitCode).not.toBe(0);
      expect(refused.stderr.toString()).toContain("still has a running shell or process");
      expect(existsSync(worktree)).toBe(true);
    } finally {
      liveProc.kill();
    }

    // Poll rather than a fixed sleep: the OS reaps the exited process's open
    // fds asynchronously, so lsof can briefly still see it after kill().
    const deadline = Date.now() + 10_000;
    let removed = run(repo, [script, "--rm", branch], env);
    while (removed.exitCode !== 0 && Date.now() < deadline) {
      removed = run(repo, [script, "--rm", branch], env);
    }
    if (removed.exitCode !== 0) throw new Error(removed.stderr.toString());
    expect(existsSync(worktree)).toBe(false);
  }, 30_000);

  test("fails closed — never opens — when the lsof sweep can't complete within the bound", () => {
    const { fixture, repo, script, env, managedRoot } = setupRepository();
    const branch = "feat/lsof-stall";
    const worktree = join(managedRoot, "feat-lsof-stall");
    expect(run(repo, [script, branch], env).exitCode).toBe(0);

    const fakeBin = join(fixture, "bin");
    writeFileSync(join(fakeBin, "lsof"), "#!/usr/bin/env bash\nsleep 999\n");
    chmodSync(join(fakeBin, "lsof"), 0o755);

    const stalled = run(repo, [script, "--rm", branch], {
      ...env,
      BUILDERS_STACK_LIVE_CHECK_TIMEOUT_SECONDS: "1",
    });
    expect(stalled.exitCode).not.toBe(0);
    expect(stalled.stderr.toString()).toContain("could not prove no live process");
    expect(stalled.stderr.toString()).toContain("within 1s");
    expect(existsSync(worktree)).toBe(true);
  }, 30_000);
});

describe("pre-remove hook", () => {
  test("assert-safe runs the worktree's own wrapper copy, not the main checkout's", () => {
    // WT0_REPO_ROOT is always the main checkout's working tree (wt0 0.1.16),
    // which can legitimately be on a branch that predates this tooling or
    // lacks it entirely. The worktree being removed always carries its own
    // copy, so the hook must prefer that and fall back to WT0_REPO_ROOT only
    // when the worktree's own copy is missing.
    const hook = readFileSync(join(sourceRoot, ".wt0", "hooks", "pre-remove"), "utf8");
    const worktreeCopyIndex = hook.indexOf('WORKTREE_SH="$WT0_WORKTREE/ops/dev/worktree.sh"');
    const fallbackIndex = hook.indexOf('WORKTREE_SH="$WT0_REPO_ROOT/ops/dev/worktree.sh"');
    expect(worktreeCopyIndex).toBeGreaterThan(-1);
    expect(fallbackIndex).toBeGreaterThan(worktreeCopyIndex);
    expect(hook).toContain('exec "$WORKTREE_SH" --assert-safe "$WT0_BRANCH" "$WT0_WORKTREE"');
  });
});

// Shared by the "ops/dev/wt0.sh" describe block below. Module-scoped (not
// nested in the describe) so they aren't recreated per test.
function cacheRootFor(home: string) {
  return process.platform === "darwin"
    ? join(home, "Library", "Caches", "WorktreeZero")
    : join(home, ".cache", "worktree-zero");
}

function setupWt0Fixture(pinnedVersion: string) {
  const fixture = mkdtempSync(join(tmpdir(), "builders-stack-wt0sh-"));
  fixtures.push(fixture);
  const root = join(fixture, "repo");
  const fakeBin = join(fixture, "bin");
  const home = join(fixture, "home");
  mkdirSync(join(root, "ops", "dev"), { recursive: true });
  mkdirSync(fakeBin, { recursive: true });
  mkdirSync(home, { recursive: true });

  cpSync(join(sourceRoot, "ops", "dev", "wt0.sh"), join(root, "ops", "dev", "wt0.sh"));
  chmodSync(join(root, "ops", "dev", "wt0.sh"), 0o755);
  writeFileSync(join(root, ".wt0-version"), `${pinnedVersion}\n`);

  return {
    root,
    fakeBin,
    script: join(root, "ops", "dev", "wt0.sh"),
    cacheRoot: cacheRootFor(home),
    baseEnv: { PATH: `${fakeBin}:${process.env.PATH ?? ""}`, HOME: home },
  };
}

function writeFakeWt0(fakeBin: string, reportedVersion: string, marker: string) {
  writeFileSync(
    join(fakeBin, "wt0"),
    `#!/usr/bin/env bash
set -euo pipefail
case "\${1:-}" in
  --version) printf 'wt0 ${reportedVersion}\\n'; exit 0 ;;
  *) printf '${marker}:%s\\n' "$*"; exit 0 ;;
esac
`,
  );
  chmodSync(join(fakeBin, "wt0"), 0o755);
}

function writeFakeDownloadTools(fakeBin: string) {
  // curl: satisfy `--output <path> <url>` by writing a placeholder file —
  // enough for the fake tar below to find and "extract".
  writeFileSync(
    join(fakeBin, "curl"),
    `#!/usr/bin/env bash
set -euo pipefail
out=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) out="$2"; shift 2 ;;
    *) shift ;;
  esac
done
[[ -n "$out" ]] && : > "$out"
exit 0
`,
  );
  chmodSync(join(fakeBin, "curl"), 0o755);
  writeFileSync(join(fakeBin, "shasum"), "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(join(fakeBin, "shasum"), 0o755);
}

// tar: instead of extracting a real archive, install a controllable fake
// `wt0` binary at the path wt0.sh expects next — inferring `wt0-$target`
// from the placeholder asset's own name so this works on any host arch.
function writeFakeTar(fakeBin: string, behavior: "fast" | "hang", reportedVersion: string) {
  writeFileSync(
    join(fakeBin, "tar"),
    `#!/usr/bin/env bash
set -euo pipefail
archive="$(ls wt0-*.tar.gz | head -1)"
dir="\${archive%.tar.gz}"
mkdir -p "$dir"
cat > "$dir/wt0" <<'BINARY'
#!/usr/bin/env bash
if [[ "\${1:-}" == "--version" ]]; then
  ${behavior === "hang" ? "sleep 999" : `printf 'wt0 ${reportedVersion}\\n'`}
  exit 0
fi
exit 64
BINARY
chmod +x "$dir/wt0"
exit 0
`,
  );
  chmodSync(join(fakeBin, "tar"), 0o755);
}

describe("ops/dev/wt0.sh", () => {
  // Independent of worktree.sh's fixtures above: those bypass wt0.sh entirely
  // via WORKTREE_ZERO_BIN. These exercise wt0.sh itself — real dependencies
  // (bash builtins, mktemp, install, find, and the real system curl/tar where
  // a test doesn't fake them) come from the real PATH; only `wt0` and, where
  // noted, `curl`/`tar`/`shasum` are shadowed per test.

  test("prefers a PATH wt0 that already satisfies .wt0-version, without downloading", () => {
    const { root, fakeBin, script, cacheRoot, baseEnv } = setupWt0Fixture("0.1.16");
    writeFakeWt0(fakeBin, "0.1.18", "path-wt0-ran");
    // Deliberately no fake curl/tar here: if PATH-preference ever regresses
    // and this falls through to a download, it either hits the network
    // loudly (failing the exitCode check below) or leaves telltale output
    // that doesn't match the PATH marker — either way this test catches it.

    const result = run(root, [script, "list", "--json"], baseEnv);
    if (result.exitCode !== 0) throw new Error(result.stderr.toString());
    expect(result.stdout.toString()).toContain("path-wt0-ran:list --json");
    expect(existsSync(cacheRoot)).toBe(false);
  }, 30_000);

  test("ignores a PATH wt0 older than .wt0-version and downloads the pinned version", () => {
    const { root, fakeBin, script, cacheRoot, baseEnv } = setupWt0Fixture("0.1.16");
    writeFakeWt0(fakeBin, "0.1.10", "path-wt0-ran");
    writeFakeDownloadTools(fakeBin);
    writeFakeTar(fakeBin, "fast", "0.1.16");

    const result = run(root, [script, "--version"], baseEnv);
    if (result.exitCode !== 0)
      throw new Error(result.stderr.toString() || result.stdout.toString());
    expect(result.stdout.toString().trim()).toBe("wt0 0.1.16");
    expect(result.stdout.toString()).not.toContain("path-wt0-ran");

    const leftoverTmp = run(root, ["find", cacheRoot, "-name", "*.tmp"], baseEnv);
    expect(leftoverTmp.stdout.toString().trim()).toBe("");
  }, 30_000);

  test("bounds a hung fresh download's version check and leaves no tmp file", () => {
    const { root, fakeBin, script, cacheRoot, baseEnv } = setupWt0Fixture("0.1.16");
    writeFakeWt0(fakeBin, "0.1.10", "path-wt0-ran"); // too old: forces a download
    writeFakeDownloadTools(fakeBin);
    writeFakeTar(fakeBin, "hang", "0.1.16"); // the "downloaded" binary hangs on --version

    const result = run(root, [script, "--version"], {
      ...baseEnv,
      WT0_VERSION_CHECK_TIMEOUT_SECONDS: "1",
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("did not report its version within 1s");
    expect(result.stderr.toString()).toContain("Homebrew/npm");

    const leftoverTmp = run(root, ["find", cacheRoot, "-name", "*.tmp"], baseEnv);
    expect(leftoverTmp.stdout.toString().trim()).toBe("");
  }, 30_000);
});

describe("safe-to-remove provenance: marker or wt0 ownership", () => {
  // The .builders-stack-worktree marker was this wrapper's only proof of
  // provenance before wt0 had its own ownership records. Under 0.1.16 every
  // wt0 runtime — including one created straight through `wt0 create`,
  // bypassing this wrapper entirely — carries its own ownership (WT0_RUNTIME_ID,
  // reported per-worktree by `wt0 fleet`), which is equally valid proof.

  test("removes a wt0-owned worktree that has no wrapper marker", () => {
    const { repo, script, env, managedRoot, fixture } = setupRepository();
    const branch = "feat/direct-wt0-create";
    const worktree = join(managedRoot, "feat-direct-wt0-create");
    const runtimeId = "01a00000-0000-7000-8000-000000000001";

    // Simulate a bare `wt0 create` that bypassed the wrapper: no
    // .builders-stack-worktree marker gets written, straight off HEAD so
    // it's already fully present in origin/main (nothing unmerged).
    mkdirSync(managedRoot, { recursive: true });
    const created = run(
      repo,
      [join(fixture, "bin", "wt0"), "create", branch, "--path", worktree, "--base", "HEAD"],
      env,
    );
    expect(created.exitCode).toBe(0);
    expect(existsSync(join(worktree, ".builders-stack-worktree"))).toBe(false);

    // git worktree list reports the physical (symlink-resolved) path — e.g.
    // /private/var/... on macOS, where TMPDIR itself sits behind a symlink —
    // which is what the wrapper compares against, so the fleet fixture must
    // report the same resolved form rather than the raw path we requested.
    const fleetJson = JSON.stringify({
      runtimes: [
        { worktree: realpathSync(worktree), runtime_id: runtimeId, branch: `refs/heads/${branch}` },
      ],
    });
    const removed = run(repo, [script, "--rm", branch], {
      ...env,
      WT0_RUNTIME_ID: runtimeId,
      FAKE_WT0_FLEET_JSON: fleetJson,
    });
    if (removed.exitCode !== 0) {
      throw new Error(removed.stderr.toString() || removed.stdout.toString());
    }
    expect(existsSync(worktree)).toBe(false);
  }, 30_000);

  test("prefers wt0 list --json's runtime_id over fleet --json once a wt0 release reports it", () => {
    // lonormaly/worktree-zero D20 adds `runtime_id` to `wt0 list --json` (far
    // cheaper than `fleet --json`, which computes dirty/merged/live/size for
    // every worktree). is_wt0_owned detects support by key presence, not
    // version number, so this proves the fast path activates automatically —
    // the fake `fleet` case below fails loudly if it's ever reached.
    const { repo, script, env, managedRoot, fixture } = setupRepository();
    const branch = "feat/list-runtime-id";
    const worktree = join(managedRoot, "feat-list-runtime-id");
    const runtimeId = "01a00000-0000-7000-8000-000000000003";

    mkdirSync(managedRoot, { recursive: true });
    const created = run(
      repo,
      [join(fixture, "bin", "wt0"), "create", branch, "--path", worktree, "--base", "HEAD"],
      env,
    );
    expect(created.exitCode).toBe(0);

    const listJson = JSON.stringify({
      schema_version: 1,
      worktrees: [
        { worktree: realpathSync(worktree), branch: `refs/heads/${branch}`, runtime_id: runtimeId },
      ],
    });
    writeFileSync(
      join(fixture, "bin", "wt0"),
      `#!/usr/bin/env bash
set -euo pipefail
case "\${1:-}" in
  --version) printf 'wt0 ${wt0Version}\n'; exit 0 ;;
  --help) exit 0 ;;
  remove) target="$2"; git worktree remove "$target" ;;
  prune) git worktree prune ;;
  list) printf '%s' '${listJson}' ;;
  fleet)
    echo "fleet --json must not run once list --json already reports runtime_id" >&2
    exit 1
    ;;
  *) exit 64 ;;
esac
`,
    );
    chmodSync(join(fixture, "bin", "wt0"), 0o755);

    const removed = run(repo, [script, "--rm", branch], { ...env, WT0_RUNTIME_ID: runtimeId });
    if (removed.exitCode !== 0) {
      throw new Error(removed.stderr.toString() || removed.stdout.toString());
    }
    expect(existsSync(worktree)).toBe(false);
  }, 30_000);

  test("refuses a worktree with neither the marker nor a matching wt0 fleet entry", () => {
    const { repo, script, env, managedRoot, fixture } = setupRepository();
    const branch = "feat/orphaned";
    const worktree = join(managedRoot, "feat-orphaned");

    mkdirSync(managedRoot, { recursive: true });
    const created = run(
      repo,
      [join(fixture, "bin", "wt0"), "create", branch, "--path", worktree, "--base", "HEAD"],
      env,
    );
    expect(created.exitCode).toBe(0);

    // No WT0_RUNTIME_ID, no fleet entry for this path: not the wrapper's,
    // and wt0 doesn't claim it either.
    const refused = run(repo, [script, "--rm", branch], env);
    expect(refused.exitCode).not.toBe(0);
    expect(refused.stderr.toString()).toContain(
      "was not created by this wrapper and is not a wt0-owned runtime",
    );
    expect(existsSync(worktree)).toBe(true);

    // A WT0_RUNTIME_ID that doesn't match anything in the fleet is equally
    // insufficient — the cross-check has to actually hold.
    const mismatched = run(repo, [script, "--rm", branch], {
      ...env,
      WT0_RUNTIME_ID: "01a00000-0000-7000-8000-000000000002",
      FAKE_WT0_FLEET_JSON: JSON.stringify({ runtimes: [] }),
    });
    expect(mismatched.exitCode).not.toBe(0);
    expect(mismatched.stderr.toString()).toContain(
      "was not created by this wrapper and is not a wt0-owned runtime",
    );
    expect(existsSync(worktree)).toBe(true);
  }, 30_000);
});
