-- 090_specialty_gap_fill.sql
--
-- Fill the 5 specialty gaps evidenced by the read-only vocab gap analysis over the
-- 129-candidate preview cohort (2026-07-05, reference/eval/vocab-gap-report.md):
--
--   • sre / devops / platform — PROMPT-VOCAB DRIFT: classifier prompt Rule 5 already
--     instructs [sre_engineering] / [devops_engineering / platform_engineering], but the
--     dictionary never had the rows, so following the prompt validation-rejected and the
--     model reached for wrong values instead (evidenced: "Senior SRE - Infrastructure"
--     classified reliability_engineering — a test/manufacturing hardware-reliability
--     specialty). Adding the rows makes prompt and vocab agree; no prompt change needed.
--   • computer_vision / nlp — IS-IT-level holes in the ML cluster: real CV/NLP engineers
--     were forced into perception_engineering / ai_engineering / applied_ml_engineering
--     approximations ("Computer Vision Research Engineer", "Computer Vision Engineer",
--     NLP ads-ranking ML roles). llm_engineering already exists; CV/NLP now match it.
--
-- (Dev-only for now, same lockstep as 085–087: prod application + the person-data
--  cascade happen AT MERGE.)

BEGIN;

INSERT INTO specialty_dictionary (specialty_normalized, parent_function, active, description) VALUES
  ('computer_vision_engineering', ARRAY['ml_engineering'],       true, 'Computer-vision model engineer — builds/trains vision models (detection, segmentation, tracking, visual SLAM models). IS-a-CV-engineer; merely USING CV libraries in product = software + a CV skill/tag, not this.'),
  ('nlp_engineering',             ARRAY['ml_engineering'],       true, 'NLP model engineer — builds/trains language/text models (classification, NER, conversational AI modeling). Modern LLM-centric work routes to llm_engineering; classic/statistical NLP modeling lives here.'),
  ('sre_engineering',             ARRAY['software_engineering'], true, 'Site reliability engineer — production reliability, observability, incident response, "Reliability Operations" titles. The word Operations in an SRE title does NOT make it non-engineering ops (prompt Rule 5).'),
  ('devops_engineering',          ARRAY['software_engineering'], true, 'DevOps engineer — CI/CD, build/release, developer tooling and automation around the deploy pipeline.'),
  ('platform_engineering',        ARRAY['software_engineering'], true, 'Platform engineer — internal platforms/services other engineers build on (distinct from infrastructure_engineering = the compute/network/cloud substrate itself).')
ON CONFLICT (specialty_normalized) DO NOTHING;

-- Verification: the 5 rows exist, are active, and carry the intended parents.
-- (Empty-DB tolerant: verifies only rows this migration itself guarantees.)
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM specialty_dictionary
   WHERE active
     AND (   (specialty_normalized IN ('computer_vision_engineering','nlp_engineering') AND parent_function = ARRAY['ml_engineering'])
          OR (specialty_normalized IN ('sre_engineering','devops_engineering','platform_engineering') AND parent_function = ARRAY['software_engineering']));
  IF n <> 5 THEN
    RAISE EXCEPTION 'specialty gap fill verification failed: expected 5 active gap-fill rows with intended parents, found %', n;
  END IF;
END $$;

COMMIT;
