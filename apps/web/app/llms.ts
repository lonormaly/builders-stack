import { SITE_URL } from "./seo";

// ⚠️ HONEST FRAMING (per Google's AI optimization guide): Google Search ignores
// llms.txt — it neither harms nor helps ranking. Kept because some non-Google
// engines/tools read it, and because it's a required site-level check in the
// agent-readability spec (docs/stack/agent-readability.md) — not a ranking lever.
//
// Shared builder for /llms.txt (curated) and /llms-full.txt (curated + full prose),
// same pattern as apps/landing/app/llms.ts.

const SUMMARY =
  "The flagship app in Builder's Stack — one shared design system (@stack/ui), a Hono API, and Better Auth login, all wired end to end.";

export function llmsTxt(): string {
  return `# Builder's Stack — Web

> ${SUMMARY}

## Pages

- [Design system](${SITE_URL}/): Live demo of every \`@stack/ui\` component and design token, shared verbatim with \`apps/mobile\`.
- [Glossary](${SITE_URL}/glossary): Terminology used across this app and the wider template.

## For agents

- [AGENTS.md](${SITE_URL}/AGENTS.md): Installation, configuration, and usage for this deployed app.
- [sitemap.md](${SITE_URL}/sitemap.md): The full site map in markdown.
`;
}

export function llmsFullTxt(): string {
  return `${llmsTxt()}
## Full detail

### Design system
\`@stack/ui\` ships shadcn/ui components (Radix + Tailwind) plus framework-agnostic design
tokens. This app renders every component live so you can see exactly what \`apps/mobile\`
consumes from the same package.

### Auth
Sign-in is Better Auth, sharing a cookie domain with \`services/api\` — the same session that
authenticates API calls.

### API health
\`/health\` shows whether \`services/api\`'s \`/health\` and \`/posts\` endpoints are reachable —
useful for a first sanity check after cloning the template.
`;
}
