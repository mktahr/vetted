-- 045_seed_competitions.sql
--
-- Seed the competitions table (and add 10 new signal_dictionary rows where needed).
--
-- TWO STEPS:
--   Step 1 — INSERT 10 new signal_dictionary rows for slugs that don't have
--            an existing entry (after migration 042's reclassifications).
--            These are the 9 Disposition-2 NEW competitions + 1 (irec) that
--            became "no existing match" after Rocket Team moved to Disposition 3.
--   Step 2 — INSERT 21 competitions rows (the full vetted_competitions.csv set).
--            For 11 of these, we look up the existing signal_dictionary row by
--            canonical_name (manual mapping table embedded in the CTE below).
--            For 10, the lookup hits the rows just inserted in Step 1.
--
-- Manual canonical_name mapping (slug → existing canonical_name in signal_dictionary):
--   fsae_ic         → 'Formula SAE'
--   fsae_ev         → 'Formula Electric'
--   baja_sae        → 'Baja SAE'
--   aiaa_dbf        → 'AIAA Design/Build/Fly'      (NOTE: slashes preserved)
--   usli            → 'NASA Student Launch'
--   urc             → 'Mars Rover Team'
--   robosub         → 'RoboSub'
--   roboboat        → 'RoboBoat'
--   suas            → 'Drone Team (SUAS)'
--   solar_challenge → 'Solar Car Team'
--   cubesat         → 'CubeSat Team'
--
-- Idempotent: ON CONFLICT (competition_slug) DO UPDATE; safe to re-run.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────
-- Step 1: 10 new signal_dictionary rows (category='competition')
-- ────────────────────────────────────────────────────────────────────────

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES
('SAE Aero Design',                     'competition', 'aerospace',           'tier_2', ARRAY['sae aero','sae aero design','aero design east','aero design west'], ARRAY['activities_honors','education_description','experience_description'], 'https://saeaerodesign.com', 'RC fixed-wing build; East and West venues', TRUE, TRUE),
('Spaceport America Cup (IREC)',        'competition', 'rocketry',            'tier_3', ARRAY['irec','spaceport america cup','spaceport america','esra cup'], ARRAY['activities_honors','education_description','experience_description'], 'https://soundingrocket.org', 'Highest-altitude collegiate rocketry; SRAD categories; top SpaceX pipeline', TRUE, TRUE),
('RoboCup',                             'competition', 'robotics',            'tier_2', ARRAY['robocup','robo cup','robocup federation'], ARRAY['activities_honors','education_description','experience_description'], 'https://robocup.org', 'Heavily research/grad; multiple sub-leagues (humanoid; soccer; @home)', TRUE, TRUE),
('Indy Autonomous Challenge',           'competition', 'autonomous_racing',   'tier_3', ARRAY['indy autonomous challenge','iac','indy av'], ARRAY['activities_honors','education_description','experience_description'], 'https://indyautonomouschallenge.com', 'High-speed autonomous racing; heavily PhD/research-led; top AV pipeline', TRUE, TRUE),
('F1Tenth Autonomous Racing',           'competition', 'autonomous_racing',   'tier_2', ARRAY['f1tenth','f1/10','f1 tenth','f1tenth racing'], ARRAY['activities_honors','education_description','experience_description'], 'https://f1tenth.org', '1/10 scale autonomous racing; UPenn-originated; accessible undergrad autonomy entry point', TRUE, TRUE),
('NASA Lunabotics',                     'competition', 'robotics',            'tier_2', ARRAY['lunabotics','nasa lunabotics','lunabotics challenge'], ARRAY['activities_honors','education_description','experience_description'], 'https://nasa.gov/lunabotics', 'Robotic mining; lunar regolith analog', TRUE, TRUE),
('Collegiate Cyber Defense Competition','competition', 'cyber',               'tier_2', ARRAY['ccdc','collegiate cyber defense','national ccdc','cyber defense competition'], ARRAY['activities_honors','education_description','experience_description','title','company_name'], 'https://nationalccdc.org', 'Defensive cyber; defense pipeline', TRUE, TRUE),
('Capture the Flag (Collegiate)',       'competition', 'cyber',               'tier_3', ARRAY['ctf','capture the flag','defcon ctf','csaw ctf','collegiate ctf'], ARRAY['activities_honors','education_description','experience_description'], 'https://ctftime.org', 'Offensive security; PPP-style elite collegiate teams', TRUE, TRUE),
('VFS Student Design Competition',      'competition', 'aerospace_rotorcraft','tier_2', ARRAY['vfs design','vfs student design','vertical flight society design','vfs sdc'], ARRAY['activities_honors','education_description','experience_description'], 'https://vtol.org', 'Vertical Flight Society annual rotorcraft / eVTOL design; Joby/Archer pipeline', TRUE, TRUE),
('VEX U',                               'competition', 'robotics',            'tier_1', ARRAY['vex u','vexu','vex university','vex robotics u'], ARRAY['activities_honors','education_description','experience_description'], 'https://roboticseducation.org', 'Collegiate VEX robotics; distinct from high-school VEX Robotics. Lower signal than other robotics competitions.', TRUE, TRUE)
ON CONFLICT (canonical_name, category) DO UPDATE SET
  subcategory        = EXCLUDED.subcategory,
  tier_group         = EXCLUDED.tier_group,
  aliases            = EXCLUDED.aliases,
  source_field_hints = EXCLUDED.source_field_hints,
  canonical_url      = EXCLUDED.canonical_url,
  description        = EXCLUDED.description,
  is_positive        = EXCLUDED.is_positive,
  is_active          = EXCLUDED.is_active,
  updated_at         = NOW();

-- ────────────────────────────────────────────────────────────────────────
-- Step 2: 21 competitions table rows
-- CTE provides slug → canonical_name mapping for signal_id lookup.
-- ────────────────────────────────────────────────────────────────────────

WITH competition_specs (slug, canonical_lookup, tier, governing_org, domain_primary, common_role_titles, grad_skew_typical, typical_team_size, us_focus, official_url, notes) AS (
  VALUES
  -- 11 mapped to existing signal_dictionary canonical_names
  ('fsae_ic',         'Formula SAE',                       3::SMALLINT, 'SAE International',                  'automotive',           ARRAY['Team Captain','Chief Engineer','Powertrain Lead','Chassis Lead','Suspension Lead','Aero Lead','Electronics Lead'], 'undergrad_majority', '50-150', TRUE,  'https://fsaeonline.com',                      'Combustion vehicle build; full systems integration'),
  ('fsae_ev',         'Formula Electric',                  3::SMALLINT, 'SAE International',                  'automotive_ev',        ARRAY['Team Captain','Chief Engineer','Battery Lead','Powertrain Lead','Embedded Lead','Controls Lead','HV Systems Lead'], 'undergrad_majority', '50-150', TRUE,  'https://fsaeonline.com',                      'EV with HV systems; direct power_electronics + embedded pipeline'),
  ('baja_sae',        'Baja SAE',                          2::SMALLINT, 'SAE International',                  'automotive_offroad',   ARRAY['Team Captain','Chief Engineer','Drivetrain Lead','Suspension Lead','Frame Lead'], 'undergrad_majority', '40-100', TRUE,  'https://bajasae.net',                         'Off-road durability; mech/manufacturing heavy; lighter on software'),
  ('aiaa_dbf',        'AIAA Design/Build/Fly',             3::SMALLINT, 'AIAA',                               'aerospace',            ARRAY['Team Captain','Chief Engineer','Aero Lead','Structures Lead','Avionics Lead'], 'undergrad_majority', '30-80', TRUE,  'https://aiaa.org/dbf',                        'Top US fixed-wing collegiate competition'),
  ('usli',            'NASA Student Launch',               2::SMALLINT, 'NASA',                               'rocketry',             ARRAY['Team Captain','Chief Engineer','Propulsion Lead','Avionics Lead','Payload Lead','Recovery Lead'], 'undergrad_majority', '20-60', TRUE,  'https://nasa.gov/studentlaunch',              'Mid-altitude high-power rocketry; payload focus'),
  ('urc',             'Mars Rover Team',                   3::SMALLINT, 'Mars Society',                       'robotics_planetary',   ARRAY['Team Captain','Mechanical Lead','Electronics Lead','Software Lead','Science Lead'], 'mixed',              '15-50', FALSE, 'https://urc.marssociety.org',                 'International event; many strong US teams compete'),
  ('robosub',         'RoboSub',                           2::SMALLINT, 'RoboNation',                         'robotics_marine',      ARRAY['Team Captain','Mechanical Lead','Electrical Lead','Software Lead','CV Lead'], 'mixed',              '15-40', TRUE,  'https://robosub.org',                         'Autonomous underwater vehicles; perception heavy'),
  ('roboboat',        'RoboBoat',                          2::SMALLINT, 'RoboNation',                         'robotics_marine',      ARRAY['Team Captain','Mechanical Lead','Electrical Lead','Software Lead'], 'undergrad_majority', '15-40', TRUE,  'https://roboboat.org',                        'Autonomous surface vessels'),
  ('suas',            'Drone Team (SUAS)',                 3::SMALLINT, 'AUVSI Foundation',                   'uav',                  ARRAY['Team Lead','Autonomy Lead','Imaging Lead','Mission Lead'], 'undergrad_majority', '15-40', TRUE,  'https://suas-competition.org',                'Defense-relevant autonomous UAV; payload/target ID'),
  ('solar_challenge', 'Solar Car Team',                    3::SMALLINT, 'Innovators Educational Foundation',  'energy',               ARRAY['Team Captain','Chief Engineer','Battery Lead','Solar Array Lead','Mechanical Lead','Strategy Lead'], 'undergrad_majority', '20-40', TRUE,  'https://americansolarchallenge.org',          'Solar EV cross-country and track racing'),
  ('cubesat',         'CubeSat Team',                      3::SMALLINT, 'NASA CSLI / AFRL UNP',               'space',                ARRAY['Project Lead','Mission Manager','Avionics Lead','Power Lead','Comms Lead','Structures Lead'], 'mixed',              '20-60', TRUE,  'https://nasa.gov/cubesats',                   'Real flight hardware; multi-year programs'),

  -- 10 from Step 1 above (newly inserted into signal_dictionary)
  ('sae_aero',        'SAE Aero Design',                       2::SMALLINT, 'SAE International',                  'aerospace',           ARRAY['Team Captain','Chief Engineer','Aero Lead','Structures Lead'], 'undergrad_majority', '30-80', TRUE,  'https://saeaerodesign.com',                   'RC fixed-wing build; East and West venues'),
  ('irec',            'Spaceport America Cup (IREC)',          3::SMALLINT, 'ESRA',                               'rocketry',            ARRAY['Team Captain','Chief Engineer','Propulsion Lead','Avionics Lead','Recovery Lead','Structures Lead'], 'mixed',              '20-80', TRUE,  'https://soundingrocket.org',                  'Highest-altitude collegiate rocketry; SRAD categories; top SpaceX pipeline'),
  ('robocup',         'RoboCup',                               2::SMALLINT, 'RoboCup Federation',                 'robotics',            ARRAY['Team Lead','Software Lead','Hardware Lead'], 'grad_majority',      '10-30', FALSE, 'https://robocup.org',                         'Heavily research/grad; multiple sub-leagues'),
  ('iac',             'Indy Autonomous Challenge',             3::SMALLINT, 'Energy Systems Network',             'autonomous_racing',   ARRAY['Team Lead','Perception Lead','Controls Lead','Planning Lead'], 'grad_majority',      '15-40', TRUE,  'https://indyautonomouschallenge.com',         'Heavily PhD/research-led; top AV pipeline'),
  ('f1tenth',         'F1Tenth Autonomous Racing',             2::SMALLINT, 'F1Tenth Foundation',                 'autonomous_racing',   ARRAY['Team Lead','Software Lead'], 'mixed',              '5-15', FALSE, 'https://f1tenth.org',                         'More accessible undergrad autonomy entry point'),
  ('lunabotics',      'NASA Lunabotics',                       2::SMALLINT, 'NASA',                               'robotics',            ARRAY['Team Lead','Mechanical Lead','Software Lead'], 'mixed',              '15-30', TRUE,  'https://nasa.gov/lunabotics',                 'Robotic mining; lunar regolith analog'),
  ('ccdc',            'Collegiate Cyber Defense Competition',  2::SMALLINT, 'National CCDC',                      'cyber',               ARRAY['Team Captain','Network Lead','Incident Response Lead'], 'undergrad_majority', '8-12', TRUE,  'https://nationalccdc.org',                    'Defensive cyber; defense pipeline'),
  ('ctf',             'Capture the Flag (Collegiate)',         3::SMALLINT, 'multiple',                           'cyber',               ARRAY['Team Captain','Pwn Lead','Web Lead','Crypto Lead','Reverse Engineering Lead'], 'mixed',              '5-20', TRUE,  'https://ctftime.org',                         'Offensive security; PPP-style elite teams'),
  ('vfs_design',      'VFS Student Design Competition',        2::SMALLINT, 'Vertical Flight Society',            'aerospace_rotorcraft', ARRAY['Team Lead','Aero Lead','Structures Lead'], 'mixed',              '10-25', TRUE,  'https://vtol.org',                            'Rotorcraft / eVTOL design; Joby/Archer pipeline'),
  ('vex_u',           'VEX U',                                 1::SMALLINT, 'REC Foundation',                     'robotics',            ARRAY['Team Captain','Builder Lead','Programmer Lead'], 'undergrad_majority', '5-15', TRUE,  'https://roboticseducation.org',               'Lower signal than other robotics; more accessible')
)
INSERT INTO competitions (signal_id, competition_slug, tier_int, governing_org, domain_primary, common_role_titles, grad_skew_typical, typical_team_size, us_focus, official_url, notes)
SELECT
  (SELECT id FROM signal_dictionary WHERE canonical_name = cs.canonical_lookup AND category = 'competition'),
  cs.slug, cs.tier, cs.governing_org, cs.domain_primary, cs.common_role_titles, cs.grad_skew_typical, cs.typical_team_size, cs.us_focus, cs.official_url, cs.notes
FROM competition_specs cs
ON CONFLICT (competition_slug) DO UPDATE SET
  tier_int           = EXCLUDED.tier_int,
  governing_org      = EXCLUDED.governing_org,
  domain_primary     = EXCLUDED.domain_primary,
  common_role_titles = EXCLUDED.common_role_titles,
  grad_skew_typical  = EXCLUDED.grad_skew_typical,
  typical_team_size  = EXCLUDED.typical_team_size,
  us_focus           = EXCLUDED.us_focus,
  official_url       = EXCLUDED.official_url,
  notes              = EXCLUDED.notes,
  updated_at         = NOW();

-- Sanity check: verify all 21 rows inserted with non-NULL signal_id
DO $$
DECLARE
  null_signal_count INT;
BEGIN
  SELECT count(*) INTO null_signal_count FROM competitions WHERE signal_id IS NULL;
  IF null_signal_count > 0 THEN
    RAISE EXCEPTION 'Migration 045: % competitions rows have NULL signal_id. The canonical_name lookup failed for at least one slug. Check that migration 042 reclassified all expected rows and that Step 1 above ran successfully.', null_signal_count;
  END IF;
  RAISE NOTICE 'Migration 045: 21 competitions seeded successfully.';
END $$;

COMMIT;
