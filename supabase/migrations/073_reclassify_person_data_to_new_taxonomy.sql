-- 073_reclassify_person_data_to_new_taxonomy.sql
--
-- Sub-PR 2b of the five-axis candidate taxonomy rebuild
-- (ROADMAP item #2, third migration of the sub-PR after 071/072).
--
-- Updates the actual candidate data (person_experiences, people) to
-- reflect the new 16-function taxonomy from migration 071 and the
-- multi-parent specialty_dictionary from 072. Pure data migration; no
-- schema changes.
--
-- DESIGN DECISIONS (locked 2026-06-XX, see CHANGELOG):
--
--   • Single-parent active specialties → reclassify the experience's
--     function_normalized to that single parent.
--   • Multi-parent active specialties → LEAVE experience.function_normalized
--     at 'engineering' (legacy umbrella, now inactive). Sub-PR 3 LLM
--     ingest inference reclassifies per-candidate based on actual title,
--     description, and skills. Deterministic pick in this migration would
--     discard the per-candidate context the multi-parent array preserves.
--     Option (b) per user lock.
--   • Inactive specialties (V1 scope cut) → leave function_normalized
--     unchanged. Sub-PR 3 handles.
--   • NULL specialties → leave function_normalized unchanged. Sub-PR 3
--     handles.
--   • Orphaned references to the 5 specialties deleted in 072 →
--     - 4 title-like (chief_engineer, distinguished_engineer,
--       engineering_management, principal_engineer): set specialty=NULL.
--       Leadership signal is captured by title + seniority axes
--       (migration 067 split executive into director/vp/c_suite).
--     - 1 data_engineering: set specialty=NULL AND
--       function_normalized='data_engineering' (lift the signal from
--       the now-defunct specialty axis to the new function axis where
--       it belongs in the five-axis taxonomy).
--   • people.current_function_normalized → recomputed from primary
--     current experience after the experience-level update, using the
--     same priority order as app/api/ingest/route.ts ("derive current
--     role" step: is_primary_current → first non-student-titled → first
--     with title → first row by start_date desc).
--
-- WORKFLOW (per dev/prod split established in commit 26a02bc):
--   1. npm run migrate:dev  -- supabase/migrations/073_*.sql
--   2. Verify on dev
--   3. (Wait for 074 also dev-verified)
--   4. Promote 071/072/073/074 to prod TOGETHER in order, after all
--      dev verifications reviewed.
--
-- ADDITIVE / NON-ADDITIVE: NON-ADDITIVE. Mass UPDATEs across the
-- person_experiences + people tables. Candidate data is test material
-- until launch (per Rule 6 + candidate-data-test-material memory) so
-- no preservation logic needed. Sub-PR 3 LLM inference will re-derive
-- the same values from raw_ingest_events post-launch.

BEGIN;

-- ─── Pre-flight diagnostics ─────────────────────────────────────────────

DO $$
DECLARE
  total_eng_rows         INT;
  single_parent_active   INT;
  multi_parent_rows      INT;
  inactive_spec_rows     INT;
  null_spec_rows         INT;
  orphan_title_like      INT;
  orphan_data_eng        INT;
  people_with_current_fn INT;
BEGIN
  SELECT count(*) INTO total_eng_rows
    FROM person_experiences WHERE function_normalized = 'engineering';

  SELECT count(*) INTO single_parent_active
    FROM person_experiences pe
    JOIN specialty_dictionary s ON s.specialty_normalized = pe.specialty_normalized
    WHERE pe.function_normalized = 'engineering'
      AND s.active = TRUE
      AND array_length(s.parent_function, 1) = 1;

  SELECT count(*) INTO multi_parent_rows
    FROM person_experiences pe
    JOIN specialty_dictionary s ON s.specialty_normalized = pe.specialty_normalized
    WHERE pe.function_normalized = 'engineering'
      AND array_length(s.parent_function, 1) >= 2;

  SELECT count(*) INTO inactive_spec_rows
    FROM person_experiences pe
    JOIN specialty_dictionary s ON s.specialty_normalized = pe.specialty_normalized
    WHERE pe.function_normalized = 'engineering'
      AND s.active = FALSE;

  SELECT count(*) INTO null_spec_rows
    FROM person_experiences
    WHERE function_normalized = 'engineering' AND specialty_normalized IS NULL;

  SELECT count(*) INTO orphan_title_like
    FROM person_experiences
    WHERE specialty_normalized IN (
      'chief_engineer','distinguished_engineer','engineering_management','principal_engineer'
    );

  SELECT count(*) INTO orphan_data_eng
    FROM person_experiences
    WHERE specialty_normalized = 'data_engineering';

  SELECT count(*) INTO people_with_current_fn
    FROM people WHERE current_function_normalized IS NOT NULL;

  RAISE NOTICE 'Migration 073 pre-flight:';
  RAISE NOTICE '  person_experiences with function=engineering: %', total_eng_rows;
  RAISE NOTICE '    of which single-parent active specialty: % (will be reclassified)', single_parent_active;
  RAISE NOTICE '    of which multi-parent specialty: % (left at engineering per option b)', multi_parent_rows;
  RAISE NOTICE '    of which inactive specialty: % (left as-is for sub-PR 3 LLM)', inactive_spec_rows;
  RAISE NOTICE '    of which NULL specialty: % (left as-is for sub-PR 3 LLM)', null_spec_rows;
  RAISE NOTICE '  orphan refs — 4 title-like specialties: % (will be NULLed)', orphan_title_like;
  RAISE NOTICE '  orphan refs — data_engineering specialty: % (NULL specialty + function=data_engineering)', orphan_data_eng;
  RAISE NOTICE '  people with non-NULL current_function_normalized: % (recomputed in step 4)', people_with_current_fn;
END $$;

-- ─── Step 1: Reclassify person_experiences (single-parent active) ───────
-- Read the new parent from specialty_dictionary.parent_function[1] and
-- assign as the new function. Only touches rows that:
--   - currently have function_normalized = 'engineering'
--   - have a specialty pointing at a single-parent active specialty row

UPDATE person_experiences pe
SET function_normalized = s.parent_function[1]
FROM specialty_dictionary s
WHERE s.specialty_normalized = pe.specialty_normalized
  AND pe.function_normalized = 'engineering'
  AND s.active = TRUE
  AND array_length(s.parent_function, 1) = 1;

-- ─── Step 2: Clean orphan refs to 4 title-like deleted specialties ──────
-- These specialty values no longer exist in specialty_dictionary (deleted
-- in 072). Their leadership signal is now captured by the title + seniority
-- axes — see migration 067 (executive → director/vp/c_suite split).

UPDATE person_experiences
SET specialty_normalized = NULL
WHERE specialty_normalized IN (
  'chief_engineer','distinguished_engineer','engineering_management','principal_engineer'
);

-- ─── Step 3: Clean orphan refs to data_engineering specialty ────────────
-- The data_engineering specialty was dropped in 072 because the function
-- of the same name (added in 071) takes its place. Lift the signal from
-- specialty axis to function axis. Set function=data_engineering UNLESS
-- the experience already has a more specific function set.

UPDATE person_experiences
SET specialty_normalized = NULL,
    function_normalized   = COALESCE(
      -- preserve a more specific function if one was already set
      NULLIF(function_normalized, 'engineering'),
      'data_engineering'
    )
WHERE specialty_normalized = 'data_engineering';

-- ─── Step 4: Recompute people.current_function_normalized ───────────────
-- Read from the primary current experience using the same priority order
-- as app/api/ingest/route.ts (the "derive current role" step):
--   1. is_primary_current = TRUE
--   2. non-student-titled role
--   3. has a title
--   4. most recent start_date
-- Implemented via DISTINCT ON with a deterministic ORDER BY.

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
  AND p.current_function_normalized IS DISTINCT FROM derived.fn;

-- ─── Verification ──────────────────────────────────────────────────────

DO $$
DECLARE
  bad_eng_with_single_active  INT;
  invalid_fn_count            INT;
  orphan_specialty_remaining  INT;
  data_eng_remaining          INT;
BEGIN
  -- After step 1, no person_experiences row should still have
  -- function='engineering' with a single-parent active specialty.
  SELECT count(*) INTO bad_eng_with_single_active
    FROM person_experiences pe
    JOIN specialty_dictionary s ON s.specialty_normalized = pe.specialty_normalized
    WHERE pe.function_normalized = 'engineering'
      AND s.active = TRUE
      AND array_length(s.parent_function, 1) = 1;
  IF bad_eng_with_single_active <> 0 THEN
    RAISE EXCEPTION 'Migration 073: % rows still function=engineering with single-parent active specialty.', bad_eng_with_single_active;
  END IF;

  -- Every non-NULL function_normalized must reference a real function row.
  SELECT count(*) INTO invalid_fn_count
    FROM person_experiences pe
    LEFT JOIN function_dictionary f ON f.function_normalized = pe.function_normalized
    WHERE pe.function_normalized IS NOT NULL
      AND f.function_normalized IS NULL;
  IF invalid_fn_count <> 0 THEN
    RAISE EXCEPTION 'Migration 073: % person_experiences rows have function_normalized not in function_dictionary.', invalid_fn_count;
  END IF;

  -- After steps 2 + 3, no person_experiences row should reference any of
  -- the 5 deleted specialty values.
  SELECT count(*) INTO orphan_specialty_remaining
    FROM person_experiences
    WHERE specialty_normalized IN (
      'chief_engineer','distinguished_engineer','engineering_management',
      'principal_engineer','data_engineering'
    );
  IF orphan_specialty_remaining <> 0 THEN
    RAISE EXCEPTION 'Migration 073: % person_experiences rows still reference deleted specialty values.', orphan_specialty_remaining;
  END IF;

  -- Diagnostic counters for the dev/prod verification report
  SELECT count(*) INTO data_eng_remaining
    FROM person_experiences WHERE function_normalized = 'data_engineering';

  RAISE NOTICE 'Migration 073: reclassification complete. % person_experiences rows now at function=data_engineering.', data_eng_remaining;
END $$;

COMMIT;
