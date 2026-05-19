-- 051_team_role_scoring_weights_config.sql
--
-- Config table for team membership scoring. Direct point lookup by
-- (team_tier, team_role_tier, career_stage) — no multiplier math.
--
-- Read once per batch by scoring engine. When a person_signals row points
-- at an engineering_team category entry, the scoring engine:
--   1. Reads person_signals.team_role_tier (1-4, populated by import-teams.mjs
--      or future role extractor; NULL treated as 1 = Member)
--   2. Reads teams.tier_int (1-3) via signal_id → teams join
--   3. Reads people.career_stage_assigned
--   4. Looks up points in this table
--
-- V1 ROLE DETECTION CAVEAT:
--   import-teams.mjs only populates team_role_tier=4 (Captain/Chief from regex
--   on title) and team_role_tier=1 (everyone else / NULL). Tiers 2 and 3 stay
--   NULL until V2 extractor. NULL treated as Member (tier=1) per spec.

BEGIN;

-- ─── Schema ───────────────────────────────────────────────────────────

CREATE TABLE team_role_scoring_weights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_tier       INTEGER NOT NULL CHECK (team_tier BETWEEN 1 AND 3),
  team_role_tier  INTEGER NOT NULL CHECK (team_role_tier BETWEEN 1 AND 4),
  career_stage    career_stage_type NOT NULL,
  points          INTEGER NOT NULL CHECK (points >= 0),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (team_tier, team_role_tier, career_stage)
);

CREATE INDEX idx_team_role_scoring_lookup
  ON team_role_scoring_weights (team_tier, team_role_tier, career_stage)
  WHERE is_active = TRUE;

COMMENT ON TABLE team_role_scoring_weights IS
  'Direct point lookup table for team membership scoring. NO multipliers — every (team_tier, team_role_tier, career_stage) tuple has an explicit point value. NULL team_role_tier on person_signals is treated as 1 (Member).';

-- ─── Seed: pre_career and early_career (same values per spec) ─────────

INSERT INTO team_role_scoring_weights (team_tier, team_role_tier, career_stage, points, notes) VALUES
  -- Tier 3 team (elite): Captain=30, Subteam Lead=20, Engineer=12, Member=8
  (3, 4, 'pre_career',   30, 'Captain/Chief on elite team'),
  (3, 3, 'pre_career',   20, 'Dept/Subteam Lead on elite team'),
  (3, 2, 'pre_career',   12, 'Engineer/Specialist on elite team'),
  (3, 1, 'pre_career',    8, 'Member on elite team'),
  (3, 4, 'early_career', 30, 'Captain/Chief on elite team'),
  (3, 3, 'early_career', 20, 'Dept/Subteam Lead on elite team'),
  (3, 2, 'early_career', 12, 'Engineer/Specialist on elite team'),
  (3, 1, 'early_career',  8, 'Member on elite team'),

  -- Tier 2 team (strong)
  (2, 4, 'pre_career',   22, 'Captain/Chief on strong team'),
  (2, 3, 'pre_career',   15, 'Dept/Subteam Lead on strong team'),
  (2, 2, 'pre_career',    9, 'Engineer/Specialist on strong team'),
  (2, 1, 'pre_career',    6, 'Member on strong team'),
  (2, 4, 'early_career', 22, 'Captain/Chief on strong team'),
  (2, 3, 'early_career', 15, 'Dept/Subteam Lead on strong team'),
  (2, 2, 'early_career',  9, 'Engineer/Specialist on strong team'),
  (2, 1, 'early_career',  6, 'Member on strong team'),

  -- Tier 1 team (standard)
  (1, 4, 'pre_career',   15, 'Captain/Chief on standard team'),
  (1, 3, 'pre_career',   10, 'Dept/Subteam Lead on standard team'),
  (1, 2, 'pre_career',    6, 'Engineer/Specialist on standard team'),
  (1, 1, 'pre_career',    4, 'Member on standard team'),
  (1, 4, 'early_career', 15, 'Captain/Chief on standard team'),
  (1, 3, 'early_career', 10, 'Dept/Subteam Lead on standard team'),
  (1, 2, 'early_career',  6, 'Engineer/Specialist on standard team'),
  (1, 1, 'early_career',  4, 'Member on standard team');

-- ─── Seed: mid_career (60% of pre/early, rounded) ─────────────────────

INSERT INTO team_role_scoring_weights (team_tier, team_role_tier, career_stage, points, notes) VALUES
  (3, 4, 'mid_career', 18, '60% taper'),
  (3, 3, 'mid_career', 12, '60% taper'),
  (3, 2, 'mid_career',  7, '60% taper'),
  (3, 1, 'mid_career',  5, '60% taper'),

  (2, 4, 'mid_career', 13, '60% taper'),
  (2, 3, 'mid_career',  9, '60% taper'),
  (2, 2, 'mid_career',  5, '60% taper'),
  (2, 1, 'mid_career',  4, '60% taper'),

  (1, 4, 'mid_career',  9, '60% taper'),
  (1, 3, 'mid_career',  6, '60% taper'),
  (1, 2, 'mid_career',  4, '60% taper'),
  (1, 1, 'mid_career',  2, '60% taper');

-- ─── Seed: senior_career (40% of pre/early, rounded) ──────────────────

INSERT INTO team_role_scoring_weights (team_tier, team_role_tier, career_stage, points, notes) VALUES
  (3, 4, 'senior_career', 12, '~40% taper'),
  (3, 3, 'senior_career',  8, '~40% taper'),
  (3, 2, 'senior_career',  5, '~40% taper'),
  (3, 1, 'senior_career',  3, '~40% taper'),

  (2, 4, 'senior_career',  9, '~40% taper'),
  (2, 3, 'senior_career',  6, '~40% taper'),
  (2, 2, 'senior_career',  4, '~40% taper'),
  (2, 1, 'senior_career',  2, '~40% taper'),

  (1, 4, 'senior_career',  6, '~40% taper'),
  (1, 3, 'senior_career',  4, '~40% taper'),
  (1, 2, 'senior_career',  2, '~40% taper'),
  (1, 1, 'senior_career',  2, '~40% taper');

-- ─── Verification ────────────────────────────────────────────────────

DO $$
DECLARE
  total_rows INT;
BEGIN
  SELECT count(*) INTO total_rows FROM team_role_scoring_weights;
  IF total_rows != 48 THEN
    RAISE EXCEPTION 'Migration 051: expected 48 team_role_scoring_weights rows (3 team_tiers × 4 role_tiers × 4 career_stages), got %.', total_rows;
  END IF;
  RAISE NOTICE 'Migration 051: % team_role_scoring_weights rows seeded.', total_rows;
END $$;

COMMIT;
