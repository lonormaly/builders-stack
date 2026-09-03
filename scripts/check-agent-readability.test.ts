// Unit tests for the pure evaluators behind check:agent-readability — no build, no
// server, just hand-written fixtures. The point of this file (per the repo's "every
// guard must be seen red" rule): prove the gate actually catches a violation, not just
// that it passes on already-compliant HTML.
import { describe, expect, test } from "bun:test";
import {
  evaluateAgentsMd,
  evaluateLlmsTxt,
  evaluateMarkdownMirror,
  evaluatePageHtml,
  evaluateRobotsTxt,
  evaluateSitemapMd,
  evaluateSitemapXml,
  evaluateWebMcpManifest,
} from "./check-agent-readability";

const GOOD_JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Privacy",
    url: "https://example.com/privacy",
    description: "How this project collects, uses, and protects personal data.",
    dateModified: "2026-07-02",
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://example.com/" },
    ],
  },
];

function compliantHtml(overrides: Partial<{ jsonLd: unknown[] }> = {}): string {
  const jsonLd = overrides.jsonLd ?? GOOD_JSON_LD;
  return `<!doctype html>
<html lang="en">
<head>
  <link rel="canonical" href="https://example.com/privacy">
  <meta name="description" content="How this project collects, uses, and protects personal data — a starter template to adapt with your own counsel.">
  <meta property="og:title" content="Privacy Policy">
  <meta property="og:description" content="How this project collects, uses, and protects personal data.">
  <link rel="alternate" type="text/markdown" href="https://example.com/privacy.md">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p>Long enough body copy to keep the text-to-HTML ratio healthy across this fixture, well past the fifteen percent threshold the spec names, written as plain readable prose rather than markup-heavy structure.</p>
  <h2>Who we are</h2>
  <p>More real prose content, again long enough on its own to keep this fixture's ratio comfortably over the line without leaning on markup padding.</p>
  <h2>Your rights</h2>
  <p>Even more prose so the ratio holds regardless of how the other tags in this fixture are counted by the checker.</p>
  <a href="/glossary">Glossary</a>
</body>
</html>`;
}

const HEADERS_OK = new Headers({ "content-type": "text/html; charset=utf-8" });

describe("evaluatePageHtml — the guard is seen red", () => {
  test("a compliant page passes every check that isn't n/a", () => {
    const results = evaluatePageHtml(compliantHtml(), HEADERS_OK);
    const failing = results.filter((r) => r.status === "fail");
    expect(failing).toEqual([]);
  });

  test("RED: missing canonical link is caught", () => {
    const broken = compliantHtml().replace(
      '<link rel="canonical" href="https://example.com/privacy">',
      "",
    );
    const results = evaluatePageHtml(broken, HEADERS_OK);
    const canonical = results.find((r) => r.check.startsWith("Canonical link"));
    expect(canonical?.status).toBe("fail");
  });

  test("RED: a description under 50 characters is caught", () => {
    const broken = compliantHtml().replace(
      /<meta name="description" content="[^"]*">/,
      '<meta name="description" content="Too short.">',
    );
    const results = evaluatePageHtml(broken, HEADERS_OK);
    const desc = results.find((r) => r.check.startsWith("meta description"));
    expect(desc?.status).toBe("fail");
    expect(desc?.evidence).toBe("10 chars");
  });

  test("RED: fewer than 3 headings is caught", () => {
    const broken = compliantHtml().replace(/<h2>[\s\S]*?<\/h2>/g, "");
    const results = evaluatePageHtml(broken, HEADERS_OK);
    const headings = results.find((r) => r.check.startsWith("≥ 3 headings"));
    expect(headings?.status).toBe("fail");
  });

  test("RED: JSON-LD missing dateModified is caught", () => {
    const withoutDate = GOOD_JSON_LD.map((n) =>
      n["@type"] === "WebPage" ? { ...n, dateModified: undefined } : n,
    );
    const broken = compliantHtml({ jsonLd: withoutDate });
    const results = evaluatePageHtml(broken, HEADERS_OK);
    const jsonLd = results.find((r) => r.check.startsWith("JSON-LD with dateModified"));
    expect(jsonLd?.status).toBe("fail");
  });

  test("RED: missing BreadcrumbList is caught", () => {
    const broken = compliantHtml({ jsonLd: [GOOD_JSON_LD[0]!] });
    const results = evaluatePageHtml(broken, HEADERS_OK);
    const breadcrumb = results.find((r) => r.check === "JSON-LD BreadcrumbList");
    expect(breadcrumb?.status).toBe("fail");
  });

  test("RED: no glossary link is caught", () => {
    const broken = compliantHtml().replace('<a href="/glossary">Glossary</a>', "");
    const results = evaluatePageHtml(broken, HEADERS_OK);
    const glossary = results.find((r) => r.check === "Glossary link");
    expect(glossary?.status).toBe("fail");
  });

  test("RED: text-to-HTML ratio at or below 15% is caught", () => {
    const thin = `<!doctype html><html lang="en"><head>
      <link rel="canonical" href="https://example.com/thin">
      <meta name="description" content="${"x".repeat(60)}">
      <meta property="og:title" content="T"><meta property="og:description" content="D">
      <link rel="alternate" type="text/markdown" href="https://example.com/thin.md">
      <script type="application/ld+json">${JSON.stringify(GOOD_JSON_LD)}</script>
      </head><body>${'<div class="a-very-long-class-name-that-pads-html-without-adding-text"></div>'.repeat(40)}<h1>T</h1><h2>T</h2><h3>T</h3></body></html>`;
    const results = evaluatePageHtml(thin, HEADERS_OK);
    const ratio = results.find((r) => r.check.startsWith("Text-to-HTML ratio"));
    expect(ratio?.status).toBe("fail");
  });

  test("RED: an x-robots-tag with noindex is caught", () => {
    const headers = new Headers({
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex",
    });
    const results = evaluatePageHtml(compliantHtml(), headers);
    const robotsTag = results.find((r) => r.check.startsWith("x-robots-tag"));
    expect(robotsTag?.status).toBe("fail");
  });

  test("unlabeled code blocks are caught; a page with none is n/a, not pass", () => {
    const withCode = compliantHtml().replace(
      "</body>",
      "<pre><code>const x = 1;</code></pre></body>",
    );
    const labeled = evaluatePageHtml(withCode, HEADERS_OK).find((r) =>
      r.check.startsWith("Code blocks"),
    );
    expect(labeled?.status).toBe("fail");

    const withoutCode = evaluatePageHtml(compliantHtml(), HEADERS_OK).find((r) =>
      r.check.startsWith("Code blocks"),
    );
    expect(withoutCode?.status).toBe("n/a");
  });
});

