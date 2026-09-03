import { GLOSSARY_TERMS } from "./glossary-terms";

// The markdown body for each public page's mirror — hand-written per page (not
// auto-extracted from JSX) because the JSX carries Tailwind/Radix markup that isn't
// meaningful prose. app/api/md/[...path]/route.ts wraps whichever of these matches
// with markdownResponse() (frontmatter + "## Sitemap" + headers).
export interface MarkdownPageContent {
  title: string;
  description: string;
  lastUpdated: string;
  body: string;
}

const HOME_DESCRIPTION =
  "One design system, every surface — @stack/ui components and shared tokens rendered by both web and native, wired to a live Better Auth login.";

const GLOSSARY_DESCRIPTION =
  "Terms used across Builder's Stack — apps/services/libs, Nx, module boundaries, portless, worktrees, env-gated batteries, agent readability, and WebMCP — defined in one place.";

export const MARKDOWN_PAGES: Record<string, MarkdownPageContent> = {
  index: {
    title: "Design system",
    description: HOME_DESCRIPTION,
    lastUpdated: "2026-07-02",
    body: `# One design system, every surface.

${HOME_DESCRIPTION}

## Buttons, Badges, and Forms

Every component in the live demo is imported from \`@stack/ui\` — the same package \`apps/mobile\` pulls tokens from. Import by package name, never a deep path.

## Design tokens

Tokens are exported as plain data — no DOM, no React — so React Native consumes the exact same color/spacing/typography values the web does. The web CSS variables are mirrored from that same token file, which stays the single source of truth.

## Related

- [Glossary](/glossary) — terminology used across this app.
`,
  },
  glossary: {
    title: "Glossary",
    description: GLOSSARY_DESCRIPTION,
    lastUpdated: "2026-09-01",
    body: `# Glossary

${GLOSSARY_DESCRIPTION}

${GLOSSARY_TERMS.map((t) => `## ${t.term}\n\n${t.definition}`).join("\n\n")}
`,
  },
};
