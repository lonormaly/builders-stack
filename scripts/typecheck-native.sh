#!/usr/bin/env bash
set -euo pipefail
exec bunx --package typescript@7.0.2 tsc "$@"
