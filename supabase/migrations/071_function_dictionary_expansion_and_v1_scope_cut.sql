-- 071_function_dictionary_expansion_and_v1_scope_cut.sql
--
-- Sub-PR 2b of the four-axis candidate taxonomy rebuild
-- (ROADMAP item #2). Expands function_dictionary from broad job-family
-- buckets into 16 hard-tech engineering sub-functions, deactivates every
-- non-engineering function per the V1 scope cut (hard-tech engineering
-- only at launch), and registers two new INACTIVE function values
-- (product_management / product_design) so future LLM inference has a
-- clean rebranded target if non-engineering scope ever returns.
--
-- DESIGN DECISIONS (locked 2026-06-XX, see CHANGELOG):
--
-- ── 16 NEW ACTIVE engineering sub-functions ──
--    software_engineering, firmware_engineering, mechanical_engineering,
--    electrical_engineering, hardware_engineering, chip_engineering,
--    systems_engineering, controls_engineering, robotics_engineering,
--    aerospace_engineering, materials_engineering, manufacturing_engineering,
--    test_engineering, optics_engineering, ml_engineering, data_engineering
--
-- ── 2 NEW INACTIVE function values (rebranded targets for future scope) ──
--    product_management, product_design
--
-- ── 2 LEGACY rows kept ACTIVE ──
--    founder  — 4 specialties (ceo, co_founder, founding_engineer,
--                              founding_team_member) stay active
--    unknown  — catch-all for unresolvable titles
--
-- ── 16 LEGACY rows DEACTIVATED (V1 scope cut) ──
--    engineering, product, design, data_science, sales, marketing,
--    operations, finance, legal, recruiting, people_hr, customer_success,
--    research, communications, investing, consulting
--
-- Net state after this migration:
--   18 active   (16 new sub-functions + founder + unknown)
--   18 inactive (16 legacy deactivations + product_management + product_design)
--   36 total
--
-- NOT functions (handled as specialties under software_engineering in 072):
--    devops, security — these become specialty rows under
--    parent_function=['software_engineering'], not standalone functions.
--
-- engineering_leadership is NOT a function. Engineering managers /
-- directors / VPs / CTOs sit at function=<their discipline> +
-- seniority=manager|director|vp|c_suite. Captured in seniority_dictionary
-- (migration 067) — the leadership axis is seniority, not function.
--
-- WORKFLOW (per dev/prod split established in commit 26a02bc):
--   1. npm run migrate:dev  -- supabase/migrations/071_*.sql
--   2. Verify on dev (counts match, no FK violations)
--   3. npm run migrate:prod -- supabase/migrations/071_*.sql
--
-- ADDITIVE / NON-ADDITIVE: NON-ADDITIVE (UPDATEs active=FALSE on 16 rows).
-- Per Rule 5 (Migration is Additive First): the 16 deactivations are
-- reversible (UPDATE … SET active=TRUE) so a rollback path exists.
-- specialty_dictionary FK targets are preserved (no DELETE).

BEGIN;

-- ─── Step 1: Insert 16 new engineering sub-functions (active) ───────────
INSERT INTO function_dictionary (function_normalized, description, active) VALUES
  ('software_engineering',     'Software engineering — backend, frontend, fullstack, mobile, platform, distributed systems, devops, security', TRUE),
  ('firmware_engineering',     'Firmware engineering — embedded software, drivers, kernel, RTOS, bootloaders, low-level systems', TRUE),
  ('mechanical_engineering',   'Mechanical engineering — design, CAD, structural, thermal, mechanisms', TRUE),
  ('electrical_engineering',   'Electrical engineering — PCB, power, analog/RF, signals, communications', TRUE),
  ('hardware_engineering',     'Hardware engineering — board-level hardware design, integration, embedded hardware', TRUE),
  ('chip_engineering',         'Chip engineering — ASIC, FPGA, SoC, digital design, physical design, verification, HDL', TRUE),
  ('systems_engineering',      'Systems engineering — architecture, requirements, integration, MBSE', TRUE),
  ('controls_engineering',     'Controls engineering — control systems, motor control, feedback, servo', TRUE),
  ('robotics_engineering',     'Robotics engineering — perception, motion planning, autonomy, SLAM, manipulation, sensor fusion', TRUE),
  ('aerospace_engineering',    'Aerospace engineering — propulsion, GN&C, avionics, flight systems, space, aerodynamics', TRUE),
  ('materials_engineering',    'Materials engineering — composites, ceramics, polymers, metallurgy, characterization', TRUE),
  ('manufacturing_engineering','Manufacturing engineering — DFM, assembly, fabrication, machining, process, production, supply chain', TRUE),
  ('test_engineering',         'Test engineering — V&V, reliability, qualification, environmental test, HIL/SIL, quality', TRUE),
  ('optics_engineering',       'Optics engineering — photonics, optical/optomechanical design, imaging systems, lasers', TRUE),
  ('ml_engineering',           'Machine learning engineering — applied ML, ML infra, MLOps, CV, NLP, AI research', TRUE),
  ('data_engineering',         'Data engineering — pipelines, warehousing, analytics infrastructure, data platforms', TRUE)
ON CONFLICT (function_normalized) DO NOTHING;

-- ─── Step 2: Insert 2 new inactive function values (rebranded targets) ──
-- product_management / product_design are NOT in V1 scope but get registered
-- as INACTIVE values so future LLM inference + UI work has a clean target
-- if scope ever expands. Specialty reparenting in 072 routes existing
-- product/design specialties under these rebranded parents.
INSERT INTO function_dictionary (function_normalized, description, active) VALUES
  ('product_management', 'Product management (rebranded from `product`). V1 scope cut — INACTIVE.', FALSE),
  ('product_design',     'Product design (rebranded from `design`). V1 scope cut — INACTIVE.', FALSE)
ON CONFLICT (function_normalized) DO NOTHING;

-- ─── Step 3: Deactivate 16 legacy functions (V1 scope cut) ──────────────
-- These rows stay in the dictionary (FK targets for legacy specialty rows
-- still referencing them) but `active=FALSE` removes them from UI filter
-- dropdowns and search facets. Reversible by `UPDATE … SET active=TRUE`.

UPDATE function_dictionary
SET active = FALSE
WHERE function_normalized IN (
  'engineering',       -- umbrella — replaced by 16 sub-functions
  'product',           -- replaced (inactive) by product_management
  'design',            -- replaced (inactive) by product_design
  'data_science',      -- V1 scope cut (research function)
  'sales',
  'marketing',
  'operations',
  'finance',
  'legal',
  'recruiting',
  'people_hr',
  'customer_success',
  'research',
  'communications',
  'investing',
  'consulting'
);

-- ─── Verification ──────────────────────────────────────────────────────

DO $$
DECLARE
  active_count   INT;
  inactive_count INT;
  total_count    INT;
  founder_ok     BOOLEAN;
  unknown_ok     BOOLEAN;
  eng_inactive   BOOLEAN;
  pm_inactive    BOOLEAN;
  pd_inactive    BOOLEAN;
  ds_inactive    BOOLEAN;
  leadership_absent BOOLEAN;
BEGIN
  SELECT count(*) INTO active_count   FROM function_dictionary WHERE active = TRUE;
  SELECT count(*) INTO inactive_count FROM function_dictionary WHERE active = FALSE;
  SELECT count(*) INTO total_count    FROM function_dictionary;

  IF active_count <> 18 THEN
    RAISE EXCEPTION 'Migration 071: expected 18 active functions, got %.', active_count;
  END IF;
  IF inactive_count <> 18 THEN
    RAISE EXCEPTION 'Migration 071: expected 18 inactive functions, got %.', inactive_count;
  END IF;
  IF total_count <> 36 THEN
    RAISE EXCEPTION 'Migration 071: expected 36 total functions, got %.', total_count;
  END IF;

  SELECT active     INTO founder_ok    FROM function_dictionary WHERE function_normalized = 'founder';
  SELECT active     INTO unknown_ok    FROM function_dictionary WHERE function_normalized = 'unknown';
  SELECT NOT active INTO eng_inactive  FROM function_dictionary WHERE function_normalized = 'engineering';
  SELECT NOT active INTO pm_inactive   FROM function_dictionary WHERE function_normalized = 'product_management';
  SELECT NOT active INTO pd_inactive   FROM function_dictionary WHERE function_normalized = 'product_design';
  SELECT NOT active INTO ds_inactive   FROM function_dictionary WHERE function_normalized = 'data_science';

  IF NOT founder_ok OR NOT unknown_ok THEN
    RAISE EXCEPTION 'Migration 071: founder and unknown must remain active.';
  END IF;
  IF NOT eng_inactive OR NOT pm_inactive OR NOT pd_inactive OR NOT ds_inactive THEN
    RAISE EXCEPTION 'Migration 071: engineering, product_management, product_design, data_science must be inactive.';
  END IF;

  -- engineering_leadership must NOT exist as a function — it's a seniority
  -- (manager/director/vp/c_suite), not a function. Guard against accidental
  -- reintroduction.
  SELECT NOT EXISTS (SELECT 1 FROM function_dictionary WHERE function_normalized = 'engineering_leadership')
    INTO leadership_absent;
  IF NOT leadership_absent THEN
    RAISE EXCEPTION 'Migration 071: engineering_leadership must not exist as a function (it is a seniority).';
  END IF;

  -- Spot-check: 5 of the 16 new sub-functions present + active
  PERFORM 1 FROM function_dictionary WHERE function_normalized = 'chip_engineering'         AND active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Migration 071: chip_engineering missing or inactive.'; END IF;
  PERFORM 1 FROM function_dictionary WHERE function_normalized = 'firmware_engineering'     AND active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Migration 071: firmware_engineering missing or inactive.'; END IF;
  PERFORM 1 FROM function_dictionary WHERE function_normalized = 'materials_engineering'    AND active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Migration 071: materials_engineering missing or inactive.'; END IF;
  PERFORM 1 FROM function_dictionary WHERE function_normalized = 'optics_engineering'       AND active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Migration 071: optics_engineering missing or inactive.'; END IF;
  PERFORM 1 FROM function_dictionary WHERE function_normalized = 'data_engineering'         AND active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Migration 071: data_engineering missing or inactive.'; END IF;

  RAISE NOTICE 'Migration 071: function_dictionary now has 18 active / 18 inactive / 36 total.';
END $$;

COMMIT;
