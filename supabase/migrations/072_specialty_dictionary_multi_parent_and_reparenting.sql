-- 072_specialty_dictionary_multi_parent_and_reparenting.sql
--
-- Sub-PR 2b of the five-axis candidate taxonomy rebuild
-- (ROADMAP item #2, second migration of the sub-PR after 071).
--
-- Restructures specialty_dictionary on top of the new 16-function model
-- introduced in migration 071:
--   1. Drop the single-value FK constraint on parent_function so the
--      column can become an array.
--   2. Convert parent_function from TEXT → TEXT[] (multi-parent). Existing
--      single values become single-element arrays; existing NULL becomes
--      ARRAY[]::TEXT[].
--   3. Delete 4 title-like specialties (chief_engineer, distinguished_engineer,
--      engineering_management, principal_engineer) — leadership is a
--      seniority axis (migration 067), not a specialty.
--   4. Delete 1 redundant specialty (data_engineering) — the function of
--      the same name (migration 071) takes its place. Specialty named
--      identically to its parent function causes ambiguity for LLM ingest
--      inference in sub-PR 3.
--   5. Clean role_specialty_map references to the 5 deleted specialties
--      first (no FK CASCADE exists between role_specialty_map and
--      specialty_dictionary — confirmed by direct query 2026-06-XX).
--   6. Reparent the remaining 225 specialties under the new 16-function
--      taxonomy. Multi-parent applied to 35 of 166 active specialties
--      (~21%) where the discipline genuinely spans two or three
--      categories; single-parent for the rest.
--   7. Reparent 5 legacy non-engineering specialties under active eng
--      sub-functions (locked redlines):
--        mechanical_design_engineering → [mechanical_engineering]
--        human_factors_engineering     → [systems_engineering]
--        forward_deployed_engineering  → [software_engineering]
--        solutions_engineering         → [software_engineering]
--        hardware_product_design       → [hardware_engineering]
--   8. Deactivate 59 non-engineering specialties (V1 scope cut) and
--      reparent them under the rebranded inactive parents
--      (product_management / product_design) or their existing
--      now-inactive parents (sales / marketing / etc.).
--
-- WHY no FK on the TEXT[] column:
--   PostgreSQL does not support multi-value FKs natively. Same pattern
--   as companies.industries[] (migration 031) and companies.domain_tags[]
--   — array membership is enforced at the application layer (in this
--   case, scripts/sync-reference.mjs validates that every element of
--   parent_function exists in function_dictionary before writes).
--
--   parent_function semantics: HINT metadata for LLM ingest inference
--   (sub-PR 3), NOT a hard restriction. The LLM picks any function from
--   active function_dictionary based on candidate's actual work.
--   parent_function tells the LLM "these are typical homes for this
--   specialty" — soft suggestion, not enforced constraint.
--
-- ARITHMETIC (locked, see CHANGELOG 2026-06-XX):
--   Before:    230 rows  (141 eng + 49 NULL + 36 non-eng + 4 founder)
--   DELETE:      5 rows  (4 title-like + 1 redundant data_engineering)
--   After:     225 rows
--   Active:    166 rows  (137 eng-reparented + 20 NULL-reparented +
--                          5 legacy-non-eng-redlined + 4 founder)
--   Inactive:   59 rows  (28 NULL-inactive + 31 legacy-non-eng-inactive)
--   Multi-parent assignments: 45 of 166 active (~27%)
--
-- WORKFLOW (per dev/prod split established in commit 26a02bc):
--   1. npm run migrate:dev  -- supabase/migrations/072_*.sql
--   2. Verify on dev (counts match, no orphan parent values, no broken
--      role_specialty_map references)
--   3. npm run migrate:prod -- supabase/migrations/072_*.sql
--
-- ADDITIVE / NON-ADDITIVE: NON-ADDITIVE. DELETEs 5 specialty rows + 5
-- role_specialty_map rows. ALTERs parent_function type from TEXT to TEXT[].
-- Drops the parent_function FK. Mass UPDATEs every specialty row's
-- parent_function. Reversible only via migration replay against backup —
-- specialties + role_specialty_map rows being deleted are dictionary
-- entries, not user data, so loss is acceptable per Rule 6.

BEGIN;

-- ─── Pre-migration state capture ───────────────────────────────────────
-- Capture pre-DELETE total so the verification block can assert delta
-- rather than absolute count (portable across dev/prod where pre-state
-- row counts differ — dev has fewer pre-migration specialties than prod).
CREATE TEMPORARY TABLE _072_premig_state ON COMMIT DROP AS
  SELECT count(*)::INT AS pre_total FROM specialty_dictionary;

-- ─── Step 1: Clean role_specialty_map orphans (5 rows) ──────────────────
DELETE FROM role_specialty_map
WHERE specialty_normalized IN (
  'chief_engineer',
  'distinguished_engineer',
  'engineering_management',
  'principal_engineer',
  'data_engineering'
);

-- ─── Step 2: Delete 4 title-like + 1 redundant specialties ──────────────
-- Leadership is a seniority axis (migration 067), not a specialty.
-- data_engineering specialty is redundant with the new function of the
-- same name (migration 071).
DELETE FROM specialty_dictionary
WHERE specialty_normalized IN (
  'chief_engineer',
  'distinguished_engineer',
  'engineering_management',
  'principal_engineer',
  'data_engineering'
);

-- ─── Step 3: Drop the single-value FK on parent_function ────────────────
ALTER TABLE specialty_dictionary
  DROP CONSTRAINT specialty_dictionary_parent_function_fkey;

-- ─── Step 4: Convert parent_function from TEXT to TEXT[] ────────────────
-- NULL → ARRAY[]::TEXT[]   (empty array, not NULL — easier for app code)
-- 'engineering' → ARRAY['engineering']   (single-element array)
ALTER TABLE specialty_dictionary
  ALTER COLUMN parent_function TYPE TEXT[]
  USING (CASE
    WHEN parent_function IS NULL THEN ARRAY[]::TEXT[]
    ELSE ARRAY[parent_function]
  END);

ALTER TABLE specialty_dictionary
  ALTER COLUMN parent_function SET DEFAULT ARRAY[]::TEXT[];

ALTER TABLE specialty_dictionary
  ALTER COLUMN parent_function SET NOT NULL;

CREATE INDEX idx_specialty_parent_function
  ON specialty_dictionary USING GIN (parent_function);

COMMENT ON COLUMN specialty_dictionary.parent_function IS
  'Multi-parent function array. HINT metadata for LLM ingest inference (sub-PR 3) — soft suggestion of typical disciplines for this specialty, NOT a hard restriction. No FK constraint — Postgres lacks native multi-value FK; array membership validated at app layer in scripts/sync-reference.mjs.';

-- ─── Step 5: Reparent engineering-parented specialties (137 active rows) ─

-- → aerospace_engineering (single, 9)
UPDATE specialty_dictionary SET parent_function = ARRAY['aerospace_engineering']
WHERE specialty_normalized IN (
  'aerodynamics','flight_dynamics','flight_test','ground_test',
  'mission_integration','mission_systems','orbital_mechanics',
  'satcom_engineering','space_systems'
);

-- → aerospace + electrical (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['aerospace_engineering','electrical_engineering']
WHERE specialty_normalized = 'avionics';

-- → aerospace + controls (2)
UPDATE specialty_dictionary SET parent_function = ARRAY['aerospace_engineering','controls_engineering']
WHERE specialty_normalized IN ('gnc','guidance_engineering');

-- → aerospace + controls + robotics (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['aerospace_engineering','controls_engineering','robotics_engineering']
WHERE specialty_normalized = 'navigation_engineering';

-- → aerospace + software (3)
UPDATE specialty_dictionary SET parent_function = ARRAY['aerospace_engineering','software_engineering']
WHERE specialty_normalized IN ('flight_software','ground_software','mission_software');

-- → aerospace + mechanical (3)
UPDATE specialty_dictionary SET parent_function = ARRAY['aerospace_engineering','mechanical_engineering']
WHERE specialty_normalized IN ('propulsion','aerospace_structures','fluid_dynamics');

-- → robotics_engineering (single, 7)
UPDATE specialty_dictionary SET parent_function = ARRAY['robotics_engineering']
WHERE specialty_normalized IN (
  'actuator_engineering','autonomous_systems_engineering','autonomy_engineering',
  'kinematics','motion_planning','robotic_manipulation','robotic_navigation'
);

-- → robotics + software (4)
UPDATE specialty_dictionary SET parent_function = ARRAY['robotics_engineering','software_engineering']
WHERE specialty_normalized IN (
  'autonomy_software','robotics_software','robotics_integration','ros_engineering'
);

-- → robotics + ml (4)
UPDATE specialty_dictionary SET parent_function = ARRAY['robotics_engineering','ml_engineering']
WHERE specialty_normalized IN (
  'perception_software','robotic_perception','sensor_fusion','slam'
);

-- → controls_engineering (single, 2)
UPDATE specialty_dictionary SET parent_function = ARRAY['controls_engineering']
WHERE specialty_normalized IN ('control_systems','controls_software');

-- → controls + electrical + mechanical (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['controls_engineering','electrical_engineering','mechanical_engineering']
WHERE specialty_normalized = 'controls_engineering';

-- → controls + electrical (2)
UPDATE specialty_dictionary SET parent_function = ARRAY['controls_engineering','electrical_engineering']
WHERE specialty_normalized IN ('motor_control','servo_engineering');

-- → electrical_engineering (single, 13)
UPDATE specialty_dictionary SET parent_function = ARRAY['electrical_engineering']
WHERE specialty_normalized IN (
  'analog_design','antenna_design','communications_engineering','dsp_engineering',
  'electrical_engineering','microwave_engineering','power_electronics','power_systems',
  'radar_engineering','rf_engineering','schematic_capture','signal_integrity',
  'wireless_engineering'
);

-- → electrical + hardware (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['electrical_engineering','hardware_engineering']
WHERE specialty_normalized = 'pcb_design';

-- → electrical + controls (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['electrical_engineering','controls_engineering']
WHERE specialty_normalized = 'motor_drives';

-- → electrical + mechanical + hardware (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['electrical_engineering','mechanical_engineering','hardware_engineering']
WHERE specialty_normalized = 'battery_engineering';

-- → optics_engineering (single, 5)
UPDATE specialty_dictionary SET parent_function = ARRAY['optics_engineering']
WHERE specialty_normalized IN (
  'imaging_systems','laser_engineering','optical_design','optics_engineering',
  'photonics_engineering'
);

-- → optics + mechanical (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['optics_engineering','mechanical_engineering']
WHERE specialty_normalized = 'optomechanical_engineering';

-- → chip_engineering (single, 7)
UPDATE specialty_dictionary SET parent_function = ARRAY['chip_engineering']
WHERE specialty_normalized IN (
  'asic_engineering','chip_architecture','chip_verification','fpga_engineering',
  'hardware_description_languages','physical_design','soc_design'
);

-- → chip + electrical (2)
UPDATE specialty_dictionary SET parent_function = ARRAY['chip_engineering','electrical_engineering']
WHERE specialty_normalized IN ('digital_design','mixed_signal_design');

-- → hardware_engineering (single, 3)
UPDATE specialty_dictionary SET parent_function = ARRAY['hardware_engineering']
WHERE specialty_normalized IN ('hardware_design','hardware_engineering','hardware_integration');

-- → hardware + firmware (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['hardware_engineering','firmware_engineering']
WHERE specialty_normalized = 'embedded_hardware';

-- → mechanical_engineering (single, 11)
UPDATE specialty_dictionary SET parent_function = ARRAY['mechanical_engineering']
WHERE specialty_normalized IN (
  'cad_design','fea_analysis','mechanical_design','mechanical_engineering',
  'mechanism_design','prototyping','stress_analysis','structural_engineering',
  'thermal_engineering','vibration_analysis','packaging_engineering'
);

-- → mechanical + electrical (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['mechanical_engineering','electrical_engineering']
WHERE specialty_normalized = 'electromechanical_engineering';

-- → mechanical + electrical + controls (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['mechanical_engineering','electrical_engineering','controls_engineering']
WHERE specialty_normalized = 'mechatronics';

-- → materials_engineering (single, 5)
UPDATE specialty_dictionary SET parent_function = ARRAY['materials_engineering']
WHERE specialty_normalized IN (
  'ceramics_engineering','materials_characterization','materials_engineering',
  'metallurgy','polymer_engineering'
);

-- → materials + aerospace (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['materials_engineering','aerospace_engineering']
WHERE specialty_normalized = 'composites_engineering';

-- → manufacturing_engineering (single, 7)
UPDATE specialty_dictionary SET parent_function = ARRAY['manufacturing_engineering']
WHERE specialty_normalized IN (
  'assembly_engineering','dfm_engineering','fabrication_engineering','machining',
  'manufacturing_engineering','process_engineering','production_engineering'
);

-- → manufacturing + mechanical (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['manufacturing_engineering','mechanical_engineering']
WHERE specialty_normalized = 'tooling_engineering';

-- → manufacturing + controls (1) — automation_engineering at hard-tech
--   companies sits in manufacturing org + uses PLC/controls extensively
--   (SpaceX Automation & Controls Engineer; Tesla Automation Engineer,
--   Manufacturing Engineering — sourced 2026-06-XX, see CHANGELOG).
UPDATE specialty_dictionary SET parent_function = ARRAY['manufacturing_engineering','controls_engineering']
WHERE specialty_normalized = 'automation_engineering';

-- → manufacturing + systems (2)
UPDATE specialty_dictionary SET parent_function = ARRAY['manufacturing_engineering','systems_engineering']
WHERE specialty_normalized IN ('industrial_engineering','supply_chain_engineering');

-- → firmware_engineering (single, 6)
UPDATE specialty_dictionary SET parent_function = ARRAY['firmware_engineering']
WHERE specialty_normalized IN (
  'bootloader_engineering','firmware','kernel_engineering','real_time_systems',
  'rtos_engineering','driver_engineering'
);

-- → firmware + software (2)
UPDATE specialty_dictionary SET parent_function = ARRAY['firmware_engineering','software_engineering']
WHERE specialty_normalized IN ('embedded_software','low_level_systems');

-- → systems_engineering (single, 4)
UPDATE specialty_dictionary SET parent_function = ARRAY['systems_engineering']
WHERE specialty_normalized IN (
  'model_based_systems_engineering','requirements_engineering',
  'systems_architecture','systems_engineering'
);

-- → test_engineering (single, 8)
UPDATE specialty_dictionary SET parent_function = ARRAY['test_engineering']
WHERE specialty_normalized IN (
  'certification_engineering','environmental_testing','integration_test',
  'qualification_engineering','software_in_loop','test_engineering',
  'validation_engineering','verification_engineering'
);

-- → test + controls (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['test_engineering','controls_engineering']
WHERE specialty_normalized = 'hardware_in_loop';

-- → test + manufacturing (2)
UPDATE specialty_dictionary SET parent_function = ARRAY['test_engineering','manufacturing_engineering']
WHERE specialty_normalized IN ('quality_engineering','reliability_engineering');

-- → test + materials (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['test_engineering','materials_engineering']
WHERE specialty_normalized = 'failure_analysis';

-- → software_engineering (single, 4)
UPDATE specialty_dictionary SET parent_function = ARRAY['software_engineering']
WHERE specialty_normalized IN (
  'api_engineering','distributed_systems','simulation_software',
  'technical_program_management'
);

-- → ml_engineering (single, 1)
UPDATE specialty_dictionary SET parent_function = ARRAY['ml_engineering']
WHERE specialty_normalized = 'applied_ml';

-- → ml + software (2)
UPDATE specialty_dictionary SET parent_function = ARRAY['ml_engineering','software_engineering']
WHERE specialty_normalized IN ('ml_infrastructure','ml_ops');

-- → data_engineering + software (2)
UPDATE specialty_dictionary SET parent_function = ARRAY['data_engineering','software_engineering']
WHERE specialty_normalized IN ('analytics_engineering','data_platform');

-- ─── Step 6: Reparent NULL-parented active specialties (20 rows) ─────────

-- → ml_engineering (4)
UPDATE specialty_dictionary SET parent_function = ARRAY['ml_engineering']
WHERE specialty_normalized IN ('ai_research','computer_vision','ml_engineering','nlp');

-- → software_engineering (12)
UPDATE specialty_dictionary SET parent_function = ARRAY['software_engineering']
WHERE specialty_normalized IN (
  'backend','blockchain','devops','frontend','fullstack','game_engineering',
  'infrastructure','mobile_android','mobile_ios','platform','security','sre'
);

-- → data_engineering (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['data_engineering']
WHERE specialty_normalized = 'data_analytics';

-- → firmware_engineering (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['firmware_engineering']
WHERE specialty_normalized = 'embedded';

-- → robotics_engineering (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['robotics_engineering']
WHERE specialty_normalized = 'robotics';

-- → test_engineering (1)
UPDATE specialty_dictionary SET parent_function = ARRAY['test_engineering']
WHERE specialty_normalized = 'qa_testing';

-- ─── Step 7: Redline reparents — legacy non-eng → active eng sub-fn (5) ──
-- Per locked redline review 2026-06-XX. These 5 stay active because the
-- work genuinely sits in V1 engineering scope despite their old parent.

UPDATE specialty_dictionary SET parent_function = ARRAY['mechanical_engineering']
WHERE specialty_normalized = 'mechanical_design_engineering';

UPDATE specialty_dictionary SET parent_function = ARRAY['systems_engineering']
WHERE specialty_normalized = 'human_factors_engineering';

UPDATE specialty_dictionary SET parent_function = ARRAY['software_engineering']
WHERE specialty_normalized IN ('forward_deployed_engineering','solutions_engineering');

UPDATE specialty_dictionary SET parent_function = ARRAY['hardware_engineering']
WHERE specialty_normalized = 'hardware_product_design';

-- ─── Step 8: Reparent NULL-parented inactive specialties (28 rows) ───────
-- Deactivate + reparent under the rebranded inactive function values
-- (product_management / product_design) where appropriate.

UPDATE specialty_dictionary
SET parent_function = ARRAY['product_management'], active = FALSE
WHERE specialty_normalized IN (
  'consumer_pm','core_pm','data_pm','enterprise_pm','growth_pm','technical_pm'
);

UPDATE specialty_dictionary
SET parent_function = ARRAY['product_design'], active = FALSE
WHERE specialty_normalized IN (
  'brand_design','design_systems','motion_design','product_design',
  'ui_design','ux_design'
);

UPDATE specialty_dictionary
SET parent_function = ARRAY['operations'], active = FALSE
WHERE specialty_normalized IN ('biz_ops','rev_ops','strategy');

UPDATE specialty_dictionary
SET parent_function = ARRAY['marketing'], active = FALSE
WHERE specialty_normalized IN ('devrel','growth');

UPDATE specialty_dictionary
SET parent_function = ARRAY['people_hr'], active = FALSE
WHERE specialty_normalized IN ('comp_benefits','hrbp','people_ops');

UPDATE specialty_dictionary
SET parent_function = ARRAY['recruiting'], active = FALSE
WHERE specialty_normalized IN (
  'executive_search','gna_recruiting','sourcing','talent_ops',
  'tech_recruiting','university_recruiting'
);

UPDATE specialty_dictionary
SET parent_function = ARRAY['finance'], active = FALSE
WHERE specialty_normalized = 'finance_ops';

UPDATE specialty_dictionary
SET parent_function = ARRAY['research'], active = FALSE
WHERE specialty_normalized = 'ux_research';

-- ─── Step 9: Reparent legacy non-eng inactive specialties (31 rows) ──────
-- These were already parented under what's now an inactive function
-- (design / product / sales / marketing / etc.). Either reparent to the
-- rebranded inactive parent (product_management/product_design) or keep
-- existing parent (now inactive) + flip active=FALSE.

UPDATE specialty_dictionary
SET parent_function = ARRAY['product_design'], active = FALSE
WHERE specialty_normalized IN ('industrial_design','interaction_design');

UPDATE specialty_dictionary
SET parent_function = ARRAY['product_management'], active = FALSE
WHERE specialty_normalized IN ('hardware_pm','platform_pm');

UPDATE specialty_dictionary
SET parent_function = ARRAY['sales'], active = FALSE
WHERE specialty_normalized IN (
  'account_executive','business_development','defense_sales',
  'federal_sales','sales_executive'
);

UPDATE specialty_dictionary
SET parent_function = ARRAY['marketing'], active = FALSE
WHERE specialty_normalized IN (
  'communications','demand_generation','product_marketing'
);

UPDATE specialty_dictionary
SET parent_function = ARRAY['operations'], active = FALSE
WHERE specialty_normalized IN (
  'business_operations','chief_of_staff','operations_general',
  'program_management','strategy_operations'
);

UPDATE specialty_dictionary
SET parent_function = ARRAY['finance'], active = FALSE
WHERE specialty_normalized IN (
  'accounting','corporate_development','finance_general','fpa',
  'investor_relations','treasury'
);

UPDATE specialty_dictionary
SET parent_function = ARRAY['legal'], active = FALSE
WHERE specialty_normalized IN (
  'compliance','contracts','export_compliance','ip_legal',
  'legal_counsel','regulatory_affairs'
);

UPDATE specialty_dictionary
SET parent_function = ARRAY['recruiting'], active = FALSE
WHERE specialty_normalized IN ('founding_recruiting','head_of_talent');

-- ─── Step 9.5: Defensive catchall — deactivate any active specialty whose
--     parent_function elements are ALL inactive functions ────────────────
-- Handles environment drift: dev was replayed from migration 002 + 017
-- and accumulated some legacy specialties (e.g. analytics, brand_marketing,
-- product_b2b) that were cleaned out of prod long ago. They aren't in the
-- locked mapping above, so the explicit UPDATEs don't touch them. After
-- the type change, they'd be left as `active=TRUE` with parent_function
-- pointing at a now-inactive function — inconsistent with V1 scope cut.
-- This catchall sweeps them up. No-op on prod (confirmed via direct
-- query — these 12 ghost rows don't exist on prod).
--
-- Invariants 5 and 6 in the verification block redundantly check this.
DO $$
DECLARE
  swept_count INT;
  ghost_list  TEXT;
BEGIN
  SELECT count(*), string_agg(s.specialty_normalized, ', ' ORDER BY s.specialty_normalized)
    INTO swept_count, ghost_list
    FROM specialty_dictionary s
    WHERE s.active = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM unnest(s.parent_function) AS pf
        JOIN function_dictionary f ON f.function_normalized = pf
        WHERE f.active = TRUE
      );

  IF swept_count > 0 THEN
    RAISE NOTICE 'Migration 072: defensive catchall sweeping % legacy/ghost specialties to active=FALSE: %', swept_count, ghost_list;
    UPDATE specialty_dictionary s
    SET active = FALSE
    WHERE s.active = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM unnest(s.parent_function) AS pf
        JOIN function_dictionary f ON f.function_normalized = pf
        WHERE f.active = TRUE
      );
  END IF;
END $$;

-- ─── Step 10: Reparent founder specialties (4 active, untouched parent) ──
-- Founder stays active in function_dictionary (per 071). Just rewrap the
-- parent_function value as a single-element array.

UPDATE specialty_dictionary SET parent_function = ARRAY['founder']
WHERE specialty_normalized IN (
  'ceo','co_founder','founding_engineer','founding_team_member'
);

-- ─── Verification ──────────────────────────────────────────────────────
--
-- The verification block is structured around STRUCTURAL INVARIANTS
-- (always true regardless of pre-migration row count) plus a DELTA check
-- against the pre-migration count. Dev and prod have different
-- pre-migration specialty corpus sizes (dev: ~207, prod: ~230), so
-- absolute post-migration counts would fail spuriously on one or the
-- other. Delta + invariants work for both.

DO $$
DECLARE
  v_pre_total          INT;
  v_post_total         INT;
  v_expected_delta     INT := -5;  -- 4 title-like + 1 redundant (data_engineering)
  empty_parent_count   INT;
  invalid_parent_count INT;
  deleted_present      INT;
  bad_active_count     INT;
  bad_inactive_count   INT;
  founder_active_count INT;
  multi_parent_count   INT;
  txt_parent_count     INT;
BEGIN
  SELECT pre_total INTO v_pre_total FROM _072_premig_state;
  SELECT count(*) INTO v_post_total FROM specialty_dictionary;

  -- Delta check: total dropped by exactly 5 (the explicit DELETEs)
  IF v_post_total <> v_pre_total + v_expected_delta THEN
    RAISE EXCEPTION 'Migration 072: total delta wrong (pre=%, post=%, expected delta=%).',
      v_pre_total, v_post_total, v_expected_delta;
  END IF;

  -- Invariant 1: parent_function column type is now TEXT[] (not TEXT)
  SELECT count(*) INTO txt_parent_count
    FROM information_schema.columns
    WHERE table_name = 'specialty_dictionary'
      AND column_name = 'parent_function'
      AND data_type = 'ARRAY';
  IF txt_parent_count <> 1 THEN
    RAISE EXCEPTION 'Migration 072: parent_function not converted to TEXT[].';
  END IF;

  -- Invariant 2: every row has a non-empty parent_function array
  SELECT count(*) INTO empty_parent_count
    FROM specialty_dictionary WHERE parent_function = ARRAY[]::TEXT[];
  IF empty_parent_count <> 0 THEN
    RAISE EXCEPTION 'Migration 072: % rows have empty parent_function.', empty_parent_count;
  END IF;

  -- Invariant 3: every parent_function element references a real function
  -- (app-layer enforcement lives in scripts/sync-reference.mjs; this is a
  --  one-shot post-migration referential check)
  SELECT count(*) INTO invalid_parent_count
    FROM (
      SELECT specialty_normalized, unnest(parent_function) AS pf
      FROM specialty_dictionary
    ) s
    LEFT JOIN function_dictionary f ON f.function_normalized = s.pf
    WHERE f.function_normalized IS NULL;
  IF invalid_parent_count <> 0 THEN
    RAISE EXCEPTION 'Migration 072: % parent_function elements do not exist in function_dictionary.', invalid_parent_count;
  END IF;

  -- Invariant 4: the 5 deleted specialties are gone
  SELECT count(*) INTO deleted_present FROM specialty_dictionary
    WHERE specialty_normalized IN (
      'chief_engineer','distinguished_engineer','engineering_management',
      'principal_engineer','data_engineering'
    );
  IF deleted_present <> 0 THEN
    RAISE EXCEPTION 'Migration 072: % deleted specialties still present.', deleted_present;
  END IF;

  -- Invariant 5: active=TRUE requires at least one parent_function element
  -- to be an active function (otherwise the specialty is dead from the UI
  -- perspective). Validates the V1-scope-cut consistency.
  SELECT count(*) INTO bad_active_count
    FROM specialty_dictionary s
    WHERE active = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM unnest(s.parent_function) AS pf
        JOIN function_dictionary f ON f.function_normalized = pf
        WHERE f.active = TRUE
      );
  IF bad_active_count <> 0 THEN
    RAISE EXCEPTION 'Migration 072: % specialties marked active=TRUE but have no active parent function.', bad_active_count;
  END IF;

  -- Invariant 6: active=FALSE rows must have ALL parent_function elements
  -- inactive (otherwise V1 scope cut is inconsistent — would leave an
  -- inactive specialty with an active parent, making it ambiguous whether
  -- the UI should surface it).
  SELECT count(*) INTO bad_inactive_count
    FROM specialty_dictionary s
    WHERE active = FALSE
      AND EXISTS (
        SELECT 1 FROM unnest(s.parent_function) AS pf
        JOIN function_dictionary f ON f.function_normalized = pf
        WHERE f.active = TRUE
      );
  IF bad_inactive_count <> 0 THEN
    RAISE EXCEPTION 'Migration 072: % specialties marked active=FALSE but have at least one active parent.', bad_inactive_count;
  END IF;

  -- Invariant 7: the 4 founder specialties remain active under founder parent
  SELECT count(*) INTO founder_active_count FROM specialty_dictionary
    WHERE specialty_normalized IN ('ceo','co_founder','founding_engineer','founding_team_member')
      AND active = TRUE
      AND parent_function = ARRAY['founder'];
  IF founder_active_count <> 4 THEN
    RAISE EXCEPTION 'Migration 072: expected 4 founder specialties active under [founder], got %.', founder_active_count;
  END IF;

  -- Spot-checks: key multi-parent specialties. If present in the corpus,
  -- they MUST have the expected array_length (loud failure on drift).
  -- Absent specialties skip (dev may not have the full prod corpus).

  PERFORM 1 FROM specialty_dictionary WHERE specialty_normalized = 'mechatronics';
  IF FOUND THEN
    PERFORM 1 FROM specialty_dictionary
      WHERE specialty_normalized = 'mechatronics' AND array_length(parent_function, 1) = 3;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Migration 072: mechatronics present but not 3-parent.';
    END IF;
  END IF;

  PERFORM 1 FROM specialty_dictionary WHERE specialty_normalized = 'battery_engineering';
  IF FOUND THEN
    PERFORM 1 FROM specialty_dictionary
      WHERE specialty_normalized = 'battery_engineering' AND array_length(parent_function, 1) = 3;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Migration 072: battery_engineering present but not 3-parent.';
    END IF;
  END IF;

  PERFORM 1 FROM specialty_dictionary WHERE specialty_normalized = 'navigation_engineering';
  IF FOUND THEN
    PERFORM 1 FROM specialty_dictionary
      WHERE specialty_normalized = 'navigation_engineering' AND array_length(parent_function, 1) = 3;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Migration 072: navigation_engineering present but not 3-parent.';
    END IF;
  END IF;

  PERFORM 1 FROM specialty_dictionary WHERE specialty_normalized = 'sensor_fusion';
  IF FOUND THEN
    PERFORM 1 FROM specialty_dictionary
      WHERE specialty_normalized = 'sensor_fusion' AND array_length(parent_function, 1) = 2;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Migration 072: sensor_fusion present but not 2-parent.';
    END IF;
  END IF;

  PERFORM 1 FROM specialty_dictionary WHERE specialty_normalized = 'pcb_design';
  IF FOUND THEN
    PERFORM 1 FROM specialty_dictionary
      WHERE specialty_normalized = 'pcb_design' AND array_length(parent_function, 1) = 2;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Migration 072: pcb_design present but not 2-parent.';
    END IF;
  END IF;

  -- Diagnostic count (not asserted — varies by environment)
  SELECT count(*) INTO multi_parent_count
    FROM specialty_dictionary WHERE array_length(parent_function, 1) >= 2;

  RAISE NOTICE 'Migration 072: pre=%, post=% (delta=%), multi_parent=%, all 7 invariants + 5 spot-checks pass.',
    v_pre_total, v_post_total, v_expected_delta, multi_parent_count;
END $$;

COMMIT;
