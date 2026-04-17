// lib/scoring/compute-derived.ts
//
// Phase 2 derived-signal computation for a single person.
//
// Mirrors the logic in scripts/compute-derived-fields.mjs but scoped to
// one person_id so it can run inline during the ingest pipeline. Writes
// the following columns on `people`:
//
//   career_progression           'rising' | 'flat' | 'declining' | 'insufficient_data' | null
//                                Trajectory of the last 2-3 scored full-time roles.
//                                Only 'rising' triggers the career_slope scoring bonus.
//   highest_seniority_reached    seniority_level enum (max rank across experiences)
//   has_early_stage_experience   TRUE if any experience started within 4 yrs
//                                of the company's founding_year
//   early_stage_companies_count  count
//   has_hypergrowth_experience   TRUE if any experience overlapped a year
//                                where company headcount ≥ 2× prior year
//   hypergrowth_companies_count  count
//
// scoreCandidate() reads these fields, so this must run BEFORE scoring.

import { SupabaseClient } from '@supabase/supabase-js'

export interface DerivedFields {
  career_progression: 'rising' | 'flat' | 'declining' | 'insufficient_data' | null
  highest_seniority_reached: string | null
  title_level_slope: 'rising' | 'flat' | 'declining' | 'insufficient_data' | null
  has_early_stage_experience: boolean
  early_stage_companies_count: number
  has_hypergrowth_experience: boolean
  hypergrowth_companies_count: number
}

interface ExperienceRow {
  company_id: string | null
  title_raw: string | null
  title_level: number | null
  seniority_normalized: string | null
  employment_type_normalized: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
}

function isInternshipTitle(title: string | null): boolean {
  if (!title) return false
  return /\bintern\b|\binternship\b|\bco-?op\b/i.test(title)
}

/** Compute per-experience avg company_year_score across years worked. */
function experienceCompanyScore(
  exp: ExperienceRow,
  yearScores: Array<{ company_id: string; year: number; company_score: number }>,
): number | null {
  if (!exp.company_id || !exp.start_date) return null
  const startYear = new Date(exp.start_date).getFullYear()
  if (isNaN(startYear)) return null
  const endYear = exp.is_current
    ? new Date().getFullYear()
    : (exp.end_date ? new Date(exp.end_date).getFullYear() : new Date().getFullYear())
  const matches = yearScores.filter(ys =>
    ys.company_id === exp.company_id && ys.year >= startYear && ys.year <= endYear
  )
  if (matches.length === 0) return null
  return matches.reduce((s, ys) => s + ys.company_score, 0) / matches.length
}

/**
 * Compute derived signals for one person. Does NOT write — caller does.
 */
