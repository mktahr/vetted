-- ============================================================
-- Vetted — Phase 1 Migration
-- Additive only. Does NOT touch: profiles, profile_snapshots,
-- or upsert_profile_from_snapshot.
-- ============================================================

-- Enable UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE company_bucket_type AS ENUM (
  'static_mature',
  'high_bar_tech',
  'growth_startup',
  'emerging_startup'
);

CREATE TYPE company_score_mode_type AS ENUM (
  'manual',
  'calculated',
  'hybrid'
);

CREATE TYPE manual_review_status_type AS ENUM (
  'unreviewed',
  'reviewed',
  'locked'
);

CREATE TYPE company_status_type AS ENUM (
  'active',
  'acquired',
  'public',
  'shut_down'
);

CREATE TYPE candidate_bucket_type AS ENUM (
  'vetted_talent',
  'vetted_potential',
  'solid_below_threshold'
);

CREATE TYPE review_flag_status_type AS ENUM (
  'open',
  'resolved',
  'dismissed'
);

CREATE TYPE review_flag_severity_type AS ENUM (
  'low',
  'medium',
  'high'
);

CREATE TYPE decision_state_type AS ENUM (
  'active',
  'hold',
  'excluded'
);

CREATE TYPE career_stage_type AS ENUM (
  'pre_career',
  'early_career',
  'mid_career',
  'senior_career'
);

CREATE TYPE degree_level_type AS ENUM (
  'high_school',
  'associate',
  'bachelor',
  'master',
  'mba',
  'phd',
  'jd',
  'md',
  'certificate',
  'coursework',
  'other'
);

CREATE TYPE employment_type_norm AS ENUM (
  'full_time',
  'contract',
  'part_time',
  'internship',
  'freelance',
  'advisory',
  'board',
  'unknown'
);

CREATE TYPE seniority_level AS ENUM (
  'intern',
  'individual_contributor',
  'senior_ic',
  'lead',
  'manager',
  'senior_manager',
  'director',
  'vp',
  'c_suite',
  'founder',
  'unknown'
);

-- ============================================================
-- COMPANIES
-- ============================================================

CREATE TABLE companies (
  company_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name      TEXT NOT NULL,
  primary_industry_tag    TEXT,
  company_bucket    company_bucket_type,
  company_score_mode      company_score_mode_type NOT NULL DEFAULT 'manual',
  manual_review_status    manual_review_status_type NOT NULL DEFAULT 'unreviewed',
  is_stealth_company      BOOLEAN NOT NULL DEFAULT FALSE,
  founding_date     DATE,
  current_status    company_status_type NOT NULL DEFAULT 'active',
  hq_location_name  TEXT,
  linkedin_url      TEXT UNIQUE,
  website_url       TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_companies_name ON companies (company_name);
CREATE INDEX idx_companies_bucket ON companies (company_bucket);
CREATE INDEX idx_companies_status ON companies (current_status);

-- Quality score per year (1=weak ... 5=elite)
CREATE TABLE company_year_scores (
  company_id        UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  year              SMALLINT NOT NULL,
  company_score     SMALLINT NOT NULL CHECK (company_score BETWEEN 1 AND 5),
  score_notes       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, year)
);

-- Quality score per function per year (0=not meaningful ... 3=exceptional)
CREATE TABLE company_function_scores (
  company_id            UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  function_normalized   TEXT NOT NULL,
  year                  SMALLINT NOT NULL,
  function_score        SMALLINT NOT NULL CHECK (function_score BETWEEN 0 AND 3),
  score_notes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, function_normalized, year)
);

CREATE TABLE company_metrics_by_year (
  company_id              UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  year                    SMALLINT NOT NULL,
  stage_normalized        TEXT,
  headcount_estimate      INTEGER,
  headcount_growth_pct    NUMERIC(6,2),
  funding_that_year       BIGINT,  -- in USD cents
  funding_total_to_date   BIGINT,  -- in USD cents
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, year)
);

