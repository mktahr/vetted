#!/bin/bash
#
# scripts/replay-migrations-to-dev.sh — one-time fresh-dev setup.
#
# Replays every migration in supabase/migrations/ against the dev DB
# in numerical order (001, 002, ... 0NN). Intended to be run ONCE,
# right after creating a fresh dev Supabase project.
#
# Idempotency note: ~20 of the 67 migrations through 068 don't use
# IF NOT EXISTS / ON CONFLICT, but on a FRESH dev DB this doesn't matter
# — there are no existing rows to conflict with. Do not re-run this
# script against a populated dev DB; use apply-migration.sh for incremental.
#
# Halts immediately on any failure (ON_ERROR_STOP=1 inside apply-migration.sh).

set -euo pipefail

if [ ! -d supabase/migrations ]; then
  echo "ERROR: supabase/migrations/ not found. Run from repo root." >&2
  exit 1
fi

if [ ! -f .env.local ]; then
  echo "ERROR: .env.local not found in cwd ($(pwd))" >&2
  exit 1
fi

DEV_URL=$(grep '^DATABASE_URL_DEV=' .env.local | cut -d= -f2-)
if [ -z "$DEV_URL" ]; then
  echo "ERROR: DATABASE_URL_DEV not set in .env.local" >&2
  exit 1
fi

echo "═══════════════════════════════════════════════════════════════"
echo "Replaying all migrations against dev DB"
echo "═══════════════════════════════════════════════════════════════"

# Sort by filename (3-digit prefix gives numerical order).
TOTAL=$(ls -1 supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
echo "Migrations to apply: $TOTAL"
echo ""

COUNT=0
START_TIME=$(date +%s)

for migration in $(ls -1 supabase/migrations/*.sql | sort); do
  COUNT=$((COUNT + 1))
  printf "[%2d/%d] %s\n" "$COUNT" "$TOTAL" "$(basename "$migration")"
  ./scripts/apply-migration.sh dev "$migration" 2>&1 | tail -1
  echo ""
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "═══════════════════════════════════════════════════════════════"
echo "✓ Replayed $COUNT migrations against dev in ${ELAPSED}s"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Schema is now caught up. Dev DB is empty of reference data —"
echo "run scripts/sync-reference.mjs or seed scripts separately if needed."
