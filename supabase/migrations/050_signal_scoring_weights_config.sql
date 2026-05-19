-- 050_signal_scoring_weights_config.sql
--
-- Config table for bonus signal scoring weights. Replaces the hardcoded
-- bonus weight values in lib/scoring/score-candidate.ts STAGE_WEIGHTS.bonus.
--
-- WHY A CONFIG TABLE:
--   Bonus weights are going to be tuned heavily based on recruiter feedback
--   post-launch. Hardcoded values would require a code deploy for every tweak.
--   This table is read by the scoring engine once per batch run (cached
--   in-memory), then per-candidate scoring is in-memory lookup.
--
-- LOOKUP STRATEGY:
--   Per scoring spec — direct point values, NO multiplier math.
--   For tiered categories (olympiad, fellowship, national_lab, hackathon,
--   publication, incubator), lookup is (category, tier_group, career_stage).
--   For flat categories (patent, former_founder, open_source, etc.), tier_group
--   is NULL and lookup is (category, NULL, career_stage).
--
-- CORE WEIGHTS STAY HARDCODED:
--   This table holds BONUS-tier weights only. Core weights (education,
--   degree_relevance, internships, company_quality_*) stay in
--   lib/scoring/score-candidate.ts STAGE_WEIGHTS.core. The user explicitly
--   said "no changes to existing core weight profiles."
--
-- PLACEHOLDER WEIGHTS:
--   - open_source: declared with points but evaluates to 0 in code (no GitHub
--     enrichment yet)
--   - growth_stage_tenure: declared with points but evaluates to 0 in code
--     (no company funding round history populated yet)
--   - company_function_quality: existing legacy weight, sourced from
--     company_function_scores table (often empty), evaluates to 0 for most
--   These rows exist so the scoring engine can read them once the underlying
--   data sources are wired up. No code change needed when data arrives.

BEGIN;

-- ─── Schema ───────────────────────────────────────────────────────────

