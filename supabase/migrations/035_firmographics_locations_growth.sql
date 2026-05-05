-- 035_firmographics_locations_growth.sql
--
-- Phase 2 follow-up — capture richer firmographics from Crust enrich:
-- description, logo, locations (HQ + offices), founders, headcount growth %s
-- and timeseries.
--
-- Crust's enrich response shapes (verified empirically against the live API
-- on 2026-05-05):
--   basic_info.description          → string|null
--   basic_info.logo_permalink       → S3 URL
--   locations                       → { headquarters: string, all_office_addresses: string[] }
--   people.founders                 → array of {name, title, professional_network_url, ...}
--   headcount.growth_percent        → { mom, qoq, six_months, yoy, two_years }
--   headcount.timeseries            → [{ date, employee_count }, ...] (weekly)
--
-- Storage decisions:
--   - description: TEXT (free-form, Crust doesn't always populate)
--   - logo_permalink: TEXT (used by CompanyLogo as preferred source over logo.dev)
--   - locations: JSONB { headquarters: string|null, offices: string[] }
--                Normalized in code (strip the leading ", " Crust returns on offices)
--   - founders: JSONB array (raw shape from Crust)
--   - growth columns: NUMERIC(7,2) for percentage (allows -99.99 to 99,999.99)
--                     Three windows kept: 3m (qoq), 6m, 12m (yoy). Toggle in UI.
--   - timeseries: JSONB array of { date, count } for the headcount chart on
--                 the detail page (collapsible, optional rendering).

BEGIN;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS description              TEXT,
  ADD COLUMN IF NOT EXISTS logo_permalink           TEXT,
  ADD COLUMN IF NOT EXISTS locations                JSONB        NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS founders                 JSONB        NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS headcount_growth_3m_pct  NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS headcount_growth_6m_pct  NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS headcount_growth_12m_pct NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS headcount_timeseries     JSONB        NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN companies.description IS
  'Company elevator-pitch summary. From Crust basic_info.description. Rendered at the top of the detail page when present.';
COMMENT ON COLUMN companies.logo_permalink IS
  'Crust-hosted logo URL. Preferred source for CompanyLogo over logo.dev guess (correctly handles ambiguous names like Arc Boats vs the Arc investment fund).';
COMMENT ON COLUMN companies.locations IS
  'JSONB { headquarters: string|null, offices: string[] }. Offices array deduped against headquarters and stripped of Crust''s leading ", " formatting.';
COMMENT ON COLUMN companies.founders IS
  'JSONB array of founder objects from Crust people.founders. Empty when Crust has no founder data — many companies do.';
COMMENT ON COLUMN companies.headcount_growth_3m_pct IS
  'Headcount growth over the last 3 months (Crust qoq). Useful for spotting recent acceleration.';
COMMENT ON COLUMN companies.headcount_growth_6m_pct IS
  'Headcount growth over the last 6 months. Crust headcount.growth_percent.six_months.';
COMMENT ON COLUMN companies.headcount_growth_12m_pct IS
  'Headcount growth year-over-year. Crust headcount.growth_percent.yoy.';
COMMENT ON COLUMN companies.headcount_timeseries IS
  'JSONB array of { date: YYYY-MM-DD, count: integer }. Weekly snapshots from Crust headcount.timeseries. Used for the optional growth chart on the detail page.';

CREATE INDEX IF NOT EXISTS idx_companies_growth_3m
  ON companies (headcount_growth_3m_pct) WHERE headcount_growth_3m_pct IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_growth_6m
  ON companies (headcount_growth_6m_pct) WHERE headcount_growth_6m_pct IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_growth_12m
  ON companies (headcount_growth_12m_pct) WHERE headcount_growth_12m_pct IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_description_present
  ON companies ((description IS NOT NULL)) WHERE description IS NOT NULL;

COMMIT;
