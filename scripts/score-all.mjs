// scripts/score-all.mjs
// One-shot backfill: compute derived fields + score + write bucket
// assignment for every person in the DB. Safe to re-run (it appends a
// new candidate_bucket_assignments row each time — the UI reads the
// latest per effective_at).
//
// Usage:
//   node scripts/score-all.mjs                    # score everyone
//   node scripts/score-all.mjs --unscored-only    # only people with no prior bucket

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
const unscoredOnly = process.argv.includes('--unscored-only')

// ─── Mirror of lib/scoring logic (JS version) ───────────────────────────────

// Pre-fetch reference tables once
const [
  { data: yearScoresAll },
  { data: companies },
  { data: seniorityDict },
  { data: metrics },
  { data: schools },
  { data: aliases },
] = await Promise.all([
  supabase.from('company_year_scores').select('company_id, year, company_score'),
  supabase.from('companies').select('company_id, company_name, founding_year'),
  supabase.from('seniority_dictionary').select('seniority_normalized, rank_order'),
  supabase.from('company_metrics_by_year').select('company_id, year, headcount_estimate'),
  supabase.from('schools').select('school_id, school_name, school_score').not('school_score', 'is', null),
  supabase.from('school_aliases').select('alias_name, school_id'),
])

const companyById = Object.fromEntries((companies || []).map(c => [c.company_id, c]))
const seniorityRank = Object.fromEntries((seniorityDict || []).map(s => [s.seniority_normalized, s.rank_order]))

const hypergrowthYears = {}
for (const m of metrics || []) {
  if (!m.headcount_estimate) continue
  const prior = metrics.find(p => p.company_id === m.company_id && p.year === m.year - 1)
  if (prior?.headcount_estimate && m.headcount_estimate >= 2 * prior.headcount_estimate) {
    if (!hypergrowthYears[m.company_id]) hypergrowthYears[m.company_id] = new Set()
    hypergrowthYears[m.company_id].add(m.year)
  }
}

const schoolById = new Map((schools || []).map(s => [s.school_id, s]))
const schoolByNorm = new Map()
const normalizeSchool = (raw) => raw.trim().replace(/[.,]+$/, '').replace(/\s+/g, ' ').toLowerCase()
for (const s of schools || []) schoolByNorm.set(normalizeSchool(s.school_name), s.school_score)
for (const a of aliases || []) {
  const s = schoolById.get(a.school_id)
  if (s) schoolByNorm.set(normalizeSchool(a.alias_name), s.school_score)
}

// Scoring weights (mirrors lib/scoring/score-candidate.ts)
const STAGE_WEIGHTS = {
  pre_career: {
    core:  { education: 30, degree_relevance: 30, internships: 40 },
    bonus: { hackathons: 10, clubs: 10, labs: 10, publications: 10, open_source: 10, fellowships: 25 },
  },
  early_career: {
    core:  { company_quality_recent: 40, education: 25, degree_relevance: 25, internships: 10 },
    bonus: { company_function_quality: 10, hackathons: 10, publications: 10, open_source: 10, labs: 5, fellowships: 25, biz_unit: 25 },
  },
  mid_career: {
    core:  { company_quality_recent: 60, company_quality_average: 10, education: 15, degree_relevance: 15 },
    bonus: { career_slope: 15, fellowships: 10, company_function_quality: 10, publications: 10, open_source: 5, biz_unit: 25 },
    penalty: { name: 'short_tenure', maxPoints: 20, thresholdMonths: 12 },
  },
  senior_career: {
    core:  { company_quality_recent: 60, company_quality_average: 30, education: 5, degree_relevance: 5 },
    bonus: { career_slope: 10, company_function_quality: 10, publications: 10, open_source: 5, biz_unit: 25 },
    penalty: { name: 'short_tenure', maxPoints: 30, thresholdMonths: 18 },
  },
}
const RECRUITING_OVERRIDE = {
  core:  { company_quality_recent: 70, education: 5, degree_relevance: 5 },
  bonus: { career_slope: 20 },
}

