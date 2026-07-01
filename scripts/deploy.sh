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
SERVICES=(api ai-worker payment)
TAG="$(git rev-parse --short HEAD 2>/dev/null || echo latest)"

echo "→ Deploying builders-stack to '$ENV' (tag: $TAG)"

echo "1. Typecheck the workspace"
echo "   bun run typecheck"

for svc in "${SERVICES[@]}"; do
  echo "2. Build + push $svc"
  echo "   docker build -f infra/${svc}.Dockerfile -t ${REGISTRY}/stack-${svc}:${TAG} ."
  echo "   docker push ${REGISTRY}/stack-${svc}:${TAG}"
done

echo "3. Run DB migrations"
echo "   bun --filter @stack/db migrate"

echo "4. Roll out to Kubernetes ($ENV context)"
echo "   kubectl --context $ENV set image deployment/stack-api api=${REGISTRY}/stack-api:${TAG}"
echo "   kubectl --context $ENV rollout status deployment/stack-api"

echo "✓ (dry run) — replace the echoes above with real commands to ship."
