import { textFileResponse } from "@stack/seo";

// /AGENTS.md — direct context for a coding agent that lands on the DEPLOYED site
// (distinct from the repo's own root AGENTS.md, which instructs an agent working
// *inside* the codebase). Per the agent-readability spec: ≥2 of
// installation/configuration/usage. See docs/stack/agent-readability.md.
const BODY = `# AGENTS.md — apps/web

This is the flagship app in [Builder's Stack](https://github.com/lonormaly/builders-stack), an
open-source TypeScript monorepo starter. It demonstrates the shared \`@stack/ui\` design system,
a Hono API (\`services/api\`), and Better Auth login, all wired end to end.

## Installation

Clone the template and run the workspace install from the repo root:

\`\`\`sh
git clone https://github.com/lonormaly/builders-stack.git
cd builders-stack
bun install
./tilt_up.sh
\`\`\`

\`tilt_up.sh\` starts every app and service, including this one, at its own portless URL
(no pinned ports to collide on).

## Configuration

This app reads its origin from \`NEXT_PUBLIC_SITE_URL\` (never hardcode a domain), and talks to
the API at \`API_URL\` (default \`http://localhost:3001\`). Auth, payments, email, and analytics
are env-gated: each stays a silent no-op until you set its key — see
\`docs/stack/getting-started.md\` in the repo for the full list.

## Usage

- \`/\` — the design-system demo: buttons, badges, forms, and design tokens shared with
  \`apps/mobile\`.
- \`/health\` — a diagnostics page showing whether \`services/api\`'s \`/health\` and \`/posts\`
  endpoints are reachable.
- \`/glossary\` — terminology used across this app and the wider template.
- Sign in via Better Auth from the nav; a signed-in session is shared with the API through
  the same cookie domain.
`;

export function GET(): Response {
  return textFileResponse(BODY);
}
