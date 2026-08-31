#!/usr/bin/env bash
# Create and retire small, isolated builders-stack worktrees.
#
#   ops/dev/worktree.sh <branch>        create a managed worktree
#   ops/dev/worktree.sh --rm <branch>   remove it after its patch is in main
#   ops/dev/worktree.sh --gc            remove every safe, inactive worktree
#   ops/dev/worktree.sh --list          list managed worktrees
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"
SCRIPT="$ROOT/ops/dev/worktree.sh"
BASE_REF="${BUILDERS_STACK_WORKTREE_BASE:-origin/main}"
MAX_WORKTREES="${BUILDERS_STACK_MAX_WORKTREES:-8}"
MAIN_ROOT="$(git -C "$ROOT" worktree list --porcelain | awk '$1 == "worktree" { print substr($0, 10); exit }')"
WORKTREES_DIR="$(dirname "$MAIN_ROOT")/$(basename "$MAIN_ROOT")-worktrees"
WT0_BIN="${WORKTREE_ZERO_BIN:-$ROOT/ops/dev/wt0.sh}"
WT0_VERSION="$(tr -d '[:space:]' < "$ROOT/.wt0-version")"

usage() {
  sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-1}"
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' |
    sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

expected_bun_version() {
  sed -nE 's/.*"packageManager"[[:space:]]*:[[:space:]]*"bun@([^"]+)".*/\1/p' "$ROOT/package.json" | head -1
}

require_supported_bun() {
  local expected actual
  expected="$(expected_bun_version)"
  actual="$(bun --version 2>/dev/null || true)"
  [[ -n "$expected" ]] || die 'package.json has no bun packageManager pin'
  [[ "$actual" == "$expected" ]] || die "Bun $expected is required; found ${actual:-none}. Upgrade before creating a worktree."
}

require_worktree_zero() {
  [[ -x "$WT0_BIN" ]] || die "Worktree Zero launcher is not executable: $WT0_BIN"
  [[ "$("$WT0_BIN" --version 2>/dev/null || true)" == "wt0 $WT0_VERSION" ]] ||
    die "Worktree Zero $WT0_VERSION is required"
}

managed_path_for_branch() {
  local branch="$1"
  git -C "$ROOT" worktree list --porcelain | awk -v wanted="refs/heads/$branch" '
    $1 == "worktree" { path = substr($0, 10) }
    $1 == "branch" && $2 == wanted { print path; exit }
  '
}

has_live_cwd() {
  local target="$1"
  command -v lsof >/dev/null 2>&1 || die 'lsof is required to prove a worktree has no live process'
  lsof -n -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' |
    awk -v target="$target" '$0 == target || index($0, target "/") == 1 { found = 1 } END { exit !found }'
}

assert_only_generated_ignored_files() {
  local dir="$1" line path
  while IFS= read -r line; do
    [[ "$line" == '!! '* ]] || continue
    path="${line#'!! '}"
    case "$path" in
      .builders-stack-worktree | node_modules/ | */node_modules/ | .nx/ | */.nx/ | .turbo/ | */.turbo/ | \
        .expo/ | */.expo/ | coverage/ | */coverage/ | dist/ | */dist/ | build/ | */build/ | \
        .next/ | */.next/ | out/ | */out/ | storybook-static/ | */storybook-static/ | *.tsbuildinfo) ;;
      *) die "$dir contains an ignored local file that cleanup must preserve: $path" ;;
    esac
  done < <(git -C "$dir" status --porcelain --ignored=matching --untracked-files=all)
}

assert_safe_to_remove() {
  local branch="$1" dir="$2" cherry_output status_output unique_merges
  [[ -f "$dir/.builders-stack-worktree" ]] ||
    die "$dir was not created by this wrapper; inspect it manually"
  status_output="$(
    git -C "$dir" status --porcelain --untracked-files=all -- . \
      ':(exclude).builders-stack-worktree' ':(exclude)node_modules'
  )"
  [[ -z "$status_output" ]] ||
    die "$dir has uncommitted or untracked work:\n$status_output"
  has_live_cwd "$dir" && die "$dir still has a running shell or process"
  git -C "$ROOT" rev-parse --verify "$BASE_REF^{commit}" >/dev/null 2>&1 ||
    die "$BASE_REF is missing; fetch it before cleanup"

  cherry_output="$(git -C "$ROOT" cherry "$BASE_REF" "$branch")"
  if printf '%s\n' "$cherry_output" | awk '$1 == "+" { found = 1 } END { exit !found }'; then
    die "$branch still has a patch that is not in $BASE_REF"
  fi
  unique_merges="$(git -C "$ROOT" rev-list --count --merges "$branch" --not "$BASE_REF")"
  [[ "$unique_merges" == "0" ]] || die "$branch still has a merge commit that is not in $BASE_REF"
  assert_only_generated_ignored_files "$dir"
}

