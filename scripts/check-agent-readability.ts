#!/usr/bin/env bun
// check-agent-readability.ts — scores a built app against Vercel's agent-readability
// spec: https://vercel.com/kb/guide/agent-readability-spec
//
// Unlike check-seo.ts (static analysis of source files), this crawls a RUNNING app —
// the spec is about what an agent actually receives over HTTP (headers, negotiated
// content, rendered HTML), which source inspection can't see. It builds + starts each
// app (unless AGENT_READABILITY_URL_<APP> points it at one already running), fetches
// every page listed in that app's own /sitemap.xml, and evaluates every site-level and
// page-level check the spec names.
//
// Score = round(passed / total × 100), where "total" excludes checks marked "n/a" for
// that page (e.g. the OpenAPI-schema check on a page that isn't API reference docs).
// Rating bands are the spec's own: 90-100 Excellent, 70-89 Good, 50-69 Fair, 0-49 Needs
// Improvement.
//
//   bun scripts/check-agent-readability.ts [apps...] [--json] [--min <score>] [--skip-build]
//
// apps... — zero or more of the discovered app names (default: all Next.js apps under
//           apps/). --skip-build reuses each app's existing .next output instead of
//           rebuilding — use it when you just built via `nx affected -t build`.

import { createServer } from "node:net";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type CheckStatus = "pass" | "fail" | "warn" | "n/a";

export interface CheckResult {
  check: string;
  status: CheckStatus;
  evidence: string;
}

const ROOT = join(import.meta.dirname, "..");
const SPEC_URL = "https://vercel.com/kb/guide/agent-readability-spec";
const DEFAULT_MIN_SCORE = 90;

const RATING_BANDS: { min: number; label: string }[] = [
  { min: 90, label: "Excellent — highly optimized for AI agents" },
  { min: 70, label: "Good — meets most requirements" },
  { min: 50, label: "Fair — has gaps" },
  { min: 0, label: "Needs Improvement" },
];

function ratingFor(points: number): string {
  return RATING_BANDS.find((b) => points >= b.min)?.label ?? "Needs Improvement";
}

// ─── HTML/text helpers ──────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
  "&apos;": "'",
};

function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#x27|#39|apos);/g, (m) => ENTITIES[m] ?? m);
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag);
  return m?.[1] !== undefined ? decodeEntities(m[1]) : undefined;
}

function firstTag(html: string, re: RegExp): string | undefined {
  return re.exec(html)?.[0];
}

function textToHtmlRatio(html: string): number {
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
  // Script/style content is excluded from BOTH sides of the ratio: React hydration
  // payload and RSC data (routinely tens of KB, unrelated to page content) would
  // otherwise swamp the denominator and make every Next.js page fail regardless of
  // how much real content it has. This is the standard text-to-code ratio definition
  // (what SEO tools like Screaming Frog measure) — markup weight vs. text weight,
  // not "everything the server happened to send."
  const markup = body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  const text = decodeEntities(markup.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return markup.length === 0 ? 0 : text.length / markup.length;
}

function jsonLdBlocks(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      const parsed: unknown = JSON.parse(m[1] ?? "");
      for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
        if (node && typeof node === "object") blocks.push(node as Record<string, unknown>);
      }
    } catch {
      // Malformed JSON-LD is caught by the caller's check, not here.
    }
  }
  return blocks;
}

// ─── Pure, per-document evaluators — no network, unit-tested directly ──────────

/**
 * Every page-level HTML check the spec names, evaluated from a rendered HTML string
 * plus the response headers it was served with. Pure — safe to feed a hand-written
 * fixture in a test, which is exactly how scripts/check-agent-readability.test.ts
 * proves this catches a real regression.
 */
