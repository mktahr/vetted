// lib/ingest/mappers/crust.ts
//
// Maps a single record from Crust Data's POST /screener/persondb/search
// response (an item of `profiles[]`) to our canonical ingest payload.
//
// Shape verified against a live search API response on 2026-04-15. Key paths:
//
//   name                                  → full_name
//   flagship_profile_url                  → linkedin_url (preferred — human slug
//                                           matches Chrome extension scrapes)
//   linkedin_profile_url                  → linkedin_url (fallback — internal ID URL)
//   region  or  location_details.{city,state,country}  → location_resolved
//   headline                              → headline (kept in raw_json only)
//   years_of_experience_raw               → years_experience (number)
//   skills[]                              → skills_tags
//
//   current_employers[]  + past_employers[]  → experiences[]
//     each employer has: name (company), title, description, location,
//     start_date (ISO "YYYY-MM-DDTHH:MM:SS"), end_date (only on past),
//     employer_is_default (marks the primary current role),
//     years_at_company_raw (number), function_category, seniority_level
//
//   education_background[]                → education[]
//     each has: institute_name, degree_name, field_of_study,
//     start_date (ISO), end_date (ISO)
//
// current_company/current_title come from the employer where
// employer_is_default === true, or current_employers[0] as fallback.
//
// Dates arrive as "2022-05-01T00:00:00". The ingest API's toDateString()
// only accepts YYYY-MM-DD or "Mon YYYY", so we strip the time component here.

// ─── Canonical payload shape (mirrors app/api/ingest/route.ts) ──────────────

export interface RawExperience {
  company_name?: string
  title?: string
  start_date?: string        // YYYY-MM-DD (stripped of time)
  end_date?: string
  is_current?: boolean
  duration_months?: number
  description?: string
  employment_type?: string
}

export interface RawEducation {
  school_name?: string
  degree?: string
  field_of_study?: string
  start_year?: number
  end_year?: number
}

export interface CanonicalProfile {
  full_name?: string
  location_resolved?: string | null
  current_company?: string | null
  current_title?: string | null
  years_experience?: number | null
  years_at_current_company?: number | null
  undergrad_university?: string | null
  secondary_university?: string | null
  phd_university?: string | null
  skills_tags?: string[] | null
  experiences?: RawExperience[]
  education?: RawEducation[]
}

export interface IngestPayload {
  linkedin_url: string
  full_name: string
  canonical_json: CanonicalProfile
  raw_json: Record<string, unknown>
}

// ─── Crust Data response shapes (from live /screener/persondb/search) ───────

export interface CrustLocationDetails {
  city?: string
  state?: string
  country?: string
  continent?: string
}

export interface CrustEmployer {
  name?: string                                       // company name
  title?: string                                      // role title
  description?: string
  location?: string                                   // plain string, sometimes empty
  start_date?: string | null                          // "2022-05-01T00:00:00"
  end_date?: string | null                            // present on past_employers; omitted on current
  employer_is_default?: boolean                       // marks primary current role
  seniority_level?: string                            // e.g. "Senior", "Owner / Partner"
  function_category?: string                          // e.g. "Engineering"
  years_at_company_raw?: number                       // e.g. 12
  years_at_company?: string                           // e.g. "More than 10 years"
  linkedin_id?: string
  company_id?: number
  company_linkedin_id?: string
  company_linkedin_profile_url?: string
  company_website_domain?: string
  [key: string]: unknown
}

export interface CrustEducationEntry {
  institute_name?: string
  institute_linkedin_id?: string
  institute_linkedin_url?: string
  institute_logo_url?: string
  degree_name?: string
  field_of_study?: string
  activities_and_societies?: string
  start_date?: string | null
  end_date?: string | null
}

