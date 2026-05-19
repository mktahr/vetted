-- 049_bucket_schema_swap_and_flagged_reasons.sql
--
-- Collapse candidate_bucket from 5 values → 3 values, add flagged_reasons array.
--
-- NEW BUCKET MODEL (V1 product framework):
--   vetted        — score ≥ threshold AND no system flags
--   non_vetted    — explicit admin rejection ONLY (scoring engine never assigns)
--   needs_review  — everything else (low score, flagged, unknown seniority, unscored)
--
-- The "flagged" concept moves from being a bucket value into being an array
-- of system-computed reasons stored on candidate_bucket_assignments.
--
-- OLD VALUES being dropped:
--   vetted_talent, high_potential, silver_medalist, non_vetted, needs_review
-- NEW VALUES:
--   vetted, non_vetted, needs_review
--
-- This migration TRUNCATES candidate_bucket_assignments. Per the prior
-- decision, the historical bucket assignment rows have no audit value
-- once the scoring model has fundamentally changed. Re-scoring happens
-- after the code refactor ships via scripts/score-all.mjs.
--
-- IMPLEMENTATION NOTE — column type change from enum → text:
--   Original draft assumed candidate_bucket was already TEXT. Verified
--   on prod 2026-05-05: it's still the candidate_bucket_type enum (from
--   migration 003). Only this one column uses the enum. We TRUNCATE
--   first, then DROP COLUMN + DROP TYPE, then re-add the column as
--   TEXT with a CHECK constraint. Cleaner than altering enum values
--   (PostgreSQL can add but not easily drop enum values).
--
-- WHAT THIS MIGRATION DOES:
--   1. TRUNCATE candidate_bucket_assignments (drops all existing rows)
--   2. DROP candidate_bucket column (currently candidate_bucket_type enum)
--   3. DROP TYPE candidate_bucket_type (no other columns use it)
--   4. ADD candidate_bucket TEXT NOT NULL with 3-value CHECK constraint
--   5. Add flagged_reasons TEXT[] NOT NULL DEFAULT '{}' column
--   6. Add GIN index on flagged_reasons for "show flagged" filter performance

BEGIN;

-- ─── 1. TRUNCATE existing rows ────────────────────────────────────────

TRUNCATE TABLE candidate_bucket_assignments;

-- ─── 2-4. Replace enum column with TEXT + CHECK ───────────────────────

ALTER TABLE candidate_bucket_assignments
  DROP COLUMN candidate_bucket;

DROP TYPE IF EXISTS candidate_bucket_type;

ALTER TABLE candidate_bucket_assignments
  ADD COLUMN candidate_bucket TEXT NOT NULL
  CHECK (candidate_bucket IN ('vetted', 'non_vetted', 'needs_review'));

-- ─── 5. Add flagged_reasons column ────────────────────────────────────

ALTER TABLE candidate_bucket_assignments
  ADD COLUMN IF NOT EXISTS flagged_reasons TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN candidate_bucket_assignments.flagged_reasons IS
  'System-computed flags from the scoring engine: low_score, job_hopping, contractor_only. Admin-managed concerns live in candidate_review_flags (separate table). Scoring engine writes; admin should not modify this column directly.';

-- ─── 6. Index for "show flagged" filter performance ───────────────────

CREATE INDEX IF NOT EXISTS idx_bucket_flagged_reasons
  ON candidate_bucket_assignments USING GIN (flagged_reasons)
  WHERE array_length(flagged_reasons, 1) > 0;

-- ─── Verification ────────────────────────────────────────────────────

DO $$
DECLARE
  row_count INT;
BEGIN
  SELECT count(*) INTO row_count FROM candidate_bucket_assignments;
  IF row_count != 0 THEN
    RAISE EXCEPTION 'Migration 049: TRUNCATE failed, candidate_bucket_assignments still has % rows.', row_count;
  END IF;
  RAISE NOTICE 'Migration 049: TRUNCATE complete. candidate_bucket column rebuilt as TEXT with 3-value CHECK. flagged_reasons column added. Re-scoring happens via scripts/score-all.mjs after code refactor ships.';
END $$;

COMMIT;
