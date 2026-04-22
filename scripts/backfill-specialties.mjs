#!/usr/bin/env node
// scripts/backfill-specialties.mjs
//
// Re-resolves specialty_normalized on all person_experiences using the
// new specialty_dictionary (title_patterns + keyword_signals + tech_signals).
// Person-level aggregation (primary/secondary/historical) is handled by
// computeAndWriteDerivedFields during the rescore-all step.

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

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

function stripTitle(raw) {
  const normalized = raw.toLowerCase().trim().replace(/\s+/g, ' ')
  const variants = [normalized]
  let stripped = normalized
  for (const p of NOISE_SUFFIX) stripped = stripped.replace(p, '').trim()
  if (stripped !== normalized && stripped.length > 0) variants.push(stripped)
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

// ─── Resolver ───────────────────────────────────────────────────────────────

function resolveSpecialty(titleRaw, descriptionRaw, skillsTags) {
  // Pass 1: title
  if (titleRaw) {
    for (const v of stripTitle(titleRaw)) {
      const hit = titleMap.get(v)
      if (hit) return hit
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

// ─── Fetch all experiences ──────────────────────────────────────────────────

const { data: exps, error: expErr } = await supabase
  .from('person_experiences')
  .select('person_experience_id, person_id, title_raw, description_raw, specialty_normalized')
  .order('person_id')
if (expErr) { console.error('Failed to load experiences:', expErr); process.exit(1) }
console.log(`Processing ${exps.length} experiences...`)

// We don't have per-experience skills_tags, but canonical_json.skills_tags
// lives on the snapshot. For the backfill we'll rely on title + description only.

let updated = 0, unchanged = 0, cleared = 0
for (const exp of exps) {
  const newSpec = resolveSpecialty(exp.title_raw, exp.description_raw, null)
  if (newSpec !== exp.specialty_normalized) {
    const { error } = await supabase
      .from('person_experiences')
      .update({ specialty_normalized: newSpec })
      .eq('person_experience_id', exp.person_experience_id)
    if (error) console.error(`  Failed ${exp.person_experience_id}:`, error.message)
    else {
      updated++
      if (!newSpec) cleared++
    }
  } else {
    unchanged++
  }
}

console.log(`Done. ${updated} updated (${cleared} cleared), ${unchanged} unchanged.`)
console.log('Run /api/admin/rescore-all to compute person-level specialty aggregation.')
