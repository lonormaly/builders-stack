# The (almost) free stack

Every tool in this stack was picked so you can take a real product from an idea to paying users at **near-zero cost** — and most of these free tiers don't just cover an MVP, they carry you well past it. When a ceiling finally bites, you add a card, not a rebuild. Each integration is env-gated too: no key → silent no-op, the app still boots, so you don't sign up or pay until you actually want that feature on.

Below is one entry per tool, in the layer order the stack uses — hosting → database → auth → email → analytics → secrets → payments — with why it's here, what you get free, the honest caveat, and where it's wired in this repo. Exact next-tier prices live in [`docs/costs.md`](./costs.md).

**One exception to "free": the AI layer — but it's one key, any model.** Instead of calling a provider's SDK (OpenAI, etc.) directly — which hard-wires every call site to one vendor — `libs/ai` wraps the **Vercel AI SDK**: a single `AI_API_KEY` behind a **provider-agnostic** interface, so you swap OpenAI ↔ Anthropic ↔ Google ↔ others by changing one line in `libs/ai/src/providers.ts`, never your call sites (or point it at the Vercel AI **Gateway** for one key across many models). It's the single piece with **no free tier — you pay from the first token** — but you're never locked to a vendor, and a cheaper model id caps the cost. Everything else here boots and runs for $0 at MVP scale. Details: [`docs/ai.md`](./ai.md).

---

## Cloudflare — edge hosting, storage, CDN & security

