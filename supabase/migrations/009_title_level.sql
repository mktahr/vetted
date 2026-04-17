-- Migration 009 — title_level system
--
-- Adds a numeric title-level signal (1-10) to each experience, capturing
-- intra-band leveling that seniority_normalized misses (SDE I vs SDE II
-- are both 'individual_contributor' but have different levels).
--
-- Three new pieces:
--   1. title_level_dictionary — patterns that map title substrings to integer levels
--   2. person_experiences.title_level — extracted level per role (nullable)
--   3. people.title_level_slope — derived trajectory across recent roles

-- ── 1. Dictionary table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS title_level_dictionary (
  title_level_rule_id  SERIAL PRIMARY KEY,
  pattern              TEXT NOT NULL,
  match_type           TEXT NOT NULL DEFAULT 'contains'
    CHECK (match_type IN ('exact', 'contains', 'starts_with', 'ends_with', 'regex', 'contains_word')),
  title_level          SMALLINT NOT NULL CHECK (title_level BETWEEN 1 AND 10),
  priority             SMALLINT NOT NULL DEFAULT 10,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_title_level_dict_priority
  ON title_level_dictionary (priority, title_level_rule_id);

COMMENT ON TABLE title_level_dictionary IS
  'Patterns that extract a numeric level (1-10) from job titles. Higher number = more senior within a band. Scanned in priority order (lower = first); first match wins.';

-- ── 2. Per-experience column ────────────────────────────────────────────────

ALTER TABLE person_experiences
  ADD COLUMN IF NOT EXISTS title_level SMALLINT
    CHECK (title_level IS NULL OR title_level BETWEEN 1 AND 10);

COMMENT ON COLUMN person_experiences.title_level IS
  'Numeric leveling (1-10) extracted from the title text. Captures intra-band progression that seniority_normalized misses. 1=junior/entry, 10=distinguished/fellow.';

-- ── 3. Derived slope on people ──────────────────────────────────────────────

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS title_level_slope TEXT
    CHECK (title_level_slope IS NULL OR title_level_slope IN ('rising', 'flat', 'declining', 'insufficient_data'));

COMMENT ON COLUMN people.title_level_slope IS
  'Trajectory of title_level across the last 2-3 leveled full-time experiences. Only "rising" is a positive signal. Distinct from career_progression (which measures company-tier movement).';
