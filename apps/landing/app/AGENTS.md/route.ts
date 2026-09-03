import { textFileResponse } from "@stack/seo";

// /AGENTS.md — direct context for a coding agent that lands on the DEPLOYED marketing
// site (distinct from the repo's own root AGENTS.md, which instructs an agent working
// *inside* the codebase). Per the agent-readability spec: ≥2 of
// installation/configuration/usage. See docs/stack/agent-readability.md.
const BODY = `# AGENTS.md — apps/landing

This is the marketing site for [Builder's Stack](https://github.com/lonormaly/builders-stack),
an open-source TypeScript monorepo starter: apps · services · libs, a shared design system,
and enforced module boundaries.

## Installation

Clone the template and run the workspace install from the repo root:

\`\`\`sh
git clone https://github.com/lonormaly/builders-stack.git
cd builders-stack
bun install
./tilt_up.sh
\`\`\`

## Configuration

This app reads its origin from \`NEXT_PUBLIC_SITE_URL\` (never hardcode a domain), and links
to the flagship app via \`NEXT_PUBLIC_APP_URL\` and the blog via \`NEXT_PUBLIC_BLOG_URL\`.

## Usage

- \`/\` — the marketing home page: what the template is, and its main features.
- \`/privacy\` — a starter privacy policy (template, not legal advice).
- This page registers a \`describe_product\` WebMCP tool (see \`WebMcpTools.tsx\`) — an
  agent visiting with WebMCP support can call it to get a structured summary of the
  product instead of scraping the rendered page.
`;

export function GET(): Response {
  return textFileResponse(BODY);
}
