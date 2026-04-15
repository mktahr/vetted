// lib/ingest/mappers/generic.ts
//
// Best-effort mapper for unknown JSON shapes. Uses a list of common field
// aliases for each canonical field and picks the first one that exists.
// Use this when you have a JSON file from an unfamiliar provider and just
// want to get the data into the system to inspect it.
//
// When in doubt, write a dedicated mapper (like crust.ts) for better fidelity.

import type {
  IngestPayload,
  CanonicalProfile,
  RawExperience,
  RawEducation,
} from './crust'

// ─── Alias dictionaries ─────────────────────────────────────────────────────

// Where we look for each canonical field, in priority order. First match wins.
const ALIASES = {
  linkedin_url: [
    'linkedin_url', 'linkedin_profile_url', 'linkedin_flagship_url',
    'profile_url', 'linkedin', 'url',
  ],
  full_name: [
    'full_name', 'fullName', 'name', 'person_name', 'display_name',
  ],
  location: [
    'location_resolved', 'location_name', 'location', 'region', 'city',
    'locationName', 'resolved_location',
  ],
  current_company: [
    'current_company', 'currentCompany', 'current_employer', 'company',
    'company_name', 'employer',
  ],
  current_title: [
    'current_title', 'currentTitle', 'title', 'job_title', 'position',
    'headline',
  ],
  years_experience: [
    'years_experience', 'years_of_experience_raw', 'years_of_experience',
    'yearsExperience', 'experience.years', 'totalYears',
  ],
  experiences: [
    'experiences', 'experience', 'work_history', 'workHistory',
    'all_employers', 'positions', 'jobs',
  ],
  education: [
    'education', 'education_background', 'schools', 'educationHistory',
  ],
  skills: [
    'skills', 'skills_tags', 'skill_tags', 'skillsList',
  ],
}

// Alias keys within an experience/education sub-object
const EXP_ALIASES = {
  company_name: ['company_name', 'companyName', 'employer', 'employer_name', 'company'],
  title: ['title', 'job_title', 'role', 'employee_title'],
  start_date: ['start_date', 'startDate', 'employee_start_date', 'starts_at', 'from'],
  end_date: ['end_date', 'endDate', 'employee_end_date', 'ends_at', 'to'],
  is_current: ['is_current', 'isCurrent', 'current'],
  duration_months: ['duration_months', 'durationMonths', 'tenure_months', 'employee_duration_months'],
  description: ['description', 'summary', 'employee_description'],
  employment_type: ['employment_type', 'employmentType', 'employee_employment_type'],
}

const EDU_ALIASES = {
  school_name: ['school_name', 'schoolName', 'institute_name', 'institution', 'school'],
  degree: ['degree', 'degree_name', 'degreeName'],
  field_of_study: ['field_of_study', 'fieldOfStudy', 'major', 'field'],
  start_year: ['start_year', 'startYear'],
  end_year: ['end_year', 'endYear'],
  start_date: ['start_date', 'starts_at', 'startDate'],
  end_date: ['end_date', 'ends_at', 'endDate'],
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAny(obj: Record<string, unknown>, aliases: string[]): unknown {
  for (const key of aliases) {
    if (key in obj && obj[key] != null) return obj[key]
    // Also check dotted paths ("experience.years")
    if (key.includes('.')) {
      const val = key.split('.').reduce<any>((acc, k) => acc?.[k], obj)
      if (val != null) return val
    }
  }
  return undefined
}

function asString(v: unknown): string | null {
  if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  return null
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && !isNaN(v)) return v
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) return parseFloat(v)
  return null
}

function asStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null
  const out = v.filter(x => typeof x === 'string' && x.trim().length > 0).map(x => (x as string).trim())
  return out.length > 0 ? out : null
}

function asArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return []
  return v.filter(x => x && typeof x === 'object') as Record<string, unknown>[]
}

function yearOf(s: unknown): number | undefined {
  if (typeof s === 'number') return s
  if (typeof s !== 'string') return undefined
  const m = s.match(/(\d{4})/)
  return m ? parseInt(m[1], 10) : undefined
}

// ─── Per-sub-object mappers ─────────────────────────────────────────────────

function mapExperience(e: Record<string, unknown>): RawExperience {
  const start = asString(getAny(e, EXP_ALIASES.start_date))
  const end = asString(getAny(e, EXP_ALIASES.end_date))
  const isCurrent = getAny(e, EXP_ALIASES.is_current)
  return {
    company_name: asString(getAny(e, EXP_ALIASES.company_name)) ?? undefined,
    title: asString(getAny(e, EXP_ALIASES.title)) ?? undefined,
    start_date: start ?? undefined,
    end_date: end ?? undefined,
    is_current: typeof isCurrent === 'boolean' ? isCurrent : (!end && !!start),
    duration_months: asNumber(getAny(e, EXP_ALIASES.duration_months)) ?? undefined,
    description: asString(getAny(e, EXP_ALIASES.description)) ?? undefined,
    employment_type: asString(getAny(e, EXP_ALIASES.employment_type)) ?? undefined,
  }
}

function mapEducation(e: Record<string, unknown>): RawEducation {
  const school = asString(getAny(e, EDU_ALIASES.school_name))
  return {
    school_name: school ?? undefined,
    degree: asString(getAny(e, EDU_ALIASES.degree)) ?? undefined,
    field_of_study: asString(getAny(e, EDU_ALIASES.field_of_study)) ?? undefined,
    start_year: asNumber(getAny(e, EDU_ALIASES.start_year)) ?? yearOf(getAny(e, EDU_ALIASES.start_date)),
    end_year: asNumber(getAny(e, EDU_ALIASES.end_year)) ?? yearOf(getAny(e, EDU_ALIASES.end_date)),
  }
}

// ─── Main mapper ────────────────────────────────────────────────────────────

/**
 * Best-effort mapping of an unknown JSON shape to a canonical ingest payload.
 * Returns null if required fields (linkedin_url + full_name) can't be resolved.
 */
export function mapGenericToCanonical(record: Record<string, unknown>): IngestPayload | null {
  const linkedin_url = asString(getAny(record, ALIASES.linkedin_url))
  const full_name = asString(getAny(record, ALIASES.full_name))
  if (!linkedin_url || !full_name) return null

  const rawExps = asArray(getAny(record, ALIASES.experiences))
  const rawEdus = asArray(getAny(record, ALIASES.education))

  const canonical: CanonicalProfile = {
    full_name,
    location_resolved: asString(getAny(record, ALIASES.location)),
    current_company: asString(getAny(record, ALIASES.current_company)),
    current_title: asString(getAny(record, ALIASES.current_title)),
    years_experience: asNumber(getAny(record, ALIASES.years_experience)),
    years_at_current_company: null, // no reliable alias — caller can extend if known
    undergrad_university: null,
    secondary_university: null,
    phd_university: null,
    skills_tags: asStringArray(getAny(record, ALIASES.skills)),
    experiences: rawExps.map(mapExperience),
    education: rawEdus.map(mapEducation).filter(e => e.school_name),
  }

  return {
    linkedin_url,
    full_name,
    canonical_json: canonical,
    raw_json: record,
  }
}
