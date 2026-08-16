# CI performance — what this repo ships, and what it bought

CI in this template is built around one claim: **the runner is the last resort for
computation.** Almost every run should replay answers something else already
computed. When it cannot, the expensive work happens on a machine where nobody is
waiting.

Everything here works on GitHub-hosted runners the moment you clone. The warm
self-hosted path is one repository variable away and is where the big numbers
come from — see [`github-runners.md`](./github-runners.md).

## The numbers this pattern produced

Measured on the production monorepo this pattern was extracted from (35 projects,
~70 lint + typecheck tasks), end to end — PR event to job completion, queue wait
included. Your repo is not that repo; these are evidence that the shape works, not
a promise about your first commit.

| Case                   | What changed                        | Total         | Conditions                                                   |
| ---------------------- | ----------------------------------- | ------------- | ------------------------------------------------------------ |
| Best                   | docs-only file                      | **7s**        | idle warm runner, no lockfile change                         |
| Replay floor           | rerun of a checked commit           | **17s**       | 6/6 Nx cache hits, 81ms of task time                         |
| Average                | one API source file                 | **46s**       | that service's typecheck + tests genuinely execute           |
| After a lockfile merge | first run after `bun.lock` moved    | **67s**       | one-time 56.9s install from the warm package cache           |
| Worst, seeded          | a root graph input — every hash new | **~30s**      | 67 tasks replayed from the seeded cache; all tests still ran |
| Worst, unseeded        | same, nobody pre-computed           | **10–14min**  | the safety net behind `timeout-minutes: 15`, not the plan    |
| Back-to-back pushes    | second push within ~2 min           | +2–4min queue | one runner pod, by design — a known, accepted limit          |

Baseline before any of it: a **5m52s** required check, of which dependency install
2m20s, PostgreSQL 28s, checkout 20s, OSV 15s, lint 25s — and about **9 seconds** of
actual affected-graph work. Almost all of a normal CI run is setup.

Images, over the same period: the API image went **3.21 GB → 226 MB** (93%), built in
11.1s. The seeded answers for a whole 70-task graph weigh **1.1 MB** — fourteen minutes
of compute is one megabyte of tar.

## The pieces, and what each one is for

| File                                                                                 | Does                                                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)                         | the commit gate. Warm checkout, fingerprinted install, `ops/ci/fast.ts`        |
| [`.github/workflows/release-proof.yml`](../../.github/workflows/release-proof.yml)   | the release rehearsal: Postgres, scans, full builds — clean runner, after main |
| [`ops/ci/fast.ts`](../../ops/ci/fast.ts)                                             | the planner: which gates this diff can possibly break                          |
| [`ops/ci/fast.test.ts`](../../ops/ci/fast.test.ts)                                   | the speed contract — every guard below, pinned                                 |
| [`ops/ci/nx-cache.ts`](../../ops/ci/nx-cache.ts)                                     | Nx 23's built-in HTTP remote cache, served off a plain directory               |
| [`ops/ci/seed-cache.ts`](../../ops/ci/seed-cache.ts)                                 | dev machines compute the expensive graph; the runner replays it                |
| [`.nxignore`](../../.nxignore)                                                       | the one exclusion that makes a laptop's answers usable on Linux                |
| [`ops/deploy/deployables.json`](../../ops/deploy/deployables.json)                   | every app and service is deployed one declared way, or explicitly not          |
| [`ops/deploy/build-images.sh`](../../ops/deploy/build-images.sh)                     | bundle with Bun first, hand Docker one file, gate at 300 MB                    |
| [`ops/deploy/install-arc.sh`](../../ops/deploy/install-arc.sh)                       | the warm self-hosted runner pool                                               |
| [`.github/workflows/ci-queue-alarm.yml`](../../.github/workflows/ci-queue-alarm.yml) | tells you the pool died, because nothing else will                             |

### 1. One warm runner (the largest single win)

A persistent checkout, `node_modules`, Bun package cache and Nx cache that survive
the pod. The install is skipped on a **fingerprint** of `bun.lock` + `bunfig.toml` +
the Bun version — never on `node_modules` merely existing. This alone removed the
2m20s install and ~40s of setup from nearly every run, and every other win here is
built on top of it.

### 2. Splitting commit feedback from release proof

Postgres, migrations, gitleaks, OSV, full builds and deployment acceptance moved
out of the commit gate into `release-proof.yml`, which starts clean on a hosted
runner after a green push to main. That removed ~1.5 minutes from every commit
**without deleting any proof** — it runs at the release boundary instead.

### 3. `nx affected` + the change-class planner

`ops/ci/fast.ts` reads the diff and plans. A docs-only change builds no graph and
runs no gate. A change inside one service runs that service's graph and no
whole-repo gate whose inputs did not move. A root graph input (`bun.lock`,
`tsconfig.base.json`, `nx.json`, …) runs everything, because it genuinely
invalidated everything.

### 4. The seeded remote cache — dev machines compute, the runner replays