export function evaluatePageHtml(html: string, headers: Headers): CheckResult[] {
  const results: CheckResult[] = [];
  const push = (check: string, status: CheckStatus, evidence: string) =>
    results.push({ check, status, evidence });

  // HTTP Response Basics
  const contentType = headers.get("content-type") ?? "";
  push(
    "Content-Type: text/html;charset=UTF-8",
    /text\/html/i.test(contentType) && /utf-8/i.test(contentType) ? "pass" : "fail",
    contentType || "(missing)",
  );
  const xRobotsTag = headers.get("x-robots-tag") ?? "";
  push(
    "x-robots-tag excludes noindex/noai/noimageai",
    /noindex|noai|noimageai/i.test(xRobotsTag) ? "fail" : "pass",
    xRobotsTag || "(not set)",
  );

  // Canonical link
  const canonicalTag = firstTag(html, /<link[^>]*rel="canonical"[^>]*>/i);
  push(
    'Canonical link (<link rel="canonical">)',
    canonicalTag && attr(canonicalTag, "href") ? "pass" : "fail",
    canonicalTag ? (attr(canonicalTag, "href") ?? "(no href)") : "(missing)",
  );

  // Meta description ≥ 50 chars
  const descTag = firstTag(html, /<meta[^>]*name="description"[^>]*>/i);
  const desc = descTag ? (attr(descTag, "content") ?? "") : "";
  push(
    "meta description ≥ 50 characters",
    desc.length >= 50 ? "pass" : "fail",
    `${desc.length} chars`,
  );

  // og:title / og:description
  const ogTitle = firstTag(html, /<meta[^>]*property="og:title"[^>]*>/i);
  push(
    "og:title",
    ogTitle && attr(ogTitle, "content") ? "pass" : "fail",
    ogTitle ? "present" : "(missing)",
  );
  const ogDesc = firstTag(html, /<meta[^>]*property="og:description"[^>]*>/i);
  push(
    "og:description",
    ogDesc && attr(ogDesc, "content") ? "pass" : "fail",
    ogDesc ? "present" : "(missing)",
  );

  // lang attribute
  const htmlTag = firstTag(html, /<html[^>]*>/i);
  const lang = htmlTag ? attr(htmlTag, "lang") : undefined;
  push("<html lang> attribute", lang ? "pass" : "fail", lang ?? "(missing)");

  // JSON-LD: dateModified + BreadcrumbList
  const nodes = jsonLdBlocks(html);
  const hasDateModified = nodes.some((n) => typeof n.dateModified === "string" && n.dateModified);
  const hasDescription = nodes.some((n) => typeof n.description === "string" && n.description);
  push(
    "JSON-LD with dateModified + description",
    hasDateModified && hasDescription ? "pass" : "fail",
    `${nodes.length} JSON-LD block(s), dateModified=${hasDateModified}, description=${hasDescription}`,
  );
  const hasBreadcrumb = nodes.some((n) => n["@type"] === "BreadcrumbList");
  push(
    "JSON-LD BreadcrumbList",
    hasBreadcrumb ? "pass" : "fail",
    hasBreadcrumb ? "present" : "(missing)",
  );

  // Headings ≥ 3 (h1-h3)
  const headingCount = (html.match(/<h[123][ >]/gi) ?? []).length;
  push("≥ 3 headings (h1-h3)", headingCount >= 3 ? "pass" : "fail", `${headingCount} heading(s)`);

  // Text-to-HTML ratio > 15%
  const ratio = textToHtmlRatio(html);
  push("Text-to-HTML ratio > 15%", ratio > 0.15 ? "pass" : "fail", `${(ratio * 100).toFixed(1)}%`);

  // Glossary link
  const hasGlossaryLink =
    /<a\b[^>]*href="[^"]*glossary[^"]*"[^>]*>|<a\b[^>]*>[^<]*glossary[^<]*<\/a>/i.test(html);
  push(
    "Glossary link",
    hasGlossaryLink ? "pass" : "fail",
    hasGlossaryLink ? "present" : "(missing)",
  );

  // Markdown alternate link
  const alternateTag = firstTag(html, /<link[^>]*rel="alternate"[^>]*type="text\/markdown"[^>]*>/i);
  push(
    '<link rel="alternate" type="text/markdown">',
    alternateTag && attr(alternateTag, "href") ? "pass" : "fail",
    alternateTag ? (attr(alternateTag, "href") ?? "(no href)") : "(missing)",
  );

  // Code blocks fenced with a language identifier — n/a if the page has none.
  const codeBlocks = [...html.matchAll(/<pre[^>]*>\s*<code([^>]*)>/gi)];
  if (codeBlocks.length === 0) {
    push("Code blocks carry a language class", "n/a", "no <pre><code> blocks on this page");
  } else {
    const allLabeled = codeBlocks.every((m) =>
      /class="[^"]*(language|lang)-[^"]+"/i.test(m[1] ?? ""),
    );
    push(
      "Code blocks carry a language class",
      allLabeled ? "pass" : "fail",
      `${codeBlocks.length} block(s), labeled=${allLabeled}`,
    );
  }

  // OpenAPI schema links — only applies to API-reference-shaped URLs, evaluated by
  // the caller (which knows the page's URL); n/a is the default here.
  push(
    "OpenAPI schema link (API reference pages only)",
    "n/a",
    "no API reference pages in this app",
  );

  return results;
}

