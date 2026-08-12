#!/usr/bin/env bash
set -euo pipefail
base="${1:?usage: ops/ci/fast.sh BASE HEAD}"
head="${2:?usage: ops/ci/fast.sh BASE HEAD}"
format_files=()
lint_files=()
while IFS= read -r -d '' file; do
  [[ -f "$file" ]] || continue
  case "$file" in *.js|*.jsx|*.ts|*.tsx|*.json|*.jsonc|*.css|*.scss|*.md|*.mdx|*.yml|*.yaml) format_files+=("$file");; esac
  case "$file" in *.js|*.jsx|*.ts|*.tsx) lint_files+=("$file");; esac
done < <(git diff --name-only --diff-filter=ACMR -z "$base" "$head")
((${#format_files[@]} == 0)) || bunx oxfmt --check "${format_files[@]}"
((${#lint_files[@]} == 0)) || bunx oxlint "${lint_files[@]}"
pids=()
bunx nx affected -t lint,typecheck,test --base="$base" --head="$head" --parallel=3 --output-style=static & pids+=("$!")
bun run check:seo & pids+=("$!")
bun run check:deployables & pids+=("$!")
status=0
for pid in "${pids[@]}"; do wait "$pid" || status=1; done
((status == 0))
