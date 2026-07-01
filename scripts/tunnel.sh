#!/usr/bin/env bash
# Expose a local port on a public URL — for testing inbound webhooks (e.g. Creem → @stack/payment).
# Usage:  ./scripts/tunnel.sh [port]     (defaults to the payment service on 3002)
set -euo pipefail

PORT="${1:-3002}"

# Prefer cloudflared (no account needed for quick tunnels); fall back to ngrok.
if command -v cloudflared >/dev/null 2>&1; then
  echo "→ cloudflared quick tunnel to http://localhost:${PORT}"
  exec cloudflared tunnel --url "http://localhost:${PORT}"
elif command -v ngrok >/dev/null 2>&1; then
  echo "→ ngrok tunnel to http://localhost:${PORT}"
  exec ngrok http "${PORT}"
else
  echo "Neither cloudflared nor ngrok is installed." >&2
  echo "  brew install cloudflared   # or: brew install ngrok/ngrok/ngrok" >&2
  exit 1
fi
