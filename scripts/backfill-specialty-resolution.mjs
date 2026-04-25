#!/usr/bin/env node
// scripts/backfill-specialty-resolution.mjs
//
// Re-resolves specialty_normalized on ALL person_experiences using the
// 3-pass specialty resolver (title_patterns → keyword_signals → technology_signals).
// Then re-aggregates person-level specialties (primary / secondary / historical).
//
// Prerequisites:
//   - Migration 020 (columns) and 021 (seeds) applied
//   - .env.local with SUPABASE_SERVICE_ROLE_KEY
//
// Usage:
//   node scripts/backfill-specialty-resolution.mjs
//
// Flags:
//   --dry-run    Show what would change without writing
//   --verbose    Print each experience change

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')

if (DRY_RUN) console.log('*** DRY RUN — no writes ***\n')

const envFile = readFileSync('.env.local', 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=')
    return [k.trim(), v.join('=').trim()]
  })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ─── Load specialty_dictionary ──────────────────────────────────────────────

const { data: dictRaw, error: dictErr } = await supabase
  .from('specialty_dictionary')
  .select('specialty_normalized, function_normalized, title_patterns, keyword_signals, technology_signals')
  .eq('active', true)
if (dictErr) { console.error('Failed to load dictionary:', dictErr); process.exit(1) }
const dict = dictRaw || []
console.log(`Loaded ${dict.length} specialty entries`)

// Build title→specialty map
const titleMap = new Map()
for (const entry of dict) {
  if (!entry.title_patterns) continue
  for (const pattern of entry.title_patterns) {
    const key = pattern.toLowerCase().trim()
    if (!titleMap.has(key)) titleMap.set(key, entry.specialty_normalized)
  }
}
console.log(`Title map: ${titleMap.size} patterns`)

// ─── Noise stripping ───────────────────────────────────────────────────────

const NOISE_SUFFIX = [
  /\s*\(.*?\)\s*$/,
  /\s*-\s*(remote|contract|freelance|part[- ]time|intern|interim)$/i,
  /\s*[–—]\s*.+$/,
  /\s*@\s*.+$/,
  /\s*[|\/]\s*.+$/,
  /,\s*.+$/,
]
const SENIORITY_PREFIXES = [
  'senior staff ', 'distinguished ', 'staff ', 'principal ',
  'senior ', 'lead ', 'junior ', 'associate ',
]
const SEPARATOR_PATTERNS = [/\s*[|\/]\s*/, /\s*[–—]\s*/, /,\s*/]

function stripTitle(raw) {
  const normalized = raw.toLowerCase().trim().replace(/\s+/g, ' ')
  const variants = [normalized]
  for (const sep of SEPARATOR_PATTERNS) {
    if (sep.test(normalized)) {
      const parts = normalized.split(sep).map(p => p.trim()).filter(p => p.length > 0)
      for (const part of parts) {
        if (part !== normalized && !variants.includes(part)) variants.push(part)
      }
    }
  }
  let stripped = normalized
  for (const p of NOISE_SUFFIX) stripped = stripped.replace(p, '').trim()
  if (stripped !== normalized && stripped.length > 0 && !variants.includes(stripped)) variants.push(stripped)
  const bases = [...variants]
  for (const prefix of SENIORITY_PREFIXES) {
    for (const v of bases) {
      if (v.startsWith(prefix)) {
        const base = v.slice(prefix.length).trim()
        if (base.length > 0 && !variants.includes(base)) variants.push(base)
      }
    }
  }
  return variants
}

// ─── 3-pass resolver ───────────────────────────────────────────────────────

