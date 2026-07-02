#!/usr/bin/env bun
// check-a11y.ts — READY-TO-ENABLE axe-core accessibility smoke test (a STUB by default).
//
// The a11y gate that actually bites today is Oxlint's `jsx-a11y` plugin (correctness=error)
// in `bun run lint` + CI — it fails the build on static a11y violations (missing alt, click
// handlers on non-interactive elements, …). That's the enforced layer.
//
// This file is the OPTIONAL runtime layer: axe-core against a real rendered page catches
// what static lint can't (color contrast, focus order, ARIA computed from the live DOM).
// It's a stub so the repo doesn't carry a browser runner it isn't using. Enable it when you
// want the deeper check — the wiring is ~15 lines, spelled out below.
//
// ── To enable ────────────────────────────────────────────────────────────────
//  1. bun add -D @axe-core/playwright playwright
//  2. bunx playwright install --with-deps chromium
//  3. Replace the STUB block below with the RUN block (commented) underneath it.
//  4. Add to package.json:  "check:a11y": "bun scripts/check-a11y.ts"
//     and, to make it a gate, append it to the CI job (a step after build) — mirror how
//     check:seo is wired. Point TARGET_URL at the built landing (or a preview deploy).
// ─────────────────────────────────────────────────────────────────────────────

const TARGET_URL = process.env.A11Y_URL ?? "http://localhost:3000";

// ── STUB (default): no browser deps → no-op, exit 0, print how to turn it on. ──
console.log(
  `check:a11y — stub (target would be ${TARGET_URL}). Static a11y is already enforced via\n` +
    "Oxlint jsx-a11y (bun run lint). Enable the runtime axe check by following this file's header.",
);
process.exit(0);

// ── RUN (paste over the STUB block above once deps are installed) ──────────────
// import { chromium } from "playwright";
// import { AxeBuilder } from "@axe-core/playwright";
//
// const browser = await chromium.launch();
// const page = await browser.newPage();
// await page.goto(TARGET_URL, { waitUntil: "networkidle" });
// const { violations } = await new AxeBuilder({ page })
//   .withTags(["wcag2a", "wcag2aa"])
//   .analyze();
// await browser.close();
//
// if (violations.length > 0) {
//   console.error(`\n✖ check:a11y — ${violations.length} axe violation(s) on ${TARGET_URL}:\n`);
//   for (const v of violations) console.error(`  • [${v.impact}] ${v.id}: ${v.help}`);
//   process.exit(1);
// }
// console.log(`✓ check:a11y — no axe violations on ${TARGET_URL}.`);
