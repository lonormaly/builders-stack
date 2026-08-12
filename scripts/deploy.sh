#!/usr/bin/env bash
# Deploy the stack to an environment. Usage:  ./scripts/deploy.sh <staging|prod>
# This is a scaffold that ECHOES the steps — wire in your registry + cluster to make it real.
set -euo pipefail

ENV="${1:-}"
if [[ "$ENV" != "staging" && "$ENV" != "prod" ]]; then
  echo "usage: $0 <staging|prod>" >&2
  exit 1
fi

# ponytail: echo-only scaffold. Replace the echoes with your real registry/cluster commands.
REGISTRY="${REGISTRY:-ghcr.io/OWNER}"
TAG="$(git rev-parse --short HEAD 2>/dev/null || echo latest)"
PLAN="${STACK_DEPLOYABLES_PLAN:-}"
if [[ -n "$PLAN" ]]; then
  [[ -f "$PLAN" ]] || { echo "deployment plan not found: $PLAN" >&2; exit 2; }
  SERVICES="$(jq -r '.services[]' "$PLAN")"
  APPS="$(jq -r '.apps[]' "$PLAN")"
else
  SERVICES="$(jq -r '.[] | select(.strategy == "k3s-bun-bundle") | .unit' ops/deploy/deployables.json)"
  APPS="$(jq -r '.[] | select(.strategy == "app-build") | .unit' ops/deploy/deployables.json)"
fi

echo "→ Deploying builders-stack to '$ENV' (tag: $TAG)"

echo "1. Typecheck the workspace"
echo "   bun run typecheck"

for svc in $SERVICES; do
  echo "2. Build + push $svc"
  echo "   REGISTRY_HOST=${REGISTRY} ops/deploy/build-images.sh --only $svc --push"
done

for app in $APPS; do
  echo "2. Build + deploy $app"
  echo "   bun --filter @stack/$app build"
done

echo "3. Run DB migrations"
echo "   bun --filter @stack/db migrate"

echo "4. Roll out to Kubernetes ($ENV context)"
echo "   kubectl --context $ENV set image deployment/stack-api api=${REGISTRY}/stack-api:${TAG}"
echo "   kubectl --context $ENV rollout status deployment/stack-api"

echo "✓ (dry run) — replace the echoes above with real commands to ship."
