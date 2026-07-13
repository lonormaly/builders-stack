# Make it yours

**The structure is the product. The packages are worked examples you gut.**

Everything under `apps/`, `services/`, and `libs/` is a demonstration that the pattern holds end to end — real auth, real payments, real AI, real email, all wired the right way. You keep the three folders and the three laws (`no-upward-import` · `one-public-door` · `by-feature-not-layer`); you **delete** the examples you don't need and rename the scope to your company. What's left is a repo shaped correctly with only your code in it.

This guide is the clean-deletion checklist for the three biggest examples, plus the `@stack/*` → `@yourco/*` rename. The pattern generalizes: every package leaves a trail in the same handful of places.

## The five places a package leaves a trail

Deleting a package cleanly means removing its footprint from each of these. Learn the list once and every deletion is mechanical:

1. **The directory** — `rm -rf apps/mobile` (etc).
2. **`.devops/Tiltfile`** — the served roles each have a `local_resource(...)` block. (Libs and Expo apps have none.)
3. **`.env.example`** — the keys that integration reads.
4. **`.mcp.json` / deps** — any MCP server or dependency only that package used.
5. **`tsconfig.base.json` `paths`** — the `@stack/<name>` mapping (this is what gives the Nx boundary rule its teeth; a stale entry is harmless but dishonest).

Then `bun install` to prune the lockfile, and `bunx nx run-many -t typecheck` to prove nothing dangled.

---

## Delete `apps/mobile` (the Expo/React Native example)

The simplest — mobile has **no Tilt resource** (Expo runs its own dev server) and no env keys of its own.

