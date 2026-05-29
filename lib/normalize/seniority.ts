// lib/normalize/seniority.ts
//
// Resolve a role's seniority level from its title + context, using the
// seniority_rules table as the source of truth. Called by the ingest
// pipeline for every experience row.
//
// Post-migration-067 enum (active values, ascending rank):
//   intern(1) < junior_ic(2) < individual_contributor(3) < senior_ic(4) <
//   lead_ic(5) < manager(6) < director(7) < vp(8) < c_suite(9) < founder(10)
//
// Deprecated (kept for backward compat): student, lead, entry, executive.
// Founder is NOT in the slope/scoring leveling math — it's tracked as a
// separate role/function axis via is_current_founder / is_former_founder.
//
// Algorithm:
//   1. If employment_type is internship (normalized or raw matches /intern/) → intern
//   2. If role_start_date < person's graduation end_year → intern
//   3. Case-insensitive exact match against seniority_rules (sorted by priority)
//   4. If no rule matches and title is non-empty → individual_contributor
//   5. If title is empty → unknown
//
// "Head of X" titles are AMBIGUOUS and not classified by exact rules — they
// are reclassified by company headcount in compute-derived.ts via
// resolveHeadOfByHeadcount() below. Migration 067 deleted the two old
// exact rules (head of people / head of talent) so the headcount path is
// the sole source of truth for these titles.

import { SupabaseClient } from '@supabase/supabase-js'
import { getFtExperiences, type FtExperience, type FtEducation } from '@/lib/tenure/helpers'

export type SeniorityLevel =
  | 'unknown'
  | 'intern'
  | 'junior_ic'
  | 'individual_contributor'
  | 'senior_ic'
  | 'lead_ic'
  | 'manager'
  | 'director'
  | 'vp'
  | 'c_suite'
  | 'founder'
  // Deprecated but kept for backward compat with old data
  | 'executive'
  | 'student'
  | 'lead'
  | 'entry'  // renamed to junior_ic in migration 048; type kept so older code paths compile

export interface SeniorityRule {
  rule_id: number
  title_pattern: string
  seniority_level: SeniorityLevel
  function_hint: string | null
  priority: number
  active: boolean
}

// Noise suffixes to strip before retrying the lookup — same patterns
// used by titles.ts for title_dictionary matching.
const NOISE_SUFFIX_PATTERNS = [
  /\s*\(.*?\)\s*$/,          // (Remote), (Contract), (Part-Time)
  /\s*-\s*(remote|contract|freelance|part[- ]time|intern|interim)$/i,
  /\s*[–—]\s*.+$/,           // – Division Name, — Team (em/en dash)
  /\s*@\s*.+$/,              // @ Company Name
  /\s*[|\/]\s*.+$/,          // | Division or / Team
  /,\s*.+$/,                 // , Something
]

// Process-level cache — rules are stable across a process's lifetime.
let cachedRules: SeniorityRule[] | null = null
// Fast lookup map built from the rule list (case-insensitive exact match).
let ruleMap: Map<string, SeniorityLevel> | null = null

/** Fetch rules once per process. Pass `forceReload=true` after editing the table. */
export async function loadSeniorityRules(
  supabase: SupabaseClient,
  forceReload = false,
): Promise<SeniorityRule[]> {
  if (cachedRules && !forceReload) return cachedRules
  const { data, error } = await supabase
    .from('seniority_rules')
    .select('rule_id, title_pattern, seniority_level, function_hint, priority, active')
    .eq('active', true)
    .order('priority', { ascending: true })
    .order('rule_id', { ascending: true })
  if (error) throw new Error(`Failed to load seniority_rules: ${error.message}`)
  cachedRules = (data || []) as SeniorityRule[]
  // Build a Map for O(1) exact lookup. First rule per pattern wins (lowest priority).
  ruleMap = new Map()
  for (const rule of cachedRules) {
    const key = rule.title_pattern.toLowerCase().trim()
    if (!ruleMap.has(key)) ruleMap.set(key, rule.seniority_level)
  }
  return cachedRules
}

export interface SeniorityContext {
  title?: string | null
  employment_type?: string | null   // normalized enum value or raw string
  role_start_date?: string | null   // ISO YYYY-MM-DD
  person_graduation_date?: Date | null
}

