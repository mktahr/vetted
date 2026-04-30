#!/usr/bin/env node
//
// scripts/backfill-company-linkedin-urls.mjs
//
// One-time backfill: for every existing companies row whose linkedin_url is
// NULL, look up the most recent matching raw_ingest_events payload (Crust v2
// only) and extract the company_professional_network_profile_url that was
// embedded in that profile's experience entries. Write it back to companies.
//
// Read-only against raw_ingest_events. Updates companies.linkedin_url +
// updated_at only. Never overwrites a non-null linkedin_url.
//
// Run: node scripts/backfill-company-linkedin-urls.mjs        # dry run
//      node scripts/backfill-company-linkedin-urls.mjs --apply # actually write
//
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
// Source: docs of the v2 person response confirmed company_professional_
// network_profile_url is embedded in every experience.employment_details.
// {current,past}[] entry. raw_ingest_events.payload preserves the verbatim
// PersonSearchResult, so we can mine it without re-pulling from Crust.

import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const VERBOSE = process.argv.includes('--verbose')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supa = createClient(url, key)

console.log(`[backfill] mode = ${APPLY ? 'APPLY (writes will commit)' : 'DRY-RUN (no writes)'}`)

// ---------- 1. Pull every company that needs backfilling ----------

let nullUrlCompanies = []
{
  let page = 0
  while (true) {
    const { data, error } = await supa
      .from('companies')
      .select('company_id, company_name')
      .is('linkedin_url', null)
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (error) throw error
    if (!data?.length) break
    nullUrlCompanies = nullUrlCompanies.concat(data)
    if (data.length < 1000) break
    page++
  }
}
console.log(`[backfill] companies with NULL linkedin_url: ${nullUrlCompanies.length}`)

// Index by lowercased name for matching against payloads
const idByName = new Map()
for (const c of nullUrlCompanies) {
  idByName.set(c.company_name.trim().toLowerCase(), { company_id: c.company_id, name: c.company_name })
}

// ---------- 2. Walk raw_ingest_events, extract company URLs ----------

const PAGE = 500
let cursor = 0
const candidates = new Map()  // company_id -> { url, fetched_at, payload_source }
let scanned = 0
let withCompanyData = 0

while (true) {
  const { data, error } = await supa
    .from('raw_ingest_events')
    .select('id, source, payload, fetched_at, processing_status')
    .eq('source', 'crust_v2')
    .eq('processing_status', 'mapped')
    .order('fetched_at', { ascending: false })
    .range(cursor, cursor + PAGE - 1)
  if (error) throw error
  if (!data?.length) break
  scanned += data.length

  for (const row of data) {
    const exp = row.payload?.experience?.employment_details
    if (!exp) continue
    withCompanyData++
    const employers = [...(exp.current || []), ...(exp.past || [])]
    for (const emp of employers) {
      const empName = (emp?.name || '').trim().toLowerCase()
      const empUrl = (emp?.company_professional_network_profile_url || '').trim()
      if (!empName || !empUrl) continue
      const target = idByName.get(empName)
      if (!target) continue
      // Newest-fetched-first ordering means the first hit is the most recent
      if (!candidates.has(target.company_id)) {
        candidates.set(target.company_id, {
          url: empUrl,
          fetched_at: row.fetched_at,
          name: target.name,
        })
      }
    }
  }

  if (data.length < PAGE) break
  cursor += PAGE
}

console.log(`[backfill] scanned ${scanned} raw_ingest_events rows (${withCompanyData} with experience data)`)
console.log(`[backfill] resolved URLs for ${candidates.size} / ${nullUrlCompanies.length} null-URL companies`)

// ---------- 3. Apply (or report) ----------

let written = 0
let skippedRace = 0
let failed = 0

for (const [company_id, { url: ll, name }] of candidates) {
  if (VERBOSE) console.log(`  ${name.padEnd(40)} → ${ll}`)
  if (!APPLY) continue

  // .is('linkedin_url', null) makes the update atomic — if a concurrent
  // ingest just filled it, this update affects 0 rows and we count as race.
  const { data, error, count } = await supa
    .from('companies')
    .update({ linkedin_url: ll, updated_at: new Date().toISOString() })
    .eq('company_id', company_id)
    .is('linkedin_url', null)
    .select('company_id', { count: 'exact' })
  if (error) {
    failed++
    console.error(`  ✗ ${name}: ${error.message}`)
    continue
  }
  if (!data || data.length === 0) {
    skippedRace++
    continue
  }
  written++
}

console.log()
if (APPLY) {
  console.log(`[backfill] wrote ${written}, skipped (already filled) ${skippedRace}, failed ${failed}`)
} else {
  console.log(`[backfill] DRY RUN: would write ${candidates.size} rows. Re-run with --apply to commit.`)
}
