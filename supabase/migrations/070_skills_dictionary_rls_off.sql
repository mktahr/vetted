-- 070_skills_dictionary_rls_off.sql
--
-- Disable RLS on skills_dictionary (created in migration 069). Pattern hit
-- on 034, 037, 039, 041, 053, 066: Supabase auto-enables RLS on every
-- CREATE TABLE, even when the migration includes DISABLE inline. The fix
-- is a separate follow-up migration. See CLAUDE.md "Supabase RLS
-- auto-enables on CREATE TABLE" rule.

BEGIN;

ALTER TABLE skills_dictionary DISABLE ROW LEVEL SECURITY;

COMMIT;
