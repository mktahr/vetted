// lib/education/display-filter.ts
//
// CLIENT-SIDE ONLY — do NOT import from lib/normalize/, lib/scoring/, or
// any server-side route. See CLAUDE.md "Module structure for shared constants".
//
// Filters education entries for display. Removes junk (yoga certs, outdoor
// programs, bootcamps, summer programs) while keeping real degrees.
// Data stays in person_education — this is display-only filtering.

// ─── Degree allowlist ───────────────────────────────────────────────────────

const DEGREE_ALLOWLIST = [
  /\b(bachelor|b\.?s\.?|b\.?a\.?|b\.?eng|bsc|bba|bfa|ab)\b/i,
  /\b(master|m\.?s\.?|m\.?a\.?|m\.?eng|msc|mba|mfa|mpp|llm)\b/i,
  /\b(phd|ph\.?d|doctorate|dphil|scd|edd)\b/i,
  /\b(jd|md|dds|dvm|do)\b/i,
  /\b(associate)\b/i,
  /international baccalaureate|\bib\b|abitur|a-levels?/i,
]

const DEGREE_LEVEL_ALLOWLIST = new Set([
  'bachelor', 'master', 'mba', 'phd', 'jd', 'md', 'associate', 'high_school',
])

function hasDegree(degreeRaw: string | null, degreeLevel: string | null): boolean {
  if (degreeLevel && DEGREE_LEVEL_ALLOWLIST.has(degreeLevel.toLowerCase())) return true
  if (degreeRaw && DEGREE_ALLOWLIST.some(r => r.test(degreeRaw))) return true
  return false
}

// ─── Blocklist ──────────────────────────────────────────────────────────────

const SCHOOL_BLOCKLIST = [
  /\byoga\b|\byogi\b/i,
  /\bnols\b|national outdoor leadership/i,
  /\bwilderness\b.*\bprogram\b/i,
  /\bideo\b/i,
  /\bacumen\b/i,
]

const DEGREE_BLOCKLIST = [
  /\bsummer\s+program\b/i,
  /\bbootcamp\b|\bboot\s+camp\b/i,
  /\bworkshop\b/i,
  /\bshort\s+film\b/i,
  /\boutdoor\b.*\beducation\b/i,
]

function isBlocked(schoolName: string | null, degreeRaw: string | null, degreeLevel: string | null): boolean {
  if (schoolName && SCHOOL_BLOCKLIST.some(r => r.test(schoolName))) return true
  if (degreeRaw && DEGREE_BLOCKLIST.some(r => r.test(degreeRaw))) return true
  const level = (degreeLevel || '').toLowerCase()
  if (level === 'certificate' || level === 'coursework') return true
  return false
}

// ─── Incubator/accelerator patterns ─────────────────────────────────────────

const INCUBATOR_PATTERNS = [
  /singularity university/i,
  /\by\s*combinator\b|\byc\b/i,
  /\btechstars\b/i,
  /\b500\s*(startups|global)\b/i,
  /\bangelpad\b/i,
  /\bmasschallenge\b/i,
  /\bstartup chile\b/i,
]

function isIncubator(schoolName: string | null): boolean {
  if (!schoolName) return false
  return INCUBATOR_PATTERNS.some(r => r.test(schoolName))
}

// ─── Main filter ────────────────────────────────────────────────────────────

export function filterEducationForDisplay<T extends { school_name_raw: string | null; degree_raw: string | null; degree_level: string | null; end_year: number | null }>(entries: T[]): T[] {
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