export function evaluateRobotsTxt(text: string): CheckResult[] {
  const results: CheckResult[] = [];
  const REQUIRED_BOTS = ["GPTBot", "ClaudeBot", "CCBot", "Google-Extended"];
  const disallowedLlms = /disallow:\s*\/llms\.txt/i.test(text);
  const lines = text.split("\n");
  const blockedBots = REQUIRED_BOTS.filter((bot) => {
    let inBotBlock = false;
    for (const raw of lines) {
      const line = raw.trim();
      if (/^user-agent:/i.test(line)) inBotBlock = line.toLowerCase().includes(bot.toLowerCase());
      else if (inBotBlock && /^disallow:\s*\/\s*$/i.test(line)) return true;
    }
    return false;
  });
  results.push({
    check: "robots.txt does not block GPTBot/ClaudeBot/CCBot/Google-Extended",
    status: blockedBots.length === 0 ? "pass" : "fail",
    evidence: blockedBots.length === 0 ? "all allowed" : `blocked: ${blockedBots.join(", ")}`,
  });
  results.push({
    check: "robots.txt does not disallow /llms.txt",
    status: disallowedLlms ? "fail" : "pass",
    evidence: disallowedLlms ? "disallowed" : "allowed",
  });
  return results;
}

export function evaluateLlmsTxt(text: string, contentType: string | null): CheckResult[] {
  const htmlLinks = [...text.matchAll(/\]\(([^)]+)\)/g)].filter(([, url]) =>
    /\.html?(\?|#|$)/i.test(url ?? ""),
  );
  return [
    {
      check: "llms.txt served with Content-Type: text/plain",
      status: contentType && /text\/plain/i.test(contentType) ? "pass" : "fail",
      evidence: contentType ?? "(missing)",
    },
    {
      check: "llms.txt is not empty",
      status: text.trim().length > 0 ? "pass" : "fail",
      evidence: `${text.length} bytes`,
    },
    {
      check: "llms.txt links use .md/.mdx, not .html",
      status: htmlLinks.length === 0 ? "pass" : "fail",
      evidence: htmlLinks.length === 0 ? "no .html links" : `${htmlLinks.length} .html link(s)`,
    },
  ];
}

export function evaluateSitemapXml(text: string): CheckResult[] {
  const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const lastmods = [...text.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)];
  return [
    {
      check: "sitemap.xml is valid XML with <urlset>/<loc> entries",
      status: /<urlset/i.test(text) && locs.length > 0 ? "pass" : "fail",
      evidence: `${locs.length} <loc> entries`,
    },
    {
      check: "sitemap.xml includes <lastmod> dates",
      status: lastmods.length > 0 ? "pass" : "fail",
      evidence: `${lastmods.length} <lastmod> entries`,
    },
  ];
}