function resolveSpecialty(titleRaw, descriptionRaw, skillsTags) {
  // Pass 1: title match
  if (titleRaw) {
    const variants = stripTitle(titleRaw)
    for (const v of variants) {
      const hit = titleMap.get(v)
      if (hit) return hit
    }
    // Pass 1b: separator fragments against keyword_signals
    for (const v of variants) {
      for (const entry of dict) {
        if (!entry.keyword_signals?.length) continue
        for (const kw of entry.keyword_signals) {
          if (v === kw.toLowerCase()) return entry.specialty_normalized
        }
      }
    }
  }
  // Pass 2: keywords in description (need ≥2 matches)
  if (descriptionRaw) {
    const dl = descriptionRaw.toLowerCase()
    let best = null, bestCount = 0
    for (const entry of dict) {
      if (!entry.keyword_signals?.length) continue
      let count = 0
      for (const kw of entry.keyword_signals) if (dl.includes(kw.toLowerCase())) count++
      if (count >= 2 && count > bestCount) { best = entry.specialty_normalized; bestCount = count }
    }
    if (best) return best
  }
  // Pass 3: tech signals in skills (need ≥2 matches)
  if (skillsTags && skillsTags.length > 0) {
    const sl = new Set(skillsTags.map(s => s.toLowerCase().trim()))
    let best = null, bestCount = 0
    for (const entry of dict) {
      if (!entry.technology_signals?.length) continue
      let count = 0
      for (const t of entry.technology_signals) if (sl.has(t.toLowerCase())) count++
      if (count >= 2 && count > bestCount) { best = entry.specialty_normalized; bestCount = count }
    }
    if (best) return best
  }
  return null
}

// ─── Person-level aggregation ──────────────────────────────────────────────

const SAME_TRACK = {
  backend: 'engineering', frontend: 'engineering', fullstack: 'engineering',
  mobile_ios: 'engineering', mobile_android: 'engineering',
  ml_engineering: 'engineering', ai_research: 'engineering',
  data_engineering: 'engineering', infrastructure: 'engineering',
  security: 'engineering', embedded: 'engineering',
  // Add more tracks as needed — these match lib/normalize/specialty.ts
}

function aggregateSpecialties(experiences) {
  const eligible = experiences.filter(e =>
    e.specialty_normalized &&
    e.employment_type_normalized !== 'internship' &&
    !/\bintern\b|\binternship\b|\bco-?op\b/i.test(e.title_raw || '')
  )
  const result = {
    primary_specialty: null,
    secondary_specialty: null,
    historical_specialty: null,
    specialty_transition_flag: false,
  }
  if (eligible.length === 0) return result

  result.primary_specialty = eligible[0].specialty_normalized
  const weightedCounts = {}
  for (let i = 0; i < eligible.length; i++) {
    const spec = eligible[i].specialty_normalized
    const weight = i === 0 ? 3 : i === 1 ? 2 : 1
    weightedCounts[spec] = (weightedCounts[spec] || 0) + weight
  }
  const sorted = Object.entries(weightedCounts).sort(([, a], [, b]) => b - a)
  if (sorted.length >= 2 && sorted[1][0] !== result.primary_specialty) {
    result.secondary_specialty = sorted[1][0]
  }
  const olderCounts = {}
  for (let i = 1; i < eligible.length; i++) {
    const spec = eligible[i].specialty_normalized
    olderCounts[spec] = (olderCounts[spec] || 0) + 1
  }
  const olderSorted = Object.entries(olderCounts).sort(([, a], [, b]) => b - a)
  if (olderSorted.length > 0) {
    const hist = olderSorted[0][0]
    if (hist !== result.primary_specialty) result.historical_specialty = hist
  }
  if (result.primary_specialty && result.historical_specialty) {
    const pTrack = SAME_TRACK[result.primary_specialty] ?? result.primary_specialty
    const hTrack = SAME_TRACK[result.historical_specialty] ?? result.historical_specialty
    result.specialty_transition_flag = pTrack !== hTrack
  }
  return result
}

// ─── Phase 1: Re-resolve all experiences ───────────────────────────────────

console.log('\n=== Phase 1: Re-resolving experience specialties ===\n')

