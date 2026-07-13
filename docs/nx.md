# Task orchestration — Nx

Nx layers **on top of** the existing bun-workspace + Tilt setup. It does not replace
either. Keep this division in your head:

|          | Owns                | Answers                                            | Command        |
| -------- | ------------------- | -------------------------------------------------- | -------------- |
| **Tilt** | the dev **runtime** | _what's running right now?_                        | `./tilt_up.sh` |
| **Nx**   | the task **graph**  | _what do I build / test / lint, and what changed?_ | `nx …`         |

Dev servers stay on `./tilt_up.sh` — they are **never** routed through Nx. Nx runs the
batch, cacheable, CI-shaped tasks: `build`, `typecheck`, `lint`, `test`. Two different
questions, two different tools, no overlap.

## What Nx buys here

Framing follows [monorepo.tools](https://monorepo.tools):

- **Local caching** — every `build`/`typecheck`/`lint`/`test` result is cached by input
  hash. Change one lib, only its dependents re-run; everything else replays instantly.
- **Remote caching** — the same cache, shared across machines and CI. Add it later with
  `nx connect` (Nx Cloud) — no config change needed here.
- **Distributed task execution** — Nx Cloud can fan a single `nx affected` run across
  multiple CI agents. Opt-in, same targets.
- **Affected detection** — `nx affected` diffs the git range and runs tasks **only** for
  the changed projects and their dependents. This is what makes PR CI fast.
- **Task splitting** — large targets can be sharded into parallel atomized tasks.
- **Module-boundary enforcement** — the repo's two laws, enforced as lint errors (below).
- **Generators** — scaffold a new lib/service/app that already follows the conventions
  (below).

The last two are the ones that carry this repo's thesis (a structure your agent can't
drift out of), so they get their own sections.

## Caching config (`nx.json`)

`targetDefaults` make the four batch targets cacheable with correct inputs/outputs:

- Named inputs `default` + `production` — `production` excludes tests/stories/storybook
  so a test-only change never busts a `build` cache.
- `build` `dependsOn: ["^build"]` — a project builds only after its dependencies do.
- `sharedGlobals` (`tsconfig.base.json`, `eslint.config.mjs`) invalidate everything when
  a root config changes.

Targets themselves are **inferred from each project's `package.json` scripts** — no
per-project target duplication. `nx run @stack/api:typecheck` runs that package's
`typecheck` script, cached.

## The two laws, enforced (`eslint.config.mjs`)

`@nx/enforce-module-boundaries` turns the [architecture](./stack/architecture.md) rules from
review conventions into lint errors. Every project is tagged (`nx.tags` in its
`package.json`):

| Folder      | Tag            | May depend on                                   |
| ----------- | -------------- | ----------------------------------------------- |
| `apps/`     | `type:app`     | `type:lib`, `type:service` — **not other apps** |
| `services/` | `type:service` | `type:lib`, `type:service`                      |
| `libs/`     | `type:lib`     | `type:lib` only                                 |

A `type:lib` that imports from an app or service is a **lint error**, not a review nit.
Because apps/services expose no importable public door, the only way to attempt an upward
import is a relative/absolute path — which the same rule also blocks (`Projects cannot be
imported by a relative or absolute path`). Deep imports past a lib's barrel are caught too.

```bash
nx lint @stack/db          # lints one project against the boundary rules
nx run-many -t lint        # all projects
```

## Contracts — one API shape, both sides typed

`@stack/api-types` is a `type:lib` holding the API's Zod request/response schemas and their
inferred types. It's the textbook payoff of the boundary rules: **a lib that a service and
an app both depend on** — a downward dependency for each, never an upward import.

- `services/api` imports the **schemas** to validate requests + generate the OpenAPI doc.
- `apps/web` imports the inferred **types** (`import type { Post }`) for a type-safe fetch —
  `import type` erases at build, so the browser never pulls zod from the contract lib.

One schema, zero drift: change the contract once and both sides see it.

**End-to-end RPC (optional).** `services/api` also exports `type AppType = typeof app`. Pair
it with Hono's client for a fully-typed client — every route, param, and response typed with
no codegen:

```ts
// apps/web
import { hc } from "hono/client";
import type { AppType } from "@stack/api"; // type-only — no runtime dep on the service
const api = hc<AppType>(process.env.NEXT_PUBLIC_API_URL!);
const res = await api.posts.$get(); // typed route + typed response
```

Use `@stack/api-types` for plain typed `fetch` (the default here); reach for `hc<AppType>()`
when you want the whole surface typed through one client.

## Generators — scaffold in-convention

Generators create a new workspace member that already has the right tag, `@stack/*` import
path, `src/index.ts` barrel, and a `project.json` — so a new lib can't be born breaking
the boundary rules.

```bash
# A new lib  (type:lib, single public door)
nx g @nx/js:lib payments-core \
  --directory=libs/payments-core \
  --importPath=@stack/payments-core \
  --tags=type:lib --bundler=none --unitTestRunner=none

# A new service  (type:service — has a URL / own deploy)
nx g @nx/node:app notifications \
  --directory=services/notifications \
  --tags=type:service
# then point its start script at bun+hono and add it to .devops/Tiltfile

# A new app  (type:app — what humans see)
nx g @nx/next:app admin \
  --directory=apps/admin \
  --tags=type:app
```

`--dry-run` shows the file list without writing. After generating a **service or app**,
wire its dev command into `.devops/Tiltfile` (via Portless) — Nx scaffolds the code, Tilt
owns running it.

> The generators are stock Nx; they also touch `tsconfig.base.json` (adds the path) and
> may drop a `.prettierrc`. Review the diff and keep it aligned with the conventions in
> [`CLAUDE.md`](../CLAUDE.md).

## Everyday commands

| Command                                         | Does                                                      |
| ----------------------------------------------- | --------------------------------------------------------- |
| `bun run graph`                                 | open the interactive project graph (`nx graph`)           |
| `bun run check`                                 | `nx run-many -t typecheck lint` — the pre-push gate       |
| `bun run typecheck` / `lint` / `build` / `test` | run that target across all projects                       |
| `bun run affected`                              | `nx affected -t lint typecheck build` — only what changed |
| `nx show projects`                              | list all projects                                         |
| `nx run @stack/api:typecheck`                   | one target, one project                                   |
| `nx reset`                                      | clear the local cache                                     |

## CI

`.github/workflows/ci.yml` runs `nx affected -t lint typecheck build`.
[`nrwl/nx-set-shas`](https://github.com/nrwl/nx-set-shas) derives the base/head SHAs
(PR → merge-base with the target branch; push → last successful commit), so a PR only
runs the projects it actually touched. bun stays the package manager; Nx is the runner.
