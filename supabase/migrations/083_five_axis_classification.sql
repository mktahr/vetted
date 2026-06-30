-- 083_five_axis_classification.sql
--
-- FIVE-AXIS TAXONOMY — sub-PR 3: LLM ingest inference (classify-pending).
--
-- Adds the storage + job-control + provenance for a DECOUPLED, spend-capped
-- classifier that reads each candidate's full work history/skills/descriptions
-- (one Haiku call per candidate) and writes per-experience five-axis tuples,
-- WITHOUT touching the inline ingest/scoring path. Scoring does not consume these
-- columns until sub-PR 6.
--
-- DESIGN (locked after two Codex reviews):
--  * Inferred axes are stored SEPARATELY from the deterministic columns
--    (function_normalized/specialty_normalized/title_normalized already exist and
--    are title-dictionary-set) — non-destructive, eval-comparable, scoring-safe.
--    NOTE: title_normalized ALREADY EXISTS (migration 001) — the inferred column is
--    title_normalized_inferred.
--  * function_inferred / specialty_inferred are ordered arrays: position 0 = primary,
--    rest = secondary. Numeric weights deferred until sub-PR 6 measures a need.
--  * Job control on `people`: app-layer expiring lease (claim + reclaim) — the
--    DB-level atomic CLAIM is deferred (BACKLOG "Five-Axis Classification"). But the
--    COMMIT is FENCED via a Postgres function here (claim races only waste an LLM
--    call; commit races corrupt data, so the commit must be atomic regardless of
--    low concurrency).
--  * candidate_classification_runs = durable per-attempt history/provenance.
--  * candidate_classification_spend_log = per-day cap, incremented atomically.
--
-- Additive. Dev-first. (084 disables RLS on the two new tables.)

BEGIN;

-- ── Inferred per-experience axes (separate from deterministic) ────────────────
ALTER TABLE person_experiences
  ADD COLUMN IF NOT EXISTS function_inferred         TEXT[],
  ADD COLUMN IF NOT EXISTS specialty_inferred        TEXT[],
  ADD COLUMN IF NOT EXISTS skills_inferred           TEXT[],
  ADD COLUMN IF NOT EXISTS title_normalized_inferred TEXT;

-- Position semantics (0 = primary) require no NULL elements in the arrays.
-- array_position(arr, NULL) finds a NULL element; must be NULL (none found).
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
  -- input hash of the LAST SUCCESSFUL classification (distinct from a run's
  -- claimed_input_hash). "stale" = current input hash <> this (re-ingest sets pending).
  ADD COLUMN IF NOT EXISTS classification_input_hash       TEXT,
  ADD COLUMN IF NOT EXISTS classifier_version              TEXT,
  ADD COLUMN IF NOT EXISTS classified_at                   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS classification_lease_token      UUID,
  ADD COLUMN IF NOT EXISTS classification_lease_expires_at TIMESTAMPTZ,
  -- Failures only — claims/discards/reclaims never increment (Codex: discard must
  -- not burn retry budget). Gates failed-retry eligibility.
  ADD COLUMN IF NOT EXISTS classification_failure_count    INT NOT NULL DEFAULT 0;

-- Queue scan: actionable rows only (the non-terminal/retryable set).
CREATE INDEX IF NOT EXISTS idx_people_classification_queue
  ON people (classification_status, classification_lease_expires_at)
  WHERE classification_status IN ('pending', 'in_progress', 'failed');

-- ── Durable per-attempt history / provenance ──────────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_classification_runs (
  run_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id          UUID NOT NULL REFERENCES people(person_id) ON DELETE CASCADE,
  model              TEXT,                 -- resolved model id actually used
  prompt_version     TEXT,
  dictionary_version TEXT,                 -- hash/version identifying the active vocab
  claimed_input_hash TEXT,                 -- the snapshot this attempt classified
  status             TEXT NOT NULL CHECK (status IN ('claimed', 'succeeded', 'failed', 'discarded')),
  tokens             INT     CHECK (tokens IS NULL OR tokens >= 0),
  cost_cents         NUMERIC CHECK (cost_cents IS NULL OR cost_cents >= 0),
  reasoning          JSONB,
  error              TEXT,
  claimed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ,
  CHECK (completed_at IS NULL OR completed_at >= claimed_at)
);
CREATE INDEX IF NOT EXISTS idx_classification_runs_person
  ON candidate_classification_runs (person_id, claimed_at DESC);

