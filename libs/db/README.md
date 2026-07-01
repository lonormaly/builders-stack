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
