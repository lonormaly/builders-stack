# Designing UI in builders-stack

The stack: **shadcn/ui** (Radix primitives + Tailwind) in `@stack/ui` — every component's source lives in-repo, so your coding agent can read and edit it. Icons: `lucide-react`. Tokens (`@stack/ui/tokens`) are the single source of truth, consumed by both web and native.

## The workflow — reference first, then build

Generic AI-generated UI looks generic. Skip that: pull real, shipped design patterns as reference _before_ you build, using the **[Mobbin](https://mobbin.com) MCP** (600k+ real app screens, 130k+ flows).

1. **Reference** — ask your agent (with the Mobbin MCP connected):

   > "Show me onboarding flows from top fintech apps" · "pull 10 settings screens with strong empty states"

   Tools: `mobbin_quick_search` (find the app) → `mobbin_get_app_screens` / `mobbin_get_app_flows` (pull screens inline).

2. **Adapt** — take the _patterns_ (layout, hierarchy, states, motion), not pixels. Map them onto this repo's tokens.
3. **Build** — implement as `@stack/ui` components (shadcn + `cn()` + `cva`), composed by the app. Reusable → a component in `@stack/ui`; one-off page scaffolding → inline in the app.

## Setup (Mobbin MCP)

`agents/mcp.json` already includes `mobbin`. Copy it to a root `.mcp.json`, or add it directly:

```bash
claude mcp add mobbin --transport http https://api.mobbin.com/mcp
```

Then run `/mcp` in-session and authorize in the browser (OAuth — no API key; requires a paid Mobbin plan). Docs: https://docs.mobbin.com/mcp/introduction

## Rules

- Reusable UI = a `@stack/ui` component. Never inline reusable UI or duplicate styles inside an app.
- Compose in apps; define in `@stack/ui`. Screens hold layout + data wiring + composition — not reusable UI.
