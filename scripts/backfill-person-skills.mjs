// scripts/backfill-person-skills.mjs
//
// Piece B of taxonomy sub-PR 4: backfill person-level scraped skills
// (people.skills_scraped_raw / skills_matched / skills_matched_at /
// skills_scraped_source) from historical payloads, and re-match after
// dictionary growth.
//
// Usage:
//   node scripts/backfill-person-skills.mjs                 # DRY RUN vs PROD (default)
//   node scripts/backfill-person-skills.mjs --apply         # write to PROD
//   node scripts/backfill-person-skills.mjs --dev           # target dev project
//   node scripts/backfill-person-skills.mjs --rematch       # re-run matcher over stored
//                                                           # skills_scraped_raw only (post-
//                                                           # dictionary-growth), no mining
//
// Default mode mines THREE sources, newest-first per person, and only fills
// people whose skills_scraped_raw IS NULL (never clobbers ingest-written data):
//   (a) raw_ingest_events.payload — MULTI-SHAPE (the archive stores
//       payload.raw_json || payload.canonical_json — Codex round-1 catch):
//       payload.skills_tags, payload.canonical_json.skills_tags,
//       payload.skills (Crust v1 string[]),
//       payload.skills.professional_network_skills (Crust enrich blob)
//   (b) profile_snapshots.canonical_json.skills_tags — legacy extension scrapes
//   (c) network_enriched_profiles.enriched_profile — network-projected people
//       (this path never wrote raw_ingest_events)
//
// Reports (dry-run AND apply): per-source hit counts, matched/unmatched
// aggregates, and an unmatched-tag frequency table for dictionary review.
//
// HARD BOUNDARY: never touches classification lifecycle columns.

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { buildSkillLookup, matchSkillTags, normalizeSkillToken } from './skill-match-lib.mjs'

const envFile = readFileSync('.env.local', 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=')
    return [k.trim(), v.join('=').trim()]
  })
)

const argv = process.argv.slice(2)
const USE_DEV = argv.includes('--dev')
const APPLY = argv.includes('--apply')
const REMATCH = argv.includes('--rematch')

const supabase = USE_DEV
  ? createClient(env.NEXT_PUBLIC_SUPABASE_URL_DEV, env.SUPABASE_SERVICE_ROLE_KEY_DEV)
  : createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const TARGET = USE_DEV ? 'DEV' : 'PROD'

// ─── Multi-shape skills extraction ──────────────────────────────────────

function asStringArray(v) {
  if (!Array.isArray(v)) return null
  const out = v.filter(x => typeof x === 'string' && x.trim().length > 0)
  return out.length > 0 ? out : null
}

/** Extract a skills list from an arbitrary archived payload. Tries every shape
 *  we have ever written; returns null when none carries skills. */
function extractSkills(payload) {
  if (!payload || typeof payload !== 'object') return null
  // canonical-object archives + generic mapper output
  const direct = asStringArray(payload.skills_tags)
  if (direct) return { tags: direct, shape: 'skills_tags' }
  // full ingest-payload archives (defensive)
  const canon = asStringArray(payload.canonical_json?.skills_tags)
  if (canon) return { tags: canon, shape: 'canonical_json.skills_tags' }
  // Crust enrich blob (skills is an OBJECT here)
  const enrich = asStringArray(payload.skills?.professional_network_skills)
  if (enrich) return { tags: enrich, shape: 'skills.professional_network_skills' }
  // nested enrich wrapper shapes (matches[].person_data)
  const pd = payload.person_data ?? payload.matches?.[0]?.person_data
  const nested = asStringArray(pd?.skills?.professional_network_skills)
  if (nested) return { tags: nested, shape: 'person_data.skills.professional_network_skills' }
  // Crust v1 raw (skills is a plain string[])
  const v1 = asStringArray(payload.skills)
  if (v1) return { tags: v1, shape: 'skills[] (crust v1)' }
  return null
}

function dedupeRaw(tags) {
  const seen = new Set()
  const out = []
  for (const t of tags) {
    const key = normalizeSkillToken(t)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(t.trim())
  }
  return out
}

