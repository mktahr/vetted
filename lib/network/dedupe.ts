// lib/network/dedupe.ts
//
// Pre-enrichment dedupe. Before spending Crust credits on a connection's URL we
// check two reuse sources, both keyed by canonical LinkedIn URL:
//
//   (a) the GLOBAL people pool  — people.linkedin_url (stored raw, so we
//       canonicalize it in JS at compare time). Read-only: we reuse the fact
//       that we already know this person; we NEVER write to people.
//   (b) the cross-silo enrichment cache — network_enriched_profiles, which
//       already holds anything enriched by ANY org (or projected from a prior
//       global-pool match).
//
// "If we've EVER enriched this canonical URL anywhere, reuse — don't re-buy."
// Cross-silo reuse stays backend-only; orgs are never shown each other's data.
//
// SCALING NOTE: the global-pool check canonicalizes people.linkedin_url in
// memory (no SQL-side canonical column exists). Fine at current candidate
// volume; revisit with a stored canonical column if the pool grows large.

import { SupabaseClient } from '@supabase/supabase-js';
import { canonicalizeLinkedInUrl } from './canonicalize-url';
import { fetchAllServer } from './client';
import { STALE_AFTER_DAYS } from './config';

export interface EnrichmentCacheHit {
  canonical_url: string;
  enriched_profile_id: string;
  source: string;
  last_enriched_at: string | null;
}

export interface GlobalPoolHit {
  canonical_url: string;
  person_id: string;
  full_name: string | null;
}

/**
 * Look up which of the given canonical URLs are reusable cache hits in
 * network_enriched_profiles. Returns a Map keyed by canonical_url.
 *
 * A row only counts as a VALID reuse hit if all three hold:
 *   - source = 'crust_person_enrich'  — a real paid enrichment. `global_pool_reuse`
 *     rows are markers with enriched_profile=NULL (no searchable blob); they must
 *     NOT block re-enrichment, so they're excluded here and fall through to the
 *     pool path (which re-confirms the people-pool match).
 *   - enriched_profile IS NOT NULL    — belt-and-suspenders against any hollow row.
 *   - last_enriched_at within STALE_AFTER_DAYS — older hits are stale; excluding
 *     them here routes them to re-enrichment so we don't serve years-old data.
 * All three are applied server-side so we never pull the (large) blob just to test it.
 */
export async function loadEnrichmentCache(
  supabase: SupabaseClient,
  canonicalUrls: string[],
): Promise<Map<string, EnrichmentCacheHit>> {
  const map = new Map<string, EnrichmentCacheHit>();
  const unique = Array.from(new Set(canonicalUrls.filter(Boolean)));
  if (unique.length === 0) return map;

  const cutoffIso = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Chunk the IN list to keep URLs well under PostgREST limits.
  const CHUNK = 500;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('network_enriched_profiles')
      .select('canonical_url, enriched_profile_id, source, last_enriched_at')
      .in('canonical_url', slice)
      .eq('source', 'crust_person_enrich')
      .not('enriched_profile', 'is', null)
      .gte('last_enriched_at', cutoffIso);
    if (error) throw new Error(`loadEnrichmentCache: ${error.message}`);
    for (const row of data ?? []) {
      map.set((row as EnrichmentCacheHit).canonical_url, row as EnrichmentCacheHit);
    }
  }
  return map;
}

/**
 * Match canonical URLs against the global people pool. Pulls people with a
 * linkedin_url, canonicalizes each, and returns hits for the requested set.
 */
export async function loadGlobalPoolMatches(
  supabase: SupabaseClient,
  canonicalUrls: string[],
): Promise<Map<string, GlobalPoolHit>> {
  const want = new Set(canonicalUrls.filter(Boolean));
  const map = new Map<string, GlobalPoolHit>();
  if (want.size === 0) return map;

  const people = await fetchAllServer<{ person_id: string; linkedin_url: string | null; full_name: string | null }>(
    supabase,
    'people',
    'person_id, linkedin_url, full_name',
    (q) => q.not('linkedin_url', 'is', null),
  );

  for (const p of people) {
    const canon = canonicalizeLinkedInUrl(p.linkedin_url);
    if (canon && want.has(canon) && !map.has(canon)) {
      map.set(canon, { canonical_url: canon, person_id: p.person_id, full_name: p.full_name });
    }
  }
  return map;
}

export interface DedupeReport {
  total: number;
  inEnrichmentCache: number; // reuse from network_enriched_profiles
  inGlobalPool: number;      // reuse from people (not already in cache)
  needsEnrichment: number;   // genuinely new — would cost credits
  cache: Map<string, EnrichmentCacheHit>;
  pool: Map<string, GlobalPoolHit>;
}

/**
 * Combined dedupe pass over a set of canonical URLs. needsEnrichment is the
 * count that would actually hit Crust — the basis for the pre-enrichment cost
 * estimate shown before the admin spends credits.
 */
export async function buildDedupeReport(
  supabase: SupabaseClient,
  canonicalUrls: string[],
): Promise<DedupeReport> {
  const unique = Array.from(new Set(canonicalUrls.filter(Boolean)));
  const cache = await loadEnrichmentCache(supabase, unique);
  const remaining = unique.filter((u) => !cache.has(u));
  const pool = await loadGlobalPoolMatches(supabase, remaining);
  const needs = remaining.filter((u) => !pool.has(u));

  return {
    total: unique.length,
    inEnrichmentCache: cache.size,
    inGlobalPool: pool.size,
    needsEnrichment: needs.length,
    cache,
    pool,
  };
}
