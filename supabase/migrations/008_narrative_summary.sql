-- Migration 008 — AI narrative summary cache
--
-- Adds two columns on `people` for the Claude-generated narrative:
--   narrative_summary               text — 2-4 sentence summary, regenerable
--   narrative_summary_generated_at  timestamptz — when it was last generated

ALTER TABLE people ADD COLUMN IF NOT EXISTS narrative_summary TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS narrative_summary_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN people.narrative_summary IS
  'AI-generated 2-4 sentence summary derived ONLY from structured data we have. Cached; regenerated on demand via /api/people/[id]/narrative.';
COMMENT ON COLUMN people.narrative_summary_generated_at IS
  'When narrative_summary was last generated. Null if never generated.';
