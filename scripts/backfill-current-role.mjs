#!/usr/bin/env node
// scripts/backfill-current-role.mjs
//
// Re-derives current_title_raw, current_title_normalized,
// current_function_normalized, and current_company_id for every person
// from their is_current=true experiences. Prefers non-student roles
// with the latest start_date; falls back to student role if that's
// all there is.
//
// Usage:
//   node scripts/backfill-current-role.mjs
//   node scripts/backfill-current-role.mjs --dry-run
//   node scripts/backfill-current-role.mjs --verbose

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

// ─── Load title dictionary for normalization ──────────────────────────────

const { data: titleDict, error: tdErr } = await supabase
  .from('title_dictionary')
  .select('title_pattern, title_normalized, function_normalized')
if (tdErr) { console.error('Failed to load title_dictionary:', tdErr); process.exit(1) }

const titleMap = new Map()
for (const row of titleDict || []) {
  titleMap.set(row.title_pattern.toLowerCase().trim(), {
    title_normalized: row.title_normalized,
    function_normalized: row.function_normalized,
  })
}
console.log(`Loaded ${titleMap.size} title dictionary patterns`)

const SENIORITY_PREFIXES = [
  'staff ', 'principal ', 'senior ', 'lead ', 'junior ', 'associate ',
  'senior staff ', 'distinguished ',
]

const NOISE_SUFFIXES = [
  /\s*\(.*?\)\s*$/,
  /\s*-\s*(remote|contract|freelance|part[- ]time|intern|interim)$/i,
  /\s*@\s*.+$/,
  /\s*[|\/]\s*.+$/,
  /,\s*.+$/,
]

function normalizeTitle(raw) {
  if (!raw) return null
  const normalized = raw.toLowerCase().trim().replace(/\s+/g, ' ')

  // Exact match
  let match = titleMap.get(normalized)
  if (match) return match

  // Suffix strip
  let stripped = normalized
  for (const pat of NOISE_SUFFIXES) {
    stripped = stripped.replace(pat, '').trim()
  }
  if (stripped !== normalized && stripped.length > 0) {
    match = titleMap.get(stripped)
    if (match) return match
  }

  // Prefix strip
  for (const prefix of SENIORITY_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      const base = normalized.slice(prefix.length).trim()
      match = titleMap.get(base)
      if (match) return match
    }
  }

  return null
}

function isStudentTitle(t) {
  return !!t && /\bintern\b|\binternship\b|\bco-?op\b|\bstudent\b/i.test(t)
}

// ─── Process all people ───────────────────────────────────────────────────

const { data: people, error: pplErr } = await supabase
  .from('people')
  .select('person_id, full_name, current_title_raw, current_company_id')
  .order('full_name')
if (pplErr) { console.error('Failed to load people:', pplErr); process.exit(1) }
console.log(`Processing ${people.length} candidates...\n`)

let changed = 0, unchanged = 0, noCurrentRole = 0

for (const person of people) {
  const { data: currentExps } = await supabase
    .from('person_experiences')
    .select('title_raw, company_id, start_date')
    .eq('person_id', person.person_id)
    .eq('is_current', true)
    .order('start_date', { ascending: false })

  if (!currentExps || currentExps.length === 0) {
    noCurrentRole++
    if (VERBOSE) console.log(`  ${person.full_name}: no is_current experiences`)
    continue
  }

  // Prefer non-student current role with a title; fall back to any non-student; then student
  const bestCurrent = currentExps.find(e => e.title_raw && !isStudentTitle(e.title_raw))
    ?? currentExps.find(e => !isStudentTitle(e.title_raw))
    ?? currentExps.find(e => e.title_raw)
    ?? currentExps[0]

  // If the derived experience has no title_raw, keep the existing title
  // (Crust sometimes puts the title only in the top-level current_title field)
  const newTitleRaw = bestCurrent.title_raw || person.current_title_raw
  const derivedTitle = normalizeTitle(newTitleRaw)
  const newTitleNorm = derivedTitle?.title_normalized || null
  const newFunctionNorm = derivedTitle?.function_normalized || null
  const newCompanyId = bestCurrent.company_id || person.current_company_id

  // Check if anything changed
  const titleChanged = newTitleRaw !== person.current_title_raw
  const companyChanged = newCompanyId !== person.current_company_id

  if (!titleChanged && !companyChanged) {
    unchanged++
    continue
  }

  // Get company names for logging
  let oldCompany = null, newCompany = null
  if (person.current_company_id) {
    const { data: c } = await supabase.from('companies').select('company_name').eq('company_id', person.current_company_id).single()
    oldCompany = c?.company_name
  }
  if (newCompanyId) {
    const { data: c } = await supabase.from('companies').select('company_name').eq('company_id', newCompanyId).single()
    newCompany = c?.company_name
  }

  console.log(`  ${person.full_name}:`)
  console.log(`    OLD: "${person.current_title_raw}" @ ${oldCompany || '(none)'}`)
  console.log(`    NEW: "${newTitleRaw}" @ ${newCompany || '(none)'}`)

  if (!DRY_RUN) {
    const { error } = await supabase
      .from('people')
      .update({
        current_title_raw: newTitleRaw,
        current_title_normalized: newTitleNorm,
        current_function_normalized: newFunctionNorm,
        current_company_id: newCompanyId,
        updated_at: new Date().toISOString(),
      })
      .eq('person_id', person.person_id)
    if (error) console.error(`    UPDATE error:`, error.message)
  }

  changed++
}

console.log(`\n=== Summary ===`)
console.log(`Changed: ${changed}`)
console.log(`Unchanged: ${unchanged}`)
console.log(`No current role: ${noCurrentRole}`)
console.log(`Total: ${people.length}`)
if (DRY_RUN) console.log('\n*** DRY RUN — no changes written ***')
