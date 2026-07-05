#!/usr/bin/env bash
# ops/ci/local-ci.sh — run the exact gates .github/workflows/ci.yml runs, locally.
#
# Mirrors the CI `affected` job step-for-step so a red build shows up here, before
# you push. Keep it in lockstep with ci.yml — a step added there gets added here.
# BASE defaults to origin/main; override:  BASE=<ref> ops/ci/local-ci.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
BASE="${BASE:-origin/main}"

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

step "Install dependencies (frozen lockfile)"
bun install --frozen-lockfile

step "Secret scan (gitleaks)"
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --no-banner --redact
else
  echo "  gitleaks not installed — skipped locally (CI runs it). brew install gitleaks"
fi

step "Lint (oxlint)"
bunx oxlint

step "Format check (oxfmt)"
bunx oxfmt --check .

step "SEO/GEO check (check:seo)"
bun run check:seo

step "Boundaries · typecheck · test · build (affected vs $BASE)"
bunx nx affected -t lint typecheck test build --base="$BASE"

step "Dependency vuln scan (osv-scanner)"
if command -v osv-scanner >/dev/null 2>&1; then
  # bun ships a BINARY bun.lockb OSV can't parse (see ci.yml) — best-effort, never fatal.
  osv-scanner scan --recursive . 2>/dev/null \
    || echo "  (osv found nothing to scan or can't parse bun.lockb — Dependabot is the JS gate.)"
else
  echo "  osv-scanner not installed — skipped locally (CI runs it)."
fi

printf '\n\033[1;32m✓ local CI passed\033[0m\n'
