# Analytics — PostHog + Microsoft Clarity

Product analytics, session replay, and error tracking — client **and** server — plus
Microsoft Clarity session recording. Everything is **env-gated**: with no keys set,
nothing initializes and the apps render/boot exactly as before.

## What runs where

| Concern                                       | Where                                | Package                                     | Env                                                   |
| --------------------------------------------- | ------------------------------------ | ------------------------------------------- | ----------------------------------------------------- |
| Client analytics (autocapture, pageviews)     | `apps/web` (+ future `apps/landing`) | `posthog-js` via `@stack/analytics`         | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` |
| Client **session replay**                     | same                                 | `posthog-js` (`session_recording`)          | same                                                  |
| Client **error tracking**                     | same                                 | `posthog-js` (`capture_exceptions`)         | same                                                  |
| Client session recording (Clarity)            | same                                 | `@microsoft/clarity` via `@stack/analytics` | `NEXT_PUBLIC_CLARITY_ID`                              |
| Server events + **exception capture**         | `services/api`                       | `posthog-node` (`src/analytics.ts`)         | `POSTHOG_API_KEY`                                     |
| Server `user_signed_up` event + welcome email | `libs/auth` signup hook              | `posthog-node` + `@stack/email`             | `POSTHOG_API_KEY`                                     |

## Client — `@stack/analytics`

One shared provider, `<Analytics>`, that **every** app drops into its root layout —
`apps/web` uses it today, `apps/landing` reuses the exact same one. Wired in
`apps/web/app/layout.tsx`; `next.config.ts` lists `@stack/analytics` in
`transpilePackages` (it ships `"use client"` TS source, no build step).

`posthog.init` config (`libs/analytics/src/analytics.tsx`):

- `defaults: "2025-05-24"` — modern autocapture + pageview/pageleave.
- `capture_exceptions: true` — **error tracking** (exception autocapture).
- `session_recording: { maskAllInputs: true }` — **session replay**, inputs masked
  by default. (Replay must also be toggled on in your PostHog project settings.)
- `cross_subdomain_cookie: true` + `persistence: "localStorage+cookie"` — see below.
- Clarity initializes alongside PostHog, under the same env gate.

### Cross-domain identity (the acquisition funnel)

`cross_subdomain_cookie: true` writes PostHog's id cookie on the **parent** domain,
so a visitor on the marketing origin (`landing.example.com`) and the signed-up user
in the app (`app.example.com`) resolve to **one PostHog person**. Requirements:

- Both apps share a registrable parent domain (`*.example.com`) and use the **same**
  `NEXT_PUBLIC_POSTHOG_KEY` (same PostHog project).
- On the app side, after login call `posthog.identify(userId)` so the anonymous
  landing visitor is merged into the identified user (PostHog stitches the prior
  anonymous events onto that person).
- No effect on `localhost` / single-host dev — it only matters across subdomains.

## Server — `posthog-node`

`services/api/src/analytics.ts` exposes a lazily-created singleton
(`getPostHogServer()` → `null` without a key) plus `captureServer()` and
`captureServerException()`. The API's `app.onError` ships uncaught route errors to
PostHog error tracking. `libs/auth`'s signup hook keeps its own twin client for the
`user_signed_up` event (a lib can't import a service).

## Verify

Set the keys in `.env.local`, then check the PostHog **Activity** feed (events),
**Session replay**, and **Error tracking** tabs; check the Clarity dashboard for
recordings. Server exceptions show up under Error tracking with no `distinct_id`.
