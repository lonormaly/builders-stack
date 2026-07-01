# Secrets in builders-stack

Never commit real secrets. `.env.example` documents every key; `.env.local` (git-ignored) holds your local fill-ins. As you grow, move the source of truth to Infisical.

## 1. Local dev — `.env.local`

Copy `.env.example` → `.env.local`, fill it in. `./tilt_up.sh` sources it. Keep it clean — **strip inline comments** (an unstripped comment can corrupt a value, e.g. a client id).

## 2. Team + prod — [Infisical](https://infisical.com) (recommended)

Once more than one person or machine needs the secrets, make **Infisical** (open-source secrets manager) the single source of truth — no secret ever lives in a committed file, and every environment (dev/staging/prod) pulls from one place.

Inject secrets into any process without a `.env` file:

```bash
infisical login
infisical run --env=dev -- ./tilt_up.sh                 # whole stack gets the secrets
infisical run --env=dev -- bun --filter @stack/api dev  # or a single service
```

Or fetch at boot with the SDK (`@infisical/sdk`). Day-to-day you edit a field in the Infisical UI — nothing to redeploy locally. _(Pattern from Laor: Infisical is the source of truth; `.env.local` is only local fill-ins; a `scripts/infisical-push.sh` is seed/recovery only, not the everyday path.)_

## 3. Deploy — native integrations (easy install)

Infisical injects secrets at deploy time via **native** integrations, so you never hand-copy secrets into a platform:

- **Kubernetes** — the [Infisical Secrets Operator / CSI](https://infisical.com/docs/integrations/platforms/kubernetes) syncs Infisical secrets straight into k8s `Secret`s (pairs with `infra/k8s`).
- **Cloudflare Pages / Workers** — the [native Cloudflare connector](https://infisical.com/docs/integrations/cloud/cloudflare-pages) pushes secrets to your Pages/Workers project (dev/staging/prod → matching Infisical environments).

## Rules

- **Bindings are not secrets** (Queue/DO/R2, k8s ConfigMaps) — they live in platform config, never in Infisical.
- One source of truth per environment; prefer the Infisical sync over per-platform `secret put` (that drifts).
