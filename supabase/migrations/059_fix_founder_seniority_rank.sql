-- 059_fix_founder_seniority_rank.sql
--
-- Re-order seniority_dictionary ranks per the locked spec:
--   intern(1) < junior_ic(2) < individual_contributor(3) < senior_ic(4) <
--   lead_ic(5) < manager(6) < executive(7) < founder(8)
--
-- Current (pre-migration) ordering placed founder at rank 6 — between
-- lead_ic(5) and manager(7) — which contradicts the locked spec where
-- founder is the highest active rank (after executive).
--
-- WHAT THIS AFFECTS
--   compute-derived.ts uses rank_order to pick highest_seniority_reached.
--   Before this migration, a candidate who'd been Founder + Manager would
--   land highest_seniority='manager'. After this migration, same candidate
--   lands highest_seniority='founder'. The executive override in
--   score-candidate.ts is gated on highest_seniority='executive' (unchanged),
--   so founder-ranked candidates will not silently start scoring as
--   executives. The scoring engine's role_scope map (executive=1.0,
--   manager/founder=0.7) is also unchanged.
--
-- DEPRECATED ALIASES
--   'student' (1) and 'lead' (5) are preserved at their existing rank for
--   backward compat with old data. They're already inactive (active=false).

BEGIN;

UPDATE seniority_dictionary SET rank_order = 6 WHERE seniority_normalized = 'manager';
UPDATE seniority_dictionary SET rank_order = 7 WHERE seniority_normalized = 'executive';
UPDATE seniority_dictionary SET rank_order = 8 WHERE seniority_normalized = 'founder';

DO $$
DECLARE
  rec RECORD;
  founder_rank INT;
  manager_rank INT;
  exec_rank INT;
BEGIN
  SELECT rank_order INTO founder_rank FROM seniority_dictionary WHERE seniority_normalized = 'founder';
  SELECT rank_order INTO manager_rank FROM seniority_dictionary WHERE seniority_normalized = 'manager';
  SELECT rank_order INTO exec_rank FROM seniority_dictionary WHERE seniority_normalized = 'executive';

  IF founder_rank != 8 OR manager_rank != 6 OR exec_rank != 7 THEN
    RAISE EXCEPTION 'Migration 059: rank ordering mismatch. founder=%, manager=%, executive=% (expected 8/6/7)',
      founder_rank, manager_rank, exec_rank;
  END IF;

  RAISE NOTICE 'Migration 059: seniority ranks updated — manager=6, executive=7, founder=8 (founder is now highest active rank).';
END $$;

COMMIT;
