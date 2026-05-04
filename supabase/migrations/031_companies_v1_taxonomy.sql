-- 031_companies_v1_taxonomy.sql
--
-- Vetted Companies V1 — schema migration per docs/vetted-companies-v1/01-field-inventory.md
-- (round-2 amendments authoritative; supersedes round-1 SQL drafts in lower sections).
--
-- WHAT CHANGES:
--   1. Rename `focus` (company_focus_type enum) → `category` (TEXT, nullable, CHECK).
--      Value migration: hard_tech→hardware, all_tech→non_hardware, unreviewed→NULL.
--      The 'unreviewed' workflow state moves to `review_status`.
--   2. Add `primary_industry` TEXT + `industries` TEXT[] (Option B multi-industry).
--   3. Add `domain_tags` TEXT[] (multi-select tags within category).
--   4. Add `crustdata_company_id` BIGINT UNIQUE + `professional_network_id` TEXT.
--   5. Add `company_type` TEXT (no CHECK in this migration; final enum after Investigation 2).
--   6. Add `tagging_method`/`tagging_confidence`/`tagging_notes` for tagger provenance.
--   7. Add `headcount_latest` INTEGER + `headcount_latest_at` TIMESTAMPTZ.
--   8. Add `review_status` TEXT (vetted/unreviewed/excluded).
--      Migration: manual_review_status reviewed/locked → vetted, unreviewed → unreviewed.
--   9. Drop `manual_review_status` column + enum.
--   10. Rename legacy taxonomy: primary_industry_tag → legacy_*; sub_industry_1/2/3 → legacy_*.
--   11. CHECK constraints + GIN indexes per inventory.
--
-- DOES NOT CHANGE: existing data on legacy columns is preserved (renamed only).
-- Bulk backfill of new taxonomy fields is NOT performed — existing companies stay
-- category=NULL (per inventory: "Matt is NOT bulk-backfilling existing 1,500 companies").
--
-- Pre-migration audit (2026-05-04):
--   1000 companies (96 reviewed, 904 unreviewed, 0 locked)
--   83 candidates (63 at unreviewed companies)
-- Per Matt's Option C decision: recruiter-side review_status filter ships
-- with default = SHOW ALL. Migration runs per inventory; UI default is unrestricted.

BEGIN;

-- ─── STEP 1 — Add new columns ─────────────────────────────────────────────

