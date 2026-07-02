// The AI-crawler roster + the robots.txt allow-list entries that welcome them.
// robots.ts in each app spreads `aiCrawlerRules()` so there's ONE source of truth for
// the crawler policy across the whole repo — change the roster here, every app updates.
//
// GEO reality check (per Google's AI optimization guide): letting these bots in is how
// you get *cited* in AI answers. It is NOT a ranking hack — Google Search itself ranks
// on the same crawlable, original content as always. This list governs the OTHER engines
// (OpenAI, Anthropic, Perplexity, …) plus opt-out control over training bots.

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
 * allow everything — flip individual tokens in an app's robots.ts to opt out.
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

/** One robots.txt allow rule listing every AI crawler by name. */
export type AiCrawlerRule = { userAgent: string[]; allow: string };

/**
 * Robots rule entries that ALLOW every AI crawler at the site root. Spread into an
 * app's `robots.ts` rules array:
 *
 *   rules: [{ userAgent: "*", allow: "/" }, ...aiCrawlerRules()]
 *
 * They're already covered by "*"; listing them by name documents intent and gives a
 * per-bot switch (remove a token above + add a `{ userAgent, disallow: "/" }` rule to
 * opt one bot out — e.g. block GPTBot training while keeping OAI-SearchBot for citations).
 */
export function aiCrawlerRules(): AiCrawlerRule[] {
  return [{ userAgent: [...AI_CRAWLERS], allow: "/" }];
}
