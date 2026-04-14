-- ============================================================
-- Vetted — Phase 2 Prep Migration
--
-- 1. Replace candidate_bucket_type enum with the new 5-value taxonomy:
--      vetted_talent, high_potential, silver_medalist, non_vetted, needs_review
--
-- 2. Add school_score (0-4) and is_foreign columns to the schools table
--    so we can store rankings inline from the university CSV.
--
-- Notes:
--   - candidate_bucket_assignments is empty at migration time (verified),
--     so we don't need to map values across the enum swap.
--   - The existing school_scores table (1-5 scale) is left in place per
--     Rule 5 (additive only). The new school_score column on schools
--     uses a different 0-4 scale and is what the scoring engine reads.
-- ============================================================

-- ─── Step 1: Swap candidate_bucket_type enum ──────────────────────────

-- Convert the column to text so we can drop the old enum type
ALTER TABLE candidate_bucket_assignments
  ALTER COLUMN candidate_bucket TYPE TEXT USING candidate_bucket::TEXT;

-- Drop the old enum type (no dependents left)
DROP TYPE candidate_bucket_type;

-- Create the new enum with the 5-value taxonomy
CREATE TYPE candidate_bucket_type AS ENUM (
  'vetted_talent',
  'high_potential',
  'silver_medalist',
  'non_vetted',
  'needs_review'
);

-- Map any legacy values that might have been inserted before the migration
-- (safe no-op if table is empty)
UPDATE candidate_bucket_assignments
  SET candidate_bucket = CASE candidate_bucket
    WHEN 'vetted_talent' THEN 'vetted_talent'
    WHEN 'vetted_potential' THEN 'high_potential'
    WHEN 'solid_below_threshold' THEN 'non_vetted'
    ELSE 'needs_review'
  END;

-- Convert the column back to the new enum type
ALTER TABLE candidate_bucket_assignments
  ALTER COLUMN candidate_bucket TYPE candidate_bucket_type
  USING candidate_bucket::candidate_bucket_type;

-- ─── Step 2: Add schools columns ─────────────────────────────────────

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS is_foreign BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS school_score SMALLINT
  CHECK (school_score IS NULL OR (school_score BETWEEN 0 AND 4));

-- Helpful index for scoring lookups by normalized school name
CREATE INDEX IF NOT EXISTS idx_schools_name_lower ON schools (LOWER(school_name));

COMMENT ON COLUMN schools.school_score IS 'Tier ranking 0-4 (4=top tier). Populated from seed CSV.';
COMMENT ON COLUMN schools.is_foreign IS 'TRUE if school is outside the US.';
