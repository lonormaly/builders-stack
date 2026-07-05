# Secrets in builders-stack

Never commit real secrets. `.env.example` documents every key; `.env.local` (git-ignored) holds your local fill-ins. As you grow, move the source of truth to Infisical.

> **Provisioning the keys — [Ringtail](https://github.com/ringtailkeys/ringtail).** The operate-layer front door for secrets is [`ops/secrets/`](../ops/secrets/), and it points to one tool: Ringtail. It reads this repo's `.env.example` as the manifest, raids each provider's token page via their official APIs, and **fans every key into `.env.local` (local) + Infisical (dev/staging/prod)** — exactly the two homes described below. One human "allow" per provider, then zero-touch; your agent orchestrates and **never sees a value**. Run `npx ringtail` (or `ops/secrets/bootstrap.sh`). The rest of this page is the model Ringtail provisions _into_.

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

**Non-interactive `infisical run` (CI / deploy)** — `infisical login` is for humans; CI and deploy jobs authenticate with a **Machine Identity** (Universal Auth) via three env vars:

- **`INFISICAL_PROJECT_ID`** — Infisical → your project → _Settings → Project ID_.
- **`INFISICAL_CLIENT_ID`** / **`INFISICAL_CLIENT_SECRET`** — Infisical → _Organization → Access Control → Machine Identities_ → create one with Universal Auth; it hands you the client id + secret.

Local dev doesn't need these — it uses `.env.local` (see §1); the machine identity is only for team/CI/prod secret injection. Infisical's free tier covers a small team's secrets + members.

## 3. Deploy — native integrations (easy install)

Infisical injects secrets at deploy time via **native** integrations, so you never hand-copy secrets into a platform:

- **Kubernetes** — the [Infisical Secrets Operator / CSI](https://infisical.com/docs/integrations/platforms/kubernetes) syncs Infisical secrets straight into k8s `Secret`s (pairs with `infra/k8s`).
- **Cloudflare Pages / Workers** — the [native Cloudflare connector](https://infisical.com/docs/integrations/cloud/cloudflare-pages) pushes secrets to your Pages/Workers project (dev/staging/prod → matching Infisical environments).

## Rules

- **Bindings are not secrets** (Queue/DO/R2, k8s ConfigMaps) — they live in platform config, never in Infisical.
- One source of truth per environment; prefer the Infisical sync over per-platform `secret put` (that drifts).
