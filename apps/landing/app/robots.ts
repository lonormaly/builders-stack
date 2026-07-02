import type { MetadataRoute } from "next";
import { aiCrawlerRules } from "@stack/seo";
import { SITE_URL } from "./seo";

// Emitted at /robots.txt by Next's App Router. Policy: welcome everyone — search
// engines AND AI crawlers — and point them all at the sitemap. For a public
// marketing site you WANT the AI bots in: that's how you get cited in AI answers (GEO).
//
// The AI roster + its opt-out pattern live in @stack/seo (aiCrawlerRules) — the ONE
// place to change the crawler policy for every app. To opt one bot out, remove its
// token there and add a `{ userAgent: "GPTBot", disallow: "/" }` rule below.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Everything (Googlebot, Bingbot, …) allowed by default; the AI crawlers are
      // enumerated by name so you get a per-bot switch.
      { userAgent: "*", allow: "/" },
      ...aiCrawlerRules(),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
