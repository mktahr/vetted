-- 052_career_stage_bucket_thresholds_config.sql
--
-- Config table for the score threshold that separates 'vetted' from
-- 'needs_review' per career stage.
--
-- LOW THRESHOLDS BY DESIGN:
--   pre_career: 30, early_career: 35, mid_career: 40, senior_career: 45
--
--   The user's V1 product framework: curation happens at ingest (Matt
--   manually approves who lands in the DB), so the threshold gate is a
--   safety net for curation accidents, NOT a quality gate. Any candidate
--   passing ingest is intended to be searchable by default unless flagged.
--
-- BUCKET ASSIGNMENT RULES (implemented in code, this table just stores threshold):
--   score >= threshold AND flagged_reasons is empty → 'vetted'
--   score >= threshold AND flagged_reasons not empty → 'needs_review' (with flags)
--   score < threshold (no flags)                     → 'needs_review' (flags=['low_score'])
--   highest_seniority_reached='unknown'              → 'needs_review' (skip scoring)
--   non_vetted                                        → admin manual only

BEGIN;

-- ─── Schema ───────────────────────────────────────────────────────────

CREATE TABLE career_stage_bucket_thresholds (
  career_stage      career_stage_type PRIMARY KEY,
  vetted_threshold  INTEGER NOT NULL CHECK (vetted_threshold >= 0),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  notes             TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE career_stage_bucket_thresholds IS
  'Per-career-stage threshold for vetted vs needs_review bucket assignment. V1 thresholds are low by design — curation at ingest is the real quality gate; threshold is the safety net for curation accidents.';

-- ─── Seed ─────────────────────────────────────────────────────────────

INSERT INTO career_stage_bucket_thresholds (career_stage, vetted_threshold, notes) VALUES
  ('pre_career',    30, 'V1: low threshold; one tier-3 signal clears the bar by itself. Intentional.'),
  ('early_career',  35, 'V1: low threshold; curation at ingest is the real gate.'),
  ('mid_career',    40, 'V1: low threshold; core company-quality scoring dominates.'),
  ('senior_career', 45, 'V1: low threshold; core company-quality scoring dominates.');

-- ─── Verification ────────────────────────────────────────────────────

DO $$
DECLARE
  row_count INT;
BEGIN
  SELECT count(*) INTO row_count FROM career_stage_bucket_thresholds;
  IF row_count != 4 THEN
    RAISE EXCEPTION 'Migration 052: expected 4 career_stage_bucket_thresholds rows (one per stage), got %.', row_count;
  END IF;
  RAISE NOTICE 'Migration 052: 4 career stage thresholds seeded (pre=30, early=35, mid=40, senior=45).';
END $$;

COMMIT;
