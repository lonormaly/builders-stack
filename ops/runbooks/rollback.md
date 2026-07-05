# Runbook — roll back a bad deploy

A deploy shipped and something's wrong (errors spiking, health checks flapping, a broken flow).
Get back to the last good image, then diagnose off the hot path. Deploys are container images
tagged with the git short SHA (see `scripts/deploy.sh` / `ops/deploy/`).

## 1. Confirm it's the deploy

- Did the regression start at the rollout? Check error rate in **PostHog** (error tracking ships
  through `@stack/analytics`) and pod health:

  ```bash
  kubectl --context prod get pods -l app=stack-api
  kubectl --context prod logs deployment/stack-api --tail=100
  ```

- Readiness/liveness probes hit `/health` (`infra/k8s/deployment.yaml`). Crash-looping pods =
  the new image is bad.

## 2. Roll back the image

Every deploy is tagged with a git SHA, so rollback = point the deployment at the previous good
tag.

**Fastest — k8s remembers the last rollout:**

```bash
kubectl --context prod rollout undo deployment/stack-api
kubectl --context prod rollout status deployment/stack-api
```

**Explicit — pin a known-good SHA:**

```bash
kubectl --context prod set image deployment/stack-api api=ghcr.io/OWNER/stack-api:<good-sha>
kubectl --context prod rollout status deployment/stack-api
```

Repeat per service (`stack-api`, `stack-ai-worker`, `stack-payment`) if more than one shipped.

## 3. Mind the database

Code rolls back instantly; **migrations do not.** If the bad deploy ran a migration:

- Prefer **forward-fixing** (a new migration) over reverting DDL — a down-migration on live data
  is its own incident.
- If the old image is incompatible with the new schema, you may need to restore the DB — see
  [`restore-db.md`](./restore-db.md). This is why migrations should be **additive/backward-
  compatible** (add columns nullable, backfill, then tighten in a later release).

## 4. After the fire

- Confirm `/health` green and error rate back to baseline in PostHog.
- Open a fix on a branch; re-deploy through `ops/deploy/` once CI is green
  (`ops/ci/local-ci.sh` first).
- Note what the pre-deploy checks missed so `local-ci.sh` / a test catches it next time.
