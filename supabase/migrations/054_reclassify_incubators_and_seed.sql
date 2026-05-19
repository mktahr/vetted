-- 054_reclassify_incubators_and_seed.sql
--
-- Two related changes:
--   A. Reclassify 7 existing fellowship rows to category='incubator' (per
--      user decision: YC, EF, Antler, CDL, SPC, Pioneer, On Deck are
--      accelerators, not fellowships).
--   B. Seed ~38 new incubator rows from the curated list.
--
-- EXCEPTIONS (stay as fellowship):
--   - Neo Scholars (college student program, not accelerator)
--   - Z Fellows (weekend program)
--   - Greylock Edge (community, not accelerator)
--
-- TIER ADJUSTMENTS during reclassification (some existing rows had old
-- tier_groups that don't match the new spec):
--   - SPC: tier_2 → tier_3 (elite per new spec)
--   - Antler: tier_1 → tier_2 (top hubs per new spec)
--   - YC, EF: stay tier_3
--   - CDL, Pioneer: stay tier_2
--   - On Deck: stays tier_1
--
-- PERSON_SIGNALS IMPACT:
--   The reclassification UPDATEs signal_dictionary.category but the row's
--   signal_id stays the same. Any person_signals rows pointing at these 7
--   entries continue to point at the same signal_id — they just now show
--   up under category='incubator' instead of 'fellowship' in the
--   person_signals_active view. Non-destructive.

BEGIN;

-- ─── A. Reclassify the 7 existing rows ────────────────────────────────

-- Pre-flight: log how many person_signals rows currently point at the 7
-- to-be-reclassified entries. Transparency only — no data change.
DO $$
DECLARE
  ps_count INT;
BEGIN
  SELECT count(*) INTO ps_count
  FROM person_signals ps
  JOIN signal_dictionary sd ON sd.id = ps.signal_id
  WHERE sd.canonical_name IN (
    'Y Combinator', 'Entrepreneur First', 'Antler',
    'CDL', 'South Park Commons', 'Pioneer', 'On Deck'
  )
    AND sd.category = 'fellowship';

  RAISE NOTICE 'Migration 054 pre-flight: % person_signals rows currently point at the 7 fellowship→incubator reclassification targets. UPDATE is non-destructive (signal_id unchanged).', ps_count;
END $$;

-- Reclassify: category fellowship→incubator, subcategory NULL, tier adjustments
UPDATE signal_dictionary
SET category    = 'incubator',
    subcategory = NULL,
    tier_group  = CASE canonical_name
                    WHEN 'Y Combinator'        THEN 'tier_3'
                    WHEN 'Entrepreneur First'  THEN 'tier_3'
                    WHEN 'South Park Commons'  THEN 'tier_3'  -- elevated from tier_2
                    WHEN 'CDL'                 THEN 'tier_2'
                    WHEN 'Pioneer'             THEN 'tier_2'
                    WHEN 'Antler'              THEN 'tier_2'  -- elevated from tier_1
                    WHEN 'On Deck'             THEN 'tier_1'
                    ELSE tier_group
                  END,
    updated_at  = NOW()
WHERE canonical_name IN (
  'Y Combinator', 'Entrepreneur First', 'Antler',
  'CDL', 'South Park Commons', 'Pioneer', 'On Deck'
)
  AND category = 'fellowship';

-- Verify reclassification count
DO $$
DECLARE
  reclassified INT;
BEGIN
  SELECT count(*) INTO reclassified
  FROM signal_dictionary
  WHERE category = 'incubator'
    AND canonical_name IN (
      'Y Combinator', 'Entrepreneur First', 'Antler',
      'CDL', 'South Park Commons', 'Pioneer', 'On Deck'
    );
  IF reclassified != 7 THEN
    RAISE EXCEPTION 'Migration 054 A: expected 7 rows reclassified to incubator, got %. A canonical_name typo or missing fellowship row is the likely cause.', reclassified;
  END IF;
  RAISE NOTICE 'Migration 054 A: 7 rows reclassified fellowship → incubator (verified).';
END $$;

-- ─── B. Seed new incubator rows ───────────────────────────────────────

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES
  -- TIER 3 (elite accelerators) — 9 NEW
  ('Techstars',           'incubator', NULL, 'tier_3', ARRAY['techstars','techstars accelerator'], ARRAY['activities_honors','experience_description','education_description'], 'https://techstars.com', 'Top global accelerator network; multi-vertical, multi-geography', TRUE, TRUE),
  ('Neo Accelerator',     'incubator', NULL, 'tier_3', ARRAY['neo','neo accelerator','neo cohort','ali partovi neo'], ARRAY['activities_honors','experience_description','education_description'], 'https://neo.com', 'Ali Partovi accelerator for elite engineers — distinct from Neo Scholars (college program; stays fellowship)', TRUE, TRUE),
  ('HF0',                 'incubator', NULL, 'tier_3', ARRAY['hf0','hf zero','h f zero','hf0 residency'], ARRAY['activities_honors','experience_description','education_description'], 'https://hf0.com', 'Hacker Fellowship Zero — elite founder residency in SF', TRUE, TRUE),
  ('AI Grant',            'incubator', NULL, 'tier_3', ARRAY['ai grant','nat friedman ai grant','daniel gross ai grant'], ARRAY['activities_honors','experience_description','education_description'], 'https://aigrant.com', 'Nat Friedman + Daniel Gross AI grant program', TRUE, TRUE),
  ('HAX',                 'incubator', NULL, 'tier_3', ARRAY['hax','hax accelerator','sosv hax','hax hardware'], ARRAY['activities_honors','experience_description','education_description'], 'https://hax.co', 'SOSV hardware accelerator; top deep-tech program', TRUE, TRUE),
  ('The Engine',          'incubator', NULL, 'tier_3', ARRAY['the engine','the engine mit','engine ventures'], ARRAY['activities_honors','experience_description','education_description'], 'https://engine.xyz', 'MIT-affiliated tough-tech accelerator/VC', TRUE, TRUE),
  ('Stanford StartX',     'incubator', NULL, 'tier_3', ARRAY['startx','stanford startx'], ARRAY['activities_honors','experience_description','education_description'], 'https://startx.com', 'Stanford-affiliated nonprofit accelerator', TRUE, TRUE),
  ('MIT delta v',         'incubator', NULL, 'tier_3', ARRAY['mit delta v','mit delta-v','delta v accelerator'], ARRAY['activities_honors','experience_description','education_description'], 'https://entrepreneurship.mit.edu/accelerator', 'MIT student venture accelerator', TRUE, TRUE),
  ('Berkeley SkyDeck',    'incubator', NULL, 'tier_3', ARRAY['berkeley skydeck','skydeck','uc berkeley skydeck'], ARRAY['activities_honors','experience_description','education_description'], 'https://skydeck.berkeley.edu', 'UC Berkeley flagship accelerator', TRUE, TRUE),

  -- TIER 2 (strong accelerators) — 17 NEW
  ('500 Global',          'incubator', NULL, 'tier_2', ARRAY['500 global','500 startups','500 accelerator'], ARRAY['activities_honors','experience_description','education_description'], 'https://500.co', '500 Global (formerly 500 Startups) — broad early-stage accelerator', TRUE, TRUE),
  ('AngelPad',            'incubator', NULL, 'tier_2', ARRAY['angelpad','angel pad'], ARRAY['activities_honors','experience_description','education_description'], 'https://angelpad.org', 'Selective NYC/SF early-stage accelerator', TRUE, TRUE),
  ('Alchemist Accelerator','incubator', NULL, 'tier_2', ARRAY['alchemist','alchemist accelerator'], ARRAY['activities_honors','experience_description','education_description'], 'https://alchemistaccelerator.com', 'Enterprise B2B accelerator', TRUE, TRUE),
  ('IndieBio',            'incubator', NULL, 'tier_2', ARRAY['indiebio','indie bio','sosv indiebio'], ARRAY['activities_honors','experience_description','education_description'], 'https://indiebio.co', 'SOSV biotech accelerator', TRUE, TRUE),
  ('Orbital',             'incubator', NULL, 'tier_2', ARRAY['orbital','sosv orbital','hax orbital'], ARRAY['activities_honors','experience_description','education_description'], 'https://orbital.so', 'SOSV space/orbital accelerator', TRUE, TRUE),
  ('Boost VC',            'incubator', NULL, 'tier_2', ARRAY['boost vc','boost ventures','boost accelerator'], ARRAY['activities_honors','experience_description','education_description'], 'https://boost.vc', 'Frontier tech accelerator', TRUE, TRUE),
  ('Mucker Capital',      'incubator', NULL, 'tier_2', ARRAY['mucker','mucker capital','mucker accelerator'], ARRAY['activities_honors','experience_description','education_description'], 'https://mucker.com', 'LA-based early-stage accelerator', TRUE, TRUE),
  ('Forum Ventures',      'incubator', NULL, 'tier_2', ARRAY['forum ventures','forum accelerator'], ARRAY['activities_honors','experience_description','education_description'], 'https://forumvc.com', 'B2B SaaS accelerator', TRUE, TRUE),
  ('Cantos',              'incubator', NULL, 'tier_2', ARRAY['cantos','cantos ventures'], ARRAY['activities_honors','experience_description','education_description'], 'https://cantos.vc', 'Deep tech early-stage program', TRUE, TRUE),
  ('Conviction',          'incubator', NULL, 'tier_2', ARRAY['conviction','conviction ai','sarah guo conviction'], ARRAY['activities_honors','experience_description','education_description'], 'https://conviction.com', 'Sarah Guo AI-focused early-stage program', TRUE, TRUE),
  ('FF Accelerator',      'incubator', NULL, 'tier_2', ARRAY['ff accelerator','founders fund accelerator'], ARRAY['activities_honors','experience_description','education_description'], 'https://foundersfund.com', 'Founders Fund accelerator program', TRUE, TRUE),
  ('Nvidia Inception',    'incubator', NULL, 'tier_2', ARRAY['nvidia inception','inception program'], ARRAY['activities_honors','experience_description','education_description'], 'https://nvidia.com/inception', 'Nvidia program for AI/deep-learning startups', TRUE, TRUE),
  ('Google for Startups Accelerator','incubator', NULL, 'tier_2', ARRAY['google for startups','google accelerator','google startups accelerator'], ARRAY['activities_honors','experience_description','education_description'], 'https://startup.google.com', 'Google accelerator with vertical-specific tracks', TRUE, TRUE),
  ('M12 Programs',        'incubator', NULL, 'tier_2', ARRAY['m12','microsoft m12','m12 ventures'], ARRAY['activities_honors','experience_description','education_description'], 'https://m12.vc', 'Microsoft venture programs', TRUE, TRUE),
  ('Sequoia Spark',       'incubator', NULL, 'tier_2', ARRAY['sequoia spark','spark sequoia'], ARRAY['activities_honors','experience_description','education_description'], 'https://sequoiacap.com', 'Sequoia early-stage female founder program', TRUE, TRUE),
  ('Pear Garage',         'incubator', NULL, 'tier_2', ARRAY['pear garage','pear vc garage'], ARRAY['activities_honors','experience_description','education_description'], 'https://pear.vc', 'Pear VC early-stage builder community', TRUE, TRUE),
  ('Bessemer Atlas',      'incubator', NULL, 'tier_2', ARRAY['bessemer atlas','atlas bessemer'], ARRAY['activities_honors','experience_description','education_description'], 'https://bvp.com', 'Bessemer Venture Partners founder fellowship', TRUE, TRUE),

  -- TIER 1 (standard accelerators) — 6 NEW
  ('Founder Institute',   'incubator', NULL, 'tier_1', ARRAY['founder institute','fi accelerator'], ARRAY['activities_honors','experience_description','education_description'], 'https://fi.co', 'Global pre-seed accelerator', TRUE, TRUE),
  ('MassChallenge',       'incubator', NULL, 'tier_1', ARRAY['masschallenge','mass challenge'], ARRAY['activities_honors','experience_description','education_description'], 'https://masschallenge.org', 'Boston-based zero-equity accelerator', TRUE, TRUE),
  ('gener8tor',           'incubator', NULL, 'tier_1', ARRAY['gener8tor','generator accelerator','gener8tor accelerator'], ARRAY['activities_honors','experience_description','education_description'], 'https://gener8tor.com', 'Mid-tier US accelerator network', TRUE, TRUE),
  ('Plug and Play',       'incubator', NULL, 'tier_1', ARRAY['plug and play','pnp accelerator','plug and play tech center'], ARRAY['activities_honors','experience_description','education_description'], 'https://plugandplaytechcenter.com', 'Corporate-partnered accelerator network', TRUE, TRUE),
  ('Capital Factory',     'incubator', NULL, 'tier_1', ARRAY['capital factory','capital factory austin'], ARRAY['activities_honors','experience_description','education_description'], 'https://capitalfactory.com', 'Austin-based accelerator', TRUE, TRUE),
  ('Long Journey Ventures','incubator', NULL, 'tier_1', ARRAY['long journey','long journey ventures'], ARRAY['activities_honors','experience_description','education_description'], 'https://longjourney.vc', 'Early-stage program', TRUE, TRUE),

  -- DEFENSE / DUAL-USE — 6 NEW (tier_2 default, defense pipeline signal)
  ('Shield Capital',          'incubator', 'defense', 'tier_2', ARRAY['shield capital','shield ventures'], ARRAY['activities_honors','experience_description','education_description'], 'https://shieldcap.com', 'Defense + national security VC and programs', TRUE, TRUE),
  ('America''s Frontier Fund','incubator', 'defense', 'tier_2', ARRAY['americas frontier fund','america''s frontier fund','frontier fund'], ARRAY['activities_honors','experience_description','education_description'], 'https://americasfrontierfund.org', 'Defense-relevant deep tech fund/program', TRUE, TRUE),
  ('In-Q-Tel',                'incubator', 'defense', 'tier_2', ARRAY['iqt','in-q-tel','in q tel'], ARRAY['activities_honors','experience_description','education_description'], 'https://iqt.org', 'CIA-backed strategic investment program', TRUE, TRUE),
  ('AFWERX',                  'incubator', 'defense', 'tier_2', ARRAY['afwerx','air force afwerx'], ARRAY['activities_honors','experience_description','education_description'], 'https://afwerx.com', 'US Air Force innovation accelerator', TRUE, TRUE),
  ('NavalX',                  'incubator', 'defense', 'tier_2', ARRAY['navalx','naval x','navalx tech bridge'], ARRAY['activities_honors','experience_description','education_description'], 'https://nps.edu/navalx', 'Naval innovation tech bridges', TRUE, TRUE),
  ('DIU',                     'incubator', 'defense', 'tier_2', ARRAY['diu','defense innovation unit'], ARRAY['activities_honors','experience_description','education_description'], 'https://diu.mil', 'Defense Innovation Unit — dual-use commercial-to-DoD pathway', TRUE, TRUE)
ON CONFLICT (canonical_name, category) DO UPDATE SET
  subcategory        = EXCLUDED.subcategory,
  tier_group         = EXCLUDED.tier_group,
  aliases            = EXCLUDED.aliases,
  source_field_hints = EXCLUDED.source_field_hints,
  canonical_url      = EXCLUDED.canonical_url,
  description        = EXCLUDED.description,
  is_positive        = EXCLUDED.is_positive,
  is_active          = EXCLUDED.is_active,
  updated_at         = NOW();

-- ─── Verification ────────────────────────────────────────────────────

DO $$
DECLARE
  total_incubators INT;
  fellowship_overlap INT;
BEGIN
  SELECT count(*) INTO total_incubators FROM signal_dictionary WHERE category = 'incubator' AND is_active = TRUE;
  IF total_incubators < 45 THEN
    RAISE EXCEPTION 'Migration 054 B: expected at least 45 active incubator rows (7 reclassified + 38 new), got %.', total_incubators;
  END IF;

  -- Sanity: the 3 fellowships that should STAY fellowship are still fellowship
  SELECT count(*) INTO fellowship_overlap FROM signal_dictionary
  WHERE category = 'fellowship'
    AND canonical_name IN ('Neo Scholars', 'Z Fellows', 'Greylock Edge');
  IF fellowship_overlap != 3 THEN
    RAISE EXCEPTION 'Migration 054: expected 3 fellowship-stays rows (Neo Scholars, Z Fellows, Greylock Edge), got %. They may have been wrongly reclassified.', fellowship_overlap;
  END IF;

  RAISE NOTICE 'Migration 054: % active incubator rows (7 reclassified + 38 new). Fellowship stays-fellow rows preserved.', total_incubators;
END $$;

COMMIT;
