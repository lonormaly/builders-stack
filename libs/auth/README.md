# @stack/auth

[Better Auth](https://better-auth.com) wired to the `@stack/db` Drizzle client
(Postgres). Email + password and GitHub OAuth are enabled. One public door:
`src/index.ts` exports `auth`, `getSession`, and the inferred `Session` / `User`
types.

```ts
import { auth, getSession, type Session, type User } from "@stack/auth";

// Mount the handler (e.g. Hono / Next.js route):
//   auth.handler(request)

// Server-side session lookup:
const data = await getSession(request.headers); // -> { session, user } | null
```

## Required env vars

Importing this package never throws when these are missing (every read falls
back to `""`) — but the values are **required at runtime** for auth to work.

| Var                                         | Purpose                                                    |
| ------------------------------------------- | ---------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                        | Signing secret. Generate with `openssl rand -base64 32`.   |
| `BETTER_AUTH_URL`                           | Public base URL of the app (e.g. `http://localhost:3001`). |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth app credentials.                              |
| `DATABASE_URL`                              | Postgres connection — read by `@stack/db`, not here.       |

## Generating the auth schema

Better Auth owns its tables (`user`, `session`, `account`, `verification`).
Rather than hand-writing them into `@stack/db`, generate them from this config:

```bash
bun run auth:generate
```

This runs `@better-auth/cli generate` against `src/auth.ts` and writes the
Drizzle schema to `../db/src/auth-schema.ts`. Re-export it from `@stack/db`'s
`src/index.ts` and run your usual `db:push` / migration to create the tables.
Until the tables exist, `auth` still imports and typechecks — it only needs them
when a request hits the handler.
