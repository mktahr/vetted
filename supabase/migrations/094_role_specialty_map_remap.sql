-- 094_role_specialty_map_remap.sql
--
-- MERGE-ARC step (five-axis sub-PR 3): bring `role_specialty_map` in line with the
-- 085–093 specialty renames/deactivations. The map has NO FK on specialty_normalized
-- (verified: only role_id FK exists), so the dictionary renames did NOT cascade —
-- on dev, 122 map rows were left orphaned (name no longer in the dictionary) and 49
-- more point at inactive specialties. Codex caught this in the cascade-plan review:
-- without this migration, the UI role pills expand to specialty names that can never
-- match the classifier's active-vocab values.
--
-- The map's ONLY consumer is the role-filter expansion in ProfileTable/search-builder,
-- which post-flip matches against ACTIVE-vocab inferred values. Invariant after this
-- migration: every map row references an ACTIVE specialty.
--
-- Strategy (empirically derived from the dev DB state, 2026-07-08):
--   1. EXPLICIT renames — the non-mechanical renames from 085/086/091 where old→new
--      is not just the `_engineering` suffix (the `_software` de-tails, ai_research,
--      metallurgy, robotics_software, mechanical_design).
--   2. GENERIC suffix rule — the 085 bulk rename: any remaining row whose name is not
--      an active specialty but name || '_engineering' IS one gets suffixed (resolves
--      75 of dev's 122 orphans mechanically).
--   3. INSERT map rows for the NET-NEW specialties from 085/090/093 (Codex catch —
--      role pills expand exclusively via this map, so new vocab needs new rows).
--   4. DELETE the rest — rows still not referencing an ACTIVE specialty. Covers the
--      V1-scope-cut non-engineering rows (biz_ops, consumer_pm, ux_design, …), the
--      skills-axis moves (kinematics, machining, prototyping, hdl), the routed-away
--      deprecations (ml_ops, data_analytics, TPM, qa_testing, …), and the founder
--      specialties (087). Deliberately including rows at INACTIVE specialties: they
--      cannot match inferred values, so keeping them is pure noise. NOTE: prod today
--      already has 9 orphans + 58 inactive-pointing rows (pre-existing drift) —
--      those get cleaned by the same rule.
--
-- Conflict safety: renames guard against an existing (role_id, new_name) row — if the
-- target already exists for that role, the old row is DELETED instead of renamed
-- (PK is (role_id, specialty_normalized)).
--
-- ORDER: runs AFTER 085–093 (needs the post-rename dictionary to resolve targets).
-- Dev-first per workflow; prod apply is part of the gated merge arc.
--
-- ADDITIVE / NON-ADDITIVE: NON-ADDITIVE (UPDATEs + DELETEs on role_specialty_map).
-- Reversible via the pre-arc snapshot of role_specialty_map (see merge-arc runbook).

BEGIN;

-- ─── Pre-flight diagnostics ─────────────────────────────────────────────

DO $$
DECLARE
  total_rows    INT;
  orphan_rows   INT;
  inactive_rows INT;
BEGIN
  SELECT count(*) INTO total_rows FROM role_specialty_map;
  SELECT count(*) INTO orphan_rows
    FROM role_specialty_map rsm
    LEFT JOIN specialty_dictionary sd ON sd.specialty_normalized = rsm.specialty_normalized
    WHERE sd.specialty_normalized IS NULL;
  SELECT count(*) INTO inactive_rows
    FROM role_specialty_map rsm
    JOIN specialty_dictionary sd ON sd.specialty_normalized = rsm.specialty_normalized
    WHERE NOT sd.active;
  RAISE NOTICE 'Migration 094 pre-flight: % map rows; % orphaned (not in dictionary); % pointing at inactive specialties.',
    total_rows, orphan_rows, inactive_rows;
END $$;

-- ─── Step 1: explicit renames (old → new), conflict-safe ────────────────
-- Derived from 085 step 2 (ai_research), 086 steps 1–3 (merges, metallurgical,
-- _software de-tails), 091 (robotics_software → guarded reactivation), and the
-- 085 mechanical_design dedup (duplicate of mechanical_design_engineering).

CREATE TEMP TABLE _rsm_renames (old_name TEXT PRIMARY KEY, new_name TEXT NOT NULL) ON COMMIT DROP;
INSERT INTO _rsm_renames (old_name, new_name) VALUES
  ('ai_research',         'ml_research_engineering'),
  ('metallurgy',          'metallurgical_engineering'),
  ('flight_software',     'flight_engineering'),
  ('ground_software',     'ground_engineering'),
  ('mission_software',    'mission_engineering'),
  ('perception_software', 'perception_engineering'),
  ('simulation_software', 'simulation_engineering'),
  ('autonomy_software',   'autonomy_engineering'),
  ('controls_software',   'controls_engineering'),
  ('embedded_software',   'embedded_engineering'),
  ('robotics_software',   'robotics_software_engineering'),
  ('mechanical_design',   'mechanical_design_engineering');

-- Renames whose target is not an ACTIVE specialty on this DB must not fire
-- (defensive — all 12 targets are active post-085–093).
DELETE FROM _rsm_renames r
WHERE NOT EXISTS (
  SELECT 1 FROM specialty_dictionary sd
  WHERE sd.specialty_normalized = r.new_name AND sd.active
);

-- Conflict guard: if (role_id, new_name) already exists, drop the old row.
DELETE FROM role_specialty_map rsm
USING _rsm_renames r
WHERE rsm.specialty_normalized = r.old_name
  AND EXISTS (
    SELECT 1 FROM role_specialty_map x
    WHERE x.role_id = rsm.role_id AND x.specialty_normalized = r.new_name
  );

UPDATE role_specialty_map rsm
SET specialty_normalized = r.new_name
FROM _rsm_renames r
WHERE rsm.specialty_normalized = r.old_name;

-- ─── Step 2: generic 085 suffix rule, conflict-safe ─────────────────────
-- Any remaining row whose name is NOT an active specialty but whose suffixed
-- form IS one → rename (backend → backend_engineering, gnc → gnc_engineering, …).

DELETE FROM role_specialty_map rsm
WHERE NOT EXISTS (
    SELECT 1 FROM specialty_dictionary sd
    WHERE sd.specialty_normalized = rsm.specialty_normalized AND sd.active)
  AND EXISTS (
    SELECT 1 FROM specialty_dictionary t
    WHERE t.specialty_normalized = rsm.specialty_normalized || '_engineering' AND t.active)
  AND EXISTS (
    SELECT 1 FROM role_specialty_map x
    WHERE x.role_id = rsm.role_id
      AND x.specialty_normalized = rsm.specialty_normalized || '_engineering');

UPDATE role_specialty_map rsm
SET specialty_normalized = rsm.specialty_normalized || '_engineering'
WHERE NOT EXISTS (
    SELECT 1 FROM specialty_dictionary sd
    WHERE sd.specialty_normalized = rsm.specialty_normalized AND sd.active)
  AND EXISTS (
    SELECT 1 FROM specialty_dictionary t
    WHERE t.specialty_normalized = rsm.specialty_normalized || '_engineering' AND t.active);

-- ─── Step 3: map rows for the NEW specialties introduced in 085/090/093 ─
-- (Codex round-2 catch: without these, role pills under-match classifier output —
-- role expansion comes exclusively from this map.) NOT needed for sre/devops/
-- platform (existing bare-name rows auto-rename via step 2), robotics_software
-- (explicit rename), or ml_research_engineering (ai_research rename).
-- Placement follows the applied_ml precedent (ML/data/software cluster lives under
-- the "Software Engineer" role) and the cross-role two-row pattern for multi-parent
-- powertrain (primary under Mechanical, secondary under Electrical — mirrors
-- flight_software's historical primary/secondary treatment).

INSERT INTO role_specialty_map (role_id, specialty_normalized, is_primary)
SELECT rd.role_id, v.spec, v.is_primary
FROM (VALUES
  ('Software Engineer',   'ai_engineering',                     TRUE),
  ('Software Engineer',   'ml_platform_engineering',            TRUE),
  ('Software Engineer',   'llm_engineering',                    TRUE),
  ('Software Engineer',   'recommendation_ranking_engineering', TRUE),
  ('Software Engineer',   'data_pipeline_engineering',          TRUE),
  ('Software Engineer',   'computer_vision_engineering',        TRUE),
  ('Software Engineer',   'nlp_engineering',                    TRUE),
  ('Mechanical Engineer', 'powertrain_engineering',             TRUE),
  ('Electrical Engineer', 'powertrain_engineering',             FALSE)
) AS v(role_name, spec, is_primary)
JOIN role_dictionary rd ON rd.role_name = v.role_name AND rd.active
-- guard: only insert when the specialty actually exists ACTIVE on this DB
JOIN specialty_dictionary sd ON sd.specialty_normalized = v.spec AND sd.active
ON CONFLICT (role_id, specialty_normalized) DO NOTHING;

-- ─── Step 4: delete rows still not referencing an ACTIVE specialty ──────

DO $$
DECLARE doomed INT;
BEGIN
  SELECT count(*) INTO doomed
  FROM role_specialty_map rsm
  WHERE NOT EXISTS (
    SELECT 1 FROM specialty_dictionary sd
    WHERE sd.specialty_normalized = rsm.specialty_normalized AND sd.active);
  RAISE NOTICE 'Migration 094: deleting % map rows with no active-specialty target (scope-cut / skills-axis / deprecated).', doomed;
END $$;

DELETE FROM role_specialty_map rsm
WHERE NOT EXISTS (
  SELECT 1 FROM specialty_dictionary sd
  WHERE sd.specialty_normalized = rsm.specialty_normalized AND sd.active);

-- ─── Verification (empty-DB tolerant: 0 rows passes trivially) ──────────

DO $$
DECLARE
  bad_rows   INT;
  final_rows INT;
BEGIN
  SELECT count(*) INTO bad_rows
  FROM role_specialty_map rsm
  WHERE NOT EXISTS (
    SELECT 1 FROM specialty_dictionary sd
    WHERE sd.specialty_normalized = rsm.specialty_normalized AND sd.active);
  IF bad_rows <> 0 THEN
    RAISE EXCEPTION 'Migration 094: % role_specialty_map rows still reference non-active specialties.', bad_rows;
  END IF;

  SELECT count(*) INTO final_rows FROM role_specialty_map;
  RAISE NOTICE 'Migration 094 complete: % map rows remain, all referencing active specialties.', final_rows;
END $$;

COMMIT;
