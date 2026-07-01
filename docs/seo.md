# SEO / GEO / LLM-friendliness

How the web-facing apps are made legible to **search engines**, **AI answer engines**
(GEO — Generative Engine Optimization), and **coding agents**. Everything below is a
Next.js App-Router built-in — no extra dependencies — and every URL is derived from an
**env var**, never hardcoded.

## Three files people confuse — who reads what

| File             | Audience                                                                 | Lives                   | Purpose                                                                   |
| ---------------- | ------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------- |
| **`AGENTS.md`**  | Coding agents working _inside this repo_ (Claude Code, Cursor, Copilot…) | Repo root               | How to build/test/navigate the codebase                                   |
| **`llms.txt`**   | LLMs reading the _deployed site_ at query time                           | Served at `/llms.txt`   | A curated, plain-text map of the product so AI answers cite it accurately |
| **`robots.txt`** | Crawlers (search + AI)                                                   | Served at `/robots.txt` | Crawl policy: who may fetch what                                          |

Short version: **`AGENTS.md` is for agents editing your code; `llms.txt` is for LLMs
reading your live pages; `robots.txt` is the doorman.** They do not overlap.

## What each app ships

Source of truth for the origin + crawler roster is **`app/seo.ts`** in each app.
Everything else imports from it.

### `apps/landing` (public marketing site — the priority surface)

- **`app/robots.ts`** → `/robots.txt`. Allows all search + AI crawlers and points to the
  sitemap. The full 2026 AI-crawler roster is enumerated in `app/seo.ts` (`AI_CRAWLERS`)
  with a per-bot opt-out example inline.
- **`app/sitemap.ts`** → `/sitemap.xml`, generated from the route list.
- **`app/llms.txt/route.ts`** + **`app/llms-full.txt/route.ts`** → `/llms.txt` and
  `/llms-full.txt` in [llmstxt.org](https://llmstxt.org) format (`# Name`, `> summary`,
  `## Section` blocks of `- [title](url): description`). Served as route handlers, not a
  static `public/` file, so their internal URLs come from `SITE_URL` (env) — see the
  builder in `app/llms.ts`.
- **`app/layout.tsx`** → App-Router `metadata`: title template, description, keywords,
  canonical, Open Graph, Twitter card, `metadataBase`; plus JSON-LD structured data
  (`SoftwareApplication` + `WebSite` + `Organization`) as a `<script type="application/ld+json">`.
- **`app/opengraph-image.tsx`** → generated 1200×630 OG/Twitter image via `next/og`
  `ImageResponse`, styled from the shared `@stack/ui/tokens` palette. Next auto-wires it
  as `og:image` and `twitter:image` for every route.

### `apps/web` (the app — lighter touch)

- **`app/robots.ts`** — allow all, `disallow: /auth` (keep the login screen out of the
  index). The `*` rule already covers the named AI bots; the annotated list lives in
  landing's `seo.ts`.
- **`app/sitemap.ts`** — only the public `/` route (auth/health are internal).
- **`app/layout.tsx`** — `metadataBase`, title template, description, Open Graph, Twitter.
- **`app/opengraph-image.tsx`** — same `next/og` pattern as landing.

No `llms.txt` for `apps/web`: it's the application surface, not a marketing/content
surface, so there's nothing to hand an answer engine there.

## AI crawler roster (2026)

Enumerated in `apps/landing/app/seo.ts`. Verified June 2026 against operator docs and the
2026 crawler references (anagram.ai, nohacks.co, openshadow.io). Grouped by operator, each
tagged by purpose:

- **training** — builds the model's long-term knowledge (opt out ⇒ your content isn't used to train it)
- **search** — indexes for live retrieval inside AI answers (opt out ⇒ you lose AI-search citations)
- **user** — on-demand fetch when a user pastes/asks about your URL

| Operator     | training                      | search             | user              |
| ------------ | ----------------------------- | ------------------ | ----------------- |
| OpenAI       | `GPTBot`                      | `OAI-SearchBot`    | `ChatGPT-User`    |
| Anthropic    | `ClaudeBot`                   | `Claude-SearchBot` | `Claude-User`     |
| Perplexity   | —                             | `PerplexityBot`    | `Perplexity-User` |
| Google       | `Google-Extended`             | —                  | —                 |
| Apple        | `Applebot-Extended`           | —                  | —                 |
| Amazon       | `Amazonbot` (search/training) |                    |                   |
| Meta         | `Meta-ExternalAgent`          | —                  | —                 |
| ByteDance    | `Bytespider`                  | —                  | —                 |
| Common Crawl | `CCBot`                       | —                  | —                 |
| Cohere       | `cohere-ai`                   | —                  | —                 |

**GEO tip:** to protect training data but stay citable, DISALLOW the `training` bots and
keep the `search` + `user` bots allowed. `Bytespider` and Perplexity's stealth crawlers
have documented histories of ignoring `robots.txt`, so treat `robots.txt` as a request,
not an enforcement boundary.

### The llms.txt standard, honestly

As of 2026 `llms.txt` is a **community proposal** (llmstxt.org), not an IETF/W3C standard.
IDE/coding agents fetch it routinely; adoption by the big answer engines for _ranking_ is
still unproven. It's cheap and low-risk, so we ship it — but don't expect it to move
rankings on its own. The high-signal wins are the structured data, clean semantic HTML,
and a fast, crawlable site.

## Customize for your product + domain

1. **Set your domain** — add to each app's env (e.g. `.env.local`, and inject via the
   Tiltfile for local dev the way `NEXT_PUBLIC_APP_URL` already is):
   ```
   NEXT_PUBLIC_SITE_URL=https://your-domain.com
   ```
   Everything (canonical, OG URLs, sitemap, robots host, llms.txt links) derives from it.
2. **Rewrite the copy** — product name, description, keywords, and JSON-LD in
   `apps/*/app/layout.tsx`; the summary + sections in `apps/landing/app/llms.ts`.
3. **Restyle the OG image** — `apps/*/app/opengraph-image.tsx` (pulls `@stack/ui/tokens`,
   so it tracks your brand automatically once you change the tokens).
4. **Tune crawler policy** — edit `AI_CRAWLERS` / the disallow example in
   `apps/landing/app/robots.ts` per the GEO tip above.
5. **Keep the sitemap current** — add new routes to the arrays in `app/sitemap.ts`.
