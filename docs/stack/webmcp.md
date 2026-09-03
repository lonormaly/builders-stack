# WebMCP

Lets a page declare tools an AI agent running in the browser can call directly — a
search box or an action becomes a typed, callable function instead of something an
agent has to guess at from clicks and form fields.

**Status: an unshipped browser API, behind an origin trial in exactly two browsers, as
of this writing.** Nothing here works for a typical visitor today. See "Browser
support" below before building on this for anything user-facing.

## What this is, per the spec (checked 2 September 2026)

- **Spec**: [webmachinelearning.github.io/webmcp](https://webmachinelearning.github.io/webmcp/)
  — a W3C Web Machine Learning Community Group Draft Report. Editors: Brandon
  Walderman (Microsoft), Khushal Sagar, Dominic Farolino (Google).
- **Explainer / rationale**: [github.com/webmachinelearning/webmcp](https://github.com/webmachinelearning/webmcp)
  (README), plus [`declarative-api-explainer.md`](https://github.com/webmachinelearning/webmcp/blob/main/declarative-api-explainer.md)
  for the declarative form.
- **Implementation status**: [`implementation-status.md`](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md)
  in the same repo.

### The access point is `document.modelContext` — not `navigator.modelContext`

If you've seen an earlier write-up (or an LLM's memory of one) referencing
`navigator.modelContext`, that's stale. The current spec puts a `ModelContext` on
`document`, not `navigator`:

```webidl
[Exposed=Window, SecureContext]
interface ModelContext : EventTarget {
  Promise<undefined> registerTool(ModelContextTool tool, optional ModelContextRegisterToolOptions options = {});
  Promise<sequence<RegisteredTool>> getTools(optional ModelContextGetToolOptions options = {});
  Promise<DOMString> executeTool(RegisteredTool tool, optional object inputObject = {}, optional ModelContextExecuteToolOptions options = {});
  attribute EventHandler ontoolchange;
};
```

`ModelContextTool`: `name` (required, 1-128 chars, `[A-Za-z0-9_.-]`), `description`
(required), `execute` (required, `Promise<any> (object inputObject, { signal }) `),
`title` and `inputSchema` (both optional — `inputSchema` is a plain JSON Schema
object), `annotations` (`{ readOnlyHint, untrustedContentHint }`). Access is gated
behind the `"tools"` permissions-policy feature, default allowlist `['self']`.
Unregistering a tool is done by aborting the `AbortSignal` passed to `registerTool()`
— there's no separate unregister call.

### The declarative fallback is a separate, less-finished proposal

`declarative-api-explainer.md` defines HTML attributes on a `<form>`:

```html
<form toolname="search-cars" tooldescription="Perform a car make/model search" toolautosubmit>
  <input
    type="text"
    name="make"
    toolparamdescription="The vehicle's make (e.g., BMW, Ford)"
    required
  />
  <button type="submit">Search</button>
</form>
```

This is explicitly unfinished: the main spec's own declarative section reads _"This
section is entirely a TODO"_; input-schema synthesis from form controls and the
form-response mechanism are both open issues
([webmachinelearning/webmcp#135](https://github.com/webmachinelearning/webmcp/issues/135)).
Chromium is reportedly testing a "loose version." Treat it as further out than the
imperative API.

### Browser support (checked 2 September 2026 — verify before relying on this)

| Browser         | Status                                                                                 |
| --------------- | -------------------------------------------------------------------------------------- |
| Chrome          | Origin Trial live in Chrome 149 (opt-in per origin, not default-on)                    |
| Edge            | Origin Trial live in Edge 150                                                          |
| Brave           | Experimental support in Leo AI chat                                                    |
| ChatGPT Desktop | Supported (an agent host, not a browser)                                               |
| Firefox         | Standards-positions issue filed (mozilla/standards-positions#1412) — no implementation |
| Safari          | Standards-positions issue filed (WebKit/standards-positions#670) — no implementation   |

An origin trial means a site owner opts in and end users still need a browser build
that supports it — this is not "ships in stable Chrome for everyone." Don't build a
product flow that depends on this working for a random visitor today.

## What this template adds

### `@stack/webmcp` — the one door

```ts
import { z } from "zod";
import { defineTool, useRegisterTools } from "@stack/webmcp";

export const SEARCH_GLOSSARY = defineTool({
  name: "search_glossary",
  title: "Search glossary",
  description: "Look up a term and get its definition.",
  inputSchema: z.object({ query: z.string().min(1) }),
  annotations: { readOnlyHint: true },
  execute: ({ query }) => ({ content: [{ type: "text", text: `...${query}...` }] }),
});
```

- **`defineTool()`** — validates the name against the spec's pattern; gives you input
  inference from the zod schema. Doesn't touch the browser.
- **`registerTool()` / `registerTools()`** — converts the zod schema to JSON Schema
  (`z.toJSONSchema()`, native in zod 4), validates every call's input against it
  _before_ your handler runs, and returns `false` (a no-op, not a throw) on a browser
  without `document.modelContext` — safe to call unconditionally.
- **`useRegisterTools(tools)`** — a client-component hook: registers on mount,
  unregisters (via `AbortController`, per the spec) on unmount. Pass a stable,
  module-scope array.
- **`declarativeToolForm()` / `declarativeToolParam()`** — typed prop helpers for the
  experimental HTML-attribute form, spelled out above. Not wired into any example
  here (the declarative spec is too unfinished to commit to yet) — available if you
  want to try it.

Tool inputs are constrained to `z.ZodObject`, not the fully general `z.ZodType` — MCP's
`inputSchema` is always a JSON object schema (`"type": "object"`) per the protocol, so
a tool's arguments are always a named-field object. (This also sidesteps a real
TypeScript+Zod4 generic-variance issue where a bare `z.ZodType` constraint doesn't
structurally accept a concrete `ZodObject`.)

### The static manifest — `/.well-known/webmcp-tools.json`

WebMCP itself has no manifest file — the imperative API only exists inside a running,
supporting browser, so nothing server-side can observe what a page registers. This
template adds one anyway: **`toolManifest(defs)`** in `@stack/webmcp` converts the
same tool definitions `registerTool()` uses into a plain JSON array (name, title,
description, JSON-Schema `inputSchema`, annotations), served at
`/.well-known/webmcp-tools.json`. One source of truth — the manifest can't drift from
what actually gets registered, because both read the same `defineTool()` call. This is
what lets `check:agent-readability`'s WebMCP section (an _extra, non-spec_ section —
see docs/stack/agent-readability.md) verify a page's tools are present and well-formed
without needing a live, WebMCP-supporting browser to check.

### Wired examples

| App            | Tool                                                                          | Where                                                       |
| -------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `apps/web`     | `search_glossary` — looks up a term on `/glossary` and returns its definition | `apps/web/app/glossary/webmcp-tools.ts` + `WebMcpTools.tsx` |
| `apps/landing` | `describe_product` — returns the same feature list the page renders           | `apps/landing/app/webmcp-tools.ts` + `WebMcpTools.tsx`      |

Both read `readOnlyHint: true` (they only read state) and are registered from a small
client component (`WebMcpTools.tsx`, renders nothing) dropped into the page, so the
tool logic lives in a plain, non-`"use client"` module shared with its manifest route.

## Verify

With no supporting browser available in most dev setups, verify via the manifest
instead of the live API:

```sh
curl http://localhost:3000/.well-known/webmcp-tools.json | jq
```

`bun run check:agent-readability` prints a WebMCP section per app (informational —
it doesn't affect the spec score/pass-fail).