The root-input case is the whole tail of the distribution: it moves every task
hash in the workspace and measured 10–14 minutes on a small runner. `bun run
ci:seed` computes those answers on your laptop and ships them to the runner's
disk, which brought that case to ~30 seconds. Mechanism: Nx 23's built-in HTTP
remote cache served by a 60-line Bun file over a directory — no bucket, no
credential, no new dependency. (All four Nx self-hosted cache plugins are
Commercial-licensed and cap at `nx < 23`.) Runbook:
[`github-runners.md`](./github-runners.md#seeding-the-nx-cache).

### 5. The reliability set

Saved zero seconds on a good day, and ten hours on a bad one — which is why it
outranks everything below it. Runner memory above the value that OOMKilled it
(GitHub reports an OOMKill as "runner lost communication"); a 15-minute ceiling
that bounds a hung job without racing a legitimate rebuild; a 120-second bound on
the warm-up wait (an unbounded loop once turned one killed install into a silent
whole-repo outage); a self-healing install that wipes and retries once on Bun's
`copyfile ENOENT` corrupt-tree failure; node linked out of the runner image's own
externals so eslint can run at all.

### 6. The queue alarm

A dead self-hosted runner fails **silently**: jobs queue, nothing goes red, and
GitHub cancels them 24 hours later. The watchdog runs on GitHub-hosted runners —
never on the pool it watches — and posts when a run has been queued too long.
Detection time went from ten hours to ten minutes.

### 7. Bundle before Docker

`bun build --target=bun` resolves the import graph into one file, so the runtime
image needs no `node_modules` at all. Docker receives the bundle and one shared
Dockerfile instead of the monorepo; `check:image-size` fails the build over 300 MB.
This is deploy latency and rollback speed rather than commit latency — a bad deploy
becomes replaceable in seconds.

### 8. The deployables registry

`ops/deploy/deployables.json` names every shippable unit or declares it
not-deployed with a reason; `check:deployables` fails CI when a new app or service
skips it. It prevents regressions of everything above rather than adding speed
itself.

## The operating rules that keep it true

These are the product as much as the files are.

- **The runner is the last resort for computation.** Ordinary runs replay from
  cache; heavy recomputes are seeded from dev machines. If the runner is doing real
  work on a normal commit, something is wrong.
- **Caches are never proof.** Tests execute on the runner's own platform. Answers
  seeded from a laptop are accepted only for lint and typecheck, which are
  properties of the source and do not vary by platform. Release proof starts clean
  and remains the final authority.
- **Limits are sized to what has actually been measured to fail, not to the happy
  path.** A memory limit that fits the warm incremental gate will OOMKill the first
  full-graph run. Re-measure when you change `--parallel` or the heap.
- **Every guard must be seen red before it is trusted.** The queue alarm, the
  format gate and the speed-contract pins were each deliberately broken or tripped
  once. A guard that has only ever passed proves nothing.
- **The stateful runner is serialized and protected.** One job at a time, source
  reset every run, secrets job-scoped, release proof on a separate clean runner
  that cannot touch the warm workspace.
- **A gate that nobody listed never runs.** Add a `check:*` script and it must get
  an entry in `fast.ts`'s `gateInputs` and a test in `fast.test.ts`, or it silently
  stops guarding the change that breaks it.

## Deliberately not done

- No webpack caching (Next 16 uses Turbopack — the wrong build system to optimize).
- No `--production` installs in CI: tests and typechecking need dev packages.
  Production-only belongs in the runtime image.
- No trusting `node_modules` by existence — only by the dependency fingerprint.
- No deleting database, security, migration or release tests. They moved to
  `release-proof.yml`; they did not die.
- No concurrent jobs mutating the shared persistent checkout.
- No second runner pod. The known cost is the 2–4 minute gap on back-to-back
  pushes, accepted until it hurts.
- **No single-app fast path.** Apps are terminal (nothing imports them), so a
  change confined to one app could skip the graph entirely. It is a few seconds on
  an already-fast case and needs per-repo knowledge of which targets each app has —
  add it when the graph compute is the thing you are waiting on, not before.

## Fill these in

Nothing below is required to have a working CI. Each one turns on a piece of the
above.

| Where                         | What                                  | Turns on                                                   |
| ----------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| repo variable                 | `FAST_RUNNER_LABEL`                   | the warm runner pool, the cache mount, and the queue alarm |
| repo secret                   | `ALERT_WEBHOOK_URL`                   | the queue alarm actually reaching a human                  |
| `install-arc.sh`              | `GITHUB_REPO_URL` env                 | which repository the runner pool serves                    |
| `actions-runner*.yaml`        | the `stack-` names, `stack.io/` label | your own namespace and node label                          |
| `seed-cache.ts`               | `STACK_SEED_SSH` or the kube context  | where seeded answers are shipped                           |
| `ops/deploy/deployables.json` | one entry per app and service         | affected-only deploys and the image size gate              |
