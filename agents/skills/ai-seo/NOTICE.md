# Vendored skill — provenance (vetted per docs/stack/agent-skills.md § the-law)

- **Skill:** `ai-seo` — GEO / AEO / LLMO *authoring* guidance (make content citable by AI answers)
- **Source:** https://github.com/coreyhaines31/marketingskills
- **Pinned commit:** `30bc89daa8adce60c28bb21d9b9ddd7c98a20671`
- **License:** MIT (© 2025 Corey Haines)
- **Vetted (5-step law):** Tier-1 in our own curated list. No `allowed-tools`, no hooks, no
  scripts — pure prose + reference docs. No prompt-injection / exfil / `curl|sh`. Re-vet on bump.

## Why this lives here even though "SEO is enforced, not a skill"

The `check:seo` gate + `@stack/seo` enforce SEO/GEO **mechanics** (every public page routes
metadata + JSON-LD through one door, server-rendered, robots/sitemap present). They do NOT — and
can't — make content **citable**: answer-first blocks, comparison tables, corroborated stats,
honest "when-NOT-to-use". That's authoring judgment, and it's what this skill guides. Gate =
plumbing; `ai-seo` = content. They compose. See `docs/stack/agent-skills.md`.
