# Linting & formatting — Oxlint + Oxfmt, with ESLint kept for ONE job

The teachable point: **Oxlint + Oxfmt (Rust, from the oxc / VoidZero project) do the bulk
of linting and formatting because they're ~30x faster than the ESLint/Prettier pair. ESLint
is kept ONLY for `@nx/enforce-module-boundaries`** — the rule that enforces the monorepo's
module boundaries, which Oxlint has no equivalent for.

## The division of labor

| Tool                 | Job                                                                    | Command                     |
| -------------------- | ---------------------------------------------------------------------- | --------------------------- |
| **Oxlint**           | All general linting (correctness, TS, React/Next, imports), type-aware | `bun run lint`              |
| **Oxfmt**            | Formatting (replaces Prettier)                                         | `bun run format` / `:check` |
| **ESLint** (Nx only) | `@nx/enforce-module-boundaries` — the `type:*` tag law                 | `bun run lint:boundaries`   |

Why not one tool? Oxlint is fast and covers the everyday rules, but module-boundary
enforcement (a `lib` may not import an app, no deep imports past a lib's barrel) lives in
`@nx/eslint-plugin` and has no Oxlint port. So ESLint stays — trimmed to that single rule.

## How the trim works — no double-reporting

`eslint.config.mjs` appends `eslint-plugin-oxlint` **last**:

```js
import oxlint from "eslint-plugin-oxlint";
// ...
export default [
  ...nx.configs["flat/base"],
  ...nx.configs["flat/typescript"],
  ...nx.configs["flat/javascript"],
  {/* @nx/enforce-module-boundaries config */},
  // LAST: read .oxlintrc.json and turn OFF every ESLint rule Oxlint already owns.
  ...oxlint.buildFromOxlintConfigFile(oxlintConfigPath),
];
```

`buildFromOxlintConfigFile` reads `.oxlintrc.json` (single source of truth) and disables the
exact ESLint rules Oxlint now covers. Because it's last, its "off" wins over the Nx presets —
leaving only `@nx/enforce-module-boundaries` (plus any ESLint-only rule Oxlint lacks) active.

## Config files

- **`.oxlintrc.json`** — categories (`correctness: error`, `suspicious: warn`), plugins
  (typescript, unicorn, oxc, react, nextjs, import), and **type-aware** rules
  (`options.typeAware: true`, powered by `oxlint-tsgolint`). `react/react-in-jsx-scope` is off
  (Next.js uses the automatic JSX runtime), and `typescript/no-base-to-string` is downgraded to
  `warn` (it fires on defensive parsing of untyped external webhook JSON). Generated files
  (`next-env.d.ts`) and the throwaway `libs/db/index.js` boot stub are ignored.
- **`.oxfmtrc.json`** — Oxfmt is Prettier-compatible; its defaults (double quotes, semicolons,
  2-space, width 100) already match the repo, so the config only lists `ignorePatterns` for
  build output. Oxfmt also respects `.gitignore` and `.prettierignore` automatically.

## CI

`.github/workflows/ci.yml` runs `oxlint` and `oxfmt --check` over the whole repo (seconds),
then `nx affected -t lint typecheck build` — where the `lint` target is the ESLint
module-boundary pass. Fast gate first, boundary + typecheck + build after.

## Note on type-aware linting

Type-aware rules (via `oxlint-tsgolint`, a beta) auto-discover each project's `tsconfig.json`.
They surface as **warnings** here (non-blocking) so `bun run lint` stays green while still
flagging unsafe assertions etc. Promote any you want enforced to `error` in `.oxlintrc.json`.
