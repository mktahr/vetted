-- 037_investor_tiers_rls_off.sql
--
-- Same RLS auto-enable issue as migration 034: investor_tiers has data,
-- but the anon key can't read it from the browser, so the Notable
-- Investors callout silently shows nothing.
--
-- Match the security model of the other admin tables — admin pages are
-- protected by URL, not RLS. Will be re-enabled with explicit per-table
-- policies when the recruiter-facing app ships.

BEGIN;
ALTER TABLE investor_tiers DISABLE ROW LEVEL SECURITY;
COMMIT;
