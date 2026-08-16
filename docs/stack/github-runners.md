# Self-hosted GitHub Actions runners

The optional half of [`ci-performance.md`](./ci-performance.md). CI runs on
GitHub-hosted runners with no setup at all; this page is how you give it a **warm**
runner instead, and what that buys.

## Why you would

**Money.** A GitHub org with the default 2,000 included Actions minutes and
stop-usage enabled kills EVERY workflow in 3–4 seconds once the meter runs out —
including the one that runs your database migrations. Jobs on self-hosted runners
never touch that meter.

**Speed.** A runner that keeps its checkout, `node_modules`, Bun package cache and
Nx cache between jobs turns a five-minute cold gate into seconds. Almost all of a
cold CI run is setup, not checking.

**What it does not fix**, stated plainly:

- A GitHub-side outage still stops everything — self-hosted runners still need
  GitHub's control plane to hand them jobs.
- **GitHub never fails a job over from self-hosted to hosted.** A job sent to a
  label with no online runner queues for 24 hours and is then cancelled, and
  `timeout-minutes` cannot catch it — that timer only counts while a job is
  executing. Here the escape hatch is manual and instant: `ci.yml` reads
  `runs-on: ${{ vars.FAST_RUNNER_LABEL || 'ubuntu-latest' }}`, so deleting the
  variable sends the next run to hosted.
- Nothing tells you the pool died. That is what
  [`ci-queue-alarm.yml`](../../.github/workflows/ci-queue-alarm.yml) is for.

## Architecture

Modern **Actions Runner Controller** (`gha-runner-scale-set`), not the archived
`RunnerDeployment`/summerwind CRDs. Two Helm releases:

1. **The controller** — one per cluster, watches for scale-set custom resources.
2. **The scale set** — one per runner pool. These are the actual runner pods.

Files:

- [`ops/deploy/k8s/actions-runner.yaml`](../../ops/deploy/k8s/actions-runner.yaml) —
  namespace, resource quota, network policy, service account, and the Secret a
  human creates by hand.
- [`ops/deploy/k8s/actions-runner-values.yaml`](../../ops/deploy/k8s/actions-runner-values.yaml) —
  the pod spec: pinned images, warm caches, the bounded warm-up.
- [`ops/deploy/install-arc.sh`](../../ops/deploy/install-arc.sh) — the two
  `helm upgrade --install` calls, idempotent.

Scope it to **one repository**, not the org, unless you mean it: an org-scoped
runner group lets a job from any repo — reviewed or not — schedule a pod on your
cluster.

## Install (a human runs this once)

```bash
# 1. Label the node that will own the caches. EXACTLY one — the checkout and every
#    cache are node-local hostPath data, and a pod on a second node silently starts cold.
kubectl label node <node> stack.io/ci-cache=true

# 2. Register a GitHub App (or a fine-grained PAT) and create the secret it needs —
#    exact scopes are at the bottom of ops/deploy/k8s/actions-runner.yaml.
kubectl create namespace stack-actions-runners
kubectl -n stack-actions-runners create secret generic stack-runner-github-app \
  --from-literal=github_app_id="<app id>" \
  --from-literal=github_app_installation_id="<installation id>" \
  --from-file=github_app_private_key=/path/to/key.pem

# 3. Install.
GITHUB_REPO_URL=https://github.com/OWNER/REPO ops/deploy/install-arc.sh

# 4. Point CI at it. This one variable is the whole switch.
gh variable set FAST_RUNNER_LABEL --body 'stack-cluster'
```

Turning it off during an incident is `gh variable delete FAST_RUNNER_LABEL`.

### The `runs-on` label is the scale set NAME — nothing else

