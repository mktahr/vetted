-- Migration 027: Add school_groups and company_groups columns
--
-- TEXT[] columns for tagging schools/companies into named groups
-- (top_military_academy, top_mba, top_law_school, top_law_firm).
-- GIN indexes for fast array overlap queries (&&).
--
-- NOTE: Some schools have duplicate records (e.g., "Harvard" score=4
-- vs "Harvard University" score=null). Both records are tagged so the
-- group filter catches candidates regardless of which record they
-- reference. School dedup is a separate backlog item.

-- ============================================================
-- SCHEMA
-- ============================================================

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS school_groups TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS company_groups TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_schools_groups
  ON schools USING GIN (school_groups);

CREATE INDEX IF NOT EXISTS idx_companies_groups
  ON companies USING GIN (company_groups);

-- ============================================================
-- MILITARY ACADEMIES (3 schools — INSERT, none exist)
-- ============================================================

INSERT INTO schools (school_name, school_groups)
VALUES
  ('United States Military Academy', ARRAY['top_military_academy']),
  ('United States Naval Academy', ARRAY['top_military_academy']),
  ('United States Air Force Academy', ARRAY['top_military_academy'])
ON CONFLICT (school_name) DO UPDATE SET
  school_groups = array_cat(
    COALESCE(schools.school_groups, '{}'),
    ARRAY['top_military_academy']
  ),
  updated_at = NOW();

-- Aliases
INSERT INTO school_aliases (alias_name, school_id)
SELECT 'West Point', school_id FROM schools WHERE school_name = 'United States Military Academy'
ON CONFLICT (alias_name) DO NOTHING;

INSERT INTO school_aliases (alias_name, school_id)
SELECT 'USMA', school_id FROM schools WHERE school_name = 'United States Military Academy'
ON CONFLICT (alias_name) DO NOTHING;

INSERT INTO school_aliases (alias_name, school_id)
SELECT 'Annapolis', school_id FROM schools WHERE school_name = 'United States Naval Academy'
ON CONFLICT (alias_name) DO NOTHING;

INSERT INTO school_aliases (alias_name, school_id)
SELECT 'USNA', school_id FROM schools WHERE school_name = 'United States Naval Academy'
ON CONFLICT (alias_name) DO NOTHING;

INSERT INTO school_aliases (alias_name, school_id)
SELECT 'USAFA', school_id FROM schools WHERE school_name = 'United States Air Force Academy'
ON CONFLICT (alias_name) DO NOTHING;

-- ============================================================
-- TOP MBA (M7 + Haas + Tuck — 9 programs)
-- Tag BOTH scored canonical record AND unscored duplicate where
-- candidates may be linked to either.
-- ============================================================

-- Harvard: scored "Harvard" (f0de7456) + unscored "Harvard University" (d0a2c8d7)
UPDATE schools SET school_groups = array_cat(
  COALESCE(school_groups, '{}'), ARRAY['top_mba']
), updated_at = NOW()
WHERE school_id IN (
  'f0de7456-49a2-45aa-a178-b3029b20df6a',
  'd0a2c8d7-0bb5-4b53-9d9d-efa5dbb82a99'
) AND NOT ('top_mba' = ANY(COALESCE(school_groups, '{}')));

-- Stanford: scored "Stanford" (90c577e4) + unscored "Stanford University" (6ead7775)
UPDATE schools SET school_groups = array_cat(
  COALESCE(school_groups, '{}'), ARRAY['top_mba']
), updated_at = NOW()
WHERE school_id IN (
  '90c577e4-93e2-4279-808d-26e0fc1ad34d',
  '6ead7775-0fd0-4a7c-a0bc-2136ff058c05'
) AND NOT ('top_mba' = ANY(COALESCE(school_groups, '{}')));

-- Penn / Wharton (031b32fb) — single record, aliases handle variants
UPDATE schools SET school_groups = array_cat(
  COALESCE(school_groups, '{}'), ARRAY['top_mba']
), updated_at = NOW()
WHERE school_id = '031b32fb-f157-4277-a96c-373671574aeb'
  AND NOT ('top_mba' = ANY(COALESCE(school_groups, '{}')));

-- Northwestern / Kellogg: scored (efbb964f) + unscored (4cf1efc8)
UPDATE schools SET school_groups = array_cat(
  COALESCE(school_groups, '{}'), ARRAY['top_mba']
), updated_at = NOW()
WHERE school_id IN (
  'efbb964f-358b-493a-83ae-a51917cac3a0',
  '4cf1efc8-655b-4600-b2a7-4895452f36bf'
) AND NOT ('top_mba' = ANY(COALESCE(school_groups, '{}')));

-- UChicago / Booth (cd6162d8) — single record
UPDATE schools SET school_groups = array_cat(
  COALESCE(school_groups, '{}'), ARRAY['top_mba']
), updated_at = NOW()
WHERE school_id = 'cd6162d8-5de1-426e-9786-48b2fe769e1e'
  AND NOT ('top_mba' = ANY(COALESCE(school_groups, '{}')));

