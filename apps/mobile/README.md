# @stack/mobile

A minimal, real **Expo** (SDK 53, React 19) app that renders a themed screen from
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
