-- 081_connections_person_link.sql
--
-- NETWORK CONNECTIONS PR 2b — step 2: connections.person_id link.
--
-- Nullable 1:1 FK from a connection to its canonical `people` row. NULL until the
-- (later) normalizer projects the connection into `people`. A connection maps to
-- exactly one canonical person, so this is 1:1 — a junction table would be overkill
-- (the cross-org "who knows this candidate" view already flows through
-- canonical_url + connection_owners).
--
-- ON DELETE SET NULL: deleting a person row must NOT cascade-delete the connection
-- or its paid enrichment — the connection survives with person_id back to NULL.
--
-- Promotion into the general pool = ensure the people row exists (normalizer) +
-- set connections.person_id + flip people.record_kind -> 'both'.
--
-- Non-additive (FK referencing an existing table) → dev-first per the workflow.

BEGIN;

ALTER TABLE connections
  ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(person_id) ON DELETE SET NULL;

-- Reverse lookup (person -> connections) for the cross-org view + promotion checks.
CREATE INDEX IF NOT EXISTS idx_connections_person_id
  ON connections (person_id)
  WHERE person_id IS NOT NULL;

COMMENT ON COLUMN connections.person_id IS
  'Nullable 1:1 link to the canonical people row once this connection is projected into people. NULL = not yet projected. ON DELETE SET NULL keeps the connection (+ its enrichment) if the person row is removed. Promotion into the general pool = ensure person row + set this link + flip people.record_kind -> both.';

-- ── Verification (empty-DB tolerant — schema invariants only) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'connections' AND column_name = 'person_id'
  ) THEN
    RAISE EXCEPTION 'connections.person_id column missing post-migration';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema   = kcu.table_schema
    WHERE tc.table_name = 'connections'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'person_id'
  ) THEN
    RAISE EXCEPTION 'connections.person_id FK constraint to people missing';
  END IF;
END $$;

COMMIT;
