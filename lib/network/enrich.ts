// lib/network/enrich.ts
//
// Per-URL Crust enrichment for network connections. NET-NEW Crust usage
// (today's Crust integration is search-by-filter, not enrich-by-URL). Reuses
// fetchPersonEnrich (auth + 429-retry) from lib/crust/api.ts and crust_import_log
// for cost tracking. Writes ONLY to the module's tables — never people,
// never /api/ingest.
//
// Flow:
//   1. Resolve the target connection set (org / employee / hand-picked).
//   2. Dedupe each canonical URL against the cross-silo cache + global people
//      pool. Reuse those for free (mark enriched). Pool hits are materialized
//      into network_enriched_profiles (source=global_pool_reuse) so later
//      lookups are uniform — we READ people, we never write to it.
//   3. Crust-enrich only the genuine unknowns (batches of 25), cache results,
//      mark connections enriched.
//
// mode='estimate' stops after step 1's dedupe and returns the cost picture
// WITHOUT spending credits — the count shown before the admin confirms.

import { SupabaseClient } from '@supabase/supabase-js';
import { canonicalizeLinkedInUrl } from './canonicalize-url';
import { buildDedupeReport } from './dedupe';
import { CREDITS_PER_ENRICH } from './config';
import { fetchPersonEnrich } from '../crust/api';
import { writeCrustLog } from '../crust/log';

export type EnrichScope = 'org' | 'employee' | 'connections';

export interface EnrichParams {
  supabase: SupabaseClient;
  orgId: string;
  scope: EnrichScope;
  employeeId?: string | null;
  connectionIds?: string[] | null;
  force?: boolean;        // re-enrich even if already enriched
  mode?: 'estimate' | 'run';
}

export interface EnrichSummary {
  mode: 'estimate' | 'run';
  target: number;          // connections in scope eligible for enrichment
  reusedCrossSilo: number; // served from network_enriched_profiles
  reusedGlobalPool: number;
  needs: number;           // genuine unknowns
  estimatedCredits: number;
  // run-only:
  enrichedNew?: number;    // newly enriched via Crust
  failed?: number;
  creditsSpent?: number;
}

interface TargetConn { connection_id: string; canonical_url: string; enriched: boolean }

const CRUST_BATCH = 25;

// Field groups requested from /person/enrich. Omitting `fields` returns ONLY
// basic_profile on our account (verified live 2026-06-28) — useless for the
// five-axis projection. This explicit set unlocks full work history + education
// + skills at base cost. `certifications`/`honors` are DENIED to our account
// (requesting them 403s the entire call); `contact` is a paid add-on we don't
// need for search. Keep this list to the confirmed-permitted, base-cost groups.
const ENRICH_FIELDS = ['basic_profile', 'experience', 'education', 'skills'];

function canonicalToProfileUrl(canonical: string): string {
  // canonical = "linkedin.com/in/<slug>" → full www URL Crust expects.
  return `https://www.${canonical}`;
}

// Pull a profile URL out of a Crust enrich result (mapper-style field paths).
function extractProfileUrl(profile: any): string | null {
  return (
    profile?.social_handles?.professional_network_identifier?.profile_url ??
    profile?.linkedin_profile_url ??
    profile?.linkedin_url ??
    profile?.profile_url ??
    null
  );
}

async function resolveTargets(p: EnrichParams): Promise<TargetConn[]> {
  const { supabase, orgId, scope, employeeId, connectionIds } = p;

  let ids: string[] | null = null;
  if (scope === 'connections') {
    ids = connectionIds ?? [];
    if (ids.length === 0) return [];
  } else if (scope === 'employee') {
    if (!employeeId) return [];
    const { data: owners } = await supabase
      .from('connection_owners')
      .select('connection_id')
      .eq('employee_id', employeeId)
      .eq('is_active', true);
    ids = (owners ?? []).map((o) => (o as any).connection_id);
    if (ids.length === 0) return [];
  }

  let q = supabase
    .from('connections')
    .select('connection_id, canonical_url, enriched')
    .eq('org_id', orgId)
    .eq('status', 'active');
  if (ids) q = q.in('connection_id', ids);

  const { data, error } = await q;
  if (error) throw new Error(`resolveTargets: ${error.message}`);
  return (data ?? []) as TargetConn[];
}

async function markEnriched(supabase: SupabaseClient, orgId: string, canonicals: string[], when: string) {
  if (canonicals.length === 0) return;
  for (let i = 0; i < canonicals.length; i += 200) {
    const slice = canonicals.slice(i, i + 200);
    await supabase
      .from('connections')
      .update({ enriched: true, last_enriched_at: when, updated_at: when })
      .eq('org_id', orgId)
      .in('canonical_url', slice);
  }
}

