# Getting started — provide your keys

The turnkey guide to taking builders-stack from a fresh clone to a running app with the integrations you want on. **A fresh clone boots on an empty `.env.local`** — every paid integration is env-gated to a silent no-op (no key → the feature is off, the app still runs). You add keys only when you want that feature.

## 0. Boot with zero keys

```bash
npm install -g portless        # stable named URLs for every served role
bun install
cp .env.example .env.local     # leave it empty — it still boots
./scripts/link-env.sh          # symlink root .env.local into each app/service (see below)
./tilt_up.sh                   # dashboard at localhost:10380
```

You now have web + landing + api + payment (Mock provider) + storybook running at `*.stack.localhost:1355`. Login, email, payments, analytics, and AI are all off until you add their keys.

### Toolchain

Versions are pinned in [`.tool-versions`](../../.tool-versions) (read by `asdf` / `mise`):

- **Bun `1.1.34`** — the package manager _and_ runtime (matches `packageManager` in `package.json` and CI). Never `npm`/`yarn`/`pnpm`.
- **Node `20+`** — **not** required to run the app (Bun is the runtime), but it's the floor for the `npx`-based MCP servers in `agents/mcp.json`. Node 20 is the minimum; older majors won't resolve those servers.

### Git hooks (optional but recommended)

The repo ships a [`lefthook.yml`](../../lefthook.yml). Enable it once so unformatted/unlinted code can't be committed and un-typechecked code can't be pushed:

```bash
bunx lefthook install
```

`pre-commit` runs `oxfmt` + `oxlint` on staged files (sub-second); `pre-push` runs `bunx nx affected -t typecheck`. Skip in a pinch with `LEFTHOOK=0 git commit …` or `git commit --no-verify`.

### The env single-source (`link-env.sh`)

There's **one** env file: root `.env.local`. `./tilt_up.sh` sources it into every service automatically. But standalone `bun --filter @stack/<x> dev` only loads a `.env.local` from the _invoking_ directory, so **`./scripts/link-env.sh`** symlinks the root file into each app/service (`ln -sf ../../.env.local <pkg>/.env.local`). Re-run it any time; the symlinks are gitignored. Edit keys in one place: root `.env.local`.

## 1. Fill order — what turns on what

Group your keys by what you're trying to do. Nothing below is required to boot.

**Boots with ZERO keys**

- `DATABASE_URL` — has a working local-Postgres default.
- All the `*_URL` / `*_ORIGIN` vars — sensible portless defaults.
- **Microsoft Clarity** — free, add the id whenever.

**Needed to actually log in**

- `BETTER_AUTH_SECRET` — generate: `openssl rand -base64 32`. Without it, sign-up/login won't work (the rest of the app still runs).

**Needed to actually call AI**

- `AI_API_KEY` — an **OpenAI** key by default (see [`ai.md`](./ai.md)). **No free tier.**

**Needed to actually send email**

- `RESEND_API_KEY` (+ `EMAIL_FROM`). Unset = every send is logged and skipped.

**Needed to actually take payment**

- `CREEM_API_KEY` + `CREEM_WEBHOOK_SECRET`. Unset = the Mock provider runs.

**Needed to actually see analytics**

- `NEXT_PUBLIC_POSTHOG_KEY` (client) + `POSTHOG_API_KEY` (server). Unset = analytics/replay/errors off.

## 2. Per-integration — where to get each key