INSERT INTO school_aliases (alias_name, school_id)
VALUES ('Booth School of Business', 'cd6162d8-5de1-426e-9786-48b2fe769e1e')
ON CONFLICT (alias_name) DO NOTHING;

INSERT INTO school_aliases (alias_name, school_id)
VALUES ('Chicago Booth', 'cd6162d8-5de1-426e-9786-48b2fe769e1e')
ON CONFLICT (alias_name) DO NOTHING;

-- MIT / Sloan: scored "MIT" (52454a86) + unscored "Massachusetts Institute of Technology" (eb87be51)
UPDATE schools SET school_groups = array_cat(
  COALESCE(school_groups, '{}'), ARRAY['top_mba']
), updated_at = NOW()
WHERE school_id IN (
  '52454a86-875f-42a3-bf30-e4ce33d6492d',
  'eb87be51-7ce3-4a42-a3e1-f5dfa13def36'
) AND NOT ('top_mba' = ANY(COALESCE(school_groups, '{}')));

-- Columbia (6736d4a6) — single record
UPDATE schools SET school_groups = array_cat(
  COALESCE(school_groups, '{}'), ARRAY['top_mba']
), updated_at = NOW()
WHERE school_id = '6736d4a6-09ce-411a-936b-d8f6248d15f3'
  AND NOT ('top_mba' = ANY(COALESCE(school_groups, '{}')));

INSERT INTO school_aliases (alias_name, school_id)
VALUES ('Columbia Business School', '6736d4a6-09ce-411a-936b-d8f6248d15f3')
ON CONFLICT (alias_name) DO NOTHING;

-- Berkeley / Haas: scored "Berkeley" (72aa28b8) + unscored "University of California, Berkeley" (c2e60f29)
UPDATE schools SET school_groups = array_cat(
  COALESCE(school_groups, '{}'), ARRAY['top_mba']
), updated_at = NOW()
WHERE school_id IN (
  '72aa28b8-b974-474f-bedc-7a03d6fcb597',
  'c2e60f29-b95d-4266-b12e-2847c5532edf'
) AND NOT ('top_mba' = ANY(COALESCE(school_groups, '{}')));

-- Dartmouth / Tuck (678c35a6) — single record
UPDATE schools SET school_groups = array_cat(
  COALESCE(school_groups, '{}'), ARRAY['top_mba']
), updated_at = NOW()
WHERE school_id = '678c35a6-b324-4b46-ac6b-303a0886d947'
  AND NOT ('top_mba' = ANY(COALESCE(school_groups, '{}')));

-- ============================================================
-- TOP LAW SCHOOL (T6 + Berkeley — 7 programs)
-- Schools already tagged top_mba get top_law_school appended.
-- ============================================================

-- Yale (0982bffe) — EXISTS, just add group
UPDATE schools SET school_groups = array_cat(
  COALESCE(school_groups, '{}'), ARRAY['top_law_school']
), updated_at = NOW()
WHERE school_id = '0982bffe-7b64-4e0f-a688-53fe2bc22b97'
  AND NOT ('top_law_school' = ANY(COALESCE(school_groups, '{}')));

INSERT INTO school_aliases (alias_name, school_id)
VALUES ('Yale Law School', '0982bffe-7b64-4e0f-a688-53fe2bc22b97')
ON CONFLICT (alias_name) DO NOTHING;

-- Stanford (both records)
UPDATE schools SET school_groups = array_cat(
  COALESCE(school_groups, '{}'), ARRAY['top_law_school']
), updated_at = NOW()
WHERE school_id IN (
  '90c577e4-93e2-4279-808d-26e0fc1ad34d',
  '6ead7775-0fd0-4a7c-a0bc-2136ff058c05'
) AND NOT ('top_law_school' = ANY(COALESCE(school_groups, '{}')));

INSERT INTO school_aliases (alias_name, school_id)
VALUES ('Stanford Law School', '90c577e4-93e2-4279-808d-26e0fc1ad34d')
ON CONFLICT (alias_name) DO NOTHING;

-- Harvard (both records)
UPDATE schools SET school_groups = array_cat(
  COALESCE(school_groups, '{}'), ARRAY['top_law_school']
), updated_at = NOW()
WHERE school_id IN (
  'f0de7456-49a2-45aa-a178-b3029b20df6a',
  'd0a2c8d7-0bb5-4b53-9d9d-efa5dbb82a99'
) AND NOT ('top_law_school' = ANY(COALESCE(school_groups, '{}')));

INSERT INTO school_aliases (alias_name, school_id)
VALUES ('Harvard Law School', 'f0de7456-49a2-45aa-a178-b3029b20df6a')
ON CONFLICT (alias_name) DO NOTHING;

