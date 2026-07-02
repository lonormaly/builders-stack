// This app's canonical origin, for robots.ts + sitemap.ts + absolute JSON-LD URLs.
// Env-driven — NEVER hardcode a production domain. The blog is deployed to its own
// subdomain (blog.<yourdomain>), so it gets its OWN NEXT_PUBLIC_SITE_URL, distinct
// from the app/landing origin. Falls back to the local portless URL for dev.
//
// The AI-crawler roster + robots rules live in @stack/seo (`aiCrawlerRules()`); page
// metadata + JSON-LD also come from @stack/seo — one door, no hand-rolling.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://blog.stack.localhost:1355";

export const BLOG_NAME = "Builder's Stack Blog";
export const BLOG_DESCRIPTION =
  "Field notes on building an AI-native monorepo — structure, SEO/GEO, and the tools that keep a repo fast as it grows. Original, first-hand, from the people who built the stack.";
