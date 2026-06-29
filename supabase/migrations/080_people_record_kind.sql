-- 080_people_record_kind.sql
--
-- NETWORK CONNECTIONS PR 2b — step 1: people.record_kind.
--
-- Distinguishes general-pool candidates from projected network connections that
-- live in `people` (so the existing 25-axis search machinery is reused) but must
-- NOT appear in the default candidate pool. ONE column, not a boolean — it also
-- backs a future "N" network badge.
--
--   candidate           — a normal candidate (the default; ALL existing rows)
--   network_connection  — a projected network connection, NOT in the general pool
--   both                — a real candidate who is ALSO in someone's network
--
-- Pool membership DERIVES from this column (no separate flag):
--   default candidate pool      = record_kind IN ('candidate','both')
--   search-within-connections   = record_kind IN ('network_connection','both')   (org-scoped)
--   promotion to pool           = network_connection -> both  (flag flip, no re-pay)
--   "N" network badge           = record_kind IN ('network_connection','both')
--
-- WHY DEFAULT 'candidate' (Codex's catch on the original boolean-FALSE-default):
--   ADD COLUMN ... DEFAULT applies on INSERT only. So every EXISTING people row
--   and every new /api/ingest insert is 'candidate' (stays in the pool) — fail-safe.
--   Connections only ever become 'network_connection' via the (later) normalizer's
--   explicit INSERT. The ingest upsert deliberately does NOT write record_kind:
--   writing it unconditionally would DEMOTE a promoted 'both' / linked
--   'network_connection' back to 'candidate' on every re-scrape. The
--   candidate<->connection merge (-> 'both') is deliberate normalizer logic.
--
-- Additive (new column on an existing table). Applied dev-first then prod per the
-- dev/prod workflow.

BEGIN;

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS record_kind TEXT NOT NULL DEFAULT 'candidate'
    CHECK (record_kind IN ('candidate', 'network_connection', 'both'));

-- Broad-reader filters key on record_kind. Partial index targets the non-default
-- (connection) rows — the minority, and the set we filter in/out of search.
CREATE INDEX IF NOT EXISTS idx_people_record_kind
  ON people (record_kind)
  WHERE record_kind <> 'candidate';

COMMENT ON COLUMN people.record_kind IS
  'candidate | network_connection | both. Pool membership derives from this: default pool = IN (candidate,both); search-within-connections = IN (network_connection,both); promotion flips network_connection -> both. DEFAULT candidate is fail-safe (existing + new ingest rows stay in the pool). Set by the network normalizer (network_connection) and promotion (both); /api/ingest relies on the default for new candidate inserts to avoid demoting promoted connections on re-ingest.';

-- ── Verification (empty-DB tolerant: schema invariants + a backfill invariant
--    that holds whether `people` is empty or full — no seed-row assumptions) ──
DO $$
DECLARE
  col_default TEXT;
  non_candidate_count BIGINT;
BEGIN
  SELECT column_default INTO col_default
  FROM information_schema.columns
  WHERE table_name = 'people' AND column_name = 'record_kind';

  IF col_default IS NULL OR col_default NOT LIKE '%candidate%' THEN
    RAISE EXCEPTION 'record_kind default not set to candidate (got: %)', col_default;
  END IF;

  -- ADD COLUMN ... DEFAULT backfills every existing row to candidate, so there
  -- must be ZERO non-candidate rows immediately post-migration (holds at 0 rows too).
  SELECT count(*) INTO non_candidate_count FROM people WHERE record_kind <> 'candidate';
  IF non_candidate_count <> 0 THEN
    RAISE EXCEPTION 'expected 0 non-candidate rows post-migration, found %', non_candidate_count;
  END IF;
END $$;

COMMIT;
