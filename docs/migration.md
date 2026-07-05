# Migrate an existing project in

**The taxonomy is a target shape, not a greenfield tax.** You don't need a fresh clone to adopt it — you can move an existing codebase into `apps/` · `services/` · `libs/` one role at a time, keeping the build green between moves. This is the complement to [`make-it-yours.md`](./make-it-yours.md): that guide **guts** the example packages you don't need; this one **brings your own code in**.

The target you're migrating **toward** is the three folders and the three laws:

- **`apps/`** — served to humans (a UI). `apps/web`, `apps/landing`, `apps/mobile`.
- **`services/`** — served to machines (a URL, a queue, its own deploy). `services/api`, `services/ai-worker`, `services/payment`.
- **`libs/`** — served to no one, only imported. `libs/db`, `libs/auth`, `libs/ui`, `libs/config`, `libs/api-types`, …

The three laws are the invariants you converge on as you move:

1. **No upward import** — dependencies point down only (`apps → services → libs`). A lib never imports a service or an app.
2. **One public door** — each lib exposes a single `src/index.ts`, mapped in `tsconfig.base.json`. Callers import `@stack/db`, never `@stack/db/src/internal/…`.
3. **By feature, not by layer** — inside a package, group by what the code does (`billing/` owns its logic + types + tests), not by file kind (`controllers/`, `models/`).

In every path below the sorting question is the same one that places any file on the first pass: **is it served, and to whom?** Served to a human → `apps/`. Served to another program → `services/`. Never served → `libs/`.

## The mechanical move (every extraction, same five touches)

Pulling a chunk of existing code into a new workspace package is the same recipe every time. Learn it once; the four paths below are just this loop applied to different starting shapes.

1. **Create the folder** and move the files. e.g. your `lib/db.ts` + `schema.ts` → `libs/db/src/`.
2. **Give it a public door** — a `libs/db/src/index.ts` barrel that re-exports the package's surface. Nothing outside imports past it.
3. **Name it** in its `package.json`: `"name": "@stack/db"`, and declare the door in `exports`:
   ```jsonc
   {
     "name": "@stack/db",
     "exports": { ".": "./src/index.ts" },
   }
   ```
