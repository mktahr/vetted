-- 076_network_connections_rls_off.sql
--
-- Disable RLS on the seven tables created in migration 075.
--
-- Pattern hit on 034, 037, 039, 041, 053, 066, now 076: Supabase auto-enables
-- RLS on every CREATE TABLE, even when the migration includes DISABLE inline.
-- The fix is this separate follow-up migration. See CLAUDE.md
-- "Supabase RLS auto-enables on CREATE TABLE" rule. Without it, service-role
-- reads silently return empty result sets.

BEGIN;

ALTER TABLE organizations             DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE upload_batches            DISABLE ROW LEVEL SECURITY;
ALTER TABLE raw_connection_rows       DISABLE ROW LEVEL SECURITY;
ALTER TABLE connections               DISABLE ROW LEVEL SECURITY;
ALTER TABLE connection_owners         DISABLE ROW LEVEL SECURITY;
ALTER TABLE network_enriched_profiles DISABLE ROW LEVEL SECURITY;

COMMIT;
