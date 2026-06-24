-- ============================================================================
-- Migration 079 — Drop orphan specialty_dictionary.function_normalized column
-- ============================================================================
--
-- ⚠️  STAGED FOLLOW-UP — DO NOT APPLY OR MERGE UNTIL B-LITE IS VERIFIED. ⚠️
--
-- This migration is the cleanup half of the B-lite fix on branch
-- `fix-specialty-parent-function-source`. It must NOT run until the code change
-- (lib/normalize/specialty.ts → read parent_function instead of the orphan
-- function_normalized column) is merged + deployed and confirmed, so that
-- NOTHING reads this column at the moment it is dropped.
--
-- ── Background ──────────────────────────────────────────────────────────────
-- specialty_dictionary was created (migration 001) with column `parent_function`
-- (FK → function_dictionary), later converted to TEXT[] (migration 072). It was
-- NEVER given a `function_normalized` column by any migration.
--
-- PROD nonetheless carries an orphan `function_normalized` column — added
-- out-of-band (direct Studio edit / legacy state), holding stale pre-rebuild
-- umbrella values ('engineering' / 'operations'). DEV (bootstrapped purely from
-- repo migrations) does NOT have the column. That drift is why the old
-- loadSpecialtyDictionary() select threw 400 on dev while returning stale data
-- on prod.
--
-- Once B-lite ships, no application code references this column. Dropping it
-- converges prod onto the migration-defined schema (prod ↔ dev parity).
--
-- ── Safety ──────────────────────────────────────────────────────────────────
-- IF EXISTS makes this portable + idempotent:
--   • PROD  → drops the orphan column.
--   • DEV   → no-op (column already absent), so the standard dev-first apply
--             passes cleanly without special-casing.
--
-- Reversible only by re-adding a nullable column (the stale values are not worth
-- preserving — they are the exact legacy umbrellas the five-axis rebuild retired).
--
-- ── Apply order (after verification + merge) ────────────────────────────────
--   npm run migrate:dev  -- supabase/migrations/079_drop_orphan_specialty_function_normalized.sql   (no-op)
--   npm run migrate:prod -- supabase/migrations/079_drop_orphan_specialty_function_normalized.sql   (drops it)
-- ============================================================================

ALTER TABLE specialty_dictionary
  DROP COLUMN IF EXISTS function_normalized;

-- ── Verification ────────────────────────────────────────────────────────────
-- Fail loud if the column somehow survives the drop.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'specialty_dictionary'
      AND column_name = 'function_normalized'
  ) THEN
    RAISE EXCEPTION 'specialty_dictionary.function_normalized still present after DROP';
  END IF;
END $$;
