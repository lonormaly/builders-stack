#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SHA="$(git rev-parse --short HEAD)"
REGISTRY="ops/deploy/deployables.json"
TARGETS="$(jq -r '.[] | select(.strategy == "k3s-bun-bundle") | .unit' "$REGISTRY" | tr '\n' ' ')"
PUSH=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --only) TARGETS="$(printf '%s' "$2" | tr ',' ' ')"; shift 2 ;;
    --push) PUSH=1; shift ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done
STAGE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/stack-service-images.XXXXXX")"
trap 'rm -rf "$STAGE_ROOT"' EXIT
IMAGES=()
for target in $TARGETS; do
  row="$(jq -r --arg unit "$target" '.[] | select(.strategy == "k3s-bun-bundle" and .unit == $unit) | [.image, .entry] | @tsv' "$REGISTRY")"
  [[ -n "$row" ]] || { echo "unknown image target: $target" >&2; exit 2; }
  name="${row%%$'\t'*}"; entry="${row#*$'\t'}"; context="$STAGE_ROOT/$target"
  mkdir -p "$context"
  bun build "$entry" --target=bun --outfile="$context/server.js"
  docker build --platform linux/amd64 --build-arg "STACK_IMAGE_COMMIT=$SHA" -f infra/bundled-bun-service.Dockerfile -t "$name:$SHA" "$context"
  IMAGES+=("$name")
done
bun scripts/check-image-size.ts "$SHA"
if ((PUSH)); then
  : "${REGISTRY_HOST:?set REGISTRY_HOST before --push}"
  for image in "${IMAGES[@]}"; do docker tag "$image:$SHA" "$REGISTRY_HOST/$image:$SHA"; docker push "$REGISTRY_HOST/$image:$SHA"; done
fi
