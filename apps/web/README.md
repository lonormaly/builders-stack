# @stack/web

Next.js 15 (App Router) flagship app. Renders the shared design system, talks to the API, and demos login.

## Run

```bash
bun install                      # from repo root — resolves the workspace
bun --filter @stack/web dev      # → http://localhost:3000
```

Or boot the whole stack (web + api + …) with `./tilt_up.sh` from the repo root.

Scripts: `dev` (port 3000), `build`, `start`, `typecheck`, `lint`.

## What it proves

| Route     | Proves                                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `/`       | The design system — several `@stack/ui` components + the `tokens` swatch row (same tokens native uses). Plus the live session card. |
| `/health` | Cross-role wiring — server-side `fetch` to `@stack/api`'s `/health`, rendered.                                                      |
| `/auth`   | Better Auth email/password sign-in + sign-up against `@stack/api`.                                                                  |

## How it's wired

- **Design system** — `import { Button, Card, Badge, Input, Label, tokens } from "@stack/ui"`. `next.config.ts` sets `transpilePackages: ["@stack/ui"]` so the lib compiles from TS source, no build step.
- **Tailwind v4** — theme lives in `app/globals.css` (`@import "tailwindcss"` + `@theme`). The `@source "../../../libs/ui/src"` line makes Tailwind scan the lib so utility classes used _inside_ `@stack/ui` components get generated. CSS variables here mirror the JS `tokens` export — one source of truth, two shapes (CSS for web, JS for native).
- **API** — `app/health/page.tsx` fetches `${API_URL}/health` (`API_URL` env, default `http://localhost:3001`), `force-dynamic` so it never fetches at build time.
- **Auth** — `app/auth/auth-client.ts` creates the Better Auth React client pointed at the API origin (`NEXT_PUBLIC_API_URL`, default `http://localhost:3001`) with `credentials: "include"` for the cross-origin session cookie.

## Contracts this app depends on (built in parallel)

**`@stack/ui`** must export (import by package name):

- Components: `Button` (`variant`: default/secondary/outline/ghost/destructive, `asChild`), `Badge` (`variant`: default/secondary/outline/destructive), `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `Input`, `Label` — i.e. canonical shadcn.
- `tokens`: a plain JS object with `colors.light` / `colors.dark` (hex values), `brand`, `spacing`, `radii`, `typography` — also exposed as the pure `@stack/ui/tokens` subpath for native.

**`@stack/api`** must serve, on `http://localhost:3001`:

- `GET /health` → JSON.
- Better Auth handler at `/api/auth/*`, with CORS allowing the web origin _with credentials_ and `http://localhost:3000` in `trustedOrigins`.

Env: copy repo-root `.env.example`; `API_URL` / `NEXT_PUBLIC_API_URL` override the `:3001` default.
