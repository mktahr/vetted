// scripts/backfill-seniority.mjs
//
// Re-evaluates seniority for every person_experience using the new
// seniority_rules engine. Also re-computes:
//   - highest_seniority_reached on each person
//   - years_experience_estimate (post-graduation, non-internship span)
//   - career_stage_assigned (derived from years_experience_estimate)
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

function isInternshipTitle(t) {
  if (!t) return false
  return /\bintern\b|\binternship\b|\bco-?op\b/i.test(t)
}

// career_stage thresholds — canonical scoring-engine boundaries (0.5/2/5).
function inferCareerStage(years) {
  if (years === null || years === undefined) return null
  if (years < 0.5) return 'pre_career'
  if (years < 2) return 'early_career'
  if (years < 5) return 'mid_career'
  return 'senior_career'
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
    .select('end_year, degree_raw, degree_normalized, degree_level')
    .eq('person_id', person.person_id)

  // Graduation date = earliest POST-SECONDARY end_year. Skip high school,
  // certificates, and coursework so we don't anchor graduation at ~18 and
  // count undergrad-era student jobs as real experience.
  // Matches lib/normalize/seniority.ts graduationDateFromEducation().
  const isHighSchoolOrLower = (e) => {
    const lvl = (e.degree_level || '').toLowerCase()
    if (lvl === 'high_school' || lvl === 'certificate' || lvl === 'coursework') return true
    const name = ((e.degree_raw || e.degree_normalized) || '').toLowerCase()
    return /high school|secondary school|\bged\b/.test(name)
  }

  let earliest = null
  for (const e of edus || []) {
    if (!e.end_year) continue
    if (isHighSchoolOrLower(e)) continue
    if (earliest === null || e.end_year < earliest) earliest = e.end_year
  }
  // Fallback: no post-secondary — use earliest overall
  if (earliest === null) {
    for (const e of edus || []) {
      if (!e.end_year) continue
      if (earliest === null || e.end_year < earliest) earliest = e.end_year
    }
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

  // Re-compute highest_seniority_reached + years_experience_estimate + career_stage
  // from the refreshed experience data (now includes the seniority updates above).
  const { data: refreshed } = await supabase
    .from('person_experiences')
    .select('seniority_normalized, title_raw, start_date, employment_type_normalized')
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

  // Years of experience: span from earliest post-graduation, non-student,
  // non-internship role start to now. Matches lib/ingest/mappers/crust.ts
  // computeYearsSpan() — we skip:
  //   - student-level roles (by our updated seniority_normalized)
  //   - internship titles
  //   - roles that started before gradDate
  let earliestPostGrad = null
  for (const e of refreshed || []) {
    if (!e.start_date) continue
    if (e.seniority_normalized === 'student') continue
    if (isInternshipTitle(e.title_raw)) continue
    const start = new Date(e.start_date)
    if (isNaN(start.getTime())) continue
    if (gradDate && start < gradDate) continue
    if (earliestPostGrad === null || start < earliestPostGrad) earliestPostGrad = start
  }

  const yearsExp = earliestPostGrad
    ? Math.max(0, Math.round(((Date.now() - earliestPostGrad.getTime()) / (1000 * 60 * 60 * 24 * 365.25)) * 10) / 10)
    : null
  const careerStage = inferCareerStage(yearsExp)

  const { error: updErr } = await supabase
    .from('people')
    .update({
      highest_seniority_reached: highest,
      years_experience_estimate: yearsExp,
      career_stage_assigned: careerStage,
    })
    .eq('person_id', person.person_id)
  if (updErr) {
    errors++
    console.error(`  ✗ ${person.full_name}: update person:`, updErr.message)
  } else {
    peopleUpdated++
  }

  const changeCount = changedTitles.length
  console.log(`  ${person.full_name.padEnd(30)} | highest=${(highest || '—').padEnd(22)} | yrs=${String(yearsExp ?? '—').padStart(4)} | stage=${(careerStage || '—').padEnd(14)} | ${changeCount} seniority change${changeCount !== 1 ? 's' : ''}`)
  for (const t of changedTitles) console.log(`      · ${t}`)
}

console.log(`\n=== Done ===`)
console.log(`Experiences scanned: ${expUpdated}`)
console.log(`Experiences changed: ${expChanged}`)
console.log(`People updated:      ${peopleUpdated}`)
if (errors > 0) console.log(`Errors:              ${errors}`)
