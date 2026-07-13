# `packages/` — the 4th bucket: what you ship

`apps/` · `services/` · `libs/` are **what you RUN** — sorted by _who they're
served to_ (your humans, your machines, your own code). `packages/` is the odd one
out: **what you SHIP** — a built, distributable artifact exposed to people _outside_
your system. npm SDKs, embeddable widgets, and CLIs live here.

> Those four buckets are **what the system _is_**. There's a fifth top-level folder,
> [`ops/`](../ops/README.md), for **how you _operate_ it** (deploy · db · secrets ·
> runbooks · ci) — but it's **not a code bucket**: it isn't a workspace, Nx doesn't
> see it, and nothing imports from it. `packages/` is the last of the four _code_
> buckets; `ops/` is a non-code sibling like `docs/`.

The worked example is [`packages/widget`](../packages/widget) (`@stack/widget`): an
embeddable feedback widget that self-mounts into any third-party page via a single
`<script>` tag, with an IIFE build for `<script src>` and an ESM build for npm.

## Why it's its own bucket (not a `lib`)

A `lib` is **shared code your own apps/services consume** — never served. A package is
the inverse: **nothing inside the repo imports it**; it's built and shipped out. That
different _exposure_ is the whole reason for a fourth folder.

## The boundary — `type:package`

Every package is tagged `type:package` in its `package.json` (`nx.tags`). Nx's
`@nx/enforce-module-boundaries` enforces two halves (see [`docs/stack/architecture.md`](./stack/architecture.md)):

- **A package may depend on `type:lib` only** — not apps, services, or other packages.
  (`{ sourceTag: "type:package", onlyDependOnLibsWithTags: ["type:lib"] }`.)
- **A package is terminal** — no other bucket lists `type:package` in its allowed
  tags, so an app/service/lib that imports `@stack/widget` **fails `lint`**.

Prove it yourself: `packages/widget` imports `@stack/ui/tokens` (a legal
`package → lib` edge) and lints clean; add an import of a service, or import
`@stack/widget` from an app, and `bunx nx run-many -t lint` rejects it.

## Adding a `packages/*` distributable — the recipe

1. **Create the folder** — `packages/<name>/`. Root `package.json` `workspaces`
   already includes `"packages/*"`, so `bun install` links it.
2. **`package.json`** — `"name": "@stack/<name>"`, `"nx": { "tags": ["type:package"] }`,
   `"type": "module"`, and the distribution hints: `exports`, `files`, `version`,
   `publishConfig`. Depend on `libs/*` only.
3. **Build to `dist/`** — a `build` script producing your outputs. For an embeddable
   widget that's **two**: an **IIFE** (`esbuild src/embed.ts --bundle --format=iife
--minify`) for a `<script src>` on any site, and an **ESM** build
   (`--format=esm`) for npm consumers. A CLI/SDK may need only one. `dist/` is
   gitignored — it's a build artifact.
4. **`tsconfig.base.json` `paths`** — add `"@stack/<name>": ["./packages/<name>/src/index.ts"]`
   so Nx can resolve it and enforce the boundary.
5. **No Tiltfile change** — a package is built and shipped, not a running dev server.
6. **Version + publish** — bump `version`, drop `private`, `bun publish`. Add
   `tsc --emitDeclarationOnly` to the build to emit `dist/*.d.ts` for typed consumers.

Ship nothing external? **Delete the whole `packages/` folder** and drop `"packages/*"`
from the root workspaces + the path from `tsconfig.base.json`. The other three buckets
stand alone.
