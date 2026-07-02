// JSON-LD builders — plain, typed schema.org objects. Render them with <JsonLd/>.
//
// Per Google's AI optimization guide: structured data is NOT required for generative AI
// search and there's "no special schema.org markup you need to add" for it. We add JSON-LD
// for the thing it genuinely earns — RICH RESULTS in classic Search — not as an AI lever.
// https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
//
// No schema-dts dependency: these are hand-typed inputs → plain objects. Keep them small.

/** A rendered schema.org node (has `@context` + `@type`). */
export type JsonLdData = Record<string, unknown>;

const CONTEXT = "https://schema.org" as const;

export interface OrganizationInput {
  name: string;
  url: string;
  logo?: string;
  /** Profile URLs that are the same entity (Twitter/X, GitHub, LinkedIn…). */
  sameAs?: string[];
}

export function organizationJsonLd(input: OrganizationInput): JsonLdData {
  return {
    "@context": CONTEXT,
    "@type": "Organization",
    name: input.name,
    url: input.url,
    ...(input.logo ? { logo: input.logo } : {}),
    ...(input.sameAs?.length ? { sameAs: input.sameAs } : {}),
  };
}

export interface WebsiteInput {
  name: string;
  url: string;
  description?: string;
}

export function websiteJsonLd(input: WebsiteInput): JsonLdData {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    name: input.name,
    url: input.url,
    ...(input.description ? { description: input.description } : {}),
  };
}

export interface ArticleInput {
  headline: string;
  url: string;
  description?: string;
  image?: string;
  /** ISO 8601, e.g. "2026-07-02". */
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
}

export function articleJsonLd(input: ArticleInput): JsonLdData {
  return {
    "@context": CONTEXT,
    "@type": "Article",
    headline: input.headline,
    url: input.url,
    mainEntityOfPage: input.url,
    ...(input.description ? { description: input.description } : {}),
    ...(input.image ? { image: input.image } : {}),
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    ...(input.authorName ? { author: { "@type": "Person", name: input.authorName } } : {}),
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function faqJsonLd(items: FaqItem[]): JsonLdData {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer },
    })),
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdData {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}
