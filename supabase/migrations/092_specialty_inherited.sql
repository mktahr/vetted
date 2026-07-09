-- 092_specialty_inherited.sql
--
-- Deterministic career-fallback layer (Matt's architecture call, 2026-07-07;
-- Claude+Codex joint review): the LLM classifies ONLY what each role's own
-- evidence supports; a DETERMINISTIC post-processing step (computeCareerFallback,
-- lib/classification/career-fallback.ts) inherits the dominant career specialty
-- onto sparse roles in CODE — same input, same output, fires every time.
--
-- DATA MODEL (per the joint review): separate columns, NOT per-value source flags.
--   • specialty_inferred stays EVIDENCED-ONLY — exactly what the LLM returned
--     (pristine audit trail; provenance is structural).
--   • specialty_inherited (NEW) = code-computed inheritance. Search reads the
--     union; UI styles inherited values as muted/outlined pills.
--   • specialty_inherited_preview (NEW) = the preview twin, written only by the
--     preview populate script (same isolation contract as 089 — never lifecycle).
--
-- ATOMICITY (per Codex): inherited values ride inside p_assignments and are
-- written by commit_classification in the SAME transaction as the evidenced axes —
-- no post-commit derive step that could leave status='done' rows half-populated.
-- The RPC change is backward compatible: an assignment without the key writes NULL.
--
-- Additive / inert on prod (classifier queue not yet running there).
-- (Applied dev + prod.)

BEGIN;

ALTER TABLE person_experiences
  ADD COLUMN IF NOT EXISTS specialty_inherited          TEXT[],
  ADD COLUMN IF NOT EXISTS specialty_inherited_preview  TEXT[];

COMMENT ON COLUMN person_experiences.specialty_inherited IS
  'Career-fallback specialties computed DETERMINISTICALLY in code (computeCareerFallback) — never LLM output. specialty_inferred stays evidenced-only; search reads the union; UI renders these as lower-confidence (inherited) pills.';
COMMENT ON COLUMN person_experiences.specialty_inherited_preview IS
  'Preview twin of specialty_inherited — written only by the preview populate script (same isolation contract as the 089 preview columns; never lifecycle, never the real columns).';

