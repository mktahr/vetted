#!/usr/bin/env node
// scripts/backfill-degrees.mjs
//
// Re-normalizes degree_normalized + degree_level on every person_education
// row using the canonical degree_dictionary. Mirrors lib/normalize/degrees.ts
// but in plain JS (scripts can't import .ts).
//
// Run after fixing a degree-resolver bug (e.g. word-boundary matching) to
// retroactively repair existing rows. After this, run backfill-seniority.mjs
// to re-aggregate years_experience_estimate (it depends on degree_level).

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync('.env.local', 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=')
    return [k.trim(), v.join('=').trim()]
  })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ─── Word-boundary pattern matching (mirrors lib/normalize/degrees.ts) ─────

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
const PATTERN_RE_CACHE = new Map()
function matchesDictionaryPattern(text, pattern) {
  let re = PATTERN_RE_CACHE.get(pattern)
  if (!re) { re = new RegExp(`\\b${escapeRegex(pattern)}\\b`, 'i'); PATTERN_RE_CACHE.set(pattern, re) }
  return re.test(text)
}

// Mirrors lib/normalize/titles.ts normalizeForLookup — lowercase, collapse
// whitespace, strip trailing punctuation. Keep periods (they're meaningful
// for "B.A.", "Ph.D.") but strip surrounding noise.
function normalizeForLookup(s) {
  if (!s) return ''
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

// ─── Load dictionary ───────────────────────────────────────────────────────

const { data: dictRaw, error: dictErr } = await sb
  .from('degree_dictionary')
  .select('degree_pattern, degree_normalized, degree_level, is_real_degree, is_certificate, is_coursework')
if (dictErr) { console.error('Failed to load degree_dictionary:', dictErr); process.exit(1) }
const dict = (dictRaw || []).sort((a, b) => b.degree_pattern.length - a.degree_pattern.length)
console.log(`Loaded ${dict.length} degree patterns (longest first)`)

// Exact-match lookup map (case-insensitive on the normalized form)
const exactMap = new Map()
for (const row of dict) exactMap.set(row.degree_pattern.toLowerCase(), row)

function resolveDegree(rawDegree) {
  const normalized = normalizeForLookup(rawDegree)
  if (!normalized) return null
  const exact = exactMap.get(normalized)
  if (exact) return exact
  for (const row of dict) {
    if (matchesDictionaryPattern(normalized, row.degree_pattern)) return row
  }
  return null
}

// ─── Process all education rows ────────────────────────────────────────────

const { data: edus, error: edErr } = await sb
  .from('person_education')
  .select('person_education_id, degree_raw, degree_normalized, degree_level, is_coursework_only, is_certificate_only')
if (edErr) { console.error('Failed to load person_education:', edErr); process.exit(1) }
console.log(`Processing ${edus.length} person_education rows...`)

let updated = 0
let unchanged = 0
let skipped = 0
const transitions = new Map()  // "old → new" → count

for (const e of edus) {
  if (!e.degree_raw || !e.degree_raw.trim()) { skipped++; continue }
  const match = resolveDegree(e.degree_raw)
  const newNormalized = match?.degree_normalized ?? null
  const newLevel = match?.degree_level ?? null
  const newCoursework = match?.is_coursework ?? false
  const newCertificate = match?.is_certificate ?? false
  const changed =
    newNormalized !== e.degree_normalized ||
    newLevel !== e.degree_level ||
    newCoursework !== e.is_coursework_only ||
    newCertificate !== e.is_certificate_only
  if (!changed) { unchanged++; continue }

  const key = `${e.degree_level || 'null'} → ${newLevel || 'null'}`
  transitions.set(key, (transitions.get(key) || 0) + 1)

  const { error: upErr } = await sb
    .from('person_education')
    .update({
      degree_normalized: newNormalized,
      degree_level: newLevel,
      is_coursework_only: newCoursework,
      is_certificate_only: newCertificate,
    })
    .eq('person_education_id', e.person_education_id)
  if (upErr) console.error(`  fail ${e.person_education_id}:`, upErr.message)
  else updated++
}

console.log(`\n=== Summary ===`)
console.log(`Total rows: ${edus.length}`)
console.log(`Updated:    ${updated}`)
console.log(`Unchanged:  ${unchanged}`)
console.log(`Skipped (no degree_raw): ${skipped}`)
console.log(`\nLevel transitions (old → new):`)
const sortedTrans = [...transitions.entries()].sort((a, b) => b[1] - a[1])
for (const [k, v] of sortedTrans) console.log(`  ${String(v).padStart(4)} ${k}`)
console.log(`\nNext: run backfill-seniority.mjs to re-aggregate years_experience_estimate.`)