const { data: exps, error: expErr } = await supabase
  .from('person_experiences')
  .select('person_experience_id, person_id, title_raw, description_raw, specialty_normalized, employment_type_normalized, start_date, is_current')
  .order('person_id')
  .order('start_date', { ascending: false })
if (expErr) { console.error('Failed to load experiences:', expErr); process.exit(1) }
console.log(`Processing ${exps.length} experiences...`)

let updated = 0, unchanged = 0
for (const exp of exps) {
  // No per-experience skills_tags yet — rely on title + description
  const newSpec = resolveSpecialty(exp.title_raw, exp.description_raw, null)
  if (newSpec !== exp.specialty_normalized) {
    if (VERBOSE) console.log(`  ${exp.person_experience_id}: "${exp.title_raw}" → ${exp.specialty_normalized || 'null'} → ${newSpec || 'null'}`)
    if (!DRY_RUN) {
      const { error } = await supabase
        .from('person_experiences')
        .update({ specialty_normalized: newSpec })
        .eq('person_experience_id', exp.person_experience_id)
      if (error) console.error(`  FAIL ${exp.person_experience_id}:`, error.message)
    }
    updated++
  } else {
    unchanged++
  }
}
console.log(`\nExperiences: ${updated} updated, ${unchanged} unchanged (total ${exps.length})`)

// ─── Phase 2: Re-aggregate person-level specialties ────────────────────────

console.log('\n=== Phase 2: Re-aggregating person specialties ===\n')

// Re-read experiences with updated specialties
const { data: freshExps, error: freshErr } = await supabase
  .from('person_experiences')
  .select('person_experience_id, person_id, title_raw, specialty_normalized, employment_type_normalized, start_date, is_current')
  .order('person_id')
  .order('start_date', { ascending: false })
if (freshErr) { console.error('Failed to re-read experiences:', freshErr); process.exit(1) }

// Group by person
const byPerson = {}
for (const e of freshExps) {
  if (!byPerson[e.person_id]) byPerson[e.person_id] = []
  byPerson[e.person_id].push(e)
}

const { data: people, error: pplErr } = await supabase
  .from('people')
  .select('person_id, primary_specialty, secondary_specialty, historical_specialty, specialty_transition_flag')
if (pplErr) { console.error('Failed to load people:', pplErr); process.exit(1) }

let personUpdated = 0, personUnchanged = 0
for (const person of people) {
  const personExps = byPerson[person.person_id] || []
  const agg = aggregateSpecialties(personExps)

  const changed =
    agg.primary_specialty !== person.primary_specialty ||
    agg.secondary_specialty !== person.secondary_specialty ||
    agg.historical_specialty !== person.historical_specialty ||
    agg.specialty_transition_flag !== person.specialty_transition_flag

  if (changed) {
    if (VERBOSE) console.log(`  ${person.person_id}: primary ${person.primary_specialty || 'null'} → ${agg.primary_specialty || 'null'}`)
    if (!DRY_RUN) {
      const { error } = await supabase
        .from('people')
        .update({
          primary_specialty: agg.primary_specialty,
          secondary_specialty: agg.secondary_specialty,
          historical_specialty: agg.historical_specialty,
          specialty_transition_flag: agg.specialty_transition_flag,
        })
        .eq('person_id', person.person_id)
      if (error) console.error(`  FAIL person ${person.person_id}:`, error.message)
    }
    personUpdated++
  } else {
    personUnchanged++
  }
}

console.log(`\nPeople: ${personUpdated} updated, ${personUnchanged} unchanged (total ${people.length})`)
console.log(`\n=== Summary ===`)
console.log(`Re-resolved ${updated} of ${exps.length} experiences, updated ${updated}.`)
console.log(`Refreshed specialty aggregation for ${personUpdated} of ${people.length} people.`)
if (DRY_RUN) console.log('\n*** DRY RUN — no changes were written ***')
