-- 086_five_axis_taxonomy_cleanup.sql
--
-- Cleanup of the bulk _engineering suffix (085), per Matt + Codex alignment.
-- Governing principle: SPECIALTY = engineer TYPE (what they BUILD); SKILL = domain
-- context they TOUCHED; FUNCTION = the engineering discipline.
--
-- (Dev-first; prod + person-data cascade at merge.)

BEGIN;

-- 1. Deprecate specialties that aren't engineer-TYPES under the locked principle:
--    - technical_program_management_engineering: TPM is program management (excluded,
--      like the analyst case) — route TPM work to function='unknown', NOT a kept
--      engineering specialty (engineering-only V1).
--    - hardware_description_languages / kinematics / machining / prototyping: these are
--      SKILLS/techniques/activities, not engineer types -> moved to the skills axis (below).
--    - autonomy_software / controls_software / embedded_software: MERGE into the existing
--      autonomy_engineering / controls_engineering / embedded_engineering (same archetype;
--      the function axis already distinguishes software vs the discipline).
--    - robotics_software: too generic + would collide with the robotics_engineering
--      FUNCTION name; the robotics function's specific specialties cover the real types.
UPDATE specialty_dictionary SET active = false
 WHERE specialty_normalized IN (
   'technical_program_management_engineering',
   'hardware_description_languages_engineering', 'kinematics_engineering',
   'machining_engineering', 'prototyping_engineering',
   'autonomy_software_engineering', 'controls_software_engineering',
   'embedded_software_engineering', 'robotics_software_engineering'
 );

-- 2. metallurgy_engineering -> metallurgical_engineering (grammatically real type).
UPDATE specialty_dictionary SET specialty_normalized = 'metallurgical_engineering'
 WHERE specialty_normalized = 'metallurgy_engineering';

-- 3. De-double-tail the remaining X_software_engineering names (drop the redundant
--    _software; these don't collide). (slam_engineering KEPT as a real archetype.)
UPDATE specialty_dictionary SET specialty_normalized = 'flight_engineering'      WHERE specialty_normalized = 'flight_software_engineering';
UPDATE specialty_dictionary SET specialty_normalized = 'ground_engineering'      WHERE specialty_normalized = 'ground_software_engineering';
UPDATE specialty_dictionary SET specialty_normalized = 'mission_engineering'     WHERE specialty_normalized = 'mission_software_engineering';
UPDATE specialty_dictionary SET specialty_normalized = 'perception_engineering'  WHERE specialty_normalized = 'perception_software_engineering';
UPDATE specialty_dictionary SET specialty_normalized = 'simulation_engineering'  WHERE specialty_normalized = 'simulation_software_engineering';

-- 4. Move the deprecated technique/language/activity values onto the SKILLS axis.
INSERT INTO skills_dictionary (canonical_name, category, aliases, is_active, is_searchable) VALUES
  ('hardware_description_languages', 'programming_language', ARRAY['hdl','verilog','vhdl','systemverilog'], true, true),
  ('kinematics',                     'domain',               ARRAY['forward_kinematics','inverse_kinematics'], true, true),
  ('machining',                      'methodology',          ARRAY['cnc','milling','turning'], true, true),
  ('prototyping',                    'methodology',          ARRAY['rapid_prototyping','prototype'], true, true)
ON CONFLICT (canonical_name) DO NOTHING;

COMMIT;
