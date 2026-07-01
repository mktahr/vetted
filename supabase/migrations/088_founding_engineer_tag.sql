-- 088_founding_engineer_tag.sql
--
-- Founding / early-ENGINEER searchable TAG. These people ARE engineers (they classify
-- to their real discipline via the five-axis classifier); "founding/early" is a STAGE
-- attribute, and a critical search filter for the V1 wedge (find founding/early-team
-- engineers). DISTINCT from the founder flags (is_current_founder / is_former_founder),
-- which capture actual founders and deliberately EXCLUDE "Founding Engineer".
--
-- Title-driven TODAY (regex on title_raw in compute-derived.ts::FOUNDING_ENGINEER_TITLE_PATTERN:
-- "Founding [X] Engineer" / "First [X] Engineer" / "Early Engineer" / "Engineer #N").
-- Shaped so the ROADMAP inference layer (joined near founding date / before headcount N)
-- can later OR into the per-experience flag without a schema change.
--
-- (Dev-first. Prod at merge; backfill existing rows via scripts/compute-derived-fields.mjs,
--  which re-runs computeAndWriteDerivedFields per person and sets both columns.)

BEGIN;

-- Per-experience flag (title-driven now; inference-layer target later).
ALTER TABLE person_experiences
  ADD COLUMN IF NOT EXISTS is_founding_engineer_role BOOLEAN NOT NULL DEFAULT FALSE;

-- Person-level aggregate for search (TRUE if any experience is a founding-engineer role).
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS has_founding_engineer_experience BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: the search filter only ever queries the TRUE side.
CREATE INDEX IF NOT EXISTS idx_people_founding_engineer
  ON people (has_founding_engineer_experience)
  WHERE has_founding_engineer_experience = TRUE;

COMMIT;