remove_branch_worktree() {
  local branch="$1" dir
  dir="$(managed_path_for_branch "$branch")"
  [[ -n "$dir" ]] || die "no worktree is registered for $branch"
  [[ "$dir" != "$MAIN_ROOT" ]] || die 'the main checkout is never a cleanup target'
  assert_safe_to_remove "$branch" "$dir"
  # Git refuses normal worktree removal while ignored build output exists. The
  # allowlist above proves every ignored path is generated before this removes
  # only ignored files. A local .env or any unknown ignored file stops cleanup.
  git -C "$dir" clean -ffd -- .builders-stack-worktree node_modules
  git -C "$dir" clean -ffdX
  "$WT0_BIN" remove "$dir"
  rmdir "$WORKTREES_DIR" 2>/dev/null || true
  printf 'removed %s\n' "$dir"
  printf 'kept branch %s; delete it separately with: git branch -d %q\n' "$branch" "$branch"
}

gc_managed_worktrees() {
  local marker branch
  [[ -d "$WORKTREES_DIR" ]] || { echo 'no managed worktrees'; return; }
  while IFS= read -r -d '' marker; do
    branch="$(sed -n 's/^BRANCH=//p' "$marker" | head -1)"
    [[ -n "$branch" ]] || { printf 'skip %s: missing BRANCH marker\n' "$(dirname "$marker")" >&2; continue; }
    if ! "$SCRIPT" --rm "$branch"; then
      printf 'kept %s\n' "$(dirname "$marker")" >&2
    fi
  done < <(find "$WORKTREES_DIR" -mindepth 2 -maxdepth 2 -name .builders-stack-worktree -print0)
}

case "${1:-}" in
  '' | -h | --help) usage 0 ;;
  --list)
    if [[ -d "$WORKTREES_DIR" ]]; then
      find "$WORKTREES_DIR" -mindepth 2 -maxdepth 2 -name .builders-stack-worktree -print |
        sed 's#/.builders-stack-worktree$##' | sort
    fi
    exit 0
    ;;
  --gc)
    gc_managed_worktrees
    (cd "$ROOT" && "$WT0_BIN" prune)
    exit 0
    ;;
  --rm)
    [[ -n "${2:-}" ]] || usage
    remove_branch_worktree "$2"
    (cd "$ROOT" && "$WT0_BIN" prune)
    exit 0
    ;;
  -*) die "unknown option: $1" ;;
esac

BRANCH="$1"
[[ "$MAX_WORKTREES" =~ ^[1-9][0-9]*$ ]] || die 'BUILDERS_STACK_MAX_WORKTREES must be a positive integer'
SLUG="$(slugify "$BRANCH")"
[[ -n "$SLUG" ]] || die "$BRANCH has no usable characters"
DIR="$WORKTREES_DIR/$SLUG"
[[ ! -e "$DIR" ]] || die "$DIR already exists"
[[ -z "$(managed_path_for_branch "$BRANCH")" ]] || die "$BRANCH already has a worktree"
git -C "$ROOT" rev-parse --verify "$BASE_REF^{commit}" >/dev/null 2>&1 ||
  die "$BASE_REF is missing; fetch it before creating a worktree"
require_supported_bun
require_worktree_zero

managed_count=0
if [[ -d "$WORKTREES_DIR" ]]; then
  managed_count="$(find "$WORKTREES_DIR" -mindepth 2 -maxdepth 2 -name .builders-stack-worktree | wc -l | tr -d ' ')"
fi
((managed_count < MAX_WORKTREES)) ||
  die "$managed_count managed worktrees already exist (limit $MAX_WORKTREES); finish one and run $SCRIPT --gc"

if git -C "$ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  die "$BRANCH already exists; wt0 safe branch-resume support must land before this wrapper can reopen it"
fi
mkdir -p "$WORKTREES_DIR"
"$WT0_BIN" create "$BRANCH" --path "$DIR" --base "$BASE_REF" --require-cow --ephemeral >/dev/null

cat >"$DIR/.builders-stack-worktree" <<EOF
# Created by ops/dev/worktree.sh. The wrapper only removes this checkout when it
# is clean, inactive, and every patch is present in $BASE_REF.
BRANCH=$BRANCH
EOF

printf 'preparing dependencies through Worktree Zero and Bun %s\n' "$(expected_bun_version)"
if ! "$WT0_BIN" prepare "$DIR" --apply; then
  printf 'environment preparation failed; worktree kept for inspection at %s\n' "$DIR" >&2
  exit 1
fi

"$WT0_BIN" doctor "$DIR" >/dev/null

if ! find "$DIR/node_modules/.bun" -mindepth 1 -maxdepth 1 -type l -print -quit 2>/dev/null | grep -q .; then
  die 'Bun did not create global-store links; do not continue with a full per-worktree node_modules copy'
fi

cat <<EOF
ready: $DIR
remove after merge: cd "$MAIN_ROOT" && ops/dev/worktree.sh --rm "$BRANCH"
EOF
