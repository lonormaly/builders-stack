# `ops/` — the private, non-shipped bucket

**Not code. Not in the build graph.** `ops/` holds the founder-only material every real
project accumulates but never ships: **strategy, brand assets, and the recipes that make
them.** It is **excluded from `workspaces` + Nx** (nothing here is a project), and in an
open-core split it lives in your **private** repo — never the public one.

It's the "how we win / how we make our stuff" bucket — as opposed to
`apps/`·`services/`·`libs/`·`packages/`, which are "how the product works." So it is **not a
taxonomy peer** of those four; it's a non-code top-level sibling, like `docs/` or `scripts/`.

## What lives here

| Folder | What it is | Examples |
|---|---|---|
| `ops/docs/` | **Strategy & go-to-market** — the playbook, not the product | launch plan (Show HN · Product Hunt · X · LinkedIn · Reddit), copy-bank, pricing rationale, roadmap + moat / feature-design docs |
| `ops/brand/` | **Generated brand assets** — the binary *outputs* of the brand pipelines | logos, avatars, mascot images, marketing / hero videos, social art, OG images |
| `ops/skills/` | **Brand-recipe skills** — the runbooks + scripts that *generate* the above | e.g. `write-a-blog-post`, `generate-mascot-images`, `animate-mascot` (a `SKILL.md` + gen scripts encoding your voice + asset pipeline) |

Add sub-folders as the project needs them (`ops/research/`, `ops/legal/`, …). The only rule
is that it stays **non-code, private, and out of the build graph.**

## Rules

- **Never imported by code.** No `app` / `service` / `lib` / `package` references `ops/*` — it
  isn't a workspace, and Nx doesn't see it.
- **Private in open-core.** If the repo is public, `ops/` moves to your private companion repo
  (or the whole repo is private). Don't ship strategy or unreleased brand work.
- **Assets are outputs; recipes are skills.** A generated `.png`/`.mp4` goes in `ops/brand/`;
  the script that produced it goes in `ops/skills/<name>/scripts/` — keep the recipe with the
  skill so the asset is reproducible.
