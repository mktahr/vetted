-- 068_people_slope_score.sql
--
-- Add the continuous candidate slope score column (0-100, NULL for
-- insufficient data). Replaces the binary `title_level_slope='rising'` gate
-- in the scoring engine's career_slope bonus with a continuous bonus formula
-- (bonus = max_weight * slope_score / 100).
--
-- title_level_slope column STAYS for now — still read by lib/ai/narrative.ts
-- for AI summary text. Both columns coexist through this transition.
-- Deprecation of title_level_slope is a follow-up PR.
--
-- VALUE SEMANTICS
--   • Integer 0-100, with a per-level floor of 10
--   • NULL → insufficient data. Three NULL conditions:
--     1. No qualifying FT history (no FT start anchor)
--     2. Zero slope-eligible levels reached (no senior_ic or above)
--     3. Atypical-entry guard: zero IC-equivalent FT history AND <2 years
--        FT total before first manager+ role (catches non-IC entrants like
--        consulting → MBA → director-on-day-one)
--
-- COMPUTATION
--   • lib/scoring/slope.ts::computeSlopeScore() owns the math
--   • lib/scoring/compute-derived.ts writes the column on every rescore
--   • lib/scoring/score-candidate.ts reads the column for the career_slope bonus
--
-- IDEMPOTENT / NON-DESTRUCTIVE
--   • Computed purely from person_experiences + person_education (immutable
--     source). Self-corrects on every rescore as title or date data improves.
--
-- NON-ADDITIVE MIGRATION ACKNOWLEDGMENT
--   This migration is purely additive — ADD COLUMN with a nullable default,
--   no existing rows touched, no constraints altered. Per Rule 5
--   (Migration is Additive First) — clean.

BEGIN;

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS slope_score INTEGER;

COMMENT ON COLUMN people.slope_score IS
  'Continuous candidate slope score (0-100 integer, NULL = insufficient data). Weighted average of per-level benchmark lookups — years from FT start to first reaching each seniority bucket (senior/lead/manager/director/vp/c_suite) compared against expected pace. Founder is NOT part of the slope axis. Computed in lib/scoring/slope.ts; written by lib/scoring/compute-derived.ts on every rescore. Replaces title_level_slope as the scoring-engine signal; title_level_slope column kept for now (read by lib/ai/narrative.ts) until deprecation.';

-- Partial index for filtering / sorting by slope score (skip NULLs).
CREATE INDEX IF NOT EXISTS idx_people_slope_score ON people (slope_score) WHERE slope_score IS NOT NULL;

DO $$
DECLARE col_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='people' AND column_name='slope_score'
  ) INTO col_exists;
  IF NOT col_exists THEN
    RAISE EXCEPTION 'Migration 068: people.slope_score column not created.';
  END IF;
  RAISE NOTICE 'Migration 068: people.slope_score added. Backfill via /api/admin/rescore-all or scripts/compute-derived-fields.mjs to populate values.';
END $$;

COMMIT;
