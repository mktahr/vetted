// lib/normalize/title-level.ts
//
// Extracts a numeric title level (1-10) from a raw job title string.
//
// Two-phase extraction:
//   1. Dictionary lookup: scan title_level_dictionary in priority order,
//      first match wins (same match_type semantics as seniority_rules).
//   2. Regex fallback: catch explicit numeric/Roman suffixes that the
//      dictionary doesn't need to enumerate (e.g. "Engineer IV", "SDE 3").
//
// Level scale (approximate — patterns calibrate this):
//   1  = intern / student / new grad
//   2  = junior / associate / entry-level
//   3  = mid-level / IC default with no qualifier
//   4  = Engineer II / SDE 2 / mid-level with explicit number
//   5  = Senior / Engineer III / SDE 3
//   6  = Staff / Engineer IV / Lead (technical)
//   7  = Principal / Senior Staff
//   8  = Distinguished / Fellow
//   9  = VP Engineering / SVP (executive-track IC-ish)
//   10 = CTO / Chief Architect
//
// The dictionary holds the canonical patterns. The regex fallback only
// fires for explicit numeric suffixes (I/II/III/IV/V/1/2/3/4/5) that
// aren't worth enumerating per title family.

import { SupabaseClient } from '@supabase/supabase-js'

export interface TitleLevelRule {
  title_level_rule_id: number
  pattern: string
  match_type: string
  title_level: number
  priority: number
}

let cachedRules: TitleLevelRule[] | null = null

export async function loadTitleLevelRules(
  supabase: SupabaseClient,
  forceReload = false,
): Promise<TitleLevelRule[]> {
  if (cachedRules && !forceReload) return cachedRules
  const { data, error } = await supabase
    .from('title_level_dictionary')
    .select('title_level_rule_id, pattern, match_type, title_level, priority')
    .order('priority', { ascending: true })
    .order('title_level_rule_id', { ascending: true })
  if (error) throw new Error(`Failed to load title_level_dictionary: ${error.message}`)
  cachedRules = (data || []) as TitleLevelRule[]
  return cachedRules
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesRule(title: string, rule: TitleLevelRule): boolean {
  const t = title.toLowerCase().trim()
  const p = rule.pattern.toLowerCase()
  switch (rule.match_type) {
    case 'exact': return t === p
    case 'starts_with': return t.startsWith(p)
    case 'ends_with': return t.endsWith(p)
    case 'contains': return t.includes(p)
    case 'contains_word': {
      const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(p)}($|[^a-z0-9])`, 'i')
      return re.test(t)
    }
    case 'regex': {
      try { return new RegExp(rule.pattern, 'i').test(t) } catch { return false }
    }
    default: return false
  }
}

// ─── Regex fallback for explicit numeric suffixes ───────────────────────────
// Catches "SDE 2", "Engineer III", "PM IV", etc. that the dictionary doesn't
// individually list. Maps the suffix to a level offset:
//   I/1 → 3 (entry-IC)
//   II/2 → 4 (mid-IC)
//   III/3 → 5 (senior-IC)
//   IV/4 → 6 (staff-IC)
//   V/5 → 7 (principal-IC)

const NUMERIC_SUFFIX: Array<{ re: RegExp; level: number }> = [
  { re: /\b(?:i|1)$/i, level: 3 },
  { re: /\b(?:ii|2)$/i, level: 4 },
  { re: /\b(?:iii|3)$/i, level: 5 },
  { re: /\b(?:iv|4)$/i, level: 6 },
  { re: /\b(?:v|5)$/i, level: 7 },
]

function numericSuffixLevel(title: string): number | null {
  const t = title.trim()
  for (const { re, level } of NUMERIC_SUFFIX) {
    if (re.test(t)) return level
  }
  return null
}

// Leadership/level signals, highest-first (levels on the 1–10 title_level scale:
// 6=staff/lead, 7=principal/manager, 9=director/VP, 10=C-suite).
const LEADERSHIP_LEVEL: Array<{ re: RegExp; level: number }> = [
  { re: /\bchief \w+ officer\b|\b(ceo|cfo|cto|coo|cmo|cio|ciso|chro|cpo)\b/i, level: 10 },
  { re: /\b(svp|evp)\b|\b(senior|executive) vice president\b/i, level: 9 },
  { re: /\bvice president\b|\bvp\b|\bmanaging director\b/i, level: 9 },
  { re: /\b(senior |associate )?director\b/i, level: 9 },
  { re: /\b(senior |group |sr\.? )?(engineering )?manager\b|\bhead of\b/i, level: 7 },
  { re: /\bprincipal\b|\bdistinguished\b/i, level: 7 },
  { re: /\bstaff\b|\b(tech(nical)? )?lead\b/i, level: 6 },
  { re: /\bsenior\b|\bsr\.?\b/i, level: 5 },
]
function leadershipLevel(title: string): number | null {
  for (const { re, level } of LEADERSHIP_LEVEL) if (re.test(title)) return level
  return null
}

// ─── Main extractor ─────────────────────────────────────────────────────────

export function extractTitleLevel(
  title: string | null | undefined,
  rules: TitleLevelRule[],
): number | null {
  if (!title || !title.trim()) return null
  const t = title.trim()

  // Phase 1: dictionary scan
  for (const rule of rules) {
    if (matchesRule(t, rule)) return rule.title_level
  }

  // Phase 2: numeric suffix fallback
  const num = numericSuffixLevel(t)
  if (num !== null) return num

  // Phase 3: leadership/level fallback for compound titles the dictionary doesn't list
  // (e.g. "Robotics Software Engineering Manager"). Mirrors the seniority title fix — a
  // manager/director/VP title should not read as unleveled (which tanks the progression slope).
  return leadershipLevel(t)
}

/** Convenience: load rules + extract in one call. */
export async function extractTitleLevelFromDB(
  supabase: SupabaseClient,
  title: string | null | undefined,
): Promise<number | null> {
  const rules = await loadTitleLevelRules(supabase)
  return extractTitleLevel(title, rules)
}