/**
 * Resolve a seniority level for a role.
 *
 * - rules: pre-loaded via loadSeniorityRules (pass in to avoid N+1 queries
 *   when processing many experiences in a single ingest). The rules
 *   parameter is kept for API compat but the actual lookup uses the
 *   process-level ruleMap for O(1) matching.
 */
export function resolveSeniorityFromRules(
  ctx: SeniorityContext,
  _rules: SeniorityRule[],
): SeniorityLevel {
  // 1. Internship override (employment_type OR raw string match)
  const emp = (ctx.employment_type || '').toLowerCase().trim()
  if (emp === 'internship' || /intern|co-?op/.test(emp)) return 'intern'

  // 2. Pre-graduation override — only fire when the role starts in a year
  //    STRICTLY BEFORE the graduation year. Roles starting in the
  //    graduation year (e.g. June new-grad start) are post-graduation.
  if (ctx.role_start_date && ctx.person_graduation_date) {
    const startYear = new Date(ctx.role_start_date).getFullYear()
    const gradYear = ctx.person_graduation_date.getFullYear()
    if (!isNaN(startYear) && startYear < gradYear) {
      return 'intern'
    }
  }

  const title = (ctx.title || '').trim()
  if (!title) return 'unknown'

  // 3. Exact case-insensitive lookup against the rule map
  const normalized = title.toLowerCase().replace(/\s+/g, ' ')
  if (ruleMap) {
    const hit = ruleMap.get(normalized)
    if (hit) return hit

    // 3b. Strip noise suffixes and retry — same patterns as titles.ts.
    // Handles "Senior Staff Software Engineer – Investment Group Technologies",
    // "Product Manager (Remote)", "Engineer - Contract", etc.
    let stripped = normalized
    for (const pattern of NOISE_SUFFIX_PATTERNS) {
      stripped = stripped.replace(pattern, '').trim()
    }
    if (stripped !== normalized && stripped.length > 0) {
      const hit2 = ruleMap.get(stripped)
      if (hit2) return hit2
    }
  }

  // 4. Fallback: we have a title but nothing matched → IC
  return 'individual_contributor'
}

// ─── Description-based seniority scan ───────────────────────────────────────
//
// When the title resolves to individual_contributor or unknown, scan
// description_raw for seniority-indicating keywords. Word-boundary matching
// only — "senior" matches but "seniority" does not.

export interface SeniorityResult {
  level: SeniorityLevel
  source: 'title' | 'description' | 'internship_override' | 'pre_graduation_override' | 'fallback'
}

// Ordered by rank (highest first) so the scan returns the highest match.
// Ranks match seniority_dictionary.rank_order post-migration 067.
const DESCRIPTION_SENIORITY_SIGNALS: Array<{ pattern: RegExp; level: SeniorityLevel; rank: number }> = [
  { pattern: /\bchief \w+ officer\b/i, level: 'c_suite', rank: 9 },
  { pattern: /\b(ceo|cfo|cto|coo|cmo|cro|ciso|chro|cpo|cio)\b/i, level: 'c_suite', rank: 9 },
  { pattern: /\b(svp|evp)\b/i, level: 'vp', rank: 8 },
  { pattern: /\b(senior|executive) vice president\b/i, level: 'vp', rank: 8 },
  { pattern: /\bvice president\b/i, level: 'vp', rank: 8 },
  { pattern: /\bvp\b/i, level: 'vp', rank: 8 },
  { pattern: /\bmanaging director\b/i, level: 'vp', rank: 8 },
  { pattern: /\b(senior |associate )?director\b/i, level: 'director', rank: 7 },
  { pattern: /\bengineering manager\b/i, level: 'manager', rank: 6 },
  { pattern: /\bmanager\b/i, level: 'manager', rank: 6 },
  { pattern: /\bfounder\b/i, level: 'founder', rank: 10 },
  { pattern: /\bco-founder\b/i, level: 'founder', rank: 10 },
  { pattern: /\bprincipal\b/i, level: 'lead_ic', rank: 5 },
  { pattern: /\bstaff\b/i, level: 'lead_ic', rank: 5 },
  { pattern: /\btech lead\b/i, level: 'lead_ic', rank: 5 },
  { pattern: /\btechnical lead\b/i, level: 'lead_ic', rank: 5 },
  { pattern: /\blead\b/i, level: 'lead_ic', rank: 5 },
  { pattern: /\bsenior\b/i, level: 'senior_ic', rank: 4 },
  { pattern: /\bsr\.\b/i, level: 'senior_ic', rank: 4 },
  { pattern: /\bjunior\b/i, level: 'junior_ic', rank: 2 },
  { pattern: /\bjr\.\b/i, level: 'junior_ic', rank: 2 },
  { pattern: /\bassociate\b/i, level: 'junior_ic', rank: 2 },
  { pattern: /\bnew grad\b/i, level: 'junior_ic', rank: 2 },
  { pattern: /\binternship\b/i, level: 'intern', rank: 1 },
  { pattern: /\bintern\b/i, level: 'intern', rank: 1 },
]