CREATE TABLE company_events (
  company_event_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  event_type        TEXT NOT NULL,  -- 'acquisition', 'ipo', 'shutdown', 'pivot', 'layoff', etc.
  event_date        DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE company_locations (
  company_location_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  location_name         TEXT NOT NULL,
  location_type         TEXT,  -- 'hq', 'office', 'remote_hub'
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE company_monitoring (
  company_id              UUID PRIMARY KEY REFERENCES companies(company_id) ON DELETE CASCADE,
  refresh_priority        SMALLINT DEFAULT 3 CHECK (refresh_priority BETWEEN 1 AND 5),
  volatility              TEXT,  -- 'low', 'medium', 'high'
  refresh_frequency_days  INTEGER DEFAULT 90,
  last_reviewed_at        TIMESTAMPTZ,
  next_review_due_at      TIMESTAMPTZ,
  notes                   TEXT,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE company_units (
  company_unit_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  unit_name         TEXT NOT NULL,
  unit_type         TEXT,  -- 'lab', 'division', 'team', 'subsidiary'
  domain            TEXT,
  is_high_signal    BOOLEAN NOT NULL DEFAULT FALSE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE company_unit_boosts (
  company_unit_boost_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_unit_id         UUID NOT NULL REFERENCES company_units(company_unit_id) ON DELETE CASCADE,
  function_normalized     TEXT NOT NULL,
  boost_level             SMALLINT NOT NULL CHECK (boost_level BETWEEN 1 AND 3),
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE investors (
  investor_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_name   TEXT NOT NULL UNIQUE,
  investor_type   TEXT,  -- 'vc', 'angel', 'pe', 'corporate', 'accelerator'
  tier            SMALLINT CHECK (tier BETWEEN 1 AND 5),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE company_investors (
  company_investor_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  investor_id           UUID NOT NULL REFERENCES investors(investor_id) ON DELETE CASCADE,
  investment_stage      TEXT,
  is_lead_investor      BOOLEAN NOT NULL DEFAULT FALSE,
  investment_year       SMALLINT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, investor_id, investment_stage)
);

-- ============================================================
-- SCHOOLS
-- ============================================================

CREATE TABLE schools (
  school_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name     TEXT NOT NULL UNIQUE,
  school_type     TEXT,  -- 'university', 'college', 'bootcamp', 'online', 'community_college'
  location_name   TEXT,
  country         TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE school_scores (
  school_id     UUID PRIMARY KEY REFERENCES schools(school_id) ON DELETE CASCADE,
  school_score  SMALLINT NOT NULL CHECK (school_score BETWEEN 1 AND 5),
  score_notes   TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE school_specialization_scores (
  school_specialization_score_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                       UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  specialization_normalized       TEXT NOT NULL,
  score                           SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  notes                           TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, specialization_normalized)
);

-- ============================================================
-- PEOPLE
-- ============================================================

CREATE TABLE people (
  person_id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name                     TEXT NOT NULL,
  linkedin_url                  TEXT UNIQUE,
  location_name                 TEXT,
  headline_raw                  TEXT,
  summary_raw                   TEXT,
  current_company_id            UUID REFERENCES companies(company_id),
  current_title_raw             TEXT,
  current_title_normalized      TEXT,
  current_function_normalized   TEXT,
  years_experience_estimate     NUMERIC(5,1),
  full_time_roles_count         SMALLINT,
  full_time_years_experience    NUMERIC(5,1),
  has_full_time_role_estimate   BOOLEAN,
  career_stage_assigned         career_stage_type,
  career_stage_override         career_stage_type,
  -- link back to existing table during transition
  legacy_profile_id             UUID,  -- references profiles.id if it exists
  notes                         TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_people_linkedin ON people (linkedin_url);
CREATE INDEX idx_people_current_company ON people (current_company_id);
CREATE INDEX idx_people_career_stage ON people (career_stage_assigned);
CREATE INDEX idx_people_function ON people (current_function_normalized);

CREATE TABLE person_experiences (
  person_experience_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id                     UUID NOT NULL REFERENCES people(person_id) ON DELETE CASCADE,
  company_id                    UUID REFERENCES companies(company_id),
  company_unit_id               UUID REFERENCES company_units(company_unit_id),
  title_raw                     TEXT,
  title_normalized              TEXT,
  function_normalized           TEXT,
  specialty_normalized          TEXT,
  seniority_normalized          seniority_level,
  employment_type_normalized    employment_type_norm,
  start_date                    DATE,
  end_date                      DATE,
  is_current                    BOOLEAN NOT NULL DEFAULT FALSE,
  duration_months               SMALLINT,
  promotion_group_id            UUID,  -- groups promotions within same company
  is_internal_promotion         BOOLEAN NOT NULL DEFAULT FALSE,
  is_founder_role               BOOLEAN NOT NULL DEFAULT FALSE,
  is_vc_backed_founder_role     BOOLEAN NOT NULL DEFAULT FALSE,
  description_raw               TEXT,
  is_full_time_role             BOOLEAN,
  full_time_inference_reason    TEXT,
  full_time_inference_confidence NUMERIC(4,3) CHECK (full_time_inference_confidence BETWEEN 0 AND 1),
  notes                         TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_person_exp_person ON person_experiences (person_id);
CREATE INDEX idx_person_exp_company ON person_experiences (company_id);
CREATE INDEX idx_person_exp_function ON person_experiences (function_normalized);
CREATE INDEX idx_person_exp_current ON person_experiences (is_current) WHERE is_current = TRUE;

CREATE TABLE person_education (
  person_education_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id                     UUID NOT NULL REFERENCES people(person_id) ON DELETE CASCADE,
  school_id                     UUID REFERENCES schools(school_id),
  school_name_raw               TEXT,
  degree_raw                    TEXT,
  degree_normalized             TEXT,
  degree_level                  degree_level_type,
  field_of_study_raw            TEXT,
  field_of_study_normalized     TEXT,
  start_year                    SMALLINT,
  end_year                      SMALLINT,
  is_verified_degree            BOOLEAN NOT NULL DEFAULT FALSE,
  is_coursework_only            BOOLEAN NOT NULL DEFAULT FALSE,
  is_certificate_only           BOOLEAN NOT NULL DEFAULT FALSE,
  country                       TEXT,
  notes                         TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_person_edu_person ON person_education (person_id);
CREATE INDEX idx_person_edu_school ON person_education (school_id);

CREATE TABLE people_stealth_flags (
  person_id               UUID PRIMARY KEY REFERENCES people(person_id) ON DELETE CASCADE,
  is_in_stealth_pool      BOOLEAN NOT NULL DEFAULT FALSE,
  stealth_signal_reason   TEXT,
  needs_recheck           BOOLEAN NOT NULL DEFAULT FALSE,
  recheck_frequency_days  INTEGER DEFAULT 30,
  last_checked_at         TIMESTAMPTZ,
  next_check_at           TIMESTAMPTZ,
  notes                   TEXT,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EARLY SIGNALS (Education extras)
-- ============================================================

CREATE TABLE fellowships (
  fellowship_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fellowship_name TEXT NOT NULL UNIQUE,
  tier            SMALLINT CHECK (tier BETWEEN 1 AND 5),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE person_fellowships (
  person_fellowship_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id             UUID NOT NULL REFERENCES people(person_id) ON DELETE CASCADE,
  fellowship_id         UUID REFERENCES fellowships(fellowship_id),
  fellowship_name_raw   TEXT,
  role_raw              TEXT,
  start_year            SMALLINT,
  end_year              SMALLINT,
  is_completed          BOOLEAN NOT NULL DEFAULT FALSE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE labs (
  lab_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_name    TEXT NOT NULL,
  school_id   UUID REFERENCES schools(school_id),
  domain      TEXT,
  tier        SMALLINT CHECK (tier BETWEEN 1 AND 5),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE person_labs (
  person_lab_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       UUID NOT NULL REFERENCES people(person_id) ON DELETE CASCADE,
  lab_id          UUID REFERENCES labs(lab_id),
  lab_name_raw    TEXT,
  role_raw        TEXT,
  start_year      SMALLINT,
  end_year        SMALLINT,
  school_id       UUID REFERENCES schools(school_id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE clubs (
  club_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_name   TEXT NOT NULL,
  club_type   TEXT,
  tier        SMALLINT CHECK (tier BETWEEN 1 AND 5),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE person_clubs (
  person_club_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       UUID NOT NULL REFERENCES people(person_id) ON DELETE CASCADE,
  club_id         UUID REFERENCES clubs(club_id),
  club_name_raw   TEXT,
  role_raw        TEXT,
  start_year      SMALLINT,
  end_year        SMALLINT,
  school_id       UUID REFERENCES schools(school_id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hackathons (
  hackathon_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hackathon_name  TEXT NOT NULL,
  tier            SMALLINT CHECK (tier BETWEEN 1 AND 5),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE person_hackathons (
  person_hackathon_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id             UUID NOT NULL REFERENCES people(person_id) ON DELETE CASCADE,
  hackathon_id          UUID REFERENCES hackathons(hackathon_id),
  hackathon_name_raw    TEXT,
  organization_name     TEXT,
  role_raw              TEXT,
  placement             TEXT,
  award_name            TEXT,
  start_date            DATE,
  end_date              DATE,
  project_name          TEXT,
  project_url           TEXT,
  description_raw       TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DICTIONARIES / NORMALIZATION CONFIG
-- ============================================================

CREATE TABLE title_dictionary (
  title_pattern           TEXT PRIMARY KEY,
  title_normalized        TEXT NOT NULL,
  function_normalized     TEXT,
  specialty_normalized    TEXT,
  seniority_normalized    seniority_level,
  employment_hint         employment_type_norm,
  confidence              NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1) DEFAULT 1.0,
  active                  BOOLEAN NOT NULL DEFAULT TRUE,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE function_dictionary (
  function_normalized TEXT PRIMARY KEY,
  description         TEXT,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE specialty_dictionary (
  specialty_normalized  TEXT PRIMARY KEY,
  parent_function       TEXT REFERENCES function_dictionary(function_normalized),
  description           TEXT,
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE seniority_dictionary (
  seniority_normalized  seniority_level PRIMARY KEY,
  rank_order            SMALLINT NOT NULL,
  description           TEXT,
  active                BOOLEAN NOT NULL DEFAULT TRUE
);

-- Seed seniority rank order
INSERT INTO seniority_dictionary (seniority_normalized, rank_order, description) VALUES
  ('intern', 1, 'Internship or student role'),
  ('individual_contributor', 2, 'IC — no management responsibility'),
  ('senior_ic', 3, 'Senior individual contributor'),
  ('lead', 4, 'Tech lead or team lead without formal management'),
  ('manager', 5, 'People manager, typically 2-8 reports'),
  ('senior_manager', 6, 'Manager of managers or large team'),
  ('director', 7, 'Director level'),
  ('vp', 8, 'VP level'),
  ('c_suite', 9, 'C-suite executive'),
  ('founder', 10, 'Founder or co-founder'),
  ('unknown', 0, 'Could not determine seniority');

CREATE TABLE employment_type_dictionary (
  employment_type_pattern   TEXT PRIMARY KEY,
  employment_type_normalized employment_type_norm NOT NULL,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE degree_dictionary (
  degree_pattern      TEXT PRIMARY KEY,
  degree_normalized   TEXT NOT NULL,
  degree_level        degree_level_type,
  is_real_degree      BOOLEAN NOT NULL DEFAULT TRUE,
  is_certificate      BOOLEAN NOT NULL DEFAULT FALSE,
  is_coursework       BOOLEAN NOT NULL DEFAULT FALSE,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE field_of_study_dictionary (
  field_pattern             TEXT PRIMARY KEY,
  field_of_study_normalized TEXT NOT NULL,
  domain_group              TEXT,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE career_stage_config (
  career_stage                  career_stage_type PRIMARY KEY,
  stage_order                   SMALLINT NOT NULL,
  min_full_time_years_experience NUMERIC(5,1),
  max_full_time_years_experience NUMERIC(5,1),
  requires_full_time_role       BOOLEAN NOT NULL DEFAULT FALSE,
  min_full_time_roles_count     SMALLINT,
  description                   TEXT,
  notes                         TEXT,
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed career stage defaults
INSERT INTO career_stage_config (career_stage, stage_order, min_full_time_years_experience, max_full_time_years_experience, requires_full_time_role, min_full_time_roles_count, description) VALUES
  ('pre_career',    1, NULL, 0,    FALSE, 0, 'Students or recent grads with no full-time roles yet'),
  ('early_career',  2, 0,    4,    TRUE,  1, '0–4 years of full-time experience'),
  ('mid_career',    3, 4,    10,   TRUE,  2, '4–10 years of full-time experience'),
  ('senior_career', 4, 10,   NULL, TRUE,  3, '10+ years of full-time experience');

-- ============================================================
-- CANDIDATE SCORING / BUCKETING / REVIEW
-- ============================================================

CREATE TABLE candidate_bucket_assignments (
  bucket_assignment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id             UUID NOT NULL REFERENCES people(person_id) ON DELETE CASCADE,
  candidate_bucket      candidate_bucket_type NOT NULL,
  assigned_by           TEXT NOT NULL DEFAULT 'system',  -- 'system' or user email
  assignment_reason     TEXT,
  confidence            NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
  effective_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active bucket per person — use latest effective_at
CREATE INDEX idx_bucket_person ON candidate_bucket_assignments (person_id, effective_at DESC);

CREATE TABLE candidate_review_flags (
  review_flag_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id         UUID NOT NULL REFERENCES people(person_id) ON DELETE CASCADE,
  flag_type         TEXT NOT NULL,  -- 'contractor_ambiguity', 'credential_inflation', 'founder_ambiguity', etc.
  flag_status       review_flag_status_type NOT NULL DEFAULT 'open',
  flag_severity     review_flag_severity_type NOT NULL DEFAULT 'medium',
  source            TEXT NOT NULL DEFAULT 'system',
  confidence        NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  notes             TEXT
);

CREATE INDEX idx_review_flags_person ON candidate_review_flags (person_id);
CREATE INDEX idx_review_flags_status ON candidate_review_flags (flag_status) WHERE flag_status = 'open';

CREATE TABLE candidate_decision_state (
  decision_state_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id           UUID NOT NULL REFERENCES people(person_id) ON DELETE CASCADE,
  decision_state      decision_state_type NOT NULL DEFAULT 'active',
  source              TEXT NOT NULL DEFAULT 'system',
  reason              TEXT,
  effective_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active decision state per person — use latest effective_at
CREATE INDEX idx_decision_person ON candidate_decision_state (person_id, effective_at DESC);

CREATE TABLE auto_vetted_rules (
  rule_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name   TEXT NOT NULL UNIQUE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  rule_type   TEXT NOT NULL,  -- 'bucket_assignment', 'review_flag', 'penalty'
  rule_logic  JSONB,          -- stores the rule parameters
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- UPDATED_AT TRIGGER (applies to all tables with updated_at)
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all relevant tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'companies', 'company_year_scores', 'company_function_scores',
    'company_metrics_by_year', 'company_monitoring', 'company_units',
    'investors', 'schools', 'school_scores', 'people',
    'person_experiences', 'person_education', 'people_stealth_flags',
    'title_dictionary', 'auto_vetted_rules', 'career_stage_config'
  ] LOOP
    EXECUTE format('
      CREATE TRIGGER trg_%s_updated_at
      BEFORE UPDATE ON %s
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ', t, t);
  END LOOP;
END;
$$;

-- ============================================================
-- COMMENTS (documentation inline in DB)
-- ============================================================

COMMENT ON TABLE companies IS 'Normalized company records. Scored by year and by function.';
COMMENT ON TABLE people IS 'Normalized person records. Links back to legacy profiles via legacy_profile_id.';
COMMENT ON TABLE candidate_bucket_assignments IS 'Quality tier assignment (vetted_talent / vetted_potential / solid_below_threshold). NOT the same as review state or decision state.';
COMMENT ON TABLE candidate_review_flags IS 'Manual review triggers. Separate from bucket and decision state. A vetted candidate can also have open review flags.';
COMMENT ON TABLE candidate_decision_state IS 'Operational state (active / hold / excluded). NOT the same as quality bucket.';
COMMENT ON TABLE title_dictionary IS 'Pattern matching table for normalizing raw LinkedIn titles to function + specialty + seniority.';
