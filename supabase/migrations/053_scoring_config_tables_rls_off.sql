-- 053_scoring_config_tables_rls_off.sql
--
-- Disable RLS on the three config tables created in migrations 050-052.
--
-- Pattern hit on 034, 037, 039, 041 — Supabase auto-enables RLS on every
-- CREATE TABLE, even when migration includes DISABLE inline. The fix is a
-- separate follow-up migration. See CLAUDE.md "Supabase RLS auto-enables
-- on CREATE TABLE" rule under Development Rules.

BEGIN;

ALTER TABLE signal_scoring_weights              DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_role_scoring_weights           DISABLE ROW LEVEL SECURITY;
ALTER TABLE career_stage_bucket_thresholds      DISABLE ROW LEVEL SECURITY;

COMMIT;
