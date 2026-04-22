-- Migration 012 — Person-level specialty columns
--
-- Adds aggregated specialty fields to people, computed from
-- per-experience specialty_normalized with recency weighting.

ALTER TABLE people ADD COLUMN IF NOT EXISTS primary_specialty TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS secondary_specialty TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS historical_specialty TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS specialty_transition_flag BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN people.primary_specialty IS
  'Specialty from the most recent non-internship role. Resolved via specialty_dictionary title_patterns, keyword_signals, or technology_signals.';
COMMENT ON COLUMN people.secondary_specialty IS
  'Second most common specialty across all roles (if meaningfully different from primary).';
COMMENT ON COLUMN people.historical_specialty IS
  'Dominant specialty from older roles if it differs from primary — indicates a career transition.';
COMMENT ON COLUMN people.specialty_transition_flag IS
  'True if primary_specialty differs from historical_specialty in a meaningful way (different function tracks).';