4. **Map the path** in `tsconfig.base.json` — the `./`-prefixed entry (there's no `baseUrl`; a bare `libs/…` throws TS5090, and Nx needs this path to resolve `@stack/*` for the boundary rule):
   ```jsonc
   "paths": { "@stack/db": ["./libs/db/src/index.ts"] }
   ```
5. **Tag it** for the boundary rule — `nx.tags` in the same `package.json`:
   ```jsonc
   { "nx": { "tags": ["type:lib"] } } // or type:service / type:app
   ```

Then rewrite the imports at the call sites: `../../lib/db` becomes `@stack/db`. Because everything now enters through one door, that's a flat find-and-replace, not a path-chasing exercise.

**If the thing is served** (a service or an app, not a lib), one more touch: wire its dev command into **`.devops/Tiltfile`** behind portless, and have it read `process.env.PORT` (never pin a port):

```python
portless_cmd("api", "bun --filter @stack/api dev", port_env="PORT")
```

Libs get no Tiltfile entry — they aren't served, only compiled into whatever imports them.

---

## Path 1 — a flat single Next.js app → extract the roles

A typical Next app already contains all three roles, tangled together in one tree. You don't rewrite it; you tease the roles apart in place.

- **What renders to the user** (`app/`, `pages/`, layouts, page components) → this is your first **app**. It **stays** in `apps/web` — the Next app moves whole, the `app/` or `pages/` directory unchanged.
- **What has a URL other systems call** (route handlers under `app/api/*`, webhook receivers, cron/queue handlers) → pull into a **service**. Route handlers that are really an API become `services/api` (Hono); a background/queue processor becomes a `services/ai-worker`-style worker.
- **What is shared and never served** (auth logic, the db client + schema, UI primitives, config, shared types) → pull into **libs**. `lib/db.ts` → `libs/db`, `lib/auth.ts` → `libs/auth`, your `components/ui/*` → `libs/ui`, and so on.

Concretely, for the db:

```
before                          after
app/lib/db.ts             →     libs/db/src/client.ts
app/lib/schema.ts         →     libs/db/src/schema.ts
                                libs/db/src/index.ts   (barrel: re-exports both)

import { db } from "../../lib/db"   →   import { db } from "@stack/db"
```

**Do it in dependency order — libs first, then the service, then the app** — so each extraction compiles before the next one starts. After each move, run the mechanical five touches above, then verify (below). The boundary rule will immediately flag any accidental upward import you created while splitting (e.g. a lib that still reaches back into `app/`).

---

## Path 2 — a Turborepo / Nx `apps` + `packages` monorepo → re-map by exposure

You already have workspaces; this is a **re-bucketing, not a rewrite**. The one real change is that `packages/*` is a junk drawer — "it's a package" — and this taxonomy replaces that with a question about exposure.

- **`packages/*` splits by exposure.** Anything with a URL or its own deploy (an API package, a worker, a webhook receiver) moves to `services/*`. Everything purely imported stays a lib and moves to `libs/*`. There is no `packages/` here.
- **`apps/*` maps 1:1** to `apps/*`.
- **Swap the plumbing:**
  - Replace Turborepo's `pipeline` (or your existing Nx targets) with this repo's `nx.json` `targetDefaults`.
  - Add `nx.tags` (`type:app|service|lib`) to each `package.json`.
  - Adopt this repo's `eslint.config.mjs` boundary rule and the `./`-prefixed `tsconfig.base.json` paths.
  - Rename your scope to `@stack/*` — **or keep your own** (`@yourco/*`) and update the `paths` keys / Tiltfile `--filter` targets accordingly. The [rename sweep in `make-it-yours.md`](./make-it-yours.md#rename-stack--yourco) is a one-liner either direction.

Wire each served package into `.devops/Tiltfile`; leave libs out of it. Then verify.

---

## Path 3 — a monolith or single service → split by URL / deploy

Split along **deploy seams, not code cleanliness.** The question isn't "is this module tidy," it's "does this have its own URL or its own container in production?"

- **Each independently deployable HTTP surface becomes its own `services/*`** — the public API, the payment surface, the async worker. If it deploys on its own, it's its own service.
- **The shared domain logic they all call collapses into `libs/*`** — one `db`, one `auth`, one `config`, not a copy per service.
- **Carve in coupling order, lowest first:**
  1. The **worker / async** paths (lowest coupling — they already talk over a queue).
  2. The **payment / billing** surface (naturally isolated behind an adapter — see [`make-it-yours.md`](./make-it-yours.md) on the `@stack/payment` pattern).
  3. The **core API** last (everything else depends on it, so move it once the libs it needs already exist).

Each carve is the mechanical move: new `services/<name>` folder, Hono entrypoint reading `process.env.PORT` with a `GET /health`, tagged `type:service`, wired into the Tiltfile behind portless.

---

## Path 4 — rename the scope + delete what you don't need

If you started from a clone and are folding your own code in on top, the last mile is making the scope yours and dropping the example packages you won't use. Both are covered in full by **[`make-it-yours.md`](./make-it-yours.md)** — the canonical guide:

- **Delete a package** — it leaves a trail in five places (directory, `.devops/Tiltfile`, `.env.example`, `.mcp.json` / dependents' deps, `tsconfig.base.json` paths), then `bun install && bunx nx run-many -t typecheck`. Worked checklists exist for `apps/mobile`, `services/payment`, and `libs/ai`.
- **Rename `@stack/*` → `@yourco/*`** — because of one-public-door + import-by-name, it's a flat find-and-replace with no scattered internal paths to chase.

---

## Verify as you go — the boundary lint is your checklist

Don't migrate blind. Two commands turn "did I break the shape?" into a mechanical yes/no after every move:

```bash
bun run lint:boundaries    # ESLint @nx/enforce-module-boundaries — the three laws, as errors
bun run affected           # nx affected -t lint typecheck build — only what your change touched
```

`lint:boundaries` is the migration checklist made executable. Every upward import you accidentally leave behind while splitting — a lib still reaching into an app, a service importing an app, a deep import past a barrel — comes back as a **lint error**, not a review nit you might miss. Move a role, run it, fix what it flags, move the next role. When it's silent, the shape is honest.

`bun run affected` keeps the loop fast: it re-runs typecheck/lint/build **only** for the projects your move touched and their dependents, so a green result is quick and real. (`bun run check` — `nx run-many -t typecheck lint` — is the whole-repo gate when you want to be sure end to end.)

## Do it incrementally

You do not have to migrate the whole thing in one branch. **Move one role at a time and keep the build green between moves.** Extract `libs/db`, get `bun run affected` green, commit. Extract `libs/auth`, green, commit. Then the service, then the app. Each step is small, reversible, and provably correct — the opposite of the big-bang restructure the taxonomy exists to spare you.

The end state is a repo shaped correctly with only your code in it: your agent reads the map instead of re-deriving it every session, and the next role you add already has a home.

---

The other direction — gutting the example packages a fresh clone ships with — is [`make-it-yours.md`](./make-it-yours.md). Between the two, you can start from your code or from ours and end up in the same shape.
