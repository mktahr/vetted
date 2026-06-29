// lib/network/promote.ts
//
// NETWORK CONNECTIONS PR 2 — GATED PROMOTION.
//
// Promotion = move a projected connection into the general candidate pool. It is
// a flag flip on top of PR 2b's projection machinery — NO re-pay / re-enrich /
// re-score (the row was already projected + scored at projection time):
//   - ensure the connection is projected into `people` (projectConnection)
//   - flip people.record_kind  network_connection -> both   (enters the pool)
//   - mark people.promoted_from_connection = TRUE            (demotion provenance)
//
// The gate has two inputs, with the admin's manual override winning:
//   desiredInPool =
//     pool_override === 'in'   -> true
//     pool_override === 'out'  -> false
//     pool_override === null   -> AUTO RULE: connection works at a VETTED company
//                                 (companies.review_status='vetted', joined via the
//                                  connection's overlay company_id)
//
// DEMOTION SAFETY (the reason people.promoted_from_connection exists): a person is
// record_kind='both' either because we promoted a PURE connection (safe to demote)
// or because a NATIVE candidate is also a connection (must NEVER leave the pool).
// record_kind alone can't tell them apart. Force-out demotes only when
// promoted_from_connection=TRUE *and* no other connection linked to that person
// (N:1) still wants them in.

import { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllServer } from './client';
import { projectConnection } from './project-connection';

export type ReconcileAction =
  | 'promoted'              // network_connection -> both (entered the pool)
  | 'already_in'           // person already in the pool (candidate / both via merge)
  | 'demoted'              // both -> network_connection (left the pool)
  | 'already_out'          // not in the pool, nothing to do
  | 'kept_native_candidate'// force-out ignored: person is a real candidate
  | 'kept_other_owner'     // force-out ignored: another connection still wants them in
  | 'needs_enrichment';    // eligible but not projectable yet (no fresh enrich blob)

export type ReconcileResult =
  | { ok: true; connectionId: string; action: ReconcileAction; personId: string | null }
  | { ok: false; connectionId: string; reason: string };

interface ConnRow {
  connection_id: string;
  company_id: string | null;
  person_id: string | null;
  pool_override: 'in' | 'out' | null;
}

/** The vetted-company gate: company_ids of companies with review_status='vetted'. */
export async function loadVettedCompanyIds(supabase: SupabaseClient): Promise<Set<string>> {
  const rows = await fetchAllServer<{ company_id: string }>(
    supabase,
    'companies',
    'company_id',
    (q) => q.eq('review_status', 'vetted'),
  );
  return new Set(rows.map((r) => r.company_id));
}

/** Auto-rule eligibility for ONE connection, honoring the admin override. */
function desiredInPool(conn: ConnRow, vetted: Set<string>): boolean {
  if (conn.pool_override === 'in') return true;
  if (conn.pool_override === 'out') return false;
  return !!conn.company_id && vetted.has(conn.company_id);
}

/** Flip network_connection -> both + set the demotion-provenance flag. Guarded so
 *  it only ever lifts a network_connection (never re-marks a native candidate). */
async function promoteToPool(supabase: SupabaseClient, personId: string): Promise<boolean> {
  const { error } = await supabase
    .from('people')
    .update({ record_kind: 'both', promoted_from_connection: true, updated_at: new Date().toISOString() })
    .eq('person_id', personId)
    .eq('record_kind', 'network_connection');
  return !error;
}

/** Demote both -> network_connection. Guarded on promoted_from_connection=TRUE so a
 *  native candidate can never be removed from the pool here. */
async function demoteFromPool(supabase: SupabaseClient, personId: string): Promise<boolean> {
  const { error } = await supabase
    .from('people')
    .update({ record_kind: 'network_connection', promoted_from_connection: false, updated_at: new Date().toISOString() })
    .eq('person_id', personId)
    .eq('record_kind', 'both')
    .eq('promoted_from_connection', true);
  return !error;
}

/**
 * Reconcile ONE connection's pool membership to its desired state. Idempotent.
 * `vetted` is passed in so the bulk auto path loads it once.
 */
