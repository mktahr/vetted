-- ============================================================
-- Vetted — Persist full score breakdown on bucket assignments
--
-- Adds a `score_breakdown` jsonb column to candidate_bucket_assignments.
-- This will hold the full ScoreResult payload from scoreCandidate():
--
--   {
--     components: ScoreComponent[],   -- per-signal name/category/weight/raw/points/note
--     core_score: number,
--     bonus_score: number,
--     penalty_score: number,
--     total_score: number,
--     scoring_stage: string,
--     years_experience: number | null,
--     function_normalized: string | null,
--     applied_recruiting_override: boolean,
--     career_progression: string | null,
--     highest_seniority_reached: string | null,
--     has_early_stage_experience: boolean,
--     has_hypergrowth_experience: boolean
--   }
--
-- Purpose: the UI's expandable score-breakdown panel reads per-signal data
-- from this column so it reflects the snapshot the bucket decision was
-- actually based on (not whatever the rules would produce today).
-- ============================================================

ALTER TABLE candidate_bucket_assignments
  ADD COLUMN IF NOT EXISTS score_breakdown JSONB;

COMMENT ON COLUMN candidate_bucket_assignments.score_breakdown IS
  'Snapshot of ScoreResult at time of assignment: components[], core/bonus/penalty/total scores, stage, recruiting-override flag, and derived signals. See lib/scoring/score-candidate.ts.';