-- Extend the fenced commit to write specialty_inherited atomically with the
-- evidenced axes. Everything else is byte-identical to the 083 definition.
--
-- p_assignments: [{ exp_id, function_inferred[], specialty_inferred[], skills_inferred[],
--                   title_normalized_inferred, specialty_inherited[] (optional) }]
CREATE OR REPLACE FUNCTION commit_classification(
  p_person_id          UUID,
  p_lease_token        UUID,
  p_run_id             UUID,
  p_classifier_version TEXT,
  p_assignments        JSONB
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_status      TEXT;
  v_token       UUID;
  v_expires     TIMESTAMPTZ;
  v_generation  INT;
  v_run_status  TEXT;
  v_run_person  UUID;
  v_run_token   UUID;
  v_run_gen     INT;
  v_current_ids UUID[];
  v_submitted   UUID[];
  v_submitted_distinct INT;
  v_assignment  JSONB;
  v_rows        INT;
BEGIN
  IF jsonb_typeof(p_assignments) <> 'array' THEN
    RETURN 'discarded:bad_assignments';
  END IF;

  -- Fence on the person row.
  SELECT classification_status, classification_lease_token, classification_lease_expires_at, classification_generation
    INTO v_status, v_token, v_expires, v_generation
    FROM people WHERE person_id = p_person_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'discarded:person_gone'; END IF;
  IF v_status <> 'in_progress'
     OR v_token IS DISTINCT FROM p_lease_token
     OR v_expires IS NULL OR v_expires <= NOW() THEN
    RETURN 'discarded:lease_lost';
  END IF;

  -- Validate the run: exists, belongs to this person, still claimed, same token.
  SELECT status, person_id, lease_token, claimed_generation
    INTO v_run_status, v_run_person, v_run_token, v_run_gen
    FROM candidate_classification_runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND
     OR v_run_person IS DISTINCT FROM p_person_id
     OR v_run_status <> 'claimed'
     OR v_run_token IS DISTINCT FROM p_lease_token THEN
    RETURN 'discarded:run_invalid';
  END IF;

  -- Generation fence: the experiences must not have been rewritten since the claim.
  IF v_run_gen IS DISTINCT FROM v_generation THEN
    RETURN 'discarded:generation_changed';
  END IF;

  -- Assignment set MUST equal the current experience set: same count, same members,
  -- no duplicates (count + uniqueness + membership). Blocks empty/subset/dup publish.
  SELECT array_agg(person_experience_id ORDER BY person_experience_id)
    INTO v_current_ids FROM person_experiences WHERE person_id = p_person_id;
  v_current_ids := COALESCE(v_current_ids, ARRAY[]::UUID[]);

  SELECT array_agg(x ORDER BY x), count(DISTINCT x)
    INTO v_submitted, v_submitted_distinct
    FROM (SELECT (a->>'exp_id')::UUID AS x FROM jsonb_array_elements(p_assignments) a) s;
  v_submitted := COALESCE(v_submitted, ARRAY[]::UUID[]);

  IF jsonb_array_length(p_assignments) <> v_submitted_distinct THEN
    RETURN 'discarded:duplicate_assignments';
  END IF;
  IF v_submitted IS DISTINCT FROM v_current_ids THEN
    RETURN 'discarded:experience_set_mismatch';
  END IF;

  -- Publish each inferred row (each must hit exactly 1 row).
  FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
  LOOP
    UPDATE person_experiences
       SET function_inferred = CASE
             WHEN jsonb_typeof(v_assignment->'function_inferred') = 'array'
             THEN ARRAY(SELECT jsonb_array_elements_text(v_assignment->'function_inferred')) ELSE NULL END,
           specialty_inferred = CASE
             WHEN jsonb_typeof(v_assignment->'specialty_inferred') = 'array'
             THEN ARRAY(SELECT jsonb_array_elements_text(v_assignment->'specialty_inferred')) ELSE NULL END,
           skills_inferred = CASE
             WHEN jsonb_typeof(v_assignment->'skills_inferred') = 'array'
             THEN ARRAY(SELECT jsonb_array_elements_text(v_assignment->'skills_inferred')) ELSE NULL END,
           title_normalized_inferred = NULLIF(v_assignment->>'title_normalized_inferred', ''),
           specialty_inherited = CASE
             WHEN jsonb_typeof(v_assignment->'specialty_inherited') = 'array'
             THEN ARRAY(SELECT jsonb_array_elements_text(v_assignment->'specialty_inherited')) ELSE NULL END,
           updated_at = NOW()
     WHERE person_experience_id = (v_assignment->>'exp_id')::UUID
       AND person_id = p_person_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'classification_commit_exp_missing: %', v_assignment->>'exp_id';
    END IF;
  END LOOP;

  UPDATE people
     SET classification_status        = 'done',
         classifier_version           = p_classifier_version,
         classified_at                = NOW(),
         classification_lease_token   = NULL,
         classification_lease_expires_at = NULL,
         updated_at                   = NOW()
   WHERE person_id = p_person_id;

  UPDATE candidate_classification_runs
     SET status = 'succeeded', completed_at = NOW()
   WHERE run_id = p_run_id;

  RETURN 'committed';
END;
$$;

COMMENT ON FUNCTION commit_classification IS
  'Fenced atomic publish of a classify-pending result. Validates person lease + run (claimed/owner/token) + generation fence under a person-row lock, requires assignment exp-id set == current experience set (count+membership+uniqueness), writes inferred axes + code-computed specialty_inherited (each exactly 1 row else RAISE→rollback), marks done, closes the run. Returns committed | discarded:<reason>. Caller runs the discard path on any non-committed return / exception.';

-- Verification: columns exist.
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_name = 'person_experiences'
         AND column_name IN ('specialty_inherited','specialty_inherited_preview')) <> 2 THEN
    RAISE EXCEPTION '092 verification failed: inherited columns missing';
  END IF;
END $$;

COMMIT;
