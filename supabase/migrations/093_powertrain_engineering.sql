-- 093_powertrain_engineering.sql
--
-- SeJun strip-review resolution (Matt GO, 2026-07-07): his entire career is
-- powertrain (Senior Mechanical Engineer <- Powertrain Engineer <- Powertrain
-- Mechanical Engineer <- Transmission Design Engineer <- Powertrain Lead <-
-- Drivetrain/Baja SAE) and the vocabulary could not express it — the model
-- reached for motor_drives_engineering (electric motor control, parents
-- electrical/controls — a DIFFERENT discipline), the parent guard correctly
-- stripped it, and the cls-2026-07-08a evidence bar then correctly left empty.
-- Correct strip, missing row.
--
-- Multi-parent [mechanical, electrical]: genuine cross in the EV era —
-- powertrain teams span mechanical (gearboxes, transmissions, driveline) and
-- electrical (e-motors, inverters, traction systems). Real searchable hard-tech
-- automotive archetype.
--
-- (Dev-only for now, same lockstep as 085–091: prod application at merge.)

BEGIN;

INSERT INTO specialty_dictionary (specialty_normalized, parent_function, active, description) VALUES
  ('powertrain_engineering', ARRAY['mechanical_engineering','electrical_engineering'], true, 'Powertrain / drivetrain engineer — designs and develops propulsion and power-transmission systems (engines, transmissions, drivelines, EV traction motors/inverters at the system level). Distinct from motor_drives_engineering (motor CONTROL electronics) and from vehicle_engineering generalists.')
ON CONFLICT (specialty_normalized) DO UPDATE
  SET parent_function = EXCLUDED.parent_function,
      active          = EXCLUDED.active,
      description     = EXCLUDED.description;

-- Verification (empty-DB tolerant: checks only the row this migration guarantees).
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM specialty_dictionary
   WHERE specialty_normalized = 'powertrain_engineering'
     AND active AND parent_function = ARRAY['mechanical_engineering','electrical_engineering'];
  IF n <> 1 THEN
    RAISE EXCEPTION '093 verification failed: powertrain_engineering row missing or wrong parents';
  END IF;
END $$;

COMMIT;
