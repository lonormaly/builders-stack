import type { MetadataRoute } from "next";
import { aiCrawlerRules } from "@stack/seo";
import { SITE_URL } from "./seo";

// Emitted at /robots.txt. Policy: welcome everyone — search engines AND AI crawlers —
// and point them all at the sitemap. For a public blog you WANT the AI bots in: that's
// how the posts get cited in AI answers (GEO).
//
// The AI roster + its opt-out pattern live in @stack/seo (aiCrawlerRules) — the ONE
// place to change the crawler policy for every app.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }, ...aiCrawlerRules()],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
