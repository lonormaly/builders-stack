import { getAllPosts } from "../lib/posts";
import { BLOG_DESCRIPTION, BLOG_NAME, SITE_URL } from "./seo";

// ⚠️ HONEST FRAMING (per Google's AI optimization guide): Google Search ignores
// llms.txt — it neither harms nor helps ranking. Kept because some non-Google
// engines/tools read it, and because it's a required site-level check in the
// agent-readability spec (docs/stack/agent-readability.md) — not a ranking lever.
//
// Shared builder for /llms.txt (curated) and /llms-full.txt (curated + full prose),
// same pattern as apps/landing/app/llms.ts. Post links are generated from the content
// directory (getAllPosts()), so a new .mdx file shows up here automatically.

export function llmsTxt(): string {
  const posts = getAllPosts();
  const postLinks = posts
    .map((p) => `- [${p.title}](${SITE_URL}/${p.slug}): ${p.description}`)
    .join("\n");
  return `# ${BLOG_NAME}

> ${BLOG_DESCRIPTION}

## Posts

${postLinks}

## For agents

- [AGENTS.md](${SITE_URL}/AGENTS.md): Installation, configuration, and usage for this deployed app.
- [sitemap.md](${SITE_URL}/sitemap.md): The full site map in markdown.
- [feed.xml](${SITE_URL}/feed.xml): RSS feed of every post.
`;
}

export function llmsFullTxt(): string {
  return `${llmsTxt()}
## Full detail

### How this blog is built
Every post is static MDX, sourced from \`apps/blog/content/*.mdx\`, and prerendered at build
time — no runtime data fetching. Frontmatter (title, description, date, updatedAt, author,
tags) is required and validated at build time; a post missing a required field fails the
build instead of shipping half-written.

### Freshness
Each post carries both \`date\` (first published) and \`updatedAt\` (last meaningful edit) —
the page shows "Updated <date>" whenever they differ, and both feed the post's JSON-LD
\`dateModified\`.
`;
}
