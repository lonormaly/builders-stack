# @stack/mobile

A minimal, real **Expo** (SDK 57, React 19) app that renders a themed screen from
`@stack/ui`'s `tokens` — proof the design system is shared across web _and_ native.

> On SDK 53 (React 19) so the whole monorepo runs one React major — the web app (Next 15)
> is also React 19, so bun hoists a single React copy and nothing double-loads. `bun install`
> resolves React to 19.2.7 (Expo pins 19.0.0; the newer 19.x patch satisfies RN 0.79's
> `^19.0.0` peer — `expo install --check` may nudge you back to 19.0.0, which also works).

## Run

```bash
bun install            # from repo root
bun --filter @stack/mobile start   # or: cd apps/mobile && bun run start
```

Then press `i` (iOS simulator), `a` (Android), or `w` (web) in the Expo CLI, or scan
the QR code with Expo Go. It does **not** boot in Tilt — mobile is driven by the Expo dev
server, not a long-running HTTP service.

Scripts: `start`, `ios`, `android`, `web`, `typecheck`.

## Analytics (PostHog) — env-gated, same project as web + server

`App.tsx` wraps the app in `<PostHogProvider>` **only when `EXPO_PUBLIC_POSTHOG_KEY` is set** —
no key → PostHog never initializes and the app renders normally, the exact contract every other
integration in the stack follows (`@stack/analytics` on web, `posthog-node` on the server).

Point it at the **same PostHog project** as the rest of the stack so you get analytics parity
across every surface — one product, not a separate mobile silo. Expo inlines `EXPO_PUBLIC_*`
into the client bundle, so put them in `apps/mobile/.env` (git-ignored):

```
EXPO_PUBLIC_POSTHOG_KEY=phc_...          # same project key as NEXT_PUBLIC_POSTHOG_KEY
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   # optional; this is the default
```

> GDPR note: the web app gates PostHog behind a consent banner (`@stack/analytics`). This app
> is env-gated but has **no consent UI yet** — add one before shipping to EU users if you rely
> on consent as your legal basis. Autocapture is on; narrow it in the `<PostHogProvider>` options.

## OTA updates (EAS Update)

`expo-updates` + `eas.json` are wired so you can ship JS/asset fixes **without an app-store
round-trip**. It's inert until you connect an Expo project:

```bash
eas init                 # creates the project, writes expo.extra.eas.projectId + updates.url into app.json
eas update --branch production -m "fix: typo in onboarding"   # push an OTA update
```

`app.json` already sets `runtimeVersion.policy = "appVersion"` (a build only accepts OTA updates
built against its own runtime — bump the native `version` when you change native code so old
binaries don't pull incompatible JS). `eas.json`'s `channel` per profile links a build to its
update branch (development / preview / production).

## How the monorepo wiring works

`metro.config.js` is the finicky part. In a bun-workspace monorepo Metro must (1) watch the
whole repo and (2) resolve packages from both the app's and the root's `node_modules`:

```js
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [appNodeModules, rootNodeModules];
config.resolver.unstable_enablePackageExports = true; // so @stack/ui/tokens resolves
```

Expo SDK 52+ auto-detects the workspace, but this file sets it explicitly so the wiring is
visible and version-independent (per the Expo monorepo docs).

## Contract with `@stack/ui` (built in parallel)

- Imports `import { tokens } from "@stack/ui/tokens"` — a **pure** subpath: no React, no DOM,
  no shadcn component code (native can't bundle those). Keep the barrel (`@stack/ui`) for web.
- Colors are nested per theme: `tokens.colors.light.<role>` / `tokens.colors.dark.<role>`.
  This screen renders `colors.light`. Values are **hex** (RN's color parser can't read
  `oklch()`), which the lib already guarantees. Roles used: `background, foreground, card,
cardForeground, primary, primaryForeground, mutedForeground, border`.
