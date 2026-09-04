# Known issues

Two rough edges in this template that are real, reproduced, and worked around — not fixed at the root, because the root cause lives upstream (Next.js/Turbopack) or off-repo (macOS Gatekeeper). Each entry says what breaks, why, the workaround shipped, and the exact condition under which you can delete the workaround.

## Turbopack fails under Bun's isolated linker + global store

**What breaks:** `next build` (Turbopack, the default since Next 15) fails with `Symlink … points out of the filesystem root`, on a local machine and on a fresh GitHub Actions runner alike.

**Why:** `bunfig.toml` here sets `linker = "isolated"` and `globalStore = true` (see the file's own comment) — Bun installs every package once into a shared store under the home directory (`~/.bun/install/cache/links/...`) and symlinks each checkout's `node_modules` to it, so parallel worktrees stay isolated without copying gigabytes of dependencies into each one. Turbopack's project boundary defaults to `outputFileTracingRoot` (each app's `next.config.ts` pins that to the repo root, so Next doesn't guess it from a stray lockfile higher up). The shared store sits _outside_ that boundary, and Turbopack refuses to follow a symlink that points outside its project root. Tracked upstream: [vercel/next.js#94432](https://github.com/vercel/next.js/issues/94432).

**Workaround shipped:** each app's `next.config.ts` (`apps/web`, `apps/blog`, `apps/landing`) sets:

```ts
turbopack: {
  root: os.homedir(),
},
```

widening Turbopack's boundary to the home directory — the common ancestor of both the repo and the store — so the build stays on Turbopack instead of falling back to webpack. `scripts/check-agent-readability.ts` deliberately keeps the default `next build`, making CI build and start all three apps through this exact path whenever an app changes.

**Remove this when:** vercel/next.js#94432 is fixed upstream, or this repo stops using Bun's isolated linker + global store (drop `linker = "isolated"` / `globalStore = true` from `bunfig.toml`, and each app gets its own uncollapsed `node_modules` instead).

## `wt0 remove` / the pre-remove hook can stall for minutes

**What breaks:** removing a Worktree Zero-managed worktree (`wt0 remove`, or the `.wt0/hooks/pre-remove` hook that runs before it) can hang for minutes instead of finishing in under a second, with the process pegged at 0% CPU — looks hung, isn't spinning.

**Why — two independent causes, both under `ops/dev/`:**

1. **`ops/dev/wt0.sh` re-downloading a fresh wt0 binary.** Any never-launched copy of the unsigned/ad-hoc-signed macOS release binary can hang on its first launch for 6+ minutes — macOS's Gatekeeper "assess a new executable" pass, slow or stuck under load — while a copy that's already run once (or one Homebrew/npm already installed and vouched for) starts instantly. The real fix is signing + notarizing wt0's macOS binaries upstream; that's tracked on the wt0 side.
2. **`has_live_cwd` in `ops/dev/worktree.sh`.** The obvious fast alternative — asking `wt0 fleet --json` for the `live` field it already computes per runtime — turned out to be the wrong call when measured in this repo with several concurrent agent worktrees: `wt0 fleet --json` took 50-60s versus ~0.4s for a direct `lsof` sweep, and a `wt0 create`/`remove` running elsewhere can make _any_ wt0 subcommand (`--version` included) block on a lock this hook has no business waiting on. Routing liveness through wt0 would have reintroduced the same stall class through a different door.

**Workarounds shipped:**

- `ops/dev/wt0.sh` now prefers a `wt0` already on `PATH` (Homebrew, npm, or anything already launched once) whenever its version satisfies `.wt0-version` — same major.minor.patch, or newer. It downloads into the versioned cache only as a fallback, and bounds every `--version` probe — PATH, existing cache, and fresh candidate — with `WT0_VERSION_CHECK_TIMEOUT_SECONDS` (default 20s) instead of waiting indefinitely; a timed-out candidate prints an actionable message ("run it once from Terminal, or install wt0 via Homebrew/npm"). Every exit path — success, failure, or signal — cleans up its own `*.tmp`, and a stray one from a previous interrupted install is swept before a new one starts.
- `has_live_cwd` stays on a direct `lsof -n -w -d cwd` sweep (fast and independent of wt0's own locks), now bounded by a timeout (`BUILDERS_STACK_LIVE_CHECK_TIMEOUT_SECONDS`, default 30s) via `perl -e 'alarm …; exec …'` (macOS ships no `timeout`). It fails **closed**: a sweep that can't complete in time refuses removal with "could not prove no live process… retry" rather than assuming the worktree is safe.

**Remove this when:** wt0's macOS release binaries are signed and notarized (drops cause 1 outright); reassess `wt0 fleet --json`'s cost if a future wt0 release makes it cheap enough to be a real fast path for cause 2.

See [builders-stack#53](https://github.com/lonormaly/builders-stack/issues/53) for the original report and reproduction.
