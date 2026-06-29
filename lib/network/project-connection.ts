// lib/network/project-connection.ts
//
// NETWORK CONNECTIONS PR 2b — step 6b: project an enriched connection into the
// global `people` table (record_kind='network_connection') so it's searchable by
// the existing 25-axis machinery, WITHOUT entering the default candidate pool.
//
// RESOLVE-FIRST flow (Codex blocker 1 — global-pool-reuse connections have NO blob):
//   1. Load the connection. If already linked (person_id set) → no-op.
//   2. Canonicalize its URL and look for an existing `people` row that canonicalizes
//      to the same (app-side match — NOT the linkedin_url unique constraint, since
//      stored formats vary).
//   3. EXISTING person found → MERGE: link connections.person_id + guarded promote
//      candidate→both. No rewrite, no rescore (an existing candidate shouldn't be
//      overwritten just to record that they're also a connection).
//   4. NO existing person → require a fresh rich enrich blob → mapEnrichToCanonical
//      → writeCanonicalProfile({identity:'network_insert'}) → link. On a UNIQUE race
//      (a concurrent candidate ingest won) → fall back to merge (link + promote).
//
// record_kind transition is applied as the LAST visibility op (Codex blocker 2):
//   - new insert: record_kind='network_connection' is set at insert, and exp/edu/
//     score all run before it could ever be promoted, so it's never half-exposed.
//   - merge onto a pool candidate: promote candidate→both AFTER linking.
//
// connections.person_id is set ONLY after the person op succeeds; if linking fails
// the projection reports failure and a rerun safely retries the link.

import { SupabaseClient } from '@supabase/supabase-js';
import { canonicalizeLinkedInUrl } from './canonicalize-url';
import { loadGlobalPoolMatches } from './dedupe';
import { mapEnrichToCanonical } from '../ingest/mappers/crust-enrich';
import { writeCanonicalProfile } from '../ingest/write-canonical';
import { STALE_AFTER_DAYS } from './config';

export type ProjectAction = 'already_linked' | 'merged' | 'merged_on_race' | 'projected';

export type ProjectResult =
  | { ok: true; connectionId: string; personId: string; action: ProjectAction; bucket?: string | null; totalScore?: number | null }
  | { ok: false; connectionId: string; reason: 'connection_not_found' | 'bad_url' | 'no_enrichment_blob' | 'stale_enrichment_blob' | 'map_failed' | 'person_write_failed' | 'link_failed' | 'promotion_failed' };

/**
 * Guarded promote candidate→both. No-op (still succeeds) if record_kind is already
 * 'both' or 'network_connection'. Returns false on DB error so the caller can
 * propagate it — a silent failure here would leave record_kind out of sync with
 * the connection link.
 */
async function promoteCandidateToBoth(supabase: SupabaseClient, personId: string): Promise<boolean> {
  const { error } = await supabase
    .from('people')
    .update({ record_kind: 'both', updated_at: new Date().toISOString() })
    .eq('person_id', personId)
    .eq('record_kind', 'candidate');
  return !error;
}

/** Set connections.person_id. Returns false on failure so the caller can report it. */
async function linkConnection(supabase: SupabaseClient, connectionId: string, personId: string): Promise<boolean> {
  const { error } = await supabase
    .from('connections')
    .update({ person_id: personId, updated_at: new Date().toISOString() })
    .eq('connection_id', connectionId);
  return !error;
}

/**
 * Project a single connection into `people`. Idempotent — re-running a linked
 * connection is a no-op; re-running an unlinked one safely retries.
 */
