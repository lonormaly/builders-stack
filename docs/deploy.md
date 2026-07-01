# Deploy

The README promises the stack **scales without moving**: `bun run dev` → Tilt → Docker → Kubernetes, same folders the whole way. This is the "→ Docker → k8s" half made real. You never restructure — you only add packaging under `infra/`.

> **Honesty first:** `scripts/deploy.sh` is an **echo-only scaffold**. It prints the exact commands a real deploy runs (build → push → migrate → roll out) but executes none of them — so you can read the shape before you wire in your own registry and cluster. This page is what those echoes become when you make them real.

## The path

```
infra/*.Dockerfile        one image per service (api, ai-worker, payment)
infra/docker-compose.yml  run the whole app in containers locally (--profile app)
infra/k8s/deployment.yaml  the production target — one Deployment per service
```

Only **services** get deployed (they have a URL / their own process): `api`, `payment`, `ai-worker`. Apps (`web`, `landing`) are Next.js — deploy those to Vercel/Cloudflare, or containerize them the same way. Libs are never deployed; they're compiled into whatever imports them.

## 1. Build the images

Each service has a Dockerfile under `infra/`. Build from the repo root (the build context is the whole monorepo so bun can resolve `@stack/*` workspaces):

```bash
TAG="$(git rev-parse --short HEAD)"
REGISTRY="ghcr.io/OWNER"   # your registry

for svc in api ai-worker payment; do
  docker build -f "infra/${svc}.Dockerfile" -t "${REGISTRY}/stack-${svc}:${TAG}" .
  docker push "${REGISTRY}/stack-${svc}:${TAG}"
done
```

## 2. Try it locally first — compose `--profile app`

Before shipping to a cluster, run the _containerized_ services locally against real Postgres + Redis. The compose file datastores are always on; the `app` profile adds the built service containers:

```bash
docker compose -f infra/docker-compose.yml up -d                    # just Postgres + Redis
docker compose -f infra/docker-compose.yml --profile app up --build # + api / payment / ai-worker
```

This is the same images k8s will run — if they boot here, they boot there.

## 3. Migrate the database

Run migrations once per deploy, before the new pods take traffic:

```bash
bun --filter @stack/db migrate
```

## 4. Roll out to Kubernetes

`infra/k8s/deployment.yaml` is a worked example for one service (`@stack/api`) — a `Deployment` with `readinessProbe`/`livenessProbe` on `/health` and env pulled from a `stack-secrets` Secret. Copy it per service, swap the image, and apply:

```bash
kubectl apply -f infra/k8s/deployment.yaml
kubectl rollout status deployment/stack-api
# subsequent deploys just move the image tag:
kubectl set image deployment/stack-api api="${REGISTRY}/stack-api:${TAG}"
```

## Frontend apps → Cloudflare Workers (OpenNext)

`apps/web` and `apps/landing` are Next.js — deploy them to **Cloudflare Workers** with the [OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare) (`@opennextjs/cloudflare`, 1.0 GA since Feb 2026; Next.js 14/15/16). This is also the quickest way to put the **landing page live** as a public demo.

From the app dir (e.g. `apps/landing`):

```bash
bun add @opennextjs/cloudflare && bun add -D wrangler
```

Add a per-app `wrangler.toml`: the `nodejs_compat` flag, a `compatibility_date` ≥ `2024-09-23`, a **KV** binding for the Next cache, and (optional) an **R2** bucket for large assets. Then:

```jsonc
// apps/landing/package.json
"cf:build":   "opennextjs-cloudflare build",
"cf:preview": "bun run cf:build && opennextjs-cloudflare preview",
"cf:deploy":  "bun run cf:build && wrangler deploy"
```

```bash
bun run cf:deploy       # → https://<worker>.workers.dev (or a custom domain)
```

Set `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` as Worker vars; pull secrets via Infisical's native Cloudflare connector (see below) rather than `wrangler secret put`. Prefer this over the older `next-on-pages` — OpenNext is the current, framework-native path.

## 5. Secrets — never hand-copied

Deploy-time secrets come from **[Infisical](secrets.md)**, not from files you copy into a platform. Its native Kubernetes operator syncs Infisical secrets straight into the k8s `Secret` (`stack-secrets`) that the Deployment references, so you edit a field in one UI and every environment picks it up. Full setup + the Cloudflare path: **[`docs/secrets.md`](./secrets.md)**.

## Making the scaffold real

To turn `scripts/deploy.sh <staging|prod>` from a dry run into an actual deploy, replace its `echo` lines with the commands above (steps 1–4) and set `REGISTRY` to your registry. Wire it to the Tilt `deploy:staging` button (already in `.devops/Tiltfile`) or to CI. Keep it thin — build, push, migrate, roll out. Everything it needs already lives in `infra/`.
