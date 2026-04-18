// lib/normalize/seniority.ts
//
// Resolve a role's seniority level from its title + context, using the
// seniority_rules table as the source of truth. Called by the ingest
// pipeline for every experience row.
//
// Post-migration-010 enum (9 active values):
//   unknown < intern < entry < individual_contributor < senior_ic <
//   lead_ic < founder < manager < executive
//
// Algorithm:
//   1. If employment_type is internship (normalized or raw matches /intern/) → intern
//   2. If role_start_date < person's graduation end_year → intern
//   3. Case-insensitive exact match against seniority_rules (sorted by priority)
//   4. If no rule matches and title is non-empty → individual_contributor
//   5. If title is empty → unknown

import { SupabaseClient } from '@supabase/supabase-js'

export type SeniorityLevel =
  | 'unknown'
  | 'intern'
  | 'entry'
  | 'individual_contributor'
  | 'senior_ic'
  | 'lead_ic'
  | 'founder'
  | 'manager'
  | 'executive'
  // Deprecated but kept for backward compat with old data
  | 'student'
  | 'lead'

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

  // 2. Pre-graduation override
  if (ctx.role_start_date && ctx.person_graduation_date) {
    const start = new Date(ctx.role_start_date)
    if (!isNaN(start.getTime()) && start < ctx.person_graduation_date) {
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

/** Convenience: load rules and resolve in one call. */
export async function resolveSeniority(
  supabase: SupabaseClient,
  ctx: SeniorityContext,
): Promise<SeniorityLevel> {
  const rules = await loadSeniorityRules(supabase)
  return resolveSeniorityFromRules(ctx, rules)
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
 * Returns the EARLIEST post-secondary end_year as a Date (Dec 31 of that
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
  const isHighSchoolOrLower = (e: { degree?: string | null; degree_raw?: string | null; degree_level?: string | null }) => {
    const lvl = (e.degree_level || '').toLowerCase()
    if (lvl === 'high_school' || lvl === 'certificate' || lvl === 'coursework') return true
    const name = ((e.degree || e.degree_raw) || '').toLowerCase()
    return /high school|secondary school|\bged\b/.test(name)
  }

  let earliestPostSecondary: number | null = null
  for (const edu of education) {
    if (!edu.end_year) continue
    if (isHighSchoolOrLower(edu)) continue
    if (earliestPostSecondary === null || edu.end_year < earliestPostSecondary) {
      earliestPostSecondary = edu.end_year
    }
  }
  if (earliestPostSecondary !== null) return new Date(earliestPostSecondary, 11, 31)

  let earliestOverall: number | null = null
  for (const edu of education) {
    if (!edu.end_year) continue
    if (earliestOverall === null || edu.end_year < earliestOverall) earliestOverall = edu.end_year
  }
  if (earliestOverall === null) return null
  return new Date(earliestOverall, 11, 31)
}
