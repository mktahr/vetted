-- Migration 020: Add signal columns to specialty_dictionary
--
-- Activates the 3-pass specialty resolver in lib/normalize/specialty.ts
-- by adding the three TEXT[] columns it reads from:
--   1. title_patterns     — exact-match title strings (Pass 1)
--   2. keyword_signals    — keywords for title fragments + description scan (Pass 1b + 2)
--   3. technology_signals — tech/skill terms matched against skills_tags (Pass 3)

ALTER TABLE specialty_dictionary
  ADD COLUMN IF NOT EXISTS title_patterns      TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS keyword_signals     TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS technology_signals  TEXT[] NOT NULL DEFAULT '{}';

-- GIN indexes for fast array containment queries
CREATE INDEX IF NOT EXISTS idx_specialty_title_patterns
  ON specialty_dictionary USING GIN (title_patterns);

CREATE INDEX IF NOT EXISTS idx_specialty_keyword_signals
  ON specialty_dictionary USING GIN (keyword_signals);

CREATE INDEX IF NOT EXISTS idx_specialty_technology_signals
  ON specialty_dictionary USING GIN (technology_signals);
