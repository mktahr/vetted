#!/usr/bin/env node
// scripts/cleanup-duplicate-rows.mjs
//
// One-time cleanup: removes duplicate person_experiences and person_education rows.
// When duplicates exist, keeps the row with the most populated fields (longest
// description, most non-null columns) to avoid losing rich text data.
//
// Safe to re-run — idempotent (no duplicates = no deletions).
//
// Usage:
//   node scripts/cleanup-duplicate-rows.mjs
//   node scripts/cleanup-duplicate-rows.mjs --dry-run

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
if (DRY_RUN) console.log('*** DRY RUN — no deletes ***\n')

const envFile = readFileSync('.env.local', 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=')
    return [k.trim(), v.join('=').trim()]
  })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ─── Richness scorer ──────────────────────────────────────────────────────

function experienceRichness(row) {
  let score = 0
  if (row.description_raw) score += 10 + row.description_raw.length
  if (row.title_normalized) score += 5
  if (row.function_normalized) score += 3
  if (row.specialty_normalized) score += 3
  if (row.seniority_normalized && row.seniority_normalized !== 'unknown') score += 3
  if (row.title_level) score += 2
  if (row.employment_type_normalized && row.employment_type_normalized !== 'unknown') score += 2
  if (row.duration_months) score += 1
  return score
}

function educationRichness(row) {
  let score = 0
  if (row.description_raw) score += 10 + row.description_raw.length
  if (row.activities_raw) score += 10 + row.activities_raw.length
  if (row.grade_raw) score += 5 + row.grade_raw.length
  if (row.degree_normalized) score += 3
  if (row.degree_level) score += 3
  if (row.field_of_study_normalized) score += 3
  if (row.field_of_study_raw) score += 2
  if (row.school_id) score += 1
  return score
}

// ─── Deduplicate experiences ──────────────────────────────────────────────

console.log('=== Phase 1: Deduplicating person_experiences ===\n')

const { data: people, error: pplErr } = await supabase
  .from('people')
  .select('person_id, full_name')
  .order('full_name')
if (pplErr) { console.error('Failed to load people:', pplErr); process.exit(1) }

const { count: totalExpBefore } = await supabase
  .from('person_experiences')
  .select('*', { count: 'exact', head: true })
console.log(`Total person_experiences rows BEFORE: ${totalExpBefore}`)

let totalExpDeleted = 0
let peopleWithExpDupes = 0

for (const person of people) {
  const { data: exps } = await supabase
    .from('person_experiences')
    .select('person_experience_id, title_raw, start_date, end_date, company_id, description_raw, title_normalized, function_normalized, specialty_normalized, seniority_normalized, title_level, employment_type_normalized, duration_months')
    .eq('person_id', person.person_id)

  if (!exps || exps.length === 0) continue

  // Group by dedup key
  const groups = {}
  for (const exp of exps) {
    const key = `${(exp.title_raw || '').toLowerCase()}|${exp.start_date || ''}|${exp.end_date || ''}|${exp.company_id || ''}`
    if (!groups[key]) groups[key] = []
    groups[key].push(exp)
  }

  const toDelete = []
  for (const [, group] of Object.entries(groups)) {
    if (group.length <= 1) continue

    // Sort by richness descending — keep the richest row
    group.sort((a, b) => experienceRichness(b) - experienceRichness(a))
    // Delete all but the first (richest)
    for (let i = 1; i < group.length; i++) {
      toDelete.push(group[i].person_experience_id)
    }
  }

  if (toDelete.length > 0) {
    peopleWithExpDupes++
    const kept = exps.length - toDelete.length
    console.log(`  ${person.full_name}: ${exps.length} → ${kept} (deleting ${toDelete.length})`)

    if (!DRY_RUN) {
      // Delete in batches of 50 to avoid URL length limits
      for (let i = 0; i < toDelete.length; i += 50) {
        const batch = toDelete.slice(i, i + 50)
        const { error } = await supabase
          .from('person_experiences')
          .delete()
          .in('person_experience_id', batch)
        if (error) console.error(`    DELETE error:`, error.message)
      }
    }
    totalExpDeleted += toDelete.length
  }
}

const { count: totalExpAfter } = await supabase
  .from('person_experiences')
  .select('*', { count: 'exact', head: true })

console.log(`\nExperiences: deleted ${totalExpDeleted} duplicate rows across ${peopleWithExpDupes} people`)
console.log(`Total rows: ${totalExpBefore} → ${DRY_RUN ? '(dry run)' : totalExpAfter}`)

// ─── Deduplicate education ────────────────────────────────────────────────

console.log('\n=== Phase 2: Deduplicating person_education ===\n')

const { count: totalEduBefore } = await supabase
  .from('person_education')
  .select('*', { count: 'exact', head: true })
console.log(`Total person_education rows BEFORE: ${totalEduBefore}`)

let totalEduDeleted = 0
let peopleWithEduDupes = 0

for (const person of people) {
  const { data: edus } = await supabase
    .from('person_education')
    .select('person_education_id, school_name_raw, degree_raw, start_year, end_year, school_id, degree_normalized, degree_level, field_of_study_raw, field_of_study_normalized, description_raw, activities_raw, grade_raw')
    .eq('person_id', person.person_id)

  if (!edus || edus.length === 0) continue

  const groups = {}
  for (const edu of edus) {
    const key = `${(edu.school_name_raw || '').toLowerCase()}|${(edu.degree_raw || '').toLowerCase()}|${edu.start_year ?? ''}|${edu.end_year ?? ''}`
    if (!groups[key]) groups[key] = []
    groups[key].push(edu)
  }

  const toDelete = []
  for (const [, group] of Object.entries(groups)) {
    if (group.length <= 1) continue

    group.sort((a, b) => educationRichness(b) - educationRichness(a))
    for (let i = 1; i < group.length; i++) {
      toDelete.push(group[i].person_education_id)
    }
  }

  if (toDelete.length > 0) {
    peopleWithEduDupes++
    const kept = edus.length - toDelete.length
    console.log(`  ${person.full_name}: ${edus.length} → ${kept} (deleting ${toDelete.length})`)

    if (!DRY_RUN) {
      for (let i = 0; i < toDelete.length; i += 50) {
        const batch = toDelete.slice(i, i + 50)
        const { error } = await supabase
          .from('person_education')
          .delete()
          .in('person_education_id', batch)
        if (error) console.error(`    DELETE error:`, error.message)
      }
    }
    totalEduDeleted += toDelete.length
  }
}

const { count: totalEduAfter } = await supabase
  .from('person_education')
  .select('*', { count: 'exact', head: true })

console.log(`\nEducation: deleted ${totalEduDeleted} duplicate rows across ${peopleWithEduDupes} people`)
console.log(`Total rows: ${totalEduBefore} → ${DRY_RUN ? '(dry run)' : totalEduAfter}`)

// ─── Summary ──────────────────────────────────────────────────────────────

console.log('\n=== Summary ===')
console.log(`Experiences: ${totalExpBefore} → ${DRY_RUN ? '(dry run)' : totalExpAfter} (${totalExpDeleted} deleted)`)
console.log(`Education: ${totalEduBefore} → ${DRY_RUN ? '(dry run)' : totalEduAfter} (${totalEduDeleted} deleted)`)
if (DRY_RUN) console.log('\n*** DRY RUN — no changes written ***')
