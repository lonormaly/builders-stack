# `ops/deploy/` — ship built images to an environment

The front door for deploying the stack. Both scripts are thin wrappers over the repo's existing
deploy path (`scripts/deploy.sh` + `infra/*.Dockerfile` + `infra/k8s/`) so there's **one source
of truth** for the build → push → migrate → roll-out sequence.

| Script           | Target                                                        |
| ---------------- | ------------------------------------------------------------- |
| `deploy-dev.sh`  | the **dev / pre-prod** tier (the shared non-prod environment) |
| `deploy-prod.sh` | **production** — asks for a typed confirmation first          |

```bash
ops/deploy/deploy-dev.sh
ops/deploy/deploy-prod.sh      # prompts before it ships
```

`scripts/deploy.sh` is a dry-run scaffold today (it echoes the real registry/cluster commands) —
wire in your registry + cluster there and both wrappers ship for real. See
[`docs/deploy.md`](../../docs/deploy.md). `scripts/deploy.sh` itself will consolidate into this
folder in a follow-up (see [`../README.md`](../README.md)).
