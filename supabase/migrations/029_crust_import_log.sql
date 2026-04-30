-- 029_crust_import_log.sql
--
-- Audit log for every Crust import request — preview AND full runs.
-- Captures the filter body sent, results returned, credits consumed,
-- and (eventually) which user kicked it off.

CREATE TABLE crust_import_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_kind    TEXT NOT NULL CHECK (request_kind IN ('preview', 'run', 'autocomplete')),
  filter_body     JSONB NOT NULL,
  results_count   INTEGER,         -- profiles fetched (preview = sample size, run = total ingested)
  credits_used    INTEGER,         -- Crust charges 0.03 credits per /person/search result; round up
  error_message   TEXT,            -- non-null when the request failed
  user_id         TEXT             -- TODO: change to UUID FK to users table when auth ships
                                   -- For now: nullable text. Hardcoded 'admin' fallback in route.
);

CREATE INDEX idx_crust_log_created ON crust_import_log (created_at DESC);
CREATE INDEX idx_crust_log_kind ON crust_import_log (request_kind);
