# CLAUDE.md — the map for coding agents

This is a bun-workspace monorepo. Read this before writing code; it tells you where everything lives so you don't reinvent what already exists.

## Where things live

- `apps/` — public UI. `apps/web` (Next.js app), `apps/landing` (public marketing), `apps/mobile` (React Native / Expo — real starter).
- `services/` — anything with a URL. `services/api` (Hono + OpenAPI), `services/ai-worker` (background load), `services/payment` (Creem adapter).
- `libs/` — shared, **never served**. `libs/ui` (shadcn + tokens + Storybook), `libs/auth` (Better Auth), `libs/db` (Drizzle), `libs/ai` (Vercel AI SDK), `libs/analytics` (PostHog + Clarity + typed events), `libs/email` (Resend + React Email), `libs/config` (typed env), `libs/api-types` (shared API contract). Import by package name: `@stack/ui`, `@stack/db`, …

## Conventions (do not break)

- **No upward import**: `libs` must not import from `apps`/`services`. Dependencies point down only.
- **One public door**: import a lib from its package name / `src/index.ts` — never a deep path.
- **By feature, not by layer** inside each app/service (`billing/`, not `controllers/`).
- Every workspace extends the root `tsconfig.base.json`. Don't fork compiler options.
- ORM is **Drizzle** (`libs/db`). One ORM only.
- Payments go through the `@stack/payment` adapter interface — never call a vendor (Creem/Dodo/…) directly from an app. Swapping or adding a provider is a one-file change in `services/payment/src/provider.ts`; recipe in `docs/payments.md`.

## How to run

- `bun install`, then `./tilt_up.sh` boots every role via **portless** — stable URLs like `api.stack.localhost:1355`, no pinned ports (see `docs/portless.md`). Real Tilt logic lives in `.devops/Tiltfile` (root `Tiltfile` just loads it).
- **Tilt — ONLY the scripts.** Use `./tilt_up.sh` / `./tilt_down.sh` exclusively (they own the UI port 10380 + portless wiring). NEVER run raw `tilt up/down/trigger` or a custom `--port` — it hits the wrong port and corrupts the session. Restart a crashed resource from the Tilt UI, or `./tilt_down.sh && ./tilt_up.sh`.
- Add a new service → wrap it `portless <name>.stack …` in `.devops/Tiltfile`, and have it read `process.env.PORT` (never pin a port).

## Adding things

- New shared code used in 2+ places → a `libs/*` package with a `src/index.ts`.
- New thing that needs its own URL/deploy → a `services/*`.
- New user-facing surface → an `apps/*`.

## How to work here (hard-won)

- **Portless + HMR:** portless doesn't proxy WebSockets, so Next.js hot-reload won't connect through `web.stack.localhost:1355` (it'll retry in the console — expected). A manual refresh works; for live HMR run `bun --filter @stack/web dev` directly.
- **Portless + OAuth:** Google (and strict OAuth providers) reject `*.localhost:port` redirect URIs — only `localhost`/`127.0.0.1` count as loopback. To test Google/social sign-in locally, run the app on a **pinned port** instead: `PORT=3000 bun --filter @stack/web dev` (same for `@stack/landing`), point `BETTER_AUTH_URL`/`trustedOrigins` at `http://localhost:3000`, and register that callback in the provider console. See `docs/portless.md`.
- **Design-system discipline:** every reusable UI element is a `@stack/ui` component (even "custom" ones). Apps _compose_ `@stack/ui` — they never inline reusable UI or duplicate styles. Icons: `lucide-react`. For net-new UI, pull real-world references from **Mobbin** (via its MCP) _before_ building, so screens are intentional, not generic AI slop — then implement as `@stack/ui` components. See `docs/design.md`.
- **Secrets:** local dev = `.env.local` (git-ignored; never commit); `.env.example` documents every key (`auth` needs `BETTER_AUTH_SECRET` at runtime). Team/prod = **Infisical** as the source of truth (`infisical run -- ./tilt_up.sh`; native k8s + Cloudflare integrations at deploy). See `docs/secrets.md`.
- **Parallel agents:** isolate every file-touching agent in its own git worktree/branch — never two agents on the same checkout, or they overwrite each other.
- **Push, don't poll:** for job/status state use WebSocket/SSE, not a `setInterval` hitting an endpoint. An idle client makes zero requests.
- **Sacred content:** never delete the instructional comments in `agents/`, skills, or configs — restructure/add, don't strip. They're hard-won.

## SEO/GEO — enforced

**This is enforced.** `bun run check:seo` (in `bun run check`, lefthook pre-push, and CI) **fails the build** if a public page lacks metadata or is client-rendered. **`@stack/seo` is the one door for page metadata + JSON-LD — use it, don't hand-roll.**

Grounded in Google's guide — read it, it's the source of truth: <https://developers.google.com/search/docs/fundamentals/ai-optimization-guide>.

**DO**

- Public content is **server-rendered + crawlable** — never block JS/DOM/accessibility. (A public page must not be a root `"use client"` component; push interactivity into a child.)
- Every public page exports `metadata`/`generateMetadata` via `@stack/seo`'s **`pageMetadata()`** (title/description/canonical/OG/twitter, sourced from `@stack/config`).
- Content pages emit JSON-LD via `@stack/seo` (`organizationJsonLd`, `websiteJsonLd`, `articleJsonLd`, `faqJsonLd`, `breadcrumbJsonLd` + `<JsonLd/>`) — for **rich results**, not as an AI hack.
- Use semantic HTML; keep `sitemap.ts` current; spread `aiCrawlerRules()` into `robots.ts`.

**DON'T**

- Don't "chunk" content for AI, write in "AI syntax", or mass-produce recycled/scaled content (Google's scaled-content abuse policy). The real win is **original, first-hand, expert content**.
- Don't treat `llms.txt` as a ranking lever — **Google Search ignores it** (kept only for non-Google engines).
- Don't hand-roll `Metadata`/OpenGraph/canonical or inline `<script type="application/ld+json">` — that's exactly what the gate exists to stop.

**Private-route convention (exempt from the rules):** a route is private if any path segment (route-group parens stripped) is `app`, `dashboard`, `protected`, `auth`, or `internal`.

See `agents/` for skills, subagents, and MCP config.