-- UChicago (single record)
UPDATE schools SET school_groups = array_cat(
  COALESCE(school_groups, '{}'), ARRAY['top_law_school']
), updated_at = NOW()
WHERE school_id = 'cd6162d8-5de1-426e-9786-48b2fe769e1e'
  AND NOT ('top_law_school' = ANY(COALESCE(school_groups, '{}')));

INSERT INTO school_aliases (alias_name, school_id)
VALUES ('University of Chicago Law School', 'cd6162d8-5de1-426e-9786-48b2fe769e1e')
ON CONFLICT (alias_name) DO NOTHING;

-- Columbia (single record)
UPDATE schools SET school_groups = array_cat(
  COALESCE(school_groups, '{}'), ARRAY['top_law_school']
), updated_at = NOW()
WHERE school_id = '6736d4a6-09ce-411a-936b-d8f6248d15f3'
  AND NOT ('top_law_school' = ANY(COALESCE(school_groups, '{}')));

INSERT INTO school_aliases (alias_name, school_id)
VALUES ('Columbia Law School', '6736d4a6-09ce-411a-936b-d8f6248d15f3')
ON CONFLICT (alias_name) DO NOTHING;

-- NYU (42eca09d)
UPDATE schools SET school_groups = array_cat(
  COALESCE(school_groups, '{}'), ARRAY['top_law_school']
), updated_at = NOW()
WHERE school_id = '42eca09d-ce75-432f-bf36-fafa6397a2b4'
  AND NOT ('top_law_school' = ANY(COALESCE(school_groups, '{}')));

INSERT INTO school_aliases (alias_name, school_id)
VALUES ('NYU School of Law', '42eca09d-ce75-432f-bf36-fafa6397a2b4')
ON CONFLICT (alias_name) DO NOTHING;

-- Berkeley (both records)
UPDATE schools SET school_groups = array_cat(
  COALESCE(school_groups, '{}'), ARRAY['top_law_school']
), updated_at = NOW()
WHERE school_id IN (
  '72aa28b8-b974-474f-bedc-7a03d6fcb597',
  'c2e60f29-b95d-4266-b12e-2847c5532edf'
) AND NOT ('top_law_school' = ANY(COALESCE(school_groups, '{}')));

INSERT INTO school_aliases (alias_name, school_id)
VALUES ('Berkeley Law', '72aa28b8-b974-474f-bedc-7a03d6fcb597')
ON CONFLICT (alias_name) DO NOTHING;

-- ============================================================
-- TOP LAW FIRMS (14 firms — INSERT, none exist)
-- focus='unreviewed': law firms exist for company_groups filter
-- only, not for browsing in recruiter company search.
-- ============================================================

INSERT INTO companies (company_name, primary_industry_tag, current_status, company_score_mode, manual_review_status, focus, company_groups)
VALUES
  ('Wachtell, Lipton, Rosen & Katz', 'Legal', 'active', 'manual', 'unreviewed', 'unreviewed', ARRAY['top_law_firm']),
  ('Cravath, Swaine & Moore', 'Legal', 'active', 'manual', 'unreviewed', 'unreviewed', ARRAY['top_law_firm']),
  ('Sullivan & Cromwell', 'Legal', 'active', 'manual', 'unreviewed', 'unreviewed', ARRAY['top_law_firm']),
  ('Skadden, Arps, Slate, Meagher & Flom', 'Legal', 'active', 'manual', 'unreviewed', 'unreviewed', ARRAY['top_law_firm']),
  ('Davis Polk & Wardwell', 'Legal', 'active', 'manual', 'unreviewed', 'unreviewed', ARRAY['top_law_firm']),
  ('Simpson Thacher & Bartlett', 'Legal', 'active', 'manual', 'unreviewed', 'unreviewed', ARRAY['top_law_firm']),
  ('Paul, Weiss, Rifkind, Wharton & Garrison', 'Legal', 'active', 'manual', 'unreviewed', 'unreviewed', ARRAY['top_law_firm']),
  ('Latham & Watkins', 'Legal', 'active', 'manual', 'unreviewed', 'unreviewed', ARRAY['top_law_firm']),
  ('Kirkland & Ellis', 'Legal', 'active', 'manual', 'unreviewed', 'unreviewed', ARRAY['top_law_firm']),
  ('Wilson Sonsini Goodrich & Rosati', 'Legal', 'active', 'manual', 'unreviewed', 'unreviewed', ARRAY['top_law_firm']),
  ('Fenwick & West', 'Legal', 'active', 'manual', 'unreviewed', 'unreviewed', ARRAY['top_law_firm']),
  ('Cooley', 'Legal', 'active', 'manual', 'unreviewed', 'unreviewed', ARRAY['top_law_firm']),
  ('Gunderson Dettmer', 'Legal', 'active', 'manual', 'unreviewed', 'unreviewed', ARRAY['top_law_firm']),
  ('Goodwin Procter', 'Legal', 'active', 'manual', 'unreviewed', 'unreviewed', ARRAY['top_law_firm']);
