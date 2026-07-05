#!/usr/bin/env bash
# ops/secrets/bootstrap.sh — provision this repo's env/secrets with Ringtail.
#
# Ringtail reads .env.example as the manifest and fans each key into .env.local
# (local) + Infisical (dev/staging/prod). Your agent orchestrates the raid; it
# never sees a value. This script's ENTIRE job is to launch Ringtail — the secret
# model lives there, not here.  https://github.com/ringtailkeys/ringtail
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.example ]]; then
  echo ".env.example not found at repo root — Ringtail reads it as the manifest." >&2
  exit 1
fi

echo "→ Launching Ringtail (npx ringtail). It reads .env.example and provisions"
echo "  .env.local + Infisical. One 'allow' per provider; the agent never sees a value."
exec npx ringtail
