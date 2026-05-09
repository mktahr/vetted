-- 042_reclassify_engineering_team_to_competition.sql
--
-- Reclassify the existing 23 engineering_team rows in signal_dictionary
-- to category='competition'. The 'engineering_team' category becomes
-- "specific team membership" after migration 046 populates 142 team rows.
--
-- Pre-flight grep (run BEFORE this migration; results in PR description):
--   $ grep -rEn "'engineering_team'" lib/ app/
--   Result (2026-05-08): 3 files, all UI display-order arrays + label maps.
--   Both ProfileTable.tsx and ProfileDrawer.tsx and search-builder/page.tsx
--   already include 'competition' in their SIGNAL_CATEGORY_ORDER. Reclassified
--   rows shift chip groups; no app-code breakage.
--
-- Disposition for the 24 existing engineering_team rows:
--   Disposition 1 (11 rows): UPDATE category='competition' AND link to a competitions
--                            row in migration 045. Mapped to vetted_competitions.csv slugs.
--   Disposition 3 (12 rows): UPDATE category='competition' but NO competitions row.
--                            Remain as detection-only signals; no team data.
--   Disposition 4a (VEX Robotics): SPLIT. Reclassify to 'competition' (generic VEX).
--                                  A new "VEX U" row is added in migration 045.
--   Disposition 4b (ACM ICPC): Auto-handled below via DO block (count + branch).
--
-- Total: 23 UPDATEs in this migration + 1 conditional UPDATE/DELETE for ACM ICPC.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────
-- 23 reclassifications (Disposition 1 + Disposition 3 + VEX Robotics)
-- ────────────────────────────────────────────────────────────────────────

UPDATE signal_dictionary
SET category = 'competition',
    updated_at = NOW()
WHERE category = 'engineering_team'
  AND canonical_name IN (
    -- Disposition 1: 11 rows mapped to slugs (linked in migration 045)
    'Formula SAE',                  -- → fsae_ic
    'Formula Electric',             -- → fsae_ev
    'Baja SAE',                     -- → baja_sae
    'AIAA Design/Build/Fly',        -- → aiaa_dbf (slashes preserved in canonical_name)
    'NASA Student Launch',          -- → usli
    'Mars Rover Team',              -- → urc
    'CubeSat Team',                 -- → cubesat
    'RoboSub',                      -- → robosub
    'RoboBoat',                     -- → roboboat
    'Drone Team (SUAS)',            -- → suas
    'Solar Car Team',               -- → solar_challenge

    -- Disposition 3: 12 rows reclassified, no slug, no competitions row
    'Formula Hybrid',               -- International variant; no US team data
    'Formula Student',              -- International (UK/EU) variant
    'Concrete Canoe',               -- ASCE civil eng; out of scope
    'Steel Bridge',                 -- ASCE civil eng; out of scope
    'Human Powered Vehicle',        -- ASME mech eng; not in vetted_teams.csv
    'Battlebots Collegiate',        -- Combat robotics; not in vetted_teams.csv
    'FIRST Robotics',               -- High school; useful as signal only
    'Autonomous Vehicle Team',      -- Generic; replaced by iac/f1tenth specifically
    'Hyperloop Team',               -- SpaceX competition defunct since 2019
    'Rocket Team',                  -- Generic; specific teams (USCRPL, MIT Rocket, etc.) catch the signal
    'iGEM',                         -- Synthetic biology; outside hard-tech scope

    -- Disposition 4a: VEX Robotics — SPLIT
    -- Existing row stays (catches high-school VEX mentions). VEX U (collegiate-only)
    -- gets a new signal_dictionary row in migration 045.
    'VEX Robotics'
  );

-- Verification: fail loud if the row-count doesn't match expected 23.
-- Catches typos in canonical_name (silent miss in UPDATE → silent failure here).
-- GET DIAGNOSTICS ROW_COUNT can't see the UPDATE above (different statement
-- scope), so we re-count via SELECT against the post-UPDATE state.
-- Idempotent: re-runs still see the same 23 rows in category='competition'.
DO $$
DECLARE
  reclassified_count INT;
BEGIN
  SELECT count(*) INTO reclassified_count
  FROM signal_dictionary
  WHERE category = 'competition'
    AND canonical_name IN (
      'Formula SAE','Formula Electric','Baja SAE','AIAA Design/Build/Fly',
      'NASA Student Launch','Mars Rover Team','CubeSat Team','RoboSub',
      'RoboBoat','Drone Team (SUAS)','Solar Car Team',
      'Formula Hybrid','Formula Student','Concrete Canoe','Steel Bridge',
      'Human Powered Vehicle','Battlebots Collegiate','FIRST Robotics',
      'Autonomous Vehicle Team','Hyperloop Team','Rocket Team','iGEM',
      'VEX Robotics'
    );
  IF reclassified_count != 23 THEN
    RAISE EXCEPTION
      'Migration 042: expected 23 rows reclassified to category=competition, got %. A canonical_name typo in the UPDATE list is the most likely cause.',
      reclassified_count;
  END IF;
  RAISE NOTICE 'Migration 042: 23 rows reclassified to category=competition (verified).';
END $$;

-- ────────────────────────────────────────────────────────────────────────
-- ACM ICPC: count + branch (DELETE if 0 person_signals, UPDATE if >0)
-- ────────────────────────────────────────────────────────────────────────
-- ACM ICPC is a duplicate of the incoming 'ICPC' entry in
-- hackathons_signals.csv (loaded in migration 044, category='hackathon',
-- subcategory='competitive_programming'). Two outcomes:
--   - 0 person_signals: hard DELETE. Migration 044 creates the canonical row.
--   - >0 person_signals: reclassify to category='hackathon' so existing
--     person_signals stay valid. Migration 044's ON CONFLICT DO UPDATE
--     will MERGE with the now-reclassified row (same canonical_name+category
--     wouldn't match because one is 'ACM ICPC' and the other is 'ICPC' —
--     so we also rename 'ACM ICPC' → 'ICPC' to merge).

DO $$
DECLARE
  acm_id UUID;
  signal_count INT;
BEGIN
  SELECT id INTO acm_id
  FROM signal_dictionary
  WHERE canonical_name = 'ACM ICPC' AND category = 'engineering_team';

  IF acm_id IS NULL THEN
    RAISE NOTICE 'ACM ICPC: row not found, skipping. (Already handled or never existed.)';
    RETURN;
  END IF;

  SELECT count(*) INTO signal_count
  FROM person_signals
  WHERE signal_id = acm_id;

  IF signal_count = 0 THEN
    DELETE FROM signal_dictionary WHERE id = acm_id;
    RAISE NOTICE 'ACM ICPC: 0 person_signals rows. DELETED. Canonical ICPC row will be created by migration 044 (hackathons seed).';
  ELSE
    -- Reclassify to hackathon and rename to 'ICPC' so migration 044's
    -- ON CONFLICT (canonical_name, category) DO UPDATE merges cleanly.
    UPDATE signal_dictionary
    SET category    = 'hackathon',
        subcategory = 'competitive_programming',
        canonical_name = 'ICPC',
        updated_at  = NOW()
    WHERE id = acm_id;
    RAISE NOTICE 'ACM ICPC: % person_signals rows preserved. Reclassified to category=hackathon, subcategory=competitive_programming, renamed to ''ICPC''. Migration 044 will MERGE aliases via UPSERT.', signal_count;
  END IF;
END $$;

COMMIT;
