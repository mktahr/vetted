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
//   is_current_founder           TRUE if any is_current=true founder-titled
//                                experience exists. Excluded from default search.
//   is_former_founder            TRUE if any past founder role AND
//                                is_current_founder=FALSE. Positive signal chip.
//
// scoreCandidate() reads these fields, so this must run BEFORE scoring.

import { SupabaseClient } from '@supabase/supabase-js'
import { aggregatePersonSpecialties, type PersonSpecialties } from '@/lib/normalize/specialty'
import {
  resolveHeadOfByHeadcount,
  isAmbiguousHeadOfTitle,
  headcountAtRoleEnd,
} from '@/lib/normalize/seniority'
import { computeSlopeScore } from '@/lib/scoring/slope'

export interface DerivedFields {
  career_progression: 'rising' | 'flat' | 'declining' | 'insufficient_data' | null
  highest_seniority_reached: string | null
  title_level_slope: 'rising' | 'flat' | 'declining' | 'insufficient_data' | null
  slope_score: number | null
  primary_specialty: string | null
  secondary_specialty: string | null
  historical_specialty: string | null
  specialty_transition_flag: boolean
  has_early_stage_experience: boolean
  early_stage_companies_count: number
  has_hypergrowth_experience: boolean
  hypergrowth_companies_count: number
  is_current_founder: boolean
  is_former_founder: boolean
  is_vc_backed_founder: boolean
  is_bootstrapped_founder: boolean
  has_founding_engineer_experience: boolean
}

// Matches "Founder", "Co-Founder", "Cofounder", "Founder & CEO", etc. but
// NOT "Founding Engineer" / "Founding Designer" (early employees, not founders).
const FOUNDER_TITLE_PATTERN = /\b(co-?)?founder\b/i

function isFounderExperience(exp: ExperienceRow): boolean {
  if (exp.seniority_normalized === 'founder') return true
  if (exp.title_raw && FOUNDER_TITLE_PATTERN.test(exp.title_raw)) return true
  return false
}

// Founding / early-ENGINEER title signal — DISTINCT from FOUNDER above: these people
// ARE engineers (they classify to their real discipline), and "founding/early" is a
// searchable STAGE tag. Title-driven today; a headcount/founding-date inference layer
// can later OR into person_experiences.is_founding_engineer_role (roadmap). Requires an
// "engineer" token, so "Founding Designer" / "Founding Product Manager" do NOT match.
// "early" is adjacency-only to avoid catching "Early Career Engineer" (a junior title).
export const FOUNDING_ENGINEER_TITLE_PATTERN =
  /\bfounding\s+(?:[a-z][a-z/&+.-]*\s+){0,4}engineer\b|\bfirst\s+(?:[a-z][a-z/&+.-]*\s+){0,2}engineer\b|\bearly\s+engineer\b|\bengineer\s*#\s*\d+/i

export function isFoundingEngineerTitle(title: string | null | undefined): boolean {
  return !!title && FOUNDING_ENGINEER_TITLE_PATTERN.test(title)
}

interface ExperienceRow {
  person_experience_id: string
  company_id: string | null
  title_raw: string | null
  title_level: number | null
  specialty_normalized: string | null
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
  // 0. Fetch person-level fields needed for override rules
  const { data: personRow } = await supabase
    .from('people')
    .select('years_experience_estimate')
    .eq('person_id', personId)
    .single()
  const yearsExperience: number | null = personRow?.years_experience_estimate ?? null

  // 1. Fetch this person's experiences, ordered oldest → newest
  const { data: expRaw } = await supabase
    .from('person_experiences')
    .select('person_experience_id, company_id, title_raw, title_level, specialty_normalized, seniority_normalized, employment_type_normalized, start_date, end_date, is_current')
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
  let companies: Array<{
    company_id: string
    founding_year: number | null
    headcount_latest: number | null
    headcount_timeseries: Array<{ date: string; count: number }> | null
  }> = []
  let metrics: Array<{ company_id: string; year: number; headcount_estimate: number | null }> = []

