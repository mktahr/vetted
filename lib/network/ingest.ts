// lib/network/ingest.ts
//
// The upload ingest orchestrator. Given an org, an employee, and the raw text
// of that employee's LinkedIn Connections.csv, it:
//
//   1. parses the 6 fields (skipping junk preamble),
//   2. stores every row verbatim in raw_connection_rows (the replay buffer),
//   3. canonicalizes URLs and dedupes into `connections` within the org,
//   4. classifies each title (free taxonomy pass) + resolves a best-effort
//      specialty + overlays the free company score,
//   5. (re-upload = fresh snapshot) refreshes company/title; freshest wins,
//   6. links/activates connection_owners for the selected employee,
//   7. soft-disconnects this employee's previously-present connections that are
//      ABSENT from this upload (owner link → is_active=false; connection kept),
//   8. returns a post-upload summary incl. the pre-enrichment cost estimate.
//
// ISOLATION: writes only to the module's own tables. Never people, never
// /api/ingest.

import { SupabaseClient } from '@supabase/supabase-js';
import { parseConnectionsCsv, parseConnectedOn } from './parse-csv';
import { canonicalizeLinkedInUrl } from './canonicalize-url';
import { classifyTitle } from './classify-title';
import { buildCompanyScoreResolver } from './company-overlay';
import { buildDedupeReport } from './dedupe';
import { CREDITS_PER_ENRICH } from './config';
import { loadSpecialtyDictionary, resolveSpecialty } from '../normalize/specialty';

export interface IngestSummary {
  batchId: string;
  rowsParsed: number;
  rowsSkipped: number;       // no canonicalizable URL
  rowsNew: number;           // new connection rows created
  rowsMatched: number;       // existing org connections refreshed
  bucketYes: number;
  bucketMaybe: number;
  bucketNo: number;
  softDisconnected: number;  // this employee's owner links deactivated
  // Cost picture (basis: canonical URLs seen this upload).
  alreadyEnrichedCrossSilo: number; // present in network_enriched_profiles (any org)
  alreadyInGlobalPool: number;      // matched the people pool (not already cached)
  needsEnrichment: number;          // genuinely new → would cost credits
  estimatedCredits: number;
}

interface PreparedRow {
  canonical: string;
  raw_url: string;
  first_name: string;
  last_name: string;
  full_name: string;
  current_company: string;
  current_title: string;
  connected_on: string | null;
  connected_on_raw: string;
  bucket: 'yes' | 'maybe' | 'no';
  bucket_source: 'taxonomy';
  specialty: string | null;
  company_id: string | null;
  company_score: number | null;
  company_score_year: number | null;
}

