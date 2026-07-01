#!/usr/bin/env bash
# ALWAYS boot with this, never `tilt up` directly.
# It pins a per-project Tilt UI port (10380) so several Tilt projects can run side
# by side instead of fighting over the shared default, and makes sure portless (the
# stable-URL proxy the Tiltfile depends on) is on PATH and installed.
set -euo pipefail
cd "$(dirname "$0")"

PORT="${TILT_PORT:-10380}"   # bump this per project to keep dashboards distinct

# Homebrew bin isn't always on non-interactive PATH — portless lives there.
export PATH="/opt/homebrew/bin:$PATH"

if ! command -v portless >/dev/null 2>&1; then
  echo "portless not found. Served roles use it for stable *.stack.localhost:1355 URLs." >&2
  echo "  install it:  npm install -g portless" >&2
  exit 1
fi

echo "→ builders-stack: tilt up on http://localhost:$PORT"
echo "  Web http://web.stack.localhost:1355 · API http://api.stack.localhost:1355 · Storybook http://storybook.stack.localhost:1355"
exec tilt up --port "$PORT" "$@"