export function scanDescriptionForSeniority(
  descriptionRaw: string | null | undefined,
): SeniorityLevel | null {
  if (!descriptionRaw || descriptionRaw.trim().length < 10) return null

  let bestLevel: SeniorityLevel | null = null
  let bestRank = 0

  for (const { pattern, level, rank } of DESCRIPTION_SENIORITY_SIGNALS) {
    if (pattern.test(descriptionRaw)) {
      if (rank > bestRank) {
        bestRank = rank
        bestLevel = level
      }
    }
  }

  return bestLevel
}

// Seniority levels where a description scan should NOT override.
// If the title already gave a specific signal, trust it.
const TITLE_IS_AUTHORITATIVE = new Set<SeniorityLevel>([
  'intern', 'junior_ic', 'senior_ic', 'lead_ic', 'founder', 'manager',
  'director', 'vp', 'c_suite',
  'executive',  // legacy — kept so any stored row still resolves authoritatively
])

/**
 * Resolve seniority from title + optional description scan.
 * Returns both the resolved level and the source of the resolution.
 */
export function resolveSeniorityWithDescription(
  ctx: SeniorityContext & { description_raw?: string | null },
  _rules: SeniorityRule[],
): SeniorityResult {
  // 1. Internship override
  const emp = (ctx.employment_type || '').toLowerCase().trim()
  if (emp === 'internship' || /intern|co-?op/.test(emp)) {
    return { level: 'intern', source: 'internship_override' }
  }

  // 2. Pre-graduation override — year comparison only (see resolveSeniorityFromRules)
  if (ctx.role_start_date && ctx.person_graduation_date) {
    const startYear = new Date(ctx.role_start_date).getFullYear()
    const gradYear = ctx.person_graduation_date.getFullYear()
    if (!isNaN(startYear) && startYear < gradYear) {
      return { level: 'intern', source: 'pre_graduation_override' }
    }
  }

  const title = (ctx.title || '').trim()
  if (!title) {
    // No title — try description as last resort
    const descLevel = scanDescriptionForSeniority(ctx.description_raw)
    if (descLevel) return { level: descLevel, source: 'description' }
    return { level: 'unknown', source: 'fallback' }
  }

  // 3. Title-based resolution (same as resolveSeniorityFromRules)
  const normalized = title.toLowerCase().replace(/\s+/g, ' ')
  let titleLevel: SeniorityLevel | null = null

  if (ruleMap) {
    titleLevel = ruleMap.get(normalized) ?? null
    if (!titleLevel) {
      let stripped = normalized
      for (const pattern of NOISE_SUFFIX_PATTERNS) {
        stripped = stripped.replace(pattern, '').trim()
      }
      if (stripped !== normalized && stripped.length > 0) {
        titleLevel = ruleMap.get(stripped) ?? null
      }
    }
  }

  // If title gave a specific (non-IC) answer, trust it — title wins
  if (titleLevel && TITLE_IS_AUTHORITATIVE.has(titleLevel)) {
    return { level: titleLevel, source: 'title' }
  }

  // 4. Title was IC or no match — try description scan
  const descLevel = scanDescriptionForSeniority(ctx.description_raw)
  if (descLevel) {
    return { level: descLevel, source: 'description' }
  }

  // 5. Fallback to title result or IC
  if (titleLevel) return { level: titleLevel, source: 'title' }
  return { level: 'individual_contributor', source: 'fallback' }
}

/** Convenience: load rules and resolve in one call. */
export async function resolveSeniority(
  supabase: SupabaseClient,
  ctx: SeniorityContext,
): Promise<SeniorityLevel> {
  const rules = await loadSeniorityRules(supabase)
  return resolveSeniorityFromRules(ctx, rules)
}