export async function ingestConnectionsCsv(params: {
  supabase: SupabaseClient;
  orgId: string;
  employeeId: string;
  filename: string | null;
  csvText: string;
  scopeKey?: string;
}): Promise<IngestSummary> {
  const { supabase, orgId, employeeId, filename, csvText, scopeKey = 'engineering' } = params;

  const parsed = parseConnectionsCsv(csvText);
  const rowsParsed = parsed.rows.length;

  // 1) Create the upload batch up front so raw rows can reference it.
  const { data: batch, error: batchErr } = await supabase
    .from('upload_batches')
    .insert({ org_id: orgId, employee_id: employeeId, filename, rows_parsed: rowsParsed })
    .select('batch_id')
    .single();
  if (batchErr || !batch) throw new Error(`create upload_batch: ${batchErr?.message}`);
  const batchId = (batch as { batch_id: string }).batch_id;

  // 2) Store every parsed row verbatim (replay buffer).
  if (parsed.rows.length > 0) {
    const rawRows = parsed.rows.map((r) => ({
      org_id: orgId,
      employee_id: employeeId,
      upload_batch_id: batchId,
      first_name: r.first_name,
      last_name: r.last_name,
      url: r.url,
      email: r.email,
      company: r.company,
      position: r.position,
      connected_on: r.connected_on,
      raw_line: r,
    }));
    // Chunk inserts to stay within payload limits.
    for (let i = 0; i < rawRows.length; i += 500) {
      const { error } = await supabase.from('raw_connection_rows').insert(rawRows.slice(i, i + 500));
      if (error) throw new Error(`insert raw_connection_rows: ${error.message}`);
    }
  }

  // 3) Prepare per-row projection: canonicalize, classify, specialty, company.
  // Specialty is a best-effort, non-final prioritization signal — the
  // specialty_dictionary is mid-rebuild (five-axis taxonomy), so a load failure
  // must NOT break ingest. Degrade to specialty=null when unavailable.
  let specialtyAvailable = true;
  try {
    await loadSpecialtyDictionary(supabase);
  } catch (e) {
    specialtyAvailable = false;
    console.warn('[network/ingest] specialty resolution disabled:', (e as Error)?.message);
  }
  const companyResolver = await buildCompanyScoreResolver(supabase);

  const prepared: PreparedRow[] = [];
  let rowsSkipped = 0;
  for (const r of parsed.rows) {
    const canonical = canonicalizeLinkedInUrl(r.url);
    if (!canonical) {
      rowsSkipped++;
      continue;
    }
    const fullName = [r.first_name, r.last_name].filter(Boolean).join(' ').trim();
    const cls = classifyTitle(r.position, scopeKey);
    const spec = specialtyAvailable ? resolveSpecialty(r.position, null, null, []) : null;
    const co = companyResolver.resolve(r.company);
    prepared.push({
      canonical,
      raw_url: r.url,
      first_name: r.first_name,
      last_name: r.last_name,
      full_name: fullName,
      current_company: r.company,
      current_title: r.position,
      connected_on: parseConnectedOn(r.connected_on),
      connected_on_raw: r.connected_on,
      bucket: cls.bucket,
      bucket_source: 'taxonomy',
      specialty: spec?.specialty_normalized ?? null,
      company_id: co?.company_id ?? null,
      company_score: co?.company_score ?? null,
      company_score_year: co?.company_score_year ?? null,
    });
  }

  // Within a single CSV the same person can appear twice (rare). Collapse on
  // canonical URL, last occurrence wins (freshest within the file).
  const byCanonical = new Map<string, PreparedRow>();
  for (const p of prepared) byCanonical.set(p.canonical, p);
  const uniqueRows = Array.from(byCanonical.values());
  const canonicalSet = uniqueRows.map((p) => p.canonical);

  // 4) Load existing org connections for this canonical set (dedupe + preserve
  //    manual/human bucket decisions on re-upload).
  const existing = new Map<string, {
    connection_id: string;
    title_bucket: string;
    title_bucket_source: string | null;
    status: string;
  }>();
  for (let i = 0; i < canonicalSet.length; i += 500) {
    const slice = canonicalSet.slice(i, i + 500);
    const { data, error } = await supabase
      .from('connections')
      .select('connection_id, canonical_url, title_bucket, title_bucket_source, status')
      .eq('org_id', orgId)
      .in('canonical_url', slice);
    if (error) throw new Error(`load existing connections: ${error.message}`);
    for (const row of data ?? []) {
      const rr = row as any;
      existing.set(rr.canonical_url, {
        connection_id: rr.connection_id,
        title_bucket: rr.title_bucket,
        title_bucket_source: rr.title_bucket_source,
        status: rr.status,
      });
    }
  }

  // Preserve human/LLM decisions: a connection whose bucket was set manually or
  // via web-check keeps its bucket + status; taxonomy/llm_triage re-derive.
  const PRESERVE = new Set(['manual', 'web_check']);

  const toInsert: any[] = [];
  const updates: Array<{ connection_id: string; patch: any }> = [];
  let bucketYes = 0, bucketMaybe = 0, bucketNo = 0;

  for (const p of uniqueRows) {
    const prior = existing.get(p.canonical);
    const derivedStatus = p.bucket === 'no' ? 'excluded' : 'active';

    if (!prior) {
      toInsert.push({
        org_id: orgId,
        canonical_url: p.canonical,
        raw_url: p.raw_url,
        first_name: p.first_name,
        last_name: p.last_name,
        full_name: p.full_name,
        current_company: p.current_company,
        current_title: p.current_title,
        connected_on: p.connected_on,
        connected_on_raw: p.connected_on_raw,
        function_scope: scopeKey,
        title_bucket: p.bucket,
        title_bucket_source: p.bucket_source,
        specialty_normalized: p.specialty,
        status: derivedStatus,
        company_id: p.company_id,
        company_score: p.company_score,
        company_score_year: p.company_score_year,
      });
    } else {
      // Freshest-wins refresh of company/title + company overlay always.
      const patch: any = {
        raw_url: p.raw_url,
        current_company: p.current_company,
        current_title: p.current_title,
        connected_on: p.connected_on,
        connected_on_raw: p.connected_on_raw,
        specialty_normalized: p.specialty,
        company_id: p.company_id,
        company_score: p.company_score,
        company_score_year: p.company_score_year,
        updated_at: new Date().toISOString(),
      };
      // Re-classify only when the prior decision wasn't human/web-check.
      if (!PRESERVE.has(prior.title_bucket_source ?? '')) {
        patch.title_bucket = p.bucket;
        patch.title_bucket_source = p.bucket_source;
        patch.status = derivedStatus;
      }
      updates.push({ connection_id: prior.connection_id, patch });
    }

    if (p.bucket === 'yes') bucketYes++;
    else if (p.bucket === 'no') bucketNo++;
    else bucketMaybe++;
  }

  // 5) Apply inserts (batched) + updates (individual). Capture canonical→id.
  const canonicalToId = new Map<string, string>();
  existing.forEach((e, canon) => canonicalToId.set(canon, e.connection_id));

  for (let i = 0; i < toInsert.length; i += 500) {
    const slice = toInsert.slice(i, i + 500);
    const { data, error } = await supabase
      .from('connections')
      .insert(slice)
      .select('connection_id, canonical_url');
    if (error) throw new Error(`insert connections: ${error.message}`);
    for (const row of data ?? []) {
      const rr = row as { connection_id: string; canonical_url: string };
      canonicalToId.set(rr.canonical_url, rr.connection_id);
    }
  }
  for (const u of updates) {
    const { error } = await supabase.from('connections').update(u.patch).eq('connection_id', u.connection_id);
    if (error) throw new Error(`update connection: ${error.message}`);
  }

  // 6) Owner links: upsert (connection ↔ employee), reactivate + stamp
  //    last_seen. first_seen is set separately below so re-uploads don't clobber
  //    it. Build rows directly from uniqueRows (keep index alignment).
  const ownerRows = uniqueRows
    .map((p) => ({ id: canonicalToId.get(p.canonical), connected_on: p.connected_on }))
    .filter((x): x is { id: string; connected_on: string | null } => Boolean(x.id))
    .map((x) => ({
      connection_id: x.id,
      employee_id: employeeId,
      org_id: orgId,
      is_active: true,
      connected_on: x.connected_on,
      last_seen_batch_id: batchId,
    }));
  for (let i = 0; i < ownerRows.length; i += 500) {
    const slice = ownerRows.slice(i, i + 500);
    const { error } = await supabase
      .from('connection_owners')
      .upsert(slice, { onConflict: 'connection_id,employee_id', ignoreDuplicates: false });
    if (error) throw new Error(`upsert connection_owners: ${error.message}`);
  }
  // Stamp first_seen_batch_id only on links that never had one (brand-new this
  // batch). Pre-existing links keep their original first_seen. last_seen drives
  // the soft-disconnect; first_seen is informational provenance.
  await supabase
    .from('connection_owners')
    .update({ first_seen_batch_id: batchId })
    .eq('employee_id', employeeId)
    .eq('last_seen_batch_id', batchId)
    .is('first_seen_batch_id', null);

  // 7) Soft-disconnect: this employee's still-active links NOT seen in this
  //    batch → is_active=false. Connection + enrichment preserved.
  const { data: disc, error: discErr } = await supabase
    .from('connection_owners')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('employee_id', employeeId)
    .eq('is_active', true)
    .neq('last_seen_batch_id', batchId)
    .select('id');
  if (discErr) throw new Error(`soft-disconnect: ${discErr.message}`);
  const softDisconnected = (disc ?? []).length;

  // 8) Pre-enrichment cost estimate over the canonical set.
  const dedupe = await buildDedupeReport(supabase, canonicalSet);

  const rowsNew = toInsert.length;
  const rowsMatched = updates.length;

  // Persist rollup counts on the batch.
  await supabase
    .from('upload_batches')
    .update({
      rows_new: rowsNew,
      rows_matched: rowsMatched,
      rows_skipped: rowsSkipped,
      bucket_yes: bucketYes,
      bucket_maybe: bucketMaybe,
      bucket_no: bucketNo,
    })
    .eq('batch_id', batchId);

  return {
    batchId,
    rowsParsed,
    rowsSkipped,
    rowsNew,
    rowsMatched,
    bucketYes,
    bucketMaybe,
    bucketNo,
    softDisconnected,
    alreadyEnrichedCrossSilo: dedupe.inEnrichmentCache,
    alreadyInGlobalPool: dedupe.inGlobalPool,
    needsEnrichment: dedupe.needsEnrichment,
    estimatedCredits: dedupe.needsEnrichment * CREDITS_PER_ENRICH,
  };
}
