// lib/scoring/slope.ts
//
// Continuous candidate slope score (post-migration 068).
//
// For each candidate, compute a per-level score for every seniority level
// they REACHED, anchored on years from FT start to FIRST reaching that level.
// Levels below Senior are ignored entirely. Final slope_score is a WEIGHTED
// AVERAGE across all levels reached.
//
// Founder is NOT a slope level — separate role/function axis tracked via
// is_current_founder / is_former_founder. Excluded entirely from this math.
//
// Replaces the binary title_level_slope='rising' label model in the scoring
// engine's career_slope bonus. title_level_slope column kept for now (read
// by lib/ai/narrative.ts); deprecation is a follow-up.

import { getFtExperiences, type FtExperience, type FtEducation } from '@/lib/tenure/helpers'

export type SlopeBucket = 'senior' | 'lead' | 'manager' | 'director' | 'vp' | 'c_suite'

/**
 * Per-level weights for the final weighted average. Higher seniority levels
 * weight more — a candidate who reached c_suite (weight 2.5) contributes more
 * to their score than the same person's senior_ic milestone (weight 1.0).
 */
export const SLOPE_WEIGHTS: Record<SlopeBucket, number> = {
  senior:   1.0,
  lead:     1.5,
  manager:  1.5,
  director: 2.0,
  vp:       2.0,
  c_suite:  2.5,
}

/**
 * seniority_normalized → slope bucket. Levels below Senior are excluded
 * (return null). Legacy 'executive' (post-067 deprecated) maps to c_suite
 * for backward compat with any stored rows. 'founder' is NEVER part of slope.
 */
export const SENIORITY_TO_SLOPE_BUCKET: Record<string, SlopeBucket | null> = {
  // Below Senior — excluded entirely
  intern: null,
  junior_ic: null,
  individual_contributor: null,

  // Slope-eligible
  senior_ic: 'senior',
  lead_ic: 'lead',
  manager: 'manager',
  director: 'director',
  vp: 'vp',
  c_suite: 'c_suite',

  // Founder — separate axis, NEVER counted
  founder: null,

  // Deprecated / legacy enum values — map to closest active bucket
  lead: 'lead',          // deprecated alias of lead_ic
  executive: 'c_suite',  // deprecated post-067; legacy rows score cleanly
  student: null,
  entry: null,
  unknown: null,
}

export function resolveSlopeBucket(seniority: string | null | undefined): SlopeBucket | null {
  if (!seniority) return null
  return SENIORITY_TO_SLOPE_BUCKET[seniority] ?? null
}

// ─── Per-level benchmark tables ────────────────────────────────────────────
//
// Years from FT start to first reaching the level → raw score (0-100, floor 10).
// Each band is "upTo years" inclusive at the boundary (matches spec wording
// "4-5→80" meaning >4 and ≤5 lands at 80).

interface BenchmarkBand { upTo: number; score: number }

