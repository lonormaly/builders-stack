# `ops/runbooks/` — the 3am docs

Short, do-this-now procedures for when something is on fire or has to change under pressure. Each
is a numbered checklist you can follow half-awake, grounded in how _this_ stack actually works.

| Runbook                                | When                                                    |
| -------------------------------------- | ------------------------------------------------------- |
| [`rotate-a-key.md`](./rotate-a-key.md) | a credential leaked, expired, or is being cycled        |
| [`rollback.md`](./rollback.md)         | a deploy went bad — get back to the last good image     |
| [`restore-db.md`](./restore-db.md)     | data loss / corruption — restore Postgres from a backup |

Keep these current: when a procedure changes, the runbook is part of the change.
