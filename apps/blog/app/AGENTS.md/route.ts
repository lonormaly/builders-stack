import { textFileResponse } from "@stack/seo";

// /AGENTS.md — direct context for a coding agent that lands on the DEPLOYED blog
// (distinct from the repo's own root AGENTS.md, which instructs an agent working
// *inside* the codebase). Per the agent-readability spec: ≥2 of
// installation/configuration/usage. See docs/stack/agent-readability.md.
const BODY = `# AGENTS.md — apps/blog

This is the blog in [Builder's Stack](https://github.com/lonormaly/builders-stack), an
open-source TypeScript monorepo starter. It's a fully static MDX blog — every post is
prerendered at build time, no runtime data fetching.

## Installation

Clone the template and run the workspace install from the repo root:

\`\`\`sh
git clone https://github.com/lonormaly/builders-stack.git
cd builders-stack
bun install
./tilt_up.sh
\`\`\`

## Configuration

This app reads its origin from \`NEXT_PUBLIC_SITE_URL\` (never hardcode a domain) and links
back to the marketing site via \`NEXT_PUBLIC_LANDING_URL\` and to the flagship app via
\`NEXT_PUBLIC_APP_URL\`.

## Usage

- \`/\` — the post index.
- \`/<slug>\` — one page per post, sourced from \`apps/blog/content/*.mdx\`.
- \`/feed.xml\` — RSS feed of every post.
- Add a post by copying \`apps/blog/content/_template.mdx\` to \`<slug>.mdx\` and filling in
  the required frontmatter (title, description, date, updatedAt, author, tags).
`;

export function GET(): Response {
  return textFileResponse(BODY);
}