  if (companyIds.length > 0) {
    const [ysRes, cRes, mRes] = await Promise.all([
      supabase
        .from('company_year_scores')
        .select('company_id, year, company_score')
        .in('company_id', companyIds),
      supabase
        .from('companies')
        .select('company_id, founding_year, headcount_latest, headcount_timeseries')
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

  // Fetch in parallel — seniority_dictionary for rank lookup, person_education
  // for slope_score's getFtExperiences filter (graduation date anchors the
  // pre-graduation override that excludes intern-period roles from FT set).
  const [seniorityDictRes, educationRes] = await Promise.all([
    supabase.from('seniority_dictionary').select('seniority_normalized, rank_order'),
    supabase.from('person_education').select('start_year, end_year, degree_raw, degree_level').eq('person_id', personId),
  ])
  const seniorityDict = seniorityDictRes.data
  const education = educationRes.data || []

  const companyById: Record<string, {
    founding_year: number | null
    headcount_latest: number | null
    headcount_timeseries: Array<{ date: string; count: number }> | null
  }> = {}
  for (const c of companies) companyById[c.company_id] = c

  // ─── 1b. Head-Of headcount reclassification pass (time-aware) ───────────
  //   Ambiguous "Head of X" titles classify by company headcount rather than
  //   by exact-rule lookup (the two old exact rules `head of people` / `head
  //   of talent` were deleted in migration 067). For each experience matching
  //   /\bhead of\b/, compute the headcount-derived seniority and write it back
  //   to person_experiences.seniority_normalized so it's the single source of
  //   truth downstream (UI, search filters, max-rank derivation below).
  //
  //   TIME-AWARE branching:
  //     • Current role (is_current=true)  → use companies.headcount_latest.
  //       Person is in the seat; level against today's company size. They
  //       re-level on each rescore as the company grows.
  //     • Past role    (is_current=false) → use headcountAtRoleEnd() against
  //       companies.headcount_timeseries with the role's end_date. They
  //       operated at that scope and left; subsequent company growth does
  //       NOT retroactively promote their level.
  //
  //   IMPORTANT: when the timeseries has no point at or before end_date for
  //   a past role, we do NOT fall back to headcount_latest — that would
  //   reintroduce the retroactive-promotion problem this logic exists to
  //   avoid. Null → resolveHeadOfByHeadcount(null) → lead_ic default per spec.
  //
  //   Guardrail: this only changes the per-experience classification of the
  //   Head Of role. The max-across-experiences derivation of
  //   highest_seniority_reached (step 4 below) preserves a candidate's peak
  //   rank from prior roles — Head-of-at-startup does NOT reduce
  //   highest_seniority_reached for someone who was previously a Director.
  //
  //   IDEMPOTENT — same (title_raw, is_current, end_date, company headcount
  //   data) inputs always produce the same output. title_raw never mutates;
  //   seniority_normalized is fully derived and re-derives on each rescore.
  //   Self-corrects as Crust company enrichment lands.
  //
  //   Headcount data fill rate is currently ~0.4% (6/1508 companies). Almost
  //   every Head Of will resolve to lead_ic (the default for unknown). The
  //   logic still applies cleanly once Crust company enrichment lands.
  const headOfUpdates: Array<{ id: string; newSeniority: string }> = []
  for (const e of experiences) {
    if (!isAmbiguousHeadOfTitle(e.title_raw)) continue
    const co = e.company_id ? companyById[e.company_id] : null
    let hc: number | null = null
    if (co) {
      hc = e.is_current
        ? (co.headcount_latest ?? null)
        : headcountAtRoleEnd(co.headcount_timeseries, e.end_date)
    }
    const newSeniority = resolveHeadOfByHeadcount(hc)
    if (e.seniority_normalized !== newSeniority) {
      headOfUpdates.push({ id: e.person_experience_id, newSeniority })
      e.seniority_normalized = newSeniority  // mutate for downstream derivations in this run
    }
  }
  if (headOfUpdates.length > 0) {
    // Sequential to keep this dependency-free; Head Of titles are rare per person.
    for (const u of headOfUpdates) {
      await supabase
        .from('person_experiences')
        .update({ seniority_normalized: u.newSeniority })
        .eq('person_experience_id', u.id)
    }
  }

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

  // 4. highest_seniority_reached — max rank across experiences.
  //    Note: per-experience Head Of titles have already been reclassified by
  //    the headcount pass above (step 1b), so this max-rank derivation reads
  //    the headcount-aware values. The previous "head of + 9+ years →
  //    executive" interim rule was removed in migration 067 — the headcount-
  //    based logic supersedes it. Guardrail: a candidate who was a Director
  //    elsewhere retains highest_seniority_reached=director even if their
  //    current Head Of role resolves down to lead_ic (small-startup default).
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
  void yearsExperience  // retained in fetch above for potential future use; no longer consumed here

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

  // 8a. Founder flag derivation. Current + Former are mutually exclusive per spec:
  //     is_former_founder is TRUE only when is_current_founder is FALSE.
  const founderExps = experiences.filter(isFounderExperience)
  const isCurrentFounder = founderExps.some(e => e.is_current === true)
  const isFormerFounder = !isCurrentFounder && founderExps.some(e => e.is_current === false)

  // 8a-bis. Founding/early-ENGINEER title tag (title-driven; SEPARATE from founder flags).
  //   Persist the per-experience flag (mirrors the Head-Of seniority write above); the
  //   column defaults FALSE and experiences are delete+reinserted on re-ingest, so a
  //   set-true-for-matches pass is sufficient. Person-level aggregate feeds search.
  const foundingEngExps = experiences.filter(e => isFoundingEngineerTitle(e.title_raw))
  for (const e of foundingEngExps) {
    await supabase
      .from('person_experiences')
      .update({ is_founding_engineer_role: true })
      .eq('person_experience_id', e.person_experience_id)
  }
  const hasFoundingEngineerExperience = foundingEngExps.length > 0

  // 8b. VC-backed vs Bootstrapped founder taxonomy.
  //     Binary classification per locked spec. Re-runs on every scoreCandidate
  //     so candidates auto-reclassify as funding data improves over time.
  //
  //     VC-backed signals (any of the following → is_vc_backed_founder=TRUE):
  //       • Founder experience's company has 1+ rows in company_funding_rounds
  //       • Founder experience's company has current_status IN ('acquired','public')
  //       • Candidate has 1+ person_signals in (incubator, university_incubator_accelerator)
  //         — proxy for "this founder went through YC / Techstars / SkyDeck / etc."
  //         Not perfectly tied to a specific founder experience (we don't store
  //         that linkage today) but accepted false positive rate is low.
  //
  //     Bootstrapped signal (default when no VC-backing signal):
  //       • Founder experience's company has 0 funding rounds, no acquired/public status,
  //         AND candidate has no incubator/accelerator signals
  //       • OR founder experience's company isn't in companies table at all (better to
  //         surface than hide — user explicit decision)
  //
  //     Both can be TRUE: candidate has multiple founder roles, some VC-backed
  //     and some bootstrapped.
  let isVcBackedFounder = false
  let isBootstrappedFounder = false

  if (founderExps.length > 0) {
    const founderCompanyIds = Array.from(new Set(
      founderExps.map(e => e.company_id).filter((x): x is string => !!x)
    ))

    // Check incubator/accelerator person_signals (candidate-wide, not exp-specific).
    const { data: incubatorSignals } = await supabase
      .from('person_signals_active')
      .select('id')
      .eq('person_id', personId)
      .in('category', ['incubator', 'university_incubator_accelerator'])
      .limit(1)
    const candidateHasIncubatorSignal = (incubatorSignals?.length || 0) > 0

    // Check company-side VC-backing signals for the founder companies.
    let companyVcBackedIds = new Set<string>()
    if (founderCompanyIds.length > 0) {
      const [fundingRes, statusRes] = await Promise.all([
        supabase.from('company_funding_rounds').select('company_id').in('company_id', founderCompanyIds),
        supabase.from('companies').select('company_id, current_status').in('company_id', founderCompanyIds),
      ])
      for (const r of fundingRes.data || []) companyVcBackedIds.add((r as any).company_id)
      for (const r of statusRes.data || []) {
        if (['acquired', 'public'].includes((r as any).current_status)) {
          companyVcBackedIds.add((r as any).company_id)
        }
      }
    }

    // Per-experience classification, then aggregate.
    for (const exp of founderExps) {
      const cid = exp.company_id
      // No company_id (couldn't resolve to companies table) → bootstrapped per user spec.
      if (!cid) { isBootstrappedFounder = true; continue }

      const companySideVc = companyVcBackedIds.has(cid)
      if (companySideVc || candidateHasIncubatorSignal) {
        isVcBackedFounder = true
      } else {
        isBootstrappedFounder = true
      }
    }
  }

  // 8. Person-level specialty aggregation (most-recent first for recency weighting)
  const experiencesRecentFirst = [...experiences].reverse()
  const specialties: PersonSpecialties = aggregatePersonSpecialties(
    experiencesRecentFirst.map(e => ({
      specialty_normalized: e.specialty_normalized,
      is_current: e.is_current,
      employment_type_normalized: e.employment_type_normalized,
      title_raw: e.title_raw,
    })),
  )

  // 9. slope_score — continuous candidate slope (0-100, NULL for insufficient data).
  //    Replaces the binary title_level_slope='rising' signal in the scoring
  //    engine's career_slope bonus. title_level_slope still computed above
  //    (step 5) and kept populated for lib/ai/narrative.ts until deprecation.
  //    Idempotent / pure — re-derives on every rescore.
  const slopeScore = computeSlopeScore(
    experiences.map(e => ({
      company_id: e.company_id,
      title_raw: e.title_raw,
      start_date: e.start_date,
      end_date: e.end_date,
      is_current: e.is_current,
      seniority_normalized: e.seniority_normalized,
      employment_type_normalized: e.employment_type_normalized,
    })),
    education,
  )

  return {
    career_progression: careerProgression,
    highest_seniority_reached: highestSeniority,
    title_level_slope: titleLevelSlope,
    slope_score: slopeScore,
    primary_specialty: specialties.primary_specialty,
    secondary_specialty: specialties.secondary_specialty,
    historical_specialty: specialties.historical_specialty,
    specialty_transition_flag: specialties.specialty_transition_flag,
    has_early_stage_experience: earlyStageCompanyIds.size > 0,
    early_stage_companies_count: earlyStageCompanyIds.size,
    has_hypergrowth_experience: hyperCompanyIds.size > 0,
    hypergrowth_companies_count: hyperCompanyIds.size,
    is_current_founder: isCurrentFounder,
    is_former_founder: isFormerFounder,
    is_vc_backed_founder: isVcBackedFounder,
    is_bootstrapped_founder: isBootstrappedFounder,
    has_founding_engineer_experience: hasFoundingEngineerExperience,
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