CREATE TABLE signal_scoring_weights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL,
  tier_group    TEXT,
  career_stage  career_stage_type NOT NULL,
  points        INTEGER NOT NULL CHECK (points >= 0),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint via expression index (PRIMARY KEY can't include COALESCE).
-- Treats NULL tier_group as the literal '__flat__' for uniqueness purposes.
CREATE UNIQUE INDEX idx_signal_scoring_weights_unique
  ON signal_scoring_weights (category, COALESCE(tier_group, '__flat__'), career_stage);

CREATE INDEX idx_signal_scoring_weights_lookup
  ON signal_scoring_weights (category, career_stage)
  WHERE is_active = TRUE;

COMMENT ON TABLE signal_scoring_weights IS
  'Bonus signal point values by (category, tier_group, career_stage). Read once per batch by scoring engine. Core weights stay in code.';

-- ─── Seed: tiered signal categories ───────────────────────────────────
-- Pre/early get same values per scoring spec.
-- Mid = ~60% of pre/early (rounded).
-- Senior = ~40% of pre/early (rounded), except publications/patents stay
-- higher because cumulative academic output.

INSERT INTO signal_scoring_weights (category, tier_group, career_stage, points, notes) VALUES
  -- olympiad
  ('olympiad', 'tier_3', 'pre_career',    30, NULL),
  ('olympiad', 'tier_2', 'pre_career',    20, NULL),
  ('olympiad', 'tier_1', 'pre_career',    10, NULL),
  ('olympiad', 'tier_3', 'early_career',  30, NULL),
  ('olympiad', 'tier_2', 'early_career',  20, NULL),
  ('olympiad', 'tier_1', 'early_career',  10, NULL),
  ('olympiad', 'tier_3', 'mid_career',    18, '60% taper'),
  ('olympiad', 'tier_2', 'mid_career',    12, '60% taper'),
  ('olympiad', 'tier_1', 'mid_career',     6, '60% taper'),
  ('olympiad', 'tier_3', 'senior_career',  8, '~40% taper'),
  ('olympiad', 'tier_2', 'senior_career',  5, '~40% taper'),
  ('olympiad', 'tier_1', 'senior_career',  3, '~40% taper'),

  -- fellowship
  ('fellowship', 'tier_3', 'pre_career',    30, NULL),
  ('fellowship', 'tier_2', 'pre_career',    20, NULL),
  ('fellowship', 'tier_1', 'pre_career',    10, NULL),
  ('fellowship', 'tier_3', 'early_career',  30, NULL),
  ('fellowship', 'tier_2', 'early_career',  20, NULL),
  ('fellowship', 'tier_1', 'early_career',  10, NULL),
  ('fellowship', 'tier_3', 'mid_career',    18, '60% taper'),
  ('fellowship', 'tier_2', 'mid_career',    12, '60% taper'),
  ('fellowship', 'tier_1', 'mid_career',     6, '60% taper'),
  ('fellowship', 'tier_3', 'senior_career', 10, NULL),
  ('fellowship', 'tier_2', 'senior_career',  7, NULL),
  ('fellowship', 'tier_1', 'senior_career',  4, NULL),

  -- incubator (mirrors fellowship per addition B — accelerator = strong signal at any stage)
  ('incubator', 'tier_3', 'pre_career',    30, NULL),
  ('incubator', 'tier_2', 'pre_career',    20, NULL),
  ('incubator', 'tier_1', 'pre_career',    10, NULL),
  ('incubator', 'tier_3', 'early_career',  30, NULL),
  ('incubator', 'tier_2', 'early_career',  20, NULL),
  ('incubator', 'tier_1', 'early_career',  10, NULL),
  ('incubator', 'tier_3', 'mid_career',    18, '60% taper'),
  ('incubator', 'tier_2', 'mid_career',    12, '60% taper'),
  ('incubator', 'tier_1', 'mid_career',     6, '60% taper'),
  ('incubator', 'tier_3', 'senior_career', 10, NULL),
  ('incubator', 'tier_2', 'senior_career',  7, NULL),
  ('incubator', 'tier_1', 'senior_career',  4, NULL),

  -- national_lab
  ('national_lab', 'tier_3', 'pre_career',    25, NULL),
  ('national_lab', 'tier_2', 'pre_career',    17, NULL),
  ('national_lab', 'tier_1', 'pre_career',     8, NULL),
  ('national_lab', 'tier_3', 'early_career',  25, NULL),
  ('national_lab', 'tier_2', 'early_career',  17, NULL),
  ('national_lab', 'tier_1', 'early_career',   8, NULL),
  ('national_lab', 'tier_3', 'mid_career',    15, '60% taper'),
  ('national_lab', 'tier_2', 'mid_career',    10, '60% taper'),
  ('national_lab', 'tier_1', 'mid_career',     5, '60% taper'),
  ('national_lab', 'tier_3', 'senior_career',  8, '~40% taper'),
  ('national_lab', 'tier_2', 'senior_career',  5, '~40% taper'),
  ('national_lab', 'tier_1', 'senior_career',  3, '~40% taper'),

  -- hackathon
  ('hackathon', 'tier_3', 'pre_career',    15, NULL),
  ('hackathon', 'tier_2', 'pre_career',    10, NULL),
  ('hackathon', 'tier_1', 'pre_career',     5, NULL),
  ('hackathon', 'tier_3', 'early_career',  15, NULL),
  ('hackathon', 'tier_2', 'early_career',  10, NULL),
  ('hackathon', 'tier_1', 'early_career',   5, NULL),
  ('hackathon', 'tier_3', 'mid_career',     6, '60% taper'),
  ('hackathon', 'tier_2', 'mid_career',     4, '60% taper'),
  ('hackathon', 'tier_1', 'mid_career',     2, '60% taper'),
  ('hackathon', 'tier_3', 'senior_career',  3, '~40% taper'),
  ('hackathon', 'tier_2', 'senior_career',  2, '~40% taper'),
  ('hackathon', 'tier_1', 'senior_career',  1, '~40% taper'),

  -- publication (stays higher at senior because cumulative)
  ('publication', 'tier_3', 'pre_career',    25, NULL),
  ('publication', 'tier_2', 'pre_career',    17, NULL),
  ('publication', 'tier_1', 'pre_career',     8, NULL),
  ('publication', 'tier_3', 'early_career',  25, NULL),
  ('publication', 'tier_2', 'early_career',  17, NULL),
  ('publication', 'tier_1', 'early_career',   8, NULL),
  ('publication', 'tier_3', 'mid_career',    20, 'cumulative — modest taper'),
  ('publication', 'tier_2', 'mid_career',    13, 'cumulative — modest taper'),
  ('publication', 'tier_1', 'mid_career',     7, 'cumulative — modest taper'),
  ('publication', 'tier_3', 'senior_career', 15, 'cumulative — modest taper'),
  ('publication', 'tier_2', 'senior_career', 10, 'cumulative — modest taper'),
  ('publication', 'tier_1', 'senior_career',  5, 'cumulative — modest taper');

-- ─── Seed: flat categories (no tier) ──────────────────────────────────

INSERT INTO signal_scoring_weights (category, tier_group, career_stage, points, notes) VALUES
  -- patent (flat — cumulative, stable across stages)
  ('patent', NULL, 'pre_career',    15, NULL),
  ('patent', NULL, 'early_career',  15, NULL),
  ('patent', NULL, 'mid_career',    15, NULL),
  ('patent', NULL, 'senior_career', 15, NULL),

  -- former_founder (flat)
  ('former_founder', NULL, 'pre_career',    20, NULL),
  ('former_founder', NULL, 'early_career',  20, NULL),
  ('former_founder', NULL, 'mid_career',    15, NULL),
  ('former_founder', NULL, 'senior_career', 12, NULL),

  -- open_source (PLACEHOLDER — points declared but engine evaluates to 0 until OSS layer ships)
  ('open_source', NULL, 'pre_career',    20, 'PLACEHOLDER — no OSS data source yet'),
  ('open_source', NULL, 'early_career',  20, 'PLACEHOLDER — no OSS data source yet'),
  ('open_source', NULL, 'mid_career',    12, 'PLACEHOLDER — no OSS data source yet'),
  ('open_source', NULL, 'senior_career',  8, 'PLACEHOLDER — no OSS data source yet'),

  -- growth_stage_tenure (PLACEHOLDER — points declared but engine evaluates to 0 until funding history data ships)
  ('growth_stage_tenure', NULL, 'pre_career',     0, 'PLACEHOLDER — N/A for pre-career'),
  ('growth_stage_tenure', NULL, 'early_career',   0, 'PLACEHOLDER — needs funding round history'),
  ('growth_stage_tenure', NULL, 'mid_career',    15, 'PLACEHOLDER — needs funding round history'),
  ('growth_stage_tenure', NULL, 'senior_career', 10, 'PLACEHOLDER — needs funding round history'),

  -- career_slope (existing — reads people.title_level_slope; only fires for "rising")
  ('career_slope', NULL, 'pre_career',     0, NULL),
  ('career_slope', NULL, 'early_career',   0, NULL),
  ('career_slope', NULL, 'mid_career',    15, NULL),
  ('career_slope', NULL, 'senior_career', 10, NULL),

  -- company_quality_slope (NEW — parallel to career_slope; reads people.career_progression)
  ('company_quality_slope', NULL, 'pre_career',     0, NULL),
  ('company_quality_slope', NULL, 'early_career',   0, NULL),
  ('company_quality_slope', NULL, 'mid_career',    10, NULL),
  ('company_quality_slope', NULL, 'senior_career',  5, NULL),

  -- biz_unit (existing — placeholder weight, no data source today)
  ('biz_unit', NULL, 'pre_career',     0, NULL),
  ('biz_unit', NULL, 'early_career',  25, 'PLACEHOLDER — no biz_unit data source yet'),
  ('biz_unit', NULL, 'mid_career',    25, 'PLACEHOLDER'),
  ('biz_unit', NULL, 'senior_career', 25, 'PLACEHOLDER'),

  -- company_function_quality (existing — sourced from company_function_scores; mostly NULL → 0)
  ('company_function_quality', NULL, 'pre_career',     0, NULL),
  ('company_function_quality', NULL, 'early_career',  10, NULL),
  ('company_function_quality', NULL, 'mid_career',    10, NULL),
  ('company_function_quality', NULL, 'senior_career', 10, NULL);

-- ─── Verification ────────────────────────────────────────────────────

DO $$
DECLARE
  total_rows INT;
BEGIN
  SELECT count(*) INTO total_rows FROM signal_scoring_weights;
  IF total_rows != 104 THEN
    RAISE EXCEPTION 'Migration 050: expected 104 signal_scoring_weights rows seeded, got %.', total_rows;
  END IF;
  RAISE NOTICE 'Migration 050: % signal_scoring_weights rows seeded (6 tiered categories × 4 stages × 3 tiers + 8 flat categories × 4 stages).', total_rows;
END $$;

COMMIT;
