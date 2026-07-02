// The SEO door is a place drift creeps in silently — pin the shape. `bun test`.
import { expect, test } from "bun:test";
import { pageMetadata } from "./metadata";
import {
  organizationJsonLd,
  websiteJsonLd,
  articleJsonLd,
  faqJsonLd,
  breadcrumbJsonLd,
} from "./json-ld";
import { aiCrawlerRules, AI_CRAWLERS } from "./crawlers";

// With no env set, @stack/config defaults apply: name "Builder's Stack", url localhost:3000.
const NAME = "Builder's Stack";
const URL_ = "http://localhost:3000";

test("pageMetadata fills OG + canonical + template from config defaults", () => {
  const m = pageMetadata({ description: "hi", path: "/" });
  expect(m.metadataBase?.toString()).toBe(`${URL_}/`);
  // No title → default + template (root-layout shape).
  expect(m.title).toEqual({ default: NAME, template: `%s — ${NAME}` });
  expect(m.alternates?.canonical).toBe("/");
  expect(m.applicationName).toBe(NAME);
  // OG/twitter are filled so no page hand-rolls them.
  expect((m.openGraph as { url?: string }).url).toBe(`${URL_}/`);
  expect((m.openGraph as { siteName?: string }).siteName).toBe(NAME);
  expect((m.twitter as { card?: string }).card).toBe("summary_large_image");
});

test("pageMetadata with a title → plain string title + absolute canonical path", () => {
  const m = pageMetadata({ title: "Pricing", path: "/pricing" });
  expect(m.title).toBe("Pricing");
  expect(m.alternates?.canonical).toBe("/pricing");
  expect((m.openGraph as { url?: string }).url).toBe(`${URL_}/pricing`);
  expect((m.openGraph as { title?: string }).title).toBe("Pricing");
});

test("pageMetadata noIndex emits robots index:false (login/internal pages)", () => {
  const m = pageMetadata({ title: "Sign in", noIndex: true });
  expect(m.robots).toEqual({ index: false, follow: false });
  expect(pageMetadata({ title: "Public" }).robots).toBeUndefined();
});

test("pageMetadata image → OG + twitter images", () => {
  const m = pageMetadata({ title: "T", image: "/og.png" });
  expect((m.openGraph as { images?: unknown[] }).images).toEqual([{ url: "/og.png" }]);
  expect((m.twitter as { images?: unknown[] }).images).toEqual([{ url: "/og.png" }]);
});

test("organizationJsonLd / websiteJsonLd carry @context + @type", () => {
  const org = organizationJsonLd({ name: NAME, url: URL_, sameAs: ["https://x.com/a"] });
  expect(org["@context"]).toBe("https://schema.org");
  expect(org["@type"]).toBe("Organization");
  expect(org.sameAs).toEqual(["https://x.com/a"]);
  const site = websiteJsonLd({ name: NAME, url: URL_ });
  expect(site["@type"]).toBe("WebSite");
});

test("articleJsonLd nests a Person author when given", () => {
  const a = articleJsonLd({ headline: "H", url: URL_, authorName: "Ada" });
  expect(a["@type"]).toBe("Article");
  expect(a.author).toEqual({ "@type": "Person", name: "Ada" });
});

test("faqJsonLd + breadcrumbJsonLd build the list shapes", () => {
  const faq = faqJsonLd([{ question: "Q?", answer: "A." }]);
  expect(faq["@type"]).toBe("FAQPage");
  expect((faq.mainEntity as unknown[]).length).toBe(1);

  const bc = breadcrumbJsonLd([
    { name: "Home", url: `${URL_}/` },
    { name: "Docs", url: `${URL_}/docs` },
  ]);
  const items = bc.itemListElement as Array<{ position: number }>;
  expect(items[0]?.position).toBe(1);
  expect(items[1]?.position).toBe(2);
});

test("aiCrawlerRules allows the full roster at root", () => {
  const rules = aiCrawlerRules();
  expect(rules).toHaveLength(1);
  expect(rules[0]?.allow).toBe("/");
  expect(rules[0]?.userAgent).toContain("GPTBot");
  expect(rules[0]?.userAgent).toContain("ClaudeBot");
  expect(rules[0]?.userAgent.length).toBe(AI_CRAWLERS.length);
});
