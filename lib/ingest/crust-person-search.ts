// lib/ingest/crust-person-search.ts
//
// API client for Crust Data's Person Search API v2.
// Endpoint: POST https://api.crustdata.com/person/search
// Auth: Bearer token + x-api-version: 2025-11-01

const PERSON_SEARCH_URL = 'https://api.crustdata.com/person/search'
const API_VERSION = '2025-11-01'

// ─── Request types ──────────────────────────────────────────────────────────

export interface PersonSearchInputs {
  company_name?: string | null
  location?: string | null
  seniority_level?: string | null
  function_category?: string | null
}

export interface PersonSearchBody {
  filters: unknown
  limit: number
  preview?: boolean
  cursor?: string
  post_processing?: {
    exclude_profiles?: string[]
  }
}

export function buildPersonSearchBody(
  inputs: PersonSearchInputs,
  opts: {
    limit: number
    preview?: boolean
    cursor?: string
    excludeProfiles?: string[]
  },
): PersonSearchBody {
  const conditions: Array<{ field: string; type: string; value: string }> = []

  if (inputs.company_name?.trim()) {
    conditions.push({
      field: 'experience.employment_details.current.company_name',
      type: '(.)',
      value: inputs.company_name.trim(),
    })
  }
  if (inputs.location?.trim()) {
    // full_location is the best match for freeform user input — it matches
    // across city/state/country (e.g. "Seattle" hits "Seattle, Washington, United States").
    // The field-level country/state filters are too narrow for typical search terms.
    conditions.push({
      field: 'basic_profile.location.full_location',
      type: '(.)',
      value: inputs.location.trim(),
    })
  }
  if (inputs.seniority_level?.trim()) {
    conditions.push({
      field: 'experience.employment_details.current.seniority_level',
      type: '(.)',
      value: inputs.seniority_level.trim(),
    })
  }
  if (inputs.function_category?.trim()) {
    conditions.push({
      field: 'experience.employment_details.current.function_category',
      type: '(.)',
      value: inputs.function_category.trim(),
    })
  }

  if (conditions.length === 0) {
    throw new Error('At least one search filter is required')
  }

  const filters = conditions.length === 1
    ? conditions[0]
    : { op: 'and', conditions }

  const body: PersonSearchBody = {
    filters,
    limit: opts.limit,
  }
  // preview=true would be ideal for the sample call, but Crust returns
  // "PersonDB preview feature is not available for your account" on this
  // plan. Falls back to a normal limit=50 fetch (still a sample, just uses
  // credits). Re-enable when the account is upgraded.
  if (opts.preview) body.preview = true
  if (opts.cursor) body.cursor = opts.cursor
  if (opts.excludeProfiles && opts.excludeProfiles.length > 0) {
    body.post_processing = { exclude_profiles: opts.excludeProfiles }
  }
  return body
}

// ─── Response types ─────────────────────────────────────────────────────────

// Observed response shape from live API on 2026-04-15.
// Note: seniority_level and function_category are searchable filter FIELDS
// but are NOT returned in the response — the filter is one-way.
export interface PersonSearchEmployer {
  name?: string                   // company name
  title?: string
  location?: { raw?: string } | null
  start_date?: string | null      // "2025-11-01T00:00:00"
  end_date?: string | null        // null on current roles
  is_default?: boolean            // marks the primary current role
  professional_network_id?: string
  crustdata_company_id?: number
  company_professional_network_profile_url?: string
  [key: string]: unknown
}

export interface PersonSearchSchool {
  school?: string                 // NB: 'school', not 'school_name'
  degree?: string
  start_year?: number | null
  end_year?: number | null
  professional_network_id?: string
  [key: string]: unknown
}

export interface PersonSearchLocation {
  raw?: string
  city?: string
  state?: string
  country?: string
  continent?: string
}

export interface PersonSearchResult {
  basic_profile?: {
    name?: string
    location?: PersonSearchLocation
    headline?: string
    summary?: string
    current_title?: string
    profile_picture_permalink?: string
    [key: string]: unknown
  }
  social_handles?: {
    professional_network_identifier?: {
      profile_url?: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  experience?: {
    employment_details?: {
      current?: PersonSearchEmployer[]
      past?: PersonSearchEmployer[]
    }
    [key: string]: unknown
  }
  education?: {
    schools?: PersonSearchSchool[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface PersonSearchPageResult {
  records: PersonSearchResult[]
  total_count: number | null
  cursor: string | null
  error?: string
}

// ─── API call ───────────────────────────────────────────────────────────────

export async function fetchPersonSearchPage(
  apiKey: string,
  body: PersonSearchBody,
): Promise<PersonSearchPageResult> {
  const resp = await fetch(PERSON_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-api-version': API_VERSION,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text()
    return {
      records: [],
      total_count: null,
      cursor: null,
      error: `Crust API HTTP ${resp.status}: ${text.slice(0, 500)}`,
    }
  }

  const data = await resp.json()

  // v2 API returns results under `profiles`. Keep fallbacks for resilience.
  const records: PersonSearchResult[] =
    (Array.isArray(data.profiles) && data.profiles) ||
    (Array.isArray(data.results) && data.results) ||
    (Array.isArray(data.data) && data.data) ||
    (Array.isArray(data) && data) ||
    []

  const total_count: number | null =
    typeof data.total_count === 'number' ? data.total_count : null

  const cursor: string | null =
    data.next_cursor || data.cursor || null

  return { records, total_count, cursor }
}
