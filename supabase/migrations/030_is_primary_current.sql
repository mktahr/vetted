-- 030_is_primary_current.sql
--
-- Adds person_experiences.is_primary_current BOOLEAN.
--
-- Crust v2 /person/search returns multiple is_current=true roles when a
-- candidate has overlapping current employment (still-listed internships,
-- side projects, advisory roles, etc). Crust flags ONE of them with
-- is_default=true to indicate the candidate's primary current role.
--
-- We persist that signal as is_primary_current. The ingest "derive current
-- role" step queries this column first; if no row has it set, it falls back
-- to the existing sort+filter heuristic (latest start_date, non-student title).

ALTER TABLE person_experiences
  ADD COLUMN IF NOT EXISTS is_primary_current BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index for the common query: "find the primary current role for this person"
CREATE INDEX IF NOT EXISTS idx_person_exp_primary_current
  ON person_experiences (person_id)
  WHERE is_primary_current = TRUE;
