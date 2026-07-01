# AGENTS.md — the primer for coding agents

Cross-tool guide for any AI coding agent working in this repo (Claude Code, Cursor, Codex, Copilot, Windsurf, …).
Codex, Cursor, and Copilot read a repo-root `AGENTS.md` by convention — **this file is the source of truth.** Claude Code also reads [`CLAUDE.md`](./CLAUDE.md); Cursor reads [`.cursor/rules.md`](./.cursor/rules.md). Both are short mirrors that point back here.

Read this **before writing code**. It tells you where everything lives so you don't reinvent what already exists.

---

## 1. The mental model — three buckets

This is a **bun-workspace monorepo** wrapped by **Nx** (task graph + enforced boundaries + generators). Every package has a role defined by _one question: is it served, and to whom?_

| Folder      | Role                                | Served?                          | Examples                                                                                                                      |
| ----------- | ----------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/`     | what **humans** see                 | public UI                        | `@stack/web` (Next.js), `@stack/landing` (marketing), `@stack/mobile` (Expo/React Native)                                     |
| `services/` | what has a **URL** / its own deploy | served to other code             | `@stack/api` (Hono + OpenAPI), `@stack/payment` (Creem adapter), `@stack/ai-worker` (background, no URL)                      |
| `libs/`     | **shared** code                     | **never served** — consumed only | `@stack/ui`, `@stack/auth`, `@stack/db`, `@stack/ai`, `@stack/analytics`, `@stack/email`, `@stack/config`, `@stack/api-types` |

If you're about to create a file, first decide which of these three it belongs to. If it doesn't obviously fit one, ask — don't invent a fourth top-level folder.

## 2. The map — all 14 packages

```
builders-stack/
├── apps/
│   ├── web/          @stack/web       Next.js App Router — renders @stack/ui, live Better Auth login
│   ├── landing/      @stack/landing   public marketing site (@stack/ui hero + shared <Analytics/>)
│   └── mobile/       @stack/mobile    real Expo / React Native starter rendering shared @stack/ui tokens
├── services/
│   ├── api/          @stack/api       Hono + OpenAPI (/health, /docs) — validates @stack/api-types, mounts Better Auth
│   ├── payment/      @stack/payment   Creem adapter + Mock provider + webhooks (/checkout)
│   └── ai-worker/    @stack/ai-worker background load, NO URL (queue worker)
├── libs/
│   ├── ui/           @stack/ui        shadcn components + tokens (web + RN) + Storybook
│   ├── auth/         @stack/auth      Better Auth config (boot-verified end to end)
│   ├── db/           @stack/db        Drizzle schema + client (the single ORM)
│   ├── ai/           @stack/ai        provider-agnostic model client (Vercel AI SDK)
│   ├── analytics/    @stack/analytics <Analytics/> provider + isomorphic typed event catalog (./events)
│   ├── email/        @stack/email     Resend + React Email: typed, previewable templates + sendEmail()
│   ├── config/       @stack/config    typed env: one Zod schema + cached getEnv()
│   └── api-types/    @stack/api-types the shared API contract (Zod schemas + inferred types)
├── infra/            Dockerfiles, docker-compose, k8s (your deploy config)
├── scripts/          deploy.sh, tunnel.sh, seed.sh, link-env.sh
├── api-collection/   Bruno API collection (version-controlled requests)
├── agents/           the deep dive: skills, subagents, mcp.json (this file links there)
├── docs/             getting-started · costs · ai · architecture · nx · portless · analytics · email · secrets
├── .devops/Tiltfile  the runtime manifest — what boots and how
├── nx.json           task graph + boundary tags
└── tsconfig.base.json  shared compiler options (never fork)
```

## 3. The laws — do not break these

These are load-bearing. Nx turns the two headline laws into **lint errors** (every project is tagged `type:app` / `type:service` / `type:lib`; `@nx/enforce-module-boundaries` rejects violations), so breaking them fails `bunx nx run-many -t lint`.

1. **No upward import.** `libs` never import from `apps` or `services`. Dependencies point **down** only: `apps → services → libs`, never back up. If a lib needs something from an app, the abstraction is in the wrong place — lift it into the lib.
2. **One public door per lib.** Each lib exposes a single `src/index.ts`. Import by **package name** (`@stack/db`), never a deep path (`@stack/db/src/schema/users`). The barrel file is the contract.
3. **By feature, not by layer.** Inside an app/service, group by what it _does_ (`billing/`, `users/`), not by technical layer (`controllers/`, `models/`).
4. **One ORM: Drizzle.** All DB access goes through `@stack/db`. No raw `pg`, no second ORM.
5. **Payments through the adapter.** Never call Creem (or any provider) directly from an app or the API — go through `@stack/payment`. Swapping providers should touch one file, not fifty.
6. **Config, not hardcoding.** No hardcoded URLs, ports, or secrets. Read typed env through `@stack/config`'s `getEnv()` (backed by `.env.local`, see `.env.example`). Portless injects ports — nothing is pinned.
7. **One tsconfig source of truth.** Every workspace's `tsconfig.json` extends the root `tsconfig.base.json`. Don't fork compiler options per package.

## 4. How to run — Tilt (dev servers) + Nx (tasks)

Two tools, two jobs, no overlap: **Tilt = what's running; Nx = the task graph (build/typecheck/lint/test), caching, affected, boundaries, generators.** Dev servers are _never_ routed through Nx — you still `./tilt_up.sh`.

```bash
npm install -g portless   # one-time: stable named URLs for every served role
bun install
cp .env.example .env.local
./scripts/link-env.sh     # symlink root .env.local into each app/service (see §6)
./tilt_up.sh              # boots every app + service → dashboard at localhost:10380
```

- **Always `./tilt_up.sh`, never `tilt up` directly** — the script pins the Tilt UI to port **10380** so multiple Tilt projects coexist instead of fighting over the shared default. `./tilt_down.sh` stops it.
- **No pinned service ports.** Every served role runs behind [Portless](https://github.com/vercel-labs/portless) at a stable named URL — `<svc>.stack.localhost:1355`:

  | Role      | URL                                                     |
  | --------- | ------------------------------------------------------- |
  | Web       | `http://web.stack.localhost:1355`                       |
  | Landing   | `http://landing.stack.localhost:1355`                   |
  | API       | `http://api.stack.localhost:1355` (`/health` · `/docs`) |
  | Payment   | `http://payment.stack.localhost:1355` (`/health`)       |
  | Storybook | `http://storybook.stack.localhost:1355`                 |
  | AI Worker | background — no URL                                     |