export function evaluateSitemapMd(text: string): CheckResult[] {
  const headings = (text.match(/^#{1,2} .+$/gm) ?? []).length;
  const links = (text.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length;
  return [
    {
      check: "sitemap.md contains headings and links reflecting site structure",
      status: headings >= 1 && links >= 1 ? "pass" : "fail",
      evidence: `${headings} heading(s), ${links} link(s)`,
    },
  ];
}

export function evaluateAgentsMd(text: string): CheckResult[] {
  const sections = ["install", "config", "usage"].filter((kw) => new RegExp(kw, "i").test(text));
  return [
    {
      check: "AGENTS.md is not empty",
      status: text.trim().length > 0 ? "pass" : "fail",
      evidence: `${text.length} bytes`,
    },
    {
      check: "AGENTS.md covers ≥ 2 of installation/configuration/usage",
      status: sections.length >= 2 ? "pass" : "fail",
      evidence: `covers: ${sections.join(", ") || "none"}`,
    },
  ];
}

export function evaluateMarkdownMirror(text: string, headers: Headers): CheckResult[] {
  const hasFrontmatter = /^---\n[\s\S]*?\n---/.test(text);
  const fm = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
  const hasTitle = /^title:/m.test(fm);
  const hasDescription = /^description:/m.test(fm);
  const hasLastUpdated = /^last_updated:/m.test(fm);
  const contentType = headers.get("content-type") ?? "";
  const link = headers.get("link") ?? "";
  return [
    {
      check: "Markdown mirror served as text/markdown",
      status: /text\/markdown/i.test(contentType) ? "pass" : "fail",
      evidence: contentType || "(missing)",
    },
    {
      check: "Markdown mirror frontmatter (title/description/last_updated)",
      status: hasFrontmatter && hasTitle && hasDescription && hasLastUpdated ? "pass" : "fail",
      evidence: `frontmatter=${hasFrontmatter} title=${hasTitle} description=${hasDescription} last_updated=${hasLastUpdated}`,
    },
    {
      check: "Markdown mirror includes a ## Sitemap section",
      status: /^## Sitemap/m.test(text) ? "pass" : "fail",
      evidence: /^## Sitemap/m.test(text) ? "present" : "(missing)",
    },
    {
      check: 'Markdown mirror Link header rel="canonical"',
      status: /rel="canonical"/i.test(link) ? "pass" : "fail",
      evidence: link || "(missing)",
    },
  ];
}

// ─── WebMCP — extra, non-spec section (see docs/stack/webmcp.md) ──────────────

/**
 * Evaluates `/.well-known/webmcp-tools.json` — NOT part of the agent-readability
 * spec (WebMCP has no such manifest; the imperative API only exists inside a
 * running, WebMCP-supporting browser, which this crawler is not). This is the
 * template's own convention (`@stack/webmcp`'s `toolManifest()`) for making a page's
 * WebMCP tools statically discoverable and verifiable without a browser. An app with
 * no manifest route at all fails this check rather than being exempt — every app
 * wired with @stack/webmcp is expected to serve one (docs/stack/webmcp.md).
 */
export function evaluateWebMcpManifest(response: { status: number; text?: string }): CheckResult[] {
  if (response.status === 404) {
    return [
      {
        check: "WebMCP manifest (/.well-known/webmcp-tools.json) is served",
        status: "fail",
        evidence: "HTTP 404 — not wired for this app",
      },
    ];
  }
  const results: CheckResult[] = [
    {
      check: "WebMCP manifest (/.well-known/webmcp-tools.json) is served",
      status: response.status === 200 ? "pass" : "fail",
      evidence: `HTTP ${response.status}`,
    },
  ];
  if (response.status !== 200) return results;

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.text ?? "");
  } catch {
    results.push({
      check: "WebMCP manifest is valid JSON",
      status: "fail",
      evidence: "JSON.parse failed",
    });
    return results;
  }
  results.push({ check: "WebMCP manifest is valid JSON", status: "pass", evidence: "parsed" });

  const isArray = Array.isArray(parsed);
  results.push({
    check: "WebMCP manifest is an array of tools",
    status: isArray ? "pass" : "fail",
    evidence: isArray ? `${(parsed as unknown[]).length} tool(s)` : typeof parsed,
  });
  if (!isArray) return results;

  const entries = parsed as Record<string, unknown>[];
  const wellFormed = entries.every(
    (e) =>
      typeof e.name === "string" &&
      e.name.length > 0 &&
      typeof e.description === "string" &&
      e.description.length > 0 &&
      typeof e.inputSchema === "object" &&
      e.inputSchema !== null &&
      (e.inputSchema as Record<string, unknown>).type === "object",
  );
  results.push({
    check: "Every tool has name + description + an object inputSchema",
    status: entries.length > 0 && wellFormed ? "pass" : entries.length === 0 ? "n/a" : "fail",
    evidence: entries.length === 0 ? "manifest is empty" : `well-formed=${wellFormed}`,
  });

  return results;
}

// ─── Orchestration: build/start each app, crawl it, score it ──────────────────

interface AppInfo {
  name: string;
  dir: string;
}

function discoverApps(): AppInfo[] {
  const appsDir = join(ROOT, "apps");
  return readdirSync(appsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(appsDir, d.name, "next.config.ts")))
    .map((d) => ({ name: d.name, dir: join(appsDir, d.name) }));
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      const port = typeof address === "object" && address ? address.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`${url} did not become ready within ${timeoutMs}ms`);
}

