# Writing for AI search (GEO), honestly

How to write posts in `apps/blog` that get surfaced and cited by Google's AI features
**and** by ChatGPT, Gemini, Claude, and Perplexity. This is the applied version of
Google's own guidance — read the source, it's short and blunt:
<https://developers.google.com/search/docs/fundamentals/ai-optimization-guide>.

## The one lever

**There is no trick.** The thing that gets you into AI answers is the same thing that
has always earned rankings: **original, first-hand, expert content with a unique point
of view, on pages that are crawlable, indexed, and server-rendered.** Google says it
directly — there is no special schema, no magic file, and no phrasing style that
substitutes for having something worth reading. Everything else on this page is either
(a) how to make that content legible, or (b) hygiene this repo already automates so you
can't forget it.

If you take one thing away: spend your effort on the writing, not on "optimizing for the
model."

## What to do

### Demonstrate real experience (E-E-A-T)

Write from something you actually did. First-hand detail — a number you measured, a
decision you regretted, a diff — is the signal a commodity article can't fake, and it's
what both search rankers and AI answer engines are tuned to reward. Put a real `author`
in the frontmatter; write in that person's voice.

### Write well-organized prose for humans

Use `##`/`###` headings, short paragraphs, and lists **because that is how people read**
— that is _readability_, not "chunking for AI." Do not fragment your writing into
bite-size blocks for a model, and do not adopt some imagined "AI syntax." There isn't
one. A page a human enjoys is the page an AI can summarize.

### Keep it fresh

Bump `updatedAt` whenever you make a meaningful edit, and say what changed. The blog's
`sitemap.xml` uses `updatedAt` as `lastModified`, and the Article JSON-LD emits
`dateModified` — so freshness is expressed to crawlers automatically once you set the
field.

### Use helpful multimedia

An original diagram, screenshot, or chart that genuinely explains the point helps humans
and gives the page something to be cited for. Add real assets (with descriptive alt
text) — not stock filler.

### Link internally

Link related posts to each other. It helps a reader follow the thread and lets a crawler
discover the whole cluster. The two seed posts in `content/` link to each other — copy
that habit.

### Lean on the technical hygiene this repo automates

You do **not** hand-roll any of this — `@stack/seo` produces it and `bun run check:seo`
fails the build if a public page drifts (see [`docs/seo.md`](./seo.md) and `AGENTS.md`
§ 3.1):

- **Canonical + Open Graph + Twitter** — `pageMetadata()` per post via `generateMetadata`.
- **Article JSON-LD** (`headline`, `datePublished`, `dateModified`, `author`, `image`) —
  `articleJsonLd` rendered through `<JsonLd>`, for rich results.
- **Indexable + server-rendered** — every post page is a server component; the check
  rejects a root `"use client"` public page.
- **Discoverable** — `robots.ts` (welcomes the AI crawler roster via `aiCrawlerRules()`),
  `sitemap.xml` (generated from `content/`), and an RSS `feed.xml`.

Your job is the words. The gate handles the plumbing.

## What NOT to do (straight from Google)

- **Don't chunk content for AI.** Sections and paragraphs are for human readability, not
  a format you adopt to feed a model.
- **Don't write in "AI syntax."** It doesn't exist. Write like a person.
- **Don't scale, recycle, or spin.** Mass-produced, commodity, or lightly-reworded
  content is exactly what the helpful-content systems demote.
- **Don't make a page per keyword variation.** One strong page beats ten thin ones.
- **Don't treat `llms.txt` as a ranking lever.** Google Search ignores it — it "will
  neither harm nor help" your visibility. This repo ships one for the non-Google tools
  that read it, and is honest that it isn't why anyone finds you.

## The frontmatter contract

Every post in `apps/blog/content/*.mdx` declares this (see `content/_template.mdx`). The
build (`lib/posts.ts`) throws on a missing required field, so a broken post fails CI
instead of shipping:

```yaml
---
title: "Specific, honest, written for a human"
description: "One or two sentences — becomes the meta description, OG description, and RSS summary."
date: "2026-07-02" # ISO 8601, first published
updatedAt: "2026-07-02" # ISO 8601, bump on every meaningful edit (freshness)
author: "Your Name"
tags: ["structure", "seo"]
# ogImage: "/custom-card.png"   # OPTIONAL — omit to use the dynamic per-post card
---
```

## Anatomy of a good post — the checklist

- [ ] Opens with the first-hand point, not a definition an AI could have written.
- [ ] Says something only you (with your experience) could say — a real number, diff, or story.
- [ ] Organized with `##`/`###` and normal paragraphs for a human reader.
- [ ] Links to at least one related post; links out to primary sources.
- [ ] `updatedAt` reflects the last real edit.
- [ ] Frontmatter complete (title, description, date, updatedAt, author, tags).
- [ ] Ends on the earned takeaway — no manufactured tagline.
- [ ] `bun run check:seo` passes (it will, if the page went through `@stack/seo`).