const BENCHMARKS: Record<SlopeBucket, BenchmarkBand[]> = {
  // SENIOR — benchmark 4y, cutoff 8y
  senior: [
    { upTo: 4,        score: 100 },
    { upTo: 5,        score: 80 },
    { upTo: 6,        score: 75 },
    { upTo: 7,        score: 55 },
    { upTo: 8,        score: 45 },
    { upTo: 9,        score: 35 },
    { upTo: 10,       score: 25 },
    { upTo: 11,       score: 15 },
    { upTo: Infinity, score: 10 },
  ],
  // LEAD — benchmark 7y, cutoff 13y
  lead: [
    { upTo: 7,        score: 100 },
    { upTo: 9,        score: 80 },
    { upTo: 10,       score: 75 },
    { upTo: 11,       score: 55 },
    { upTo: 13,       score: 45 },
    { upTo: 14,       score: 35 },
    { upTo: 15,       score: 25 },
    { upTo: 16,       score: 15 },
    { upTo: Infinity, score: 10 },
  ],
  // MANAGER — benchmark 8y, cutoff 13y
  manager: [
    { upTo: 8,        score: 100 },
    { upTo: 9,        score: 80 },
    { upTo: 10,       score: 75 },
    { upTo: 11,       score: 55 },
    { upTo: 13,       score: 45 },
    { upTo: 14,       score: 35 },
    { upTo: 15,       score: 25 },
    { upTo: 16,       score: 15 },
    { upTo: Infinity, score: 10 },
  ],
  // DIRECTOR — benchmark 10y, cutoff 16y
  director: [
    { upTo: 10,       score: 100 },
    { upTo: 12,       score: 80 },
    { upTo: 13,       score: 75 },
    { upTo: 14,       score: 55 },
    { upTo: 16,       score: 45 },
    { upTo: 17,       score: 35 },
    { upTo: 18,       score: 25 },
    { upTo: 19,       score: 15 },
    { upTo: Infinity, score: 10 },
  ],
  // VP — benchmark 12y, cutoff 18y
  vp: [
    { upTo: 12,       score: 100 },
    { upTo: 14,       score: 80 },
    { upTo: 15,       score: 75 },
    { upTo: 16,       score: 55 },
    { upTo: 18,       score: 45 },
    { upTo: 19,       score: 35 },
    { upTo: 20,       score: 25 },
    { upTo: 21,       score: 15 },
    { upTo: Infinity, score: 10 },
  ],
  // C_SUITE — benchmark 15y, cutoff 22y
  c_suite: [
    { upTo: 15,       score: 100 },
    { upTo: 18,       score: 80 },
    { upTo: 19,       score: 75 },
    { upTo: 20,       score: 55 },
    { upTo: 22,       score: 45 },
    { upTo: 23,       score: 35 },
    { upTo: 24,       score: 25 },
    { upTo: 25,       score: 15 },
    { upTo: Infinity, score: 10 },
  ],
}

function lookupBenchmark(bucket: SlopeBucket, yearsToReach: number): number {
  const table = BENCHMARKS[bucket]
  for (const band of table) {
    if (yearsToReach <= band.upTo) return band.score
  }
  return 10  // floor — should be unreachable given Infinity entry
}

// ─── Atypical-entry guard sets ─────────────────────────────────────────────
//
// "IC-equivalent" history means roles mapping to any pre-management IC track
// value. Used to determine if a candidate ever held an IC role.
const IC_EQUIVALENT_SENIORITIES = new Set<string>([
  'junior_ic', 'individual_contributor', 'senior_ic', 'lead_ic',
  // deprecated aliases
  'entry', 'lead',
])

const MANAGER_PLUS_SENIORITIES = new Set<string>([
  'manager', 'director', 'vp', 'c_suite',
  // legacy (deprecated post-067)
  'executive',
])

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25

// ─── Input shape ──────────────────────────────────────────────────────────
// Generic input that matches both ingest-side and compute-derived call sites.
// FT filtering happens internally via getFtExperiences from lib/tenure/helpers
// (mode='yoe' — same set used by computeYearsExperienceEstimate).

export interface SlopeExperienceInput {
  company_id?: string | null
  title_raw?: string | null
  start_date?: string | null
  end_date?: string | null
  is_current?: boolean | null
  seniority_normalized?: string | null
  employment_type_normalized?: string | null
}

export interface SlopeEducationInput {
  start_year?: number | null
  end_year?: number | null
  degree?: string | null
  degree_raw?: string | null
  degree_level?: string | null
}

/**
 * Compute the continuous slope_score (0-100) or NULL for insufficient data.
 *
 * NULL conditions:
 *   1. No qualifying FT history (no FT start anchor exists)
 *   2. Atypical-entry guard fires: zero IC-equivalent history AT ALL across
 *      all FT experiences AND <2 years FT total before first manager+ role.
 *      Catches non-IC entrants (e.g. consulting → MBA → director-on-day-one).
 *      Legitimate military-to-MBA-to-manager paths whose military years map
 *      to ic/senior_ic/lead_ic pass this guard (have IC history → don't fire).
 *
 *      Note on the conjunction: under "no IC-equivalent history" the earliest
 *      qualifying FT role IS the first manager+ role, so "FT years before
 *      first manager+" = 0 < 2 always. The two conditions are logically
 *      redundant — both checked literally for clarity and future-edit safety.
 *   3. Zero slope-eligible levels reached (career entirely at intern/junior_ic/
 *      individual_contributor with no senior_ic-or-above experience).
 *
 * Otherwise: weighted average of per-level benchmark lookups across all
 * slope-eligible levels reached. Per-level lookups have a floor of 10.
 *
 * IDEMPOTENT — same inputs always produce the same output. Pure function.
 * No side effects, no DB access.
 */
