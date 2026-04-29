// lib/tenure/helpers.ts
//
// Unified full-time classification and company-stretch tenure logic.
//
// Pipeline:
//   Pass 1 — isCountedAsFt(): hard exclusions (intern, student, date rules)
//   Group  — merge Pass-1 survivors by company into contiguous spans
//   Pass 2 — filterSecondaryCompanySpans(): compare company-level spans,
//            exclude secondary concurrent companies (advisor/board/consultant
//            titles lose to real roles; otherwise longest span wins)
//
// computeCompanyTenures() — full pipeline → tenure per company.
// getPrimaryCompanyIds() — full pipeline → set of primary company IDs
//                          (used by YOE to determine which experiences anchor).

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FtExperience {
  company_id: string | null
  company_name?: string | null     // for consulting-firm allowlist + self-employed detection
  title_raw: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  employment_type: string | null   // employment_type_normalized
  seniority: string | null         // seniority_normalized
}

export interface FtEducation {
  start_year: number | null
  end_year: number | null
  degree_raw: string | null
  degree_level: string | null
}

export type FtMode = 'yoe' | 'tenure'

// ─── Title pattern constants ────────────────────────────────────────────────

// "Soft" non-FT patterns — excluded only when overlapping a longer concurrent
// company span. Standalone post-grad consulting/advisory roles count.
// Note: \bconsultant\b is handled separately with a consulting-firms allowlist.
const SOFT_NON_FT_TITLE_PATTERNS = [
  /\badvisor\b/i,
  /\badvisory\b(?!\s+(services|group))/i,
  /\bboard\s+(member|director|observer|of\s+directors)\b/i,
  /\bcontractor\b/i,
  /\bfreelance[r]?\b/i,
]

// Consultant titles are soft-non-FT UNLESS at a known consulting firm.
const CONSULTANT_TITLE_PATTERN = /\bconsultant\b/i

const CONSULTING_FIRMS_ALLOWLIST = new Set([
  'mckinsey', 'mckinsey & company',
  'bain', 'bain & company',
  'boston consulting group', 'bcg',
  'deloitte', 'deloitte consulting',
  'pwc', 'pricewaterhousecoopers',
  'ey', 'ernst & young', 'ernst and young',
  'kpmg',
  'accenture',
  'capgemini', 'cap gemini',
  'booz allen hamilton', 'booz allen',
  'oliver wyman',
  'l.e.k. consulting', 'lek consulting',
  'strategy&', 'strategy and',
  'roland berger',
  'kearney', 'a.t. kearney',
  'zs associates', 'zs',
  'putnam associates',
  'ibm consulting',
  'cognizant',
  'infosys consulting', 'infosys',
  'tata consultancy services', 'tcs',
  'wipro',
])

// Company names that are always treated as self-employed / non-FT.
const SELF_EMPLOYED_COMPANY_NAMES = new Set([
  'freelance', 'freelancer',
  'self-employed', 'self employed', 'self',
  'independent', 'independent contractor',
  'consulting',  // exact match — not a real company name
  'personal', 'n/a', 'various', '(various)',
  'sole proprietor',
])

function isSelfEmployedCompany(companyName: string | null): boolean {
  if (!companyName) return false
  return SELF_EMPLOYED_COMPANY_NAMES.has(companyName.toLowerCase().trim())
}

function isConsultingFirm(companyName: string | null): boolean {
  if (!companyName) return false
  return CONSULTING_FIRMS_ALLOWLIST.has(companyName.toLowerCase().trim())
}

// "Hard" non-FT patterns — always excluded regardless of concurrency.
const HARD_NON_FT_TITLE_PATTERNS = [
  /\bintern\b/i,
  /\binternship\b/i,
  /\bco-?op\b/i,
  /\bvolunteer(ing)?\b/i,
]

