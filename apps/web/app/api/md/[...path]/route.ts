import { NextResponse } from "next/server";
import { markdownResponse } from "@stack/seo";
import { MARKDOWN_PAGES } from "../../../md-content";
import { SITE_URL } from "../../../seo";

// Serves every page's markdown mirror from ONE handler — middleware.ts rewrites both
// `/foo.md` and `Accept: text/markdown` requests for `/foo` here, with `foo` (or
// `index` for the home page) as the catch-all param. See docs/stack/agent-readability.md.
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const key = path.join("/") || "index";
  const content = MARKDOWN_PAGES[key];
  if (!content) return new NextResponse("Not found", { status: 404 });

  const canonicalPath = key === "index" ? "/" : `/${key}`;
  return markdownResponse({
    title: content.title,
    description: content.description,
    lastUpdated: content.lastUpdated,
    canonicalUrl: new URL(canonicalPath, SITE_URL).toString(),
    sitemapUrl: new URL("/sitemap.md", SITE_URL).toString(),
    body: content.body,
  });
}
