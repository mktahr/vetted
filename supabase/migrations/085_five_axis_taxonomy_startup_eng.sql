-- 085_five_axis_taxonomy_startup_eng.sql
--
-- FIVE-AXIS TAXONOMY refinement for the V1 = ALL-STARTUP-ENGINEERING scope (wedge =
-- stage/seniority, engineering-only). Governing principle: a domain term lives at the
-- SPECIALTY level (the engineer TYPE — "is a CV engineer") OR the SKILL/TAG level
-- (domain context — "touched CV"), decided by IS-IT vs TOUCHED-IT (build-vs-use). The
-- `_engineering` suffix marks "this is their engineer type"; bare terms are reserved
-- for the tag/skill axis.
--
-- (Migrated to dev first. Prod application + the person_experiences.specialty_normalized
--  cascade are handled at merge.)

BEGIN;

-- 1. Deprecate specialties whose WORK belongs elsewhere (routed by the prompt rules),
--    plus the redundant `mechanical_design` (duplicate of mechanical_design_engineering).
--    - ml_ops / ml_infrastructure -> software platform/infra/devops/sre + ML skills
--    - ml_engineering (specialty, redundant with the function) -> applied_ml_engineering
--    - data_analytics / analytics_engineering -> routed by work (build->data_engineering,
--      analyze->unknown, sparse->unknown); not a kept engineering specialty
UPDATE specialty_dictionary SET active = false
 WHERE specialty_normalized IN
   ('ml_ops', 'ml_infrastructure', 'ml_engineering', 'data_analytics', 'analytics_engineering', 'mechanical_design');

-- 2. ai_research -> ml_research_engineering, narrowed to HANDS-ON research/model
--    engineering (the definition tightening lives in the prompt; pure research
--    scientists / paper-only signals are NOT this).
UPDATE specialty_dictionary SET specialty_normalized = 'ml_research_engineering'
 WHERE specialty_normalized = 'ai_research';

-- 3. Uniform `_engineering` suffix on every ACTIVE engineering specialty that lacks it
--    (suffix = engineer-type marker). Skip already-suffixed names + founder-role
--    specialties (ceo / co_founder / founding_team_member / founding_engineer — not
--    engineer-types in the suffix sense).
UPDATE specialty_dictionary
   SET specialty_normalized = specialty_normalized || '_engineering'
 WHERE active
   AND specialty_normalized NOT LIKE '%\_engineering'
   AND NOT ('founder' = ANY(parent_function));

-- 4. New specialties (approved; already in the suffix convention).
INSERT INTO specialty_dictionary (specialty_normalized, parent_function, active, description) VALUES
  ('ai_engineering',                     ARRAY['software_engineering'], true, 'Product-AI builder who USES models/APIs (RAG, agents, prompts, AI features). Build-vs-use: USING AI = software + ai_engineering.'),
  ('ml_platform_engineering',            ARRAY['software_engineering'], true, 'ML platform/infrastructure engineer — software work in the ML domain (the one ML-domain software specialty; do not split payments-infra/search-infra similarly).'),
  ('llm_engineering',                    ARRAY['ml_engineering'],       true, 'LLM/GenAI model engineer — distinct type; do NOT fold into generic model development.'),
  ('recommendation_ranking_engineering', ARRAY['ml_engineering'],       true, 'Recommenders / ranking / personalization / ads ranking / search relevance.'),
  ('data_pipeline_engineering',          ARRAY['data_engineering'],     true, 'Builds & operates data pipelines / streaming / ETL systems (any depth; depth -> skills + scoring, not specialty).')
ON CONFLICT (specialty_normalized) DO NOTHING;

COMMIT;
