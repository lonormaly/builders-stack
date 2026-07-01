#!/usr/bin/env bash
# link-env.sh — one env file, symlinked everywhere it's needed.
#
# There is ONE source of truth: the repo-root .env.local. `./tilt_up.sh` sources
# it into every service automatically, but standalone `bun --filter @stack/<x> dev`
# only loads a .env.local from the INVOKING directory. This symlinks the root file
# into each app/service so both paths read the same env. Re-run any time; it's
# idempotent. The symlinks are gitignored.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -f "$ROOT/.env.local" ]; then
  echo "No .env.local at repo root. Run: cp .env.example .env.local" >&2
  exit 1
fi

# Packages that run standalone and read env (apps, services, + libs/db for drizzle).
PKGS=(
  apps/web
  apps/landing
  services/api
  services/payment
  services/ai-worker
  libs/db
)

for pkg in "${PKGS[@]}"; do
  ln -sf ../../.env.local "$ROOT/$pkg/.env.local"
  echo "linked $pkg/.env.local → root .env.local"
done
