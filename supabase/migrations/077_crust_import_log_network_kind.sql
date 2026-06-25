-- 077_crust_import_log_network_kind.sql
--
-- Extend crust_import_log.request_kind CHECK to log network-module enrichment.
--
-- NON-ADDITIVE — modifies a CHECK constraint on an existing table → dev-first
-- per the dev/prod workflow in CLAUDE.md.
--
-- The network connections module reuses crust_import_log for Crust cost
-- tracking (same as the candidate-import flow). Per-URL person enrichment is
-- logged as request_kind='network_enrich'. Today's allowed values are
-- ('preview','run','autocomplete') (migration 029); this adds 'network_enrich'.
--
-- The original CHECK was defined inline in 029, so Postgres auto-named it
-- crust_import_log_request_kind_check. Drop-and-readd by that name.

BEGIN;

ALTER TABLE crust_import_log
  DROP CONSTRAINT IF EXISTS crust_import_log_request_kind_check;

ALTER TABLE crust_import_log
  ADD CONSTRAINT crust_import_log_request_kind_check
  CHECK (request_kind IN ('preview', 'run', 'autocomplete', 'network_enrich'));

COMMIT;
