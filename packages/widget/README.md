# @stack/widget — the worked example of the 4th bucket

**`packages/` is what you _ship_; `apps`/`services`/`libs` are what you _run_.** This
package is the worked example: a **distributable served to third parties** — an
embeddable "feedback" widget that self-mounts into any host page's DOM via a single
`<script>` tag, or is `import`ed by an npm consumer. It's tiny on purpose; the
_packaging_ is the lesson, not the feature.

## Why it lives in `packages/`, not `libs/`

A `libs/*` package is **shared code your own apps/services consume** — never served.
This widget is the opposite: nothing inside this repo imports it. It's built and
**shipped out** — embedded on someone else's site or published to npm. That different
_exposure_ is the whole reason for the fourth bucket. SDKs and CLIs live here too.

- **Tag:** `type:package`. Boundary: a `type:package` may depend on `type:lib` **only**
  (not apps, services, or other packages), and **nothing internal may import it** —
  packages are **terminal**. Both halves are enforced by `@nx/enforce-module-boundaries`.
- It **does** depend on a lib: `resolveConfig` defaults the button's accent color to the
  design-token primary from `@stack/ui/tokens` (a legal downward `package → lib` edge).

## Two build outputs

```bash
bun --filter @stack/widget build
```

- **`dist/widget.js`** — an **IIFE** for a `<script src>` embed on _any_ third-party
  site. Self-contained (design tokens bundled in, zero runtime deps), self-mounting.
- **`dist/index.js`** — an **ESM** build for npm consumers (`import { mountFeedback }`).

## Embed it (third-party site)

```html
<script
  src="https://cdn.example.com/widget.js"
  data-endpoint="https://api.example.com/feedback"
  data-label="Feedback"
  data-position="bottom-right"
></script>
```

Config comes off the script tag's `data-*` attributes; it also exposes
`window.StackWidget.mount({ ... })` for programmatic mounting. See
[`demo/index.html`](./demo/index.html) — a stand-in host page that embeds the built
bundle.

## Consume it (npm)

```ts
import { mountFeedback } from "@stack/widget";
mountFeedback({ endpoint: "https://api.example.com/feedback" });
```

> **Example, not actually published.** `package.json` is `private: true`; its
> `publishConfig` / `files` / `exports` show the _shape_ a real distributable takes.
> `types` points at source for the example — a real publish adds
> `tsc --emitDeclarationOnly` to emit `dist/index.d.ts`.

## Test

```bash
bun --filter @stack/widget test   # bun:test — pins the pure core (config + payload)
```

## Delete it if you ship nothing

If your product isn't a distributable — no SDK, no embed, no CLI — **delete the whole
`packages/` folder** and drop `"packages/*"` from the root `package.json` workspaces +
the `@stack/widget` path in `tsconfig.base.json`. The other three buckets stand alone.
