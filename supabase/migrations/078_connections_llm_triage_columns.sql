-- 078_connections_llm_triage_columns.sql
--
-- NETWORK CONNECTIONS MODULE — PR 1, additive columns for the MAYBE-pile LLM
-- triage pass (tier 2 of the tiered classifier).
--
-- The free taxonomy pass (tier 1) sorts titles into YES/MAYBE/NO. The MAYBE
-- pile then gets a cheap Claude-Haiku triage that uses title + COMPANY context
-- to PRE-SORT the review queue (probably_yes / probably_no / unclear). The admin
-- still makes the final Keep/Drop call — these columns store the guess + reason
-- so the queue can rank by it without re-running the LLM.
--
-- Additive only (ADD COLUMN on connections). Applied dev-first per workflow.

BEGIN;

ALTER TABLE connections
  ADD COLUMN IF NOT EXISTS llm_triage_guess  TEXT
    CHECK (llm_triage_guess IS NULL OR llm_triage_guess IN ('probably_yes', 'probably_no', 'unclear')),
  ADD COLUMN IF NOT EXISTS llm_triage_reason TEXT,
  ADD COLUMN IF NOT EXISTS llm_triaged_at    TIMESTAMPTZ;

COMMENT ON COLUMN connections.llm_triage_guess IS
  'Tier-2 Claude-Haiku triage of a MAYBE-bucket title (with company context). probably_yes / probably_no / unclear. A SUGGESTION only — the admin sets the final bucket via Keep/Drop (title_bucket_source=manual). NULL until triaged.';

COMMIT;
