#!/usr/bin/env node
//
// scripts/dedupe-companies-by-crustdata-id.mjs
//
// Finds rows in `companies` that share the same `crustdata_company_id` and
// merges them. Produces dry-run output by default; pass `--apply` to commit.
//
// Pre-Phase-1 created companies via name-only ingest from the Chrome extension,
// then later got duplicate Crust-imported rows once the canonical
// `crustdata_company_id` was discovered via identify. Example: "Anduril" (vetted,
// hardware, hand-curated) and "Anduril Industries" (auto-created from a
// candidate's experience). Once "Anduril Industries" gets tagged, both rows end
// up with the same `crustdata_company_id` (640... or whatever Crust assigns).
//
// Merge strategy:
//   1. Group rows by crustdata_company_id (skip NULLs).
//   2. For each group with ≥2 rows, pick the SURVIVOR:
//      - prefer `tagging_method = 'manual'` (admin curated)
//      - else prefer the one that's older (`created_at` ASC)
//      - tiebreak: lower `company_id` lexicographically
//   3. Repoint:
//      - people.current_company_id  → survivor
//      - person_experiences.company_id → survivor
//      - company_year_scores.company_id → survivor (skip if survivor already has the year)
//      - company_function_scores.company_id → survivor (similar)
//   4. Delete the duplicate row(s).
//
// USAGE:
//   node scripts/dedupe-companies-by-crustdata-id.mjs           # dry run
//   node scripts/dedupe-companies-by-crustdata-id.mjs --apply   # write changes
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const APPLY = process.argv.includes('--apply')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseKey)

console.log(`Dedupe by crustdata_company_id — ${APPLY ? 'APPLY MODE' : 'DRY RUN'}\n`)

// 1. Pull all companies with a crustdata_company_id
const { data: rows, error } = await supabase
  .from('companies')
  .select('company_id, company_name, crustdata_company_id, tagging_method, review_status, category, primary_industry, created_at')
  .not('crustdata_company_id', 'is', null)
  .order('created_at', { ascending: true })

if (error) {
  console.error('Query failed:', error.message)
  process.exit(1)
}

// 2. Group by crustdata_company_id
const groups = new Map()
for (const r of rows || []) {
  const key = r.crustdata_company_id
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(r)
}

const dups = Array.from(groups.entries()).filter(([_, arr]) => arr.length > 1)
console.log(`Found ${dups.length} crustdata_company_id values with ≥2 rows.\n`)

let totalMerged = 0
for (const [crustId, dupRows] of dups) {
  // Pick survivor
  const sorted = [...dupRows].sort((a, b) => {
    const aManual = a.tagging_method === 'manual' ? 0 : 1
    const bManual = b.tagging_method === 'manual' ? 0 : 1
    if (aManual !== bManual) return aManual - bManual
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1
    return a.company_id.localeCompare(b.company_id)
  })
  const survivor = sorted[0]
  const losers = sorted.slice(1)

  console.log(`crustdata_company_id=${crustId}`)
  console.log(`  SURVIVOR: ${survivor.company_id} | ${survivor.company_name} | method=${survivor.tagging_method} | review=${survivor.review_status} | category=${survivor.category}`)
  for (const loser of losers) {
    console.log(`  MERGE:    ${loser.company_id} | ${loser.company_name} | method=${loser.tagging_method} | review=${loser.review_status} | category=${loser.category}`)
  }

  if (APPLY) {
    for (const loser of losers) {
      // Repoint people
      const { error: peopleErr, count: peopleCount } = await supabase
        .from('people')
        .update({ current_company_id: survivor.company_id })
        .eq('current_company_id', loser.company_id)
        .select('person_id', { count: 'exact', head: true })
      if (peopleErr) { console.error(`  ERR repoint people: ${peopleErr.message}`); continue }
      console.log(`    repointed ${peopleCount ?? 0} people`)

      // Repoint experiences
      const { error: expErr, count: expCount } = await supabase
        .from('person_experiences')
        .update({ company_id: survivor.company_id })
        .eq('company_id', loser.company_id)
        .select('person_experience_id', { count: 'exact', head: true })
      if (expErr) { console.error(`  ERR repoint experiences: ${expErr.message}`); continue }
      console.log(`    repointed ${expCount ?? 0} experiences`)

      // Year scores: only repoint where survivor doesn't already own that year
      const { data: loserYears } = await supabase
        .from('company_year_scores')
        .select('year, company_score, score_notes')
        .eq('company_id', loser.company_id)
      const { data: survivorYears } = await supabase
        .from('company_year_scores')
        .select('year')
        .eq('company_id', survivor.company_id)
      const survivorYearSet = new Set((survivorYears || []).map(y => y.year))
      for (const ly of loserYears || []) {
        if (survivorYearSet.has(ly.year)) {
          // survivor wins; just delete loser's row
          await supabase.from('company_year_scores').delete().eq('company_id', loser.company_id).eq('year', ly.year)
        } else {
          await supabase.from('company_year_scores').update({ company_id: survivor.company_id }).eq('company_id', loser.company_id).eq('year', ly.year)
        }
      }
      // Function scores: same pattern
      const { data: loserFuncs } = await supabase
        .from('company_function_scores')
        .select('function_normalized, year')
        .eq('company_id', loser.company_id)
      const { data: survivorFuncs } = await supabase
        .from('company_function_scores')
        .select('function_normalized, year')
        .eq('company_id', survivor.company_id)
      const survivorFuncSet = new Set((survivorFuncs || []).map(f => `${f.function_normalized}|${f.year}`))
      for (const lf of loserFuncs || []) {
        const k = `${lf.function_normalized}|${lf.year}`
        if (survivorFuncSet.has(k)) {
          await supabase.from('company_function_scores').delete().eq('company_id', loser.company_id).eq('function_normalized', lf.function_normalized).eq('year', lf.year)
        } else {
          await supabase.from('company_function_scores').update({ company_id: survivor.company_id }).eq('company_id', loser.company_id).eq('function_normalized', lf.function_normalized).eq('year', lf.year)
        }
      }

      // Delete the loser
      const { error: delErr } = await supabase.from('companies').delete().eq('company_id', loser.company_id)
      if (delErr) { console.error(`  ERR delete loser: ${delErr.message}`); continue }
      console.log(`    deleted ${loser.company_id}`)
      totalMerged++
    }
  }
  console.log()
}

console.log(`\nSummary: ${dups.length} duplicate groups, ${totalMerged} rows merged.`)
if (!APPLY) console.log('(dry run — pass --apply to commit)')
