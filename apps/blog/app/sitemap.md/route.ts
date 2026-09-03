import { sitemapMd, textFileResponse } from "@stack/seo";
import { getAllPosts } from "../../lib/posts";
import { SITE_URL } from "../seo";

// /sitemap.md — headings + links reflecting site structure, alongside sitemap.xml.
export function GET(): Response {
  const posts = getAllPosts();
  const body = sitemapMd("Builder's Stack Blog", [
    { heading: "Index", links: [{ title: "Field notes", url: SITE_URL }] },
    {
      heading: "Posts",
      links: posts.map((p) => ({
        title: p.title,
        url: new URL(`/${p.slug}`, SITE_URL).toString(),
      })),
    },
    {
      heading: "Machine-readable",
      links: [
        { title: "AGENTS.md", url: new URL("/AGENTS.md", SITE_URL).toString() },
        { title: "llms.txt", url: new URL("/llms.txt", SITE_URL).toString() },
        { title: "llms-full.txt", url: new URL("/llms-full.txt", SITE_URL).toString() },
        { title: "RSS feed", url: new URL("/feed.xml", SITE_URL).toString() },
      ],
    },
  ]);
  return textFileResponse(body);
}
