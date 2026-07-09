-- 095_founder_function_person_cascade.sql
--
-- MERGE-ARC step (five-axis sub-PR 3): person-data + title_dictionary cascade for
-- migration 087's founder-function deprecation. Matt's call (2026-07-08): founder
-- function rows → 'unknown'. Matches 087's intent — "founding" is a STAGE/ATTRIBUTE,
-- not a discipline; ceo / non-technical co-founder business roles are excluded like
-- TPM/analyst; a TECHNICAL founding engineer gets their real discipline from the
-- CLASSIFIER (function_inferred), not from this legacy column.
--
-- Three surfaces (prod counts verified read-only 2026-07-08):
--   1. title_dictionary — 8 rows still map founder titles → function='founder'.
--      WITHOUT this, every future ingest of a founder-titled role re-creates
--      function_normalized='founder' rows (found in artifact recon; the plan's
--      original 094 draft missed it). → 'unknown'.
--   2. person_experiences — 12 rows at function_normalized='founder' → 'unknown'.
--   3. people.current_function_normalized — 0 rows on prod today, but recompute
--      defensively (dev + future replays): people whose current function is
--      'founder' get it re-derived from their primary-current experience (073
--      step-4 pattern); anyone left (no current experience) → 'unknown'.
--
-- UNAFFECTED by design (founder-as-attribute lives elsewhere):
--   • people.is_current_founder / is_former_founder — computed from a TITLE regex
--     + seniority_normalized='founder' in compute-derived.ts, NOT from function.
--   • The former_founder scoring bonus — reads people.is_former_founder.
--   • seniority_normalized='founder' / seniority_rules — the seniority axis keeps
--     founder as a level (rank 8); untouched.
--   • The default-search founder exclusion (is_current_founder) — untouched.
--   • person_experiences.specialty_normalized values naming the 4 deactivated
--     founder specialties (ceo, co_founder, …) stay as-is: legacy column, no
--     runtime reader post-flip; the classifier repopulates the real axes.
--
-- ORDER: after 094 (both after 085–093). Dev-first per workflow; prod apply is
-- part of the gated merge arc.
--
-- ADDITIVE / NON-ADDITIVE: NON-ADDITIVE (UPDATEs on title_dictionary,
-- person_experiences, people). Reversible via the pre-arc snapshot (runbook).

BEGIN;

-- ─── Pre-flight diagnostics ─────────────────────────────────────────────

DO $$
DECLARE
  td_rows  INT;
  exp_rows INT;
  ppl_rows INT;
BEGIN
  SELECT count(*) INTO td_rows  FROM title_dictionary   WHERE function_normalized = 'founder';
  SELECT count(*) INTO exp_rows FROM person_experiences WHERE function_normalized = 'founder';
  SELECT count(*) INTO ppl_rows FROM people             WHERE current_function_normalized = 'founder';
  RAISE NOTICE 'Migration 095 pre-flight: % title_dictionary rows, % person_experiences rows, % people rows at function=founder.',
    td_rows, exp_rows, ppl_rows;
END $$;

-- ─── Step 1: title_dictionary — stop the ingest path re-creating founder ─
-- (The 8 founder title rows carry specialty_normalized=NULL — verified — so no
-- specialty cleanup is needed here.)

UPDATE title_dictionary
SET function_normalized = 'unknown'
WHERE function_normalized = 'founder';

-- ─── Step 2: person_experiences — founder → unknown ─────────────────────

UPDATE person_experiences
SET function_normalized = 'unknown'
WHERE function_normalized = 'founder';

-- ─── Step 3: people.current_function_normalized ─────────────────────────
-- Recompute from the primary-current experience (same priority order as
-- app/api/ingest — mirrors 073 step 4), restricted to people still at founder.

UPDATE people p
SET current_function_normalized = derived.fn
FROM (
  SELECT DISTINCT ON (pe.person_id)
    pe.person_id,
    pe.function_normalized AS fn
  FROM person_experiences pe
  WHERE pe.is_current = TRUE
  ORDER BY pe.person_id,
    pe.is_primary_current DESC NULLS LAST,
    (CASE WHEN pe.title_raw ~* '\b(intern|internship|co-?op|student)\b' THEN 1 ELSE 0 END) ASC,
    (CASE WHEN pe.title_raw IS NULL THEN 1 ELSE 0 END) ASC,
    pe.start_date DESC NULLS LAST
) derived
WHERE derived.person_id = p.person_id
  AND p.current_function_normalized = 'founder';

-- Sweep: anyone still at founder (no current experience to derive from) → unknown.
UPDATE people
SET current_function_normalized = 'unknown'
WHERE current_function_normalized = 'founder';

-- ─── Verification (empty-DB tolerant: zero counts pass trivially) ───────

DO $$
DECLARE
  remaining_founder INT;
  invalid_fn_count  INT;
BEGIN
  SELECT (SELECT count(*) FROM title_dictionary   WHERE function_normalized = 'founder')
       + (SELECT count(*) FROM person_experiences WHERE function_normalized = 'founder')
       + (SELECT count(*) FROM people             WHERE current_function_normalized = 'founder')
    INTO remaining_founder;
  IF remaining_founder <> 0 THEN
    RAISE EXCEPTION 'Migration 095: % rows still reference function=founder.', remaining_founder;
  END IF;

  -- Every non-NULL function must still reference a real function_dictionary row
  -- (mirrors 073's structural invariant).
  SELECT count(*) INTO invalid_fn_count
    FROM person_experiences pe
    LEFT JOIN function_dictionary f ON f.function_normalized = pe.function_normalized
    WHERE pe.function_normalized IS NOT NULL
      AND f.function_normalized IS NULL;
  IF invalid_fn_count <> 0 THEN
    RAISE EXCEPTION 'Migration 095: % person_experiences rows have function_normalized not in function_dictionary.', invalid_fn_count;
  END IF;

  RAISE NOTICE 'Migration 095 complete: founder function fully cascaded to unknown across title_dictionary, person_experiences, people.';
END $$;

COMMIT;