async function fetchAll(table, columns, orderCol) {
  const PAGE = 1000
  let from = 0
  const rows = []
  for (;;) {
    let q = supabase.from(table).select(columns).range(from, from + PAGE - 1)
    if (orderCol) q = q.order(orderCol, { ascending: false })
    const { data, error } = await q
    if (error) throw new Error(`fetch ${table}: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < PAGE) return rows
    from += PAGE
  }
}

async function main() {
  console.log(`backfill-person-skills — target=${TARGET} mode=${REMATCH ? 'REMATCH' : 'BACKFILL'} ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  console.log('─'.repeat(80))

  // Dictionary + lookup (runtime collision defense included)
  const { data: dictRows, error: dictError } = await supabase
    .from('skills_dictionary').select('canonical_name, aliases').eq('is_active', true)
  if (dictError) throw new Error(`skills_dictionary: ${dictError.message}`)
  if (!dictRows || dictRows.length === 0) throw new Error('skills_dictionary has no active rows on the target DB — wrong target?')
  const lookup = buildSkillLookup(dictRows)
  if (lookup.collisions.length > 0) {
    console.error(`⚠ token collisions dropped from lookup (fix via sync-reference gate): ${lookup.collisions.join(', ')}`)
  }
  console.log(`Dictionary: ${dictRows.length} active skills, ${lookup.map.size} tokens`)

  // Pre-migration tolerance: before 098 lands on the target, the skills columns
  // don't exist — fall back to a column-free select so the DRY RUN can still
  // report per-source hit counts (Matt's gate input). --apply obviously requires
  // the migration.
  let people
  let migrated = true
  try {
    people = await fetchAll('people', 'person_id, linkedin_url, full_name, legacy_profile_id, skills_scraped_raw, skills_matched, skills_scraped_source')
  } catch (err) {
    if (!String(err.message).includes('does not exist')) throw err
    migrated = false
    console.log('⚠ migration 098 not applied on this target — DRY-RUN-only mode (all people treated as unfilled)')
    people = (await fetchAll('people', 'person_id, linkedin_url, full_name, legacy_profile_id'))
      .map(p => ({ ...p, skills_scraped_raw: null, skills_matched: null, skills_scraped_source: null }))
  }
  if (APPLY && !migrated) throw new Error('cannot --apply: migration 098 is not applied on this target')
  if (REMATCH && !migrated) throw new Error('cannot --rematch: migration 098 is not applied on this target')

  const updates = []           // { person, raw, matched, unmatched, source, via }
  const unmatchedFreq = new Map()
  const sourceHits = new Map()

  if (REMATCH) {
    // Re-run the matcher over stored raw only. Touches every person that has raw.
    for (const p of people) {
      const raw = asStringArray(p.skills_scraped_raw)
      if (!raw) continue
      const { matched, unmatched } = matchSkillTags(raw, lookup)
      for (const u of unmatched) {
        const k = normalizeSkillToken(u)
        unmatchedFreq.set(k, (unmatchedFreq.get(k) || 0) + 1)
      }
      const before = JSON.stringify(p.skills_matched ?? [])
      if (before !== JSON.stringify(matched)) {
        updates.push({ person: p, raw, matched, unmatched, source: p.skills_scraped_source, via: 'rematch' })
      }
      sourceHits.set('stored skills_scraped_raw', (sourceHits.get('stored skills_scraped_raw') || 0) + 1)
    }
  } else {
    // Mine the three sources. Only fill people with no stored raw yet.
    const candidates = people.filter(p => !asStringArray(p.skills_scraped_raw))
    console.log(`People: ${people.length} total, ${people.length - candidates.length} already have skills (skipped), ${candidates.length} to mine`)

    const byUrl = new Map()
    for (const p of candidates) {
      if (p.linkedin_url) byUrl.set(p.linkedin_url, p)
    }

    // best find per person: { ts, tags, source, via }
    const best = new Map()
    const consider = (person, ts, tags, sourceLabel, via) => {
      if (!person || !tags) return
      const t = ts ? Date.parse(ts) : 0
      const cur = best.get(person.person_id)
      if (!cur || t > cur.ts) best.set(person.person_id, { ts: t, tags, source: sourceLabel, via })
    }

    // (a) raw_ingest_events
    const rawEvents = await fetchAll('raw_ingest_events', 'linkedin_url, source, payload, fetched_at', 'fetched_at')
    for (const ev of rawEvents) {
      const person = byUrl.get(ev.linkedin_url)
      if (!person) continue
      const found = extractSkills(ev.payload)
      if (found) consider(person, ev.fetched_at, found.tags, ev.source ?? 'raw_ingest_events', `raw_ingest_events → ${found.shape}`)
    }

    // (b) profile_snapshots (legacy extension scrapes). Keyed by legacy
    // profiles.id — people.legacy_profile_id is empty in practice (verified 0
    // rows on prod 2026-07-08), so bridge profile_id → profiles.linkedin_url →
    // people.linkedin_url instead.
    const legacyProfiles = await fetchAll('profiles', 'id, linkedin_url, skills_tags, updated_at')
    const legacyIdToPerson = new Map()
    for (const lp of legacyProfiles) {
      const person = byUrl.get(lp.linkedin_url)
      if (person) legacyIdToPerson.set(lp.id, person)
    }
    const snaps = await fetchAll('profile_snapshots', 'profile_id, canonical_json, raw_json, scraped_at', 'scraped_at')
    for (const s of snaps) {
      const person = legacyIdToPerson.get(s.profile_id)
      if (!person) continue
      const found = extractSkills(s.canonical_json) ?? extractSkills(s.raw_json)
      if (found) consider(person, s.scraped_at, found.tags, 'chrome_extension_voyager', `profile_snapshots → ${found.shape}`)
    }

    // (d) legacy profiles.skills_tags — the pre-normalization display layer
    // stored scraped skills directly (still readable; writes deprecated 2026-04-24).
    for (const lp of legacyProfiles) {
      const person = byUrl.get(lp.linkedin_url)
      if (!person) continue
      const tags = asStringArray(lp.skills_tags)
      if (tags) consider(person, lp.updated_at, tags, 'chrome_extension_voyager', 'legacy profiles.skills_tags')
    }

    // (c) network_enriched_profiles (network-projected people, no raw archive)
    const enriched = await fetchAll('network_enriched_profiles', 'canonical_url, enriched_profile, source, created_at')
    // canonical_url → person via people.linkedin_url AND via connections.person_id
    const { data: conns, error: connErr } = await supabase
      .from('connections').select('canonical_url, person_id').not('person_id', 'is', null)
    if (connErr) throw new Error(`connections: ${connErr.message}`)
    const personById = new Map(candidates.map(p => [p.person_id, p]))
    const byCanonicalUrl = new Map()
    for (const c of conns || []) {
      const p = personById.get(c.person_id)
      if (p) byCanonicalUrl.set(c.canonical_url, p)
    }
    for (const e of enriched) {
      const person = byUrl.get(e.canonical_url) || byCanonicalUrl.get(e.canonical_url)
      if (!person) continue
      const found = extractSkills(e.enriched_profile)
      if (found) consider(person, e.created_at, found.tags, e.source ?? 'crust_person_enrich', `network_enriched_profiles → ${found.shape}`)
    }

    for (const [personId, find] of best) {
      const person = personById.get(personId) ?? candidates.find(p => p.person_id === personId)
      const raw = dedupeRaw(find.tags)
      const { matched, unmatched } = matchSkillTags(raw, lookup)
      for (const u of unmatched) {
        const k = normalizeSkillToken(u)
        unmatchedFreq.set(k, (unmatchedFreq.get(k) || 0) + 1)
      }
      updates.push({ person, raw, matched, unmatched, source: find.source, via: find.via })
      sourceHits.set(find.via, (sourceHits.get(find.via) || 0) + 1)
    }
  }

  // ─── Report ────────────────────────────────────────────────────────────
  console.log('\nPER-SOURCE HITS (winning source per person):')
  if (sourceHits.size === 0) console.log('  (none)')
  for (const [src, n] of Array.from(sourceHits).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${src}`)
  }

  console.log(`\n${REMATCH ? 'CHANGED' : 'FILLABLE'}: ${updates.length} people`)
  for (const u of updates.slice(0, 15)) {
    console.log(`  ${u.person.full_name ?? u.person.person_id} — ${u.raw.length} raw → ${u.matched.length} matched, ${u.unmatched.length} unmatched [${u.via}]`)
  }
  if (updates.length > 15) console.log(`  … and ${updates.length - 15} more`)

  const freq = Array.from(unmatchedFreq).sort((a, b) => b[1] - a[1])
  console.log(`\nUNMATCHED-TAG FREQUENCY (dictionary-growth review, ${freq.length} distinct):`)
  for (const [tag, n] of freq.slice(0, 40)) {
    console.log(`  ${String(n).padStart(4)}  ${tag}`)
  }
  if (freq.length > 40) console.log(`  … and ${freq.length - 40} more`)

  if (!APPLY) {
    console.log('\nDRY RUN — no writes. Re-run with --apply to write.')
    return
  }

  console.log('\nApplying…')
  let ok = 0, failed = 0
  for (const u of updates) {
    const { error } = await supabase.from('people').update({
      skills_scraped_raw: u.raw,
      skills_matched: u.matched,
      skills_matched_at: new Date().toISOString(),
      skills_scraped_source: u.source ?? null,
    }).eq('person_id', u.person.person_id)
    if (error) {
      failed++
      console.error(`  ✗ ${u.person.person_id}: ${error.message}`)
    } else ok++
  }
  console.log(`Done: ${ok} written, ${failed} failed.`)
}

main().catch(err => {
  console.error('backfill-person-skills failed:', err)
  process.exit(1)
})
