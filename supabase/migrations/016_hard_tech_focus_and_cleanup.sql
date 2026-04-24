-- ============================================================
-- Migration 016 — Hard-tech focus, specialty expansion, clearance,
-- career_stage_config realignment, and conditional cleanup.
-- ============================================================
--
-- Adds a `company_focus` dimension so the app can narrow results to
-- hard-tech companies without forking the data model. Introduces 23
-- new hardware/deep-tech specialties. Adds a `people.clearance_level`
-- field for defense/aerospace recruiting. Realigns career_stage_config
-- to match the scoring engine's actual boundaries (0.5 / 2 / 5).
--
-- Conditional drops are gated on verification done outside this file
-- (see implementation log). Drops included:
--   - school_scores
--   - school_specialization_scores
-- NOT dropped (verification failed — see report):
--   - title_dictionary.seniority_normalized (still referenced by
--     lib/normalize/titles.ts even though nothing consumes the value)
-- ============================================================


-- ─── STEP 1 — Company focus ────────────────────────────────────────────────

CREATE TYPE company_focus_type AS ENUM ('hard_tech', 'all_tech', 'unreviewed');

ALTER TABLE companies
  ADD COLUMN focus company_focus_type NOT NULL DEFAULT 'all_tech';

-- Backfill: companies that were auto-created via ingest and never triaged
-- are flagged 'unreviewed' so Matt can filter for "new companies to triage".
-- Auto-created companies have: manual_review_status='unreviewed' AND
-- no company_bucket AND no primary_industry_tag.
UPDATE companies
SET focus = 'unreviewed'
WHERE manual_review_status = 'unreviewed'
  AND company_bucket IS NULL
  AND primary_industry_tag IS NULL;

-- 'hard_tech' promotion is always manual — no automated rule here.

CREATE INDEX idx_companies_focus ON companies (focus);

COMMENT ON COLUMN companies.focus IS
  '3-state tag driving recruiter search scope. hard_tech = hardware/deep-tech/aerospace/defense/robotics; all_tech = every reviewed company in the searchable universe (includes hard_tech); unreviewed = auto-created via ingest, not yet triaged. Queries for all_tech match focus IN (hard_tech, all_tech). Queries for hard_tech match focus = hard_tech only.';


-- ─── STEP 6 — Hard-tech specialties ────────────────────────────────────────

INSERT INTO specialty_dictionary (specialty_normalized, parent_function, description, active)
VALUES
  ('mechanical_engineering',   'engineering', 'Mechanical design and engineering for physical products', true),
  ('electrical_engineering',   'engineering', 'Circuit design, power, analog/digital electronics', true),
  ('firmware',                 'engineering', 'Low-level firmware and embedded software close to hardware', true),
  ('flight_software',          'engineering', 'Software for aerospace/space vehicles — guidance, avionics integration', true),
  ('avionics',                 'engineering', 'Aerospace electronics systems and integration', true),
  ('gnc',                      'engineering', 'Guidance, navigation, and controls — aerospace, robotics, autonomous systems', true),
  ('propulsion',               'engineering', 'Rocket engines, jet engines, propulsion systems', true),
  ('controls_engineering',     'engineering', 'Control systems, control theory, closed-loop controllers', true),
  ('rf_engineering',           'engineering', 'Radio frequency design, antennas, wireless communication', true),
  ('fpga_engineering',         'engineering', 'FPGA design and verification', true),
  ('asic_engineering',         'engineering', 'ASIC/chip design', true),
  ('hardware_engineering',     'engineering', 'General hardware engineering — PCB, schematic capture, prototyping', true),
  ('systems_engineering',      'engineering', 'Systems architecture and integration across disciplines', true),
  ('test_engineering',         'engineering', 'Test engineering for hardware — HIL, SIL, validation, qualification', true),
  ('manufacturing_engineering','engineering', 'Manufacturing process engineering, DFM, production engineering', true),
  ('reliability_engineering',  'engineering', 'Reliability engineering, qualification, failure analysis', true),
  ('quality_engineering',      'engineering', 'Quality engineering for hardware and physical products', true),
  ('structural_engineering',   'engineering', 'Structural analysis, FEA, load-bearing design', true),
  ('thermal_engineering',      'engineering', 'Thermal design, thermal analysis, cooling systems', true),
  ('materials_engineering',    'engineering', 'Materials science, metallurgy, composites', true),
  ('power_electronics',        'engineering', 'Power electronics, motor drives, power conversion', true),
  ('optics_engineering',       'engineering', 'Optical engineering, photonics, imaging systems', true),
  ('mechatronics',             'engineering', 'Mechatronic systems combining mechanical, electrical, software', true);


-- ─── STEP 8 — Clearance on people ──────────────────────────────────────────

CREATE TYPE clearance_level_type AS ENUM (
  'unknown', 'none', 'confidential', 'secret', 'top_secret',
  'ts_sci', 'q_clearance', 'other'
);

ALTER TABLE people
  ADD COLUMN clearance_level clearance_level_type NOT NULL DEFAULT 'unknown',
  ADD COLUMN clearance_notes TEXT;

COMMENT ON COLUMN people.clearance_level IS
  'US government clearance level for defense/aerospace recruiting. Default unknown; manually edited — not inferred.';


-- ─── STEP 9 — Realign career_stage_config to match scoring engine ──────────
--
-- The scoring engine and inferCareerStage() both use 0.5 / 2 / 5 as stage
-- boundaries. The config table historically had 0 / 4 / 10, which drifted.
-- Bring the table to canonical. No code reads this table today — update is
-- for correctness and to avoid misleading anyone who does read it later.

UPDATE career_stage_config
SET max_full_time_years_experience = 0.5
WHERE career_stage = 'pre_career';

UPDATE career_stage_config
SET min_full_time_years_experience = 0.5,
    max_full_time_years_experience = 2.0
WHERE career_stage = 'early_career';

UPDATE career_stage_config
SET min_full_time_years_experience = 2.0,
    max_full_time_years_experience = 5.0
WHERE career_stage = 'mid_career';

UPDATE career_stage_config
SET min_full_time_years_experience = 5.0
WHERE career_stage = 'senior_career';


-- ─── STEP 11 — Conditional cleanup (verified empty + 0 app references) ────
-- Verified 2026-04-24:
--   * school_scores: 0 rows in prod, 0 references in app/, lib/, scripts/
--   * school_specialization_scores: 0 rows, 0 references
-- Scores live on schools.school_score directly (added in migration 003).

DROP TABLE IF EXISTS school_specialization_scores;
DROP TABLE IF EXISTS school_scores;

-- NOTE on title_dictionary.seniority_normalized:
-- Instructed to drop if there were zero application references. Verification
-- found the column IS selected in lib/normalize/titles.ts (the returned
-- value isn't consumed downstream, but the SELECT list would break if the
-- column disappeared). Per the strict rule, the drop is SKIPPED until that
-- query is updated to omit the column.


-- ─── STEP 12 — Forward-looking scoping convention for function scores ─────
--
-- company_function_scores is reserved for non-engineering functions where
-- exceptional quality differentiates companies. Engineering is implicit in
-- the overall company_year_scores.company_score. Only design, operations,
-- and sales are allowed for now. This is a forward-looking CHECK — the
-- table is empty today (verified).

ALTER TABLE company_function_scores
  ADD CONSTRAINT company_function_scores_allowed_functions
  CHECK (function_normalized IN ('design', 'operations', 'sales'));


-- ─── End of migration 016 ─────────────────────────────────────────────────
