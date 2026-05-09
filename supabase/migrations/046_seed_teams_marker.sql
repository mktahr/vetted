-- 046_seed_teams_marker.sql
--
-- ⚠ MARKER MIGRATION — does not load data.
--
-- The actual teams seed runs via:
--   node scripts/import-teams.mjs --dry-run    (review unmatched schools)
--   node scripts/import-teams.mjs              (apply)
--
-- Why a script instead of pure SQL: 142 team rows require fuzzy school_id
-- lookup (canonical name → school_aliases fallback → unmatched-skip pattern).
-- Pure SQL would either fail loudly on the first unmatched school or
-- silently insert NULL school_id (constraint violation). The script prints
-- the unmatched-school list to stdout for manual review before commit.
--
-- The script also:
--   1. Inserts one signal_dictionary row per team (category='engineering_team')
--      with aliases from CSV's team_aliases column
--   2. Inserts one teams row per team, with school_id resolved
--   3. Inserts team_competition_map rows (one per team, linked to the
--      competition slug from CSV)
--   4. Seeds team_domain_tag_dictionary with the union of domain_tags
--      values across all 142 rows
--
-- Verify post-import:
--   SELECT count(*) FROM teams;                        -- expect 142
--   SELECT count(*) FROM team_competition_map;         -- expect 142
--   SELECT count(*) FROM signal_dictionary
--     WHERE category = 'engineering_team';             -- expect 142 + 1 (VEX Robotics generic)
--   SELECT count(*) FROM team_domain_tag_dictionary;   -- expect ~20 unique tags

BEGIN;

-- This migration's function is to mark the migration sequence number;
-- the data load is delegated to scripts/import-teams.mjs.
-- A small NOTICE here so logs show the marker ran.

DO $$
DECLARE
  team_count INT;
BEGIN
  SELECT count(*) INTO team_count FROM teams;
  IF team_count = 0 THEN
    RAISE NOTICE 'Migration 046 marker: 0 teams in DB. Run scripts/import-teams.mjs to populate.';
  ELSE
    RAISE NOTICE 'Migration 046 marker: % teams already exist. Re-run import-teams.mjs only if you have new CSV data.', team_count;
  END IF;
END $$;

COMMIT;
