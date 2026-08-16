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

step "Install dependencies only when the dependency setup changed"
fingerprint="$(bun --version; cksum bun.lock bunfig.toml)"
if [[ -f node_modules/.stack-install ]] && [[ "$(cat node_modules/.stack-install)" == "$fingerprint" ]]; then
  echo "  dependencies already match bun.lock, bunfig.toml, and Bun"
else
  bun install --frozen-lockfile --ignore-scripts
  printf '%s\n' "$fingerprint" > node_modules/.stack-install
fi

step "Secret scan (gitleaks)"
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --no-banner --redact
else
  echo "  gitleaks not installed — skipped locally (CI runs it). brew install gitleaks"
fi

step "Planned affected checks"
# The same planner CI runs. STACK_CI_CACHE_ROOT is unset here, so this uses the
# plain local Nx cache and never reaches for the runner's seeded answers.
bun ops/ci/fast.ts "$BASE" HEAD

step "Dependency vuln scan (osv-scanner)"
if command -v osv-scanner >/dev/null 2>&1; then
  # bun ships a BINARY bun.lockb OSV can't parse (see ci.yml) — best-effort, never fatal.
  osv-scanner scan --recursive . 2>/dev/null \
    || echo "  (osv found nothing to scan or can't parse bun.lockb — Dependabot is the JS gate.)"
else
  echo "  osv-scanner not installed — skipped locally (CI runs it)."
fi

printf '\n\033[1;32m✓ local CI passed\033[0m\n'