export async function projectConnection(supabase: SupabaseClient, connectionId: string): Promise<ProjectResult> {
  // 1. Load the connection.
  const { data: conn } = await supabase
    .from('connections')
    .select('connection_id, org_id, canonical_url, person_id, enriched')
    .eq('connection_id', connectionId)
    .maybeSingle();
  if (!conn) return { ok: false, connectionId, reason: 'connection_not_found' };
  if (conn.person_id) {
    // Already linked. Re-run the guarded promote to REPAIR a partial state (a prior
    // run that linked but failed before promoting candidate→both). No-op for a
    // network_connection person. This is the retry path Codex flagged.
    if (!(await promoteCandidateToBoth(supabase, conn.person_id))) {
      return { ok: false, connectionId, reason: 'promotion_failed' };
    }
    return { ok: true, connectionId, personId: conn.person_id, action: 'already_linked' };
  }

  const canon = canonicalizeLinkedInUrl(conn.canonical_url);
  if (!canon) return { ok: false, connectionId, reason: 'bad_url' };

  // 2. Resolve an existing people row by canonical-URL match (app-side).
  const poolMatches = await loadGlobalPoolMatches(supabase, [canon]);
  const existing = poolMatches.get(canon);

  // 3. MERGE onto an existing person — LINK FIRST, then guarded promote, both
  //    error-checked. No rewrite/rescore (don't overwrite a candidate's own data).
  //    Link-first so a promote failure leaves a linked row that a rerun repairs,
  //    never a 'both' row with no connection (Codex blocker 2).
  if (existing) {
    if (!(await linkConnection(supabase, connectionId, existing.person_id))) {
      return { ok: false, connectionId, reason: 'link_failed' };
    }
    if (!(await promoteCandidateToBoth(supabase, existing.person_id))) {
      return { ok: false, connectionId, reason: 'promotion_failed' };
    }
    return { ok: true, connectionId, personId: existing.person_id, action: 'merged' };
  }

  // 4. New person — require a FRESH rich enrich blob. global_pool_reuse rows have
  //    enriched_profile=NULL (and would have matched the pool above anyway). A blob
  //    older than STALE_AFTER_DAYS is refused — re-enrich first (mirrors the dedup
  //    freshness policy; a direct merge above needs no blob).
  const { data: blobRow } = await supabase
    .from('network_enriched_profiles')
    .select('enriched_profile, source, last_enriched_at')
    .eq('canonical_url', canon)
    .maybeSingle();
  const personData = blobRow?.source === 'crust_person_enrich' ? blobRow.enriched_profile : null;
  if (!personData) return { ok: false, connectionId, reason: 'no_enrichment_blob' };
  const ageMs = blobRow?.last_enriched_at ? Date.now() - new Date(blobRow.last_enriched_at).getTime() : Infinity;
  if (ageMs > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000) {
    return { ok: false, connectionId, reason: 'stale_enrichment_blob' };
  }

  const fullUrl = `https://www.${canon}`; // canon = "linkedin.com/in/<slug>"
  const payload = mapEnrichToCanonical(personData, fullUrl);
  if (!payload) return { ok: false, connectionId, reason: 'map_failed' };

  const result = await writeCanonicalProfile(supabase, payload, {
    identity: { mode: 'network_insert' },
    score: true,
  });

  // Race: a concurrent candidate ingest created this person mid-flight. Merge
  // instead of overwriting their candidate data.
  if (result.ok === false && result.reason === 'person_exists') {
    if (!(await linkConnection(supabase, connectionId, result.personId))) {
      return { ok: false, connectionId, reason: 'link_failed' };
    }
    if (!(await promoteCandidateToBoth(supabase, result.personId))) {
      return { ok: false, connectionId, reason: 'promotion_failed' };
    }
    return { ok: true, connectionId, personId: result.personId, action: 'merged_on_race' };
  }

  if (!result.ok) return { ok: false, connectionId, reason: 'person_write_failed' };

  // 5. Link ONLY after the person op succeeded.
  if (!(await linkConnection(supabase, connectionId, result.personId))) {
    return { ok: false, connectionId, reason: 'link_failed' };
  }
  return {
    ok: true,
    connectionId,
    personId: result.personId,
    action: 'projected',
    bucket: result.bucket,
    totalScore: result.totalScore,
  };
}

export interface ProjectBatchSummary {
  total: number;
  projected: number;
  merged: number;
  alreadyLinked: number;
  failed: number;
  results: ProjectResult[];
}

/** Project a set of connections sequentially (Crust/scoring are not parallel-safe here). */
export async function projectConnections(supabase: SupabaseClient, connectionIds: string[]): Promise<ProjectBatchSummary> {
  const results: ProjectResult[] = [];
  let projected = 0, merged = 0, alreadyLinked = 0, failed = 0;
  for (const id of connectionIds) {
    const r = await projectConnection(supabase, id);
    results.push(r);
    if (!r.ok) failed++;
    else if (r.action === 'projected') projected++;
    else if (r.action === 'already_linked') alreadyLinked++;
    else merged++;
  }
  return { total: connectionIds.length, projected, merged, alreadyLinked, failed, results };
}
