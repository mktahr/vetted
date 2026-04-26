-- Migration 026: Add description, activities, and grade text columns to person_education
--
-- These fields arrive from the Chrome extension's LinkedIn Voyager scrape
-- (canonical_json.education[].description, .activities, .grade) but were
-- previously dropped because the schema had no columns for them.
-- They are the primary source for signal extraction on education entries
-- (academic_distinction, greek_life, athletics, engineering_team, etc.).

ALTER TABLE person_education
  ADD COLUMN IF NOT EXISTS description_raw TEXT,
  ADD COLUMN IF NOT EXISTS activities_raw  TEXT,
  ADD COLUMN IF NOT EXISTS grade_raw       TEXT;
