-- 069_skills_dictionary_schema.sql
--
-- New `skills_dictionary` table for the four-axis candidate taxonomy rebuild
-- (sub-PR 2a of ROADMAP item #2). Captures concrete skills / domain tags
-- that recruiters keyword-search on (RTOS, CAN bus, Kubernetes, CUDA, SLAM,
-- motor control, Zephyr, payments, auth, observability, Cadence, Simulink,
-- ROS, PCB design, etc.). Multi-per-role storage on person_experiences,
-- cross-disciplinary tags allowed (HIL, RTOS, CAN bus span software AND
-- electrical), and each skill carries a `primary_specialty` multi-tag used
-- by the context-aware decay multiplier in the scoring engine.
--
-- DESIGN DECISIONS (per discovery + user approval 2026-06-01):
--   • UUID primary key + UNIQUE on canonical_name alone (NOT keyed by
--     (canonical_name, category) like signal_dictionary — a skill is one
--     row, multi-tagged, not duplicated across categories).
--   • category is CHECK-constrained to 7 initial values. Extensible later
--     via separate migration (same pattern as signal_dictionary's category
--     extension in migration 060). Methodology category split flagged in
--     BACKLOG.md once it grows past ~20 entries.
--   • primary_specialty is TEXT[] for multi-tagging. Soft text reference
--     to specialty_dictionary.specialty_normalized — no FK, same pattern as
--     signal_dictionary's relationship to specialty_dictionary. FK
--     enforcement would create churn during sub-PR 2b's specialty reshape.
--   • aliases TEXT[] for extraction matching (e.g., RTOS aliases ['real-time
--     os', 'real-time operating system']). GIN-indexed.
--   • is_searchable BOOLEAN mirrors signal_dictionary pattern — skill exists
--     in dictionary for extraction even when not surfaced as a UI filter.
--   • No subcategory, source_field_hints, is_positive, tier_group, notes —
--     skills are simpler than signals. Add later if needed.
--
-- WORKFLOW (first migration through the new dev/prod split):
--   1. npm run migrate:dev -- supabase/migrations/069_skills_dictionary_schema.sql
--   2. npm run migrate:dev -- supabase/migrations/070_skills_dictionary_rls_off.sql
--   3. Verify on dev (table exists, indexes present, RLS off)
--   4. npm run migrate:prod -- supabase/migrations/069_skills_dictionary_schema.sql
--   5. npm run migrate:prod -- supabase/migrations/070_skills_dictionary_rls_off.sql
--   6. Verify on prod
--   7. node scripts/sync-reference.mjs --table=skills_dictionary (seeds prod from /reference/skills/)
--
-- ADDITIVE / NON-ADDITIVE: purely additive. New table, new indexes, new
-- directory. No existing rows touched. Per Rule 5 (Migration is Additive
-- First) — clean. Per Rule 6 (Data State During Build Phase), the dev DB
-- gets the schema but no seed (seed only against prod).
--
-- INLINE DISABLE RLS is cosmetic — Supabase re-enables RLS on every CREATE
-- TABLE. Real DISABLE follows in migration 070. Pattern hit on 034, 037,
-- 039, 041, 053, 066 — see CLAUDE.md "Supabase RLS auto-enables" rule.

BEGIN;

CREATE TABLE skills_dictionary (
  skill_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name    TEXT NOT NULL UNIQUE,
  category          TEXT NOT NULL CHECK (category IN (
    'programming_language',  -- Python, Rust, C++, Verilog, SQL, MATLAB
    'framework',             -- React, PyTorch, ROS2, Zephyr, Django
    'protocol',              -- gRPC, REST, CAN, BLE, I2C, MQTT
    'tool',                  -- Docker, Kubernetes, Cadence, KiCad, Wireshark
    'domain',                -- SLAM, motor control, NLP, payments, auth, ranking
    'hardware',              -- RTOS, FPGA, ASIC, MCU, LIDAR, sensor fusion
    'methodology'            -- HIL, MIL, SIL, CI/CD, DevOps, TDD, V-model
  )),
  aliases           TEXT[] NOT NULL DEFAULT '{}',
  primary_specialty TEXT[] NOT NULL DEFAULT '{}',
  description       TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_searchable     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE skills_dictionary IS
  'Skills / domain tags for the four-axis candidate taxonomy (post-migration 069). One row per skill (RTOS, Kubernetes, SLAM, etc.). Multi-per-experience storage on person_experiences (added in a later sub-PR). Cross-disciplinary skills tagged with multiple primary_specialty values for the scoring engine''s context-aware decay multiplier.';

COMMENT ON COLUMN skills_dictionary.canonical_name IS
  'Display name of the skill. UNIQUE — a skill exists once across the whole dictionary, regardless of which categories or specialties it spans.';

COMMENT ON COLUMN skills_dictionary.category IS
  'High-level grouping: programming_language / framework / protocol / tool / domain / hardware / methodology. CHECK-constrained; extend via migration if a new category emerges (same pattern as signal_dictionary). Methodology category may need split if it grows past ~20 entries (see BACKLOG).';

COMMENT ON COLUMN skills_dictionary.aliases IS
  'Alternative names used at extraction time to match candidate text against this skill (e.g., RTOS aliases: real-time os, real-time operating system). Semicolon-separated in /reference/skills/*.csv; stored as TEXT[] in DB. GIN-indexed for fast lookup.';

COMMENT ON COLUMN skills_dictionary.primary_specialty IS
  'Multi-value soft reference to specialty_dictionary.specialty_normalized. Used by the scoring engine''s context-aware skill decay multiplier: when a candidate''s subsequent role specialty matches a skill''s primary_specialty, that skill decays at 0.5x rate (otherwise 1.0x). NO FK constraint — values can drift during specialty_dictionary reshape (sub-PR 2b). After 2b, run a soft validation pass to flag any orphaned references.';

COMMENT ON COLUMN skills_dictionary.is_searchable IS
  'When TRUE, this skill appears as a filter option in UI dropdowns. When FALSE, the skill exists for extraction only. Mirrors the signal_dictionary pattern.';

-- ─── Indexes ────────────────────────────────────────────────────────────

CREATE INDEX idx_skills_dict_aliases
  ON skills_dictionary USING GIN (aliases);

CREATE INDEX idx_skills_dict_primary_specialty
  ON skills_dictionary USING GIN (primary_specialty);

CREATE INDEX idx_skills_dict_category
  ON skills_dictionary (category);

CREATE INDEX idx_skills_dict_active_category
  ON skills_dictionary (is_active, category) WHERE is_active = TRUE;

-- ─── RLS — inline DISABLE is cosmetic (Supabase re-enables); real in 070 ──

ALTER TABLE skills_dictionary DISABLE ROW LEVEL SECURITY;

-- ─── Verification ──────────────────────────────────────────────────────

DO $$
DECLARE
  table_exists BOOLEAN;
  index_count INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'skills_dictionary'
  ) INTO table_exists;
  IF NOT table_exists THEN
    RAISE EXCEPTION 'Migration 069: skills_dictionary table not created.';
  END IF;

  SELECT count(*) INTO index_count FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'skills_dictionary';
  IF index_count < 5 THEN  -- PK + 4 named indexes
    RAISE EXCEPTION 'Migration 069: expected 5+ indexes on skills_dictionary, got %.', index_count;
  END IF;

  RAISE NOTICE 'Migration 069: skills_dictionary schema created with % indexes. Seed via sync-reference.mjs after migration 070.', index_count;
END $$;

COMMIT;