export function computeSlopeScore(
  experiences: SlopeExperienceInput[],
  education: SlopeEducationInput[],
): number | null {
  // 1. FT filter (same as computeYearsExperienceEstimate — mode='yoe')
  const ftExps: FtExperience[] = experiences.map(e => ({
    company_id: e.company_id ?? null,
    title_raw: e.title_raw ?? null,
    start_date: e.start_date ?? null,
    end_date: e.end_date ?? null,
    is_current: e.is_current ?? false,
    employment_type: e.employment_type_normalized ?? null,
    seniority: e.seniority_normalized ?? null,
  }))
  const eduMapped: FtEducation[] = education.map(e => ({
    start_year: e.start_year ?? null,
    end_year: e.end_year ?? null,
    degree_raw: e.degree_raw ?? e.degree ?? null,
    degree_level: e.degree_level ?? null,
  }))
  const qualifyingFt = getFtExperiences(ftExps, eduMapped, 'yoe')

  // 2. FT start anchor
  let ftStart: Date | null = null
  for (const e of qualifyingFt) {
    if (!e.start_date) continue
    const start = new Date(e.start_date)
    if (isNaN(start.getTime())) continue
    if (ftStart === null || start < ftStart) ftStart = start
  }
  if (!ftStart) return null  // NULL condition #1

  // 3. Atypical-entry guard (NULL condition #2)
  const hasIcEquivalent = qualifyingFt.some(e =>
    e.seniority && IC_EQUIVALENT_SENIORITIES.has(e.seniority)
  )
  if (!hasIcEquivalent) {
    const managerPlusStarts = qualifyingFt
      .filter(e => e.seniority && MANAGER_PLUS_SENIORITIES.has(e.seniority) && e.start_date)
      .map(e => new Date(e.start_date!).getTime())
      .filter(t => !isNaN(t))
      .sort((a, b) => a - b)
    if (managerPlusStarts.length > 0) {
      const firstMgrPlus = managerPlusStarts[0]
      const ftYearsBefore = (firstMgrPlus - ftStart.getTime()) / MS_PER_YEAR
      if (ftYearsBefore < 2) return null
    }
  }

  // 4. First-reached date per slope bucket
  const firstReached = new Map<SlopeBucket, Date>()
  for (const e of qualifyingFt) {
    if (!e.start_date || !e.seniority) continue
    const bucket = resolveSlopeBucket(e.seniority)
    if (!bucket) continue
    const start = new Date(e.start_date)
    if (isNaN(start.getTime())) continue
    const existing = firstReached.get(bucket)
    if (!existing || start < existing) firstReached.set(bucket, start)
  }

  if (firstReached.size === 0) return null  // NULL condition #3

  // 5. Weighted average across levels reached
  //    (Array.from() wrap matches existing codebase pattern — avoids the
  //    --downlevelIteration TS requirement; see score-candidate.ts:616.)
  let weightedSum = 0, totalWeight = 0
  for (const [bucket, firstDate] of Array.from(firstReached.entries())) {
    const yearsToReach = Math.max(0, (firstDate.getTime() - ftStart.getTime()) / MS_PER_YEAR)
    const rawScore = lookupBenchmark(bucket, yearsToReach)
    const weight = SLOPE_WEIGHTS[bucket]
    weightedSum += rawScore * weight
    totalWeight += weight
  }
  return Math.round(weightedSum / totalWeight)
}
