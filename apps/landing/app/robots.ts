import type { MetadataRoute } from "next";
import { SITE_URL, AI_CRAWLERS } from "./seo";

// Emitted at /robots.txt by Next's App Router. Policy: welcome everyone — search
// engines AND AI crawlers — and point them all at the sitemap. For a public
// marketing site you WANT the AI bots in: that's how you get cited in AI answers (GEO).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Everything (Googlebot, Bingbot, and the AI crawlers below, which "*" already
      // covers) is allowed by default.
      { userAgent: "*", allow: "/" },

      // AI crawlers enumerated explicitly (see app/seo.ts for the annotated 2026 list).
      // They're already allowed by "*"; listing them by name documents intent and gives
      // you a per-bot switch.
      { userAgent: [...AI_CRAWLERS], allow: "/" },

      // ── HOW TO OPT OUT of a specific AI crawler ─────────────────────────────────
      // To stop one bot (e.g. don't let OpenAI train on this site, but keep its
      // search bot so you still get cited), remove its token from the allow rule
      // above and add a disallow rule here. Example:
      //
      //   { userAgent: "GPTBot", disallow: "/" },        // no OpenAI training
      //   { userAgent: "Google-Extended", disallow: "/" }, // no Gemini training
      //
      // Leaving OAI-SearchBot / Claude-SearchBot / PerplexityBot ALLOWED preserves
      // your visibility in AI search even if you block the training bots.
      // ─────────────────────────────────────────────────────────────────────────────
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
