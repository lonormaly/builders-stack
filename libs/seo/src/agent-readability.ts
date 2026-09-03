// Shared plumbing for the Agent Readability spec (Vercel):
// https://vercel.com/kb/guide/agent-readability-spec
//
// Three things live here, all app-agnostic:
//   1. markdownResponse()   — turn page content into a spec-shaped markdown mirror
//      (frontmatter + body + "## Sitemap" section + the right headers).
//   2. markdownRewriteTarget() — the pure routing decision behind content negotiation:
//      given a request path + Accept header, does this request want the markdown
//      mirror instead of the HTML page, and if so, which internal route serves it?
//      Pure (no Next.js import) so it's unit-testable without a server — each app's
//      `middleware.ts` is a ~6-line wrapper that calls this and does the rewrite.
//   3. textFileResponse() + sitemapMd() — the literal-text routes (AGENTS.md,
//      sitemap.md) every app serves the same way llms.txt already does.
//
// Every app owns its OWN content (titles, descriptions, markdown bodies) — this file
// only owns the shape and the plumbing, so apps don't each reinvent frontmatter,
// content-negotiation matching, or response headers.

/** Frontmatter every markdown mirror carries, per the spec's "Markdown Mirrors" check. */
export interface MarkdownFrontmatter {
  title: string;
  description: string;
  /** Omit when the page has no separate version scheme from the site itself. */
  docVersion?: string;
  /** ISO 8601 date, e.g. "2026-07-02" — the freshness signal the spec checks for. */
  lastUpdated: string;
}

export interface MarkdownPageInput extends MarkdownFrontmatter {
  /** Canonical absolute URL of the HTML page this markdown mirrors. */
  canonicalUrl: string;
  /** Absolute URL of the site's /sitemap.md — every mirror links back to it. */
  sitemapUrl: string;
  /** Markdown body. Frontmatter and the "## Sitemap" section are added automatically. */
  body: string;
}

function escapeYamlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function frontmatterBlock(fm: MarkdownFrontmatter): string {
  const lines = [
    "---",
    `title: "${escapeYamlString(fm.title)}"`,
    `description: "${escapeYamlString(fm.description)}"`,
    ...(fm.docVersion ? [`doc_version: "${escapeYamlString(fm.docVersion)}"`] : []),
    `last_updated: "${fm.lastUpdated}"`,
    "---",
  ];
  return lines.join("\n");
}

/** The full markdown document: frontmatter + body + a "## Sitemap" section. */
export function markdownPage(input: MarkdownPageInput): string {
  return (
    `${frontmatterBlock(input)}\n\n${input.body.trim()}\n\n` +
    `## Sitemap\n\n[Full site map](${input.sitemapUrl})\n`
  );
}

/**
 * A Response ready to return from a Next.js Route Handler for a markdown mirror.
 * Sets `Content-Type: text/markdown` and the `Link: rel="canonical"` header the spec
 * requires on markdown responses.
 */
export function markdownResponse(input: MarkdownPageInput): Response {
  return new Response(markdownPage(input), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      link: `<${input.canonicalUrl}>; rel="canonical"`,
    },
  });
}

// Paths that are already their own literal-text routes (llms.txt, robots.txt, the
// sitemap.md/AGENTS.md routes below, …) — content negotiation must never rewrite these,
// they already ARE the machine-readable format.
const NEVER_REWRITE = new Set([
  "/robots.txt",
  "/sitemap.xml",
  "/sitemap.md",
  "/llms.txt",
  "/llms-full.txt",
  "/AGENTS.md",
]);

/**
 * The pure routing decision behind markdown content negotiation. Given a request's
 * pathname and `Accept` header, returns the internal path that serves its markdown
 * mirror (always under `/api/md/...`, matching `app/api/md/[...path]/route.ts`), or
 * `null` when the request should pass through untouched.
 *
 * Two ways in, per the spec:
 *   - Explicit `.md` suffix on the URL ("Markdown Mirrors": every HTML page has a
 *     `.md`/`.mdx` version).
 *   - `Accept: text/markdown` on the original HTML URL ("Content Negotiation").
 *
 * No Next.js import — a Next `middleware.ts` is a thin wrapper around this, and this
 * function itself is tested with plain strings.
 */
export function markdownRewriteTarget(pathname: string, accept: string | null): string | null {
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) return null;
  if (NEVER_REWRITE.has(pathname)) return null;

  if (pathname.endsWith(".md")) {
    const page = pathname.slice(0, -".md".length);
    return `/api/md${page === "" || page === "/" ? "/index" : page}`;
  }

  // Anything else with a dot in its last segment is a real asset (.css, .png, .ico,
  // an already-handled .xml/.txt route, …), never a page — leave it alone.
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  if (lastSegment.includes(".")) return null;

  if (accept && prefersMarkdown(accept)) {
    return `/api/md${pathname === "/" ? "/index" : pathname}`;
  }
  return null;
}

/** True when an `Accept` header lists `text/markdown` at a weight ≥ `text/html`'s. */
function prefersMarkdown(accept: string): boolean {
  const weights = new Map<string, number>();
  for (const part of accept.split(",")) {
    const [rawType, ...params] = part.trim().split(";");
    const type = rawType?.trim();
    if (!type) continue;
    const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    weights.set(type, qParam ? Number(qParam.slice("q=".length)) : 1);
  }
  const markdown = weights.get("text/markdown");
  if (markdown === undefined || markdown <= 0) return false;
  const html = weights.get("text/html") ?? weights.get("*/*") ?? 0;
  return markdown >= html;
}

/** A plain-text (markdown-formatted) Response — for AGENTS.md and sitemap.md routes. */
export function textFileResponse(body: string): Response {
  return new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8" } });
}

export interface SitemapMdSection {
  heading: string;
  links: { title: string; url: string }[];
}

/**
 * Builds `/sitemap.md`: headings + links reflecting site structure, per the spec's
 * "Sitemap (Markdown)" check. Pair with `textFileResponse()` in `app/sitemap.md/route.ts`.
 */
export function sitemapMd(siteName: string, sections: SitemapMdSection[]): string {
  const body = sections
    .map((s) => `## ${s.heading}\n\n${s.links.map((l) => `- [${l.title}](${l.url})`).join("\n")}`)
    .join("\n\n");
  return `# ${siteName} — Sitemap\n\n${body}\n`;
}