- The **`.devops/Tiltfile` is the runtime source of truth**: it lists every resource, its `serve_cmd`, and its links. Adding a service = adding a `local_resource` there. See [`docs/portless.md`](./docs/portless.md).
- Single package during dev: `bun --filter @stack/api dev`.
- Nx tasks: `bun run typecheck` · `bun run check` · `bun run build` · `bun run affected` (only what changed) · `bun run graph`. See [`docs/nx.md`](./docs/nx.md).
- Lint & format: **Oxlint + Oxfmt for speed; ESLint kept ONLY for the Nx module-boundary rule.** `bun run lint` (oxlint, whole repo) · `bun run format` / `format:check` (oxfmt) · `bun run lint:boundaries` (ESLint `@nx/enforce-module-boundaries`). See [`docs/linting.md`](./docs/linting.md).
- One-off flows are Tilt buttons (`db:push`, `deploy:staging`, `tunnel`) — `auto_init=False`, click to run.

## 5. Adding things — the decision

| You need…                         | Put it in                | Then                                                                                                                                     |
| --------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| shared code used in 2+ places     | a new `libs/*` package   | scaffold with the Nx generator: `nx g @nx/js:lib …` — it's born tagged `type:lib`, named `@stack/*`, with its single `src/index.ts` door |
| something with its own URL/deploy | a new `services/*`       | scaffold, then add a `local_resource` to `.devops/Tiltfile`; skill: `agents/skills/add-a-service`                                        |
| a new user-facing surface         | a new `apps/*`           | scaffold, then wire it into `.devops/Tiltfile`                                                                                           |
| a new payment provider            | `@stack/payment` adapter | never inline in an app; skill: `agents/skills/wire-a-new-payment-provider`                                                               |

Prefer the Nx generators — a generated package **can't be born breaking the boundary laws** (it's tagged and has its barrel from birth). Commands: [`docs/nx.md`](./docs/nx.md).

## 6. Env — one source, symlinked

There is **one** env file: root `.env.local` (copy from `.env.example`). Two ways it reaches processes:

- **`./tilt_up.sh`** sources root `.env.local` into every service automatically (the `.devops/Tiltfile` handles it).
- **Standalone `bun --filter @stack/<x> dev`** — bun only loads `.env.local` from the _invoking_ directory, so run **`./scripts/link-env.sh`** once. It symlinks root `.env.local` into each app/service (`ln -sf ../../.env.local <pkg>/.env.local`), keeping one source of truth. The symlinks are gitignored.

**A fresh clone boots on an empty `.env.local`** — every paid integration is env-gated to a silent no-op (no key → the feature is off, the app still runs). Fill keys only when you actually want to send email / take payment / see analytics / call AI. Full turnkey guide: [`docs/getting-started.md`](./docs/getting-started.md) · what it costs: [`docs/costs.md`](./docs/costs.md).

## 7. Agent tooling — MCP

Copy [`agents/mcp.json`](./agents/mcp.json) → repo-root `.mcp.json` to give your agent: **context7** (up-to-date library docs), **postgres** (reads the live schema/data via `DATABASE_URL` — needs `uv` installed for `uvx`), **filesystem** (repo-scoped), **mobbin** (real app UI reference — paid plan). See [`docs/getting-started.md`](./docs/getting-started.md#agent-tooling) for setup.

## 8. Before you finish

- `bunx nx run-many -t typecheck` passes (all 14).
- `bun run lint` (oxlint) clean and `bun run format:check` (oxfmt) clean.
- `bun run lint:boundaries` clean — no new upward import, no deep import past a lib's barrel.
- New service is in `.devops/Tiltfile`.
- New env var is in `.env.example` (with a safe local default, no real secret).
- Conventional-commit message (`feat:`, `fix:`, `docs:` …). See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## 9. Where to look next

- [`agents/subagents.md`](./agents/subagents.md) — specialized subagents (frontend, backend, db-migrations, reviewer) and when to spawn them.
- [`agents/skills/`](./agents/skills/) — step-by-step skills for the common structural tasks.
- [`agents/mcp.json`](./agents/mcp.json) — the MCP servers above.
- [`docs/architecture.md`](./docs/architecture.md) — the taxonomy and the two laws, with diagrams.
- [`docs/nx.md`](./docs/nx.md) — the task graph, caching, affected, boundaries, generators.
