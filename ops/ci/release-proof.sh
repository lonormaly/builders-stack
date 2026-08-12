#!/usr/bin/env bash
set -euo pipefail
base="${1:?usage: ops/ci/release-proof.sh BASE HEAD}"
head="${2:?usage: ops/ci/release-proof.sh BASE HEAD}"
bunx oxlint
# The workflow downloads its deployment receipt into .release-plan. Check only
# repository source so an artifact cannot become a false formatting failure.
git ls-files -z | xargs -0 bunx oxfmt --check
bunx eslint apps services libs packages
bun run check:typescript
bunx nx affected -t build --base="$base" --head="$head" --parallel=3 --output-style=static
bun ops/ci/affected-deployables.ts "$base" "$head"
