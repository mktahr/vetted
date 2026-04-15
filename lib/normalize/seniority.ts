// lib/normalize/seniority.ts
//
// Resolve a role's seniority level from its title + context, using the
// seniority_rules table as the source of truth. Called by the ingest
// pipeline for every experience row.
//
// Algorithm:
//   1. If employment_type is internship (normalized or raw matches /intern/) → student
//   2. If role_start_date < person's graduation end_year → student
//   3. Run title through seniority_rules in ascending priority; first match wins
//   4. If no rule matches and title is non-empty → individual_contributor
//   5. If title is empty → unknown

import { SupabaseClient } from '@supabase/supabase-js'

export type SeniorityLevel =
  | 'unknown'
  | 'student'
  | 'individual_contributor'
  | 'lead'
  | 'manager'
  | 'executive'

export type SeniorityMatchType =
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'exact'
  | 'regex'
  | 'contains_word'

export interface SeniorityRule {
  rule_id: number
  pattern: string
  match_type: SeniorityMatchType
  seniority_normalized: SeniorityLevel
  priority: number
  notes: string | null
}

// Process-level cache so we don't re-fetch the rule set for every experience
// in a bulk ingest. Rules are stable across a process's lifetime.
let cachedRules: SeniorityRule[] | null = null

/** Fetch rules once per process. Pass `forceReload=true` after editing the table. */
export async function loadSeniorityRules(
  supabase: SupabaseClient,
  forceReload = false,
): Promise<SeniorityRule[]> {
  if (cachedRules && !forceReload) return cachedRules
  const { data, error } = await supabase
    .from('seniority_rules')
    .select('rule_id, pattern, match_type, seniority_normalized, priority, notes')
    .order('priority', { ascending: true })
    .order('rule_id', { ascending: true }) // stable tiebreaker
  if (error) throw new Error(`Failed to load seniority_rules: ${error.message}`)
  cachedRules = (data || []) as SeniorityRule[]
  return cachedRules
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** True if the title matches the rule's pattern per match_type semantics. */
export function matchesRule(rawTitle: string, rule: SeniorityRule): boolean {
  const title = rawTitle.toLowerCase().trim()
  const pattern = rule.pattern.toLowerCase()
  switch (rule.match_type) {
    case 'exact':
      return title === pattern
    case 'starts_with':
      return title.startsWith(pattern)
    case 'ends_with':
      return title.endsWith(pattern)
    case 'contains':
      return title.includes(pattern)
    case 'contains_word': {
      // Word-boundary match. \b doesn't treat "-" as a word char, so we
      // manually construct boundaries that work for both "vp" and "co-op".
      const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(pattern)}($|[^a-z0-9])`, 'i')
      return re.test(title)
    }
    case 'regex': {
      try {
        return new RegExp(rule.pattern, 'i').test(title)
      } catch {
        return false
      }
    }
  }
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
 *   when processing many experiences in a single ingest)
 */
export function resolveSeniorityFromRules(
  ctx: SeniorityContext,
  rules: SeniorityRule[],
): SeniorityLevel {
  // 1. Internship override (employment_type OR raw string match)
  const emp = (ctx.employment_type || '').toLowerCase().trim()
  if (emp === 'internship' || /intern|co-?op/.test(emp)) return 'student'

  // 2. Pre-graduation override
  if (ctx.role_start_date && ctx.person_graduation_date) {
    const start = new Date(ctx.role_start_date)
    if (!isNaN(start.getTime()) && start < ctx.person_graduation_date) {
      return 'student'
    }
  }

  const title = (ctx.title || '').trim()
  if (!title) return 'unknown'

  // 3. Scan rules in priority order (already sorted by loadSeniorityRules)
  for (const rule of rules) {
    if (matchesRule(title, rule)) return rule.seniority_normalized
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

/**
 * Helper: derive a person's graduation date from their education entries.
 *
 * Returns the EARLIEST end_year as a Date (Dec 31 of that year). Rationale:
 * the spec's student-override is meant to catch roles held during someone's
 * schooling era (undergrad or earlier). Using the LATEST end_year breaks on
 * people who later pick up an MBA or executive-ed program — it would flag
 * their entire pre-MBA career as "student". Earliest end_year is the
 * conservative proxy for "when they stopped being a full-time student".
 *
 * Returns null if no education has an end_year.
 */
export function graduationDateFromEducation(
  education: Array<{ end_year?: number | null }>,
): Date | null {
  let earliest: number | null = null
  for (const edu of education) {
    if (!edu.end_year) continue
    if (earliest === null || edu.end_year < earliest) earliest = edu.end_year
  }
  if (earliest === null) return null
  return new Date(earliest, 11, 31) // Dec 31 of that year
}