const STUDENT_TITLE_PATTERNS = [
  /\bstudent\b/i,
  /\bundergrad(uate)?\b/i,
  /\bdoctoral candidate\b/i,
  /\bphd candidate\b/i,
  /\bm\.?s\.? candidate\b/i,
  /\bm\.?a\.? candidate\b/i,
  /\bmasters? candidate\b/i,
]

const ASSISTANTSHIP_PATTERNS = [
  /\b(graduate |grad |undergraduate )?teaching assistant\b/i,
  /\b(graduate |grad |undergraduate )?research assistant\b/i,
  /\bgraduate assistant\b/i,
  /\bgrad assistant\b/i,
]

/**
 * True if the title matches a soft non-FT pattern.
 * For "consultant" titles, also checks company against the allowlist.
 */
export function isSoftNonFtTitle(title: string, companyName?: string | null): boolean {
  if (SOFT_NON_FT_TITLE_PATTERNS.some(r => r.test(title))) return true
  // "Consultant" in title is soft-non-FT unless at a known consulting firm
  if (CONSULTANT_TITLE_PATTERN.test(title) && !isConsultingFirm(companyName ?? null)) return true
  return false
}

// ─── Graduation year logic ──────────────────────────────────────────────────

const BACHELOR_PLUS_LEVELS = new Set([
  'bachelor', 'master', 'mba', 'phd', 'doctorate', 'jd', 'md',
])

function isBachelorOrHigher(edu: FtEducation): boolean {
  const lvl = (edu.degree_level || '').toLowerCase()
  if (BACHELOR_PLUS_LEVELS.has(lvl)) return true
  const name = (edu.degree_raw || '').toLowerCase()
  return /\b(bachelor|b\.?s\.?|b\.?a\.?|b\.?eng|master|m\.?s\.?|m\.?a\.?|m\.?eng|mba|phd|ph\.?d|doctorate|doctoral|md|jd)\b/.test(name)
}

function isHighSchoolOrLower(edu: FtEducation): boolean {
  const lvl = (edu.degree_level || '').toLowerCase()
  if (lvl === 'high_school' || lvl === 'certificate' || lvl === 'coursework') return true
  return /high school|secondary school|\bged\b/.test((edu.degree_raw || '').toLowerCase())
}

export function graduationYear(education: FtEducation[]): number | null {
  const nowYear = new Date().getFullYear()

  let earliest: number | null = null
  for (const e of education) {
    if (!e.end_year || e.end_year > nowYear) continue
    if (!isBachelorOrHigher(e)) continue
    if (earliest === null || e.end_year < earliest) earliest = e.end_year
  }
  if (earliest !== null) return earliest

  for (const e of education) {
    if (!e.end_year) continue
    if (isHighSchoolOrLower(e)) continue
    if (earliest === null || e.end_year < earliest) earliest = e.end_year
  }
  if (earliest !== null) return earliest

  for (const e of education) {
    if (!e.end_year) continue
    if (earliest === null || e.end_year < earliest) earliest = e.end_year
  }
  return earliest
}

// ─── Education overlap check ────────────────────────────────────────────────

function roleOverlapsEducation(
  startDate: string,
  endDate: string | null,
  isCurrent: boolean,
  education: FtEducation[],
): boolean {
  const roleStartYear = new Date(startDate).getFullYear()
  if (isNaN(roleStartYear)) return false
  const roleEndYear = isCurrent
    ? new Date().getFullYear()
    : (endDate ? new Date(endDate).getFullYear() : roleStartYear)

  for (const edu of education) {
    if (!edu.start_year || !edu.end_year) continue
    if (roleStartYear <= edu.end_year && roleEndYear >= edu.start_year) return true
  }
  return false
}

// ─── Pass 1: Hard exclusions ────────────────────────────────────────────────

export interface FtClassification {
  counted: boolean
  reason: string | null
}

