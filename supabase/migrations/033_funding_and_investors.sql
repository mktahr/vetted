-- 033_funding_and_investors.sql
--
-- Phase 2 — capture company funding totals + per-round investor data from Crust.
--
-- WHAT CHANGES:
--   1. Add company-level funding scalars to `companies`:
--        total_funding_usd        — Crust's funding.total_investment_usd
--        last_funding_amount_usd  — Crust's funding.last_round_amount_usd
--        last_funding_date        — Crust's funding.last_fundraise_date
--        last_funding_round_type  — Crust's funding.last_round_type (raw string)
--   2. New table `company_funding_rounds` — one row per round per company.
--        Stores round_type, round_date, amount_usd, investors[], lead_investors[].
--        ON DELETE CASCADE with companies — deleting a company also clears its rounds.
--   3. GIN index on lead_investors for future "search by investor" filter.
--
-- The existing `funding_stage` column on `companies` (snake_case enum:
-- pre_seed/seed/series_a..k) stays for filtering. The new round_type column
-- on the rounds table preserves Crust's raw string ("Series A", "Venture Round",
-- "series_unknown", etc.) without forcing the enum.

BEGIN;

-- ─── STEP 1 — Add funding scalars to companies ─────────────────────────────

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS total_funding_usd        BIGINT,
  ADD COLUMN IF NOT EXISTS last_funding_amount_usd  BIGINT,
  ADD COLUMN IF NOT EXISTS last_funding_date        DATE,
  ADD COLUMN IF NOT EXISTS last_funding_round_type  TEXT;

COMMENT ON COLUMN companies.total_funding_usd IS
  'Sum of all rounds, in USD. From Crust funding.total_investment_usd. Pair with last_funding_date to gauge staleness.';
COMMENT ON COLUMN companies.last_funding_amount_usd IS
  'Most recent round amount, in USD. From Crust funding.last_round_amount_usd.';
COMMENT ON COLUMN companies.last_funding_date IS
  'Most recent round close date. From Crust funding.last_fundraise_date.';
COMMENT ON COLUMN companies.last_funding_round_type IS
  'Raw round-type string from Crust (e.g. "Series A", "Venture Round", "series_unknown"). Distinct from companies.funding_stage which is the snake_case enum used for filtering.';

CREATE INDEX IF NOT EXISTS idx_companies_total_funding ON companies (total_funding_usd) WHERE total_funding_usd IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_last_funding_date ON companies (last_funding_date) WHERE last_funding_date IS NOT NULL;

-- ─── STEP 2 — Create company_funding_rounds table ──────────────────────────

CREATE TABLE IF NOT EXISTS company_funding_rounds (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID         NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  round_type      TEXT,
  round_date      DATE,
  amount_usd      BIGINT,
  investors       TEXT[]       NOT NULL DEFAULT '{}',
  lead_investors  TEXT[]       NOT NULL DEFAULT '{}',
  source          TEXT         NOT NULL DEFAULT 'crust',
  fetched_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT company_funding_rounds_dedupe
    UNIQUE NULLS NOT DISTINCT (company_id, round_type, round_date, amount_usd)
);

COMMENT ON TABLE company_funding_rounds IS
  'One row per disclosed funding round. Populated from Crust funding.milestones[] on import + re-enrich. Deletes cascade with the parent company.';
COMMENT ON COLUMN company_funding_rounds.investors IS
  'All disclosed backers in this round.';
COMMENT ON COLUMN company_funding_rounds.lead_investors IS
  'Subset of investors that led this round. Empty array when Crust does not identify a lead.';

CREATE INDEX IF NOT EXISTS idx_funding_rounds_company ON company_funding_rounds (company_id);
CREATE INDEX IF NOT EXISTS idx_funding_rounds_lead_investors ON company_funding_rounds USING GIN (lead_investors);
CREATE INDEX IF NOT EXISTS idx_funding_rounds_investors ON company_funding_rounds USING GIN (investors);
CREATE INDEX IF NOT EXISTS idx_funding_rounds_date ON company_funding_rounds (round_date) WHERE round_date IS NOT NULL;

COMMIT;
