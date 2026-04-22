#!/usr/bin/env node
// scripts/import-company-scores.mjs
//
// Imports company scores from CSV into the Supabase database.
// For each CSV row:
//   1. Upsert company (case-insensitive name match)
//   2. Set primary_industry_tag + sub_industry_1/2/3
//   3. Delete existing company_year_scores for that company
//   4. Insert fresh year scores from the CSV (CSV wins on all conflicts)
//
// CSV format:
//   company_name, industry, sub_industry_1, sub_industry_2, sub_industry_3,
//   2026, 2025, ..., 2000  (integers 1-5, blank = no score)
//
// Usage: node scripts/import-company-scores.mjs [path-to-csv]

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

const csvPath = process.argv[2] || '/Users/matt/Downloads/company_scores (1).csv'

// ─── Parse CSV ──────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim())
  const headers = lines[0].split(',').map(h => h.trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim())
    const row = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = vals[j] || ''
    }
    rows.push(row)
  }
  return { headers, rows }
}

const csvText = readFileSync(csvPath, 'utf-8')
const { headers, rows } = parseCSV(csvText)

// Detect year columns (integers between 2000 and 2030)
const yearCols = headers.filter(h => /^\d{4}$/.test(h)).map(Number).sort((a, b) => a - b)
console.log(`CSV: ${rows.length} rows, year columns: ${yearCols[0]}–${yearCols[yearCols.length - 1]}`)

// ─── Import ─────────────────────────────────────────────────────────────────

let companiesUpserted = 0
let companiesCreated = 0
let scoresDeleted = 0
let scoresInserted = 0
let skipped = 0
const errors = []

for (const row of rows) {
  const name = row.company_name?.trim()
  if (!name) { skipped++; continue }

  const industry = row.industry?.trim() || null
  const sub1 = row.sub_industry_1?.trim() || null
  const sub2 = row.sub_industry_2?.trim() || null
  const sub3 = row.sub_industry_3?.trim() || null

  // Parse year scores
  const yearScores = []
  for (const year of yearCols) {
    const val = row[String(year)]?.trim()
    if (!val) continue
    const score = parseInt(val, 10)
    if (score >= 1 && score <= 5) {
      yearScores.push({ year, score })
    }
  }

  // Step 1: Find existing company (case-insensitive)
  const { data: existing } = await supabase
    .from('companies')
    .select('company_id')
    .ilike('company_name', name)
    .limit(1)
    .maybeSingle()

  let companyId
  if (existing) {
    companyId = existing.company_id
    // Update metadata
    const { error: updateErr } = await supabase
      .from('companies')
      .update({
        primary_industry_tag: industry,
        sub_industry_1: sub1,
        sub_industry_2: sub2,
        sub_industry_3: sub3,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)
    if (updateErr) {
      errors.push({ name, phase: 'update', error: updateErr.message })
      continue
    }
    companiesUpserted++
  } else {
    // Create new
    const { data: created, error: createErr } = await supabase
      .from('companies')
      .insert({
        company_name: name,
        primary_industry_tag: industry,
        sub_industry_1: sub1,
        sub_industry_2: sub2,
        sub_industry_3: sub3,
        company_score_mode: 'manual',
        manual_review_status: 'unreviewed',
        current_status: 'active',
      })
      .select('company_id')
      .single()
    if (createErr) {
      errors.push({ name, phase: 'create', error: createErr.message })
      continue
    }
    companyId = created.company_id
    companiesCreated++
  }

  // Step 2: Delete existing year scores (CSV wins on all conflicts)
  if (yearScores.length > 0) {
    const { data: deleted } = await supabase
      .from('company_year_scores')
      .delete()
      .eq('company_id', companyId)
      .select('company_id')
    scoresDeleted += (deleted?.length || 0)

    // Step 3: Insert fresh scores
    const scoreRows = yearScores.map(ys => ({
      company_id: companyId,
      year: ys.year,
      company_score: ys.score,
    }))
    const { error: insertErr } = await supabase
      .from('company_year_scores')
      .insert(scoreRows)
    if (insertErr) {
      errors.push({ name, phase: 'scores_insert', error: insertErr.message })
    } else {
      scoresInserted += scoreRows.length
    }
  }
}

console.log(`\nDone.`)
console.log(`  Companies: ${companiesUpserted} updated, ${companiesCreated} created, ${skipped} skipped`)
console.log(`  Scores: ${scoresDeleted} deleted, ${scoresInserted} inserted`)
if (errors.length > 0) {
  console.log(`  Errors: ${errors.length}`)
  for (const e of errors.slice(0, 10)) {
    console.log(`    ${e.name}: [${e.phase}] ${e.error}`)
  }
}