function determineStage(years) {
  if (years === null || years === undefined || years < 0.5) return 'pre_career'
  if (years < 2) return 'early_career'
  if (years < 5) return 'mid_career'
  return 'senior_career'
}
function assignBucket(stage, total) {
  if (stage === 'pre_career') {
    if (total >= 60) return 'vetted_talent'
    if (total >= 45) return 'high_potential'
    return 'non_vetted'
  }
  if (stage === 'early_career') {
    if (total >= 65) return 'vetted_talent'
    if (total >= 50) return 'high_potential'
    return 'non_vetted'
  }
  if (stage === 'mid_career') {
    if (total >= 65) return 'vetted_talent'
    if (total >= 50) return 'silver_medalist'
    return 'non_vetted'
  }
  if (total >= 70) return 'vetted_talent'
  if (total >= 55) return 'silver_medalist'
  return 'non_vetted'
}
function isInternshipTitle(t) { return t && /\bintern\b|\binternship\b|\bco-?op\b/i.test(t) }
function expCompanyScore(exp) {
  if (!exp.company_id || !exp.start_date) return null
  const startYear = new Date(exp.start_date).getFullYear()
  if (isNaN(startYear)) return null
  const endYear = exp.is_current
    ? new Date().getFullYear()
    : (exp.end_date ? new Date(exp.end_date).getFullYear() : new Date().getFullYear())
  const matches = yearScoresAll.filter(ys =>
    ys.company_id === exp.company_id && ys.year >= startYear && ys.year <= endYear)
  if (matches.length === 0) return null
  return matches.reduce((s, ys) => s + ys.company_score, 0) / matches.length
}
function degreeRelevance(fn, combined) {
  fn = (fn || 'engineering').toLowerCase()
  const s = combined.toLowerCase()
  const hasMBA = /\bmba\b|master of business administration/.test(s)
  const hasCS = /computer science|\bcs\b|eecs|computer engineering|software engineering/.test(s)
  const hasEE = /electrical engineering|computer engineering|eecs|electrical & computer/.test(s)
  const hasME = /mechanical engineering/.test(s)
  const hasRobotics = /robotics/.test(s)
  const hasAero = /aerospace/.test(s)
  const hasMaterials = /materials science/.test(s)
  const hasPhysics = /physics/.test(s)
  const hasMath = /(applied )?mathematics?|\bmath\b/.test(s)
  const hasStats = /statistics/.test(s)
  const hasInfoSys = /information systems/.test(s)
  const hasCogSci = /cognitive science/.test(s)
  const hasPsych = /psychology/.test(s)
  const hasEcon = /economics/.test(s)
  const hasBusiness = /business|management/.test(s)
  const hasFinance = /finance/.test(s)
  const hasMarketing = /marketing/.test(s)
  const hasComm = /communications?/.test(s)
  const hasOpsResearch = /operations research/.test(s)
  const hasIndustrialEng = /industrial engineering/.test(s)
  const hasSystemsEng = /systems engineering/.test(s)
  const hasHCI = /hci|human.computer interaction/.test(s)
  const hasDesign = /product design|industrial design|interaction design|graphic design|ux design|fine arts|architecture/.test(s)
  const hasEngineering = /engineering/.test(s)
  const hasSTEM = hasCS || hasEngineering || hasPhysics || hasMath || hasStats ||
    /chemistry|biology|biochem|neuroscience|biomedical|genetics/.test(s)

  if (fn === 'engineering' || fn === 'software engineering') {
    if (hasCS) return 1.0
    if (/electrical engineering/.test(s) || hasMath || hasStats || hasPhysics) return 0.75
    if (hasME || hasInfoSys || hasCogSci) return 0.5
    if (hasSTEM) return 0.25
    return 0
  }
  if (fn === 'hardware' || fn === 'electrical engineering') {
    if (hasEE) return 1.0
    if (hasME || hasPhysics || hasMaterials || hasAero) return 0.75
    if (hasCS || /applied mathematics/.test(s)) return 0.5
    if (hasSTEM) return 0.25
    return 0
  }
  if (fn === 'mechanical' || fn === 'robotics') {
    if (hasME || hasRobotics || hasAero || hasSystemsEng) return 1.0
    if (/electrical engineering/.test(s) || hasPhysics || hasMaterials) return 0.75
    if (hasCS || /applied mathematics/.test(s)) return 0.5
    if (hasSTEM) return 0.25
    return 0
  }
  if (fn === 'product') {
    if (hasMBA) return 1.0
    if (hasCS || hasEngineering || hasEcon || hasHCI) return 1.0
    if (hasBusiness || hasMath || hasCogSci || hasPsych) return 0.75
    if (hasSTEM) return 0.5
    return 0.1
  }
  if (fn === 'design') {
    if (hasDesign || hasHCI) return 1.0
    if (hasCogSci || hasPsych || hasCS || hasEngineering) return 0.75
    return 0.25
  }
  if (fn === 'operations') {
    if (hasBusiness || hasEcon || hasMBA || hasOpsResearch || hasIndustrialEng ||
        hasFinance || hasMath || hasStats || hasCS) return 1.0
    if (hasSTEM) return 0.5
    return 0.25
  }
  if (fn === 'sales' || fn === 'marketing') {
    if (hasBusiness || hasEcon || hasMarketing || hasComm || hasCS || hasEngineering) return 1.0
    return 0.25
  }
  if (fn === 'recruiting') return 1.0
  if (hasCS) return 1.0
  if (/electrical engineering/.test(s) || hasMath || hasStats || hasPhysics) return 0.75
  if (hasSTEM) return 0.25
  return 0
}