export async function reconcileConnectionPool(
  supabase: SupabaseClient,
  connectionId: string,
  vetted: Set<string>,
): Promise<ReconcileResult> {
  const { data: conn } = await supabase
    .from('connections')
    .select('connection_id, company_id, person_id, pool_override')
    .eq('connection_id', connectionId)
    .maybeSingle<ConnRow>();
  if (!conn) return { ok: false, connectionId, reason: 'connection_not_found' };

  const wantIn = desiredInPool(conn, vetted);

  // ── PROMOTE ──────────────────────────────────────────────────────────────
  if (wantIn) {
    // Ensure the connection is projected (creates/links the people row, scores it).
    if (!conn.person_id) {
      const proj = await projectConnection(supabase, connectionId);
      if (!proj.ok) {
        // Eligible but not projectable yet — almost always "not enriched". Surface
        // it as a soft state, not a hard failure, so the bulk auto run keeps going.
        if (proj.reason === 'no_enrichment_blob' || proj.reason === 'stale_enrichment_blob') {
          return { ok: true, connectionId, action: 'needs_enrichment', personId: null };
        }
        return { ok: false, connectionId, reason: proj.reason };
      }
      // merge / merge_on_race → the person was an existing pool candidate (already
      // 'both', pool membership unchanged). projected → a brand-new network_connection.
      if (proj.action === 'projected') {
        if (!(await promoteToPool(supabase, proj.personId))) {
          return { ok: false, connectionId, reason: 'promote_failed' };
        }
        return { ok: true, connectionId, action: 'promoted', personId: proj.personId };
      }
      return { ok: true, connectionId, action: 'already_in', personId: proj.personId };
    }

    // Already linked — flip if still a bare network_connection, else already in.
    const { data: person } = await supabase
      .from('people')
      .select('record_kind')
      .eq('person_id', conn.person_id)
      .maybeSingle<{ record_kind: string }>();
    if (person?.record_kind === 'network_connection') {
      if (!(await promoteToPool(supabase, conn.person_id))) {
        return { ok: false, connectionId, reason: 'promote_failed' };
      }
      return { ok: true, connectionId, action: 'promoted', personId: conn.person_id };
    }
    return { ok: true, connectionId, action: 'already_in', personId: conn.person_id };
  }

  // ── DEMOTE / KEEP-OUT ────────────────────────────────────────────────────
  if (!conn.person_id) return { ok: true, connectionId, action: 'already_out', personId: null };

  const { data: person } = await supabase
    .from('people')
    .select('record_kind, promoted_from_connection')
    .eq('person_id', conn.person_id)
    .maybeSingle<{ record_kind: string; promoted_from_connection: boolean }>();

  // Not in the pool (network_connection) → nothing to remove.
  if (!person || person.record_kind !== 'both') {
    return { ok: true, connectionId, action: 'already_out', personId: conn.person_id };
  }
  // Native candidate (or projection-merge both) → never demote.
  if (!person.promoted_from_connection) {
    return { ok: true, connectionId, action: 'kept_native_candidate', personId: conn.person_id };
  }
  // N:1 — keep them in if ANY other linked connection still wants them in.
  const { data: siblings } = await supabase
    .from('connections')
    .select('connection_id, company_id, person_id, pool_override')
    .eq('person_id', conn.person_id)
    .neq('connection_id', connectionId);
  if ((siblings ?? []).some((s) => desiredInPool(s as ConnRow, vetted))) {
    return { ok: true, connectionId, action: 'kept_other_owner', personId: conn.person_id };
  }
  if (!(await demoteFromPool(supabase, conn.person_id))) {
    return { ok: false, connectionId, reason: 'demote_failed' };
  }
  return { ok: true, connectionId, action: 'demoted', personId: conn.person_id };
}

export interface ReconcileSummary {
  total: number;
  promoted: number;
  demoted: number;
  alreadyIn: number;
  alreadyOut: number;
  keptNative: number;
  keptOtherOwner: number;
  needsEnrichment: number;
  failed: number;
  results: ReconcileResult[];
}

/** Reconcile a set of connections sequentially (projection/scoring isn't parallel-safe). */
export async function reconcileConnections(
  supabase: SupabaseClient,
  connectionIds: string[],
  vetted: Set<string>,
): Promise<ReconcileSummary> {
  const results: ReconcileResult[] = [];
  let promoted = 0, demoted = 0, alreadyIn = 0, alreadyOut = 0, keptNative = 0, keptOtherOwner = 0, needsEnrichment = 0, failed = 0;
  for (const id of connectionIds) {
    const r = await reconcileConnectionPool(supabase, id, vetted);
    results.push(r);
    if (!r.ok) { failed++; continue; }
    switch (r.action) {
      case 'promoted': promoted++; break;
      case 'demoted': demoted++; break;
      case 'already_in': alreadyIn++; break;
      case 'already_out': alreadyOut++; break;
      case 'kept_native_candidate': keptNative++; break;
      case 'kept_other_owner': keptOtherOwner++; break;
      case 'needs_enrichment': needsEnrichment++; break;
    }
  }
  return { total: connectionIds.length, promoted, demoted, alreadyIn, alreadyOut, keptNative, keptOtherOwner, needsEnrichment, failed, results };
}

/** Persist the admin's explicit per-connection pool decision (in / out / clear). */
export async function setPoolOverride(
  supabase: SupabaseClient,
  orgId: string,
  connectionIds: string[],
  override: 'in' | 'out' | null,
): Promise<{ ok: boolean; reason?: string }> {
  const { error } = await supabase
    .from('connections')
    .update({ pool_override: override, updated_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .in('connection_id', connectionIds);
  return error ? { ok: false, reason: error.message } : { ok: true };
}
