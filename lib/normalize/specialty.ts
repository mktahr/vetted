// lib/normalize/specialty.ts
//
// Resolves specialty_normalized for an experience using the comprehensive
// specialty_dictionary (migration 011). Three-pass matching:
//
//   1. Title match: exact case-insensitive lookup against title_patterns[]
//   2. Description match: scan description_raw for keyword_signals[]
//   3. Technology match: scan skills_tags for technology_signals[]
//
// Returns the specialty with the strongest signal. Pre-loads the dictionary
// into Maps at startup for O(1) title lookup and efficient signal scanning.
//
// Also provides person-level aggregation with recency weighting:
//   current role: 3x, previous role: 2x, older roles: 1x each.

import { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SpecialtyDictionaryEntry {
  specialty_normalized: string
  function_normalized: string | null
  title_patterns: string[]
  keyword_signals: string[]
  technology_signals: string[]
}

export interface SpecialtyMatch {
  specialty_normalized: string
  function_normalized: string | null
  match_source: 'title' | 'keyword' | 'technology' | 'title_dictionary_fallback'
  signal_count: number
}

export interface PersonSpecialties {
  primary_specialty: string | null
  secondary_specialty: string | null
  historical_specialty: string | null
  specialty_transition_flag: boolean
}

// ─── Process-level cache ────────────────────────────────────────────────────

let cachedEntries: SpecialtyDictionaryEntry[] | null = null
// Map<lowercased_title_pattern, specialty_normalized>
let titleMap: Map<string, { specialty: string; function_norm: string | null }> | null = null

export async function loadSpecialtyDictionary(
  supabase: SupabaseClient,
  forceReload = false,
): Promise<SpecialtyDictionaryEntry[]> {
  if (cachedEntries && !forceReload) return cachedEntries

  const { data, error } = await supabase
    .from('specialty_dictionary')
    .select('specialty_normalized, function_normalized, title_patterns, keyword_signals, technology_signals')
    .eq('active', true)

  if (error) throw new Error(`Failed to load specialty_dictionary: ${error.message}`)
  cachedEntries = (data || []) as SpecialtyDictionaryEntry[]

  // Build title→specialty map for O(1) lookup
  titleMap = new Map()
  for (const entry of cachedEntries) {
    if (!entry.title_patterns) continue
    for (const pattern of entry.title_patterns) {
      const key = pattern.toLowerCase().trim()
      if (!titleMap.has(key)) {
        titleMap.set(key, {
          specialty: entry.specialty_normalized,
          function_norm: entry.function_normalized,
        })
      }
    }
  }

  return cachedEntries
}

// ─── Noise stripping (same as seniority.ts) ─────────────────────────────────

const NOISE_SUFFIX_PATTERNS = [
  /\s*\(.*?\)\s*$/,
  /\s*-\s*(remote|contract|freelance|part[- ]time|intern|interim)$/i,
  /\s*[–—]\s*.+$/,
  /\s*@\s*.+$/,
  /\s*[|\/]\s*.+$/,
  /,\s*.+$/,
]

const SENIORITY_PREFIXES = [
  'staff ', 'principal ', 'senior ', 'lead ', 'junior ', 'associate ',
  'senior staff ', 'distinguished ',
]

// Patterns that split on separators — the part AFTER the separator may
// contain specialty signals (e.g. "Senior SWE | Machine Learning").
const SEPARATOR_PATTERNS = [
  /\s*[|\/]\s*/,     // | or /
  /\s*[–—]\s*/,      // em/en dash
  /,\s*/,            // comma
]

function stripTitle(raw: string): string[] {
  const normalized = raw.toLowerCase().trim().replace(/\s+/g, ' ')
  const variants = [normalized]

  // Extract parts from separator-delimited titles BEFORE stripping noise.
  // "Senior Software Engineer | Machine Learning" → try "machine learning" too.
  for (const sep of SEPARATOR_PATTERNS) {
    if (sep.test(normalized)) {
      const parts = normalized.split(sep).map(p => p.trim()).filter(p => p.length > 0)
      for (const part of parts) {
        if (part !== normalized) variants.push(part)
      }
    }
  }

  // Strip noise suffixes (parentheses, @, etc.)
  let stripped = normalized
  for (const pattern of NOISE_SUFFIX_PATTERNS) {
    stripped = stripped.replace(pattern, '').trim()
  }
  if (stripped !== normalized && stripped.length > 0) {
    variants.push(stripped)
  }

  // Strip seniority prefixes from all forms collected so far
  const bases = [...variants]
  for (const prefix of SENIORITY_PREFIXES) {
    for (const v of bases) {
      if (v.startsWith(prefix)) {
        const base = v.slice(prefix.length).trim()
        if (base.length > 0) variants.push(base)
      }
    }
  }

  return Array.from(new Set(variants))
}

// ─── Per-experience resolver ────────────────────────────────────────────────

export function resolveSpecialty(
  title: string | null | undefined,
  descriptionRaw: string | null | undefined,
  skillsTags: string[] | null | undefined,
  _entries: SpecialtyDictionaryEntry[],
): SpecialtyMatch | null {
  if (!titleMap || !cachedEntries) return null

  // Pass 1: title match against title_patterns
  if (title) {
    const variants = stripTitle(title)
    for (const variant of variants) {
      const hit = titleMap.get(variant)
      if (hit) {
        return {
          specialty_normalized: hit.specialty,
          function_normalized: hit.function_norm,
          match_source: 'title',
          signal_count: 1,
        }
      }
    }

    // Pass 1b: separator-extracted fragments that didn't match as full titles
    // may still be keyword signals (e.g. "Machine Learning" from
    // "Senior SWE | Machine Learning"). Scan fragments against keyword_signals.
    for (const variant of variants) {
      for (const entry of cachedEntries) {
        if (!entry.keyword_signals?.length) continue
        for (const kw of entry.keyword_signals) {
          if (variant === kw.toLowerCase()) {
            return {
              specialty_normalized: entry.specialty_normalized,
              function_normalized: entry.function_normalized,
              match_source: 'title',
              signal_count: 1,
            }
          }
        }
      }
    }
  }

  // Pass 2: keyword signals against description_raw
  if (descriptionRaw) {
    const descLower = descriptionRaw.toLowerCase()
    let bestMatch: SpecialtyMatch | null = null

    for (const entry of cachedEntries) {
      if (!entry.keyword_signals?.length) continue
      let count = 0
      for (const kw of entry.keyword_signals) {
        if (descLower.includes(kw.toLowerCase())) count++
      }
      if (count > 0 && (!bestMatch || count > bestMatch.signal_count)) {
        bestMatch = {
          specialty_normalized: entry.specialty_normalized,
          function_normalized: entry.function_normalized,
          match_source: 'keyword',
          signal_count: count,
        }
      }
    }

    // Require at least 2 keyword matches to avoid false positives
    if (bestMatch && bestMatch.signal_count >= 2) return bestMatch
  }

  // Pass 3: technology signals against skills_tags
  if (skillsTags && skillsTags.length > 0) {
    const skillsLower = new Set(skillsTags.map(s => s.toLowerCase().trim()))
    let bestMatch: SpecialtyMatch | null = null

    for (const entry of cachedEntries) {
      if (!entry.technology_signals?.length) continue
      let count = 0
      for (const tech of entry.technology_signals) {
        if (skillsLower.has(tech.toLowerCase())) count++
      }
      if (count > 0 && (!bestMatch || count > bestMatch.signal_count)) {
        bestMatch = {
          specialty_normalized: entry.specialty_normalized,
          function_normalized: entry.function_normalized,
          match_source: 'technology',
          signal_count: count,
        }
      }
    }

    // Require at least 2 tech matches
    if (bestMatch && bestMatch.signal_count >= 2) return bestMatch
  }

  return null
}

// ─── Person-level aggregation ───────────────────────────────────────────────
//
// Weights: current role 3x, previous role 2x, older roles 1x.
// Experiences should be ordered most-recent first.

// Specialties in the same "track" — transitioning between these is NOT a
// meaningful career transition. Cross-track IS.
const SAME_TRACK: Record<string, string> = {
  backend: 'engineering',
  frontend: 'engineering',
  fullstack: 'engineering',
  mobile_ios: 'engineering',
  mobile_android: 'engineering',
  ml_engineering: 'engineering',
  ai_research: 'engineering',
  data_engineering: 'engineering',
  devops: 'engineering',
  sre: 'engineering',
  infrastructure: 'engineering',
  security: 'engineering',
  embedded: 'engineering',
  platform: 'engineering',
  devrel: 'engineering',
  qa_testing: 'engineering',
  blockchain: 'engineering',
  computer_vision: 'engineering',
  nlp: 'engineering',
  robotics: 'engineering',
  game_engineering: 'engineering',
  core_pm: 'product_management',
  technical_pm: 'product_management',
  growth_pm: 'product_management',
  data_pm: 'product_management',
  consumer_pm: 'product_management',
  enterprise_pm: 'product_management',
  ux_design: 'product_design',
  ui_design: 'product_design',
  product_design: 'product_design',
  motion_design: 'product_design',
  brand_design: 'product_design',
  ux_research: 'product_design',
  design_systems: 'product_design',
  biz_ops: 'operations',
  rev_ops: 'operations',
  growth: 'operations',
  strategy: 'operations',
  finance_ops: 'operations',
  data_analytics: 'operations',
  tech_recruiting: 'recruiting',
  gna_recruiting: 'recruiting',
  executive_search: 'recruiting',
  sourcing: 'recruiting',
  university_recruiting: 'recruiting',
  people_ops: 'recruiting',
  hrbp: 'recruiting',
  comp_benefits: 'recruiting',
  talent_ops: 'recruiting',
}

export function aggregatePersonSpecialties(
  experiences: Array<{
    specialty_normalized: string | null
    is_current: boolean
    employment_type_normalized: string | null
    title_raw: string | null
  }>,
): PersonSpecialties {
  const result: PersonSpecialties = {
    primary_specialty: null,
    secondary_specialty: null,
    historical_specialty: null,
    specialty_transition_flag: false,
  }

  // Filter to non-internship roles with a specialty
  const eligible = experiences.filter(e =>
    e.specialty_normalized &&
    e.employment_type_normalized !== 'internship' &&
    !/\bintern\b|\binternship\b|\bco-?op\b/i.test(e.title_raw || '')
  )

  if (eligible.length === 0) return result

  // Primary = most recent role's specialty (experiences are most-recent-first)
  result.primary_specialty = eligible[0].specialty_normalized

  // Weighted counts for secondary/historical calculation
  // Experiences are most-recent first: [0]=current, [1]=previous, [2+]=older
  const weightedCounts: Record<string, number> = {}
  for (let i = 0; i < eligible.length; i++) {
    const spec = eligible[i].specialty_normalized!
    const weight = i === 0 ? 3 : i === 1 ? 2 : 1
    weightedCounts[spec] = (weightedCounts[spec] || 0) + weight
  }

  // Sort specialties by weighted count descending
  const sorted = Object.entries(weightedCounts)
    .sort(([, a], [, b]) => b - a)

  // Secondary: second-highest weighted specialty if different from primary
  if (sorted.length >= 2 && sorted[1][0] !== result.primary_specialty) {
    result.secondary_specialty = sorted[1][0]
  }

  // Historical: dominant specialty from roles EXCLUDING current
  const olderCounts: Record<string, number> = {}
  for (let i = 1; i < eligible.length; i++) {
    const spec = eligible[i].specialty_normalized!
    olderCounts[spec] = (olderCounts[spec] || 0) + 1
  }
  const olderSorted = Object.entries(olderCounts).sort(([, a], [, b]) => b - a)
  if (olderSorted.length > 0) {
    const historicalSpec = olderSorted[0][0]
    if (historicalSpec !== result.primary_specialty) {
      result.historical_specialty = historicalSpec
    }
  }

  // Transition flag: primary and historical are in different function tracks
  if (result.primary_specialty && result.historical_specialty) {
    const primaryTrack = SAME_TRACK[result.primary_specialty] ?? result.primary_specialty
    const historicalTrack = SAME_TRACK[result.historical_specialty] ?? result.historical_specialty
    result.specialty_transition_flag = primaryTrack !== historicalTrack
  }

  return result
}
