#!/usr/bin/env bash
# Stop the builders-stack Tilt session. Served processes die with Tilt, which
# auto-cleans their portless routes. The shared portless proxy (port 1355) keeps
# running for other projects — stop it manually with `portless proxy stop`.
set -euo pipefail
cd "$(dirname "$0")"

tilt down 2>/dev/null || true
echo "→ builders-stack: stopped"
