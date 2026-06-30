-- 082_gated_promotion.sql
--
-- NETWORK CONNECTIONS PR 2 — GATED PROMOTION.
--
-- Promotion = move a projected network connection into the general candidate
-- pool. Mechanically a flag flip (people.record_kind network_connection -> both)
-- + the person_id link (migration 081) — NO re-pay / re-enrich / re-score; the
-- row was already projected and scored at projection time (PR 2b).
--
-- Two NEW additive columns back the gate:
--
--   connections.pool_override        — the admin's explicit per-connection decision.
--       NULL  → follow the auto-rule (vetted-company → eligible)
--       'in'  → force into the pool regardless of the rule
--       'out' → keep out of the pool regardless of the rule
--     The admin has final say; this column is how that say persists across
--     re-runs of the auto-rule (so an 'out' connection at a vetted company is
--     never silently re-promoted).
--
--   people.promoted_from_connection  — provenance guard for safe DEMOTION.
--       TRUE  → this person's pool membership came from promoting a PURE network
--               connection (record_kind flipped network_connection -> both).
--       FALSE → native candidate (came via /api/ingest), or a candidate that is
--               ALSO a connection via projection-merge. NEVER demote these.
--     Force-out demotes (both -> network_connection) ONLY when this is TRUE.
--     record_kind='both' alone cannot distinguish a promoted connection from a
--     native candidate who is also a connection — both are 'both'. Without this
--     guard, "remove from pool" could silently drop a real candidate.
--
-- Both additive (ADD COLUMN on existing tables) — no RLS re-enable concern
-- (that only fires on CREATE TABLE). Applied dev-first then prod per the
-- dev/prod workflow.

BEGIN;

ALTER TABLE connections
  ADD COLUMN IF NOT EXISTS pool_override TEXT
    CHECK (pool_override IS NULL OR pool_override IN ('in', 'out'));

COMMENT ON COLUMN connections.pool_override IS
  'Admin manual pool decision (final say). NULL = follow auto-rule (vetted company -> eligible); in = force into pool; out = force out. Persists the admin override across auto-rule re-runs.';

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS promoted_from_connection BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN people.promoted_from_connection IS
  'TRUE only when pool membership came from promoting a pure network connection (record_kind network_connection -> both). FALSE for native candidates and projection-merge both-rows. Force-out demotes ONLY when TRUE, so a real candidate is never removed from the pool.';

-- Demotion / reconcile re-checks all connections linked to a person (N:1), so a
-- person -> connections reverse lookup is needed; 081 already added
-- idx_connections_person_id. Index pool_override's non-NULL minority for the
-- auto-rule scan.
CREATE INDEX IF NOT EXISTS idx_connections_pool_override
  ON connections (pool_override)
  WHERE pool_override IS NOT NULL;

-- ── Verification (empty-DB tolerant — schema invariants only) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'connections' AND column_name = 'pool_override'
  ) THEN
    RAISE EXCEPTION 'connections.pool_override column missing post-migration';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'people' AND column_name = 'promoted_from_connection'
  ) THEN
    RAISE EXCEPTION 'people.promoted_from_connection column missing post-migration';
  END IF;

  -- DEFAULT FALSE backfills every existing person row, so there must be ZERO
  -- TRUE rows immediately post-migration (holds at 0 rows too).
  IF (SELECT count(*) FROM people WHERE promoted_from_connection) <> 0 THEN
    RAISE EXCEPTION 'expected 0 promoted_from_connection=TRUE rows post-migration';
  END IF;
END $$;

COMMIT;
