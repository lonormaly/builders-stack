#!/usr/bin/env bash
# ops/deploy/deploy-prod.sh — deploy the stack to PRODUCTION.
#
# Same front door as deploy-dev.sh, targeting prod — with a typed confirmation,
# because a prod deploy is exactly the trust boundary you don't want to fat-finger.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TAG="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo latest)"

echo "About to deploy builders-stack to PRODUCTION (tag: $TAG)."
read -r -p "Type 'deploy prod' to continue: " reply
if [[ "$reply" != "deploy prod" ]]; then
  echo "aborted." >&2
  exit 1
fi

exec "$ROOT/scripts/deploy.sh" prod
