-- 075_network_connections_schema.sql
--
-- NETWORK CONNECTIONS MODULE — phase 1 schema (PR 1 of 2).
--
-- WHAT THIS MODULE IS
--   A warm-intro / network-graph layer. Organizations have employees; each
--   employee uploads their LinkedIn "Connections.csv". Those connections are
--   parsed, canonicalized, classified (engineering / not / maybe), deduped per
--   org, optionally enriched via Crust, and surfaced for recruiter search as a
--   warm-path filter dimension (PR 2).
--
-- CORE PRINCIPLE — FULL ISOLATION FROM THE GLOBAL CANDIDATE POOL
--   Connections live ONLY in these tables. They are NEVER written into
--   `people`, NEVER routed through /api/ingest (which runs global scoring /
--   bucketing), and NEVER appear in the global candidate search. We READ the
--   global pool (and the cross-org enrichment cache) only to avoid re-buying
--   enrichment we already have. Uploaded connection data is privacy-sensitive
--   real-people data — not disposable test material.
--
-- FIRST TENANCY BOUNDARY IN THE APP
--   Today the app is single-pool (OWNER_ID='admin', no auth). This module
--   introduces the first real tenant boundary. Every org-scoped table carries
--   `org_id` from day one so a V2 auth/RLS layer attaches cleanly later. No
--   login / RLS / auth machinery is built now — orgs are created manually by
--   the single admin.
--
-- EIGHT TABLES
--   1. organizations              — the tenant boundary
--   2. employees                  — people inside an org who upload their CSVs
--   3. upload_batches             — provenance + per-upload rollup counts
--   4. raw_connection_rows        — verbatim replay buffer (every CSV row, never overwritten)
--   5. connections                — processed/searchable projection, deduped per org
--   6. connection_owners          — junction (connection ↔ employee), is_active = soft-disconnect
--   7. network_enriched_profiles  — GLOBAL enrichment cache keyed by canonical_url (deliberate
--                                    exception to "org_id on every table" — see its COMMENT)
--
--   (7 tables; the README above says "eight" counting the conceptual companies
--    overlay which reuses the existing `companies` table — no new table for it.)
--
-- ENUMS
--   Per the convention in 028/029/031/038/040/049/065 all enums are
--   TEXT NOT NULL CHECK (col IN (...)) — no CREATE TYPE. Easier value adds /
--   renames than PG enum types.
--
-- CROSS-POOL FK INTENTIONALLY OMITTED
--   network_enriched_profiles has NO FK to people. It is a parallel, siloed
--   cache; the canonical_url string is the only linkage and matching happens in
--   app code (people.linkedin_url is stored un-normalized, so both sides are
--   canonicalized at compare time). Same precedent as sourced_prospects in 065.
--
-- RLS
--   Supabase auto-enables RLS on every CREATE TABLE even with an inline DISABLE.
--   The inline DISABLE at the bottom is cosmetic; the real fix is migration 076.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────
-- 1. organizations — the tenant boundary
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE organizations (
  org_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive unique org name so "Acme" and "acme" don't both get created.
CREATE UNIQUE INDEX idx_organizations_name_lower ON organizations (LOWER(name));

COMMENT ON TABLE organizations IS
  'The tenant boundary for the network-connections module. Created manually by the admin (no auth yet). Every org-scoped table FKs back here so a V2 auth/RLS layer can attach by org_id.';

-- ────────────────────────────────────────────────────────────────────────
-- 2. employees — members of an org whose connection CSVs we ingest
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE employees (
  employee_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,

  full_name               TEXT NOT NULL,
  email                   TEXT,
  linkedin_url            TEXT,            -- raw, as entered
  canonical_linkedin_url  TEXT,            -- app-canonicalized; NULL if no/invalid URL

  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One employee per canonical LinkedIn URL within an org (when a URL is present).
CREATE UNIQUE INDEX idx_employees_org_canonical_url
  ON employees (org_id, canonical_linkedin_url)
  WHERE canonical_linkedin_url IS NOT NULL;

CREATE INDEX idx_employees_org ON employees (org_id);

COMMENT ON TABLE employees IS
  'A person inside an org who uploads their LinkedIn Connections.csv. Connections are attributed to the employee(s) who know them via connection_owners.';

-- ────────────────────────────────────────────────────────────────────────
-- 3. upload_batches — provenance + per-upload rollup counts
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE upload_batches (
  batch_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,

  filename        TEXT,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Rollup counts, filled by the ingest handler (post-upload summary source).
  rows_parsed     INTEGER NOT NULL DEFAULT 0,
  rows_new        INTEGER NOT NULL DEFAULT 0,   -- new connection rows created
  rows_matched    INTEGER NOT NULL DEFAULT 0,   -- existing org connections re-seen / refreshed
  rows_skipped    INTEGER NOT NULL DEFAULT 0,   -- junk / unparseable / no-URL rows
  bucket_yes      INTEGER NOT NULL DEFAULT 0,
  bucket_maybe    INTEGER NOT NULL DEFAULT 0,
  bucket_no       INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_upload_batches_org_uploaded   ON upload_batches (org_id, uploaded_at DESC);
CREATE INDEX idx_upload_batches_employee        ON upload_batches (employee_id, uploaded_at DESC);

COMMENT ON TABLE upload_batches IS
  'One row per uploaded Connections.csv. uploaded_at is the freshness key for "freshest upload wins" conflict resolution. Rollup counts back the post-upload summary screen.';

-- ────────────────────────────────────────────────────────────────────────
-- 4. raw_connection_rows — verbatim replay buffer (never overwritten)
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE raw_connection_rows (
  raw_row_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  upload_batch_id UUID NOT NULL REFERENCES upload_batches(batch_id) ON DELETE CASCADE,

  -- The six LinkedIn CSV fields, stored EXACTLY as parsed (post junk-header skip).
  first_name      TEXT,
  last_name       TEXT,
  url             TEXT,
  email           TEXT,
  company         TEXT,
  position        TEXT,
  connected_on    TEXT,         -- raw string, e.g. "15 Jun 2024" — parsed downstream

  raw_line        JSONB,        -- the full parsed row object, verbatim
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_raw_connection_rows_batch    ON raw_connection_rows (upload_batch_id);
CREATE INDEX idx_raw_connection_rows_employee ON raw_connection_rows (employee_id);

COMMENT ON TABLE raw_connection_rows IS
  'Append-only verbatim store of every uploaded CSV row. The replay buffer: never overwritten, re-runnable against future taxonomy / classification-scope changes without re-asking the employee for their CSV. The processed projection lives in `connections`.';

-- ────────────────────────────────────────────────────────────────────────
-- 5. connections — processed / searchable projection (deduped per org)
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE connections (
  connection_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,

  -- Identity / dedupe key (UNIQUE per org via index below).
  canonical_url        TEXT NOT NULL,   -- app-canonicalized /in/<slug> form
  raw_url              TEXT,            -- latest raw URL seen

  first_name           TEXT,
  last_name            TEXT,
  full_name            TEXT,

  -- Current-only snapshot from the CSV (freshest upload wins).
  current_company      TEXT,
  current_title        TEXT,
  connected_on         DATE,            -- parsed; NULL if unparseable
  connected_on_raw     TEXT,

  -- Classification (engineering scope for V1; scope itself is a parameter).
  function_scope       TEXT NOT NULL DEFAULT 'engineering',
  title_bucket         TEXT NOT NULL DEFAULT 'maybe'
                         CHECK (title_bucket IN ('yes', 'maybe', 'no')),
  title_bucket_source  TEXT
                         CHECK (title_bucket_source IS NULL OR title_bucket_source IN (
                           'taxonomy', 'llm_triage', 'web_check', 'manual'
                         )),
  specialty_normalized TEXT,            -- resolveSpecialty() best-effort on terse CSV title

  -- Soft-hide. NO-bucket sets status='excluded' but the row stays reviewable /
  -- re-runnable as classification rules improve. NEVER hard-deleted.
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'excluded')),

  -- Free company-score overlay (best-effort NAME match to scored `companies`).
  company_id           UUID REFERENCES companies(company_id) ON DELETE SET NULL,
  company_score        SMALLINT,        -- denormalized latest-year company_year_scores (1-5), NULL if unscored/unmatched
  company_score_year   SMALLINT,

  -- Enrichment state (the actual profile blob lives in network_enriched_profiles,
  -- keyed by canonical_url; these are denormalized for display / sort / filter).
  enriched             BOOLEAN NOT NULL DEFAULT FALSE,
  last_enriched_at     TIMESTAMPTZ,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dedupe: one connection per canonical URL per org.
CREATE UNIQUE INDEX idx_connections_org_canonical_url
  ON connections (org_id, canonical_url);

-- Admin-table filters / sorts.
CREATE INDEX idx_connections_org_bucket   ON connections (org_id, title_bucket);
CREATE INDEX idx_connections_org_status   ON connections (org_id, status);
CREATE INDEX idx_connections_org_company  ON connections (org_id, company_id);
CREATE INDEX idx_connections_org_enriched ON connections (org_id, enriched);
-- Cross-silo + global-pool dedupe lookups hit canonical_url directly.
CREATE INDEX idx_connections_canonical_url ON connections (canonical_url);

COMMENT ON TABLE connections IS
  'Processed projection of raw_connection_rows, deduped on canonical_url within an org. Siloed — never written to `people`. company_score is a denormalized free overlay (best-effort name match to the scored companies table); "present in scored companies" is itself the signal — there is no separate target-company concept.';

COMMENT ON COLUMN connections.company_score IS
  'Latest-year company_year_scores.company_score (1-5) for the name-matched company. NULL when the company name does not match a scored company. Best-effort NAME match (CSV gives a name string; scored companies key on id/url) — looser than URL matching, a prioritization signal only.';

COMMENT ON COLUMN connections.status IS
  'active | excluded. excluded = soft-hidden NO-bucket connection; stays in the DB, reviewable, and re-runnable as classification improves. Never a hard delete.';

-- ────────────────────────────────────────────────────────────────────────
-- 6. connection_owners — junction; is_active = soft-disconnect
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE connection_owners (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id       UUID NOT NULL REFERENCES connections(connection_id) ON DELETE CASCADE,
  employee_id         UUID NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  org_id              UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,

  -- Soft-disconnect: when a previously-present connection is ABSENT from a
  -- re-upload of this employee's CSV, this link flips to FALSE. The connection
  -- and its enrichment are preserved; the connection only drops from view when
  -- NO active owner remains.
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,

  connected_on        DATE,           -- this employee's connection date to this person
  first_seen_batch_id UUID REFERENCES upload_batches(batch_id) ON DELETE SET NULL,
  last_seen_batch_id  UUID REFERENCES upload_batches(batch_id) ON DELETE SET NULL,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (connection_id, employee_id)
);

CREATE INDEX idx_connection_owners_employee_active ON connection_owners (employee_id, is_active);
CREATE INDEX idx_connection_owners_connection      ON connection_owners (connection_id);

COMMENT ON TABLE connection_owners IS
  'Junction: which employee(s) know a connection (all warm paths). is_active=FALSE is a soft-disconnect (connection absent from an employee''s latest re-upload) — the connection survives until NO active owner remains. Protects paid enrichment and multi-owner cases.';

-- ────────────────────────────────────────────────────────────────────────
-- 7. network_enriched_profiles — GLOBAL enrichment cache (no org_id)
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE network_enriched_profiles (
  enriched_profile_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Global identity key. NO org_id — this is the one deliberate exception to
  -- "org_id on every table". Cross-silo reuse: if ANY org has enriched this
  -- canonical_url (or it matched the global people pool), we reuse it instead
  -- of re-buying. Stays BACKEND-ONLY — never reveals which orgs know a person.
  canonical_url        TEXT NOT NULL UNIQUE,

  source               TEXT NOT NULL DEFAULT 'crust_person_enrich'
                         CHECK (source IN ('crust_person_enrich', 'global_pool_reuse')),
  enriched_profile     JSONB,          -- full enrichment payload, verbatim
  mapper_version       TEXT,

  -- A few denormalized fields for display without re-parsing the blob.
  display_name         TEXT,
  headline             TEXT,
  location_name        TEXT,
  current_company      TEXT,
  current_title        TEXT,

  last_enriched_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE network_enriched_profiles IS
  'Global, cross-silo enrichment cache keyed by canonical LinkedIn URL. The ONLY module table without org_id — intentional. Backend-only: a profile here is reused across orgs to avoid re-buying Crust enrichment, but its presence is never surfaced cross-org in the UI. source=global_pool_reuse means the data was projected from a global people-pool match (we read people; we never write to it).';

COMMENT ON COLUMN network_enriched_profiles.canonical_url IS
  'App-canonicalized /in/<slug> form. Matching against people.linkedin_url (stored raw/un-normalized) canonicalizes BOTH sides at compare time.';

-- ────────────────────────────────────────────────────────────────────────
-- RLS — inline DISABLE is cosmetic (Supabase re-enables); real DISABLE in 076
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE organizations             DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE upload_batches            DISABLE ROW LEVEL SECURITY;
ALTER TABLE raw_connection_rows       DISABLE ROW LEVEL SECURITY;
ALTER TABLE connections               DISABLE ROW LEVEL SECURITY;
ALTER TABLE connection_owners         DISABLE ROW LEVEL SECURITY;
ALTER TABLE network_enriched_profiles DISABLE ROW LEVEL SECURITY;

COMMIT;
