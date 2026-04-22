-- Migration 013 — Add sub-industry columns for OR-logic filtering
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sub_industry_1 TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sub_industry_2 TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sub_industry_3 TEXT;

COMMENT ON COLUMN companies.sub_industry_1 IS 'Searchable sub-industry tag (e.g. Marketplace, Mobile, AI). OR-logic filtering.';
COMMENT ON COLUMN companies.sub_industry_2 IS 'Second sub-industry tag.';
COMMENT ON COLUMN companies.sub_industry_3 IS 'Third sub-industry tag.';
