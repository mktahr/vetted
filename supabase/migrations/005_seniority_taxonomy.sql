-- ============================================================
-- Vetted — Seniority Taxonomy v2
--
-- Replaces the 11-value seniority_level enum with a simplified
-- 6-level ladder and introduces a standalone seniority_rules table
-- that drives title → seniority mapping universally (no longer
-- embedded in title_dictionary).
--
-- Old → New enum value mapping (applied to existing rows):
--   intern          → student
--   individual_contributor, senior_ic  → individual_contributor
--   lead            → lead
--   manager, senior_manager, director, vp  → manager
--   c_suite, founder → executive
--   unknown         → unknown
-- ============================================================

-- ─── Step 1: Detach columns from the old enum ─────────────────────────
ALTER TABLE person_experiences   ALTER COLUMN seniority_normalized TYPE TEXT;
ALTER TABLE people               ALTER COLUMN highest_seniority_reached TYPE TEXT;
ALTER TABLE title_dictionary     ALTER COLUMN seniority_normalized TYPE TEXT;

-- seniority_dictionary uses the enum as its PK. Wipe it (it's a tiny lookup
-- table — we'll re-seed it after the enum is recreated).
DELETE FROM seniority_dictionary;
ALTER TABLE seniority_dictionary ALTER COLUMN seniority_normalized TYPE TEXT;

-- ─── Step 2: Drop the old enum ────────────────────────────────────────
DROP TYPE seniority_level;

-- ─── Step 3: Create the new 6-value enum ──────────────────────────────
CREATE TYPE seniority_level AS ENUM (
  'unknown',
  'student',
  'individual_contributor',
  'lead',
  'manager',
  'executive'
);

-- ─── Step 4: Map existing values to new ones ─────────────────────────
UPDATE person_experiences SET seniority_normalized = CASE seniority_normalized
  WHEN 'intern'         THEN 'student'
  WHEN 'senior_ic'      THEN 'individual_contributor'
  WHEN 'senior_manager' THEN 'manager'
  WHEN 'director'       THEN 'manager'
  WHEN 'vp'             THEN 'manager'
  WHEN 'c_suite'        THEN 'executive'
  WHEN 'founder'        THEN 'executive'
  ELSE seniority_normalized  -- keep: unknown, individual_contributor, lead, manager
END
WHERE seniority_normalized IS NOT NULL;

UPDATE people SET highest_seniority_reached = CASE highest_seniority_reached
  WHEN 'intern'         THEN 'student'
  WHEN 'senior_ic'      THEN 'individual_contributor'
  WHEN 'senior_manager' THEN 'manager'
  WHEN 'director'       THEN 'manager'
  WHEN 'vp'             THEN 'manager'
  WHEN 'c_suite'        THEN 'executive'
  WHEN 'founder'        THEN 'executive'
  ELSE highest_seniority_reached
END
WHERE highest_seniority_reached IS NOT NULL;

UPDATE title_dictionary SET seniority_normalized = CASE seniority_normalized
  WHEN 'intern'         THEN 'student'
  WHEN 'senior_ic'      THEN 'individual_contributor'
  WHEN 'senior_manager' THEN 'manager'
  WHEN 'director'       THEN 'manager'
  WHEN 'vp'             THEN 'manager'
  WHEN 'c_suite'        THEN 'executive'
  WHEN 'founder'        THEN 'executive'
  ELSE seniority_normalized
END
WHERE seniority_normalized IS NOT NULL;

-- ─── Step 5: Convert columns back to the new enum ────────────────────
ALTER TABLE person_experiences
  ALTER COLUMN seniority_normalized TYPE seniority_level USING seniority_normalized::seniority_level;

ALTER TABLE people
  ALTER COLUMN highest_seniority_reached TYPE seniority_level USING highest_seniority_reached::seniority_level;

ALTER TABLE title_dictionary
  ALTER COLUMN seniority_normalized TYPE seniority_level USING seniority_normalized::seniority_level;

ALTER TABLE seniority_dictionary
  ALTER COLUMN seniority_normalized TYPE seniority_level USING seniority_normalized::seniority_level;

-- ─── Step 6: Re-seed seniority_dictionary with 6 values ──────────────
INSERT INTO seniority_dictionary (seniority_normalized, rank_order, description, active) VALUES
  ('unknown',               0, 'Seniority not determinable from available signals',                    TRUE),
  ('student',               1, 'Student, intern, co-op, or new-grad role',                             TRUE),
  ('individual_contributor',2, 'IC role — includes senior ICs without tech-lead-level scope',          TRUE),
  ('lead',                  3, 'Staff/Principal/Tech Lead — high-scope IC or tech lead w/o management', TRUE),
  ('manager',               4, 'People manager — line manager through VP',                             TRUE),
  ('executive',             5, 'C-suite, founder, managing director, general partner, equivalent',     TRUE);

-- ─── Step 7: Create the seniority_rules table ────────────────────────
CREATE TABLE IF NOT EXISTS seniority_rules (
  rule_id              SERIAL PRIMARY KEY,
  pattern              TEXT NOT NULL,
  match_type           TEXT NOT NULL CHECK (match_type IN ('contains', 'starts_with', 'ends_with', 'exact', 'regex', 'contains_word')),
  seniority_normalized seniority_level NOT NULL,
  priority             SMALLINT NOT NULL,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seniority_rules_priority ON seniority_rules (priority);

COMMENT ON TABLE seniority_rules IS 'Universal title → seniority mapping. Evaluator scans rules in ascending priority order and returns the first match. Priority 1 = IC overrides (must beat Manager catch-all), Priority 2 = Executive, 3 = Lead, 4 = Student, 5 = Manager catch-all.';
