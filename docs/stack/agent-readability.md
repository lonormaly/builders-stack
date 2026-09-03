# Agent readability

Whether an AI agent — not a human browser, not a search-engine crawler — can actually
read, cite, and act on your deployed site: markdown mirrors, content negotiation,
machine-readable indexes, and structured data with freshness signals. Scored against
[Vercel's agent-readability spec](https://vercel.com/kb/guide/agent-readability-spec)
by `bun run check:agent-readability`, which crawls a **built, running** app (not
source files — the spec is about what an agent receives over HTTP).

This is a different concern from `check:seo` (docs/writing-for-ai-search.md), which
enforces that public pages are server-rendered and carry metadata for classic
search/AI-Overview crawling. Agent readability is about a coding/browsing **agent**
reading the site directly — a different audience, a different spec, a separate gate.

## What the template guarantees, out of the box

All three apps (`apps/web`, `apps/landing`, `apps/blog`) already score 90+ ("Excellent"):

| App     | Score   |
| ------- | ------- |
| landing | 100/100 |
| blog    | 100/100 |
| web     | 98/100  |

- **`/AGENTS.md`** on every app — installation, configuration, and usage for the
  _deployed site_ (distinct from the repo's own root `AGENTS.md`, which instructs an
  agent working _inside_ the codebase).
- **`/sitemap.md`** — headings + links reflecting site structure, alongside `sitemap.xml`.
- **Markdown mirrors** for every public page — append `.md` to any URL (e.g.
  `/privacy.md`), or send `Accept: text/markdown` to the HTML URL and get the same
  content back. Frontmatter carries `title`, `description`, `last_updated`; the body
  ends with a `## Sitemap` section; the response carries a `Link: rel="canonical"`
  header.
- **`<link rel="alternate" type="text/markdown">`** on every HTML page, pointing at
  its mirror.
- **Structured data with a freshness signal** — every page carries JSON-LD with
  `dateModified`, `description`, and a `BreadcrumbList` (`webPageJsonLd()` for
  non-article pages, `articleJsonLd()` for blog posts — both already set
  `dateModified`).
- **A glossary** (`apps/web/glossary`) that every other page links to.
- **`llms.txt` / `llms-full.txt`** on every app (not a ranking lever — see the honest
  framing in each app's `app/llms.ts` — but a required site-level check here).
- **`robots.txt`** already allows the full AI-crawler roster (`aiCrawlerRules()` in
  `@stack/seo`) and never disallows `/llms.txt`.

## How it works

### The shared plumbing — `@stack/seo`'s `agent-readability.ts`

Every app wires the same three pieces from `libs/seo/src/agent-readability.ts`:

1. **`markdownRewriteTarget(pathname, accept)`** — a pure function (no Next.js
   import, unit-tested directly) deciding whether a request wants the markdown
   mirror: an explicit `.md` suffix, or an `Accept` header that prefers
   `text/markdown` over `text/html`. Returns the internal path
   (`/api/md/<page>`) to rewrite to, or `null` to pass through.
2. Each app's **`proxy.ts`** (Next 16's name for `middleware.ts`) calls that function
   and `NextResponse.rewrite()`s when it returns non-null. `apps/web` and
   `apps/landing` already had a `proxy.ts` for a per-request CSP nonce — the rewrite
   is merged into that existing function rather than adding a second one (Next.js
   allows exactly one `proxy.ts`/`middleware.ts` per app). `apps/blog` had none, so
   its `proxy.ts` is markdown-negotiation only.
3. Each app's **`app/api/md/[...path]/route.ts`** — a single catch-all Route Handler
   that looks up the page's content and returns it via **`markdownResponse()`**
   (frontmatter + body + `## Sitemap` section + headers). `apps/web` and
   `apps/landing` keep a small hand-written `md-content.ts` registry (their pages are
   marketing/product copy, not prose worth auto-extracting from JSX).
   `apps/blog` doesn't need one — a post's markdown mirror IS its own MDX source
   (`getPost(slug).content`, frontmatter already stripped), so the mirror is exactly
   the first-hand prose the author wrote, not a generated summary.

`pageMetadata()` (in `@stack/seo`) gained a `markdownMirror: true` option that emits
the `<link rel="alternate">` tag — pass it alongside `path` and the URL is derived
automatically (`/` → `/index.md`, `/foo` → `/foo.md`).

`/AGENTS.md` and `/sitemap.md` are literal-folder routes
(`app/AGENTS.md/route.ts`, `app/sitemap.md/route.ts`) — the same pattern this
template already used for `/llms.txt`. `textFileResponse()` and `sitemapMd()` in
`@stack/seo` are the shared plumbing for those.

### The checker — `scripts/check-agent-readability.ts`

For each app it discovers (any `apps/*` with a `next.config.ts`):

1. Builds it (`bun run build`) and starts it (`next start`) on an ephemeral port —
   unless `AGENT_READABILITY_URL_<APP>` (e.g. `AGENT_READABILITY_URL_WEB`) points it
   at an already-running instance, in which case it skips straight to crawling that
   URL. `NEXT_PUBLIC_SITE_URL` is pinned to that ephemeral port **before** the build
   runs, because canonical/sitemap/JSON-LD URLs are baked into static pages at build
   time — building with the wrong origin would make every follow-up request 404.
2. Fetches `/robots.txt`, `/sitemap.xml`, `/sitemap.md`, `/AGENTS.md`,
   `/llms.txt`/`/llms-full.txt` (the site-level checks), then every URL listed in
   `/sitemap.xml` (the page-level checks — this is what defines "public page" for
   this checker, the same way `check-seo.ts` uses a private-route naming convention).
3. Evaluates every check the spec names by exact name, prints a
   `check · status · evidence` table, and prints `score = round(passed / total × 100)`
   per app — `n/a` checks (e.g. the OpenAPI-schema check on a page that isn't API
   reference docs, or the code-block-language check on a page with no code blocks)
   are excluded from both numerator and denominator, not counted as passes.

```
bun scripts/check-agent-readability.ts [apps...] [--json] [--min <score>] [--skip-build]
```

`--min` (default 90) gates the run: any app scoring below it exits 1. `--skip-build`
reuses an app's existing `.next` output — use it after `nx affected -t build` already
ran.

### CI wiring

- **Fast lane** (`ops/ci/fast.ts`) — `check:agent-readability` runs whenever a diff
  touches `apps/*` or `libs/seo/` (same trigger surface as `check:seo`, since the seo
  lib owns the shared markdown-mirror/content-negotiation plumbing every app
  depends on). It is deliberately **not** in the local `bun run check` composite
  (like `check:seo` is) — it builds and starts three Next apps, which doesn't fit a
  pre-push hook's speed budget.
- **Release proof** (`ops/ci/release-proof.sh`) — runs after `nx affected -t build`,
  unconditionally checking all three apps (not just the ones a diff touched), since
  it's proving what's about to ship, not what changed.

## Reading the score

Rating bands are the spec's own:

| Score  | Rating            |
| ------ | ----------------- |
| 90–100 | Excellent         |
| 70–89  | Good              |
| 50–69  | Fair              |
| 0–49   | Needs Improvement |

## Fixing a failing check

The table's `evidence` column names exactly what's missing. Common fixes, by check:

| Check                                                  | Fix                                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical link / og:title / description                | Pass a `description` (≥ 50 chars) to `pageMetadata()`; canonical + og:* come free.                                                                                                                                                                              |
| `<html lang>`                                          | Set `<html lang="en">` in the app's root `layout.tsx`.                                                                                                                                                                                                          |
| JSON-LD dateModified / BreadcrumbList                  | Render `<JsonLd data={[webPageJsonLd(...), breadcrumbJsonLd(...)]} />` (or `articleJsonLd()` for a post) on the page.                                                                                                                                           |
| ≥ 3 headings                                           | shadcn/ui's `CardTitle` renders a `<div>`, not a heading — a page built entirely from `Card`s can have zero real headings. Add real `<h2>`/`<h3>` tags.                                                                                                         |
| Text-to-HTML ratio > 15%                               | A page that's mostly interactive components (buttons, badges, forms) with little prose will read low — add genuine, useful explanatory copy, not padding (see `docs/writing-for-ai-search.md`'s "don't chunk content for AI" guidance, which applies here too). |
| Glossary link                                          | Link to `${NEXT_PUBLIC_APP_URL}/glossary` from the page (any anchor whose href or text contains "glossary").                                                                                                                                                    |
| Markdown mirror / alternate link / content negotiation | Add the page's path + content to that app's `md-content.ts` registry (or, for a content-driven app like the blog, wire it to the real content source) and add `markdownMirror: true` to its `pageMetadata()` call.                                              |
| robots.txt blocking a bot                              | Don't remove a bot from `AI_CRAWLERS` in `libs/seo/src/crawlers.ts` unless you mean to opt out of citation from that engine — see the file's own GEO note.                                                                                                      |

## Extra, non-spec section — WebMCP

The checker also runs a **WebMCP** section per app (not part of the spec's score,
reported separately) — see `docs/stack/webmcp.md`.
