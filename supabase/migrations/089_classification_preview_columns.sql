-- 089_classification_preview_columns.sql
--
-- SEPARATE, clearly-labeled PREVIEW columns for eyeballing five-axis classifier output on
-- real profiles in the app WITHOUT touching any live state. Distinct from the real
-- *_inferred columns (which the production classifier writes via commit_classification) AND
-- from the classification_status lifecycle column (the real classifier's QUEUE key). A
-- preview writer touches ONLY these columns + provenance — never lifecycle, never _inferred.
-- Per Codex review (2026-07-01): "separate preview columns plus a batch record, never touch
-- production classifier lifecycle state."
--
-- Additive / inert: nothing reads these except the (read-only) profile preview panel.
-- (Applied dev + prod — purely additive.)

BEGIN;

ALTER TABLE person_experiences
  ADD COLUMN IF NOT EXISTS function_inferred_preview          TEXT[],
  ADD COLUMN IF NOT EXISTS specialty_inferred_preview         TEXT[],
  ADD COLUMN IF NOT EXISTS skills_inferred_preview            TEXT[],
  ADD COLUMN IF NOT EXISTS title_normalized_inferred_preview  TEXT,
  -- provenance (the "batch record", per-row): which prompt produced this + when.
  ADD COLUMN IF NOT EXISTS classification_preview_version     TEXT,
  ADD COLUMN IF NOT EXISTS classification_preview_at          TIMESTAMPTZ;

COMMIT;
