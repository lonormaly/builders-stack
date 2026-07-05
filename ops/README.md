# `ops/` — how you **operate** the stack

`apps/` · `services/` · `libs/` · `packages/` are **what the system _is_** — the code you run
and ship. `ops/` is the **fifth bucket: how you _operate_ it** — the deploy scripts, database
lifecycle, secret provisioning, incident runbooks, and a local mirror of CI. It's the
**outermost layer**: it reaches _down_ into the code to drive it, and **nothing in the code ever
reaches back up into `ops/`.**

It is **not a workspace** (absent from `package.json → workspaces`) and **Nx doesn't see it** —
so there's no build/lint/typecheck target here and no way for a boundary to be violated. Like
`docs/` and `scripts/`, it's a **non-code, top-level sibling**, not a taxonomy peer of the four
code buckets.

## What lives here

| Folder                     | What it is                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [`deploy/`](./deploy/)     | `deploy-dev.sh` + `deploy-prod.sh` — ship the built images to an environment (front door over `scripts/deploy.sh` + `infra/`). |
| [`db/`](./db/)             | `migrate.sh` + `seed.ts` — thin wrappers over `@stack/db` (Drizzle) for the DB lifecycle.                                      |
| [`secrets/`](./secrets/)   | Provision env/secrets with **[Ringtail](https://github.com/ringtailkeys/ringtail)** — and nothing else.                        |
| [`runbooks/`](./runbooks/) | The 3am docs: `rotate-a-key.md` · `rollback.md` · `restore-db.md`.                                                             |
| [`ci/`](./ci/)             | `local-ci.sh` — runs the exact gates `.github/workflows/ci.yml` runs, before you push.                                         |

## The one rule — `ops/` is the top of the graph

- **Nothing imports _from_ `ops/`.** No `app` / `service` / `lib` / `package` references
  `ops/*`. It isn't a workspace, so `@stack/*` resolution can't even reach it. `ops/` may
  reference the code (it deploys and seeds it); the code may never reference `ops/`.
- **Operate-only.** Deploy · DB · secrets · runbooks · CI. Not code, not brand, not strategy.
  Brand assets + voice live in [`docs/brand/`](../docs/brand/); product code lives in the four
  buckets.
- **Secrets go through Ringtail.** `ops/secrets/` is a pointer to Ringtail — the OSS,
  agent-orchestrated key-provisioning tool that reads `.env.example` and fans each key into
  `.env.local` + Infisical. Don't build a competing secret store here. See
  [`secrets/README.md`](./secrets/README.md).

> **Consolidation intent.** `infra/` (Dockerfiles · compose · k8s) and `scripts/` (`deploy.sh`,
> `seed.sh`, …) are **operate-adjacent** and slated to move under `ops/` in a follow-up. They're
> left in place for now (too many references to move safely in one pass); `ops/deploy` and
> `ops/db` already front them as the single entrypoint.
