-- 047_extend_person_signals_active_view.sql
--
-- Extend person_signals_active view to include team and competition metadata
-- for engineering_team signals.
--
-- IMPORTANT REGRESSION SAFEGUARD: The view must return ONE ROW per
-- person_signals entry. Naive LEFT JOINs to team_competition_map would
-- multiply rows when a team competes in multiple competitions (RoboJackets:
-- RoboBoat + RoboCup + SUAS). To prevent multiplication, we use a LATERAL
-- subquery with ORDER BY is_primary DESC LIMIT 1 to pick exactly one
-- competition per team.
--
-- All existing columns from migration 023's view definition are preserved
-- so existing UI code continues to work.

BEGIN;

DROP VIEW IF EXISTS person_signals_active;

CREATE VIEW person_signals_active AS
SELECT
  -- Existing fields (unchanged from migration 023)
  ps.id,
  ps.person_id,
  ps.signal_id,
  sd.canonical_name,
  sd.category,
  sd.subcategory,
  sd.tier_group,
  sd.canonical_url,
  ps.evidence_url,
  ps.evidence_metadata,
  ps.source_text,
  ps.source,
  ps.confidence,
  ps.verified_by_admin,
  ps.detected_at,

  -- New: team role (added in migration 040)
  ps.team_role_tier,
  ps.team_role_text,

  -- New: team metadata (NULL for non-team signals)
  t.team_id,
  t.team_name,
  t.tier_int           AS team_tier,
  t.domain_tags        AS team_domain_tags,
  t.school_id          AS team_school_id,
  t.is_consortium      AS team_is_consortium,
  t.is_verified        AS team_is_verified,

  -- New: primary competition for the team (NULL if no team or no competitions linked)
  c.competition_slug,
  c.tier_int           AS competition_tier,
  c.domain_primary     AS competition_domain,
  c.governing_org      AS competition_governing_org

FROM person_signals ps
JOIN signal_dictionary sd ON sd.id = ps.signal_id
LEFT JOIN teams t ON t.signal_id = sd.id
LEFT JOIN LATERAL (
  -- Pick exactly ONE competition per team (primary first, slug as tiebreaker).
  -- Without LATERAL+LIMIT, a team in N competitions would multiply this
  -- view's output by N — breaks UI assumptions and queries.
  SELECT cmp.competition_slug, cmp.tier_int, cmp.domain_primary, cmp.governing_org
  FROM team_competition_map tcm
  JOIN competitions cmp ON cmp.signal_id = tcm.competition_id
  WHERE tcm.team_id = t.team_id
  ORDER BY tcm.is_primary DESC, cmp.competition_slug ASC
  LIMIT 1
) c ON t.team_id IS NOT NULL

WHERE sd.is_active = TRUE
  AND COALESCE(ps.admin_override_status, '') != 'rejected';

GRANT SELECT ON person_signals_active TO anon;

-- Regression test (run post-migration to verify no row multiplication):
--   WITH dup_check AS (
--     SELECT id, count(*) FROM person_signals_active GROUP BY id HAVING count(*) > 1
--   )
--   SELECT count(*) AS duplicated_rows FROM dup_check;
-- Expected: 0.

COMMIT;