export async function computeDerivedFields(
  supabase: SupabaseClient,
  personId: string,
): Promise<DerivedFields> {
  // 1. Fetch this person's experiences, ordered oldest → newest
  const { data: expRaw } = await supabase
    .from('person_experiences')
    .select('company_id, title_raw, title_level, seniority_normalized, employment_type_normalized, start_date, end_date, is_current')
    .eq('person_id', personId)
    .order('start_date', { ascending: true, nullsFirst: false })

  const experiences: ExperienceRow[] = expRaw || []

  // Full-time heuristic: explicit full_time OR not-internship AND title doesn't say intern
  const fullTimeExps = experiences.filter(e =>
    e.employment_type_normalized === 'full_time' ||
    (e.employment_type_normalized !== 'internship' && !isInternshipTitle(e.title_raw))
  )

  // 2. Fetch reference tables scoped to this person's companies
  const companyIds = Array.from(
    new Set(experiences.map(e => e.company_id).filter((x): x is string => !!x))
  )

  let yearScores: Array<{ company_id: string; year: number; company_score: number }> = []
  let companies: Array<{ company_id: string; founding_year: number | null }> = []
  let metrics: Array<{ company_id: string; year: number; headcount_estimate: number | null }> = []

  if (companyIds.length > 0) {
    const [ysRes, cRes, mRes] = await Promise.all([
      supabase
        .from('company_year_scores')
        .select('company_id, year, company_score')
        .in('company_id', companyIds),
      supabase
        .from('companies')
        .select('company_id, founding_year')
        .in('company_id', companyIds),
      supabase
        .from('company_metrics_by_year')
        .select('company_id, year, headcount_estimate')
        .in('company_id', companyIds),
    ])
    yearScores = ysRes.data || []
    companies = cRes.data || []
    metrics = mRes.data || []
  }

  const { data: seniorityDict } = await supabase
    .from('seniority_dictionary')
    .select('seniority_normalized, rank_order')

  const companyById: Record<string, { founding_year: number | null }> = {}
  for (const c of companies) companyById[c.company_id] = c

  const seniorityRank: Record<string, number> = {}
  for (const s of seniorityDict || []) seniorityRank[s.seniority_normalized] = s.rank_order

  // 3. career_progression — trajectory of the last 2-3 scored full-time roles.
  //    Experiences are ordered oldest→newest above; scoredFT preserves that order.
  //    With 3+ scored roles: compare newest vs mean of the prior two.
  //    With exactly 2: compare newest vs previous.
  //    With <2: insufficient_data (null on the column isn't distinguishable from
  //    "not yet computed", so we use an explicit enum value here).
  //    Threshold of 0.3 on a 0-5 company_score scale keeps tiny fluctuations as 'flat'.
  const scoredFT = fullTimeExps
    .map(e => ({ e, score: experienceCompanyScore(e, yearScores) }))
    .filter(x => x.score !== null) as Array<{ e: ExperienceRow; score: number }>

  let careerProgression: DerivedFields['career_progression'] = 'insufficient_data'
  if (scoredFT.length >= 2) {
    const newest = scoredFT[scoredFT.length - 1].score
    const baseline = scoredFT.length >= 3
      ? (scoredFT[scoredFT.length - 2].score + scoredFT[scoredFT.length - 3].score) / 2
      : scoredFT[scoredFT.length - 2].score
    const diff = newest - baseline
    if (diff > 0.3) careerProgression = 'rising'
    else if (diff < -0.3) careerProgression = 'declining'
    else careerProgression = 'flat'
  }

  // 4. highest_seniority_reached — max rank across experiences
  let maxRank = 0
  let highestSeniority: string | null = null
  for (const e of experiences) {
    if (!e.seniority_normalized) continue
    const rank = seniorityRank[e.seniority_normalized]
    if (rank && rank > maxRank) {
      maxRank = rank
      highestSeniority = e.seniority_normalized
    }
  }

  // 5. title_level_slope — trajectory of title_level across recent FT roles.
  //    Same algorithm as career_progression but reading title_level instead
  //    of company_year_scores. Experiences are ordered oldest→newest.
  const leveledFT = fullTimeExps.filter(e => e.title_level !== null) as Array<ExperienceRow & { title_level: number }>
  let titleLevelSlope: DerivedFields['title_level_slope'] = 'insufficient_data'
  if (leveledFT.length >= 2) {
    const newest = leveledFT[leveledFT.length - 1].title_level
    const baseline = leveledFT.length >= 3
      ? (leveledFT[leveledFT.length - 2].title_level + leveledFT[leveledFT.length - 3].title_level) / 2
      : leveledFT[leveledFT.length - 2].title_level
    const diff = newest - baseline
    // Threshold of 0.5 (half a level) — a 1-level jump is rising, same level is flat.
    if (diff >= 0.5) titleLevelSlope = 'rising'
    else if (diff <= -0.5) titleLevelSlope = 'declining'
    else titleLevelSlope = 'flat'
  }

  // 6. early_stage — experience started within 4 yrs of company founding_year
  const earlyStageCompanyIds = new Set<string>()
  for (const e of experiences) {
    if (!e.company_id || !e.start_date) continue
    const founded = companyById[e.company_id]?.founding_year
    if (!founded) continue
    const startYear = new Date(e.start_date).getFullYear()
    if (isNaN(startYear)) continue
    if (startYear - founded <= 4) earlyStageCompanyIds.add(e.company_id)
  }

  // 7. hypergrowth — overlap with years where headcount ≥ 2× prior year
  const hypergrowthYearsByCompany: Record<string, Set<number>> = {}
  for (const m of metrics) {
    if (!m.headcount_estimate) continue
    const prior = metrics.find(p => p.company_id === m.company_id && p.year === m.year - 1)
    if (prior?.headcount_estimate && m.headcount_estimate >= 2 * prior.headcount_estimate) {
      if (!hypergrowthYearsByCompany[m.company_id]) {
        hypergrowthYearsByCompany[m.company_id] = new Set()
      }
      hypergrowthYearsByCompany[m.company_id].add(m.year)
    }
  }

  const hyperCompanyIds = new Set<string>()
  for (const e of experiences) {
    if (!e.company_id || !e.start_date) continue
    const years = hypergrowthYearsByCompany[e.company_id]
    if (!years) continue
    const startYear = new Date(e.start_date).getFullYear()
    if (isNaN(startYear)) continue
    const endYear = e.is_current
      ? new Date().getFullYear()
      : (e.end_date ? new Date(e.end_date).getFullYear() : startYear)
    for (let y = startYear; y <= endYear; y++) {
      if (years.has(y)) {
        hyperCompanyIds.add(e.company_id)
        break
      }
    }
  }

  return {
    career_progression: careerProgression,
    highest_seniority_reached: highestSeniority,
    title_level_slope: titleLevelSlope,
    has_early_stage_experience: earlyStageCompanyIds.size > 0,
    early_stage_companies_count: earlyStageCompanyIds.size,
    has_hypergrowth_experience: hyperCompanyIds.size > 0,
    hypergrowth_companies_count: hyperCompanyIds.size,
  }
}

/** Compute derived fields AND write them to the people row. */
export async function computeAndWriteDerivedFields(
  supabase: SupabaseClient,
  personId: string,
): Promise<DerivedFields> {
  const fields = await computeDerivedFields(supabase, personId)
  const { error } = await supabase.from('people').update(fields).eq('person_id', personId)
  if (error) throw new Error(`Failed to write derived fields: ${error.message}`)
  return fields
}
