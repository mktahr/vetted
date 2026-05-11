-- 041_competitions_teams_rls_off.sql
--
-- Disable RLS on the four tables created in migration 040.
--
-- Pattern hit on 034, 037, 039, now 041: Supabase auto-enables RLS on
-- every CREATE TABLE, even when the migration includes DISABLE inline.
-- The fix is a separate follow-up migration. See CLAUDE.md
-- "Supabase RLS auto-enables on CREATE TABLE" rule.

BEGIN;

ALTER TABLE competitions               DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams                      DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_competition_map       DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_domain_tag_dictionary DISABLE ROW LEVEL SECURITY;

COMMIT;
