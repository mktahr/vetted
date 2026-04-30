// lib/education/display-filter.ts
//
// Filters education entries for display in the drawer, full profile, and list
// view school column. Removes junk (yoga certs, outdoor programs, bootcamps,
// summer programs) while keeping real degrees. Data stays in person_education;
// this is display-only filtering.
//
// Architecture: imports pure data arrays from lib/education/data/. Lazy-init
// the degree-level Set inside a function body. No `new Set()` at module top.

import { DEGREE_LEVEL_ALLOWLIST, DEGREE_ALLOWLIST_PATTERNS } from './data/degree-allowlist'
import { SCHOOL_BLOCKLIST_PATTERNS, DEGREE_BLOCKLIST_PATTERNS } from './data/blocklist-patterns'
import { INCUBATOR_PATTERNS } from './data/incubator-patterns'

let _degreeLevelSet: Set<string> | null = null
function getDegreeLevelSet(): Set<string> {
  if (_degreeLevelSet === null) _degreeLevelSet = new Set(DEGREE_LEVEL_ALLOWLIST)
  return _degreeLevelSet
}

function hasDegree(degreeRaw: string | null, degreeLevel: string | null): boolean {
  if (degreeLevel && getDegreeLevelSet().has(degreeLevel.toLowerCase())) return true
  if (degreeRaw && DEGREE_ALLOWLIST_PATTERNS.some(r => r.test(degreeRaw))) return true
  return false
}

function isBlocked(schoolName: string | null, degreeRaw: string | null, degreeLevel: string | null): boolean {
  if (schoolName && SCHOOL_BLOCKLIST_PATTERNS.some(r => r.test(schoolName))) return true
  if (degreeRaw && DEGREE_BLOCKLIST_PATTERNS.some(r => r.test(degreeRaw))) return true
  const level = (degreeLevel || '').toLowerCase()
  if (level === 'certificate' || level === 'coursework') return true
  return false
}

function isIncubator(schoolName: string | null): boolean {
  if (!schoolName) return false
  return INCUBATOR_PATTERNS.some(r => r.test(schoolName))
}

/**
 * Filters education entries for display purposes.
 * Accepts any object with school_name_raw, degree_raw, degree_level, end_year.
 * Returns entries sorted by end_year DESC, deduplicated.
 *
 * Rules in order:
 * 1. Remove blocklisted entries (yoga, NOLS, IDEO, bootcamps, etc.)
 * 2. Remove incubator/accelerator entries
 * 3. Keep only entries with recognized degrees (allowlist); fall back to step-2
 *    survivors if nothing passes
 * 4. Dedupe by school_name_raw + degree_raw
 * 5. Sort by end_year DESC
 */
export function filterEducationForDisplay<T extends {
  school_name_raw: string | null
  degree_raw: string | null
  degree_level: string | null
  end_year: number | null
}>(entries: T[]): T[] {
  let filtered = entries.filter(e => !isBlocked(e.school_name_raw, e.degree_raw, e.degree_level))
  filtered = filtered.filter(e => !isIncubator(e.school_name_raw))

  const withDegree = filtered.filter(e => hasDegree(e.degree_raw, e.degree_level))
  if (withDegree.length > 0) filtered = withDegree

  const seen = new Set<string>()
  filtered = filtered.filter(e => {
    const key = `${(e.school_name_raw || '').toLowerCase()}|${(e.degree_raw || '').toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  filtered.sort((a, b) => (b.end_year ?? 0) - (a.end_year ?? 0))
  return filtered
}
