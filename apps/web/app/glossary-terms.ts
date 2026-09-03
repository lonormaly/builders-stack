// The glossary's actual content — one array, rendered by both the HTML page
// (app/glossary/page.tsx) and its markdown mirror (app/api/md/[...path]/route.ts), so
// the two can never drift. This is the "glossary or terminology page" the
// agent-readability spec's page-level check looks for a link to; every page in this
// app links here from the nav (see layout.tsx).
export interface GlossaryTerm {
  term: string;
  definition: string;
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    term: "apps / services / libs",
    definition:
      "The three top-level code folders, split by who consumes the code: apps are served to humans, services are served to machines (anything with a URL), libs are shared code that's never served directly.",
  },
  {
    term: "Nx",
    definition:
      "The task orchestrator: caches every task by input hash, runs only what a change actually affects (`nx affected`), and turns the module-boundary rules below into lint errors instead of review nits.",
  },
  {
    term: "Module boundaries",
    definition:
      "@nx/enforce-module-boundaries's lint rules: a lib never imports from an app or a service, and every lib is imported through its single package-name door (e.g. `@stack/ui`), never a deep path.",
  },
  {
    term: "Portless",
    definition:
      "The local-dev tool that assigns stable named URLs (e.g. web.stack.localhost) instead of pinned ports, so services never collide on 3000/3001/… as the number of apps grows.",
  },
  {
    term: "Worktree",
    definition:
      "A separate, disposable checkout of this repo tied to one branch, used so multiple coding agents (or a human and an agent) can work in parallel without touching each other's files or install.",
  },
  {
    term: "Env-gated batteries",
    definition:
      "Integrations — auth, payments, email, analytics — that are pre-wired in code but stay a silent no-op until you add their API key. A fresh clone boots and renders with an empty env file.",
  },
  {
    term: "Agent readability",
    definition:
      "How well a deployed site can be read by an AI agent instead of a human browser: markdown mirrors, content negotiation, AGENTS.md, sitemap.md, and structured data. Scored by `bun run check:agent-readability` against Vercel's agent-readability spec.",
  },
  {
    term: "WebMCP",
    definition:
      "A browser API (`document.modelContext`) that lets a page register tools an AI agent running in the browser can call directly — a search box or a form becomes a callable action, instead of the agent guessing at clicks and field names.",
  },
];
