# Portless Integration

All served local Tilt roles use [Vercel Portless](https://github.com/vercel-labs/portless) for stable, named URLs instead of port numbers. No service pins a port — portless assigns one and proxies the named URL to it.

## Why Portless?

- **No port collisions** — multiple projects can run simultaneously (no fighting over 3000/3001).
- **Human-readable URLs** — `api.stack.localhost:1355` instead of `localhost:3001`.
- **Mirrors production** — subdomain-based routing like real environments, so cross-service auth cookies behave the same locally.

## Prerequisites

Install portless globally:

```bash
npm install -g portless
```

The portless proxy starts automatically on first use (port 1355). `./tilt_up.sh` checks that portless is on PATH and refuses to boot without it.

## Naming Convention

All served roles use project-scoped names: `<service>.stack`

| Role                             | URL                                     | Type                   |
| -------------------------------- | --------------------------------------- | ---------------------- |
| Web (`apps/web`)                 | `http://web.stack.localhost:1355`       | Bun / Next.js process  |
| Blog (`apps/blog`)               | `http://blog.stack.localhost:1355`      | Next.js (static / SSG) |
| API (`services/api`)             | `http://api.stack.localhost:1355`       | Bun process            |
| Payment (`services/payment`)     | `http://payment.stack.localhost:1355`   | Bun process            |
| Storybook (`libs/ui`)            | `http://storybook.stack.localhost:1355` | Storybook dev server   |
| AI Worker (`services/ai-worker`) | _none_ — background load, no URL        | plain `local_resource` |

The Tilt dashboard stays on `http://localhost:10380` (not proxied through portless).

## Gotchas — when you need a plain `localhost:port`

Portless routes are subdomains-with-a-port (`web.stack.localhost:1355`). Two things dislike that shape — both fixed by running the app directly on a pinned plain-localhost port:

- **HMR / WebSockets:** portless doesn't proxy WebSocket connections, so Next.js hot-reload won't connect through the portless URL (it retries in the console — expected). Edit-refresh works; for live HMR, run `PORT=3000 bun --filter @stack/web dev`.
- **Google (and strict) OAuth:** Google's loopback exception only accepts `localhost` / `127.0.0.1` — **not** `*.localhost` subdomains — so `web.stack.localhost:1355` is rejected as an authorized redirect URI. To test Google/social sign-in locally, run web (and landing) on a pinned port instead:

  ```bash
  PORT=3000 bun --filter @stack/web dev       # → http://localhost:3000 (bypasses portless)
  PORT=3002 bun --filter @stack/landing dev   # → http://localhost:3002
  ```

  Then point `BETTER_AUTH_URL` + `BETTER_AUTH_TRUSTED_ORIGINS` / `WEB_ORIGIN` at `http://localhost:3000`, and register `http://localhost:3000/api/auth/callback/<provider>` as an authorized redirect URI in the provider's console. (GitHub OAuth is lenient and works through the portless URL; Google is the strict one.)

## How It Works

### Bun / Next.js services (web, api, payment)

Portless wraps the dev command, auto-assigns a random `PORT`, and proxies through port 1355:

```bash
portless api.stack bun --filter @stack/api dev
# Portless injects PORT=4xxx, proxies api.stack.localhost:1355 → localhost:4xxx
```

The service must respect `process.env.PORT`:

- `services/api` and `services/payment` use `Number(process.env.PORT) || <fallback>` in their `Bun.serve` default export.
- `apps/web` runs `next dev` (no `--port`) — Next.js binds `PORT` automatically.

### Storybook (libs/ui)

Storybook binds the port from its `-p` flag, so `@stack/ui`'s script passes portless's injected `PORT` straight through:

```json
"storybook": "storybook dev -p ${PORT:-6006} --no-open"
```

`portless storybook.stack bun --filter @stack/ui storybook` then proxies `storybook.stack.localhost:1355` → that port. Standalone (no portless) it falls back to 6006.

### Docker containers (if you add one)

Containers that portless should proxy use a dynamic host port (set the port env var to `0` so Docker assigns one), detect it, and pass it via `--app-port`:

```bash
# 1. Start the container with its port var = 0 → Docker picks a random host port
# 2. Detect it
APP_PORT=$(docker compose port <svc> <container-port> | cut -d: -f2)
# 3. Proxy to it
portless <svc>.stack --app-port $APP_PORT docker compose logs -f <svc>
```

Use env vars with defaults in `docker-compose.yml` so standalone usage still works:

```yaml
adminer:
  ports:
    - "${ADMINER_PORT:-8090}:8080" # fixed standalone, dynamic under Tilt
```

## Route Lifecycle

- **Wrapped commands** (all served roles): the route exists while the process runs. When Tilt stops, the process dies and the route auto-cleans.
- **Portless proxy** (port 1355): a shared daemon across all projects. Never stopped by Tilt — stop it manually with `portless proxy stop`.

## Adding a New Served Role

1. **Bun / Next process**: wrap the serve_cmd with `portless <name>.stack <cmd>`, and make sure the process reads `process.env.PORT`.
2. **Docker container**: use an env var for the port in `docker-compose.yml`, detect it with `docker compose port`, wrap with `portless <name>.stack --app-port $PORT ...`.
3. **No URL** (background worker): plain `local_resource`, no portless — mirror `ai-worker`.
4. Add the new URL to the table above. The name must be project-scoped: `<name>.stack`.
