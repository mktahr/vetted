// scripts/backfill-seniority.mjs
//
// Re-evaluates seniority for every person_experience using the new
// seniority_rules engine. Also re-computes highest_seniority_reached
// on each person row.
//
// Safe to re-run. Idempotent.

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

// ─── Load seniority_rules + seniority_dictionary ────────────────────────

const { data: rulesRaw } = await supabase
  .from('seniority_rules')
  .select('rule_id, pattern, match_type, seniority_normalized, priority')
  .order('priority', { ascending: true })
  .order('rule_id', { ascending: true })
const rules = rulesRaw || []
if (rules.length === 0) {
  console.error('seniority_rules is empty — run seed-seniority-rules.mjs first')
  process.exit(1)
}

const { data: seniorityDict } = await supabase
  .from('seniority_dictionary')
  .select('seniority_normalized, rank_order')
const seniorityRank = Object.fromEntries((seniorityDict || []).map(s => [s.seniority_normalized, s.rank_order]))

// ─── Matcher (mirrors lib/normalize/seniority.ts) ─────────────────────

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

function matchesRule(rawTitle, rule) {
  const title = (rawTitle || '').toLowerCase().trim()
  const pattern = rule.pattern.toLowerCase()
  switch (rule.match_type) {
    case 'exact':        return title === pattern
    case 'starts_with':  return title.startsWith(pattern)
    case 'ends_with':    return title.endsWith(pattern)
    case 'contains':     return title.includes(pattern)
    case 'contains_word': {
      const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(pattern)}($|[^a-z0-9])`, 'i')
      return re.test(title)
    }
    case 'regex': {
      try { return new RegExp(rule.pattern, 'i').test(title) } catch { return false }
    }
    default: return false
  }
}

function resolveSeniority(ctx) {
  const emp = (ctx.employment_type || '').toLowerCase().trim()
  if (emp === 'internship' || /intern|co-?op/.test(emp)) return 'student'
  if (ctx.role_start_date && ctx.graduation_date) {
    const start = new Date(ctx.role_start_date)
    if (!isNaN(start.getTime()) && start < ctx.graduation_date) return 'student'
  }
  const title = (ctx.title || '').trim()
  if (!title) return 'unknown'
  for (const rule of rules) {
    if (matchesRule(title, rule)) return rule.seniority_normalized
  }
  return 'individual_contributor'
}

// ─── Fetch all people and their experiences + education ──────────────

const { data: people } = await supabase.from('people').select('person_id, full_name')
console.log(`\nBackfilling seniority for ${(people || []).length} people...\n`)

let expUpdated = 0
let expChanged = 0
let peopleUpdated = 0
let errors = 0

for (const person of people || []) {
  const { data: exps } = await supabase
    .from('person_experiences')
    .select('person_experience_id, title_raw, employment_type_normalized, start_date, seniority_normalized')
    .eq('person_id', person.person_id)

  const { data: edus } = await supabase
    .from('person_education')
    .select('end_year')
    .eq('person_id', person.person_id)

  // Determine graduation date: EARLIEST end_year (see lib/normalize/seniority.ts
  // for rationale — avoids flagging founder roles as "student" when the person
  // later picked up an MBA).
  let earliest = null
  for (const e of edus || []) {
    if (!e.end_year) continue
    if (earliest === null || e.end_year < earliest) earliest = e.end_year
  }
  const gradDate = earliest !== null ? new Date(earliest, 11, 31) : null

  // Update each experience
  const changedTitles = []
  for (const exp of exps || []) {
    const newSeniority = resolveSeniority({
      title: exp.title_raw,
      employment_type: exp.employment_type_normalized,
      role_start_date: exp.start_date,
      graduation_date: gradDate,
    })
    if (newSeniority !== exp.seniority_normalized) {
      const { error } = await supabase
        .from('person_experiences')
        .update({ seniority_normalized: newSeniority })
        .eq('person_experience_id', exp.person_experience_id)
      if (error) {
        errors++
        console.error(`  ✗ ${person.full_name} / ${exp.title_raw}:`, error.message)
      } else {
        expChanged++
        changedTitles.push(`${exp.title_raw}: ${exp.seniority_normalized} → ${newSeniority}`)
      }
    }
    expUpdated++
  }

  // Re-compute highest_seniority_reached from (possibly updated) experiences
  const { data: refreshed } = await supabase
    .from('person_experiences')
    .select('seniority_normalized')
    .eq('person_id', person.person_id)

  let maxRank = 0
  let highest = null
  for (const e of refreshed || []) {
    const rank = seniorityRank[e.seniority_normalized]
    if (rank && rank > maxRank) {
      maxRank = rank
      highest = e.seniority_normalized
    }
  }

  const { error: updErr } = await supabase
    .from('people')
    .update({ highest_seniority_reached: highest })
    .eq('person_id', person.person_id)
  if (updErr) {
    errors++
    console.error(`  ✗ ${person.full_name}: update highest_seniority:`, updErr.message)
  } else {
    peopleUpdated++
  }

  const changeCount = changedTitles.length
  console.log(`  ${person.full_name.padEnd(30)} | highest=${(highest || '—').padEnd(22)} | ${changeCount} change${changeCount !== 1 ? 's' : ''}`)
  for (const t of changedTitles) console.log(`      · ${t}`)
}

console.log(`\n=== Done ===`)
console.log(`Experiences scanned: ${expUpdated}`)
console.log(`Experiences changed: ${expChanged}`)
console.log(`People updated:      ${peopleUpdated}`)
if (errors > 0) console.log(`Errors:              ${errors}`)
