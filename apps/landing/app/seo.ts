// Single source of truth for this app's SEO/GEO surface: canonical origin + the
// AI-crawler roster. robots.ts, sitemap.ts, layout.tsx and opengraph-image.tsx all
// read from here so there's ONE place to change the domain or the crawler policy.

/**
 * The site's own canonical origin. Env-driven — NEVER hardcode a production domain.
 * `NEXT_PUBLIC_SITE_URL` is this marketing site's public URL; the localhost fallback
 * is dev-only. Set it in prod (e.g. https://your-domain.com).
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * AI crawler user-agent tokens, 2026 roster, grouped by operator + purpose.
 * Verified June 2026 against public operator docs + the 2026 crawler references
 * (anagram.ai, nohacks.co, openshadow.io). Tokens are case-insensitive in robots.txt
 * but written here as each operator documents them.
 *
 * Categories:
 *   - training : builds the model's long-term knowledge (opt out = your content
 *                won't be used to train that model)
 *   - search   : indexes for live retrieval inside AI answers (opt out = you lose
 *                citations/visibility in that AI's search)
 *   - user     : on-demand fetch when a user pastes/asks about your URL
 *
 * GEO note: you almost always want to ALLOW the `search` + `user` bots (that's how
 * you get cited), and it's the `training` bots you might opt out of. Defaults below
 * allow everything — flip individual tokens in robots.ts to opt out.
 */
export const AI_CRAWLERS = [
  // OpenAI
  "GPTBot", // training
  "OAI-SearchBot", // search
  "ChatGPT-User", // user
  // Anthropic
  "ClaudeBot", // training
  "Claude-SearchBot", // search
  "Claude-User", // user
  // Perplexity
  "PerplexityBot", // search
  "Perplexity-User", // user
  // Google (Gemini training — does NOT affect Google Search ranking)
  "Google-Extended", // training
  // Apple (Apple Intelligence / Siri training)
  "Applebot-Extended", // training
  // Amazon
  "Amazonbot", // search/training
  // Meta (Llama / Meta AI)
  "Meta-ExternalAgent", // training
  // ByteDance (has a documented history of ignoring robots.txt)
  "Bytespider", // training
  // Common Crawl (dataset many models train on)
  "CCBot", // training
  // Cohere
  "cohere-ai", // training
] as const;
