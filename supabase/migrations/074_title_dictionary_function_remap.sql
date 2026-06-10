-- 074_title_dictionary_function_remap.sql
--
-- Sub-PR 2b of the five-axis candidate taxonomy rebuild
-- (ROADMAP item #2, fourth migration of the sub-PR after 071/072/073).
--
-- Updates title_dictionary.function_normalized for the 38 rows currently
-- at function='engineering' (legacy umbrella). Two cohorts:
--
--   COHORT A — 21 rows with a specialty set. UPDATE via JOIN to
--     specialty_dictionary, picking the new single-parent function.
--     Multi-parent specialties stay at function='engineering' (rare in
--     title_dictionary because titles usually disambiguate enough to
--     single-parent).
--
--   COHORT B — 17 NULL-specialty rows. Hand-classified per locked
--     decisions:
--
--     7 LEADERSHIP TITLES → 'engineering' (legacy inactive umbrella):
--       chief technology officer, cto, director of engineering, em,
--       engineering manager, vp engineering, vp of engineering
--
--       Reason: defaulting CTOs / VPs / Directors / EMs to a specific
--       sub-function destroys information. Vetted's V1 wedge is hard
--       tech — customers hire engineering leadership at hardware,
--       aerospace, robotics, defense companies where "most common
--       background" doesn't hold. Sub-PR 3 LLM inference reclassifies
--       per-candidate based on actual work history. Leaving at the
--       inactive umbrella means these candidates' current_function
--       falls out of UI filters until rescore — acceptable temporary
--       state per option (b).
--
--     10 EXPLICIT IC TITLES → 'software_engineering':
--       mobile engineer, principal engineer, principal software engineer,
--       senior engineer, senior software engineer, software engineer intern,
--       software engineering intern, staff engineer, staff software engineer,
--       swe
--
--       Reason: explicit engineer titles without leadership-default-bias.
--       Mobile/swe/software variants are unambiguous; principal/senior/
--       staff engineer titles are generic ICs that overwhelmingly resolve
--       to SWE in practice. Sub-PR 3 LLM inference refines per-candidate.
--
-- WORKFLOW (per dev/prod split established in commit 26a02bc):
--   1. npm run migrate:dev  -- supabase/migrations/074_*.sql
--   2. Verify on dev
--   3. (Wait for all of 071/072/073/074 dev-verified)
--   4. Promote 071/072/073/074 to prod TOGETHER in order.
--
-- ADDITIVE / NON-ADDITIVE: NON-ADDITIVE (UPDATEs only). Reversible by
-- reverting function_normalized values. Dictionary data, not candidate
-- data — safe to revise in follow-up if needed.

BEGIN;

-- ─── Pre-flight diagnostics ─────────────────────────────────────────────

DO $$
DECLARE
  total_eng_rows         INT;
  cohort_a_target        INT;
  cohort_a_multi_parent  INT;
  cohort_b_leadership    INT;
  cohort_b_ic            INT;
BEGIN
  SELECT count(*) INTO total_eng_rows
    FROM title_dictionary WHERE function_normalized = 'engineering';

  SELECT count(*) INTO cohort_a_target
    FROM title_dictionary t
    JOIN specialty_dictionary s ON s.specialty_normalized = t.specialty_normalized
    WHERE t.function_normalized = 'engineering'
      AND s.active = TRUE
      AND array_length(s.parent_function, 1) = 1;

  SELECT count(*) INTO cohort_a_multi_parent
    FROM title_dictionary t
    JOIN specialty_dictionary s ON s.specialty_normalized = t.specialty_normalized
    WHERE t.function_normalized = 'engineering'
      AND array_length(s.parent_function, 1) >= 2;

  SELECT count(*) INTO cohort_b_leadership
    FROM title_dictionary
    WHERE function_normalized = 'engineering'
      AND specialty_normalized IS NULL
      AND title_pattern IN (
        'chief technology officer','cto','director of engineering','em',
        'engineering manager','vp engineering','vp of engineering'
      );

  SELECT count(*) INTO cohort_b_ic
    FROM title_dictionary
    WHERE function_normalized = 'engineering'
      AND specialty_normalized IS NULL
      AND title_pattern IN (
        'mobile engineer','principal engineer','principal software engineer',
        'senior engineer','senior software engineer','software engineer intern',
        'software engineering intern','staff engineer','staff software engineer',
        'swe'
      );

  RAISE NOTICE 'Migration 074 pre-flight:';
  RAISE NOTICE '  title_dictionary rows at function=engineering: %', total_eng_rows;
  RAISE NOTICE '    Cohort A (single-parent active specialty): % (reclassified via JOIN)', cohort_a_target;
  RAISE NOTICE '    Cohort A (multi-parent — stay at engineering): %', cohort_a_multi_parent;
  RAISE NOTICE '    Cohort B leadership titles → engineering (inactive): %', cohort_b_leadership;
  RAISE NOTICE '    Cohort B explicit IC titles → software_engineering: %', cohort_b_ic;
END $$;

-- ─── Step 1: Cohort A — specialty-driven reclassification (21 rows) ─────
-- For title_dictionary rows with a specialty pointing at a single-parent
-- active specialty in the new taxonomy, take the new function from
-- specialty_dictionary.parent_function[1].

UPDATE title_dictionary t
SET function_normalized = s.parent_function[1]
FROM specialty_dictionary s
WHERE s.specialty_normalized = t.specialty_normalized
  AND t.function_normalized = 'engineering'
  AND s.active = TRUE
  AND array_length(s.parent_function, 1) = 1;

-- ─── Step 2: Cohort B leadership — keep at 'engineering' (inactive) ─────
-- Explicit no-op: these 7 rows already have function='engineering'.
-- Documented here so it's clear they were intentionally left at the
-- inactive umbrella. Sub-PR 3 LLM inference reclassifies per-candidate.
-- (No UPDATE needed — values are already correct. But we include a
-- defensive assertion below in the verification block.)

-- ─── Step 3: Cohort B explicit IC titles → software_engineering ─────────

UPDATE title_dictionary
SET function_normalized = 'software_engineering'
WHERE function_normalized = 'engineering'
  AND specialty_normalized IS NULL
  AND title_pattern IN (
    'mobile engineer',
    'principal engineer',
    'principal software engineer',
    'senior engineer',
    'senior software engineer',
    'software engineer intern',
    'software engineering intern',
    'staff engineer',
    'staff software engineer',
    'swe'
  );

-- ─── Step 4: Defensive catchall — any remaining row pointing at an
--             active specialty must adopt that parent (for any prod/dev
--             rows my hand-classification missed). No-op on dev/prod
--             today per the diagnostics above.
UPDATE title_dictionary t
SET function_normalized = s.parent_function[1]
FROM specialty_dictionary s
WHERE s.specialty_normalized = t.specialty_normalized
  AND t.function_normalized = 'engineering'
  AND s.active = TRUE
  AND array_length(s.parent_function, 1) = 1;

-- ─── Step 5: Orphan specialty cleanup ───────────────────────────────────
-- The 5 specialties deleted in migration 072 (chief_engineer,
-- distinguished_engineer, engineering_management, principal_engineer,
-- data_engineering) may still be referenced by title_dictionary.specialty_normalized.
-- Verified on prod + dev (2026-06-XX): only 1 such orphan exists —
-- title 'data engineer' → specialty='data_engineering'. Same mirror
-- pattern as 073 step 3: lift the data engineering signal from specialty
-- axis to function axis, NULL the orphaned specialty reference.
--
-- The 4 title-like orphans (chief_engineer / distinguished_engineer /
-- engineering_management / principal_engineer) have no title_dictionary
-- references today but are included defensively for any future drift.

UPDATE title_dictionary
SET specialty_normalized = NULL,
    function_normalized   = 'data_engineering'
WHERE specialty_normalized = 'data_engineering';

UPDATE title_dictionary
SET specialty_normalized = NULL
WHERE specialty_normalized IN (
  'chief_engineer','distinguished_engineer','engineering_management','principal_engineer'
);

-- ─── Verification ──────────────────────────────────────────────────────

DO $$
DECLARE
  remaining_eng_with_active_specialty INT;
  leadership_still_eng                INT;
  ic_still_eng                        INT;
  invalid_fn_count                    INT;
  cohort_a_reclassified               INT;
  orphan_specialty_remaining          INT;
BEGIN
  -- No title row should have function='engineering' AND a single-parent
  -- active specialty (means step 1 missed something).
  SELECT count(*) INTO remaining_eng_with_active_specialty
    FROM title_dictionary t
    JOIN specialty_dictionary s ON s.specialty_normalized = t.specialty_normalized
    WHERE t.function_normalized = 'engineering'
      AND s.active = TRUE
      AND array_length(s.parent_function, 1) = 1;
  IF remaining_eng_with_active_specialty <> 0 THEN
    RAISE EXCEPTION 'Migration 074: % title rows still function=engineering with single-parent active specialty.', remaining_eng_with_active_specialty;
  END IF;

  -- Leadership titles should still be at 'engineering' (intentional).
  -- Asserted only if the title pattern exists in this environment.
  SELECT count(*) INTO leadership_still_eng
    FROM title_dictionary
    WHERE function_normalized = 'engineering'
      AND specialty_normalized IS NULL
      AND title_pattern IN (
        'chief technology officer','cto','director of engineering','em',
        'engineering manager','vp engineering','vp of engineering'
      );

  -- IC titles must have moved to software_engineering (no row should
  -- still be at 'engineering' for the 10 IC patterns).
  SELECT count(*) INTO ic_still_eng
    FROM title_dictionary
    WHERE function_normalized = 'engineering'
      AND title_pattern IN (
        'mobile engineer','principal engineer','principal software engineer',
        'senior engineer','senior software engineer','software engineer intern',
        'software engineering intern','staff engineer','staff software engineer',
        'swe'
      );
  IF ic_still_eng <> 0 THEN
    RAISE EXCEPTION 'Migration 074: % explicit IC title rows still at function=engineering.', ic_still_eng;
  END IF;

  -- Every function_normalized must reference a real function row.
  SELECT count(*) INTO invalid_fn_count
    FROM title_dictionary t
    LEFT JOIN function_dictionary f ON f.function_normalized = t.function_normalized
    WHERE t.function_normalized IS NOT NULL
      AND f.function_normalized IS NULL;
  IF invalid_fn_count <> 0 THEN
    RAISE EXCEPTION 'Migration 074: % title_dictionary rows have function_normalized not in function_dictionary.', invalid_fn_count;
  END IF;

  -- No title_dictionary row may reference any of the 5 deleted specialties.
  SELECT count(*) INTO orphan_specialty_remaining
    FROM title_dictionary
    WHERE specialty_normalized IN (
      'chief_engineer','distinguished_engineer','engineering_management',
      'principal_engineer','data_engineering'
    );
  IF orphan_specialty_remaining <> 0 THEN
    RAISE EXCEPTION 'Migration 074: % title rows still reference deleted specialty values.', orphan_specialty_remaining;
  END IF;

  -- Diagnostic
  SELECT count(*) INTO cohort_a_reclassified
    FROM title_dictionary
    WHERE function_normalized NOT IN ('engineering', 'unknown')
      AND function_normalized IS NOT NULL
      AND specialty_normalized IS NOT NULL;

  RAISE NOTICE 'Migration 074: leadership_still_eng=% (expect 7 on prod/dev), cohort_a_reclassified=%.',
    leadership_still_eng, cohort_a_reclassified;
END $$;

COMMIT;
