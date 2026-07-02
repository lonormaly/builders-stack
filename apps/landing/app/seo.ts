// This app's canonical origin, for robots.ts + sitemap.ts (which build absolute URLs).
// Env-driven — NEVER hardcode a production domain. Same env var @stack/config /
// @stack/seo read, so there's one source of truth for the origin.
//
// The AI-crawler roster + robots rules now live in @stack/seo (`aiCrawlerRules()`) so
// every app shares ONE policy. Page metadata + JSON-LD also come from @stack/seo.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
