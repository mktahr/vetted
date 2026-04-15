-- Migration 007 — career_progression label rebuild
--
-- Old labels (measured first vs last company-quality, only 2 points):
--   'upward' / 'lateral' / 'unclear'
--
-- New labels (trajectory of last 2-3 scored FT roles):
--   'rising' / 'flat' / 'declining' / 'insufficient_data'
--
-- Migrate existing values with a best-effort literal mapping (meaning is
-- being clarified, not inverted). All rows will be recomputed immediately
-- after this migration by the rescore-all backfill.
--
-- The career_slope bonus in scoreCandidate() will fire on 'rising' instead
-- of 'upward' after this rename.

-- 1. Drop the old CHECK constraint (name from CREATE TABLE IF NOT EXISTS pattern)
ALTER TABLE people DROP CONSTRAINT IF EXISTS people_career_progression_check;

-- 2. Remap existing string values
UPDATE people SET career_progression = 'rising'    WHERE career_progression = 'upward';
UPDATE people SET career_progression = 'flat'      WHERE career_progression = 'lateral';
UPDATE people SET career_progression = 'declining' WHERE career_progression = 'unclear';

-- 3. Add new CHECK constraint
ALTER TABLE people ADD CONSTRAINT people_career_progression_check
  CHECK (career_progression IS NULL OR career_progression IN ('rising', 'flat', 'declining', 'insufficient_data'));

COMMENT ON COLUMN people.career_progression IS
  'Derived trajectory of last 2-3 scored full-time roles: rising/flat/declining/insufficient_data. Only rising triggers the career_slope bonus.';
