# Contributing to builders-stack

Thanks for helping improve the stack. This repo is a **flagship template** — clarity and convention matter more here than in a normal app, because people clone it as a starting point. Keep changes small, keep the map honest.

## Prerequisites

- **[Bun](https://bun.com)** ≥ 1.1.34 (the package manager and runtime — never `npm`/`yarn`/`pnpm`).
- **[Tilt](https://tilt.dev)** for the local dev dashboard.
- **Docker** (for Postgres + Redis via `infra/docker-compose.yml`), or a local Postgres.
- Node isn't required to run the app, but some MCP servers (`agents/mcp.json`) use `npx`.

## Get it running

```bash
git clone https://github.com/lonormaly/builders-stack
cd builders-stack
cp .env.example .env.local        # fill in what you need; safe local defaults included
docker compose -f infra/docker-compose.yml up -d   # Postgres + Redis
bun install
./tilt_up.sh                      # boots every app + service → dashboard at localhost:10380
```

Always **`./tilt_up.sh`, never `tilt up` directly** — the script pins a per-project Tilt UI port (10380) so multiple Tilt projects coexist. Served roles get stable **portless** URLs (no pinned ports): `web.stack.localhost:1355`, `api.stack.localhost:1355`, `payment.stack.localhost:1355`, `storybook.stack.localhost:1355`. See `docs/portless.md`.

### Git hooks (recommended)

Enable the shipped [`lefthook.yml`](./lefthook.yml) once so you can't commit drift:

```bash
bunx lefthook install
```

`pre-commit` formats + lints your **staged files** (`oxfmt` + `oxlint`, sub-second); `pre-push` typechecks the **affected** projects (`bunx nx affected -t typecheck`). This is the same gate CI runs, moved to your machine. Bypass with `LEFTHOOK=0 git commit …` or `--no-verify` when you must.

## The folder conventions (read before you add code)

Three top-level roles, sorted by one question — **is it served, and to whom?**

| Folder      | Role                        | Served?                          |
| ----------- | --------------------------- | -------------------------------- |
| `apps/`     | what humans see             | public UI                        |
| `services/` | what has a URL / own deploy | served to other code             |
| `libs/`     | shared code                 | **never served** — consumed only |

Full detail lives in [`docs/stack/architecture.md`](./docs/stack/architecture.md) and [`agents/AGENTS.md`](./agents/AGENTS.md).

### The two laws (do not break)

1. **No upward import** — `libs` never import from `apps`/`services`. Dependencies point down.
2. **One public door** — each lib exposes a single `src/index.ts`; import by package name (`@stack/db`), never a deep path.

Plus: **by feature, not by layer** inside each package · **one ORM (Drizzle) via `@stack/db`** · **payments via the `@stack/payment` adapter** · every workspace extends `tsconfig.base.json` · **no hardcoded URLs/ports/secrets** (use env; add new vars to `.env.example`).

## Adding a lib / service / app

There are step-by-step skills for the common cases — follow them so the structure stays consistent:

- **New shared code (2+ consumers)** → [`agents/skills/add-a-lib`](./agents/skills/add-a-lib/SKILL.md)
- **New thing with a URL/deploy** → [`agents/skills/add-a-service`](./agents/skills/add-a-service/SKILL.md) (and add its `local_resource` to the `Tiltfile`)
- **New payment provider** → [`agents/skills/wire-a-new-payment-provider`](./agents/skills/wire-a-new-payment-provider/SKILL.md)
- **New user-facing surface** → a new `apps/*`, wired into the `Tiltfile`.

## Commit messages — Conventional Commits

Format: `type(scope): summary`. Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`. Scope is the package or area (`api`, `db`, `infra`, `agents`).

```
feat(api): add posts CRUD routes
fix(payment): verify webhook signature before handling
docs(architecture): clarify the no-upward-import rule
```

## Pull request flow

1. **Branch** off `main`: `feat/short-name`.
2. Make the change **small and focused** — one concern per PR. If it touches more than ~3 files across independent domains, consider splitting it.
3. Run locally before pushing:
   ```bash
   bun install
   bun run typecheck        # must pass — CI runs this on every PR
   ```
4. If you added an API route, update the matching Bruno request in [`api-collection/`](./api-collection/). If you added an env var, update `.env.example`. If you added a service, update the `Tiltfile`.
5. Open the PR using the template. Fill in what changed, why, and how you verified it.
6. CI (`.github/workflows/ci.yml`) runs `bun install` + typecheck. Green CI + one review → merge.

## Reporting bugs / requesting features

Use the issue templates under `.github/ISSUE_TEMPLATE/`. A repro that boots via `./tilt_up.sh` gets fixed fastest.

## Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). By participating you agree to uphold it.
