-- 055_people_founder_flags.sql
--
-- Add two derived founder flags to `people`. These are computed by
-- compute-derived.ts and are mutually exclusive by definition:
--
--   is_current_founder — TRUE if the candidate has ANY current-role
--     founder-titled experience (or seniority_normalized='founder' on
--     a current role). Default search EXCLUDES these candidates —
--     active founders are not recruitable targets. Recruiter can opt in.
--
--   is_former_founder — TRUE if the candidate has a past founder role
--     AND is_current_founder=FALSE. Surfaces as a positive-signal chip.
--
-- Both columns are searchable filters (default-excluded for current,
-- displayed as chip for former). Indexed for filter performance.

BEGIN;

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS is_current_founder BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_former_founder  BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN people.is_current_founder IS
  'TRUE if candidate has any is_current=true experience with founder-titled role. Default search excludes these candidates; recruiter can opt in.';

COMMENT ON COLUMN people.is_former_founder IS
  'TRUE if candidate has past founder role AND is_current_founder=FALSE. Mutually exclusive with is_current_founder. Surfaces as positive-signal chip.';

CREATE INDEX IF NOT EXISTS idx_people_is_current_founder
  ON people (is_current_founder)
  WHERE is_current_founder = TRUE;

CREATE INDEX IF NOT EXISTS idx_people_is_former_founder
  ON people (is_former_founder)
  WHERE is_former_founder = TRUE;

DO $$
BEGIN
  RAISE NOTICE 'Migration 055: is_current_founder + is_former_founder added to people. Values populated by computeAndWriteDerivedFields() in compute-derived.ts; backfill via scripts/compute-derived-fields.mjs.';
END $$;

COMMIT;
