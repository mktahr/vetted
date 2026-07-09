-- 083_five_axis_classification.sql
--
-- FIVE-AXIS TAXONOMY — sub-PR 3: LLM ingest inference (classify-pending).
--
-- Decoupled, spend-capped classifier: one Haiku call per candidate reads the full
-- work history/skills/descriptions and writes per-experience five-axis tuples,
-- WITHOUT touching the inline ingest/scoring path. Inferred columns are inert until
-- sub-PR 6 wires them into scoring.
--
-- DESIGN (converged across 5 Codex rounds + a 3rd-party review):
--  * Inferred axes stored SEPARATELY from the deterministic columns (those exist +
--    are title-dictionary-set). function/specialty inferred = ordered arrays
--    (position 0 = primary); skills = set; title_normalized_inferred (NOT
--    title_normalized, which exists since 001). Weights deferred.
--  * GENERATION FENCE (not a content hash): people.classification_generation is a
--    monotonic int bumped by ingest on every experience rewrite. Claim captures it
--    onto the run; commit requires it unchanged under a person-row lock. Replaces
--    the content hash for BOTH fencing and staleness (status='pending' drives
--    eligibility). No hash column.
--  * CLAIM stays app-layer (DB-claim deferred — BACKLOG). COMMIT is FENCED here
--    (commit races corrupt data; claim races only waste a call).
--  * candidate_classification_runs = durable provenance. spend_log = per-day cap via
--    the atomic reserve_classification_spend() function.
--
-- Additive. Dev-first. (084 disables RLS on the two new tables.)

BEGIN;

-- ── Inferred per-experience axes (separate from deterministic) ────────────────
ALTER TABLE person_experiences
  ADD COLUMN IF NOT EXISTS function_inferred         TEXT[],
  ADD COLUMN IF NOT EXISTS specialty_inferred        TEXT[],
  ADD COLUMN IF NOT EXISTS skills_inferred           TEXT[],
  ADD COLUMN IF NOT EXISTS title_normalized_inferred TEXT;

-- Position semantics (0 = primary) require no NULL elements.
ALTER TABLE person_experiences
  ADD CONSTRAINT pe_function_inferred_no_null_elems
    CHECK (function_inferred IS NULL OR array_position(function_inferred, NULL) IS NULL),
  ADD CONSTRAINT pe_specialty_inferred_no_null_elems
    CHECK (specialty_inferred IS NULL OR array_position(specialty_inferred, NULL) IS NULL),
  ADD CONSTRAINT pe_skills_inferred_no_null_elems
    CHECK (skills_inferred IS NULL OR array_position(skills_inferred, NULL) IS NULL);

-- ── Candidate-level job-control + latest-success state ────────────────────────
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS classification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (classification_status IN ('pending', 'in_progress', 'done', 'failed')),
  -- Monotonic; ingest bumps on every experience rewrite. The fence + staleness key.
  ADD COLUMN IF NOT EXISTS classification_generation       INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS classifier_version              TEXT,
  ADD COLUMN IF NOT EXISTS classified_at                   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS classification_lease_token      UUID,
  ADD COLUMN IF NOT EXISTS classification_lease_expires_at TIMESTAMPTZ,
  -- Failures only — claims/discards/reclaims never increment. Gates failed-retry.
  ADD COLUMN IF NOT EXISTS classification_failure_count    INT NOT NULL DEFAULT 0;

