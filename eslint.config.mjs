import { fileURLToPath } from "node:url";
import nx from "@nx/eslint-plugin";
import oxlint from "eslint-plugin-oxlint";

// Absolute path so it resolves no matter which project dir Nx runs `eslint` from.
const oxlintConfigPath = fileURLToPath(new URL("./.oxlintrc.json", import.meta.url));

/**
 * Root ESLint flat config — this is where the two laws from docs/stack/architecture.md
 * get TEETH. `@nx/enforce-module-boundaries` turns "no upward import" from a review
 * convention into a lint error, using each project's `type:*` tag.
 *
 *   type:lib     → may depend on:  lib
 *   type:service → may depend on:  lib, service
 *   type:app     → may depend on:  lib, service   (NOT other apps)
 *   type:package → may depend on:  lib            (a distributable you SHIP)
 *
 * `type:package` (packages/*) is the 4th bucket: what you ship to third parties
 * (npm SDKs, embeddable widgets, CLIs). It may depend on libs only — and it's
 * TERMINAL: no app/service/lib/package lists `type:package` in its allowed tags,
 * so nothing internal can import a package. Shipped out, not consumed within.
 *
 * Tags live in each package.json under `nx.tags`. Deep imports past a lib's public
 * door (`@stack/db/src/...`) are also blocked here (banTransitiveDependencies keeps
 * the barrel file the contract).
 *
 * DIVISION OF LABOR (see docs/linting.md): Oxlint does the bulk of linting (fast, Rust).
 * ESLint is kept ONLY for `@nx/enforce-module-boundaries` — the one rule Oxlint has no
 * equivalent for. The `eslint-plugin-oxlint` spread below reads `.oxlintrc.json` and turns
 * OFF every ESLint rule Oxlint already covers, so ESLint stops double-reporting. It must be
 * LAST so its "off" wins over the Nx presets above; it does not touch enforce-module-boundaries.
 */
export default [
  ...nx.configs["flat/base"],
  ...nx.configs["flat/typescript"],
  ...nx.configs["flat/javascript"],
  {
    ignores: ["**/dist", "**/.next", "**/build", "**/storybook-static", "**/node_modules"],
  },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.cts", "**/*.mts", "**/*.js", "**/*.jsx"],
    rules: {
      "@nx/enforce-module-boundaries": [
        "error",
        {
          // Off: this repo bundles lib SOURCE at the consumer (Next.js/esbuild inline
          // @stack/ui etc.) — no lib is independently built to `dist`, so the
          // "buildable lib must not import a non-buildable lib" guard is inapplicable.
          // It was a false positive on the first buildable consumer, `packages/widget`
          // (a type:package that bundles @stack/ui/tokens source into its embed). The
          // boundary LAWS below (the tag matrix) are what's enforced.
          enforceBuildableLibDependency: false,
          allow: [],
          depConstraints: [
            { sourceTag: "type:lib", onlyDependOnLibsWithTags: ["type:lib"] },
            {
              sourceTag: "type:service",
              onlyDependOnLibsWithTags: ["type:lib", "type:service"],
            },
            {
              sourceTag: "type:app",
              onlyDependOnLibsWithTags: ["type:lib", "type:service"],
            },
            {
              sourceTag: "type:package",
              onlyDependOnLibsWithTags: ["type:lib"],
            },
          ],
        },
      ],
    },
  },
  // LAST: disable every ESLint rule Oxlint now owns (derived from .oxlintrc.json).
  ...oxlint.buildFromOxlintConfigFile(oxlintConfigPath),
];
