#!/usr/bin/env bash
set -euo pipefail
base="${1:?usage: ops/ci/fast.sh BASE HEAD}"
head="${2:?usage: ops/ci/fast.sh BASE HEAD}"
format_files=()
lint_files=()
boundary_files=()
while IFS= read -r -d '' file; do
  [[ -f "$file" ]] || continue
  case "$file" in *.js|*.jsx|*.ts|*.tsx|*.json|*.jsonc|*.css|*.scss|*.md|*.mdx|*.yml|*.yaml) format_files+=("$file");; esac
  case "$file" in
    *.js|*.jsx|*.ts|*.tsx)
      lint_files+=("$file")
      case "$file" in apps/*|services/*|libs/*|packages/*) boundary_files+=("$file");; esac
      ;;
  esac
done < <(git diff --name-only --diff-filter=ACMR -z "$base" "$head")
((${#format_files[@]} == 0)) || bunx oxfmt --check "${format_files[@]}"
((${#lint_files[@]} == 0)) || bunx oxlint "${lint_files[@]}"
pids=()
if ((${#boundary_files[@]})); then
  bunx nx show projects >/dev/null
  bunx eslint "${boundary_files[@]}" & pids+=("$!")
fi
bunx nx affected -t typecheck,test --base="$base" --head="$head" --parallel=3 --output-style=static & pids+=("$!")
bun run check:seo & pids+=("$!")
bun run check:deployables & pids+=("$!")
bun run check:typescript & pids+=("$!")
status=0
for pid in "${pids[@]}"; do wait "$pid" || status=1; done
((status == 0))