async function withRunningApp<T>(
  app: AppInfo,
  opts: { skipBuild: boolean },
  fn: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const envUrl = process.env[`AGENT_READABILITY_URL_${app.name.toUpperCase()}`];
  if (envUrl) return fn(envUrl.replace(/\/$/, ""));

  // Pick the port BEFORE building: canonical/sitemap/JSON-LD URLs are baked into
  // static pages at build time from NEXT_PUBLIC_SITE_URL, so the build has to see
  // the same origin `next start` will actually serve from — otherwise every
  // absolute URL in the crawled HTML points at the default localhost:3000 instead
  // of this run's ephemeral port, and every follow-up request 404s.
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = { ...process.env, NEXT_PUBLIC_SITE_URL: baseUrl };

  if (!opts.skipBuild) {
    // Use the app's canonical build script so this crawl proves the same build
    // users and release automation run. The script currently pins webpack for
    // Bun global-store compatibility; see docs/stack/known-issues.md.
    const build = Bun.spawn(["bun", "run", "build"], {
      cwd: app.dir,
      env,
      stdout: "inherit",
      stderr: "inherit",
    });
    const code = await build.exited;
    if (code !== 0) throw new Error(`${app.name}: \`bun run build\` failed (exit ${code})`);
  }

  const server = Bun.spawn(["bunx", "next", "start", "-p", String(port)], {
    cwd: app.dir,
    env,
    stdout: "ignore",
    stderr: "ignore",
  });
  try {
    await waitForServer(`${baseUrl}/`, 45_000);
    return await fn(baseUrl);
  } finally {
    server.kill();
    await server.exited;
  }
}

async function countRedirectHops(url: string): Promise<number> {
  let hops = 0;
  let current = url;
  for (let i = 0; i < 5; i++) {
    const res = await fetch(current, { redirect: "manual" });
    if (res.status < 300 || res.status >= 400) return hops;
    const location = res.headers.get("location");
    if (!location) return hops;
    hops++;
    current = new URL(location, current).toString();
  }
  return hops;
}

function markdownUrlFor(pageUrl: string): string {
  const u = new URL(pageUrl);
  return u.pathname === "/" ? `${u.origin}/index.md` : `${u.origin}${u.pathname}.md`;
}

/**
 * Resolves a sitemap `<loc>` entry against the app actually being crawled. Only the
 * path is trusted — the host may be baked in from a different NEXT_PUBLIC_SITE_URL
 * than the one this run built with (a stale --skip-build, a real preview deploy
 * whose sitemap legitimately says its own domain, …), so this always re-anchors to
 * `baseUrl`, the origin we know is actually listening.
 */