-- Identity additions (per resolved issue #8)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS crustdata_company_id BIGINT,
  ADD COLUMN IF NOT EXISTS professional_network_id TEXT;

-- Taxonomy: Option B multi-industry
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS primary_industry TEXT,
  ADD COLUMN IF NOT EXISTS industries TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS domain_tags TEXT[] NOT NULL DEFAULT '{}';

-- Firmographics
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS company_type TEXT,
  ADD COLUMN IF NOT EXISTS headcount_latest INTEGER,
  ADD COLUMN IF NOT EXISTS headcount_latest_at TIMESTAMPTZ;

-- Tagging metadata
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS tagging_method TEXT,
  ADD COLUMN IF NOT EXISTS tagging_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS tagging_notes TEXT;

-- Review status (replaces manual_review_status)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS review_status TEXT;

-- ─── STEP 2 — Migrate data from legacy columns ────────────────────────────

-- focus → category mapping: hard_tech→hardware, all_tech→non_hardware, unreviewed→NULL
UPDATE companies SET category =
  CASE focus::text
    WHEN 'hard_tech'  THEN 'hardware'
    WHEN 'all_tech'   THEN 'non_hardware'
    WHEN 'unreviewed' THEN NULL
    ELSE NULL
  END
WHERE category IS NULL;

-- manual_review_status → review_status mapping per inventory
UPDATE companies SET review_status =
  CASE manual_review_status::text
    WHEN 'reviewed'   THEN 'vetted'
    WHEN 'locked'     THEN 'vetted'
    WHEN 'unreviewed' THEN 'unreviewed'
    ELSE 'unreviewed'
  END
WHERE review_status IS NULL;

-- review_status NOT NULL + DEFAULT after backfill
ALTER TABLE companies ALTER COLUMN review_status SET NOT NULL;
ALTER TABLE companies ALTER COLUMN review_status SET DEFAULT 'unreviewed';

-- ─── STEP 3 — CHECK constraints (per round-2 amendments / taxonomy.ts) ─────

-- category enum: hardware/non_hardware OR NULL
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_category_check;
ALTER TABLE companies
  ADD CONSTRAINT companies_category_check
  CHECK (category IS NULL OR category IN ('hardware', 'non_hardware'));

-- review_status enum
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_review_status_check;
ALTER TABLE companies
  ADD CONSTRAINT companies_review_status_check
  CHECK (review_status IN ('vetted', 'unreviewed', 'excluded'));

-- primary_industry must be in industries[]
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_primary_industry_in_industries_check;
ALTER TABLE companies
  ADD CONSTRAINT companies_primary_industry_in_industries_check
  CHECK (
    primary_industry IS NULL
    OR primary_industry = ANY(industries)
  );

-- industries[] subset check by category
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_industries_subset_check;
ALTER TABLE companies
  ADD CONSTRAINT companies_industries_subset_check
  CHECK (
    CASE
      WHEN category = 'hardware' THEN industries <@ ARRAY[
        'Defense','Aerospace','Automotive','Robotics','Medical Devices',
        'Biotech','Energy','Energy Storage','Climate','Semiconductors',
        'Consumer Electronics','Industrial Manufacturing','Materials',
        'Maritime','Other Hardware'
      ]::text[]
      WHEN category = 'non_hardware' THEN industries <@ ARRAY[
        'SaaS','AI','FinTech','Investment Banking','Quant/Trading',
        'Blockchain & Web3','Consumer Tech','HealthTech','Biotech',
        'Services','Legal','Defense','Aerospace'
      ]::text[]
      ELSE industries = ARRAY[]::text[]   -- NULL category → empty industries
    END
  );

-- domain_tags subset check by category
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_domain_tags_check;
ALTER TABLE companies
  ADD CONSTRAINT companies_domain_tags_check
  CHECK (
    CASE
      WHEN category = 'hardware' THEN domain_tags <@ ARRAY[
        'Rockets','Satellites','Drones','eVTOL','Autonomous Driving',
        'Automotive Manufacturing','EVs','Nuclear','AI'
      ]::text[]
      WHEN category = 'non_hardware' THEN domain_tags <@ ARRAY[
        'Consumer','Infrastructure','Mobile','Cybersecurity','DevTools',
        'B2B','Data','Payments','Productivity','HR','Gaming','Social',
        'Streaming','Marketplace','Analytics','Enterprise Software','AI'
      ]::text[]
      ELSE domain_tags = ARRAY[]::text[]   -- NULL category → empty domain_tags
    END
  );

-- tagging_method enum (round-2 architecture)
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_tagging_method_check;
ALTER TABLE companies
  ADD CONSTRAINT companies_tagging_method_check
  CHECK (tagging_method IS NULL OR tagging_method IN (
    'claude', 'claude_dict_agree', 'claude_dict_disagree', 'manual'
  ));

-- tagging_confidence: 0..1
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_tagging_confidence_check;
ALTER TABLE companies
  ADD CONSTRAINT companies_tagging_confidence_check
  CHECK (tagging_confidence IS NULL OR (tagging_confidence >= 0 AND tagging_confidence <= 1));

-- crustdata_company_id UNIQUE (resolved issue #8)
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_crustdata_company_id_unique;
ALTER TABLE companies
  ADD CONSTRAINT companies_crustdata_company_id_unique
  UNIQUE (crustdata_company_id);

-- headcount_range CHECK (column existed in 019, no constraint applied yet)
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_headcount_range_check;
ALTER TABLE companies
  ADD CONSTRAINT companies_headcount_range_check
  CHECK (headcount_range IS NULL OR headcount_range IN (
    '1-10','11-50','51-200','201-500',
    '501-1000','1001-5000','5001-10000','10000+'
  ));

-- funding_stage CHECK (column existed in 019, no constraint applied yet)
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_funding_stage_check;
ALTER TABLE companies
  ADD CONSTRAINT companies_funding_stage_check
  CHECK (funding_stage IS NULL OR funding_stage IN (
    'pre_seed','seed',
    'series_a','series_b','series_c','series_d','series_e',
    'series_f','series_g','series_h','series_i','series_j','series_k'
  ));

-- ─── STEP 4 — Indexes ──────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_companies_category ON companies (category);
CREATE INDEX IF NOT EXISTS idx_companies_review_status ON companies (review_status);
CREATE INDEX IF NOT EXISTS idx_companies_primary_industry ON companies (primary_industry) WHERE primary_industry IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_industries ON companies USING GIN (industries);
CREATE INDEX IF NOT EXISTS idx_companies_domain_tags ON companies USING GIN (domain_tags);
CREATE INDEX IF NOT EXISTS idx_companies_crustdata_id ON companies (crustdata_company_id) WHERE crustdata_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_tagging_method ON companies (tagging_method);
CREATE INDEX IF NOT EXISTS idx_companies_tagging_confidence ON companies (tagging_confidence) WHERE tagging_confidence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_headcount_latest ON companies (headcount_latest) WHERE headcount_latest IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_funding_stage ON companies (funding_stage) WHERE funding_stage IS NOT NULL;

-- ─── STEP 5 — Rename legacy taxonomy columns ───────────────────────────────

ALTER TABLE companies RENAME COLUMN primary_industry_tag TO legacy_primary_industry_tag;
ALTER TABLE companies RENAME COLUMN sub_industry_1       TO legacy_sub_industry_1;
ALTER TABLE companies RENAME COLUMN sub_industry_2       TO legacy_sub_industry_2;
ALTER TABLE companies RENAME COLUMN sub_industry_3       TO legacy_sub_industry_3;

COMMENT ON COLUMN companies.legacy_primary_industry_tag IS
  'DEPRECATED in V1 — superseded by primary_industry. Read-only after V1 migration. To be dropped once admin has reviewed all rows.';
COMMENT ON COLUMN companies.legacy_sub_industry_1 IS
  'DEPRECATED in V1 — superseded by industries[] + domain_tags. Read-only.';
COMMENT ON COLUMN companies.legacy_sub_industry_2 IS
  'DEPRECATED in V1 — superseded by industries[] + domain_tags. Read-only.';
COMMENT ON COLUMN companies.legacy_sub_industry_3 IS
  'DEPRECATED in V1 — superseded by industries[] + domain_tags. Read-only.';

-- ─── STEP 6 — Drop legacy focus column + enum ──────────────────────────────

DROP INDEX IF EXISTS idx_companies_focus;
ALTER TABLE companies DROP COLUMN focus;
DROP TYPE IF EXISTS company_focus_type;

-- ─── STEP 7 — Drop manual_review_status column + enum ─────────────────────

ALTER TABLE companies DROP COLUMN manual_review_status;
DROP TYPE IF EXISTS manual_review_status_type;

-- ─── STEP 8 — Column comments ──────────────────────────────────────────────

COMMENT ON COLUMN companies.category IS
  'V1 taxonomy: hardware/non_hardware OR NULL when tagger could not classify. NULL category requires NULL primary_industry and empty industries[]/domain_tags[]. Replaces legacy company_focus_type enum.';
COMMENT ON COLUMN companies.primary_industry IS
  'Primary industry within the chosen category. Must be a member of industries[] (CHECK constraint). NULL when category is NULL.';
COMMENT ON COLUMN companies.industries IS
  'Multi-industry array (Option B). Includes primary_industry as first element by convention. Subset check enforces values match the chosen category. Empty array when category is NULL.';
COMMENT ON COLUMN companies.domain_tags IS
  'Multi-select tags within category (e.g. EVs, Drones, B2B, Cybersecurity). Subset check enforces values match the chosen category. AI tag suppressed when primary_industry=AI.';
COMMENT ON COLUMN companies.review_status IS
  '3-state admin workflow status. vetted = admin-approved for recruiter visibility. unreviewed = needs admin attention (default for auto-creates). excluded = exclude from talent pool (visual treatment + filter). Replaces manual_review_status.';
COMMENT ON COLUMN companies.crustdata_company_id IS
  'Crust canonical company id (BIGINT). UNIQUE. Primary disambiguation key per resolved issue #8 — beats linkedin_url which beats name fallback.';
COMMENT ON COLUMN companies.professional_network_id IS
  'LinkedIn internal numeric company id (string in Crust). Secondary identity key for rebrand resilience.';
COMMENT ON COLUMN companies.tagging_method IS
  'How (category, primary_industry, industries[], domain_tags) were set. claude / claude_dict_agree / claude_dict_disagree / manual. NULL = not yet tagged (cron picks up).';
COMMENT ON COLUMN companies.tagging_confidence IS
  'Tagger output confidence, 0..1. Drives triage queue prioritization (rows < 0.7 surface for admin review). Lowered on Claude/dict disagreement.';
COMMENT ON COLUMN companies.tagging_notes IS
  'Tagger reasoning + (when method=claude_dict_disagree) JSON capture of both verdicts for admin triage UI.';
COMMENT ON COLUMN companies.headcount_latest IS
  'Latest precise headcount integer from Crust enrich (basic_info / headcount.total). Pair with headcount_latest_at for staleness.';
COMMENT ON COLUMN companies.headcount_latest_at IS
  'When headcount_latest was set. Drives the >90d "stale" badge on detail page.';
COMMENT ON COLUMN companies.company_type IS
  'Normalized lowercase form of basic_info.company_type (private/public/subsidiary/partnership/...). CHECK constraint added in a follow-up migration after Investigation 2 enumerates the value set.';

COMMIT;
