# The Modern Builders Stack for 2026

[![CI](https://github.com/lonormaly/builders-stack/actions/workflows/ci.yml/badge.svg)](https://github.com/lonormaly/builders-stack/actions/workflows/ci.yml)

![builders-stack](./docs/assets/hero.png)

**3 folders · 3 laws — everything else is a deletable example.**

Three folders — `apps/` (what humans see) · `services/` (what has a URL) · `libs/` (shared, never served). Three laws — **no-upward-import** · **one-public-door** · **by-feature-not-layer**. The packages inside are real, working examples that prove the pattern end to end; you keep the shape and [gut the examples you don't need](./docs/make-it-yours.md). The structure is the product.

Dependencies only ever point **down** (`apps` → `services` → `libs`); an arrow pointing up is the design smell the boundary rule rejects. This is the map your coding agent navigates instead of re-guessing every session.

<!-- Optional second hero: a screenshot of the Tilt dashboard. Drop one at
     docs/assets/tilt-dashboard.png and uncomment the line below.
     ![The Tilt dashboard — every role's live status + logs in one place](./docs/assets/tilt-dashboard.png) -->

An opinionated, AI-native starter for 2026. Clone it, run one command, and you have a real project structure — `apps` / `services` / `libs`, a live-status dashboard, a design system, and a repo your coding agent can actually navigate.

> Part of **The Builder's Stack** by [Shai Snir](https://www.linkedin.com/in/shaisnir/) · [Delulus Club](https://www.delulus.club).

## Why this exists

Your AI agent keeps rewriting the same auth helper, because every session it starts from zero and guesses where things live. Structure is the map that fixes that — for the agent _and_ for you. This repo is that map, ready to clone.

"One app" is a lie. The moment your project does anything real it already has **roles**: something users see, something with a URL, something shared between them. Name those roles and everything has a home. Don't, and it all rots into one folder nobody — human or agent — can navigate.

## Quickstart

```bash
npm install -g portless   # one-time: stable named URLs for every service (see docs/portless.md)
bun install
cp .env.example .env.local    # boots empty — every paid integration is env-gated to a no-op
./scripts/link-env.sh         # symlink root .env.local into each app/service (one source of truth)
cp agents/mcp.json .mcp.json  # optional: wire up your agent's MCP servers (context7, postgres, …)
./tilt_up.sh              # boots every app + service → dashboard at localhost:10380
```

Always `./tilt_up.sh`, **never `tilt up` directly** — the script pins a per-project Tilt UI port (10380), so you can run several Tilt projects at once without clashing on the shared default.

New here? **[`docs/getting-started.md`](./docs/getting-started.md)** is the turnkey "provide your keys" guide (what each integration is for, where to get the key, what runs without it). What it all costs: **[`docs/costs.md`](./docs/costs.md)** — ~$0/month at MVP scale.

Served roles get stable named URLs via [Portless](https://github.com/vercel-labs/portless) — no pinned ports, no collisions:

| Role      | URL                                                     |
| --------- | ------------------------------------------------------- |
| Web       | `http://web.stack.localhost:1355`                       |
| Landing   | `http://landing.stack.localhost:1355`                   |
| API       | `http://api.stack.localhost:1355` (`/health` · `/docs`) |
| Payment   | `http://payment.stack.localhost:1355`                   |
| Storybook | `http://storybook.stack.localhost:1355`                 |

See [`docs/portless.md`](./docs/portless.md) for the full convention.

## The map — three folders, defined by exposure

| Folder          | Role                                                                | Served?                          |
| --------------- | ------------------------------------------------------------------- | -------------------------------- |
| **`apps/`**     | what humans see (web, landing, mobile)                              | public UI                        |
| **`services/`** | what has a URL (api, ai-worker, payment)                            | served to other code             |
| **`libs/`**     | shared code (ui, auth, db, ai, config, api-types, analytics, email) | **never served** — consumed only |

Two rules keep it honest (borrowed from Nx):

- **No upward import** — `libs` never import from `apps` or `services`. Dependencies point _down_.
- **One public door per lib** — each lib exposes a single `src/index.ts`; import from the package name (`@stack/ui`), never deep paths.

Inside each app/service, organize **by feature** (`billing/`, `users/`), not by layer (`controllers/`, `models/`). Folders should tell you what the thing _does_.

## The runtime half — Tilt

Folders tell you _where things live_. The Tiltfile (**`.devops/Tiltfile`** — the root `Tiltfile` just `load_dynamic`s it, so edit the one in `.devops/`) tells you _what's running_. One `./tilt_up.sh` boots every role, shows live status + logs in one dashboard, and turns one-off flows (deploy, tunnel, `db push`) into click-buttons. It's also a machine-readable manifest your agent reads to know what exists and how to run it.

## Task orchestration — Nx

Tilt runs your **dev servers**. Nx runs your **tasks** — `build`, `typecheck`, `lint`, `test` — and it's the half that makes a growing monorepo stay fast. Two tools, two jobs, no overlap: **Tilt = what's running; Nx = the task graph, caching, affected, boundaries, and generators.** Dev servers are never routed through Nx — you still `./tilt_up.sh`.

What it buys you ([monorepo.tools](https://monorepo.tools) framing):

- **Cache** — every task result is cached by input hash, locally and (opt-in) across CI. Change one lib, only its dependents re-run.
- **Affected** — `bun run affected` (`nx affected`) runs tasks _only_ for the projects a change touched. PR CI runs what changed, nothing else.
- **`nx graph`** — the interactive dependency graph of the whole repo (`bun run graph`).
- **Enforced boundaries** — the two laws below become **lint errors**. Every project is tagged `type:app` / `type:service` / `type:lib`, and `@nx/enforce-module-boundaries` rejects a `lib` that imports an app, an app that imports another app, and deep imports past a lib's barrel. "Enforce it in review" → enforced in `lint`.
- **Generators** — `nx g @nx/js:lib …` scaffolds a new lib/service/app that's _already_ tagged, named `@stack/*`, and has its single `src/index.ts` door — it can't be born breaking the rules.

```bash
bun run check      # nx run-many -t typecheck lint — the pre-push gate
bun run graph      # open the project graph
bun run affected   # lint + typecheck + build, only what changed
```

Full guide, generator commands, and the caching/CI config: [`docs/nx.md`](./docs/nx.md).

## Lint & format — Oxlint + Oxfmt

**Oxlint + Oxfmt (Rust, ~30x faster) do the bulk of linting and formatting; ESLint is kept ONLY for `@nx/enforce-module-boundaries`** — the one rule Oxlint has no equivalent for. `eslint-plugin-oxlint` turns off every ESLint rule Oxlint already covers, so there's no double-reporting.

```bash
bun run lint            # oxlint — whole repo, type-aware
bun run format          # oxfmt — write
bun run format:check    # oxfmt — CI gate
bun run lint:boundaries # ESLint @nx/enforce-module-boundaries only
```

Full guide: [`docs/linting.md`](./docs/linting.md).

## It scales without moving

The **folders** are fixed from day one, even solo. Only the **packaging** grows: `bun run dev` → Tilt → Docker → k8s, as you need it. You never restructure — you just add infra under `infra/`.

## What's real vs. a stub

Almost all of it is real — it boots and proves the pattern end to end. Only a couple of things are deliberately left as placeholders for your product code.

**Real (boots, proves the pattern):**

- `apps/web` — Next.js, renders `@stack/ui`, live Better Auth login, type-safe calls to the API.
- `apps/landing` — public marketing site: `@stack/ui` hero + sections, shared `<Analytics/>`, links to the app.
- `apps/mobile` — real Expo/React Native starter rendering the shared `@stack/ui` tokens on native.
- `services/api` — Hono + OpenAPI; validates against `@stack/api-types`, mounts Better Auth, ships server analytics.
- `services/payment` — Creem adapter + Mock provider + tests; boots keyless.
- `services/ai-worker` — background worker (no URL).
- `libs/ui` — shadcn components + shared tokens + Storybook.
- `libs/db` — Drizzle (Postgres).
- `libs/auth` — Better Auth, boot-verified end to end (sign-up → event + welcome email).
- `libs/config` — typed env: one Zod schema + cached `getEnv()`.
- `libs/api-types` — the shared API contract (Zod schemas + inferred types), consumed by the API _and_ the web app.
- `libs/analytics` — the `<Analytics/>` client provider **and** an isomorphic typed event catalog (`./events`) client and server share.
- `libs/email` — Resend + React Email: typed, previewable templates + `sendEmail()`.
- the Tiltfile + Nx wiring + workspace plumbing.

Everything above is **env-gated**: no keys → silent no-op, apps still boot.

**Placeholder (your infra/config goes here):** `infra/` (deploy manifests).

## Analytics & email

Batteries-included, all **env-gated** (no keys → silent no-op, apps still boot):

- **Analytics** — PostHog (product analytics + session replay + error tracking, client _and_ server) and Microsoft Clarity. Client init is a single shared `@stack/analytics` `<Analytics/>` provider every app reuses; server capture is `posthog-node` in `services/api`. Cross-subdomain identity ties marketing-site visitors to signed-up users. See [`docs/analytics.md`](./docs/analytics.md).
- **Email** — Resend + React Email (`@stack/email`): typed, previewable templates and a `sendEmail()` sender. On sign-up, Better Auth fires a `user_signed_up` event + a welcome email — the seed for a PostHog-driven drip. See [`docs/email.md`](./docs/email.md).

## For your AI agent

Start at [`AGENTS.md`](./AGENTS.md) — the repo-root primer Codex, Cursor, and Copilot read by convention: the map of where everything lives and the conventions to follow (Claude Code also reads [`CLAUDE.md`](./CLAUDE.md)). The [`agents/`](./agents) folder is the deep dive: skills, subagents, and an MCP config (`cp agents/mcp.json .mcp.json`) so an agent can plug in and start building _inside the structure_ instead of fighting it.

---

MIT. Steal it, ship faster.
