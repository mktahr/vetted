// lib/ingest/mappers/crust-enrich.ts
//
// Maps a single Crust /person/enrich `person_data` blob to our canonical ingest
// payload — for the NETWORK-CONNECTIONS projection path (PR 2b step 5).
//
// WHY A SEPARATE MAPPER (not mapPersonSearchToCanonical):
//   The /person/search mapper (crust-v2.ts) is intentionally LOSSY — it hardcodes
//   description, employment_type, field_of_study to undefined and skills_tags to
//   null, because the v2 SEARCH response doesn't carry them. The /person/enrich
//   response (with fields=[basic_profile,experience,education,skills], verified
//   live 2026-06-28) DOES carry all four, and the five-axis resolver needs them
//   (description -> keyword signals; employment_type -> internship/seniority;
//   field_of_study -> its own normalization; skills -> technology signals). So
//   this mapper PRESERVES them.
//
// SHAPE DIFFERENCES vs /person/search:
//   - employment lives at person_data.experience.employment_details.{current,past}[]
//     (same nesting as search), and the employer object is a SUPERSET of the search
//     employer — same field names for the ids/title/dates PLUS description,
//     employment_type, seniority_level, function_category.
//   - employer company name is `name` (search uses `name` too; the embedded
//     `company_name` field is undefined on enrich).
//   - schools[] carry field_of_study + activities_and_societies (search omits both).
//   - skills.professional_network_skills: string[].
//
// URL HANDLING: the enrich `fields` allowlist does NOT request social_handles, so
// there's no profile_url in the blob. The caller (the normalizer) ALREADY knows the
// authoritative connection URL, so this mapper takes it EXPLICITLY rather than
// digging it out of the payload.
//
// Business logic (grad-anchor, years-of-experience span, date parsing) is SHARED
// with crust-v2.ts via exported helpers so search + enrich stay identical there.

export const ENRICH_MAPPER_VERSION = '1.0.0'

// Ingest types come from write-canonical.ts (the single source of truth, and what
// writeCanonicalProfile consumes) — type-only import, so no runtime coupling to that
// module's @/lib dependencies. Helpers are shared from the crust-v2 search mapper.
import type { IngestPayload, CanonicalProfile, RawExperience, RawEducation } from '../write-canonical'
import {
  dateOnly,
  monthsBetween,
  graduationDateFromEducation,
  computeYearsSpan,
} from './crust-v2'

export type { IngestPayload }

// ─── Loose enrich-blob shapes (the API response is typed `unknown`) ───────────

interface EnrichEmployer {
  name?: string
  title?: string
  start_date?: string
  end_date?: string
  is_default?: boolean
  employment_type?: string
  description?: string
  company_professional_network_profile_url?: string
  crustdata_company_id?: number
  professional_network_id?: string
}

interface EnrichSchool {
  school?: string
  degree?: string
  field_of_study?: string
  start_year?: number | null
  end_year?: number | null
}

interface EnrichLocation {
  raw?: string
  city?: string
  state?: string
  country?: string
}

interface EnrichPersonData {
  basic_profile?: {
    name?: string
    current_title?: string
    headline?: string
    location?: EnrichLocation
  }
  experience?: {
    employment_details?: {
      current?: EnrichEmployer[]
      past?: EnrichEmployer[]
    }
  }
  education?: { schools?: EnrichSchool[] }
  skills?: { professional_network_skills?: string[] }
}

// ─── Sub-object mappers ───────────────────────────────────────────────────────

function mapEnrichEmployer(e: EnrichEmployer, isCurrent: boolean): RawExperience {
  const start = dateOnly(e.start_date)
  const end = dateOnly(e.end_date)
  return {
    company_name: e.name?.trim() || undefined,
    company_linkedin_url: e.company_professional_network_profile_url?.trim() || undefined,
    crustdata_company_id: typeof e.crustdata_company_id === 'number' ? e.crustdata_company_id : undefined,
    company_professional_network_id: e.professional_network_id?.trim() || undefined,
    title: e.title?.trim() || undefined,
    start_date: start,
    end_date: end,
    is_current: isCurrent,
    is_primary_current: isCurrent && e.is_default === true,
    duration_months: monthsBetween(start, end),
    // PRESERVED (the search mapper drops these) — feed the five-axis resolver.
    description: e.description?.trim() || undefined,
    employment_type: e.employment_type?.trim() || undefined,
  }
}

function mapEnrichSchool(s: EnrichSchool): RawEducation {
  return {
    school_name: s.school?.trim() || undefined,
    degree: s.degree?.trim() || undefined,
    field_of_study: s.field_of_study?.trim() || undefined,   // PRESERVED (search drops it)
    start_year: s.start_year ?? undefined,
    end_year: s.end_year ?? undefined,
  }
}

