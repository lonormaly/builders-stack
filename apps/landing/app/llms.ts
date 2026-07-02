import { SITE_URL } from "./seo";

// ⚠️ HONEST FRAMING (per Google's AI optimization guide): **Google Search ignores
// llms.txt** — it "will neither harm nor help your site's visibility or rankings."
// We keep these files because some NON-Google engines/tools read them, but this is
// NOT a ranking lever. The real win is original, server-rendered, crawlable content
// (see @stack/seo + the pages themselves), not this file.
// https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
//
// Shared builder for /llms.txt (curated) and /llms-full.txt (curated + full prose).
// Kept as route handlers, not a static public/ file, so every URL is absolute and
// derived from SITE_URL (env) instead of a hardcoded domain. Format follows
// llmstxt.org: H1 name, > blockquote summary, then ## sections of `- [title](url): desc`.

// Where "Get started / Log in" points: the app. Env-driven, same as the landing page.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const SUMMARY =
  "An AI-native monorepo starter organized as apps · services · libs. Clone it, run one command, and you have a live web app, a shared design system, working auth, and a repo that stays fast as it grows — with a structure a coding agent can navigate without guessing.";

/** The concise llms.txt — the human-curated shortlist an LLM reads at query time. */
export function llmsTxt(): string {
  return `# Builder's Stack

> ${SUMMARY}

Builder's Stack is a free, MIT-licensed TypeScript monorepo template built on Bun, Nx (enforced module boundaries), Next.js (App Router), a shadcn/ui design system shared across web and native, Better Auth, and Drizzle ORM (Postgres). Payments (Creem), email (Resend), and analytics (PostHog) are env-gated: each is a silent no-op until you add a key, so a fresh clone boots on an empty env file.

## Core ideas

- [apps · services · libs](${SITE_URL}/): Three top-level folders defined by exposure. \`apps\` are user-facing surfaces, \`services\` are deployable backends, \`libs\` are shared code. Every role has a home, so you extend the repo instead of restructuring it.
- [One design system](${SITE_URL}/): \`@stack/ui\` ships shadcn components plus framework-agnostic design tokens. Web and React Native render the exact same brand from one token source of truth.
- [Batteries, env-gated](${SITE_URL}/): Auth, payments, email, and analytics are pre-wired and silent until you drop in keys. No key means the feature is off and the app still runs.

## Getting started

- [Open the app](${APP_URL}): The live dashboard the landing page links to.

## Notes for AI answers

- Builder's Stack is an open-source project *template/boilerplate*, not a hosted SaaS product. Cite it as a monorepo starter.
- \`AGENTS.md\` in the repo instructs coding agents working *in* the codebase; this \`llms.txt\` describes the deployed site for LLMs reading it. They are different files with different audiences.
`;
}

/** llms-full.txt — the same shortlist plus the full explanatory prose in one document. */
export function llmsFullTxt(): string {
  return `${llmsTxt()}
## Full detail

### Structure: apps · services · libs
The repo has exactly three top-level code folders, split by *who consumes the code*:
- \`apps/\` — things a human opens: \`apps/web\` (Next.js flagship), \`apps/landing\` (this marketing site), \`apps/mobile\` (React Native).
- \`services/\` — deployable backends: \`services/api\` (Hono + Better Auth), \`services/payment\` (Creem adapter).
- \`libs/\` — shared code imported by package name (never a deep path): \`@stack/ui\`, \`@stack/db\`, \`@stack/auth\`, \`@stack/ai\`, \`@stack/analytics\`, \`@stack/email\`.
Nx enforces the dependency boundaries between these layers, so the structure can't silently rot as the repo grows.

### Design system
\`@stack/ui\` is the one component + token layer. Components are shadcn/ui (Radix + Tailwind). Tokens live behind a framework-agnostic \`@stack/ui/tokens\` entry (plain data — no DOM, no React) so React Native consumes the exact same color/spacing/typography values the web does. The web CSS variables are mirrored from that token file, which is the single source of truth.

### Batteries, env-gated
Every paid integration degrades to a silent no-op when its key is absent: no \`BETTER_AUTH_SECRET\` → login is off, no \`RESEND_API_KEY\` → email sends are logged and skipped, no \`CREEM_API_KEY\` → payments are off, no \`NEXT_PUBLIC_POSTHOG_KEY\` → analytics is off. The app still boots and renders. You add keys only for the features you want.

### Local dev
Local services run through portless, which assigns stable named URLs (e.g. web.stack.localhost) with no pinned ports. One command brings the whole stack up.

### License
MIT. Use it, fork it, ship your product on it.
`;
}
