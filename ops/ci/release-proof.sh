#!/usr/bin/env bash
set -euo pipefail
base="${1:?usage: ops/ci/release-proof.sh BASE HEAD}"
head="${2:?usage: ops/ci/release-proof.sh BASE HEAD}"
bunx oxlint
bunx oxfmt --check .
bunx nx affected -t build --base="$base" --head="$head" --parallel=3 --output-style=static
bun ops/ci/affected-deployables.ts "$base" "$head"
