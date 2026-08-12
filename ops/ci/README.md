# `ops/ci/` — run CI locally

`local-ci.sh` runs the required affected-code gates before you push.

```bash
ops/ci/local-ci.sh                 # affected vs origin/main
BASE=origin/develop ops/ci/local-ci.sh   # diff against a different base
```

`bun.lock` is the dependency cache authority. Install is skipped only when
`node_modules/.stack-lock` is byte-identical to the current lockfile.

The fast workflow runs changed-file format and lint checks, Nx affected
lint/typecheck/test, SEO, and the deployment registry in parallel. Set the
repository variable `FAST_RUNNER_LABEL` to a dedicated persistent runner label
to keep dependencies and caches warm. GitHub-hosted runners use portable caches.

`release-proof.yml` runs the slower clean-room checks after a green push to
main: PostgreSQL 18, dependency and secret scans, full lint/format, and affected
production builds. It consumes the exact deployment plan created by fast CI.

Every app and service must appear in `ops/deploy/deployables.json`. Production
Bun services are bundled before Docker. The image builder runs the hard 300 MB
gate before it may push an image.
