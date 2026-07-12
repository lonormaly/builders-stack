# @stack/db

Postgres access for the stack, via [Drizzle ORM](https://orm.drizzle.team) over the
[postgres.js](https://github.com/porsager/postgres) driver. One relation to show the
shape: `users` 1‑→‑N `posts`.

Everything is imported through the single door `src/index.ts`:

```ts
import { db, users, posts } from "@stack/db";

const authors = await db.query.users.findMany({ with: { posts: true } });
```

## Env

Reads `DATABASE_URL` from the environment (throws a clear error if missing):

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/builders_stack
```

## Scripts

| Command             | What it does                                                                      |
| ------------------- | --------------------------------------------------------------------------------- |
| `bun run generate`  | Diff the schema and write a SQL migration into `./migrations`.                    |
| `bun run push`      | Apply the current schema straight to the DB (fast local dev, no migration files). |
| `bun run migrate`   | Apply the SQL files in `./migrations` programmatically (deploys).                 |
| `bun run seed`      | Insert a couple of users + posts (needs a live DB — run `push`/`migrate` first).  |
| `bun run typecheck` | `tsc --noEmit`.                                                                   |

Typical local flow: `push` → `seed`. Versioned flow: `generate` → `migrate` → `seed`.

## Performance, indexing & the free tier — use the `dba` agent

Schema design and DB performance have a dedicated **`dba` subagent** ([`agents/subagents.md`](../../agents/subagents.md)) and three skills. Spawn/read them when you touch the DB — the rules below are the short version.

| Skill                                                               | Use it to                                                        |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [`design-a-schema`](../../agents/skills/design-a-schema/SKILL.md)   | model a table — normalize, constrain, and **index deliberately** |
| [`optimize-a-query`](../../agents/skills/optimize-a-query/SKILL.md) | read an `EXPLAIN` plan, kill an ORM N+1, add the right index     |
| [`run-lean-on-neon`](../../agents/skills/run-lean-on-neon/SKILL.md) | stay fast under load and inside Neon's free tier                 |

**The rules that matter most:**

- **Drizzle is the only migration path.** Edit `src/schema.ts` → `bun run generate` → **review the SQL** → never hand-write it. Flag any `DROP`/rename.
- **Index every foreign key you query on** — Postgres does _not_ auto-index FKs, and a missing one is the classic "fine in dev, dies under load" bug. But don't over-index: each index costs writes + storage against Neon's 0.5 GB cap.
- **Under load, use Neon's pooled (`-pooler`) connection string** for the app; the direct one only for migrations. Connection storms — not WAL tuning — are what crash serverless Postgres.
- **Don't reach for `postgresql.conf` / PgTune** — Neon manages it; that advice is for self-hosted Postgres. What you _can_ tune is session GUCs (`work_mem`, `statement_timeout`) — see `run-lean-on-neon`.
- **Session cookie-cache is ON by default** in [`libs/auth`](../auth) so auth doesn't hit this DB on every request — the biggest Neon-compute saver. And **never poll/keepalive the DB** ("push, don't poll") so idle compute scales to zero.
