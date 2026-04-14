-- ============================================================
-- Vetted — Phase 2 derived fields + alias table
--
-- 1. Create school_aliases table (Step 3 of the Phase 2 build)
-- 2. Add derived-signal columns to people (Step 4)
-- 3. Add founding_year to companies (Step 4)
--
-- All changes are additive; no existing tables or columns are dropped.
-- ============================================================

-- ─── 1. school_aliases ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_aliases (
  alias_name  TEXT PRIMARY KEY,
  school_id   UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_aliases_school ON school_aliases (school_id);

COMMENT ON TABLE school_aliases IS 'Alternate names for canonical schools. Scoring engine checks here when a direct schools.school_name match fails.';

-- ─── 2. people: derived signal columns ─────────────────────────────────
ALTER TABLE people ADD COLUMN IF NOT EXISTS career_progression TEXT
  CHECK (career_progression IS NULL OR career_progression IN ('upward', 'lateral', 'unclear'));

ALTER TABLE people ADD COLUMN IF NOT EXISTS has_early_stage_experience BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE people ADD COLUMN IF NOT EXISTS early_stage_companies_count SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE people ADD COLUMN IF NOT EXISTS has_hypergrowth_experience BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE people ADD COLUMN IF NOT EXISTS hypergrowth_companies_count SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE people ADD COLUMN IF NOT EXISTS highest_seniority_reached seniority_level;

COMMENT ON COLUMN people.career_progression IS 'Derived tag: upward/lateral/unclear. Searchable filter only, never subtracts from score.';
COMMENT ON COLUMN people.has_early_stage_experience IS 'TRUE if they worked at any company within 4 years of its founding.';
COMMENT ON COLUMN people.has_hypergrowth_experience IS 'TRUE if they worked at a company during a year when headcount ≥ 2× the prior year.';
COMMENT ON COLUMN people.highest_seniority_reached IS 'Max seniority_normalized across all experiences, by seniority_dictionary.rank_order.';

-- ─── 3. companies: founding_year ───────────────────────────────────────
ALTER TABLE companies ADD COLUMN IF NOT EXISTS founding_year SMALLINT
  CHECK (founding_year IS NULL OR (founding_year >= 1800 AND founding_year <= 2100));

COMMENT ON COLUMN companies.founding_year IS 'Year the company was founded. Used for early-stage detection.';
