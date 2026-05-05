-- 034_disable_rls_admin_tables.sql
--
-- Fix: tables added in migrations 032 and 033 were silently blocked from
-- the browser because Supabase auto-enables RLS on new tables. The admin
-- pages query via the anon key and saw zero rows back, even though the
-- service role had populated them correctly.
--
-- Existing tables (companies, person_experiences, etc.) created before
-- the auto-enable default don't have RLS. Match that for the new admin
-- tables — they're admin-only by URL anyway, not user-facing.
--
-- If/when we ship the user-facing recruiter app, we'll layer RLS back on
-- with explicit per-table policies for that context.

BEGIN;

ALTER TABLE companies_tag_spend_log    DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_funding_rounds     DISABLE ROW LEVEL SECURITY;

COMMIT;