// ─── Head Of headcount-based resolver ──────────────────────────────────────
//
// "Head of X" titles are ambiguous in isolation — Head of Engineering at a
// 30-person startup is a founding IC; Head of Engineering at a 5000-person
// company is a VP-equivalent. Title-based exact rules can't capture this,
// so we route ambiguous "head of X" titles through this headcount-based
// classifier.
//
// TIME-AWARE — the headcount used depends on whether the role is current:
//   • current (is_current=true)  → use the company's LATEST headcount.
//     Person is still in the seat; they level against today's company size.
//     A candidate hired as Head of Eng at 40 people who's still in the role
//     while the company grew to 500 must re-level upward on the next rescore.
//   • past (is_current=false)    → use the headcount AT end_date from the
//     company's headcount_timeseries. Person operated at that scope and
//     left; later company growth does NOT retroactively promote their level.
//
// Bucketing (per locked spec):
//   ≤50        → lead_ic   (founding-IC running a function, usually no real team)
//   51–250     → manager   (real people-manager, org not yet big enough for director layer)
//   251–1000   → director  (structured org, director-of-function layer)
//   >1000      → vp        (function head = VP-equivalent owning a whole org)
//   unknown    → lead_ic   (default; ambiguous Head-of skews IC by convention)
//
// IMPORTANT: this function ONLY classifies the per-experience seniority for
// the ambiguous "Head of X" role. It does NOT touch highest_seniority_reached
// — that's still derived by max-rank across all experiences (see
// compute-derived.ts). A candidate who was previously a Director at a 2000-
// person company and is currently "Head of X" at a 40-person startup gets
// the current role classed as lead_ic, but highest_seniority_reached stays
// at director (the max rank across all experiences).
//
// IDEMPOTENT — same inputs always produce the same output. title_raw is the
// immutable source; seniority_normalized is fully derived and re-derives on
// each rescore. Self-corrects as headcount data lands.
export function resolveHeadOfByHeadcount(headcount: number | null | undefined): SeniorityLevel {
  if (headcount == null) return 'lead_ic'
  if (headcount <= 50)   return 'lead_ic'
  if (headcount <= 250)  return 'manager'
  if (headcount <= 1000) return 'director'
  return 'vp'
}

/** True if the title is an ambiguous "Head of X" — owned by the headcount classifier. */
export function isAmbiguousHeadOfTitle(title: string | null | undefined): boolean {
  if (!title) return false
  return /\bhead of\b/i.test(title)
}

/**
 * Find a company's headcount AT or BEFORE a given role end_date by scanning a
 * stored headcount_timeseries (JSONB array of `{ date, count }` from Crust enrich,
 * shape defined by lib/companies/firmographics.ts::HeadcountPoint).
 *
 * Returns the count from the latest timeseries point whose date <= endDate.
 *
 * Returns null when:
 *   • timeseries is null / undefined / empty (no data ever loaded)
 *   • endDate is null (open-ended role; caller should not call this for is_current=true)
 *   • all timeseries points are AFTER endDate (role ended before data starts)
 *
 * IMPORTANT: when this returns null for a past role, the caller must NOT fall
 * back to headcount_latest. That would retroactively promote past roles to
 * today's company size — exactly the bug this time-aware logic exists to
 * avoid. Null → resolveHeadOfByHeadcount(null) → lead_ic default per spec.
 *
 * Date comparison uses ISO string lexicographic order (YYYY-MM-DD), which is
 * equivalent to chronological order for that format.
 */
export function headcountAtRoleEnd(
  timeseries: Array<{ date: string; count: number }> | null | undefined,
  endDate: string | null | undefined,
): number | null {
  if (!Array.isArray(timeseries) || timeseries.length === 0) return null
  if (!endDate || typeof endDate !== 'string') return null
  let best: { date: string; count: number } | null = null
  for (const p of timeseries) {
    if (!p || typeof p.date !== 'string' || typeof p.count !== 'number') continue
    if (p.date <= endDate && (best === null || p.date > best.date)) {
      best = p
    }
  }
  return best ? best.count : null
}

