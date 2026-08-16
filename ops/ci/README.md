# `ops/ci/` — run CI locally

`local-ci.sh` runs the required affected-code gates before you push.

```bash
ops/ci/local-ci.sh                 # affected vs origin/main
BASE=origin/develop ops/ci/local-ci.sh   # diff against a different base
```

`bun.lock` + `bunfig.toml` + the Bun version are the dependency authority. Install
is skipped only when `node_modules/.stack-install` matches that fingerprint —
never because `node_modules` happens to exist.

`fast.ts` is the planner. It reads the diff and runs only what that diff can
break: changed-file format and lint, boundary lint for workspace code, Nx
`affected -t typecheck,test`, and each whole-repository gate whose own inputs
moved. A docs-only change builds no graph and runs no gate. A root graph input
(`bun.lock`, `nx.json`, `tsconfig.base.json`, …) runs everything, because it
invalidated everything.

`fast.test.ts` is the contract: the gate list, the cache protocol, and every
runner property whose loss caused a real outage. **Add a `check:*` script and you
must add it to `gateInputs` in `fast.ts` and to that test** — a gate nobody listed
never runs on the change that breaks it.

`nx-cache.ts` + `seed-cache.ts` are the escape from the one slow case. A
root-input change invalidates every task hash in the workspace; `bun run ci:seed`
computes those answers on a dev machine and leaves them where the runner replays
them. Off entirely unless `STACK_CI_CACHE_ROOT` is set, so laptops and hosted
runners just use the local Nx cache.

Ephemeral GitHub runners install cold — restoring and saving a portable cache
takes longer than Bun's install. Set the repository variable `FAST_RUNNER_LABEL`
to a warm self-hosted pool (`ops/deploy/install-arc.sh`) to keep the checkout,
dependencies and caches between runs. Unset it and CI is back on `ubuntu-latest`
immediately.

Full record, numbers and operating rules: [`docs/stack/ci-performance.md`](../../docs/stack/ci-performance.md).
Runner setup and the seeding runbook: [`docs/stack/github-runners.md`](../../docs/stack/github-runners.md).

`release-proof.yml` runs the slower clean-room checks after a green push to
main: PostgreSQL 18, dependency and secret scans, full lint/format, and affected
production builds. It consumes the exact deployment plan created by fast CI.

Every app and service must appear in `ops/deploy/deployables.json`. Production
Bun services are bundled before Docker. The image builder runs the hard 300 MB
gate before it may push an image.