/**
 * Pass 1: Hard FT classification. Checks everything EXCEPT soft non-FT
 * title patterns (advisor/board/consultant/contractor/freelance).
 * Those are handled in Pass 2 at the company-span level.
 */
export function isCountedAsFt(
  exp: FtExperience,
  education: FtEducation[],
  mode: FtMode,
): FtClassification {
  const title = exp.title_raw?.trim() || ''

  if (!title) return { counted: false, reason: 'no_title' }
  if (!exp.start_date) return { counted: false, reason: 'no_start_date' }
  if (exp.employment_type === 'internship') return { counted: false, reason: 'emp_type_internship' }

  if (exp.seniority === 'student' || exp.seniority === 'intern') {
    const titleIsNonFt = HARD_NON_FT_TITLE_PATTERNS.some(r => r.test(title))
      || STUDENT_TITLE_PATTERNS.some(r => r.test(title))
    if (titleIsNonFt) return { counted: false, reason: 'seniority_student' }
  }

  if (HARD_NON_FT_TITLE_PATTERNS.some(r => r.test(title))) {
    return { counted: false, reason: 'title_hard_non_ft' }
  }

  if (STUDENT_TITLE_PATTERNS.some(r => r.test(title))) {
    return { counted: false, reason: 'title_student' }
  }

  if (ASSISTANTSHIP_PATTERNS.some(r => r.test(title))) {
    if (roleOverlapsEducation(exp.start_date, exp.end_date, exp.is_current, education)) {
      return { counted: false, reason: 'assistantship_edu_overlap' }
    }
  }

  const gradY = graduationYear(education)

  if (mode === 'yoe') {
    if (gradY !== null) {
      const startYear = new Date(exp.start_date).getFullYear()
      if (!isNaN(startYear) && startYear < gradY) {
        return { counted: false, reason: 'pre_graduation_start' }
      }
    }
  } else {
    if (gradY !== null && exp.end_date) {
      const endDate = new Date(exp.end_date)
      const endY = endDate.getFullYear() + endDate.getMonth() / 12
      if (endY < gradY + 0.5) {
        return { counted: false, reason: 'student_era' }
      }
    }
  }

  return { counted: true, reason: null }
}

// ─── Grouping: merge experiences into company spans ─────────────────────────

interface CompanySpan {
  companyId: string
  startMs: number
  endMs: number
  durationMs: number
  isCurrent: boolean
  allSoftNonFt: boolean  // true if EVERY role at this company has a soft non-FT title
  experiences: FtExperience[]
  mergedIntervals: Array<{ start: Date; end: Date; isCurrent: boolean }>
}

const GAP_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000

function buildCompanySpans(experiences: FtExperience[]): CompanySpan[] {
  const now = new Date()
  const nowMs = now.getTime()

  // Group by company
  const byCompany: Record<string, FtExperience[]> = {}
  for (const e of experiences) {
    if (!e.company_id) continue
    if (!byCompany[e.company_id]) byCompany[e.company_id] = []
    byCompany[e.company_id].push(e)
  }

  const spans: CompanySpan[] = []

  for (const companyId of Object.keys(byCompany)) {
    const roles = byCompany[companyId]
    const intervals: Array<{ start: Date; end: Date; isCurrent: boolean }> = []
    for (const r of roles) {
      if (!r.start_date) continue
      const start = new Date(r.start_date)
      if (isNaN(start.getTime())) continue
      const end = r.end_date ? new Date(r.end_date) : now
      intervals.push({ start, end, isCurrent: r.is_current })
    }

    if (intervals.length === 0) continue
    intervals.sort((a, b) => a.start.getTime() - b.start.getTime())

    // Merge contiguous (gap <= 30 days)
    const merged: Array<{ start: Date; end: Date; isCurrent: boolean }> = []
    for (const iv of intervals) {
      if (merged.length === 0) {
        merged.push({ ...iv })
        continue
      }
      const last = merged[merged.length - 1]
      const gap = iv.start.getTime() - last.end.getTime()
      if (gap <= GAP_THRESHOLD_MS) {
        if (iv.end.getTime() > last.end.getTime()) last.end = iv.end
        if (iv.isCurrent) last.isCurrent = true
      } else {
        merged.push({ ...iv })
      }
    }

    const overallStart = merged[0].start.getTime()
    const overallEnd = merged[merged.length - 1].end.getTime()
    const isCurrent = merged.some(m => m.isCurrent)

    // Check if this company span is soft-non-FT:
    // 1. Company name is self-employed (Freelance, Self-Employed, etc.) — always soft
    // 2. All roles have soft non-FT titles (advisor, consultant at non-consulting-firm, etc.)
    const companyName = roles[0]?.company_name ?? null
    const allSoftNonFt = isSelfEmployedCompany(companyName) || roles.every(r => {
      const t = r.title_raw?.trim() || ''
      return t.length > 0 && isSoftNonFtTitle(t, companyName)
    })

    spans.push({
      companyId,
      startMs: overallStart,
      endMs: overallEnd,
      durationMs: overallEnd - overallStart,
      isCurrent,
      allSoftNonFt,
      experiences: roles,
      mergedIntervals: merged,
    })
  }

  return spans
}