function resolveAgainstBase(baseUrl: string, loc: string): string {
  return `${baseUrl}${new URL(loc).pathname}`;
}

interface AppRow {
  page: string;
  results: CheckResult[];
}

interface CrawlResult {
  specRows: AppRow[];
  webmcpRows: AppRow[];
}

async function crawlApp(app: AppInfo, baseUrl: string): Promise<CrawlResult> {
  const rows: AppRow[] = [];

  const robotsText = await fetch(`${baseUrl}/robots.txt`).then((r) => r.text());
  rows.push({ page: "robots.txt", results: evaluateRobotsTxt(robotsText) });

  const sitemapXmlRes = await fetch(`${baseUrl}/sitemap.xml`);
  const sitemapXmlText = await sitemapXmlRes.text();
  rows.push({ page: "sitemap.xml", results: evaluateSitemapXml(sitemapXmlText) });

  const sitemapMdRes = await fetch(`${baseUrl}/sitemap.md`);
  rows.push({
    page: "sitemap.md",
    results:
      sitemapMdRes.status === 200
        ? evaluateSitemapMd(await sitemapMdRes.text())
        : [
            {
              check: "sitemap.md is served",
              status: "fail",
              evidence: `HTTP ${sitemapMdRes.status}`,
            },
          ],
  });

  const agentsMdRes = await fetch(`${baseUrl}/AGENTS.md`);
  rows.push({
    page: "AGENTS.md",
    results:
      agentsMdRes.status === 200
        ? evaluateAgentsMd(await agentsMdRes.text())
        : [
            {
              check: "AGENTS.md is served",
              status: "fail",
              evidence: `HTTP ${agentsMdRes.status}`,
            },
          ],
  });

  let llmsRes = await fetch(`${baseUrl}/llms.txt`);
  let llmsLabel = "llms.txt";
  if (llmsRes.status !== 200) {
    llmsRes = await fetch(`${baseUrl}/llms-full.txt`);
    llmsLabel = "llms-full.txt";
  }
  rows.push({
    page: llmsLabel,
    results:
      llmsRes.status === 200
        ? evaluateLlmsTxt(await llmsRes.text(), llmsRes.headers.get("content-type"))
        : [
            {
              check: "llms.txt or llms-full.txt is served",
              status: "fail",
              evidence: `HTTP ${llmsRes.status}`,
            },
          ],
  });

  const locs = [...sitemapXmlText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    resolveAgainstBase(baseUrl, m[1]!),
  );
  for (const pageUrl of locs) {
    const results: CheckResult[] = [];
    const push = (r: CheckResult) => results.push(r);

    const pageRes = await fetch(pageUrl);
    push({
      check: "HTTP 200",
      status: pageRes.status === 200 ? "pass" : "fail",
      evidence: `HTTP ${pageRes.status}`,
    });
    const hops = await countRedirectHops(pageUrl);
    push({
      check: "Redirect chain ≤ 1 hop",
      status: hops <= 1 ? "pass" : "fail",
      evidence: `${hops} hop(s)`,
    });

    const html = await pageRes.text();
    results.push(...evaluatePageHtml(html, pageRes.headers));

    // Markdown mirror + content negotiation — live, not pure (needs two more requests).
    const mdUrl = markdownUrlFor(pageUrl);
    const mdRes = await fetch(mdUrl);
    if (mdRes.status === 200) {
      results.push(...evaluateMarkdownMirror(await mdRes.text(), mdRes.headers));
    } else {
      push({
        check: "Markdown mirror is served at .md",
        status: "fail",
        evidence: `HTTP ${mdRes.status} at ${mdUrl}`,
      });
    }

    const negotiatedRes = await fetch(pageUrl, { headers: { accept: "text/markdown" } });
    const negotiatedType = negotiatedRes.headers.get("content-type") ?? "";
    push({
      check: "Content negotiation: Accept: text/markdown → text/markdown",
      status: /text\/markdown/i.test(negotiatedType) ? "pass" : "fail",
      evidence: negotiatedType || "(unchanged)",
    });

    rows.push({ page: pageUrl, results });
  }

  // WebMCP — extra, non-spec section, reported and scored separately (see
  // docs/stack/webmcp.md). One manifest per app, not per page: an app registers its
  // tools app-wide, not per route.
  const manifestRes = await fetch(`${baseUrl}/.well-known/webmcp-tools.json`);
  const webmcpRows: AppRow[] = [
    {
      page: ".well-known/webmcp-tools.json",
      results: evaluateWebMcpManifest({
        status: manifestRes.status,
        text: manifestRes.status === 200 ? await manifestRes.text() : undefined,
      }),
    },
  ];

  return { specRows: rows, webmcpRows };
}

