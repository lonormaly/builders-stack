#!/usr/bin/env bash
# ops/deploy/deploy-dev.sh — deploy the stack to the dev / pre-prod tier.
#
# Thin front door over the repo's existing deploy path (scripts/deploy.sh): it
# builds the infra/*.Dockerfile images, pushes them, runs DB migrations, and
# rolls out infra/k8s. `ops/` is the operate layer; scripts/deploy.sh is slated
# to consolidate here (see ops/README.md) — until then this wraps it so there's
# one source of truth for the deploy sequence.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# dev ≙ the shared pre-prod (staging) target until a dedicated dev cluster exists.
# ponytail: single env arg forwarded; add a real `dev` context to scripts/deploy.sh
# when you split dev from staging.
exec "$ROOT/scripts/deploy.sh" staging