- **What it is:** One edge platform for hosting, object storage, CDN, DNS and security.
- **Why we chose it:** Frontend hosting at the edge with a genuinely generous request budget, plus **R2 object storage with zero egress fees** — you're never billed for bandwidth out, which is where S3-style storage quietly gets expensive. Universal SSL, unmetered DDoS, and a global CDN come along for free.
- **What you get free:** ~100,000 Worker requests/day; unlimited Pages bandwidth + 500 builds/mo; 10 GB R2 with egress always free; free CDN + DDoS.
- **Watch:** the 100k/day Workers cap is hard, and each call gets 10 ms CPU. Heavy traffic or compute → Workers Paid ($5/mo minimum, 10M requests included).
- **In this repo:** `apps/web` and `apps/landing` deploy to Cloudflare Workers via the OpenNext adapter. Credentials (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`) live in CI/deploy, not `.env.local`. See [`docs/deploy.md`](../deploy.md).

## Neon — serverless Postgres with branching

- **What it is:** Fully-managed serverless Postgres that separates storage from compute.
- **Why we chose it:** Real managed Postgres with two things a plain database doesn't give you — **Git-style branching** (instant copy-on-write branches, so every PR can get its own preview DB against a copy of prod) and **scale-to-zero** (an idle database costs nothing). Any Postgres works with `@stack/db`; Neon is just the easy hosted default that autoscales instead of you sizing an instance.
- **What you get free:** 0.5 GB storage, 100 compute-hours/month, ~100 projects × 10 branches, 6-hour point-in-time restore window.
- **Watch:** scale-to-zero adds a ~0.3–1s cold start on the first query after idle; the **compute (CU-hours) allotment is the real ceiling**, and anything that pins compute awake burns it — an always-on/polled DB drains the month in roughly a week.
- **In this repo:** `libs/db` (Drizzle ORM — one ORM only). `DATABASE_URL` has a local default so a fresh clone boots against local Postgres; point it at your Neon connection string for prod/preview. To hold the free tier under real traffic the stack ships **session cookie-caching on by default** (`libs/auth` — auth stops hitting the DB per request, the dominant compute drain) and a **`dba` agent + DB skills**; the "don't poll the DB" rule lets idle compute scale to zero. See [`agents/skills/run-lean-on-neon`](../../agents/skills/run-lean-on-neon/SKILL.md) and [`docs/deploy.md`](../deploy.md).

## Better Auth — self-hosted TypeScript auth

- **What it is:** Open-source (MIT), framework-agnostic TypeScript auth you run inside your own app and DB.
- **Why we chose it:** Auth is where hosted providers punish growth — Auth0/Clerk bill **per monthly active user**, so your auth cost scales with your success. Better Auth is MIT-licensed and fully self-hosted: **no per-MAU billing, auth cost doesn't scale with users.** Email/password, 34+ social providers, passkeys, magic links, 2FA, organizations — with first-class TS types and DB-agnostic storage (it uses the same Drizzle DB you already have).
- **What you get free:** all of it — free and MIT, no usage tier at all.
- **Watch:** you own the database, migrations, and security posture; and it's young (launched 2024).
- **In this repo:** `libs/auth`, mounted in `services/api`, boot-verified end to end (sign-up → analytics event + welcome email). Needs `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL` at runtime. See [`docs/secrets.md`](../secrets.md).

## Resend — transactional email developers enjoy

- **What it is:** Developer-first email API from the team behind React Email.
- **Why we chose it:** The DX — **React Email** lets you write templates as React components (typed, previewable) instead of hand-crafting HTML strings, with a clean REST API, webhooks, and 30-day searchable logs. It's the email layer that doesn't feel like a chore to wire up.
- **What you get free:** 3,000 emails/month, 1 custom domain, 1,000 contacts, 30-day logs.
- **Watch:** there's a **100 emails/day** cap that bursty apps hit before the monthly limit — that's the real ceiling. Production also needs a verified sending domain. Past it → Resend Pro ($20/mo lifts the daily cap).
- **In this repo:** `libs/email` — typed, previewable templates + a `sendEmail()` sender. Unset `RESEND_API_KEY` = every send is logged + skipped (no-op), app still boots; `EMAIL_FROM` defaults to Resend's shared test sender. See [`docs/email.md`](./email.md).

## PostHog — analytics, replay, flags, errors & an agent MCP

- **What it is:** All-in-one product platform — analytics + session replay + feature flags + experiments + error tracking + surveys + **LLM observability** — with a hosted **MCP** so your coding agent can drive it.
- **Why we chose it:** One tool instead of five. Product analytics, **session replay** (video of real sessions), feature flags, A/B experiments, and error tracking share one SDK and one project — you don't stitch together Amplitude + FullStory + LaunchDarkly + Sentry and reconcile four bills. Two extras land squarely in this stack's lane: **LLM observability** (token cost + latency per model call — and this stack ships an AI layer) lives in the same project, and PostHog's **MCP** (`npx @posthog/wizard mcp add`) lets your coding agent ship a feature flag from a prompt, run a HogQL query, or triage an error without leaving the editor — the same agent-native surface as `agents/mcp.json`.
- **What you get free (monthly):** 1M analytics events, 5,000 session replays, 1M feature-flag requests, 100k error events, 100k LLM-observability events, 1,500 survey responses.
- **Watch:** autocapture is noisy until you tune it; MCP tools that call an LLM internally bill as PostHog AI spend; past the monthly free allotment everything goes usage-based.
- **In this repo:** `libs/analytics` — a shared `<Analytics/>` client provider every app reuses, plus `posthog-node` server capture in `services/api` and a typed event catalog client and server share. Keys: `NEXT_PUBLIC_POSTHOG_KEY` (client), `POSTHOG_API_KEY` (server). Unset = analytics/replay/errors off, app renders normally. See [`docs/analytics.md`](./analytics.md).

## Microsoft Clarity — session recording & heatmaps

- **What it is:** Session recording + heatmaps from Microsoft.
- **Why we chose it:** It's **free forever with no cap** — where PostHog's replay allotment is metered, Clarity gives you uncapped session recordings and heatmaps at zero cost, so you run both: PostHog for the funnel and events, Clarity for unlimited qualitative "what did they actually do" replay.
- **What you get free:** everything, uncapped, forever. There is no paid tier to hit.
- **Watch:** nothing on cost. It's a client-only recorder — it complements, not replaces, PostHog's server-side analytics.
- **In this repo:** `libs/analytics`, wired into the same shared `<Analytics/>` provider. Key: `NEXT_PUBLIC_CLARITY_ID`; unset = Clarity off. See [`docs/analytics.md`](./analytics.md).

## Infisical — open-source secrets management

- **What it is:** Open-source secrets manager (cloud or self-hosted) — a friendlier HashiCorp Vault alternative.
- **Why we chose it:** As soon as more than one person or machine needs the keys, `.env` files stop being a source of truth. Infisical is **open-source and self-hostable**, so you can start on its free cloud and later run the whole thing yourself with no vendor lock — it centralizes secrets across dev/staging/prod and injects them at runtime (no `.env` on disk) with native Kubernetes and Cloudflare integrations at deploy.
- **What you get free:** cloud free forever — 5 members/machine identities, 3 projects, 3 environments, 10 integrations, scanning + sharing. Self-host the OSS core for unlimited everything.
- **Watch:** versioning, point-in-time recovery, and fine-grained RBAC sit on the paid tier (or self-host to get them free). It's optional — the stack boots fine on `.env.local` alone.
- **In this repo:** the source of truth for team/prod secrets — `infisical run -- ./tilt_up.sh` locally, Machine-Identity auth (`INFISICAL_PROJECT_ID` / `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET`) in CI, native k8s + Cloudflare sync at deploy. See [`docs/secrets.md`](../secrets.md).

## Creem — Merchant-of-Record payments

- **What it is:** A Merchant-of-Record (MoR) payments platform — it is the legal seller, handles global tax, collects from customers, and pays you out.
- **Why we chose it:** As an MoR, Creem **handles global sales tax / VAT for you** — it's the seller of record, so you invoice one entity instead of registering for tax in every jurisdiction you sell into. (Any MoR gives you that; the stack ships the Creem adapter.) No monthly fee — you only pay when you make a sale.
- **What you get free:** no monthly fee — pay per sale. You can wire the whole flow and ship without paying anything until money actually moves.
- **Watch:** **3.9% + $0.40/txn** from the first sale — the MoR premium (~1% + $0.10 over a raw processor like Stripe's 2.9% + $0.30), the price of not doing tax compliance yourself. Optional features (revenue splits, affiliates, cart recovery) add further points — check current rates before enabling them.
- **In this repo:** `@stack/payment` / `services/payment` — a Creem adapter + a second [Dodo](https://dodopayments.com/) adapter (starter skeleton) + a Mock provider + tests, boots keyless. Apps go through the adapter interface, never call a vendor directly, so swapping Creem for Stripe/Paddle/Lemon Squeezy/Dodo is a one-file change — the two shipped MoR adapters behind one interface are the proof. Keys: `CREEM_API_KEY` / `CREEM_WEBHOOK_SECRET` (or `DODO_API_KEY` / `DODO_WEBHOOK_SECRET`, or `PAYMENT_PROVIDER` to pick). Recipe: [`docs/payments.md`](./payments.md).
- **Delulus Club perk:** both **Creem** and **[Dodo Payments](https://dodopayments.com/)** — the two Merchant-of-Record options worth a look here — offer **Delulus Club members a lifetime exclusive deal**. [Reach out to Shai](https://www.linkedin.com/in/shaisnir/) for details.

---

## The stack together

Hosting + storage + security (Cloudflare) → database (Neon) → auth (Better Auth) → email (Resend) → analytics + replay (PostHog + Clarity) → secrets (Infisical) → payments (Creem). All free or near-free until real, paying users arrive — the one exception being AI tokens, which you pay for from the first call. You rarely need all of it on day one: add each layer when the product actually needs it, and add the paid tier only when a specific ceiling bites, one line item at a time.

For the exact next-tier prices and the first paid trigger of each tool, see [`docs/costs.md`](./costs.md).

---

_Prices are 2026 and providers change tiers — re-check the linked pages before you rely on a number._
