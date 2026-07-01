<!-- Keep PRs small and focused — one concern each. -->

## What & why

<!-- What does this change, and why? Link any issue: Closes #123 -->

## Type

<!-- Conventional-commit type -->

- [ ] feat · [ ] fix · [ ] docs · [ ] refactor · [ ] test · [ ] chore · [ ] ci

## How I verified

<!-- Commands you ran, endpoints you hit, screenshots if UI. -->

- [ ] `bun run typecheck` passes
- [ ] Ran locally via `./tilt_up.sh`

## Convention checklist

- [ ] No upward import (`libs` don't import from `apps`/`services`)
- [ ] No deep imports into a lib's internals (imported by package name only)
- [ ] Organized by feature, not by layer
- [ ] DB access via `@stack/db`; payments via `@stack/payment` adapter
- [ ] New service is in the `Tiltfile`
- [ ] New env vars added to `.env.example` (no real secrets)
- [ ] New/changed API route reflected in `api-collection/` (Bruno)
