-- 087_deprecate_founder_function.sql
--
-- Deprecate "founder" as a FUNCTION (and its 4 specialties: ceo, co_founder,
-- founding_engineer, founding_team_member). Same IS-IT-vs-TOUCHED-IT modeling
-- error one level up: "founding" is a STAGE/ATTRIBUTE, not a discipline. With
-- function=founder, a founding ML engineer is INVISIBLE to an "ML engineer"
-- search — which directly guts the V1 wedge (finding founding/early-team eng).
--
-- Founding/early-stage is carried by EXISTING derived columns on `people`
-- (has_early_stage_experience, is_former_founder / is_current_founder,
-- seniority_level=founder) + the classifier's title_normalized free-text. The
-- classifier routes founding engineers to their ACTUAL discipline; ceo /
-- non-technical co_founder business roles -> function="unknown" (excluded, like
-- TPM/analyst). A TECHNICAL co-founder still doing engineering -> their discipline.
--
-- Scoring is UNAFFECTED: the former_founder bonus reads people.is_former_founder
-- (boolean, from a title regex), NOT function=founder.
--
-- (Dev-first. Prod application + the person_experiences/people function_normalized
--  reclassification cascade happen at merge, via the classifier rescore.)

BEGIN;

-- 1. Deprecate the 4 founder specialties.
UPDATE specialty_dictionary SET active = false
 WHERE specialty_normalized IN ('ceo', 'co_founder', 'founding_engineer', 'founding_team_member');

-- 2. Deprecate the founder FUNCTION.
UPDATE function_dictionary SET active = false WHERE function_normalized = 'founder';

COMMIT;
