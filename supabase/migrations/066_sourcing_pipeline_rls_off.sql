-- 066_sourcing_pipeline_rls_off.sql
--
-- Disable RLS on the five tables created in migration 065.
--
-- Pattern hit on 034, 037, 039, 041, 053, now 066: Supabase auto-enables RLS
-- on every CREATE TABLE, even when the migration includes DISABLE inline. The
-- fix is a separate follow-up migration. See CLAUDE.md
-- "Supabase RLS auto-enables on CREATE TABLE" rule.

BEGIN;

ALTER TABLE scrape_targets             DISABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_runs                DISABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_members            DISABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_enrichment_queue  DISABLE ROW LEVEL SECURITY;
ALTER TABLE sourced_prospects          DISABLE ROW LEVEL SECURITY;

COMMIT;
