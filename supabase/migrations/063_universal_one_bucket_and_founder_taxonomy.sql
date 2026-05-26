-- 063_universal_one_bucket_and_founder_taxonomy.sql
--
-- Three changes:
-- A. Universal one-bucket filter policy: is_searchable=FALSE on ALL individual
--    signal_dictionary rows. Only category-level filters surface in the UI.
--    Granular search (Y Combinator, USAMO, Stanford Mayfield, etc.) will land
--    via the AI chat search workstream later.
-- B. Founder taxonomy: add is_vc_backed_founder + is_bootstrapped_founder
--    BOOLEAN columns to people. Binary classification, no Unknown bucket.
--    Derivation logic lives in lib/scoring/compute-derived.ts and reruns
--    on every scoreCandidate so candidates auto-reclassify as data improves.
-- C. Drop "Side Project Founder" from signal_dictionary — too noisy to
--    track as its own signal type.

BEGIN;

-- ─── A. Universal one-bucket filter policy ──────────────────────────────

UPDATE signal_dictionary SET is_searchable = FALSE WHERE is_searchable = TRUE;

-- Verify: every row should now be is_searchable=FALSE.
DO $$
DECLARE
  searchable_true INT;
BEGIN
  SELECT count(*) INTO searchable_true FROM signal_dictionary WHERE is_searchable = TRUE;
  IF searchable_true != 0 THEN
    RAISE EXCEPTION 'Migration 063A: % signal_dictionary rows still have is_searchable=TRUE; universal policy violation.', searchable_true;
  END IF;
END $$;

-- ─── B. Founder taxonomy columns ────────────────────────────────────────

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS is_vc_backed_founder BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_bootstrapped_founder BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN people.is_vc_backed_founder IS
  'TRUE if candidate has any founder-titled experience where the company has VC-backing signals: recorded funding rounds, recorded investors (VC firms or angels), incubator/accelerator affiliation via person_signals, or acquisition/IPO status. Derived by compute-derived.ts; re-evaluated on each scoreCandidate so candidates auto-reclassify as funding data improves.';

COMMENT ON COLUMN people.is_bootstrapped_founder IS
  'TRUE if candidate has any founder-titled experience where the company has NO VC-backing signals (no funding rounds, no recorded investors, no incubator/accelerator affiliation, not acquired/public). Also TRUE for founder experiences where the company is not in the companies table at all (better to surface than hide). Mutually compatible with is_vc_backed_founder — a candidate can have founded one VC-backed and one bootstrapped company.';

CREATE INDEX IF NOT EXISTS idx_people_is_vc_backed_founder ON people (is_vc_backed_founder) WHERE is_vc_backed_founder = TRUE;
CREATE INDEX IF NOT EXISTS idx_people_is_bootstrapped_founder ON people (is_bootstrapped_founder) WHERE is_bootstrapped_founder = TRUE;

-- ─── C. Drop Side Project Founder ───────────────────────────────────────

DELETE FROM signal_dictionary
  WHERE canonical_name = 'Side Project Founder' AND category = 'founder';

DO $$
DECLARE
  founder_count INT;
  remaining_side INT;
BEGIN
  SELECT count(*) INTO founder_count FROM signal_dictionary WHERE category = 'founder';
  SELECT count(*) INTO remaining_side FROM signal_dictionary WHERE canonical_name = 'Side Project Founder';
  IF remaining_side > 0 THEN
    RAISE EXCEPTION 'Migration 063C: Side Project Founder still present.';
  END IF;
  RAISE NOTICE 'Migration 063: universal is_searchable=FALSE applied. People.is_vc_backed_founder + is_bootstrapped_founder columns added (backfill via rescore-all). founder category now has % rows (was 4, dropped Side Project Founder).', founder_count;
END $$;

COMMIT;