// ─── Display label map ─────────────────────────────────────────────────────
//
// Default UI rendering uses .replace(/_/g, ' ') which produces "c suite" /
// "lead ic" / "junior ic" — readable but unloved. This map gives proper
// recruiter-facing labels. Applied at the four render sites:
//   • app/components/ProfileTable.tsx (sidebar seniority chip)
//   • app/components/ProfileDrawer.tsx (drawer metadata)
//   • app/profile/[id]/page.tsx (profile detail metadata)
//   • app/search-builder/page.tsx (search-builder seniority chip)
//
// Falls back to underscore-replace for any value not in the map (covers
// 'unknown', deprecated values, future additions).
export const SENIORITY_LABEL_MAP: Record<string, string> = {
  intern: 'Intern',
  junior_ic: 'Junior IC',
  individual_contributor: 'IC',
  senior_ic: 'Senior IC',
  lead_ic: 'Lead IC',
  manager: 'Manager',
  director: 'Director',
  vp: 'VP',
  c_suite: 'CXO',
  founder: 'Founder',
  // Legacy / deprecated — still renders cleanly if encountered
  executive: 'Executive',
  lead: 'Lead',
  student: 'Student',
  entry: 'Junior IC',
  unknown: 'Unknown',
}

/** Render a seniority value for the UI. Falls back to underscore-replace for unknown values. */
export function formatSeniorityLabel(value: string | null | undefined): string {
  if (!value) return ''
  return SENIORITY_LABEL_MAP[value] ?? value.replace(/_/g, ' ')
}

// ─── Kept for backward compat — these were exported before migration 010 ──

/** @deprecated match_type removed in migration 010. Kept for import compat. */
export type SeniorityMatchType =
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'exact'
  | 'regex'
  | 'contains_word'

/** @deprecated Use ruleMap-based resolution. Kept for import compat. */
export function matchesRule(_rawTitle: string, _rule: SeniorityRule): boolean {
  // Post-migration-010, all matching is exact via ruleMap. This function
  // is kept as a stub so callers that imported it don't break at compile time.
  return false
}

/**
 * Helper: derive a person's graduation date from their education entries.
 *
 * Returns the EARLIEST post-secondary end_year as a Date (June 1 of that
 * year). Rationale:
 *
 *   LATEST end_year breaks on people who later pick up an MBA or
 *   executive-ed program — it would flag their entire pre-MBA career as
 *   "intern" and inflate the student-role filter.
 *
 *   EARLIEST end_year across ALL education breaks on people who have a
 *   high-school entry in their LinkedIn. We'd anchor graduation to high
 *   school (age ~18) and count their undergrad years of internships and
 *   student jobs as "real experience".
 *
 * So we exclude high school, certificate, and coursework entries and take
 * the earliest end_year among the remaining (bachelor / master / MBA / PhD
 * / JD / MD / associate).
 *
 * Falls back to the overall earliest end_year if no post-secondary entry
 * qualifies (e.g. a person whose only listed education IS high school).
 * Returns null if no education has an end_year.
 */
export function graduationDateFromEducation(
  education: Array<{
    end_year?: number | null
    degree?: string | null
    degree_raw?: string | null
    degree_level?: string | null
  }>,
): Date | null {
  // Anchor at the earliest COMPLETED bachelor+ degree. Earliest (not latest)
  // so pre-MBA pro experience for returners still counts. Completed-only so
  // a returnship/part-time degree-completer with end_year in the future
  // doesn't anchor the future and zero everything out — they fall through
  // to the existing fallback below.
  const nowYear = new Date().getFullYear()

  let earliestBachelorPlus: number | null = null
  for (const edu of education) {
    if (!edu.end_year) continue
    if (!isBachelorOrHigher(edu)) continue
    if (edu.end_year > nowYear) continue
    if (earliestBachelorPlus === null || edu.end_year < earliestBachelorPlus) {
      earliestBachelorPlus = edu.end_year
    }
  }
  // Use June 1 (not Dec 31) — most graduates start their first job in
  // summer of their graduation year. Dec 31 caused roles starting in
  // June/July of the grad year to be flagged as pre-graduation.
  if (earliestBachelorPlus !== null) return new Date(earliestBachelorPlus, 5, 1)

  // Fallback: no completed bachelor+. Use earliest non-HS overall so we
  // don't regress non-degreed profiles or returners still finishing their
  // first bachelor's (Associate degrees and unflagged community college
  // entries can anchor here — better than nothing).
  const isHighSchoolOrLower = (e: { degree?: string | null; degree_raw?: string | null; degree_level?: string | null }) => {
    const lvl = (e.degree_level || '').toLowerCase()
    if (lvl === 'high_school' || lvl === 'certificate' || lvl === 'coursework') return true
    const name = ((e.degree || e.degree_raw) || '').toLowerCase()
    return /high school|secondary school|\bged\b/.test(name)
  }
  let earliestNonHs: number | null = null
  for (const edu of education) {
    if (!edu.end_year) continue
    if (isHighSchoolOrLower(edu)) continue
    if (earliestNonHs === null || edu.end_year < earliestNonHs) earliestNonHs = edu.end_year
  }
  if (earliestNonHs !== null) return new Date(earliestNonHs, 5, 1)

  // Final fallback: earliest end_year overall (HS-only profiles).
  let earliestOverall: number | null = null
  for (const edu of education) {
    if (!edu.end_year) continue
    if (earliestOverall === null || edu.end_year < earliestOverall) earliestOverall = edu.end_year
  }
  return earliestOverall !== null ? new Date(earliestOverall, 5, 1) : null
}

