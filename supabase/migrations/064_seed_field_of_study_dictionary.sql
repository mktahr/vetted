-- 064_seed_field_of_study_dictionary.sql
--
-- Seed field_of_study_dictionary (was empty since declared in migration 002).
-- Scope: STEM fields for hardware/deep-tech focus. Each row is a
-- (field_pattern → field_of_study_normalized) mapping. Multiple patterns
-- (aliases) can map to the same normalized value. Patterns are stored
-- lowercase; extractor lowercases person_education.field_of_study_raw before
-- looking up.
--
-- Domain groups: core_engineering, advanced_engineering, software_cs,
-- physical_sciences, life_sciences, math.

BEGIN;

INSERT INTO field_of_study_dictionary (field_pattern, field_of_study_normalized, domain_group, notes) VALUES
  -- ─── Core engineering ────────────────────────────────────────────────
  ('mechanical engineering',         'mechanical_engineering',         'core_engineering', NULL),
  ('mech e',                          'mechanical_engineering',         'core_engineering', 'shorthand'),
  ('meche',                           'mechanical_engineering',         'core_engineering', 'shorthand'),
  ('mech eng',                        'mechanical_engineering',         'core_engineering', 'shorthand'),
  ('me',                              'mechanical_engineering',         'core_engineering', 'shorthand — ambiguous; relies on context'),

  ('electrical engineering',          'electrical_engineering',         'core_engineering', NULL),
  ('ee',                              'electrical_engineering',         'core_engineering', 'shorthand'),

  ('electrical and computer engineering', 'electrical_and_computer_engineering', 'core_engineering', NULL),
  ('ece',                             'electrical_and_computer_engineering', 'core_engineering', 'shorthand'),
  ('eecs',                            'electrical_and_computer_engineering', 'core_engineering', 'common at MIT/Berkeley; maps to ECE'),

  ('computer engineering',            'computer_engineering',           'core_engineering', NULL),
  ('ce',                              'computer_engineering',           'core_engineering', 'shorthand'),

  ('computer science',                'computer_science',               'software_cs', NULL),
  ('cs',                              'computer_science',               'software_cs', 'shorthand'),
  ('comp sci',                        'computer_science',               'software_cs', 'shorthand'),

  ('aerospace engineering',           'aerospace_engineering',          'core_engineering', NULL),
  ('aero',                            'aerospace_engineering',          'core_engineering', 'shorthand'),
  ('aero eng',                        'aerospace_engineering',          'core_engineering', 'shorthand'),

  ('aeronautical engineering',        'aeronautical_engineering',       'core_engineering', NULL),
  ('astronautical engineering',       'astronautical_engineering',      'core_engineering', NULL),

  ('chemical engineering',            'chemical_engineering',           'core_engineering', NULL),
  ('cheme',                           'chemical_engineering',           'core_engineering', 'shorthand'),
  ('chem e',                          'chemical_engineering',           'core_engineering', 'shorthand'),

  ('biomedical engineering',          'biomedical_engineering',         'core_engineering', NULL),
  ('bme',                             'biomedical_engineering',         'core_engineering', 'shorthand'),

  ('bioengineering',                  'bioengineering',                 'core_engineering', NULL),

  ('materials science',               'materials_science_engineering',  'core_engineering', NULL),
  ('materials engineering',           'materials_science_engineering',  'core_engineering', NULL),
  ('materials science and engineering', 'materials_science_engineering','core_engineering', NULL),
  ('mse',                             'materials_science_engineering',  'core_engineering', 'shorthand'),

  ('civil engineering',               'civil_engineering',              'core_engineering', NULL),
  ('environmental engineering',       'environmental_engineering',      'core_engineering', NULL),
  ('industrial engineering',          'industrial_engineering',         'core_engineering', NULL),
  ('nuclear engineering',             'nuclear_engineering',            'core_engineering', NULL),
  ('petroleum engineering',           'petroleum_engineering',          'core_engineering', NULL),
  ('ocean engineering',               'ocean_engineering',              'core_engineering', NULL),

  ('optical engineering',             'photonics',                      'core_engineering', NULL),
  ('photonics',                       'photonics',                      'core_engineering', NULL),
  ('optical sciences',                'photonics',                      'core_engineering', NULL),

  ('engineering physics',             'engineering_physics',            'core_engineering', NULL),
  ('engineering science',             'engineering_science',            'core_engineering', NULL),

  -- ─── Robotics / systems / advanced ───────────────────────────────────
  ('robotics',                        'robotics',                       'advanced_engineering', NULL),
  ('mechatronics',                    'mechatronics',                   'advanced_engineering', NULL),
  ('systems engineering',             'systems_engineering',            'advanced_engineering', NULL),
  ('manufacturing engineering',       'manufacturing_engineering',      'advanced_engineering', NULL),
  ('control systems engineering',     'control_systems_engineering',    'advanced_engineering', NULL),
  ('control systems',                 'control_systems_engineering',    'advanced_engineering', 'shorthand'),
  ('controls',                        'control_systems_engineering',    'advanced_engineering', 'shorthand'),

  -- ─── Software / CS-adjacent ──────────────────────────────────────────
  ('software engineering',            'software_engineering',           'software_cs', NULL),
  ('sw eng',                          'software_engineering',           'software_cs', 'shorthand'),

  ('data science',                    'data_science',                   'software_cs', NULL),

  ('artificial intelligence',         'artificial_intelligence_ml',     'software_cs', NULL),
  ('machine learning',                'artificial_intelligence_ml',     'software_cs', NULL),
  ('ai',                              'artificial_intelligence_ml',     'software_cs', 'shorthand'),
  ('ml',                              'artificial_intelligence_ml',     'software_cs', 'shorthand'),
  ('ai/ml',                           'artificial_intelligence_ml',     'software_cs', NULL),

  ('cybersecurity',                   'cybersecurity',                  'software_cs', NULL),
  ('cyber security',                  'cybersecurity',                  'software_cs', NULL),
  ('information security',            'cybersecurity',                  'software_cs', NULL),

  ('information systems',             'information_systems',            'software_cs', NULL),

  -- ─── Physical sciences ───────────────────────────────────────────────
  ('physics',                         'physics',                        'physical_sciences', NULL),
  ('applied physics',                 'applied_physics',                'physical_sciences', NULL),
  ('astrophysics',                    'astrophysics',                   'physical_sciences', NULL),
  ('chemistry',                       'chemistry',                      'physical_sciences', NULL),

  -- ─── Life sciences ───────────────────────────────────────────────────
  ('life sciences',                   'life_sciences',                  'life_sciences', NULL),
  ('biology',                         'life_sciences',                  'life_sciences', 'rolls into life_sciences'),
  ('bio',                             'life_sciences',                  'life_sciences', 'shorthand'),
  ('molecular biology',               'life_sciences',                  'life_sciences', 'rolls into life_sciences'),
  ('biochemistry',                    'life_sciences',                  'life_sciences', 'rolls into life_sciences'),
  ('microbiology',                    'life_sciences',                  'life_sciences', 'rolls into life_sciences'),
  ('genetics',                        'life_sciences',                  'life_sciences', 'rolls into life_sciences'),

  ('neuroscience',                    'neuroscience',                   'life_sciences', 'kept distinct for neurotech/BCI'),
  ('cognitive neuroscience',          'neuroscience',                   'life_sciences', NULL),

  ('computational biology',           'computational_biology_bioinformatics', 'life_sciences', NULL),
  ('bioinformatics',                  'computational_biology_bioinformatics', 'life_sciences', NULL),
  ('comp bio',                        'computational_biology_bioinformatics', 'life_sciences', 'shorthand'),
  ('computational bio',               'computational_biology_bioinformatics', 'life_sciences', 'shorthand'),

  -- ─── Math ────────────────────────────────────────────────────────────
  ('mathematics',                     'mathematics',                    'math', NULL),
  ('math',                            'mathematics',                    'math', 'shorthand'),

  ('applied mathematics',             'applied_mathematics',            'math', NULL),
  ('applied math',                    'applied_mathematics',            'math', 'shorthand'),

  ('statistics',                      'statistics',                     'math', NULL),
  ('stats',                           'statistics',                     'math', 'shorthand'),

  ('operations research',             'operations_research',            'math', NULL),
  ('or',                              'operations_research',            'math', 'shorthand — ambiguous, low priority'),

  -- ─── Industrial design (mentioned in user spec) ──────────────────────
  ('industrial design',               'industrial_design',              'design', NULL);

DO $$
DECLARE
  total_rows INT;
  distinct_normalized INT;
BEGIN
  SELECT count(*) INTO total_rows FROM field_of_study_dictionary;
  SELECT count(DISTINCT field_of_study_normalized) INTO distinct_normalized FROM field_of_study_dictionary;
  RAISE NOTICE 'Migration 064: % field_of_study_dictionary rows seeded mapping to % distinct normalized values.', total_rows, distinct_normalized;
END $$;

COMMIT;
