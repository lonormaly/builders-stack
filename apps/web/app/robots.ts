import type { MetadataRoute } from "next";
import { SITE_URL } from "./seo";

// /robots.txt for the app. Allow search + AI crawlers (the "*" rule covers the named
// AI bots enumerated in apps/landing/app/robots.ts — see there for the annotated 2026
// list and the per-bot opt-out pattern). Keep the login screen out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/auth"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
