#!/usr/bin/env bash
# Stop the builders-stack Tilt session. Served processes die with Tilt, which
# auto-cleans their portless routes. The shared portless proxy (port 1355) keeps
# running for other projects — stop it manually with `portless proxy stop`.
set -euo pipefail
cd "$(dirname "$0")"

# Same derivation as tilt_up.sh, so this always targets the instance that
# script started — including under wt0, where two worktrees pin different
# ports. `tilt down` itself has no --port / API-server flag: it only re-parses
# the Tiltfile for static Kubernetes/Docker cleanup (currently a no-op here —
# every resource is a plain local_resource) and never reaches a running
# `tilt up` engine's local_resource child processes. The only reliable way to
# stop those, and the engine itself, is what an interactive Ctrl+C does:
# signal the `tilt up` process bound to this session's pinned port.
PORT="${TILT_PORT:-${WT0_PORT_BASE:-10380}}"

PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1)"
if [[ -n "$PID" ]]; then
  kill -INT "$PID"
  echo "→ builders-stack: stopped (tilt pid $PID on port $PORT)"
else
  echo "→ builders-stack: nothing listening on port $PORT"
fi

tilt down 2>/dev/null || true
