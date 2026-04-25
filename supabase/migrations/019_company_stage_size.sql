-- Migration 019 — Add funding_stage and headcount_range to companies
--
-- Infrastructure for upcoming Crust Data company enrichment.
-- Both columns are nullable text — values will be populated by
-- enrichment pipelines or manual entry via admin UI.

ALTER TABLE companies ADD COLUMN IF NOT EXISTS funding_stage TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS headcount_range TEXT;

COMMENT ON COLUMN companies.funding_stage IS
  'Funding stage. Canonical values: Pre-Seed, Seed, Series A, Series B, Series C, Series D, Series E, Series F, Series G, Series H, Public, Acquired, Bootstrapped, Unknown.';

COMMENT ON COLUMN companies.headcount_range IS
  'Employee headcount range. Canonical values: 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+.';
