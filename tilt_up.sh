#!/usr/bin/env bash
# ALWAYS boot with this, never `tilt up` directly.
# It pins a per-project Tilt UI port (10380) so several Tilt projects can run side
# by side instead of fighting over the shared default, and makes sure portless (the
# stable-URL proxy the Tiltfile depends on) is on PATH and installed.
#
# Two wt0 worktrees of this repo must not collide on that port either: when this
# runs under `wt0 run`/`wt0 create` + `wt0 heartbeat`, WT0_PORT_BASE is a
# machine-globally unique hundred-port window for this runtime, so it wins over
# the shared default. TILT_PORT still wins over both for a manual override.
set -euo pipefail
cd "$(dirname "$0")"

PORT="${TILT_PORT:-${WT0_PORT_BASE:-10380}}"

# Homebrew bin isn't always on non-interactive PATH — portless lives there.
export PATH="/opt/homebrew/bin:$PATH"

if ! command -v portless >/dev/null 2>&1; then
  echo "portless not found. Served roles use it for stable *.stack.localhost:1355 URLs." >&2
  echo "  install it:  npm install -g portless" >&2
  exit 1
fi

# Portless routes get a -<slug> suffix under wt0 too (see .devops/Tiltfile) so two
# worktrees' stacks serve distinct hostnames side by side.
SUFFIX="${WT0_SLUG:+-$WT0_SLUG}"

echo "→ builders-stack: tilt up on http://localhost:$PORT"
echo "  Web http://web$SUFFIX.stack.localhost:1355 · API http://api$SUFFIX.stack.localhost:1355 · Storybook http://storybook$SUFFIX.stack.localhost:1355"
exec tilt up --port "$PORT" "$@"
