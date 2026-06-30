-- 084_classification_rls_off.sql
--
-- Supabase auto-enables RLS on CREATE TABLE even when the creating migration
-- doesn't ask for it. Disable it on the two tables created in 083 so the
-- service-role admin client can read/write them (same pattern as 034/037/039/070).
-- Service-role-only, single-admin; no policies needed.

BEGIN;

ALTER TABLE candidate_classification_runs       DISABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_classification_spend_log  DISABLE ROW LEVEL SECURITY;

COMMIT;
