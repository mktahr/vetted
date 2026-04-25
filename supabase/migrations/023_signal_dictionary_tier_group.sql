-- Migration 023: Add tier_group column to signal_dictionary
-- Used to roll up affiliation-style signals under group toggles in search UI.

ALTER TABLE signal_dictionary
  ADD COLUMN IF NOT EXISTS tier_group TEXT;

CREATE INDEX IF NOT EXISTS idx_signal_dict_tier_group
  ON signal_dictionary (tier_group)
  WHERE tier_group IS NOT NULL;

-- Recreate the view to include tier_group
DROP VIEW IF EXISTS person_signals_active;

CREATE VIEW person_signals_active AS
SELECT
  ps.id,
  ps.person_id,
  ps.signal_id,
  sd.canonical_name,
  sd.category,
  sd.subcategory,
  sd.tier_group,
  sd.canonical_url,
  ps.evidence_url,
  ps.evidence_metadata,
  ps.source_text,
  ps.source,
  ps.confidence,
  ps.verified_by_admin,
  ps.detected_at
FROM person_signals ps
JOIN signal_dictionary sd ON sd.id = ps.signal_id
WHERE sd.is_active = TRUE
  AND COALESCE(ps.admin_override_status, '') != 'rejected';

GRANT SELECT ON person_signals_active TO anon;