1. `rm -rf apps/mobile`
2. `.devops/Tiltfile` — nothing (mobile was never in it).
3. `tsconfig.base.json` — remove the `"@stack/mobile": [...]` line from `paths`.
4. `package.json` — the `overrides` block pinning `@types/react` to `~19.0.x` **exists only for mobile** (React Native 0.79's bundled JSX types reject `@types/react` 19.2.x; read the `$comment`). With mobile gone you can drop the `overrides` block and its `$comment`, letting web/ui float to `^19`. Optional — leaving the pin does no harm.
5. `bun install` → `bunx nx run-many -t typecheck`.

---

## Delete `services/payment` (the Creem / Merchant-of-Record example)

A served service, so it has the full footprint.

1. `rm -rf services/payment infra/payment.Dockerfile api-collection/payment`
2. **`.devops/Tiltfile`** — delete the entire `local_resource('payment', …)` block (the one with `payment.stack` + the `/health` link).
3. **`.env.example`** — remove `CREEM_API_KEY` and `CREEM_WEBHOOK_SECRET` (and their comment block).
4. **`infra/docker-compose.yml`** — remove the `payment:` service under `--profile app`.
5. **`scripts/deploy.sh`** — drop `payment` from the `SERVICES=(api ai-worker payment)` array.
6. **`api-collection/environments/local.bru`** — remove any `payment`-scoped variables.
7. **`tsconfig.base.json`** — remove the `"@stack/payment": [...]` line.
8. Grep for stragglers: `grep -rn "payment\|CREEM" --exclude-dir=node_modules .` — clean up README/docs mentions.
9. `bun install` → `bunx nx run-many -t typecheck`.

No other package imports `@stack/payment` (it's a standalone service), so nothing downstream breaks.

---

## Delete `libs/ai` (the model-provider example)

A lib — **no Tilt resource of its own** — but it has **consumers**, so this is the one deletion with a downstream. `@stack/ai` is imported by:

- `services/ai-worker` (the whole point of the worker), and
- `apps/landing/app/llms.ts`.

So "delete `libs/ai`" really means "delete `libs/ai` **and** the code that consumes it." Decide first: are you dropping AI entirely, or swapping the provider? If swapping, keep `libs/ai` and edit `libs/ai/src/providers.ts` instead — don't delete.

To drop AI entirely:

1. `rm -rf libs/ai`
2. `rm -rf services/ai-worker infra/ai-worker.Dockerfile` — the worker exists to run AI jobs; without `@stack/ai` it has no purpose.
3. **`.devops/Tiltfile`** — delete the `local_resource('ai-worker', …)` block.
4. **`.env.example`** — remove `AI_API_KEY` (and its comment block).
5. **`infra/docker-compose.yml`** — remove the `ai-worker:` service (and the `redis:` service if nothing else uses the queue).
6. **`scripts/deploy.sh`** — drop `ai-worker` from the `SERVICES` array.
7. **`apps/landing/app/llms.ts`** — remove the `@stack/ai` import / usage (or delete the file if it's AI-only).
8. **`.mcp.json`** — no AI-specific server ships (context7/postgres/filesystem/mobbin are unrelated); nothing to remove.
9. **`tsconfig.base.json`** — remove the `"@stack/ai"` **and** `"@stack/ai-worker"` lines.
10. `bun install` → `bunx nx run-many -t typecheck`.

---

## Adding a `packages/*` distributable (the 4th bucket)

`apps`/`services`/`libs` are what you **run**; `packages/*` is what you **ship** —
a distributable served to third parties (npm SDK, embeddable widget, CLI), tagged
`type:package`, depending on `libs/*` only, and **terminal** (nothing internal
imports it). The template ships one worked example, `packages/widget` (`@stack/widget`).

- **Add one:** create `packages/<name>/`, tag it `type:package`, give it a `build`
  script that emits to `dist/` (IIFE for `<script src>` + ESM for npm), add the
  `@stack/<name>` path to `tsconfig.base.json`, version + publish. No Tiltfile
  change (it's built, not served). Full recipe: [`docs/packages.md`](../packages.md).
- **Delete it** (you distribute nothing — the common case): `rm -rf packages`,
  drop `"packages/*"` from the root `package.json` `workspaces`, and remove the
  `"@stack/widget"` line from `tsconfig.base.json` `paths`. Same five-places trail
  as any package; then `bun install` → `bunx nx run-many -t typecheck`.

## Rename `@stack/*` → `@yourco/*`

`@stack` is a placeholder scope. Make it yours in one sweep:

1. **Package names** — the `"name"` field in every `apps/*`, `services/*`, `libs/*` `package.json`.
2. **`tsconfig.base.json` `paths`** — the keys (`"@stack/db"` → `"@yourco/db"`).
3. **Every import** — `from "@stack/…"` across all source.
4. **`.devops/Tiltfile`** — the `bun --filter @stack/<x>` targets.
5. **Docs** — README, `docs/*`, `AGENTS.md`, `CLAUDE.md`.

A single sweep covers all of it (macOS `sed`; on Linux use `sed -i`):

```bash
grep -rl "@stack/" --exclude-dir=node_modules --exclude-dir=.git . \
  | xargs sed -i '' 's/@stack\//@yourco\//g'
bun install
bunx nx run-many -t typecheck   # prove the rename is total
```

Because every lib has **one public door** and is imported **by package name** (never a deep path), the rename is a flat find-and-replace — there are no scattered internal paths to chase. That's the boundary thesis paying off: a clean seam is a cheap rename.

## Strip the template's explainer docs

`docs/stack/` (this folder) explains how the **template** works — the taxonomy,
the free-tier picks, the migration path. It's reference for _you_, not history
your product needs to carry. Once you've made the repo yours, drop it from your
fork's git history while keeping the files on disk:

```sh
git rm -r --cached docs/stack && echo 'docs/stack/' >> .gitignore
```

The files stay right where they are locally — `--cached` only removes them from
the index — but they stop being tracked, so they won't show up in your fork's
history or diffs. Delete the folder outright (`git rm -r docs/stack`) if you don't
want it around at all.

**One loose end this leaves — for the agent running this step:** other tracked
files still link into `docs/stack/` (README, CLAUDE.md, AGENTS.md, CONTRIBUTING,
SECURITY, a few `# see docs/stack/…` code comments). After stripping, those point
at files that are no longer in the repo's history — fine for you locally (the files
are still on disk), but a teammate who clones your stripped repo gets dead links.
So once you've stripped, **grep for the leftover references and clean them up as
fits each file** — you don't need a rigid script:

```sh
git grep -l "docs/stack/" -- ':!docs/stack'
```

- **Front-door files** (README, CLAUDE.md, AGENTS.md, CONTRIBUTING, SECURITY) you're
  rewriting for your product anyway — drop or repoint the `docs/stack` links as you do.
- **Incidental code comments** (`.env.example`, `.tool-versions`, `eslint.config.mjs`,
  `libs/ai/README.md`, …) — just delete the now-stale `see docs/stack/…` pointer.

Handle it however you see fit; the point is to not leave dangling references behind.
