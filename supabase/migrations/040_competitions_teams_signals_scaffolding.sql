-- 040_competitions_teams_signals_scaffolding.sql
--
-- Schema scaffolding for hard-tech university competition + team signals.
--
-- WHAT THIS MIGRATION DOES (no data, schema only):
--   1. Extend signal_dictionary CHECK constraint to add 'olympiad' and 'national_lab' categories.
--      ('competition' is already in the constraint as of migration 024.)
--   2. CREATE TABLE competitions — sidecar to signal_dictionary entries with category='competition'.
--      PK is signal_id (FK to signal_dictionary). Holds tier, governing org, common roles,
--      grad skew, official URL, primary domain.
--   3. CREATE TABLE team_domain_tag_dictionary — controlled vocabulary for team-level domain tags.
--      Separate from specialty_normalized (per architecture review: specialty describes a person,
--      domain_tags describe a team's build focus — different concept layer).
--   4. CREATE TABLE teams — one row per specific collegiate team (Cornell Racing, USCRPL, MRover, etc.).
--      PK team_id UUID. signal_id UUID UNIQUE FK to signal_dictionary (each team gets its own
--      category='engineering_team' entry so the existing extractPatterns runner picks it up).
--      school_id FK, team_slug for stable referencing, tier_int, domain_tags TEXT[], website,
--      consortium support (is_consortium + consortium_partners) for Option A multi-school handling,
--      is_verified for future alumni-trace empirical validation.
--   5. CREATE TABLE team_competition_map — M:N junction (team can compete in multiple competitions).
--   6. ALTER person_signals — add team_role_tier SMALLINT (1-4) and team_role_text TEXT.
--      No separate person_team_memberships table; person_signals carries everything.
--
-- INDEXES: GIN on teams.domain_tags + B-tree on team_competition_map.competition_id and other
-- frequently-queried columns.
--
-- RLS: Supabase auto-enables RLS on every CREATE TABLE. Migration 041 disables it for the four new tables.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────
-- Step 1: Extend signal_dictionary categories
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE signal_dictionary DROP CONSTRAINT IF EXISTS signal_dictionary_category_check;

ALTER TABLE signal_dictionary
  ADD CONSTRAINT signal_dictionary_category_check
  CHECK (category IN (
    'fellowship', 'scholarship', 'hackathon', 'greek_life', 'athletics',
    'engineering_team', 'student_leadership', 'academic_distinction',
    'founder', 'open_source', 'publication', 'patent', 'speaking',
    'writing', 'military', 'hospitality', 'teaching', 'career_changer',
    'self_taught', 'language', 'competition',
    'olympiad', 'national_lab',  -- NEW (this migration)
    'other'
  ));

-- ────────────────────────────────────────────────────────────────────────
-- Step 2: competitions table
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE competitions (
  signal_id           UUID PRIMARY KEY REFERENCES signal_dictionary(id) ON DELETE CASCADE,

  competition_slug    TEXT NOT NULL UNIQUE,
  tier_int            SMALLINT NOT NULL CHECK (tier_int BETWEEN 1 AND 3),
  governing_org       TEXT,
  domain_primary      TEXT,
  common_role_titles  TEXT[] NOT NULL DEFAULT '{}',
  grad_skew_typical   TEXT CHECK (grad_skew_typical IS NULL OR grad_skew_typical IN ('undergrad_majority', 'grad_majority', 'mixed')),
  typical_team_size   TEXT,            -- free-text range like "50-150"; informational
  us_focus            BOOLEAN NOT NULL DEFAULT TRUE,
  official_url        TEXT,
  notes               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_competitions_slug          ON competitions (competition_slug);
CREATE INDEX idx_competitions_tier          ON competitions (tier_int);
CREATE INDEX idx_competitions_domain        ON competitions (domain_primary);

COMMENT ON TABLE competitions IS
  'Sidecar to signal_dictionary entries with category=''competition''. One row per league. PK is signal_id.';

-- ────────────────────────────────────────────────────────────────────────
-- Step 3: team_domain_tag_dictionary (controlled vocabulary)
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE team_domain_tag_dictionary (
  tag_name      TEXT PRIMARY KEY,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE team_domain_tag_dictionary IS
  'Controlled vocabulary for teams.domain_tags[]. Separate from specialty_normalized (specialty=person, domain_tag=team).';

-- ────────────────────────────────────────────────────────────────────────
-- Step 4: teams table
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE teams (
  team_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id            UUID NOT NULL UNIQUE REFERENCES signal_dictionary(id) ON DELETE CASCADE,
  school_id            UUID NOT NULL REFERENCES schools(school_id),

  team_name            TEXT NOT NULL,
  team_slug            TEXT NOT NULL,
  tier_int             SMALLINT NOT NULL CHECK (tier_int BETWEEN 1 AND 3),
  domain_tags          TEXT[] NOT NULL DEFAULT '{}',
  grad_skew            TEXT CHECK (grad_skew IS NULL OR grad_skew IN ('undergrad_majority', 'grad_majority', 'mixed')),
  website              TEXT,
  notes                TEXT,

  -- Consortia (Option A: lead school + free-text partners; defer junction to V2)
  is_consortium        BOOLEAN NOT NULL DEFAULT FALSE,
  consortium_partners  TEXT,

  -- Empirical validation (set TRUE once we observe alumni at top hardtech companies)
  is_verified          BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at          TIMESTAMPTZ,
  verified_notes       TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (school_id, team_slug)
);

CREATE INDEX idx_teams_school        ON teams (school_id);
CREATE INDEX idx_teams_signal        ON teams (signal_id);
CREATE INDEX idx_teams_tier          ON teams (tier_int);
CREATE INDEX idx_teams_domain_tags   ON teams USING GIN (domain_tags);
CREATE INDEX idx_teams_verified      ON teams (is_verified) WHERE is_verified = TRUE;
CREATE INDEX idx_teams_consortium    ON teams (is_consortium) WHERE is_consortium = TRUE;

COMMENT ON TABLE teams IS
  'Specific collegiate teams (Cornell Racing, USCRPL, MRover). One per signal_dictionary engineering_team row. school_id = lead school for consortia.';

-- ────────────────────────────────────────────────────────────────────────
-- Step 5: team_competition_map (M:N junction)
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE team_competition_map (
  team_id        UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
  competition_id UUID NOT NULL REFERENCES competitions(signal_id) ON DELETE CASCADE,
  is_primary     BOOLEAN NOT NULL DEFAULT FALSE,

  PRIMARY KEY (team_id, competition_id)
);

CREATE INDEX idx_team_competition_competition ON team_competition_map (competition_id);

COMMENT ON TABLE team_competition_map IS
  'M:N: a team can compete in multiple competitions (RoboJackets, Stanford SSI). is_primary marks the headline competition.';

-- ────────────────────────────────────────────────────────────────────────
-- Step 6: person_signals — team role tier + role text
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE person_signals
  ADD COLUMN IF NOT EXISTS team_role_tier  SMALLINT
    CHECK (team_role_tier IS NULL OR (team_role_tier BETWEEN 1 AND 4)),
  ADD COLUMN IF NOT EXISTS team_role_text  TEXT;

CREATE INDEX IF NOT EXISTS idx_person_signals_team_role_tier
  ON person_signals (team_role_tier)
  WHERE team_role_tier IS NOT NULL;

COMMENT ON COLUMN person_signals.team_role_tier IS
  'Tier 1-4 for team membership signals. 4=Captain/Chief/President/Founder, 3=Dept/Subsystem Lead, 2=Engineer/Specialist, 1=Member. NULL for non-team signals. V1 detection populates 4 and 1 only; 2 and 3 stay NULL until later.';

COMMENT ON COLUMN person_signals.team_role_text IS
  'Raw role title text extracted alongside team_role_tier. Preserves source for future re-classification when 2/3 tiers are populated.';

COMMIT;