export interface CrustPerson {
  person_id?: number
  name?: string
  first_name?: string
  last_name?: string
  headline?: string
  summary?: string
  region?: string
  region_address_components?: string[]
  location_details?: CrustLocationDetails
  skills?: string[]
  languages?: string[]
  num_of_connections?: number
  linkedin_profile_url?: string        // internal ID URL ("ACoAA...")
  flagship_profile_url?: string        // human slug URL ("man-sum-simon-yuen-...")
  profile_picture_url?: string
  profile_picture_permalink?: string
  twitter_handle?: string
  open_to_cards?: unknown[]
  education_background?: CrustEducationEntry[]
  current_employers?: CrustEmployer[]
  past_employers?: CrustEmployer[]
  all_employers?: CrustEmployer[]
  years_of_experience?: string         // e.g. "More than 10 years"
  years_of_experience_raw?: number     // e.g. 17
  recently_changed_jobs?: boolean
  last_updated?: string
  updated_at?: string
  [key: string]: unknown
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Strip time component from an ISO datetime: "2022-05-01T00:00:00" → "2022-05-01". */
function dateOnly(iso: string | null | undefined): string | undefined {
  if (!iso || typeof iso !== 'string') return undefined
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : undefined
}

function yearOf(iso: string | null | undefined): number | undefined {
  if (!iso || typeof iso !== 'string') return undefined
  const m = iso.match(/^(\d{4})/)
  return m ? parseInt(m[1], 10) : undefined
}

/** Approximate months between two dates (end defaults to today). */
function monthsBetween(startISO: string | undefined, endISO: string | undefined): number | undefined {
  if (!startISO) return undefined
  const start = new Date(startISO)
  if (isNaN(start.getTime())) return undefined
  const end = endISO ? new Date(endISO) : new Date()
  if (isNaN(end.getTime())) return undefined
  const ms = end.getTime() - start.getTime()
  if (ms < 0) return undefined
  return Math.round(ms / (1000 * 60 * 60 * 24 * 30.44))
}

/** Pick the linkedin_url — prefer human slug over internal ID URL. */
function extractLinkedInUrl(r: CrustPerson): string | null {
  const flagship = r.flagship_profile_url?.trim()
  if (flagship) return flagship
  const ll = r.linkedin_profile_url?.trim()
  if (ll) return ll
  return null
}

/** Compose a location string from available fields. */
function resolveLocation(r: CrustPerson): string | null {
  if (r.region && r.region.trim()) return r.region.trim()
  const d = r.location_details
  if (d) {
    const parts = [d.city, d.state, d.country].filter((s): s is string => !!s && s.trim().length > 0)
    if (parts.length > 0) return parts.join(', ')
  }
  return null
}

/** Primary current employer — prefer employer_is_default=true, else first entry. */
function primaryCurrentEmployer(r: CrustPerson): CrustEmployer | undefined {
  const cur = r.current_employers ?? []
  if (cur.length === 0) return undefined
  return cur.find(e => e.employer_is_default === true) ?? cur[0]
}

/** True if title is an internship (used only for years_experience fallback). */
function isInternshipTitle(title: string | undefined): boolean {
  if (!title) return false
  return /\bintern\b|\binternship\b|\bco-?op\b/i.test(title)
}

// ─── Sub-object mappers ─────────────────────────────────────────────────────

function mapEmployer(e: CrustEmployer, isCurrent: boolean): RawExperience {
  const start = dateOnly(e.start_date)
  const end = dateOnly(e.end_date)
  // Prefer Crust's own years_at_company_raw when available; else compute.
  const durationMonths =
    typeof e.years_at_company_raw === 'number' && e.years_at_company_raw > 0
      ? e.years_at_company_raw * 12
      : monthsBetween(start, end)
  return {
    company_name: e.name?.trim() || undefined,
    title: e.title?.trim() || undefined,
    start_date: start,
    end_date: end,
    is_current: isCurrent,
    duration_months: durationMonths,
    description: e.description?.trim() || undefined,
    // Crust doesn't provide employment_type directly; ingest's employment_type
    // dictionary will infer from title keywords (e.g. "Intern").
    employment_type: undefined,
  }
}

function mapEducation(e: CrustEducationEntry): RawEducation {
  return {
    school_name: e.institute_name?.trim() || undefined,
    degree: e.degree_name?.trim() || undefined,
    field_of_study: e.field_of_study?.trim() || undefined,
    start_year: yearOf(e.start_date),
    end_year: yearOf(e.end_date),
  }
}

/**
 * Years of experience = span from earliest POST-GRADUATION non-internship
 * role start to now.
 *
 * Crust's own `years_of_experience_raw` counts pre-graduation student jobs
 * (e.g. summer Quant roles, undergraduate RA positions, on-campus engineering
 * work), which inflates the total. We explicitly skip:
 *
 *   • Any role with an internship/co-op in the title
 *   • Any role that started before the earliest education end_year
 *     (i.e. before the person left full-time schooling for the first time)
 *
 * `graduationDate` is the earliest education end_year as a Date (Dec 31 of
 * that year), matching the same heuristic used by resolveSeniority.
 */
function computeYearsSpan(
  experiences: RawExperience[],
  graduationDate: Date | null,
): number | null {
  let earliest: Date | null = null
  for (const e of experiences) {
    if (isInternshipTitle(e.title)) continue
    if (!e.start_date) continue
    const d = new Date(e.start_date)
    if (isNaN(d.getTime())) continue
    // Skip roles that started before graduation — those were student jobs
    if (graduationDate && d < graduationDate) continue
    if (earliest === null || d < earliest) earliest = d
  }
  if (!earliest) return null
  const years = (Date.now() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  return Math.max(0, Math.round(years * 10) / 10)
}

/**
 * Earliest post-secondary education end_year as Dec 31 Date.
 * Mirrors lib/normalize/seniority.ts graduationDateFromEducation() —
 * excludes high school / certificate / coursework so we don't anchor
 * graduation at age ~18 and count undergrad years as real experience.
 */
function graduationDateFromEducation(
  education: Array<{ end_year?: number | null | undefined; degree?: string }>,
): Date | null {
  const isHighSchoolOrLower = (e: { degree?: string }) => {
    const name = (e.degree || '').toLowerCase()
    return /high school|secondary school|\bged\b/.test(name)
  }

  let earliest: number | null = null
  for (const edu of education) {
    if (!edu.end_year) continue
    if (isHighSchoolOrLower(edu)) continue
    if (earliest === null || edu.end_year < earliest) earliest = edu.end_year
  }
  if (earliest !== null) return new Date(earliest, 5, 1)

  // Fallback: no post-secondary — use earliest overall
  for (const edu of education) {
    if (!edu.end_year) continue
    if (earliest === null || edu.end_year < earliest) earliest = edu.end_year
  }
  if (earliest === null) return null
  return new Date(earliest, 5, 1)
}

// ─── Main mapper ────────────────────────────────────────────────────────────

/**
 * Map a single Crust search-API person to a canonical ingest payload.
 * Returns null if required fields (linkedin_url + full_name) can't be resolved.
 */
export function mapCrustToCanonical(record: CrustPerson): IngestPayload | null {
  const linkedin_url = extractLinkedInUrl(record)
  const full_name = record.name?.trim()
  if (!linkedin_url || !full_name) return null

  const primaryCurrent = primaryCurrentEmployer(record)
  const currentList = record.current_employers ?? []
  const pastList = record.past_employers ?? []

  const experiences = [
    ...currentList.map(e => mapEmployer(e, true)),
    ...pastList.map(e => mapEmployer(e, false)),
  ].filter(e => e.company_name || e.title)

  const education = (record.education_background ?? [])
    .map(mapEducation)
    .filter(e => e.school_name)

  // Years experience = post-graduation, non-internship span only.
  // We intentionally ignore Crust's `years_of_experience_raw` because it
  // includes pre-graduation student work (summer jobs, research assistant
  // gigs, on-campus engineering roles) which inflates the total.
  const graduationDate = graduationDateFromEducation(education)
  const yearsExperience = computeYearsSpan(experiences, graduationDate)

  // Years at current company: use Crust's years_at_company_raw on the primary
  // current role if available; otherwise compute from start_date.
  let yearsAtCurrent: number | null = null
  if (primaryCurrent) {
    if (typeof primaryCurrent.years_at_company_raw === 'number' && primaryCurrent.years_at_company_raw > 0) {
      yearsAtCurrent = primaryCurrent.years_at_company_raw
    } else {
      const months = monthsBetween(dateOnly(primaryCurrent.start_date), undefined)
      yearsAtCurrent = months != null ? Math.round((months / 12) * 10) / 10 : null
    }
  }

  const canonical: CanonicalProfile = {
    full_name,
    location_resolved: resolveLocation(record),
    current_company: primaryCurrent?.name?.trim() || null,
    current_title: primaryCurrent?.title?.trim() || null,
    years_experience: yearsExperience,
    years_at_current_company: yearsAtCurrent,

    // Intentionally null — we pass education[] and the ingest API iterates
    // it separately. Populating both would create duplicate rows.
    undergrad_university: null,
    secondary_university: null,
    phd_university: null,

    skills_tags: Array.isArray(record.skills) && record.skills.length > 0 ? record.skills : null,

    experiences,
    education,
  }

  return {
    linkedin_url,
    full_name,
    canonical_json: canonical,
    raw_json: record as unknown as Record<string, unknown>,
  }
}
