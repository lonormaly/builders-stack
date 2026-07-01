---
name: add-a-service
description: Scaffold a new service under services/ in the builders-stack monorepo. Use when something needs its own URL, port, or independent deploy (an HTTP API, a webhook receiver, a background worker). Covers the package.json, the Hono entrypoint, reading config from env, wiring it into the Tiltfile as a local_resource, and adding a Dockerfile under infra/.
---

# Add a service

A `services/*` package is **anything with a URL or its own deploy** — an HTTP server, a webhook receiver, or a background worker (which has no URL but still runs as its own process). Use this when a new surface needs to run independently.

## When to use

- New HTTP endpoint group that deserves its own process/deploy → new service.
- New background consumer (queue worker, cron) → new service (no URL, still a Tilt resource).
- **Not** for shared logic with no runtime of its own — that's a `lib`.

## Steps

1. **Name it.** `services/<name>`, package `@stack/<name>`. **No pinned port** — served roles run behind Portless at `<name>.stack.localhost:1355` (Portless injects a random `PORT`). See `docs/portless.md`.

2. **Files:**

   ```
   services/<name>/
   ├── package.json
   ├── tsconfig.json
   └── src/
       ├── index.ts        # entrypoint: start the server / worker
       └── <feature>/      # organize BY FEATURE, not by layer
   ```

3. **`package.json`** — a `dev` script Tilt will call:

   ```json
   {
     "name": "@stack/<name>",
     "private": true,
     "type": "module",
     "scripts": {
       "dev": "bun --hot src/index.ts",
       "start": "bun src/index.ts",
       "typecheck": "tsc --noEmit"
     }
   }
   ```

4. **`tsconfig.json`:** `{ "extends": "../../tsconfig.base.json", "include": ["src"] }`

5. **`src/index.ts`** — Hono for HTTP; read the port from `process.env.PORT` (Portless injects it — never hardcode). Always expose `/health`:

   ```ts
   import { Hono } from "hono";
   const app = new Hono();
   app.get("/health", (c) => c.json({ ok: true }));
   const port = Number(process.env.PORT ?? 3003); // fallback only for standalone runs
   export default { port, fetch: app.fetch };
   ```

   For a **background worker** there's no server — just start the consumer loop and log readiness. No `/health`, no port (no Portless wrapper either — see ai-worker in the Tiltfile).

6. **Persistence via `@stack/db` only.** Payments via `@stack/payment` only. Never import another service's internals — talk over HTTP.

7. **Wire it into `.devops/Tiltfile`** (the runtime manifest — this is required, not optional). Wrap served roles with the `portless_cmd` helper so they get a stable named URL; a background worker skips Portless:

   ```python
   # served role — gets <name>.stack.localhost:1355 via portless
   local_resource('<name>',
     serve_cmd='cd ' + REPO_ROOT + ' && ' + ENV_LOCAL + portless_cmd(
       '<name>.stack ' + BUN + ' --filter @stack/<name> dev',
       health_url=PORTLESS_PROXY.format('<name>') + '/health'),
     links=[PORTLESS_PROXY.format('<name>') + '/health'],
     labels=['services'])
   ```

8. **Add a Dockerfile** at `infra/<name>.Dockerfile` (copy the pattern from `infra/api.Dockerfile`). If it needs to run in compose/k8s, add it there too.

9. **Add its env vars** to `.env.example` with safe local defaults.

## Verify

`./tilt_up.sh` shows the new resource green in the dashboard (`localhost:10380`); `curl http://<name>.stack.localhost:1355/health` returns `{ "ok": true }` (skip for a worker — check its log line instead). `bun run typecheck` passes.
