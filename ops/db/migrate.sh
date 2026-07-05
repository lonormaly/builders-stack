#!/usr/bin/env bash
# ops/db/migrate.sh — apply pending Drizzle migrations.
#
# Thin wrapper over @stack/db's programmatic migrator (libs/db/src/migrate.ts),
# which reads DATABASE_URL and applies the SQL in libs/db/migrations. Programmatic
# (not `drizzle-kit migrate`) so a deploy can run it without the drizzle-kit dev
# dependency present.
set -euo pipefail

echo "→ Applying migrations via @stack/db"
exec bun --filter @stack/db migrate
