-- scripts/_dev-catchup-062-063.sql
--
-- One-off dev DB catchup for migrations 062 + 063, applied after
-- replay-migrations-to-dev.sh against a fresh dev Supabase project.
--
-- WHY THIS IS NEEDED
--   Migrations 062 and 063 each contain a verification DO block that RAISEs
--   an exception when expected row counts in signal_dictionary aren't found
--   (e.g., 062 expects 47 fellowship rows; on a fresh dev DB with no
--   seed data, the count is 0 → verification fails → transaction rolls back
--   → schema ADD COLUMN changes lost).
--
--   The DATA operations in 062 and 063 (UPDATEs, DELETEs against
--   signal_dictionary) are no-ops on empty dev — there's nothing to update.
--   Only the SCHEMA changes (ADD COLUMN) need to be applied for dev to
--   reach schema parity with prod.
--
-- WHAT THIS DOES
--   Adds the columns from 062 and 063 that the rollbacks dropped. No
--   verification, no data ops. Idempotent via IF NOT EXISTS.
--
-- WHEN TO USE
--   Run once, after replay-migrations-to-dev.sh, ONLY against dev.
--   Not part of the migration ledger — this is a dev-bootstrap aid.
--   Future migrations apply normally via apply-migration.sh dev <file>.
--
-- USAGE
--   ./scripts/apply-migration.sh dev scripts/_dev-catchup-062-063.sql

BEGIN;

-- ─── From migration 062: signal_dictionary.is_searchable ────────────────

ALTER TABLE signal_dictionary
  ADD COLUMN IF NOT EXISTS is_searchable BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN signal_dictionary.is_searchable IS
  'When TRUE, this individual signal appears as a filter option in the UI signals dropdown. When FALSE, the signal exists for extraction only.';

-- ─── From migration 063: people.is_vc_backed_founder / is_bootstrapped_founder ─

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS is_vc_backed_founder    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_bootstrapped_founder BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN people.is_vc_backed_founder IS
  'TRUE if candidate has any founder-titled experience where the company has VC-backing signals. Derived by compute-derived.ts; re-evaluated on each scoreCandidate.';

COMMENT ON COLUMN people.is_bootstrapped_founder IS
  'TRUE if candidate has any founder-titled experience where the company has NO VC-backing signals. Default for founders when no enrichment exists.';

CREATE INDEX IF NOT EXISTS idx_people_is_vc_backed_founder
  ON people (is_vc_backed_founder) WHERE is_vc_backed_founder = TRUE;

CREATE INDEX IF NOT EXISTS idx_people_is_bootstrapped_founder
  ON people (is_bootstrapped_founder) WHERE is_bootstrapped_founder = TRUE;

COMMIT;