// ─── Pass 2: Concurrent company-span filtering ─────────────────────────────

const THREE_MONTHS_MS = 3 * 30.44 * 24 * 60 * 60 * 1000

/**
 * Pass 2: Filter secondary concurrent company spans.
 *
 * When two company spans overlap by >3 months:
 *   - If one is entirely soft-non-FT-titled and the other isn't → soft loses
 *   - Otherwise → longest span wins, most recent start tiebreak
 *
 * Returns the set of primary company IDs.
 */
function filterSecondaryCompanySpans(spans: CompanySpan[]): Set<string> {
  if (spans.length <= 1) return new Set(spans.map(s => s.companyId))

  // Sort by duration DESC, then start DESC for tiebreak
  const sorted = [...spans].sort((a, b) => {
    if (b.durationMs !== a.durationMs) return b.durationMs - a.durationMs
    return b.startMs - a.startMs
  })

  const excluded = new Set<string>()

  for (let i = 0; i < sorted.length; i++) {
    if (excluded.has(sorted[i].companyId)) continue
    for (let j = i + 1; j < sorted.length; j++) {
      if (excluded.has(sorted[j].companyId)) continue

      const overlapStart = Math.max(sorted[i].startMs, sorted[j].startMs)
      const overlapEnd = Math.min(sorted[i].endMs, sorted[j].endMs)
      const overlapMs = overlapEnd - overlapStart
      if (overlapMs <= THREE_MONTHS_MS) continue

      const a = sorted[i], b = sorted[j]

      // Soft non-FT titled company loses to non-soft company
      if (b.allSoftNonFt && !a.allSoftNonFt) {
        excluded.add(b.companyId)
        continue
      }
      if (a.allSoftNonFt && !b.allSoftNonFt) {
        excluded.add(a.companyId)
        break
      }

      // Both same type — shorter loses (a is already longer by sort order)
      excluded.add(b.companyId)
    }
  }

  const primary = new Set<string>()
  for (const s of spans) {
    if (!excluded.has(s.companyId)) primary.add(s.companyId)
  }
  return primary
}

// ─── Full pipeline ──────────────────────────────────────────────────────────

/**
 * Returns the set of primary company IDs after the full pipeline.
 * Used by YOE to determine which experiences count toward the anchor.
 */
export function getPrimaryCompanyIds(
  experiences: FtExperience[],
  education: FtEducation[],
  mode: FtMode,
): Set<string> {
  const pass1 = experiences.filter(e => isCountedAsFt(e, education, mode).counted)
  const spans = buildCompanySpans(pass1)
  return filterSecondaryCompanySpans(spans)
}

