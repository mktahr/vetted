-- 065_sourcing_pipeline_schema.sql
--
-- Sourcing pipeline phase 1: schema only, no UI, no API routes, no external
-- service calls. Tables sit dormant until phase 2+ wires them up.
--
-- WHAT THIS PIPELINE IS
--   A separate sourcing layer for discovering high-signal early-career talent
--   by scraping public roster pages (FSAE teams, fellowships, hackathon
--   winners, etc.) or by CSV import. Members get LinkedIn URL discovery and
--   full profile enrichment, then surface in admin UI for review before being
--   ingested into the candidate DB (people table).
--
-- WHY THIS IS SEPARATE FROM scoring "signals"
--   The existing signal_dictionary / person_signals / person_signals_active
--   ecosystem is the SCORING layer — controlled vocabulary of olympiads,
--   fellowships, etc. attached to people via the extractor pipeline. These
--   sourcing tables are a different concept: a queue of discovered-but-not-
--   yet-ingested prospects. The final table is named sourced_prospects (NOT
--   "signals") to avoid the naming collision.
--
-- FIVE NEW TABLES
--   1. scrape_targets             — sources to scrape or CSV-import
--   2. scrape_runs                — audit log per execution
--   3. scraped_members            — raw extraction output before enrichment
--   4. linkedin_enrichment_queue  — items awaiting URL discovery / profile fetch
--   5. sourced_prospects          — final dedupe'd enriched output (links to people later)
--
-- ENUMS
--   Per the new-migration convention (visible in 028, 029, 031, 038, 040, 049)
--   all enums are TEXT NOT NULL CHECK (col IN (...)) — no CREATE TYPE. Easier
--   value adds and renames vs PG enum types (see migration 048's enum-rename
--   pain).
--
-- FK CONSTRAINT INTENTIONALLY OMITTED
--   sourced_prospects.candidate_id is UUID NULL with no REFERENCES clause.
--   The intended FK target is people(person_id); the constraint will be added
--   in a future migration when the linkage flow ships. See COMMENT ON COLUMN.
--
-- RLS
--   Supabase auto-enables RLS on every CREATE TABLE — even when the migration
--   includes DISABLE inline. Pattern hit on 034, 037, 039, 041, 053. The
--   inline DISABLE at the bottom of this migration is cosmetic; the real fix
--   is migration 066.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────
-- 1. scrape_targets — sources to scrape or CSV-import
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE scrape_targets (
  target_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source identity
  url                    TEXT,           -- NULL for CSV imports
  source_category        TEXT NOT NULL
                           CHECK (source_category IN (
                             'engineering_team',
                             'fellowship',
                             'hackathon_winners',
                             'competition',
                             'research_program',
                             'honor_society',
                             'incubator',
                             'accelerator_cohort'
                           )),
  source_name            TEXT NOT NULL,  -- e.g. "UCLA Bruin Formula Racing", "Thiel Fellowship"
  school_name            TEXT,           -- free-text; not FK'd to schools (pre-resolution layer)
  source_type            TEXT NOT NULL
                           CHECK (source_type IN (
                             'team_page',
                             'alumni_page',
                             'subteam_page',
                             'historical_year_page',
                             'github_org',
                             'leadership_page',
                             'winners_page',
                             'cohort_page',
                             'csv_import'
                           )),

  -- Cohort attribution
  cohort_label           TEXT,           -- e.g. "SR-17", "Mk 11", "2023 Class"
  cohort_year_override   SMALLINT,       -- manual override; otherwise inferred at extract time

  -- Scheduling
  rescrape_interval_days INTEGER NOT NULL DEFAULT 180,
  last_run_at            TIMESTAMPTZ,
  last_run_status        TEXT
                           CHECK (last_run_status IS NULL OR last_run_status IN (
                             'pending', 'success', 'partial', 'failed', 'needs_manual'
                           )),

  notes                  TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique on url, but only when url is NOT NULL (CSV imports legitimately have no URL).
CREATE UNIQUE INDEX idx_scrape_targets_url_unique
  ON scrape_targets (url)
  WHERE url IS NOT NULL;

-- Cron lookup: find targets due for rescrape, grouped by category.
CREATE INDEX idx_scrape_targets_category_last_run
  ON scrape_targets (source_category, last_run_at);

COMMENT ON TABLE scrape_targets IS
  'Sources to scrape or CSV-import for the sourcing pipeline. URL nullable for CSV imports. source_category aligned with scoring-side signal_dictionary categories where applicable, but a separate vocabulary (e.g. ''hackathon_winners'' here vs ''hackathon'' there).';

COMMENT ON COLUMN scrape_targets.school_name IS
  'Free-text school name. Not FK''d to schools(school_id) — sourcing pipeline runs pre-resolution; canonical school linkage happens downstream when prospects are promoted to people.';

COMMENT ON COLUMN scrape_targets.cohort_year_override IS
  'Manual override for cohort year. If NULL, the extractor infers cohort year from the page content. SMALLINT supports years 1900-32000.';

-- ────────────────────────────────────────────────────────────────────────
-- 2. scrape_runs — audit log per execution
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE scrape_runs (
  run_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id           UUID NOT NULL REFERENCES scrape_targets(target_id) ON DELETE CASCADE,

  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at         TIMESTAMPTZ,

  status              TEXT NOT NULL
                        CHECK (status IN ('success', 'partial', 'failed', 'needs_manual')),
  method              TEXT NOT NULL
                        CHECK (method IN ('firecrawl', 'github_api', 'manual_csv', 'ocr_fallback')),

  member_count        INTEGER NOT NULL DEFAULT 0,
  error_message       TEXT,
  raw_response_path   TEXT
);

-- Per-target run history (most recent first).
CREATE INDEX idx_scrape_runs_target_started
  ON scrape_runs (target_id, started_at DESC);

COMMENT ON TABLE scrape_runs IS
  'Audit log: one row per execution of a scrape_target. Both successful and failed runs land here. Cascade-deletes with parent target.';

COMMENT ON COLUMN scrape_runs.raw_response_path IS
  'Intended use: path to the raw scrape response stored in a Supabase Storage bucket. Bucket creation handled out of band in this repo; column stays NULL until phase 2 wires real storage.';

-- ────────────────────────────────────────────────────────────────────────
-- 3. scraped_members — raw extraction output before enrichment
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE scraped_members (
  member_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                     UUID REFERENCES scrape_runs(run_id) ON DELETE SET NULL,
  target_id                  UUID NOT NULL REFERENCES scrape_targets(target_id) ON DELETE CASCADE,

  -- Identity
  name                       TEXT NOT NULL,
  name_normalized            TEXT NOT NULL,  -- lowercase, trimmed, accent-stripped

  -- Context fields (any may be empty depending on the source page)
  role                       TEXT,           -- e.g. "Chassis Lead", "2023 Fellow", "1st Place", "Cohort Member"
  team_or_project_name       TEXT,           -- hackathon team, incubator company affiliation
  year_in_school             TEXT,           -- free-text: "Senior", "Class of 2026", "PhD Year 3"
  major                      TEXT,
  bio                        TEXT,
  email                      TEXT,
  photo_url                  TEXT,
  linkedin_url_from_source   TEXT,           -- only present if embedded on the source page
  github_handle_from_source  TEXT,
  source_url                 TEXT,           -- specific page URL this member was extracted from
  raw_data                   JSONB,          -- verbatim per-member extraction blob

  dedupe_key                 TEXT NOT NULL,  -- normalized_name + (school_name OR source_name); app-computed

  enrichment_status          TEXT NOT NULL DEFAULT 'pending'
                               CHECK (enrichment_status IN (
                                 'pending', 'found_url', 'enriched', 'no_url', 'manual_review'
                               )),

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scraped_members_dedupe_key       ON scraped_members (dedupe_key);
CREATE INDEX idx_scraped_members_enrichment       ON scraped_members (enrichment_status);
CREATE INDEX idx_scraped_members_target           ON scraped_members (target_id);

COMMENT ON TABLE scraped_members IS
  'Raw per-person extraction output from a scrape run (or CSV import). Pre-enrichment, pre-dedupe. One row per appearance — a person can show up multiple times across runs/targets and gets dedupe''d at the sourced_prospects layer.';

COMMENT ON COLUMN scraped_members.run_id IS
  'Nullable — CSV imports land directly with no associated scrape_run row. SET NULL on parent delete so historical scraped_members survive run-history pruning.';

COMMENT ON COLUMN scraped_members.dedupe_key IS
  'App-computed: name_normalized + ''|'' + (school_name when present else source_name). Used to collapse multiple appearances into a single sourced_prospects row.';

-- ────────────────────────────────────────────────────────────────────────
-- 4. linkedin_enrichment_queue — URL discovery + profile fetch queue
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE linkedin_enrichment_queue (
  queue_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_member_id   UUID NOT NULL REFERENCES scraped_members(member_id) ON DELETE CASCADE,

  linkedin_url        TEXT,           -- NULL until URL discovery succeeds
  url_confidence      TEXT
                        CHECK (url_confidence IS NULL OR url_confidence IN ('high', 'medium', 'low')),
  top_candidates      JSONB,          -- top 3 SerpAPI results for manual review of ambiguous matches

  provider            TEXT
                        CHECK (provider IS NULL OR provider IN ('extension', 'apify', 'manual')),

  status              TEXT NOT NULL DEFAULT 'pending_url'
                        CHECK (status IN (
                          'pending_url', 'pending_profile', 'enriched', 'failed', 'no_linkedin'
                        )),

  enriched_at         TIMESTAMPTZ,
  raw_profile         JSONB,          -- full LinkedIn profile JSON once fetched

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_linkedin_queue_status   ON linkedin_enrichment_queue (status);
CREATE INDEX idx_linkedin_queue_member   ON linkedin_enrichment_queue (scraped_member_id);

COMMENT ON TABLE linkedin_enrichment_queue IS
  'Per-member enrichment work queue. One row per scraped_member needing LinkedIn URL discovery and/or profile fetch. status drives the worker state machine: pending_url → (URL discovered) → pending_profile → (profile fetched) → enriched. Terminal states: failed, no_linkedin.';

COMMENT ON COLUMN linkedin_enrichment_queue.provider IS
  'Which enrichment provider claimed/handled this row. NULL until a worker picks it up. Enum mirrors lib provider interface to be built in phase 7 (extension / apify / manual).';

COMMENT ON COLUMN linkedin_enrichment_queue.top_candidates IS
  'When SerpAPI returns multiple plausible LinkedIn profiles, the top 3 are stored here as JSON for manual review (and to retry with different disambiguation hints).';

-- ────────────────────────────────────────────────────────────────────────
-- 5. sourced_prospects — final dedupe'd enriched output
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE sourced_prospects (
  prospect_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name                 TEXT NOT NULL,
  name_normalized      TEXT NOT NULL,
  school_name          TEXT,           -- free-text; resolved against schools(school_id) at promotion time

  -- Source attribution (latest / primary source — full history in memberships JSONB)
  source_category      TEXT NOT NULL
                         CHECK (source_category IN (
                           'engineering_team',
                           'fellowship',
                           'hackathon_winners',
                           'competition',
                           'research_program',
                           'honor_society',
                           'incubator',
                           'accelerator_cohort'
                         )),
  source_name          TEXT NOT NULL,
  role                 TEXT,
  cohort_year          SMALLINT,

  -- Enrichment output
  linkedin_url         TEXT,
  github_handle        TEXT,
  bio                  TEXT,
  source_urls          TEXT[] NOT NULL DEFAULT '{}',  -- every URL we've seen this person on
  memberships          JSONB  NOT NULL DEFAULT '[]'::jsonb,
                       -- array of { year, role, source_name, source_url, cohort_label }
  enriched_profile     JSONB,                          -- full LinkedIn profile JSON

  -- Downstream linkage (FK to people(person_id) will be added in a future migration)
  candidate_id         UUID,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-source dedupe — NULL school_name normalized via COALESCE so empty-school rows
-- still dedupe correctly. Same pattern as idx_signal_scoring_weights_unique (migration 050).
CREATE UNIQUE INDEX idx_sourced_prospects_dedupe
  ON sourced_prospects (name_normalized, COALESCE(school_name, '__no_school__'), source_name);

-- Has-a-LinkedIn-URL lookup (most queries care about enriched-with-URL prospects).
CREATE INDEX idx_sourced_prospects_linkedin_url
  ON sourced_prospects (linkedin_url)
  WHERE linkedin_url IS NOT NULL;

-- Promoted-to-candidate lookup.
CREATE INDEX idx_sourced_prospects_candidate_id
  ON sourced_prospects (candidate_id)
  WHERE candidate_id IS NOT NULL;

COMMENT ON TABLE sourced_prospects IS
  'Final dedupe''d, enriched output of the sourcing pipeline. One row per real person; multiple appearances collapsed via memberships JSONB. Promotion to the candidate DB sets candidate_id to the resulting people.person_id.';

COMMENT ON COLUMN sourced_prospects.candidate_id IS
  'Intended FK target: people(person_id). FK constraint NOT added in phase 1 — the linkage flow (and the conditions under which we promote a prospect to a candidate) is built in a later phase. When that ships, a follow-up migration will add: ALTER TABLE sourced_prospects ADD CONSTRAINT sourced_prospects_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES people(person_id) ON DELETE SET NULL.';

COMMENT ON COLUMN sourced_prospects.memberships IS
  'Full appearance history. Array of { year, role, source_name, source_url, cohort_label } — captures the fact that a person may show up on multiple team rosters / multiple cohort pages / multiple years.';

COMMENT ON COLUMN sourced_prospects.school_name IS
  'Free-text school name (matches scrape_targets.school_name). Canonical schools(school_id) resolution happens at candidate-promotion time, not at the prospect layer.';

-- ────────────────────────────────────────────────────────────────────────
-- RLS — inline DISABLE is cosmetic (Supabase re-enables); real DISABLE in 066
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE scrape_targets             DISABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_runs                DISABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_members            DISABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_enrichment_queue  DISABLE ROW LEVEL SECURITY;
ALTER TABLE sourced_prospects          DISABLE ROW LEVEL SECURITY;

COMMIT;
