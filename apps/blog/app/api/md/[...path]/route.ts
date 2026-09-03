import { NextResponse } from "next/server";
import { markdownResponse } from "@stack/seo";
import { getAllPosts, getPost } from "../../../../lib/posts";
import { BLOG_DESCRIPTION, SITE_URL } from "../../../seo";

// Serves every page's markdown mirror from ONE handler — proxy.ts rewrites both
// `/foo.md` and `Accept: text/markdown` requests for `/foo` here. For a post, the
// body IS the post's own MDX source (frontmatter already stripped by gray-matter in
// lib/posts.ts) — real first-hand prose, not a generated summary.
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const key = path.join("/") || "index";

  if (key === "index") {
    const posts = getAllPosts();
    const body = [
      `# Field notes\n\n${BLOG_DESCRIPTION}`,
      "## Posts",
      posts.map((p) => `- [${p.title}](${SITE_URL}/${p.slug}) — ${p.description}`).join("\n"),
    ].join("\n\n");
    return markdownResponse({
      title: "Field notes",
      description: BLOG_DESCRIPTION,
      lastUpdated: posts[0]?.updatedAt ?? new Date().toISOString().slice(0, 10),
      canonicalUrl: SITE_URL,
      sitemapUrl: new URL("/sitemap.md", SITE_URL).toString(),
      body,
    });
  }

  const post = getPost(key);
  if (!post) return new NextResponse("Not found", { status: 404 });

  return markdownResponse({
    title: post.title,
    description: post.description,
    lastUpdated: post.updatedAt,
    canonicalUrl: new URL(`/${post.slug}`, SITE_URL).toString(),
    sitemapUrl: new URL("/sitemap.md", SITE_URL).toString(),
    body: `# ${post.title}\n\n${post.content}`,
  });
}