describe("robots.txt / llms.txt / sitemap.xml / sitemap.md / AGENTS.md evaluators", () => {
  test("RED: robots.txt blocking GPTBot is caught", () => {
    const robots = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n";
    const results = evaluateRobotsTxt(robots);
    const botCheck = results.find((r) => r.check.includes("GPTBot"));
    expect(botCheck?.status).toBe("fail");
    expect(botCheck?.evidence).toContain("GPTBot");
  });

  test("a permissive robots.txt passes", () => {
    const robots = "User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nAllow: /\n";
    const results = evaluateRobotsTxt(robots);
    expect(results.every((r) => r.status === "pass")).toBe(true);
  });

  test("RED: llms.txt linking .html pages is caught", () => {
    const results = evaluateLlmsTxt(
      "# Site\n\n- [Home](https://example.com/index.html)\n",
      "text/plain",
    );
    const htmlLinks = results.find((r) => r.check.includes(".md/.mdx"));
    expect(htmlLinks?.status).toBe("fail");
  });

  test("RED: sitemap.xml without <lastmod> is caught", () => {
    const xml = '<?xml version="1.0"?><urlset><url><loc>https://example.com/</loc></url></urlset>';
    const results = evaluateSitemapXml(xml);
    const lastmod = results.find((r) => r.check.includes("lastmod"));
    expect(lastmod?.status).toBe("fail");
  });

  test("RED: sitemap.md without links is caught", () => {
    const results = evaluateSitemapMd("# Sitemap\n\nNo links here.\n");
    expect(results[0]?.status).toBe("fail");
  });

  test("RED: AGENTS.md missing installation/configuration/usage is caught", () => {
    const results = evaluateAgentsMd("# Agents\n\nJust a title, nothing else.\n");
    const coverage = results.find((r) => r.check.includes("installation/configuration/usage"));
    expect(coverage?.status).toBe("fail");
  });

  test("RED: a markdown mirror without a Sitemap section is caught", () => {
    const md =
      '---\ntitle: "Privacy"\ndescription: "d"\nlast_updated: "2026-07-02"\n---\n\nBody only.\n';
    const headers = new Headers({
      "content-type": "text/markdown; charset=utf-8",
      link: '<https://example.com/privacy>; rel="canonical"',
    });
    const results = evaluateMarkdownMirror(md, headers);
    const sitemapSection = results.find((r) => r.check.includes("## Sitemap"));
    expect(sitemapSection?.status).toBe("fail");
  });
});

describe("evaluateWebMcpManifest — extra, non-spec section", () => {
  test("a well-formed manifest passes every check", () => {
    const manifest = [
      {
        name: "search_glossary",
        description: "Look up a term.",
        inputSchema: { type: "object", properties: { query: { type: "string" } } },
      },
    ];
    const results = evaluateWebMcpManifest({ status: 200, text: JSON.stringify(manifest) });
    expect(results.every((r) => r.status === "pass")).toBe(true);
  });

  test("RED: no manifest route at all (404) is caught, not exempted", () => {
    const results = evaluateWebMcpManifest({ status: 404 });
    expect(results[0]?.status).toBe("fail");
  });

  test("RED: invalid JSON is caught", () => {
    const results = evaluateWebMcpManifest({ status: 200, text: "{not json" });
    const validJson = results.find((r) => r.check.includes("valid JSON"));
    expect(validJson?.status).toBe("fail");
  });

  test("RED: a manifest that isn't an array is caught", () => {
    const results = evaluateWebMcpManifest({ status: 200, text: JSON.stringify({ name: "x" }) });
    const isArray = results.find((r) => r.check.includes("array of tools"));
    expect(isArray?.status).toBe("fail");
  });

  test("RED: a tool missing description or a non-object inputSchema is caught", () => {
    const manifest = [{ name: "broken", inputSchema: { type: "string" } }];
    const results = evaluateWebMcpManifest({ status: 200, text: JSON.stringify(manifest) });
    const wellFormed = results.find((r) => r.check.includes("Every tool has"));
    expect(wellFormed?.status).toBe("fail");
  });

  test("an empty manifest array is n/a for well-formedness, not a false pass", () => {
    const results = evaluateWebMcpManifest({ status: 200, text: "[]" });
    const wellFormed = results.find((r) => r.check.includes("Every tool has"));
    expect(wellFormed?.status).toBe("n/a");
  });
});
