#!/bin/bash
#
# scripts/apply-migration.sh — env-aware migration runner.
#
# Usage:
#   ./scripts/apply-migration.sh dev  supabase/migrations/0NN_filename.sql
#   ./scripts/apply-migration.sh prod supabase/migrations/0NN_filename.sql
#
# Loads DATABASE_URL_DEV or DATABASE_URL from .env.local depending on target.
# Uses psql with ON_ERROR_STOP=1 so any failure halts and surfaces.
#
# Companion to scripts/replay-migrations-to-dev.sh (one-time fresh-dev setup).

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <dev|prod> <path/to/migration.sql>" >&2
  echo "" >&2
  echo "Example:" >&2
  echo "  $0 dev  supabase/migrations/069_my_migration.sql" >&2
  echo "  $0 prod supabase/migrations/069_my_migration.sql" >&2
  exit 1
fi

TARGET="$1"
MIGRATION="$2"

if [ ! -f "$MIGRATION" ]; then
  echo "ERROR: migration file not found: $MIGRATION" >&2
  exit 1
fi

if [ ! -f .env.local ]; then
  echo "ERROR: .env.local not found in cwd ($(pwd))" >&2
  exit 1
fi

case "$TARGET" in
  dev)
    DB_URL=$(grep '^DATABASE_URL_DEV=' .env.local | cut -d= -f2-)
    if [ -z "$DB_URL" ]; then
      echo "ERROR: DATABASE_URL_DEV not set in .env.local" >&2
      exit 1
    fi
    ;;
  prod)
    DB_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)
    if [ -z "$DB_URL" ]; then
      echo "ERROR: DATABASE_URL not set in .env.local" >&2
      exit 1
    fi
    ;;
  *)
    echo "ERROR: target must be 'dev' or 'prod' (got: '$TARGET')" >&2
    exit 1
    ;;
esac

# Locate psql — prefer the libpq Homebrew formula (typical on this dev machine),
# fall back to PATH.
PSQL_BIN="/opt/homebrew/opt/libpq/bin/psql"
if [ ! -x "$PSQL_BIN" ]; then
  PSQL_BIN="$(command -v psql || true)"
  if [ -z "$PSQL_BIN" ]; then
    echo "ERROR: psql not found. Install via: brew install libpq" >&2
    exit 1
  fi
fi

echo "→ Applying $(basename "$MIGRATION") to $TARGET..."
"$PSQL_BIN" "$DB_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"
echo "✓ Done."