function isBachelorOrHigher(edu: {
  degree?: string | null
  degree_raw?: string | null
  degree_level?: string | null
}): boolean {
  const lvl = (edu.degree_level || '').toLowerCase()
  if (['bachelor', 'master', 'phd', 'doctorate', 'jd', 'md', 'mba'].includes(lvl)) return true
  const name = ((edu.degree || edu.degree_raw) || '').toLowerCase()
  return /\b(bachelor|b\.?s\.?|b\.?a\.?|b\.?eng|master|m\.?s\.?|m\.?a\.?|m\.?eng|mba|phd|ph\.?d|doctorate|doctoral|md|jd)\b/.test(name)
}

// ─── Years-of-experience helpers ────────────────────────────────────────────

/** Title is explicitly a student identity — always filter from years calc. */
export function isExplicitStudentTitle(title: string | null | undefined): boolean {
  if (!title) return false
  return /\b(student|undergrad|undergraduate|doctoral candidate|phd candidate|m\.?s\.? candidate|m\.?a\.? candidate|masters? candidate)\b/i.test(title)
}

/**
 * Title is an assistantship-style role (RA / TA / grad assistant). These can
 * be legit pro experience post-grad (e.g. research assistant at a lab) OR
 * school-tied work. Caller must check overlap with education to disambiguate.
 */
export function isAssistantshipTitle(title: string | null | undefined): boolean {
  if (!title) return false
  return /\b(graduate assistant|grad assistant|teaching assistant|research assistant|graduate research assistant|graduate teaching assistant)\b/i.test(title)
}

/** True if the role's date range intersects any education entry's start/end years. */
export function roleOverlapsEducation(
  role: { start_date?: string | null; end_date?: string | null; is_current?: boolean | null },
  education: Array<{ start_year?: number | null; end_year?: number | null }>,
): boolean {
  if (!role.start_date) return false
  const roleStart = new Date(role.start_date).getFullYear()
  if (isNaN(roleStart)) return false
  const roleEnd = role.is_current
    ? new Date().getFullYear()
    : (role.end_date ? new Date(role.end_date).getFullYear() : roleStart)
  for (const edu of education) {
    if (!edu.start_year || !edu.end_year) continue
    if (roleStart <= edu.end_year && roleEnd >= edu.start_year) return true
  }
  return false
}

/**
 * Years-of-experience estimate: years from earliest qualifying post-grad
 * role start to today. "Qualifying" excludes interns, students, school-
 * concurrent assistantships, and pre-graduation roles.
 *
 * Returns a decimal (one place) for compatibility with the prior backfill
 * format. Pass server-side data shape (snake_case fields).
 */
export function computeYearsExperienceEstimate(
  experiences: Array<{
    company_id?: string | null
    title_raw?: string | null
    start_date?: string | null
    end_date?: string | null
    is_current?: boolean | null
    seniority_normalized?: string | null
    employment_type_normalized?: string | null
  }>,
  education: Array<{
    start_year?: number | null
    end_year?: number | null
    degree?: string | null
    degree_raw?: string | null
    degree_level?: string | null
  }>,
): number | null {
  // Use the unified FT helper for consistent classification across YOE and tenure.
  // Map server-side field names to the helper's generic interface.
  const ftExps: FtExperience[] = experiences.map(e => ({
    company_id: (e as any).company_id ?? null,
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
  const qualifying = getFtExperiences(ftExps, eduMapped, 'yoe')

  let earliest: Date | null = null
  for (const e of qualifying) {
    if (!e.start_date) continue
    const start = new Date(e.start_date)
    if (isNaN(start.getTime())) continue
    if (earliest === null || start < earliest) earliest = start
  }
  if (earliest === null) return null
  const years = (Date.now() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  return Math.max(0, Math.round(years * 10) / 10)
}
