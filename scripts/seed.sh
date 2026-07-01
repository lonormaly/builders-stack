#!/usr/bin/env bash
# Seed the local database with demo data. Thin wrapper over the @stack/db seed script.
# Usage:  ./scripts/seed.sh
set -euo pipefail

echo "→ Seeding database via @stack/db"
exec bun --filter @stack/db seed
