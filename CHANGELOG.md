# Changelog

All notable changes to Builders Stack. Format:
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). New work accumulates
under `## Unreleased`; a release rolls that section into a dated version
heading and starts a fresh `## Unreleased`. See
[`docs/stack/changelog.md`](./docs/stack/changelog.md) for the law that keeps
this file honest — `scripts/check-changelog.ts` fails a PR that touches
product code without adding its own line here.

## Unreleased

### Added

- **Adopted Worktree Zero for the parallel-agent worktree lifecycle, in place
  of the wrapper's own hand-rolled create/prepare/remove logic (#43, #44,
  #46).** Source checkout, `doctor` verification, removal, and pruning now go
  through one checksum-verified `wt0` binary; `ops/dev/worktree.sh <branch>`
  stays the one command agents run, so Codex, Claude Code, and other agents
  keep a single instruction. Measured on real disk (Builders Stack, Bun
  1.3.14, isolated APFS): four worktrees fell from 1,532.74 MiB (native Git +
  Bun) to 421.27 MiB (pinned wt0 + Bun) — 72.5% less physical storage; the
  same comparison on Linux Btrfs was 1,427.42 MiB → 564.60 MiB, 60.4% less.
  Marginal storage per additional worktree fell from ~383 MiB to ~10 MiB once
  the first sealed environment existed (#44). The portable
  `create-a-worktree` skill now teaches the pinned lifecycle, prepared Bun
  environment, and physical-storage receipts (#46).
- **The wt0 pin then moved 0.1.5 → 0.1.10 as each release landed real
  capability (#45, #47, #48, #49).** Ownership leases, heartbeats,
  dry-run-first GC, active/open-path refusal, and detached-commit protection
  (0.1.7, #45); npm/pnpm/Yarn/Bun capability discovery, selecting Bun +
  APFS clonefile here (0.1.8, #47); automatic dependency preparation in
  `wt0 run` plus owned Cargo target output and crash-safe cleanup (0.1.9,
  #48); owned Nx workspace state and direct Wrangler local persistence
  (0.1.10, #49).
- **wt0 0.1.14: `.wt0-generated`, a pre-remove hook that reuses the wrapper's
  own safety check, and an owner + free-disk floor (#50).** `.wt0-generated`
  mirrors the wrapper's disposable-path allowlist so `wt0 gc --ephemeral`
  reaps finished worktrees without the wrapper's own `--gc` loop. The
  `.wt0/hooks/pre-remove` hook applies the wrapper's patch-in-base rule to
  every wt0 removal path by calling the one existing implementation
  (`worktree.sh --assert-safe`) instead of duplicating it, so unattended `gc`
  can never reap unmerged work. `wt0 create` now records an owner
  (`WT0_OWNER` → ImmorTerm session → user) and enforces a per-machine free-disk
  floor (`BUILDERS_STACK_WORKTREE_MIN_FREE`, default 10G). Proven locally:
  create + `prepare --apply` in 24.7s (365 MB logical `node_modules`, ~22 MB
  physical); `wt0 gc --ephemeral --apply` refused a worktree whose patch
  wasn't in the base, then reaped it once the base contained the patch.
- **wt0 0.1.16: `.wt0-seed`, Tilt ports and Portless hostnames derived from
  wt0 identity, and two parallel Tilt stacks proven live (#51).** A checked-in
  `.wt0-seed` policy clones the Nx and Next.js build caches (`.nx/cache`,
  `apps/{blog,landing,web}/.next/cache`) into new worktrees instead of
  starting cold (`node_modules` deliberately excluded — this project's Bun
  isolated global store already makes wt0's lockfile-identical seed gate
  refuse in favor of the cheaper native store). `tilt_up.sh`'s `PORT` now
  falls back to `WT0_PORT_BASE` before the `10380` default, and
  `.devops/Tiltfile` names every portless route `<role>-<WT0_SLUG>.stack`
  when `WT0_SLUG` is set. Proven with two wt0 worktrees running
  simultaneously: distinct port windows (22800/23100), distinct portless
  hostnames, and a shared proxy left untouched. `.wt0/hooks/pre-remove` now
  runs the _worktree's own_ copy of `ops/dev/worktree.sh` (falling back to
  the main checkout's only if missing) — `WT0_REPO_ROOT` correctly resolves
  to the main checkout, which can legitimately be on a branch that predates
  this tooling. `tilt_down.sh` now finds the process actually bound to its
  derived port and sends it `SIGINT` (what `tilt down` alone never did — it
  has no `--port` flag and never reaches a running `tilt up` engine's child
  processes) before still calling `tilt down` for Kubernetes/Docker cleanup.
  A follow-up fix accepted wt0 fleet ownership as proof of safe-to-remove
  provenance, not just the wrapper's marker file, so a worktree created with
  a bare `wt0 create`/`wt0 run` (bypassing `ops/dev/worktree.sh` entirely) is
  now just as removable as a wrapper-created one.
- **Agent readability scored, and WebMCP tool declarations shipped (#52).**
  `bun run check:agent-readability` crawls each built app against
  [Vercel's agent-readability spec](https://vercel.com/kb/guide/agent-readability-spec)
  — markdown mirrors, `Accept: text/markdown` content negotiation,
  `AGENTS.md`, `sitemap.md`, `llms.txt`, structured data with `dateModified`
  and `BreadcrumbList`, ≥3 headings, a glossary link — and gates on
  `--min 90`. All three apps ship at 90+ out of the box: landing 100/100,
  blog 100/100, web 98/100 (one honest, documented gap: the `/`
  design-system demo's text-to-HTML ratio). `@stack/webmcp` adds typed,
  zod-validated tool declarations (`defineTool()`) registered via
  `document.modelContext.registerTool()`, a `useRegisterTools()` hook, and a
  static `/.well-known/webmcp-tools.json` manifest so the checker can verify
  a page's tools without a WebMCP-supporting browser; wired a real
  `search_glossary` tool into `apps/web` and `describe_product` into
  `apps/landing`.
- **The fast CI baseline: affected-graph checks, native TypeScript 7, and a
  300 MB image gate (#37, #38).** The required gate now runs the affected Nx
  graph, tests, native TypeScript 7 typechecks, boundary lint, SEO, and
  deployment checks in parallel, reusing dependencies only when the saved
  marker is byte-identical to `bun.lock`; slower PostgreSQL, security,
  full-format, and production-build proof moved to a separate post-merge run.
  Every app/service gets one deployment decision, only affected units enter
  the deployment artifact, and Bun services bundle before Docker into one
  tiny runtime image, capped at 300 MB. Measured: fast lane 10.54s locally
  with a warm Nx cache; TypeScript 7 across all 18 projects in 6.48s; API/AI
  worker/payment images at 182/180/179 MB.
- **The change-class planner, a seeded Nx remote cache, and a warm runner
  pool (#42).** `ops/ci/fast.ts` plans instead of running everything: a
  docs-only change builds no graph and runs no gate (measured 0.72s); a root
  graph input runs all of them. Every whole-repo gate declares the files it
  reads, and `fast.test.ts` fails when a gate is added without one.
  `ops/ci/nx-cache.ts`/`seed-cache.ts` serve nx's built-in HTTP remote cache
  off a plain directory so a dev machine computes the graph once and CI
  replays it (the PUT must answer exactly 200 — 201/202/204 make nx report
  the task itself as failed, with no error text).
- **A managed worktree wrapper, before wt0 existed (#41).** Pinned Bun 1.3.14
  and enabled its isolated global virtual store so immutable packages install
  once while each worktree keeps its own safe dependency links.
  `ops/dev/worktree.sh` capped worktree count, required the pinned Bun,
  verified shared-store links, and refused removal when a checkout was
  dirty, active, held local ignored files, or carried patches/merges missing
  from `origin/main` — the same safety checks wt0 adoption (#43) later
  delegated to the `wt0` binary while keeping this wrapper as the one
  command agents run.
- **Social sign-in via popup, with redirect fallback (#17).** Adds a GitHub
  social sign-in button to the web auth page using the house popup pattern,
  ported from the production-proven krispy/adimoyal toolkit, so template
  clones inherit the popup flow instead of a full-page OAuth redirect.
  Email/password sign-in is unchanged.
- **Pre-wired the agent control plane's MCP servers (#26).** `agents/mcp.json`
  (the template copied to `.mcp.json`) adds read-only-by-default Neon
  (`?readonly=true`) and PostHog servers alongside the existing
  context7/postgres/filesystem/mobbin stubs, so a cloner sees every
  supported server with a key to fill in instead of discovering them one at
  a time; keys stay `${VAR}` refs, passed via env only (never argv, which
  leaks through `ps`/crash reports).

### Changed

- **Held oxlint-tsgolint at its 0.24 line in dependabot (#33).** Its 7.x line
  tracks TypeScript 7, already held back separately, and type-aware mode is
  disabled (the backend was OOM-ing); dependabot's regroup kept re-proposing
  the same `0.24 → 7.0.2001` jump.
- **Bumped the pinned Next.js preview: 16.3.0-preview.6 → preview.9, for
  Turbopack memory-eviction fixes (#30).** Four pins moved (`apps/web`,
  `apps/landing`, `apps/blog`, `libs/seo`); still on the preview line since
  the fix hasn't reached `latest` (16.2.11) yet.
- **Skipped slower portable Bun/Nx caches on ephemeral GitHub-hosted runners
  (#40).** Restoring and uploading the portable cache cost more than a cold
  Bun install; measured 55s (no cache) vs. 67s (cache-heavy). Persistent
  self-hosted runners still keep `node_modules`, reused only when the saved
  marker is byte-identical to `bun.lock`.
- **`actions/checkout` 4 → 7 in the github-actions dependabot group (#21).**
- **Bun 1.3.12 with a text `bun.lock`, replacing the binary lockfile (#19).**
  Aligns with the family standard after `bun.lockb` + Bun 1.1.34 broke a
  sibling repo's CI (`Outdated lockfile version` on any lockfile regenerated
  with Bun 1.3.x, and dependabot couldn't update `.lockb` at all).
- **Documented the credential-broker progression for agent-held secrets
  (#28).** `docs/stack/agent-skills.md` now covers what secrets an agent
  holds, not just what a skill can do with your permissions: `.env.local`
  `${VAR}` refs for the MVP (what ships), an Infisical Agent Proxy broker
  once an agent handles real production credentials, with the MITM tradeoff
  stated plainly.

### Fixed

- **Worktree teardown and Next.js builds now survive the two shared-store stall
  classes seen under a parallel-agent fleet (#55).** Every `wt0 --version`
  probe is bounded and removal keeps its direct `lsof` proof fail-closed,
  while all three web apps widen Turbopack's root to include Bun's global
  store instead of rejecting its dependency symlinks.
- **Release artifacts no longer fail source formatting (#39).** The
  release-proof workflow downloaded a generated deployment receipt into
  `.release-plan` and then ran repository formatting over the whole working
  directory, failing a source-code gate on a generated artifact after the
  main commit had already passed. Formatting now runs only over Git-tracked
  source files.
- **Unblocked the oxfmt gate on vendored `ai-seo` content (#24).** An oxfmt
  0.58.0 bump started formatting markdown more strictly and flagged 8
  committed files inside the vendored `agents/skills/ai-seo/` skill, turning
  every open PR red via inheritance from `main`. A `.prettierignore` keeps
  vendored third-party content pristine instead of reformatted.
- **`osv-scanner` runs via direct CLI instead of the SARIF-uploading reusable
  workflow (#20).** The SARIF path requires paid GitHub Advanced Security and
  hard-failed even on a clean scan (seen live on a dependabot PR); the direct
  CLI is an identical gate with no license requirement.
- **Killed social popup sign-in latency and a silent stuck opener (#18).**
  `/auth/popup-complete` broadcast `done` from a React `useEffect`, so the
  popup had to download and hydrate the whole Next.js runtime before the
  opener heard anything — several seconds of visible latency after OAuth
  consent, plus a failure mode where the opener never updated at all.
- **Removed the minutes-long pre-push typecheck hook — CI already owns it
  (#16).** `bunx nx affected -t typecheck` in the pre-push hook deadlocked
  the Nx daemon for 10+ minutes on worktree pushes and took 5+ minutes cold
  even daemonless; a gate that slow just trains people to `--no-verify`,
  which is worse than no gate. Coverage is unchanged — CI already runs
  `nx affected -t lint typecheck test build` on every push/PR.

### Security

- **Cleared the OSV vulnerability-scan backlog: 30 advisories → 0 (#32).**
  `main`'s `vuln-scan` gate was red on a 13-package/30-advisory transitive
  backlog (14 High, including `axios` GHSA-gcfj-64vw-6mp9, CVSS 8.3), reached
  only through build-time/dev tooling and never in a deployed Worker or
  client bundle. Forced patched versions via `overrides`
  (`axios`, `body-parser`, `brace-expansion`, `dompurify`, `fast-uri`,
  `postcss`, `sharp`, `svgo`) and a root `next ^16.2.11` devDependency to
  hoist a patched copy for the dev tooling that pulls it, while deployed apps
  keep their exact `16.3.0-preview.9` pin. Verified: `osv-scanner:v2.2.4 scan
-r ./` → "No issues found", down from 30.
- **Payment service fails closed instead of open in production; removed
  auth/db/AI stubs (#23).** `resolveProvider()` returned `MockProvider` —
  whose `verifyWebhook()` performs no signature check — whenever no payment
  key and no `PAYMENT_PROVIDER` selector were set, colliding with the repo's
  env-gated-silently convention in exactly the place a webhook forgery
  matters most.
- **Second round of review hardening: root `.gitignore`, checkout rate
  limiting, email verification, infra (#25, stacked on #23).** The repo had
  no root `.gitignore`, so `.env.local` was not actually ignored despite
  `CLAUDE.md` and `scripts/link-env.sh` claiming it was — a routine
  `git add -A` after `cp .env.example .env.local` could have committed real
  secrets.

### Known issues

- **Turbopack + Bun's isolated global store breaks `next build`/`next dev`:**
  `Symlink [...] points out of the filesystem root`. Reproduces on `main`,
  including in CI, in a single plain worktree — not a wt0 or Portless bug.
  Bun's isolated-linker global store (`bunfig.toml`: `linker = "isolated"`,
  `globalStore = true` — the setup `wt0 doctor` itself recommends) resolves
  `node_modules` symlinks to targets outside any per-repo directory
  (`~/.bun/install/cache/links/...`); Turbopack's resolver refuses to follow
  a symlink landing outside its configured project root, by design. Pinning
  `turbopack.root` (per `vercel/next.js#94432`) does not fix this distinct
  resolver-boundary check. Workaround: build/run with `--webpack`.
- **`.wt0/hooks/pre-remove` can stall for minutes on a loaded laptop
  (#53).** Two independent causes: a fresh, unsigned/ad-hoc-signed `wt0`
  binary can hang 6+ minutes on first launch (macOS's first-launch
  assessment of a new executable), and `has_live_cwd`'s `lsof -n -d cwd`
  sweep over every process on the machine can itself take minutes under
  load. Workaround: `WORKTREE_ZERO_BIN=/usr/local/bin/wt0 wt0 remove <path>`
  (still slow because of the second cause).
