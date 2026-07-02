#!/usr/bin/env bun
// check-seo.ts — the SEO/GEO drift gate. Exits non-zero the moment a public page
// drifts from the laws in AGENTS.md § "SEO/GEO — enforced". Wired into `bun run check`
// (pre-push) + lefthook + CI so it can't be skipped.
//
// Grounded in Google's AI optimization guide:
// https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
//   - Public content must be crawlable & server-rendered  → rule 2 (no root "use client").
//   - A page must be indexable with a snippet             → rule 1 (metadata present).
//   - robots.txt + sitemap.xml so engines can find it     → rule 3.
//
// PRIVATE-ROUTE CONVENTION (documented, matched here): a route is "private" — exempt
// from the public-content rules — if ANY of its path segments, with route-group parens
// stripped, is one of: app, dashboard, protected, auth, internal. So `app/(app)/…`,
// `app/dashboard/…`, and `app/auth/page.tsx` (a login gate, client-rendered by design)
// are all private. Everything else under `apps/*/app/**` is public content.

import { Glob } from "bun";

const PRIVATE_SEGMENTS = new Set(["app", "dashboard", "protected", "auth", "internal"]);
const APPS_DIR = new URL("../apps/", import.meta.url).pathname;

const violations: string[] = [];

/** Path segments between `app/` and `page.tsx`, with route-group parens stripped. */
function routeSegments(relFromAppDir: string): string[] {
  // relFromAppDir e.g. "web/app/auth/page.tsx" → ["auth"]
  const parts = relFromAppDir.split("/");
  const appIdx = parts.indexOf("app");
  return parts
    .slice(appIdx + 1, -1) // drop everything up to `app/` and the trailing page.tsx
    .map((s) => s.replace(/^\((.*)\)$/, "$1")); // (group) → group
}

function isPrivate(relFromAppDir: string): boolean {
  return routeSegments(relFromAppDir).some((s) => PRIVATE_SEGMENTS.has(s));
}

function hasMetadataExport(src: string): boolean {
  // `export const metadata`, `export function/async function generateMetadata`,
  // `export const generateMetadata`, or a re-export `export { metadata }`.
  return (
    /export\s+(?:const|let|var)\s+(?:metadata|generateMetadata)\b/.test(src) ||
    /export\s+(?:async\s+)?function\s+generateMetadata\b/.test(src) ||
    /export\s*\{[^}]*\b(?:metadata|generateMetadata)\b[^}]*\}/.test(src)
  );
}

function isRootUseClient(src: string): boolean {
  // First meaningful line (skip blank lines + comments) is a "use client" directive.
  for (const raw of src.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*"))
      continue;
    return /^["']use client["'];?$/.test(line);
  }
  return false;
}

// 1 + 2 — scan every public page.tsx across all apps.
const appsWithPublicPages = new Set<string>();
const pageGlob = new Glob("*/app/**/page.tsx");

for (const rel of pageGlob.scanSync({ cwd: APPS_DIR, onlyFiles: true })) {
  if (isPrivate(rel)) continue;

  const app = rel.split("/")[0]!; // "web" | "landing" | …
  appsWithPublicPages.add(app);

  const src = await Bun.file(`${APPS_DIR}${rel}`).text();
  const path = `apps/${rel}`;

  if (!hasMetadataExport(src)) {
    violations.push(
      `${path}\n    → public page must export \`metadata\` or \`generateMetadata\` (use @stack/seo's pageMetadata()).`,
    );
  }
  if (isRootUseClient(src)) {
    violations.push(
      `${path}\n    → public content page is a root "use client" component; public content must be server-rendered (Google: don't block JS/DOM). Move interactivity into a child client component.`,
    );
  }
}

// 3 — every app that serves public pages needs robots.ts + sitemap.ts.
for (const app of appsWithPublicPages) {
  for (const file of ["robots.ts", "sitemap.ts"]) {
    if (!(await Bun.file(`${APPS_DIR}${app}/app/${file}`).exists())) {
      violations.push(
        `apps/${app}/app/${file}\n    → app serves public pages but is missing ${file}.`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error(`\n✖ check:seo — ${violations.length} violation(s):\n`);
  for (const v of violations) console.error(`  • ${v}\n`);
  console.error(
    "Laws: AGENTS.md § “SEO/GEO — enforced”. The one door is @stack/seo — don't hand-roll.\n",
  );
  process.exit(1);
}

console.log(
  `✓ check:seo — ${appsWithPublicPages.size} app(s) clean: every public page has metadata + is server-rendered, with robots.ts + sitemap.ts.`,
);
