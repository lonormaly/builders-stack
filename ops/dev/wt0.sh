#!/usr/bin/env bash
# Run the exact checksum-verified Worktree Zero release used by this template.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
VERSION="$(tr -d '[:space:]' < "$ROOT/.wt0-version")"
RELEASE_REPOSITORY="${WORKTREE_ZERO_RELEASE_REPOSITORY:-lonormaly/worktree-zero}"

[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  echo "error: invalid Worktree Zero version in $ROOT/.wt0-version" >&2
  exit 2
}

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

if [[ ! -x "$binary" || "$($binary --version 2>/dev/null || true)" != "wt0 $VERSION" ]]; then
  command -v curl >/dev/null 2>&1 || { echo 'error: curl is required to install wt0' >&2; exit 2; }
  command -v tar >/dev/null 2>&1 || { echo 'error: tar is required to install wt0' >&2; exit 2; }
  temporary="$(mktemp -d "${TMPDIR:-/tmp}/wt0-install.XXXXXX")"
  cleanup() { find "$temporary" -depth -delete 2>/dev/null || true; }
  trap cleanup EXIT
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
  [[ "$($candidate --version)" == "wt0 $VERSION" ]] || {
    find "$candidate" -delete
    echo "error: downloaded Worktree Zero binary reported the wrong version" >&2
    exit 2
  }
  mv -f "$candidate" "$binary"
fi

exec "$binary" "$@"