ALTER TABLE people
  ADD CONSTRAINT people_classification_failure_count_nonneg
    CHECK (classification_failure_count >= 0),
  ADD CONSTRAINT people_classification_generation_nonneg
    CHECK (classification_generation >= 0),
  -- State-shape: a lease exists IFF in_progress.
  ADD CONSTRAINT people_classification_lease_shape CHECK (
    (classification_status = 'in_progress'
       AND classification_lease_token IS NOT NULL
       AND classification_lease_expires_at IS NOT NULL)
    OR
    (classification_status <> 'in_progress'
       AND classification_lease_token IS NULL
       AND classification_lease_expires_at IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_people_classification_queue
  ON people (classification_status, classification_lease_expires_at)
  WHERE classification_status IN ('pending', 'in_progress', 'failed');

-- ── Durable per-attempt history / provenance ──────────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_classification_runs (
  run_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id          UUID NOT NULL REFERENCES people(person_id) ON DELETE CASCADE,
  lease_token        UUID,                 -- the claim token this run owns
  claimed_generation INT,                  -- people.classification_generation at claim
  model              TEXT,
  prompt_version     TEXT,
  dictionary_version TEXT,
  status             TEXT NOT NULL CHECK (status IN ('claimed', 'succeeded', 'failed', 'discarded')),
  tokens             INT     CHECK (tokens IS NULL OR tokens >= 0),
  cost_cents         NUMERIC CHECK (cost_cents IS NULL OR cost_cents >= 0),
  reasoning          JSONB,
  error              TEXT,
  claimed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ,
  -- A terminal run has completed_at; a 'claimed' run does not.
  CHECK (
    (status = 'claimed'  AND completed_at IS NULL)
    OR (status <> 'claimed' AND completed_at IS NOT NULL AND completed_at >= claimed_at)
  )
);
CREATE INDEX IF NOT EXISTS idx_classification_runs_person
  ON candidate_classification_runs (person_id, claimed_at DESC);
-- At most one active (claimed) run per person.
CREATE UNIQUE INDEX IF NOT EXISTS uq_classification_runs_one_active
  ON candidate_classification_runs (person_id) WHERE status = 'claimed';

-- ── Per-day spend rollup ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_classification_spend_log (
  log_date                    DATE PRIMARY KEY,
  total_candidates_classified INT NOT NULL DEFAULT 0 CHECK (total_candidates_classified >= 0),
  estimated_anthropic_cents   INT NOT NULL DEFAULT 0 CHECK (estimated_anthropic_cents >= 0)
);

-- Atomic reserve: create-or-increment the day's row only if it stays within cap.
-- Both branches cap-checked (insert-branch via the SELECT guard, conflict-branch via
-- the DO UPDATE WHERE). Returns TRUE iff the spend was reserved. Reserve BEFORE the
-- API call: a retry conservatively double-reserves (throttles early) but never
-- exceeds the cap. (run_id idempotency / reserved-vs-actual reconcile deferred.)
CREATE OR REPLACE FUNCTION reserve_classification_spend(p_cents INT, p_cap INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE v_ok BOOLEAN;
BEGIN
  INSERT INTO candidate_classification_spend_log (log_date, estimated_anthropic_cents, total_candidates_classified)
  SELECT CURRENT_DATE, p_cents, 1
  WHERE p_cents <= p_cap
  ON CONFLICT (log_date) DO UPDATE
    SET estimated_anthropic_cents   = candidate_classification_spend_log.estimated_anthropic_cents + EXCLUDED.estimated_anthropic_cents,
        total_candidates_classified = candidate_classification_spend_log.total_candidates_classified + 1
    WHERE candidate_classification_spend_log.estimated_anthropic_cents + EXCLUDED.estimated_anthropic_cents <= p_cap
  RETURNING TRUE INTO v_ok;
  RETURN COALESCE(v_ok, FALSE);
END;
$$;

-- ── Fenced commit: atomically publish a classification result ─────────────────
-- Locks the person, validates the lease (in_progress + matching unexpired token) AND
-- the run (claimed + belongs to person + matching token) AND the GENERATION fence
-- (people.classification_generation = run.claimed_generation), then requires the
-- assignment exp-id set to EXACTLY equal the person's current experience set (count
-- + membership + uniqueness — blocks empty/subset/duplicate publishes), writes each
-- inferred row, marks the candidate done, closes the run — one transaction. Any
-- vanished experience RAISES (rollback). Returns the action.
--
-- p_assignments: [{ exp_id, function_inferred[], specialty_inferred[], skills_inferred[], title_normalized_inferred }]
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
  'Fenced atomic publish of a classify-pending result. Validates person lease + run (claimed/owner/token) + generation fence under a person-row lock, requires assignment exp-id set == current experience set (count+membership+uniqueness), writes inferred axes (each exactly 1 row else RAISE→rollback), marks done, closes the run. Returns committed | discarded:<reason>. Caller runs the discard path on any non-committed return / exception.';

-- ── Ingest invalidation primitive ────────────────────────────────────────────
-- Atomic: bump generation (the fence), mark pending (eligibility), clear any active
-- lease (kills an in-flight worker — its commit then fails the generation fence).
-- Called by ingest BOTH immediately before AND immediately after an experience
-- rewrite: the BEFORE call closes the stale-done window (a crash mid-rewrite leaves
-- the candidate 'pending', not stale 'done'); the AFTER call invalidates any worker
-- that claimed a partial mid-rewrite snapshot (its generation no longer matches).
CREATE OR REPLACE FUNCTION bump_classification_generation(p_person_id UUID)
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE people
     SET classification_generation       = classification_generation + 1,
         classification_status           = 'pending',
         classification_lease_token      = NULL,
         classification_lease_expires_at = NULL,
         updated_at                      = NOW()
   WHERE person_id = p_person_id;
$$;

-- RPC publication boundary: do not rely implicitly on table grants.
REVOKE EXECUTE ON FUNCTION commit_classification(UUID, UUID, UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION reserve_classification_spend(INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION bump_classification_generation(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION commit_classification(UUID, UUID, UUID, TEXT, JSONB) TO service_role;
GRANT  EXECUTE ON FUNCTION reserve_classification_spend(INT, INT) TO service_role;
GRANT  EXECUTE ON FUNCTION bump_classification_generation(UUID) TO service_role;

COMMIT;
