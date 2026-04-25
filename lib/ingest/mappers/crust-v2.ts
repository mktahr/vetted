// lib/ingest/mappers/crust-v2.ts
//
// Maps a single record from Crust Data's POST /person/search (v2) response
// to our canonical ingest payload. The v2 response nests data differently
// from the old /screener/persondb/search — this mapper handles that shape.
//
// Key paths:
//   basic_profile.name                                           → full_name
//   social_handles.professional_network_identifier.profile_url   → linkedin_url
//   basic_profile.location.{country,state,city}                  → location_resolved
//   experience.employment_details.current[]                      → current experiences
//   experience.employment_details.past[]                         → past experiences
//   education.schools[]                                          → education

import type { IngestPayload, CanonicalProfile, RawExperience, RawEducation } from './crust'
import type { PersonSearchResult, PersonSearchEmployer, PersonSearchSchool } from '../crust-person-search'

// Re-export the shared payload types so callers can import from one place.
export type { IngestPayload }

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function isInternshipTitle(title: string | undefined): boolean {
  if (!title) return false
  return /\bintern\b|\binternship\b|\bco-?op\b/i.test(title)
}

function resolveLocation(r: PersonSearchResult): string | null {
  const loc = r.basic_profile?.location
  if (!loc) return null
  // Prefer `raw` — the structured fields are unreliable (observed "Emilia-Romagna, Italy"
  // for someone in "Greater Seattle Area"). Fall back to city/state/country only
  // when `raw` is missing.
  if (loc.raw && loc.raw.trim()) return loc.raw.trim()
  const parts = [loc.city, loc.state, loc.country].filter(
    (s): s is string => !!s && s.trim().length > 0,
  )
  return parts.length > 0 ? parts.join(', ') : null
}

function extractLinkedInUrl(r: PersonSearchResult): string | null {
  const url = r.social_handles?.professional_network_identifier?.profile_url?.trim()
  return url || null
}

// ─── Sub-object mappers ─────────────────────────────────────────────────────

function mapEmployer(e: PersonSearchEmployer, isCurrent: boolean): RawExperience {
  const start = dateOnly(e.start_date)
  const end = dateOnly(e.end_date)
  return {
    company_name: e.name?.trim() || undefined,
    title: e.title?.trim() || undefined,
    start_date: start,
    end_date: end,
    is_current: isCurrent,
    duration_months: monthsBetween(start, end),
    description: undefined,  // v2 API doesn't include description
    employment_type: undefined,
  }
}

function mapSchool(s: PersonSearchSchool): RawEducation {
  return {
    school_name: s.school?.trim() || undefined,
    degree: s.degree?.trim() || undefined,
    field_of_study: undefined,  // v2 API schools[] doesn't include field_of_study
    start_year: s.start_year ?? undefined,
    end_year: s.end_year ?? undefined,
  }
}

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

  for (const edu of education) {
    if (!edu.end_year) continue
    if (earliest === null || edu.end_year < earliest) earliest = edu.end_year
  }
  return earliest === null ? null : new Date(earliest, 5, 1)
}

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
    if (graduationDate && d < graduationDate) continue
    if (earliest === null || d < earliest) earliest = d
  }
  if (!earliest) return null
  const years = (Date.now() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  return Math.max(0, Math.round(years * 10) / 10)
}

// ─── Main mapper ────────────────────────────────────────────────────────────

export function mapPersonSearchToCanonical(record: PersonSearchResult): IngestPayload | null {
  const linkedin_url = extractLinkedInUrl(record)
  const full_name = record.basic_profile?.name?.trim()
  if (!linkedin_url || !full_name) return null

  const currentEmployers = record.experience?.employment_details?.current ?? []
  const pastEmployers = record.experience?.employment_details?.past ?? []
  // Prefer is_default=true; fall back to the first current role.
  const primaryCurrent = currentEmployers.find(e => e.is_default === true) ?? currentEmployers[0]

  const experiences = [
    ...currentEmployers.map(e => mapEmployer(e, true)),
    ...pastEmployers.map(e => mapEmployer(e, false)),
  ].filter(e => e.company_name || e.title)

  const schools = record.education?.schools ?? []
  const education = schools.map(mapSchool).filter(e => e.school_name)

  const graduationDate = graduationDateFromEducation(education)
  const yearsExperience = computeYearsSpan(experiences, graduationDate)

  let yearsAtCurrent: number | null = null
  if (primaryCurrent) {
    const months = monthsBetween(dateOnly(primaryCurrent.start_date), undefined)
    yearsAtCurrent = months != null ? Math.round((months / 12) * 10) / 10 : null
  }

  const canonical: CanonicalProfile = {
    full_name,
    location_resolved: resolveLocation(record),
    current_company: primaryCurrent?.name?.trim() || null,
    current_title: primaryCurrent?.title?.trim() || record.basic_profile?.current_title?.trim() || null,
    years_experience: yearsExperience,
    years_at_current_company: yearsAtCurrent,
    undergrad_university: null,
    secondary_university: null,
    phd_university: null,
    // TODO: Crust Person Search v2 API does not return skills data.
    // Pass 3 of the specialty resolver (technology_signals) is skipped for v2 imports.
    // Contact Crust to request skills in v2 response, or add a post-processing enrichment step.
    skills_tags: null,
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
