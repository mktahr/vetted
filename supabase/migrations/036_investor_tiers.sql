-- 036_investor_tiers.sql
--
-- Investor tier table. Used to (a) highlight notable investors on the
-- company detail page and (b) filter the companies list by "has tier 1
-- investor".
--
-- Tier mapping (from Matt's curated CSV, 2026-05-05):
--   - CSV tier 0 + tier 1 → DB tier 1 (top-tier: Sequoia, a16z, Founders
--                                       Fund, Benchmark, Accel, KP, GC, …)
--   - CSV tier 2          → DB tier 2 (strong: YC, Battery, Insight, Pear
--                                       VC, GV, …)
--
-- Two cleanups applied to the seed:
--   - "Cotue" → "Coatue" (typo)
--   - "Patrick OâShaughnessy" → "Patrick O'Shaughnessy" (mojibake)
--
-- Investor names are matched against the `investors[]` arrays in
-- company_funding_rounds. Names below are normalized to Crust's canonical
-- form when known (e.g. "Andreessen Horowitz" not "Andreessen Horowitz
-- (a16z)") so the match works without aliasing.
--
-- Tier 3+ available in the schema for future use (not seeded).

BEGIN;

CREATE TABLE IF NOT EXISTS investor_tiers (
  investor_name  TEXT         PRIMARY KEY,
  tier           SMALLINT     NOT NULL CHECK (tier BETWEEN 1 AND 4),
  kind           TEXT         CHECK (kind IS NULL OR kind IN ('firm', 'angel')),
  notes          TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE investor_tiers DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_investor_tiers_tier ON investor_tiers (tier);

COMMENT ON TABLE investor_tiers IS
  'Curated tier-1/tier-2 investor list. Joined client-side against company_funding_rounds.investors[] to compute "company has tier-N investor" filters and the Notable Investors callout on the detail page.';

-- ─── Seed: Tier 1 firms ────────────────────────────────────────────────────

INSERT INTO investor_tiers (investor_name, tier, kind) VALUES
  ('Sequoia Capital',              1, 'firm'),
  ('Andreessen Horowitz',          1, 'firm'),
  ('Benchmark',                    1, 'firm'),
  ('Accel',                        1, 'firm'),
  ('Founders Fund',                1, 'firm'),
  ('Greylock',                     1, 'firm'),
  ('Khosla Ventures',              1, 'firm'),
  ('Lightspeed Venture Partners',  1, 'firm'),
  ('Index Ventures',               1, 'firm'),
  ('General Catalyst',             1, 'firm'),
  ('Kleiner Perkins',              1, 'firm'),
  ('Bessemer Venture Partners',    1, 'firm'),
  ('Union Square Ventures',        1, 'firm'),
  ('First Round Capital',          1, 'firm'),
  ('Redpoint Ventures',            1, 'firm'),
  ('Tiger Global',                 1, 'firm'),
  ('Spark Capital',                1, 'firm'),
  ('Thrive Capital',               1, 'firm'),
  ('Lux Capital',                  1, 'firm'),
  ('ARCH Venture Partners',        1, 'firm'),
  ('Flagship Pioneering',          1, 'firm'),
  ('Felicis Ventures',             1, 'firm'),
  ('Forerunner Ventures',          1, 'firm'),
  ('Coatue',                       1, 'firm')
ON CONFLICT (investor_name) DO NOTHING;

-- ─── Seed: Tier 1 angels ───────────────────────────────────────────────────

INSERT INTO investor_tiers (investor_name, tier, kind) VALUES
  ('Elad Gil',                       1, 'angel'),
  ('Naval Ravikant',                 1, 'angel'),
  ('Fabrice Grinda',                 1, 'angel'),
  ('Mark Cuban',                     1, 'angel'),
  ('Gokul Rajaram',                  1, 'angel'),
  ('Lachy Groom',                    1, 'angel'),
  ('Patrick O''Shaughnessy',         1, 'angel'),
  ('Shervin Pishevar',               1, 'angel'),
  ('Esther Dyson',                   1, 'angel'),
  ('Balaji Srinivasan',              1, 'angel'),
  ('Jason Calacanis',                1, 'angel'),
  ('Ryan Hoover',                    1, 'angel'),
  ('Andrew Chen',                    1, 'angel'),
  ('Arash Ferdowsi',                 1, 'angel'),
  ('John Lilly',                     1, 'angel'),
  ('Nat Friedman',                   1, 'angel'),
  ('Amjad Masad',                    1, 'angel'),
  ('Guillermo Rauch',                1, 'angel'),
  ('Dylan Field',                    1, 'angel')
ON CONFLICT (investor_name) DO NOTHING;

-- ─── Seed: Tier 2 firms ────────────────────────────────────────────────────

INSERT INTO investor_tiers (investor_name, tier, kind) VALUES
  ('Human Capital',                2, 'firm'),
  ('Y Combinator',                 2, 'firm'),
  ('Initialized Capital',          2, 'firm'),
  ('Menlo Ventures',               2, 'firm'),
  ('Battery Ventures',             2, 'firm'),
  ('CRV',                          2, 'firm'),
  ('Insight Partners',             2, 'firm'),
  ('Craft Ventures',               2, 'firm'),
  ('Ribbit Capital',               2, 'firm'),
  ('Pear VC',                      2, 'firm'),
  ('Amplify Partners',             2, 'firm'),
  ('DCVC',                         2, 'firm'),
  ('GV',                           2, 'firm'),
  ('Altos Ventures',               2, 'firm'),
  ('Bain Capital Ventures',        2, 'firm'),
  ('Atlas Venture',                2, 'firm'),
  ('Meritech Capital',             2, 'firm'),
  ('Foundation Capital',           2, 'firm'),
  ('Emergence Capital',            2, 'firm'),
  ('True Ventures',                2, 'firm')
ON CONFLICT (investor_name) DO NOTHING;

COMMIT;
