# Runbook — restore the database

Postgres data was lost or corrupted (bad migration, accidental delete, disk failure). Restore
from a backup. The stack uses **Postgres** via Drizzle (`libs/db`); `DATABASE_URL` is the
connection string for the target environment.

> **Backups are a precondition, not a step.** This runbook assumes you have backups. If you're on
> managed Postgres (Neon, Supabase, RDS), point-in-time recovery is a console/CLI action — use it.
> If you self-host, you need a scheduled `pg_dump` (or WAL archiving) _before_ you need this page.

## 1. Stop writes

Prevent the corruption from spreading and avoid restoring into a moving target.

```bash
kubectl --context prod scale deployment/stack-api --replicas=0
kubectl --context prod scale deployment/stack-ai-worker --replicas=0
```

(Locally: `./tilt_down.sh`.)

## 2. Restore

**Managed Postgres (preferred):** use the provider's **point-in-time restore** to a timestamp
just before the incident. This usually creates a new branch/instance — capture its connection
string.

**From a `pg_dump` you hold:**

```bash
# Into a FRESH database first — never restore straight over the live one until verified.
createdb builders_stack_restore
pg_restore --clean --no-owner --dbname="$RESTORE_URL" backup.dump
# or, for a plain SQL dump:
psql "$RESTORE_URL" < backup.sql
```

## 3. Reconcile the schema

The restored data must match the code's expected schema.

```bash
DATABASE_URL="$RESTORE_URL" ops/db/migrate.sh    # apply any migrations newer than the backup
```

If the backup is _ahead_ of the code (you rolled code back too), align versions first — see
[`rollback.md`](./rollback.md).

## 4. Cut over & verify

1. Point the environment at the restored DB: update `DATABASE_URL` in **Infisical** (or the
   `stack-secrets` k8s Secret) — see [`rotate-a-key.md`](./rotate-a-key.md) for the update+restart
   pattern.
2. Scale services back up:

   ```bash
   kubectl --context prod scale deployment/stack-api --replicas=2
   kubectl --context prod scale deployment/stack-ai-worker --replicas=1
   ```

3. Verify: `/health` green, a real read _and_ write succeed, row counts sane, error rate normal
   in PostHog.

## 5. Follow-up

- Confirm the **backup schedule** actually runs (this incident is the audit).
- If a migration caused it, make migrations additive/reversible (see `rollback.md` §3).
