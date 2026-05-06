-- 039_lists_rls_off.sql
--
-- Same Supabase auto-RLS bug as migrations 034 and 037: the DISABLE in
-- the table-creating migration (038) didn't stick because Supabase's
-- auto-RLS-enable runs AFTER the DISABLE in the same transaction. Fix:
-- a follow-up migration that disables RLS again, on tables that now
-- exist from the prior commit.
--
-- After this, anon (browser) can read AND insert/update/delete on the
-- four lists tables — required for the lists / saved-searches / hide
-- features to work end-to-end.

BEGIN;

ALTER TABLE lists           DISABLE ROW LEVEL SECURITY;
ALTER TABLE list_items      DISABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches  DISABLE ROW LEVEL SECURITY;
ALTER TABLE hidden_items    DISABLE ROW LEVEL SECURITY;

COMMIT;