A `gha-runner-scale-set` has **no custom labels**, and `self-hosted` is not one of
them. [GitHub's own docs](https://docs.github.com/en/actions/tutorials/actions-runner-controller/deploying-runner-scale-sets-with-actions-runner-controller):
"You can use the installation name as the value of `runs-on`." So
`runs-on: ["self-hosted","stack-cluster"]` matches **no runner** and queues for 24
hours. `install-arc.sh` makes the Helm release name, the scale set name and the
label one string so there is one thing to keep in step.

### `minRunners: 1`, not 0

At zero, the first job of the day waits for a pod to be created, scheduled and
registered — the exact cold start this exists to remove. One idle runner is a
quarter CPU and half a gigabyte, and it also means a health check can see the pool.

## The traps that cost real hours

Each of these produced an outage or a silent slowdown upstream. They are pinned in
`ops/ci/fast.test.ts` so they cannot quietly come back.

**The whole pod spec has to be in the values file.** `containerMode: dind` does not
merge with a partial `template.spec` — supply `containers` and yours replaces the
chart's outright, image and init containers included.

**A quota that names a resource makes it mandatory everywhere.** Every container in
the namespace, init containers included, must declare requests and limits, or the
pod is refused with a message about the quota rather than about the missing field.

**Size the memory limit to what failed, not to what fit.** 3Gi fits the warm
incremental gate and then OOMKills the first full-graph run — and GitHub reports an
OOMKill as **"runner lost communication"**, so it does not look like memory at all.
It wedged the queue repeatedly before anyone read it correctly.

**hostPath directories are created `root:root`; the runner is uid 1001.** Without
the `init-runner-caches` init container every documented cache is silently
read-only and each pod starts cold. Nothing errors.

**Bound the warm-up wait.** An unbounded `until` here once looped forever on a
dangling `node_modules/.bin/nx`: the runner never registered, every job queued, and
no job could ever run the install that would repair it — a silent, total, ten-hour
outage. On timeout, register anyway and let the job repair the checkout. A cold
slow job beats a dead queue.

**`grep -v alpine` when linking node.** eslint launches through
`#!/usr/bin/env node`. The runner image ships node under `externals`, including an
alpine build that cannot run on the glibc image. Pick the wrong one and every
boundary check fails with `/usr/bin/env: 'node': No such file or directory`.

**A half-written `node_modules` is permanent damage.** A killed install breaks Bun's
linker with `failed to link package (copyfile) ENOENT` on every LATER install, and
clearing the package cache does not repair it. The commit gate wipes and retries
once.

**Watch out for a linker alias shadowing TypeScript.** This repo uses Bun's isolated
linker (`bunfig.toml`), whose hidden hoist layer at `node_modules/.bun/node_modules`
can pick up a root `package.json` alias under its _real_ name. Upstream, a
`"typescript-7": "npm:typescript@7.0.2"` alias got hoisted as `typescript`, Nx loaded
it, and died with `tsModule.readConfigFile is not a function` — a **total** loss of
the project graph: no affected, no lint, no typecheck, no tests. `check:worktrees`
here refuses a `typescript-7` alias for exactly this reason, and
`scripts/typecheck-native.sh` reaches TypeScript 7 through `bunx --package` instead.

## Seeding the Nx cache

The runner holds its budget on an ordinary change because `nx affected` only
touches what moved. A **root-input change** is different: `bun.lock`, `bunfig.toml`,
the root `package.json`, `tsconfig.base.json`, `nx.json` and `eslint.config.mjs` are
`sharedGlobals`, so changing one moves every task hash in the workspace and the
runner has to lint and typecheck all of it. Upstream that measured 10–14 minutes.

So compute it where nobody is waiting:

```bash
bun run ci:seed                       # seed origin/main
bun run ci:seed <ref>                 # seed any ref — do this BEFORE opening the PR
bun run ci:seed <ref> --dry-run       # compute and report, upload nothing
```

It checks the commit out clean (a detached worktree, kept warm between runs),
installs the way CI does, runs `nx run-many -t lint,typecheck --all` against a local
instance of the cache server, and ships the answers to the runner node over ssh.
`ops/ci/fast.ts` then serves that directory to Nx on loopback for the duration of
the job. Seed **before** you open the PR: CI checks out the merge ref, whose tree
equals your branch's when main has not moved, so the answers already fit.

Set `STACK_SEED_SSH=user@host` to skip the Kubernetes lookup entirely — a plain VM
runner works the same way.

### The rules it keeps

- **Tests are never seeded.** A type error and a lint violation are properties of
  the source and do not vary by platform. A passing test does. Your machine is
  probably macOS/arm64 and the runner is Linux/x64, so tests keep executing on the
  runner every time. The runner still stores its own test results — those were
  computed on Linux and are valid there.
- **A red graph is never uploaded.** Nx caches failures as readily as successes (the
  artifact carries the exit code), so a flaky local failure that reached the shared
  directory would be replayed as a red CI run on every machine until someone
  deleted it by hand. Answers are staged locally and only leave if the run was green.
- **Each seed recomputes.** Nx only stores to the remote after it has actually run a
  task; a local hit returns before the remote is consulted. Seeding against a warm
  cache would upload nothing and report success, so the seed gives Nx an empty cache
  directory and makes it do the work.

### Why the mechanism is a directory and 60 lines of our own

Nx 23 has exactly one free way to move cache entries between machines: its built-in
HTTP remote cache, switched on by `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`. The four
plugins that would otherwise do this — `@nx/s3-cache`, `@nx/shared-fs-cache`,
`@nx/gcs-cache`, `@nx/azure-cache` — are all published `license: "Commercial"`, all
depend on `@nx/key`, and all declare `peerDependencies.nx: ">= 18 < 23"` with no
23.x release. `nx.json`'s old `useLegacyCache` escape hatch was deleted in Nx 21.

So the endpoint is ours: [`ops/ci/nx-cache.ts`](../../ops/ci/nx-cache.ts), a
directory served on loopback. No bucket, no deploy, no public hostname, no stored
credential, no new dependency. Two routes:

| request                | answer                                                         |
| ---------------------- | -------------------------------------------------------------- |
| `GET /v1/cache/<hash>` | `200` + `application/octet-stream` for a hit, `404` for a miss |
| `PUT /v1/cache/<hash>` | **exactly `200`**                                              |

**`201`, `202` and `204` are all treated as a failed store.** Nx retries the PUT six
times and then reports _the task itself_ as failed, with empty error output, while
the artifact it stored carries exit code 0. A seeding run against a server answering
`202` looks exactly like a workspace full of broken targets. `fast.test.ts` pins the 200.

### Cross-platform hashes, and the one repo-level fix

Nx hashes inputs, not the operating system, so a macOS answer is usable on Linux —
after [`.nxignore`](../../.nxignore). Nx's file walker honours the developer's
**global** gitignore; a global ignore that lists `.gitignore` itself means Nx cannot
see the repo's `.gitignore` on that laptop while the runner folds it into every task
hash. Dumping the full hash plan on both machines showed they agreed on all 28,531
other inputs and differed only on that one — and one phantom input changes every
hash. Declaring it in `sharedGlobals` does **not** fix it, because a machine that
cannot see a file resolves the entry to nothing.

Expect a couple of projects to never share: anything resolving genuinely different
dependency trees per platform (playwright builds, `fsevents`) simply recomputes on
the runner.

### Checking what it did

```bash
ssh <cache node> 'ls /var/lib/stack-ci-cache/nx-remote | wc -l'   # what is seeded
bun ops/ci/nx-cache.ts /ci-cache/nx-remote -- bunx nx run @stack/api:typecheck
```

A replayed task reports `Cache: 1/1 hit (100%)` and a duration in milliseconds.
Entries older than 14 days are pruned by the next seed; deleting the directory is
always safe.

## When the pool is down

1. `gh variable delete FAST_RUNNER_LABEL` — the next run goes to `ubuntu-latest`.
   Do this first; everything else can wait.
2. Check the controller and listener pods:
   ```bash
   kubectl -n arc-systems get pods
   kubectl -n stack-actions-runners get pods
   kubectl -n stack-actions-runners logs -l app.kubernetes.io/component=runner-scale-set-listener
   ```
3. Common causes: the GitHub App secret expired or was rotated without updating the
   cluster; a node rebooted and the pod has not rescheduled; the ResourceQuota is
   maxed out (`kubectl -n stack-actions-runners describe resourcequota`).
4. Once fixed, set the variable again.

## Security posture

- **No Kubernetes credential in the runner.** The ServiceAccount has zero RBAC and
  `automountServiceAccountToken: false`, so a compromised build gets an empty API
  client rather than a scoped one. Workflows that deploy reach _out_ with their own
  job-scoped credential.
- **The NetworkPolicy is declared, not enforced** on k3s's default flannel CNI. It
  applies cleanly and changes nothing until a policy-capable CNI is installed. Say
  that out loud rather than counting it as a control.
- **Fork PRs execute code on your cluster** if your repository is public and
  `pull_request` triggers the job. Gate that before you make the repo public.
- **Rotate the app key** by replacing the secret and restarting the listener
  deployment; revoke the old key only after the restart succeeds.
