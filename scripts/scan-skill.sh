#!/usr/bin/env bash
# scan-skill.sh — the first gate before you install an agent skill, NOT a full audit.
#
# Queries Clawdex (Koi Security's index of agent skills) for a skill's verdict:
#   GET https://clawdex.koi.security/api/skill/<name>  →  { "verdict": "benign" | "malicious" | "unknown" }
#
# This is ONE signal — a reputation lookup, not a code review. A `benign` verdict
# means "not known-bad", not "safe to trust blindly"; a raw GitHub skill is usually
# `unknown` simply because nobody indexed it. Whatever this prints, you still owe the
# skill the full "vet before you install" law in docs/stack/agent-skills.md: read the SKILL.md
# AND every bundled script, check allowed-tools + hooks, check provenance, pin a commit.
#
# Usage:  ./scripts/scan-skill.sh <skill-name>
# Exit:   0 benign · 1 malicious · 2 unknown/unindexed · 3 no arg · 4 network/parse error
set -euo pipefail

API="https://clawdex.koi.security/api/skill"

name="${1:-}"
if [ -z "$name" ]; then
  echo "usage: ./scripts/scan-skill.sh <skill-name>" >&2
  exit 3
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "✗ curl not found — cannot query Clawdex" >&2
  exit 4
fi

# --fail-with-body keeps the response on HTTP errors; -m caps a hung network.
body="$(curl -sS --fail-with-body -m 15 "$API/$(printf '%s' "$name" | tr ' ' '-')" 2>/dev/null)" || {
  echo "⚠ could not reach Clawdex (offline or API down) — fall back to manual source review + a code scanner (semgrep/Snyk); ask before installing '$name'." >&2
  exit 4
}

# Pull the verdict without assuming jq is installed (grep the JSON field).
verdict="$(printf '%s' "$body" | grep -o '"verdict"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"

case "$verdict" in
  benign)
    echo "✓ '$name': benign on Clawdex — safe to install (still read the source before you do)."
    exit 0
    ;;
  malicious)
    echo "✗ '$name': MALICIOUS on Clawdex — DO NOT INSTALL."
    exit 1
    ;;
  *)
    echo "⚠ '$name': not indexed on ClawHub (verdict: ${verdict:-unknown}) — fall back to manual source review + a code scanner (semgrep/Snyk); ask before installing."
    exit 2
    ;;
esac
