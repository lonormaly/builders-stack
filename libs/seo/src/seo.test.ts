// The SEO door is a place drift creeps in silently — pin the shape. `bun test`.
import { expect, test } from "bun:test";
import { pageMetadata } from "./metadata";
import {
  organizationJsonLd,
  websiteJsonLd,
  articleJsonLd,
  faqJsonLd,
  breadcrumbJsonLd,
  webPageJsonLd,
} from "./json-ld";
import { aiCrawlerRules, AI_CRAWLERS } from "./crawlers";
import {
  markdownPage,
  markdownResponse,
  markdownRewriteTarget,
  sitemapMd,
} from "./agent-readability";

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

test("pageMetadata markdownMirror emits alternates.types['text/markdown']", () => {
  const home = pageMetadata({ title: "T", path: "/", markdownMirror: true });
  expect(home.alternates?.types).toEqual({ "text/markdown": "/index.md" });

  const page = pageMetadata({ title: "T", path: "/privacy", markdownMirror: true });
  expect(page.alternates?.types).toEqual({ "text/markdown": "/privacy.md" });

  // Omitted by default — pages without a markdown mirror don't claim one.
  expect(pageMetadata({ title: "T", path: "/health" }).alternates?.types).toBeUndefined();
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

test("webPageJsonLd carries name/url/description/dateModified", () => {
  const wp = webPageJsonLd({
    name: "Home",
    url: URL_,
    description: "d",
    dateModified: "2026-07-02",
  });
  expect(wp["@type"]).toBe("WebPage");
  expect(wp.dateModified).toBe("2026-07-02");
});

test("markdownPage emits frontmatter + body + a Sitemap section", () => {
  const md = markdownPage({
    title: "Privacy",
    description: "d",
    lastUpdated: "2026-07-02",
    canonicalUrl: `${URL_}/privacy`,
    sitemapUrl: `${URL_}/sitemap.md`,
    body: "Hello world.",
  });
  expect(md).toContain('title: "Privacy"');
  expect(md).toContain('last_updated: "2026-07-02"');
  expect(md).toContain("Hello world.");
  expect(md).toContain(`## Sitemap\n\n[Full site map](${URL_}/sitemap.md)`);
});

test("markdownPage escapes quotes in frontmatter strings", () => {
  const md = markdownPage({
    title: 'A "quoted" title',
    description: "d",
    lastUpdated: "2026-07-02",
    canonicalUrl: URL_,
    sitemapUrl: `${URL_}/sitemap.md`,
    body: "x",
  });
  expect(md).toContain('title: "A \\"quoted\\" title"');
});

test("markdownResponse sets text/markdown content-type + canonical Link header", async () => {
  const res = markdownResponse({
    title: "Privacy",
    description: "d",
    lastUpdated: "2026-07-02",
    canonicalUrl: `${URL_}/privacy`,
    sitemapUrl: `${URL_}/sitemap.md`,
    body: "Hello.",
  });
  expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
  expect(res.headers.get("link")).toBe(`<${URL_}/privacy>; rel="canonical"`);
  expect(await res.text()).toContain("Hello.");
});

test("markdownRewriteTarget: explicit .md suffix rewrites to /api/md/...", () => {
  expect(markdownRewriteTarget("/privacy.md", null)).toBe("/api/md/privacy");
  expect(markdownRewriteTarget("/index.md", null)).toBe("/api/md/index");
});

test("markdownRewriteTarget: Accept: text/markdown negotiates the same URL", () => {
  expect(markdownRewriteTarget("/privacy", "text/markdown")).toBe("/api/md/privacy");
  expect(markdownRewriteTarget("/", "text/markdown, text/html;q=0.5")).toBe("/api/md/index");
  // html preferred (or no markdown at all) → pass through.
  expect(markdownRewriteTarget("/privacy", "text/html")).toBeNull();
  expect(markdownRewriteTarget("/privacy", "text/markdown;q=0.3, text/html;q=0.9")).toBeNull();
  expect(markdownRewriteTarget("/privacy", null)).toBeNull();
});

test("markdownRewriteTarget never touches API routes, assets, or existing text routes", () => {
  expect(markdownRewriteTarget("/api/md/privacy", "text/markdown")).toBeNull();
  expect(markdownRewriteTarget("/_next/static/chunk.js", "text/markdown")).toBeNull();
  expect(markdownRewriteTarget("/favicon.ico", "text/markdown")).toBeNull();
  expect(markdownRewriteTarget("/sitemap.md", "text/markdown")).toBeNull();
  expect(markdownRewriteTarget("/llms.txt", "text/markdown")).toBeNull();
});

test("sitemapMd renders headings + links per section", () => {
  const md = sitemapMd("Builder's Stack", [
    { heading: "Pages", links: [{ title: "Home", url: `${URL_}/` }] },
  ]);
  expect(md).toContain("# Builder's Stack — Sitemap");
  expect(md).toContain("## Pages");
  expect(md).toContain(`- [Home](${URL_}/)`);
});