-- ── Per-day spend rollup (atomic increment via INSERT … ON CONFLICT) ──────────
CREATE TABLE IF NOT EXISTS candidate_classification_spend_log (
  log_date                  DATE PRIMARY KEY,
  total_candidates_classified INT NOT NULL DEFAULT 0,
  estimated_anthropic_cents   INT NOT NULL DEFAULT 0
);

-- ── Fenced commit: atomically publish a classification result ─────────────────
-- Claim stays app-layer (deferred DB-claim in BACKLOG), but COMMIT is fenced:
-- locks the person row, verifies the lease is still ours + unexpired, writes every
-- inferred row by person_experience_id (each must hit exactly 1 row — proves the
-- target experiences still exist), marks the candidate done, and closes the run —
-- all in one transaction. If any target experience is gone (a re-ingest churned the
-- UUIDs mid-flight) it RAISES, rolling back the whole publish; the caller then runs
-- the discard path. Returns the action taken.
--
-- p_assignments: jsonb array of
--   { "exp_id": uuid, "function_inferred": text[], "specialty_inferred": text[],
--     "skills_inferred": text[], "title_normalized_inferred": text }
CREATE OR REPLACE FUNCTION commit_classification(
  p_person_id          UUID,
  p_lease_token        UUID,
  p_run_id             UUID,
  p_input_hash         TEXT,
  p_classifier_version TEXT,
  p_assignments        JSONB
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_status     TEXT;
  v_token      UUID;
  v_expires    TIMESTAMPTZ;
  v_assignment JSONB;
  v_rows       INT;
BEGIN
  -- Fence on the person row.
  SELECT classification_status, classification_lease_token, classification_lease_expires_at
    INTO v_status, v_token, v_expires
    FROM people
   WHERE person_id = p_person_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'discarded:person_gone';
  END IF;
  IF v_status <> 'in_progress'
     OR v_token IS DISTINCT FROM p_lease_token
     OR v_expires IS NULL OR v_expires <= NOW() THEN
    RETURN 'discarded:lease_lost';
  END IF;

  -- Publish each inferred row by UUID; each MUST still exist (exactly 1 row).
  FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
  LOOP
    UPDATE person_experiences
       SET function_inferred         = COALESCE(
             (SELECT array_agg(x) FROM jsonb_array_elements_text(v_assignment->'function_inferred') AS x),
             NULL),
           specialty_inferred        = COALESCE(
             (SELECT array_agg(x) FROM jsonb_array_elements_text(v_assignment->'specialty_inferred') AS x),
             NULL),
           skills_inferred           = COALESCE(
             (SELECT array_agg(x) FROM jsonb_array_elements_text(v_assignment->'skills_inferred') AS x),
             NULL),
           title_normalized_inferred = NULLIF(v_assignment->>'title_normalized_inferred', ''),
           updated_at                = NOW()
     WHERE person_experience_id = (v_assignment->>'exp_id')::UUID
       AND person_id = p_person_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      -- A target experience vanished (re-ingest race) → abort the whole publish.
      RAISE EXCEPTION 'classification_commit_exp_missing: %', v_assignment->>'exp_id';
    END IF;
  END LOOP;

  UPDATE people
     SET classification_status        = 'done',
         classification_input_hash    = p_input_hash,
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
  'Fenced atomic publish of a classify-pending result. Verifies the lease (status=in_progress + matching unexpired token) under a person-row lock, writes inferred axes by person_experience_id (each exactly 1 row, else RAISE→rollback), marks the candidate done, closes the run. Caller runs the discard path on any non-committed return / exception.';

COMMIT;