export async function enrichConnections(p: EnrichParams): Promise<EnrichSummary> {
  const { supabase, orgId, force = false, mode = 'run' } = p;

  const allTargets = await resolveTargets(p);
  const targets = force ? allTargets : allTargets.filter((t) => !t.enriched);
  const canonicals = Array.from(new Set(targets.map((t) => t.canonical_url)));

  const dedupe = await buildDedupeReport(supabase, canonicals);
  const needs = canonicals.filter((c) => !dedupe.cache.has(c) && !dedupe.pool.has(c));

  const base: EnrichSummary = {
    mode,
    target: targets.length,
    reusedCrossSilo: dedupe.inEnrichmentCache,
    reusedGlobalPool: dedupe.inGlobalPool,
    needs: needs.length,
    estimatedCredits: needs.length * CREDITS_PER_ENRICH,
  };
  if (mode === 'estimate') return base;

  const now = new Date().toISOString();

  // (1) Reuse cross-silo cache — just mark connections enriched.
  await markEnriched(supabase, orgId, Array.from(dedupe.cache.keys()), now);

  // (2) Reuse global pool — materialize a cache row (source=global_pool_reuse),
  //     then mark enriched. We read people; we never write to it.
  const poolCanonicals = Array.from(dedupe.pool.keys());
  if (poolCanonicals.length > 0) {
    const rows = poolCanonicals.map((c) => ({
      canonical_url: c,
      source: 'global_pool_reuse',
      display_name: dedupe.pool.get(c)?.full_name ?? null,
      last_enriched_at: now,
    }));
    await supabase.from('network_enriched_profiles').upsert(rows, { onConflict: 'canonical_url', ignoreDuplicates: true });
    await markEnriched(supabase, orgId, poolCanonicals, now);
  }

  // (3) Crust-enrich the genuine unknowns.
  let enrichedNew = 0;
  let failed = 0;
  const apiKey = process.env.CRUSTDATA_API_KEY;
  if (needs.length > 0 && !apiKey) {
    throw new Error('CRUSTDATA_API_KEY not set');
  }
  for (let i = 0; i < needs.length; i += CRUST_BATCH) {
    const batch = needs.slice(i, i + CRUST_BATCH);
    const urls = batch.map(canonicalToProfileUrl);
    const resp = await fetchPersonEnrich(apiKey!, urls, { fields: ENRICH_FIELDS });
    if (resp.error) {
      failed += batch.length;
      await writeCrustLog(supabase, { request_kind: 'network_enrich', filter_body: { enrich_by_profile_url: urls }, results_count: 0, credits_used: 0, error_message: resp.error });
      continue;
    }

    const enrichedCanonicals: string[] = [];
    const cacheRows: any[] = [];
    for (const item of resp.profiles) {
      // Live Crust /person/enrich returns { matched_on, matches: [{ person_data }] }.
      // Fall back to an older flat shape defensively.
      const purl = (item as any)?.matched_on ?? extractProfileUrl(item);
      const canon = canonicalizeLinkedInUrl(purl);
      if (!canon || !batch.includes(canon)) continue;
      // Genuine no-match: Crust echoes matched_on with an empty matches[]. Skip so it
      // counts as failed rather than caching a hollow "enriched" row (which would also
      // mark the connection enriched and stop it from ever retrying).
      const personData = (item as any)?.matches?.[0]?.person_data ?? null;
      if (!personData) continue;
      const basic = (personData as any)?.basic_profile ?? personData;
      // Enrich shape nests employment under `experience.` (matches the working
      // crust-v2 search mapper); the employer's company name is `name`, not
      // `company_name` (verified live 2026-06-28 — company_name comes back undefined).
      // Pick the primary current role the same way the search mapper does:
      // prefer is_default===true, fall back to the first current entry. Avoids
      // snapshotting a secondary current role (overlapping advisory/internship).
      const currentRoles: any[] = (personData as any)?.experience?.employment_details?.current ?? [];
      const employment = currentRoles.find((e) => e?.is_default === true) ?? currentRoles[0] ?? null;
      enrichedCanonicals.push(canon);
      cacheRows.push({
        canonical_url: canon,
        source: 'crust_person_enrich',
        enriched_profile: personData,
        display_name: (basic as any)?.name ?? (basic as any)?.full_name ?? null,
        headline: (basic as any)?.headline ?? null,
        location_name: (basic as any)?.location?.raw ?? (basic as any)?.location ?? null,
        current_company: employment?.name ?? employment?.company_name ?? (basic as any)?.current_company?.name ?? null,
        current_title: employment?.title ?? (basic as any)?.current_title ?? null,
        last_enriched_at: now,
      });
    }
    if (cacheRows.length > 0) {
      await supabase.from('network_enriched_profiles').upsert(cacheRows, { onConflict: 'canonical_url' });
      await markEnriched(supabase, orgId, enrichedCanonicals, now);
    }
    enrichedNew += enrichedCanonicals.length;
    failed += batch.length - enrichedCanonicals.length;

    await writeCrustLog(supabase, {
      request_kind: 'network_enrich',
      filter_body: { enrich_by_profile_url: urls },
      results_count: enrichedCanonicals.length,
      credits_used: batch.length * CREDITS_PER_ENRICH,
    });
  }

  return {
    ...base,
    enrichedNew,
    failed,
    creditsSpent: needs.length * CREDITS_PER_ENRICH,
  };
}
