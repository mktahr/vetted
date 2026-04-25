-- Migration 022: Signals system schema foundation
--
-- Polymorphic person-level attribute system. New signal categories are
-- added as data rows in signal_dictionary, not as schema migrations.
--
-- Tables:
--   signal_dictionary  — canonical taxonomy of every detectable signal
--   person_signals     — join table: one row per (person, signal, source)
--
-- View:
--   person_signals_active — filtered view excluding rejected/inactive signals
--                           (all app queries go through this view)

-- ============================================================
-- TABLE A: signal_dictionary
-- ============================================================

CREATE TABLE signal_dictionary (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  canonical_name    TEXT NOT NULL,
  category          TEXT NOT NULL CHECK (category IN (
    'fellowship', 'scholarship', 'hackathon', 'greek_life', 'athletics',
    'engineering_team', 'student_leadership', 'academic_distinction',
    'founder', 'open_source', 'publication', 'patent', 'speaking',
    'writing', 'military', 'hospitality', 'teaching', 'career_changer',
    'self_taught', 'language', 'other'
  )),
  subcategory       TEXT,
  aliases           TEXT[] NOT NULL DEFAULT '{}',

  source_field_hints TEXT[] NOT NULL DEFAULT '{}',
  -- CHECK deferred: values validated at application layer
  -- Allowed: 'activities_honors', 'volunteer', 'education_description',
  --          'experience_description', 'projects', 'publications',
  --          'certifications', 'headline', 'about', 'title',
  --          'company_name', 'external'

  canonical_url     TEXT,
  description       TEXT,
  is_positive       BOOLEAN NOT NULL DEFAULT TRUE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  notes             TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (canonical_name, category)
);

-- Indexes
CREATE INDEX idx_signal_dict_category
  ON signal_dictionary (category);

CREATE INDEX idx_signal_dict_active_category
  ON signal_dictionary (is_active, category);

CREATE INDEX idx_signal_dict_aliases
  ON signal_dictionary USING GIN (aliases);

-- ============================================================
-- TABLE B: person_signals
-- ============================================================

CREATE TABLE person_signals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  person_id             UUID NOT NULL REFERENCES people(person_id) ON DELETE CASCADE,
  signal_id             UUID NOT NULL REFERENCES signal_dictionary(id) ON DELETE CASCADE,

  source                TEXT NOT NULL CHECK (source IN (
    'pattern_extractor', 'claude_classifier', 'github_enrichment',
    'scholar_enrichment', 'patents_enrichment', 'manual_admin'
  )),

  source_experience_id  UUID REFERENCES person_experiences(person_experience_id) ON DELETE SET NULL,
  source_education_id   UUID REFERENCES person_education(person_education_id) ON DELETE SET NULL,

  source_text           TEXT,
  evidence_url          TEXT,
  evidence_metadata     JSONB NOT NULL DEFAULT '{}',

  detected_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence            NUMERIC(3,2) NOT NULL DEFAULT 1.0
                        CHECK (confidence >= 0 AND confidence <= 1),

  verified_by_admin     BOOLEAN NOT NULL DEFAULT FALSE,
  admin_override_status TEXT CHECK (admin_override_status IN ('confirmed', 'rejected')),
  admin_notes           TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique: one row per (person, signal, source experience, source education)
-- Uses COALESCE to handle NULL FK columns in the uniqueness check
CREATE UNIQUE INDEX person_signals_unique_idx
  ON person_signals (
    person_id,
    signal_id,
    COALESCE(source_experience_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(source_education_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- Lookup indexes
CREATE INDEX idx_person_signals_person_id
  ON person_signals (person_id);

CREATE INDEX idx_person_signals_signal_id
  ON person_signals (signal_id);

CREATE INDEX idx_person_signals_signal_person
  ON person_signals (signal_id, person_id);

CREATE INDEX idx_person_signals_confidence
  ON person_signals (confidence DESC);

CREATE INDEX idx_person_signals_override
  ON person_signals (admin_override_status)
  WHERE admin_override_status IS NOT NULL;

CREATE INDEX idx_person_signals_detected
  ON person_signals (detected_at DESC);

-- ============================================================
-- VIEW: person_signals_active
-- ============================================================
-- All app queries go through this view. Admin rejections and
-- inactive dictionary entries are automatically filtered out.

CREATE VIEW person_signals_active AS
SELECT
  ps.id,
  ps.person_id,
  ps.signal_id,
  sd.canonical_name,
  sd.category,
  sd.subcategory,
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

-- ============================================================
-- RLS policies (anon read access for the app)
-- ============================================================

ALTER TABLE signal_dictionary ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read signal_dictionary"
  ON signal_dictionary FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon read person_signals"
  ON person_signals FOR SELECT TO anon USING (true);

-- Grant SELECT on the view to anon
GRANT SELECT ON person_signals_active TO anon;
