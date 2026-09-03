# CHANGELOG

`CHANGELOG.md`, at the repo root, follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/): a `## Unreleased`
section at the top, broken into `### Added` / `### Changed` / `### Fixed` /
`### Security` (only the categories a given entry set actually needs), each
entry a bold-led bullet — a one-sentence claim in **bold**, then the why and,
where one exists, the measured number, ending with its PR number in
parentheses. Write it for the next person reading the file cold, not for the
PR's own reviewer: name the thing that changed and why it mattered, not "see
PR description."

**This is enforced, not just conventional.** `scripts/check-changelog.ts`
(wired into `ops/ci/fast.ts`, so it runs in CI on every PR) fails the build
if a diff touches `apps/`, `libs/`, `services/`, `scripts/`, `ops/`, `.wt0*`,
`Tiltfile`, or `tilt_*.sh` without also adding a line under
`## Unreleased` in the same diff. A `docs/`-only PR is exempt by construction
— `docs/` isn't in that trigger surface — and a dependabot PR is exempt
explicitly (routine dependency bumps aren't worth a changelog line); both
exemptions print in the check's own output rather than silently passing, so
a green run always says why. Add your entry in the same PR that makes the
change — a follow-up "add changelog entry" commit defeats the point.

A release rolls `## Unreleased` into a dated version heading
(`## 0.2.0 — 2026-10-01`) and starts a fresh, empty `## Unreleased` above it;
nothing in a past release's section is rewritten after the fact except a
correction to something that was actually wrong.
