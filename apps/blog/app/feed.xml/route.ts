import { getAllPosts } from "../../lib/posts";
import { BLOG_DESCRIPTION, BLOG_NAME, SITE_URL } from "../seo";

// RSS 2.0 feed at /feed.xml. A route handler (not a static public/ file) so every URL
// is absolute and derived from SITE_URL (env), never a hardcoded domain. force-static
// so it's prerendered at build alongside the pages.
export const dynamic = "force-static";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET(): Response {
  const posts = getAllPosts();
  const items = posts
    .map((post) => {
      const url = `${SITE_URL}/${post.slug}`;
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(post.description)}</description>
      <author>${escapeXml(post.author)}</author>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(BLOG_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(BLOG_DESCRIPTION)}</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