function score(rows: AppRow[]): { passed: number; total: number; score: number } {
  const all = rows.flatMap((r) => r.results).filter((r) => r.status !== "n/a");
  const passed = all.filter((r) => r.status === "pass").length;
  const total = all.length;
  return { passed, total, score: total === 0 ? 0 : Math.round((passed / total) * 100) };
}

function printTable(heading: string, rows: AppRow[]): void {
  console.log(`\n── ${heading} ──`);
  for (const { page, results } of rows) {
    for (const r of results) {
      const mark = { pass: "✓", fail: "✗", warn: "!", "n/a": "·" }[r.status];
      console.log(`  ${mark} [${r.status.padEnd(4)}] ${page} — ${r.check} (${r.evidence})`);
    }
  }
}

function parseArgs(argv: string[]) {
  const apps: string[] = [];
  let json = false;
  let min = DEFAULT_MIN_SCORE;
  let skipBuild = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") json = true;
    else if (arg === "--skip-build") skipBuild = true;
    else if (arg === "--min") min = Number(argv[++i]);
    else if (arg && !arg.startsWith("--")) apps.push(arg);
  }
  return { apps, json, min, skipBuild };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const discovered = discoverApps();
  const targets =
    opts.apps.length > 0 ? discovered.filter((a) => opts.apps.includes(a.name)) : discovered;
  if (targets.length === 0) {
    console.error(
      `No matching apps found (discovered: ${discovered.map((a) => a.name).join(", ")}).`,
    );
    process.exit(2);
  }

  const summary: { app: string; passed: number; total: number; score: number }[] = [];
  const webmcpSummary: { app: string; passed: number; total: number }[] = [];
  const failing: string[] = [];

  for (const app of targets) {
    const { specRows, webmcpRows } = await withRunningApp(
      app,
      { skipBuild: opts.skipBuild },
      (baseUrl) => crawlApp(app, baseUrl),
    );
    if (!opts.json) printTable(app.name, specRows);
    const { passed, total, score: s } = score(specRows);
    summary.push({ app: app.name, passed, total, score: s });
    if (s < opts.min) failing.push(app.name);

    if (!opts.json) printTable(`${app.name} — WebMCP (extra, non-spec)`, webmcpRows);
    const webmcp = score(webmcpRows);
    webmcpSummary.push({ app: app.name, passed: webmcp.passed, total: webmcp.total });
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        { spec: SPEC_URL, min: opts.min, apps: summary, webmcp: webmcpSummary },
        null,
        2,
      ),
    );
  } else {
    console.log(`\n── Scores (spec: ${SPEC_URL}) ──`);
    for (const s of summary) {
      console.log(
        `  ${s.app}: ${s.score}/100 (${s.passed}/${s.total} checks) — ${ratingFor(s.score)}`,
      );
    }
    console.log(
      `\n── WebMCP (extra, non-spec — informational, does not affect the score above) ──`,
    );
    for (const w of webmcpSummary) {
      console.log(`  ${w.app}: ${w.passed}/${w.total} checks`);
    }
  }

  if (failing.length > 0) {
    console.error(`\n✖ check:agent-readability — below --min ${opts.min}: ${failing.join(", ")}`);
    process.exit(1);
  }
  console.log(`\n✓ check:agent-readability — every app ≥ ${opts.min}.`);
}

if (import.meta.main) await main();
