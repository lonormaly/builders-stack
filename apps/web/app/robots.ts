import type { MetadataRoute } from "next";
import { aiCrawlerRules } from "@stack/seo";
import { SITE_URL } from "./seo";

// /robots.txt for the app. Allow search + AI crawlers (roster + opt-out pattern in
// @stack/seo's aiCrawlerRules — the one shared policy). Keep the login screen out of
// the index for every bot.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/auth"] }, ...aiCrawlerRules()],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
