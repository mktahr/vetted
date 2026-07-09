-- 091_robotics_software_and_parent_widening.sql
--
-- Joanne resolution (Matt, 2026-07-07) + approved parent-widenings from the
-- 2026-07-05 vocab gap report.
--
--   • robotics_software_engineering (NEW, parent robotics_engineering) — the
--     "software engineer on the robot stack" archetype: builds the software layer
--     of robot systems (platform, infra, tooling, integration code) when the work
--     IS software but the domain IS the robot, AND no sharper specialty is
--     evidenced. Deliberately different from the generic robotics_software killed
--     in 086 (which restated titles unguarded): the prompt (cls-2026-07-08a) adds
--     an explicit guardrail — the sharper robotics specialties (perception,
--     autonomy, slam, motion_planning, controls) ALWAYS win when evidenced;
--     robotics_software is never the lazy default. Pairs with the Rule-5 robotics
--     carve-out: "Robotics Software Engineer" (and equivalents) routes to function
--     robotics_engineering when the work genuinely touches the robot stack —
--     modifier = the thing they BUILD (robotics) → that function; modifier =
--     industry/context (Mission, Defense) → software_engineering.
--   • thermal_engineering += aerospace_engineering — spacecraft/launch thermal
--     work is genuinely aerospace-homed (gap-report evidence; approved 2026-07-07).
--   • reliability_engineering += electrical_engineering — component/electronics
--     reliability work is genuinely EE-homed (gap-report evidence; approved
--     2026-07-07).
--
-- (Dev-only for now, same lockstep as 085–090: prod application + the person-data
--  cascade happen AT MERGE. Strip-review widenings — Guy Bitton autonomy, SeJun
--  motor_drives, Nick integration_test, Makai robotics-under-software — remain
--  PENDING Matt's in-app judgment and are NOT included here.)

BEGIN;

-- NOTE: the row already exists INACTIVE on dev (deactivated by 086 as an unguarded
-- title-restater with parents {robotics, software}). This REACTIVATES it under the
-- new guarded definition and the single robotics parent — the carve-out routes these
-- roles to function=robotics_engineering, so the software parent is intentionally gone.
INSERT INTO specialty_dictionary (specialty_normalized, parent_function, active, description) VALUES
  ('robotics_software_engineering', ARRAY['robotics_engineering'], true, 'Robot-stack software generalist — builds the software layer of robot systems (platform, infra, tooling, integration code) when the work IS software but the domain IS the robot. Only when no sharper robotics specialty (perception, autonomy, slam, motion_planning, controls) is evidenced — those always win; this is never the lazy default.')
ON CONFLICT (specialty_normalized) DO UPDATE
  SET parent_function = EXCLUDED.parent_function,
      active          = EXCLUDED.active,
      description     = EXCLUDED.description;

-- Parent-widenings: append, never replace (idempotent — skips if already present).
UPDATE specialty_dictionary
   SET parent_function = parent_function || ARRAY['aerospace_engineering']
 WHERE specialty_normalized = 'thermal_engineering'
   AND NOT ('aerospace_engineering' = ANY(parent_function));

UPDATE specialty_dictionary
   SET parent_function = parent_function || ARRAY['electrical_engineering']
 WHERE specialty_normalized = 'reliability_engineering'
   AND NOT ('electrical_engineering' = ANY(parent_function));

-- Verification (empty-DB tolerant: only checks rows this migration touches when present).
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM specialty_dictionary
   WHERE specialty_normalized = 'robotics_software_engineering'
     AND active AND parent_function = ARRAY['robotics_engineering'];
  IF n <> 1 THEN
    RAISE EXCEPTION '091 verification failed: robotics_software_engineering row missing or wrong parent';
  END IF;

  IF EXISTS (SELECT 1 FROM specialty_dictionary WHERE specialty_normalized = 'thermal_engineering')
     AND NOT EXISTS (SELECT 1 FROM specialty_dictionary WHERE specialty_normalized = 'thermal_engineering' AND 'aerospace_engineering' = ANY(parent_function)) THEN
    RAISE EXCEPTION '091 verification failed: thermal_engineering not widened to aerospace_engineering';
  END IF;

  IF EXISTS (SELECT 1 FROM specialty_dictionary WHERE specialty_normalized = 'reliability_engineering')
     AND NOT EXISTS (SELECT 1 FROM specialty_dictionary WHERE specialty_normalized = 'reliability_engineering' AND 'electrical_engineering' = ANY(parent_function)) THEN
    RAISE EXCEPTION '091 verification failed: reliability_engineering not widened to electrical_engineering';
  END IF;
END $$;

COMMIT;
