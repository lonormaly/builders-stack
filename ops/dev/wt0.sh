#!/usr/bin/env bash
# Run the exact checksum-verified Worktree Zero release used by this template.
#
# Prefers a `wt0` already on PATH (Homebrew, npm, or any other install) over
# downloading one, as long as its version satisfies .wt0-version — same
# major.minor.patch, or newer, under plain X.Y.Z semver ordering (no
# pre-release/build suffixes to compare here; every release is a bare X.Y.Z).
# This keeps a fresh, never-launched download off the hot path: macOS's
# first-launch Gatekeeper assessment of a new ad-hoc-signed executable can
# hang for minutes under load (builders-stack#53), while a binary
# Homebrew/npm already vouched for — or that simply ran once before — pays no
# such tax. Downloading into the versioned cache stays the fallback for when
# nothing on PATH qualifies.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
VERSION="$(tr -d '[:space:]' < "$ROOT/.wt0-version")"
RELEASE_REPOSITORY="${WORKTREE_ZERO_RELEASE_REPOSITORY:-lonormaly/worktree-zero}"

[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  echo "error: invalid Worktree Zero version in $ROOT/.wt0-version" >&2
  exit 2
}

# True when $1 >= $2, comparing plain X.Y.Z versions component-wise.
version_ge() {
  local -a a b
  IFS=. read -r -a a <<< "$1"
  IFS=. read -r -a b <<< "$2"
  local i ai bi
  for i in 0 1 2; do
    ai="${a[i]:-0}"
    bi="${b[i]:-0}"
    ((10#$ai > 10#$bi)) && return 0
    ((10#$ai < 10#$bi)) && return 1
  done
  return 0
}

# Every version probe goes through the same bound. A PATH binary can be just
# as freshly downloaded as the cached candidate, and a cached binary can be
# left unassessed after an interrupted first launch; neither is safe to run
# unbounded on macOS while Gatekeeper is wedged.
version_check_seconds="${WT0_VERSION_CHECK_TIMEOUT_SECONDS:-20}"
version_output() {
  local executable="$1"
  if command -v perl >/dev/null 2>&1; then
    perl -e 'alarm shift; exec @ARGV' "$version_check_seconds" "$executable" --version 2>/dev/null
  elif command -v timeout >/dev/null 2>&1; then
    timeout "$version_check_seconds" "$executable" --version 2>/dev/null
  else
    echo "error: perl or timeout is required to bound the Worktree Zero version check" >&2
    return 127
  fi
}

path_wt0="$(command -v wt0 2>/dev/null || true)"
if [[ -n "$path_wt0" ]]; then
  path_version="$(version_output "$path_wt0" || true)"
  path_version="${path_version#wt0 }"
  if [[ "$path_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] && version_ge "$path_version" "$VERSION"; then
    exec "$path_wt0" "$@"
  fi
fi

case "$(uname -s):$(uname -m)" in
  Darwin:arm64) target='aarch64-apple-darwin' ;;
  Darwin:x86_64) target='x86_64-apple-darwin' ;;
  Linux:aarch64 | Linux:arm64) target='aarch64-unknown-linux-gnu' ;;
  Linux:x86_64) target='x86_64-unknown-linux-gnu' ;;
  *)
    echo "error: Worktree Zero $VERSION has no verified binary for $(uname -s) $(uname -m)" >&2
    exit 2
    ;;
esac

if [[ "$(uname -s)" == Darwin ]]; then
  cache_root="${HOME:?}/Library/Caches/WorktreeZero"
else
  cache_root="${XDG_CACHE_HOME:-${HOME:?}/.cache}/worktree-zero"
fi
binary="$cache_root/v$VERSION/$target/wt0"

# `temporary` (the extraction scratch dir) and `candidate` (the not-yet-verified
# download, named so a crash mid-install is visibly a leftover) are both
# cleaned on every exit — success, failure, or signal — so an interrupted
# install never leaves a `*.tmp` file behind (builders-stack#53 saw one
# survive a killed run).
temporary=""
candidate=""
cleanup() {
  [[ -n "$temporary" ]] && find "$temporary" -depth -delete 2>/dev/null
  [[ -n "$candidate" && -e "$candidate" ]] && rm -f "$candidate" 2>/dev/null
  return 0
}
trap cleanup EXIT

# Also sweep any `*.tmp` left over from a previous interrupted install of this
# same version/target before starting a new one.
find "$(dirname "$binary")" -maxdepth 1 -name '*.tmp' -delete 2>/dev/null || true

cached_version=""
if [[ -x "$binary" ]]; then
  cached_version="$(version_output "$binary" || true)"
fi
if [[ "$cached_version" != "wt0 $VERSION" ]]; then
  command -v curl >/dev/null 2>&1 || { echo 'error: curl is required to install wt0' >&2; exit 2; }
  command -v tar >/dev/null 2>&1 || { echo 'error: tar is required to install wt0' >&2; exit 2; }
  temporary="$(mktemp -d "${TMPDIR:-/tmp}/wt0-install.XXXXXX")"
  asset="wt0-$target.tar.gz"
  base_url="https://github.com/$RELEASE_REPOSITORY/releases/download/v$VERSION"
  curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 --output "$temporary/$asset" "$base_url/$asset"
  curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 --output "$temporary/$asset.sha256" "$base_url/$asset.sha256"
  (
    cd "$temporary"
    if command -v shasum >/dev/null 2>&1; then
      shasum -a 256 -c "$asset.sha256"
    else
      sha256sum -c "$asset.sha256"
    fi
    tar xzf "$asset"
  )
  mkdir -p "$(dirname "$binary")"
  candidate="$binary.$$.tmp"
  install -m 0755 "$temporary/wt0-$target/wt0" "$candidate"

  # Bound the fresh binary's first launch. `timeout` doesn't ship on macOS, so
  # bound it with perl's alarm instead: `exec` replaces the perl process image
  # with the candidate binary, so SIGALRM lands on the binary itself and
  # kills it (default disposition) if it hasn't answered in time — this is
  # exactly the hang builders-stack#53 reproduced (Gatekeeper's first-launch
  # assessment of a new ad-hoc-signed executable, stuck for 6+ minutes).
  reported="$(version_output "$candidate" || true)"

  if [[ "$reported" != "wt0 $VERSION" ]]; then
    if [[ -z "$reported" ]]; then
      echo "error: the downloaded Worktree Zero binary did not report its version within ${version_check_seconds}s." >&2
      echo "macOS may be assessing the new binary on first launch; run it once from Terminal (e.g. \`$binary --version\` after a manual install) or install wt0 via Homebrew/npm so a vetted copy is already on PATH." >&2
    else
      echo "error: downloaded Worktree Zero binary reported the wrong version" >&2
    fi
    exit 2
  fi
  mv -f "$candidate" "$binary"
  candidate=""
fi

exec "$binary" "$@"
