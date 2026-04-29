-- 028_raw_ingest_archive.sql
--
-- Raw payload archival, source provenance, and mapper versioning.
--
-- Every ingest writes the verbatim payload here BEFORE any normalization.
-- If normalization fails, the raw row stays for replay. If a mapper bug
-- corrupts normalized data, the archive lets us re-map without re-fetching.

-- ─── New table: raw_ingest_events ──────────────────────────────────────────

CREATE TABLE raw_ingest_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_url        TEXT NOT NULL,
  source              TEXT NOT NULL
                        CHECK (source IN ('chrome_extension_voyager', 'crust_v1', 'crust_v2', 'manual_admin')),
  source_version      TEXT,          -- extension version string, Crust API version header, etc.
  mapper_version      TEXT,          -- semver from mapper module constant
  payload             JSONB NOT NULL, -- verbatim, no mutation
  payload_hash        TEXT,          -- sha256 hex of JSON.stringify(payload)
  fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mapped_at           TIMESTAMPTZ,   -- set when processing_status → 'mapped'
  processing_status   TEXT NOT NULL DEFAULT 'pending'
                        CHECK (processing_status IN ('pending', 'mapped', 'mapping_failed', 'superseded')),
  mapping_error       TEXT,
  person_id           UUID REFERENCES people(person_id) ON DELETE SET NULL
);

CREATE INDEX idx_rie_linkedin_fetched ON raw_ingest_events (linkedin_url, fetched_at DESC);
CREATE INDEX idx_rie_status_pending ON raw_ingest_events (processing_status)
  WHERE processing_status IN ('pending', 'mapping_failed');

-- ─── Provenance columns on people ──────────────────────────────────────────

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS last_ingest_source   TEXT,
  ADD COLUMN IF NOT EXISTS last_ingest_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_mapper_version  TEXT;

-- ─── Provenance columns on person_experiences ──────────────────────────────

ALTER TABLE person_experiences
  ADD COLUMN IF NOT EXISTS last_ingest_source   TEXT,
  ADD COLUMN IF NOT EXISTS last_ingest_at       TIMESTAMPTZ;

-- ─── Provenance columns on person_education ────────────────────────────────

ALTER TABLE person_education
  ADD COLUMN IF NOT EXISTS last_ingest_source   TEXT,
  ADD COLUMN IF NOT EXISTS last_ingest_at       TIMESTAMPTZ;