/**
 * Returns individual experiences that survived both passes.
 * Pass 1: hard exclusions. Group by company. Pass 2: concurrent-span filter.
 * Then return individual experiences whose company is in the primary set.
 */
export function getFtExperiences(
  experiences: FtExperience[],
  education: FtEducation[],
  mode: FtMode,
): FtExperience[] {
  const pass1 = experiences.filter(e => isCountedAsFt(e, education, mode).counted)
  const spans = buildCompanySpans(pass1)
  const primaryIds = filterSecondaryCompanySpans(spans)
  // Keep Pass-1 survivors at primary companies + experiences with no company_id
  return pass1.filter(e => !e.company_id || primaryIds.has(e.company_id))
}

// ─── Company tenure calculation ─────────────────────────────────────────────

export interface CompanyTenure {
  company_id: string
  spans: Array<{ start: Date; end: Date }>
  totalYears: number
  currentSpanYears: number | null
  isCurrent: boolean
}

/**
 * Full pipeline → tenure per primary company.
 */
export function computeCompanyTenures(
  experiences: FtExperience[],
  education: FtEducation[],
): CompanyTenure[] {
  const pass1 = experiences.filter(e => isCountedAsFt(e, education, 'tenure').counted)
  const companySpans = buildCompanySpans(pass1)
  const primaryIds = filterSecondaryCompanySpans(companySpans)

  const results: CompanyTenure[] = []
  for (const cs of companySpans) {
    if (!primaryIds.has(cs.companyId)) continue

    const spans = cs.mergedIntervals.map(s => ({ start: s.start, end: s.end }))
    const totalYears = spans.reduce((sum, s) => {
      return sum + (s.end.getTime() - s.start.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    }, 0)

    let currentSpanYears: number | null = null
    if (cs.isCurrent && cs.mergedIntervals.length > 0) {
      const lastSpan = cs.mergedIntervals[cs.mergedIntervals.length - 1]
      if (lastSpan.isCurrent) {
        currentSpanYears = (lastSpan.end.getTime() - lastSpan.start.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      }
    }

    results.push({
      company_id: cs.companyId,
      spans,
      totalYears: Math.round(totalYears * 10) / 10,
      currentSpanYears: currentSpanYears !== null ? Math.round(currentSpanYears * 10) / 10 : null,
      isCurrent: cs.isCurrent,
    })
  }

  return results
}

// ─── Convenience: current tenure + avg tenure ───────────────────────────────

export interface TenureSummary {
  currentTenureYears: number | null
  avgTenureYears: number | null
  avgTenureIncCurrentYears: number | null
}

export function computeTenureSummary(
  experiences: FtExperience[],
  education: FtEducation[],
): TenureSummary {
  const tenures = computeCompanyTenures(experiences, education)

  const currentCompany = tenures.find(t => t.isCurrent)
  const currentTenureYears = currentCompany?.currentSpanYears ?? null

  const completedSpans: number[] = []
  const allSpans: number[] = []
  for (const t of tenures) {
    if (t.isCurrent) {
      allSpans.push(t.totalYears)
      if (t.spans.length > 1) {
        for (let i = 0; i < t.spans.length - 1; i++) {
          const spanYears = (t.spans[i].end.getTime() - t.spans[i].start.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
          completedSpans.push(Math.round(spanYears * 10) / 10)
        }
      }
    } else {
      completedSpans.push(t.totalYears)
      allSpans.push(t.totalYears)
    }
  }

  const avgTenureYears = completedSpans.length > 0
    ? Math.round((completedSpans.reduce((a, b) => a + b, 0) / completedSpans.length) * 10) / 10
    : null

  const avgTenureIncCurrentYears = allSpans.length > 0
    ? Math.round((allSpans.reduce((a, b) => a + b, 0) / allSpans.length) * 10) / 10
    : null

  return { currentTenureYears, avgTenureYears, avgTenureIncCurrentYears }
}
