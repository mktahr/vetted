-- 096_prod_vocab_dev_parity.sql
--
-- MERGE-ARC halt-fix (2026-07-08): a read-only simulation of 085–095 against PROD's
-- actual rows showed prod would land at 154 active specialties, not the frozen 150 —
-- four PROD-ONLY active rows (absent entirely from dev's curated taxonomy) survive
-- the sequence:
--
--   blockchain        → blockchain_engineering   (085 suffix)   3 legacy exp refs
--   game_engineering  → (already suffixed)                      0 refs
--   qa_testing        → qa_testing_engineering   (085 suffix)   0 refs
--   robotics          → robotics_engineering     (085 suffix)   2 legacy exp refs
--                        ^^ COLLIDES with the robotics_engineering FUNCTION name —
--                        exactly the confusion class 086 killed robotics_software for.
--
-- The classifier prompt + eval are FROZEN against dev's exact 150-specialty vocab
-- (names + parents participate in the vocab hash; active specialties are listed in
-- the prompt and accepted by the validator). Post-merge the classifier reads PROD,
-- so prod's active set must equal dev's — this migration deactivates the four
-- (by pre- AND post-suffix names, defensive against apply-order) and re-asserts
-- migration 094's map invariant afterward (their map rows survive 094's suffix
-- rule while the rows are still active).
--
-- Legacy person refs (blockchain ×3, robotics ×2 in specialty_normalized) stay
-- as-is: unread post-flip; the classifier repopulates the real axes from evidence.
--
-- ORDER: after 094/095 (numeric). Safe in any order because the map cleanup +
-- invariant re-assert are self-healing. Empty-DB / dev tolerant: the rows don't
-- exist on dev → every statement no-ops and verification counts pass.
--
-- ADDITIVE / NON-ADDITIVE: NON-ADDITIVE (active-flag UPDATEs + map DELETEs).
-- Reversible via the _mergearc_20260708 snapshots.

BEGIN;

-- ─── Pre-flight diagnostics ─────────────────────────────────────────────

DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM specialty_dictionary
   WHERE active AND specialty_normalized IN
     ('blockchain','blockchain_engineering','game_engineering',
      'qa_testing','qa_testing_engineering','robotics','robotics_engineering');
  RAISE NOTICE 'Migration 096 pre-flight: % active drift rows present (prod expects 4 post-085; dev expects 0).', n;
END $$;

-- ─── Step 1: deactivate the four prod-only rows (both name forms) ───────

UPDATE specialty_dictionary SET active = false
 WHERE specialty_normalized IN
   ('blockchain','blockchain_engineering','game_engineering',
    'qa_testing','qa_testing_engineering','robotics','robotics_engineering');

-- ─── Step 2: re-assert 094's map invariant ──────────────────────────────
-- Their map rows survived 094 (targets were active then); remove them now.

DO $$
DECLARE doomed INT;
BEGIN
  SELECT count(*) INTO doomed FROM role_specialty_map rsm
   WHERE NOT EXISTS (SELECT 1 FROM specialty_dictionary sd
     WHERE sd.specialty_normalized = rsm.specialty_normalized AND sd.active);
  RAISE NOTICE 'Migration 096: deleting % map rows orphaned by the deactivation.', doomed;
END $$;

DELETE FROM role_specialty_map rsm
 WHERE NOT EXISTS (SELECT 1 FROM specialty_dictionary sd
   WHERE sd.specialty_normalized = rsm.specialty_normalized AND sd.active);

-- ─── Verification ───────────────────────────────────────────────────────
-- (1) none of the drift names remain active — this includes robotics_engineering,
--     the one name whose activation would collide with a FUNCTION name (dev's
--     frozen vocab deliberately gives robotics NO same-name generalist specialty;
--     the guarded robotics_software_engineering plays that role per 091). NOTE a
--     blanket "no specialty may share an active function name" check is WRONG —
--     the frozen vocab intentionally contains 10 self-parented same-name
--     generalist specialties (mechanical_engineering under mechanical_engineering,
--     etc.); the first draft of this block tripped on them on dev (fail-loud
--     working as designed) and was narrowed to the drift names.
-- (2) map invariant holds. Checks are name-targeted, not absolute-total, so the
--     block stays empty-DB tolerant.

DO $$
DECLARE
  drift_active INT;
  bad_map INT;
BEGIN
  SELECT count(*) INTO drift_active FROM specialty_dictionary
   WHERE active AND specialty_normalized IN
     ('blockchain','blockchain_engineering','game_engineering',
      'qa_testing','qa_testing_engineering','robotics','robotics_engineering');
  IF drift_active <> 0 THEN
    RAISE EXCEPTION 'Migration 096: % drift rows still active.', drift_active;
  END IF;

  SELECT count(*) INTO bad_map FROM role_specialty_map rsm
   WHERE NOT EXISTS (SELECT 1 FROM specialty_dictionary sd
     WHERE sd.specialty_normalized = rsm.specialty_normalized AND sd.active);
  IF bad_map <> 0 THEN
    RAISE EXCEPTION 'Migration 096: % map rows reference non-active specialties.', bad_map;
  END IF;

  RAISE NOTICE 'Migration 096 complete: prod vocab at dev parity; map invariant holds.';
END $$;

COMMIT;
