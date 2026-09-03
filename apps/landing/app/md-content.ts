// The markdown body for each public page's mirror — hand-written per page (not
// auto-extracted from JSX) because the JSX carries Tailwind/Radix markup that isn't
// meaningful prose. app/api/md/[...path]/route.ts wraps whichever of these matches
// with markdownResponse() (frontmatter + "## Sitemap" + headers).
import { FEATURES } from "./features";

export interface MarkdownPageContent {
  title: string;
  description: string;
  lastUpdated: string;
  body: string;
}

const HOME_DESCRIPTION =
  "A real project structure your coding agent can navigate — apps · services · libs, a live app, a shared design system, and enforced module boundaries.";

const PRIVACY_DESCRIPTION =
  "How this project collects, uses, and protects personal data — a starter template to adapt with your own counsel.";

export const MARKDOWN_PAGES: Record<string, MarkdownPageContent> = {
  index: {
    title: "Builder's Stack",
    description: HOME_DESCRIPTION,
    lastUpdated: "2026-07-02",
    body: `# A real project structure your agent can actually navigate.

${HOME_DESCRIPTION}

## Structure that pays off

${FEATURES.map((f) => `### ${f.title}\n\n${f.body}`).join("\n\n")}

## Built to be read by agents, not just people

This site — and the two other apps in the template — score 90+ on Vercel's
agent-readability spec out of the box: markdown mirrors, content negotiation,
AGENTS.md, and structured data.
`,
  },
  privacy: {
    title: "Privacy Policy",
    description: PRIVACY_DESCRIPTION,
    lastUpdated: "2026-01-01",
    body: `# Privacy Policy

**Template.** This is a starting point, not legal advice. Replace every [bracketed] value
and have a lawyer review it before launch.

## Who we are

[Company / Data Controller name], [address], contactable at [privacy@yourdomain]. We are
the controller of the personal data described below.

## What we collect

Account data you give us (name, email) when you sign up; and, only after you accept the
cookie banner, product analytics via PostHog and Microsoft Clarity. Analytics stay off
until you consent.

## Legal basis (GDPR)

Account data: performance of a contract. Analytics/cookies: your consent, which you can
withdraw at any time.

## Your rights

You may access, export, correct, or delete your data. This project ships starter export
and delete endpoints on the API for the access and erasure rights.

## Retention & sharing

We keep account data while your account is active. We share data only with the processors
that run this stack.

## Contact

Questions or requests: [privacy@yourdomain].
`,
  },
};