function resolveEnrichLocation(loc: EnrichLocation | undefined): string | null {
  if (!loc) return null
  if (loc.raw && loc.raw.trim()) return loc.raw.trim()
  const parts = [loc.city, loc.state, loc.country].filter(
    (s): s is string => !!s && s.trim().length > 0,
  )
  return parts.length > 0 ? parts.join(', ') : null
}

// ─── Main mapper ────────────────────────────────────────────────────────────

/**
 * Map an enrich `person_data` blob to the canonical ingest payload.
 * @param personData the `matches[0].person_data` object from /person/enrich
 * @param linkedinUrl the authoritative connection URL (caller-known; the enrich
 *        blob carries no profile_url because we don't request social_handles)
 * Returns null when there's no usable name or URL.
 */
export function mapEnrichToCanonical(
  personData: EnrichPersonData | null | undefined,
  linkedinUrl: string,
): IngestPayload | null {
  const url = linkedinUrl?.trim()
  const full_name = personData?.basic_profile?.name?.trim()
  if (!url || !full_name || !personData) return null

  const currentEmployers = personData.experience?.employment_details?.current ?? []
  const pastEmployers = personData.experience?.employment_details?.past ?? []
  // Same primary-current pick as the search mapper: is_default=true, else first current.
  const primaryCurrent = currentEmployers.find(e => e.is_default === true) ?? currentEmployers[0]

  const experiencesRaw = [
    ...currentEmployers.map(e => mapEnrichEmployer(e, true)),
    ...pastEmployers.map(e => mapEnrichEmployer(e, false)),
  ].filter(e => e.company_name || e.title)

  // Dedup identical roles (Crust position groups repeat) — same key as crust-v2.
  const seenExp = new Set<string>()
  const experiences = experiencesRaw.filter(e => {
    const key = `${(e.company_name || '').toLowerCase()}|${(e.title || '').toLowerCase()}|${e.start_date || ''}|${e.end_date || ''}`
    if (seenExp.has(key)) return false
    seenExp.add(key)
    return true
  })

  const schools = personData.education?.schools ?? []
  const educationRaw = schools.map(mapEnrichSchool).filter(e => e.school_name)
  const seenEdu = new Set<string>()
  const education = educationRaw.filter(e => {
    const key = `${(e.school_name || '').toLowerCase()}|${(e.degree || '').toLowerCase()}|${e.start_year ?? ''}|${e.end_year ?? ''}`
    if (seenEdu.has(key)) return false
    seenEdu.add(key)
    return true
  })

  const graduationDate = graduationDateFromEducation(education)
  const yearsExperience = computeYearsSpan(experiences, graduationDate)

  let yearsAtCurrent: number | null = null
  if (primaryCurrent) {
    const months = monthsBetween(dateOnly(primaryCurrent.start_date), undefined)
    yearsAtCurrent = months != null ? Math.round((months / 12) * 10) / 10 : null
  }

  // Skills (PRESERVED — the search mapper sets this null).
  const skillsRaw = personData.skills?.professional_network_skills
  const skills_tags = Array.isArray(skillsRaw)
    ? skillsRaw.map(s => (typeof s === 'string' ? s.trim() : '')).filter(Boolean)
    : null

  const canonical: CanonicalProfile = {
    full_name,
    location_resolved: resolveEnrichLocation(personData.basic_profile?.location),
    current_company: primaryCurrent?.name?.trim() || null,
    current_company_linkedin_url: primaryCurrent?.company_professional_network_profile_url?.trim() || null,
    current_company_crustdata_id: typeof primaryCurrent?.crustdata_company_id === 'number' ? primaryCurrent.crustdata_company_id : null,
    current_company_professional_network_id: primaryCurrent?.professional_network_id?.trim() || null,
    current_title: primaryCurrent?.title?.trim() || personData.basic_profile?.current_title?.trim() || null,
    years_experience: yearsExperience,
    years_at_current_company: yearsAtCurrent,
    undergrad_university: null,
    secondary_university: null,
    phd_university: null,
    skills_tags: skills_tags && skills_tags.length > 0 ? skills_tags : null,
    experiences,
    education,
  }

  return {
    linkedin_url: url,
    full_name,
    canonical_json: canonical,
    raw_json: personData as unknown as Record<string, unknown>,
    source: 'crust_person_enrich',
    source_version: '2025-11-01',
    mapper_version: ENRICH_MAPPER_VERSION,
  }
}