// ─── Compute derived + score for one person ─────────────────────────────────

async function processOne(person) {
  const { data: expRaw } = await supabase
    .from('person_experiences')
    .select('company_id, title_raw, seniority_normalized, employment_type_normalized, start_date, end_date, is_current, duration_months')
    .eq('person_id', person.person_id)
    .order('start_date', { ascending: true, nullsFirst: false })
  const experiences = expRaw || []

  const fullTimeExps = experiences.filter(e =>
    e.employment_type_normalized === 'full_time' ||
    (e.employment_type_normalized !== 'internship' && !isInternshipTitle(e.title_raw))
  )

  // career_progression — trajectory of last 2-3 scored FT roles
  const scoredFT = fullTimeExps.map(e => ({ e, score: expCompanyScore(e) })).filter(x => x.score !== null)
  let careerProgression = 'insufficient_data'
  if (scoredFT.length >= 2) {
    const newest = scoredFT[scoredFT.length - 1].score
    const baseline = scoredFT.length >= 3
      ? (scoredFT[scoredFT.length - 2].score + scoredFT[scoredFT.length - 3].score) / 2
      : scoredFT[scoredFT.length - 2].score
    const diff = newest - baseline
    careerProgression = diff > 0.3 ? 'rising' : diff < -0.3 ? 'declining' : 'flat'
  }

  // highest_seniority_reached
  let maxRank = 0, highestSeniority = null
  for (const e of experiences) {
    const rank = seniorityRank[e.seniority_normalized]
    if (rank && rank > maxRank) { maxRank = rank; highestSeniority = e.seniority_normalized }
  }

  // early_stage
  const earlyStage = new Set()
  for (const e of experiences) {
    const c = companyById[e.company_id]
    if (!c?.founding_year || !e.start_date) continue
    const sy = new Date(e.start_date).getFullYear()
    if (!isNaN(sy) && sy - c.founding_year <= 4) earlyStage.add(e.company_id)
  }

  // hypergrowth
  const hyper = new Set()
  for (const e of experiences) {
    if (!e.company_id || !e.start_date) continue
    const years = hypergrowthYears[e.company_id]
    if (!years) continue
    const sy = new Date(e.start_date).getFullYear()
    if (isNaN(sy)) continue
    const ey = e.is_current ? new Date().getFullYear() : (e.end_date ? new Date(e.end_date).getFullYear() : sy)
    for (let y = sy; y <= ey; y++) { if (years.has(y)) { hyper.add(e.company_id); break } }
  }

  const derived = {
    career_progression: careerProgression,
    highest_seniority_reached: highestSeniority,
    has_early_stage_experience: earlyStage.size > 0,
    early_stage_companies_count: earlyStage.size,
    has_hypergrowth_experience: hyper.size > 0,
    hypergrowth_companies_count: hyper.size,
  }
  await supabase.from('people').update(derived).eq('person_id', person.person_id)

  // ── Now score ─────────────────────────────────────────────────
  const { data: refreshedPerson } = await supabase
    .from('people')
    .select('full_name, years_experience_estimate, current_function_normalized, career_progression')
    .eq('person_id', person.person_id)
    .single()

  const years = refreshedPerson.years_experience_estimate
  const stage = determineStage(years)
  const fn = refreshedPerson.current_function_normalized
  const applyRecruiting = fn === 'recruiting'
  const weights = applyRecruiting ? RECRUITING_OVERRIDE : STAGE_WEIGHTS[stage]

  const { data: education } = await supabase
    .from('person_education')
    .select('school_name_raw, degree_raw, field_of_study_raw')
    .eq('person_id', person.person_id)

  const components = []
  const push = (name, cat, w, raw, pts) => components.push({ name, cat, w, raw, pts })

  if ('company_quality_recent' in weights.core) {
    const ft = experiences.filter(e => !isInternshipTitle(e.title_raw))
    const mostRecent = [...ft].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))[0]
    let recent = 0
    if (mostRecent) {
      const s = expCompanyScore(mostRecent)
      recent = s !== null ? s : 0
    }
    push('company_quality_recent', 'core', weights.core.company_quality_recent,
      recent / 5, (recent / 5) * weights.core.company_quality_recent)
  }
  if ('company_quality_average' in weights.core) {
    const ft = experiences.filter(e => !isInternshipTitle(e.title_raw))
    const scored = ft.map(e => expCompanyScore(e))
    const avg = scored.length > 0 ? scored.reduce((s, v) => s + (v ?? 0), 0) / scored.length : 0
    push('company_quality_average', 'core', weights.core.company_quality_average,
      avg / 5, (avg / 5) * weights.core.company_quality_average)
  }
  if ('education' in weights.core) {
    let max = 0
    for (const e of education || []) {
      const raw = (e.school_name_raw || '').trim()
      if (!raw) continue
      const hit = schoolByNorm.get(normalizeSchool(raw))
      if (hit !== undefined && hit > max) max = hit
    }
    push('education', 'core', weights.core.education, max / 4, (max / 4) * weights.core.education)
  }
  if ('degree_relevance' in weights.core) {
    let max = 0
    for (const e of education || []) {
      const c = ((e.field_of_study_raw || '') + ' ' + (e.degree_raw || '')).trim()
      if (!c) continue
      const r = degreeRelevance(fn, c)
      if (r > max) max = r
    }
    push('degree_relevance', 'core', weights.core.degree_relevance, max, max * weights.core.degree_relevance)
  }
  if ('internships' in weights.core) {
    const interns = experiences.filter(e => isInternshipTitle(e.title_raw))
    const scores = interns.map(e => expCompanyScore(e))
    const avg = scores.length > 0 ? scores.reduce((s, v) => s + (v ?? 0), 0) / scores.length : 0
    push('internships', 'core', weights.core.internships, avg / 5, (avg / 5) * weights.core.internships)
  }
  if (weights.bonus?.career_slope !== undefined) {
    const up = careerProgression === 'rising'
    push('career_slope', 'bonus', weights.bonus.career_slope, up ? 1 : 0, up ? weights.bonus.career_slope : 0)
  }
  if (weights.penalty) {
    const ft = experiences.filter(e => !isInternshipTitle(e.title_raw) && e.duration_months)
    const avg = ft.length > 0 ? ft.reduce((s, e) => s + (e.duration_months || 0), 0) / ft.length : 0
    const { maxPoints, thresholdMonths } = weights.penalty
    const pen = avg >= thresholdMonths ? 0 : maxPoints * (1 - avg / thresholdMonths)
    push('short_tenure', 'penalty', maxPoints, avg >= thresholdMonths ? 0 : (1 - avg / thresholdMonths), -pen)
  }

  const core = components.filter(c => c.cat === 'core').reduce((s, c) => s + c.pts, 0)
  const bonus = components.filter(c => c.cat === 'bonus').reduce((s, c) => s + c.pts, 0)
  const penalty = components.filter(c => c.cat === 'penalty').reduce((s, c) => s + c.pts, 0)
  const total = core + bonus + penalty
  const bucket = assignBucket(stage, total)

  const reasoning = `${stage} (${years ?? '?'}y) core=${core.toFixed(1)} bonus=${bonus.toFixed(1)} penalty=${penalty.toFixed(1)} → ${Math.round(total * 100) / 100}/${bucket}`

  const { error } = await supabase.from('candidate_bucket_assignments').insert({
    person_id: person.person_id,
    candidate_bucket: bucket,
    assigned_by: 'system',
    assignment_reason: reasoning,
  })
  if (error) throw new Error(`bucket write failed: ${error.message}`)

  return { bucket, total, stage }
}

// ─── Main ───────────────────────────────────────────────────────────────────

let query = supabase.from('people').select('person_id, full_name')
const { data: allPeople } = await query
const people = allPeople || []

let targetPeople = people
if (unscoredOnly) {
  const { data: bucketed } = await supabase
    .from('candidate_bucket_assignments')
    .select('person_id')
  const scoredIds = new Set((bucketed || []).map(b => b.person_id))
  targetPeople = people.filter(p => !scoredIds.has(p.person_id))
}

console.log(`\nProcessing ${targetPeople.length} ${unscoredOnly ? 'unscored ' : ''}people (of ${people.length} total)...\n`)

let ok = 0
let failed = 0
for (const p of targetPeople) {
  try {
    const r = await processOne(p)
    console.log(`  ✓ ${p.full_name.padEnd(28)} → ${r.bucket.padEnd(16)} (${r.total.toFixed(1)}, ${r.stage})`)
    ok++
  } catch (e) {
    console.error(`  ✗ ${p.full_name}: ${e.message}`)
    failed++
  }
}

console.log(`\n=== Done ===`)
console.log(`Scored: ${ok}`)
if (failed > 0) console.log(`Failed: ${failed}`)
