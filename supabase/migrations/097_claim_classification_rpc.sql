-- 097_claim_classification_rpc.sql
--
-- MERGE-ARC fix (2026-07-08): move the classifier's app-layer conditional CLAIM into
-- a SQL RPC, mirroring the engine's other lifecycle primitives (commit_classification /
-- reserve_classification_spend / bump_classification_generation, migration 083).
--
-- WHY: prod runs PostgREST 14.1, which mishandles PATCH + `or=` logical filters:
--   • with a NAMED returning column list (`select=col1,col2`) it mis-compiles to SQL
--     that fails 42703 ("column people.classification_status does not exist");
--   • with `select=*` it EXECUTES the update but returns an EMPTY representation —
--     the first prod classifier run claimed 50 people while reporting "not_eligible"
--     for every one (leases leaked; self-healed via expiry + a manual reset).
-- Dev runs PostgREST 14.5 where the shape works — which is why every dev test passed.
-- Plain SQL inside an RPC is immune to PostgREST filter/returning compilation across
-- versions. (Upgrading prod PostgREST 14.1→14.5 is desirable for parity regardless,
-- but the engine should not depend on it.)
--
-- The RPC is the exact claim semantic from lib/candidates/classifier/index.ts:
-- eligible = pending | failed-retryable(<max) | expired-in_progress; atomically
-- stamps in_progress + lease token/expiry; returns the claimed row's generation +
-- failure count (empty set = not eligible / lost the race).
--
-- ADDITIVE (CREATE FUNCTION + grants). Dev-first per workflow.

BEGIN;

CREATE OR REPLACE FUNCTION claim_classification(
  p_person_id     UUID,
  p_lease_token   UUID,
  p_lease_minutes INT,
  p_max_failures  INT
) RETURNS TABLE (
  claimed_person_id     UUID,
  claimed_generation    INT,
  claimed_failure_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE people p
     SET classification_status           = 'in_progress',
         classification_lease_token      = p_lease_token,
         classification_lease_expires_at = NOW() + make_interval(mins => p_lease_minutes),
         updated_at                      = NOW()
   WHERE p.person_id = p_person_id
     AND (    p.classification_status = 'pending'
          OR (p.classification_status = 'failed'
              AND p.classification_failure_count < p_max_failures)
          OR (p.classification_status = 'in_progress'
              AND p.classification_lease_expires_at < NOW()) )
  RETURNING p.person_id, p.classification_generation, p.classification_failure_count;
END $$;

COMMENT ON FUNCTION claim_classification IS
  'Atomic classifier claim (five-axis sub-PR 3). Eligible = pending | failed(<max) | expired-in_progress. Stamps in_progress + lease; returns claimed generation + failure count (empty = not eligible / lost race). RPC because prod PostgREST 14.1 mishandles PATCH+or= (42703 with named returning; silent empty representation with select=*) — see migration header.';

REVOKE EXECUTE ON FUNCTION claim_classification(UUID, UUID, INT, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION claim_classification(UUID, UUID, INT, INT) TO service_role;

-- Verification: the function exists with the exact signature.
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_proc WHERE proname = 'claim_classification') <> 1 THEN
    RAISE EXCEPTION 'Migration 097: claim_classification function missing or duplicated.';
  END IF;
END $$;

COMMIT;