| Env var                        | Provider            | What it's for              | Usable without it?                                | Where to get it                                                                       | Format           |
| ------------------------------ | ------------------- | -------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------- |
| `DATABASE_URL`                 | Neon / any Postgres | the database               | **Yes** — local-Postgres default                  | [neon.tech](https://neon.tech) → New Project → _Connection string_                    | `postgresql://…` |
| `BETTER_AUTH_SECRET`           | (self)              | signs auth sessions        | app boots, but login won't work                   | `openssl rand -base64 32`                                                             | base64 string    |
| `AI_API_KEY`                   | OpenAI (default)    | model calls                | **Yes** — no-op until a call is made              | [platform.openai.com](https://platform.openai.com) → _API keys_ → Create              | `sk-…`           |
| `RESEND_API_KEY`               | Resend              | transactional email        | **Yes** — sends log + skip                        | [resend.com](https://resend.com) → _API Keys_ → Create                                | `re_…`           |
| `EMAIL_FROM`                   | Resend              | verified sender            | **Yes** — defaults to Resend's shared test sender | Resend → _Domains_ (or use `onboarding@resend.dev`)                                   | email address    |
| `CREEM_API_KEY`                | Creem               | payments                   | **Yes** — Mock provider runs                      | [creem.io](https://www.creem.io) → Dashboard → _Developers → API Keys_                | `creem_…`        |
| `CREEM_WEBHOOK_SECRET`         | Creem               | verify webhooks            | **Yes** — Mock provider                           | Creem → _Developers → Webhooks_                                                       | secret string    |
| `NEXT_PUBLIC_POSTHOG_KEY`      | PostHog             | product analytics (client) | **Yes** — analytics off                           | [posthog.com](https://posthog.com) → _Project Settings → Project API Key_             | `phc_…`          |
| `POSTHOG_API_KEY`              | PostHog             | server capture             | **Yes** — off                                     | same project key (or a server key)                                                    | `phc_…`          |
| `NEXT_PUBLIC_CLARITY_ID`       | Microsoft Clarity   | session recording          | **Yes** — Clarity off                             | [clarity.microsoft.com](https://clarity.microsoft.com) → project → _Settings → Setup_ | short id         |
| `GITHUB_CLIENT_ID` / `_SECRET` | GitHub OAuth        | social login               | **Yes** — email login still works                 | GitHub → _Settings → Developer settings → OAuth Apps_                                 | id + secret      |
| `CONTEXT7_API_KEY`             | context7            | agent library docs (MCP)   | **Yes** — works keyless at a lower rate limit     | [context7.com](https://context7.com)                                                  | key string       |

## <a id="agent-tooling"></a>3. Agent tooling — MCP

Give your coding agent the same context you have:

```bash
cp agents/mcp.json .mcp.json     # Claude Code auto-loads it; Cursor/Codex use the same shape
```

That wires up four MCP servers:

- **context7** — up-to-date library docs. Works **keyless** at a lower rate limit; set `CONTEXT7_API_KEY` to raise it.
- **postgres** — reads your live schema/data via `DATABASE_URL`, read-only. **Requires `uv` installed** (the server runs via `uvx`): `curl -LsSf https://astral.sh/uv/install.sh | sh`.
- **filesystem** — repo-scoped file access.
- **mobbin** — 600k+ real app UI screens as design reference. **Paid Mobbin plan required** (~$10–13/mo); the free tier returns a 401. Drop it from `.mcp.json` if you don't want it.

`.mcp.json` expands `${VAR}` from your shell / `.env.local`, so `DATABASE_URL` and `CONTEXT7_API_KEY` flow through automatically.

## 4. What it costs

Short version: **~$0/month at MVP scale.** The only day-one costs are AI tokens (no free tier) and, optionally, Mobbin's MCP. Full breakdown: [`costs.md`](./costs.md).

## 5. Deploying (optional)

Same keys, real values. For prod/preview, point `DATABASE_URL` at your Neon connection string (one value per environment — no parallel prod/preview vars). The deploy-only credentials live in the deploy docs: **Cloudflare** (`CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN`) in [`deploy.md`](../deploy.md); **Infisical** machine identity for CI secret injection in [`secrets.md`](../secrets.md).

## Machine-readable summary (for agents)

Every env var → provider → signup URL → whether the app runs without it (env-gated).

| env                     | provider          | signup                                 | gated (boots without it)? |
| ----------------------- | ----------------- | -------------------------------------- | ------------------------- |
| DATABASE_URL            | Neon              | https://neon.tech                      | yes (local default)       |
| BETTER_AUTH_SECRET      | self              | `openssl rand -base64 32`              | boots; login disabled     |
| AI_API_KEY              | OpenAI            | https://platform.openai.com            | yes (no-op until called)  |
| RESEND_API_KEY          | Resend            | https://resend.com                     | yes                       |
| EMAIL_FROM              | Resend            | https://resend.com                     | yes (test-sender default) |
| CREEM_API_KEY           | Creem             | https://www.creem.io                   | yes (Mock provider)       |
| CREEM_WEBHOOK_SECRET    | Creem             | https://www.creem.io                   | yes                       |
| NEXT_PUBLIC_POSTHOG_KEY | PostHog           | https://posthog.com                    | yes                       |
| POSTHOG_API_KEY         | PostHog           | https://posthog.com                    | yes                       |
| NEXT_PUBLIC_CLARITY_ID  | Microsoft Clarity | https://clarity.microsoft.com          | yes                       |
| GITHUB_CLIENT_ID        | GitHub            | https://github.com/settings/developers | yes                       |
| GITHUB_CLIENT_SECRET    | GitHub            | https://github.com/settings/developers | yes                       |
| CONTEXT7_API_KEY        | context7          | https://context7.com                   | yes (keyless works)       |
