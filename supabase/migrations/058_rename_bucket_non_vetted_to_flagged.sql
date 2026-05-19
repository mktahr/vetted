-- 058_rename_bucket_non_vetted_to_flagged.sql
--
-- Renumbered from 056 → 058 to avoid collision with the parallel
-- sourcing-pipeline workstream (which claims 056/057 on its own branch).
--
-- Rename candidate_bucket value 'non_vetted' → 'flagged'.
--
-- Why: 'non_vetted' was ambiguous (could read as "not yet vetted" — which is
-- what needs_review means). 'flagged' is clearer for the admin-manual-hide
-- semantic: a candidate explicitly flagged out of default view, with
-- flagged_reasons[] explaining why.
--
-- Semantic unchanged — same bucket assignment rules, same admin-only origin.
-- Engine still never auto-assigns this bucket; only admin overrides set it.
-- Default UI behavior: flagged candidates excluded from the main list unless
-- 'Flagged' is explicitly selected in the bucket filter sidebar.
--
-- The candidate_bucket column is TEXT (per migration 049) so this is a simple
-- CHECK constraint update + data UPDATE — no enum surgery needed.

BEGIN;

-- ─── 1. Drop old CHECK so the UPDATE below isn't rejected ────────────

ALTER TABLE candidate_bucket_assignments
  DROP CONSTRAINT IF EXISTS candidate_bucket_assignments_candidate_bucket_check;

-- ─── 2. Update existing rows ─────────────────────────────────────────

UPDATE candidate_bucket_assignments
  SET candidate_bucket = 'flagged'
  WHERE candidate_bucket = 'non_vetted';

-- ─── 3. Add new CHECK ────────────────────────────────────────────────

ALTER TABLE candidate_bucket_assignments
  ADD CONSTRAINT candidate_bucket_assignments_candidate_bucket_check
  CHECK (candidate_bucket IN ('vetted', 'needs_review', 'flagged'));

-- ─── Verification ────────────────────────────────────────────────────

DO $$
DECLARE
  bad_count INT;
BEGIN
  SELECT count(*) INTO bad_count
    FROM candidate_bucket_assignments
    WHERE candidate_bucket = 'non_vetted';
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Migration 058: % rows still have candidate_bucket=non_vetted after UPDATE.', bad_count;
  END IF;
  RAISE NOTICE 'Migration 058: non_vetted → flagged rename complete. New CHECK enforces (vetted, needs_review, flagged).';
END $$;

COMMIT;
