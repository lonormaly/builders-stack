---
name: add-a-lib
description: Scaffold a new shared library under libs/ in the builders-stack monorepo. Use when code is needed in two or more places (apps or services) and should become a single source of truth consumed by package name. Covers the package.json, tsconfig, the one-public-door src/index.ts barrel, and wiring it into a consumer without breaking the no-upward-import rule.
---

# Add a lib

A `libs/*` package is **shared code that is never served** — other packages consume it, it consumes nobody upward. Reach for this when the same helper/type/component is about to exist in two places.

## When to use

- A util, type, component, or client is needed by 2+ apps/services → extract it into a lib.
- **Not** when it's used in exactly one place — leave it there (YAGNI). A lib for one consumer is premature.

## Steps

1. **Pick the name.** `libs/<name>`, package `@stack/<name>`. Keep it a role, not a feature (`ui`, `db`, `auth`, `ai`, `analytics`).

2. **Create the folder + files:**

   ```
   libs/<name>/
   ├── package.json
   ├── tsconfig.json
   └── src/
       └── index.ts        # the ONE public door
   ```

3. **`package.json`** — name it `@stack/<name>`, point exports at the barrel:

   ```json
   {
     "name": "@stack/<name>",
     "private": true,
     "type": "module",
     "exports": { ".": "./src/index.ts" },
     "scripts": { "typecheck": "tsc --noEmit" }
   }
   ```

4. **`tsconfig.json`** — extend the root base, never fork options:

   ```json
   { "extends": "../../tsconfig.base.json", "include": ["src"] }
   ```

5. **`src/index.ts`** — this is the **only** thing consumers may import. Re-export the public surface; keep everything else internal:

   ```ts
   export { thing } from "./thing";
   export type { ThingOptions } from "./thing";
   ```

6. **Install so the workspace links it:** `bun install` (root). The `@stack/<name>` name now resolves across the workspace.

7. **Consume it** from an app/service by **package name only**:
   ```ts
   import { thing } from "@stack/<name>"; // ✅
   import { thing } from "@stack/<name>/src/internal/thing"; // ❌ deep import — forbidden
   ```

## Rules to respect

- **No upward import:** the lib must not import from `apps/` or `services/`. If it needs to, the boundary is wrong — the caller should pass the dependency in.
- **One public door:** anything not exported from `src/index.ts` is private. Don't let consumers reach into internals.
- **No Tiltfile change** — libs aren't served, so they get no Tilt resource.

## Verify

`bun run typecheck` passes, and the consumer imports by package name only. Done.
