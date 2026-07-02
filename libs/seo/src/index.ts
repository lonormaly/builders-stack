// @stack/seo — the one door for page metadata + structured data + AI-crawler policy.
//
// Grounded in Google's AI optimization guide:
// https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
//   - Public content must be server-rendered & crawlable → pageMetadata() + <JsonLd/>
//     emit into SSR HTML, never client-only.
//   - Structured data is optional for AI but earns RICH RESULTS → the JSON-LD builders
//     exist for that, not as an "AI hack".
//   - AI crawlers get you cited in AI answers → aiCrawlerRules() welcomes them.
//
// Use this instead of hand-rolling Metadata/OG/canonical or inline JSON-LD. The
// `bun run check:seo` gate fails the build if a public page lacks metadata.

export { pageMetadata } from "./metadata";
export type { PageMetadataInput } from "./metadata";

export {
  organizationJsonLd,
  websiteJsonLd,
  articleJsonLd,
  faqJsonLd,
  breadcrumbJsonLd,
} from "./json-ld";
export type {
  JsonLdData,
  OrganizationInput,
  WebsiteInput,
  ArticleInput,
  FaqItem,
  BreadcrumbItem,
} from "./json-ld";

export { JsonLd } from "./json-ld-component";

export { aiCrawlerRules, AI_CRAWLERS } from "./crawlers";
export type { AiCrawlerRule } from "./crawlers";
