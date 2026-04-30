// lib/crust/types.ts
//
// Type definitions for Crust Data Person Search API v2 filter shapes
// and our UI's internal filter state.
//
// API ref: https://docs.crustdata.com/person-docs/search/reference
// Filter recipes: https://docs.crustdata.com/person-docs/search/filters
// Autocomplete: https://docs.crustdata.com/person-docs/autocomplete/reference

// ─── Crust filter operators ──────────────────────────────────────────────
// NOTE: GTE is `=>`, LTE is `=<` (NOT `>=`, `<=`).
// `in` and `not_in` REQUIRE JSON array values, not comma strings.

export type CrustOperator =
  | '=' | '!=' | '<' | '=<' | '>' | '=>'
  | 'in' | 'not_in' | 'contains' | '(.)' | 'geo_distance'

export interface CrustFilterCondition {
  field: string
  type: CrustOperator
  value: unknown
}

export interface CrustFilterGroup {
  op: 'and' | 'or'
  conditions: Array<CrustFilterCondition | CrustFilterGroup>
}

export type CrustFilters = CrustFilterCondition | CrustFilterGroup

// ─── Geo distance value shape ────────────────────────────────────────────

export interface GeoDistanceValue {
  location: string
  distance: number
  unit: 'mi' | 'km' | 'm' | 'ft'
}

// ─── UI filter state ─────────────────────────────────────────────────────
// What our admin UI builds. Translated to CrustFilters by build-filter.ts.

export type CompanyScope = 'current' | 'past' | 'ever'

export interface CompanyEntry {
  value: string  // exact company name from autocomplete
  scope: CompanyScope
}

export interface UIFilterState {
  // WHO THEY ARE
  function_category: string                 // single-select, REQUIRED
  seniority_levels: string[]                // multi-select
  years_experience_min: string              // number string for HTML input
  years_experience_max: string
  title: string                             // free text

  // WHERE THEY ARE
  geo_mode: 'country' | 'region' | 'radius' | 'none'
  countries: string[]                       // multi-select autocomplete
  regions: string[]                         // multi-select autocomplete
  radius_city: string                       // single city for radius search
  radius_miles: number                      // distance in miles

  // WHERE THEY WORK
  companies: CompanyEntry[]                 // multi-select with per-row scope
  industries: string[]                      // multi-select autocomplete
  headcount_ranges: string[]                // multi-select fixed buckets
  years_at_current_min: string
  years_at_current_max: string

  // EDUCATION
  schools: string[]                         // multi-select autocomplete
  degrees: string[]                         // multi-select autocomplete
  fields_of_study: string[]                 // multi-select autocomplete

  // SKILLS
  skills: string[]                          // multi-select autocomplete

  // SIGNALS
  recently_changed_jobs: boolean
}

export const EMPTY_FILTERS: UIFilterState = {
  function_category: '',
  seniority_levels: [],
  years_experience_min: '',
  years_experience_max: '',
  title: '',
  geo_mode: 'none',
  countries: [],
  regions: [],
  radius_city: '',
  radius_miles: 25,
  companies: [],
  industries: [],
  headcount_ranges: [],
  years_at_current_min: '',
  years_at_current_max: '',
  schools: [],
  degrees: [],
  fields_of_study: [],
  skills: [],
  recently_changed_jobs: false,
}

// ─── Hardcoded headcount buckets (Crust enum, not autocomplete-able) ─────

export const HEADCOUNT_RANGES: string[] = [
  '1-10', '11-50', '51-200', '201-500',
  '501-1000', '1001-5000', '5001-10000', '10000+',
]

// ─── Autocomplete-able field map ─────────────────────────────────────────
// Maps a UI filter key to the Crust API field path used for autocomplete.

export const AUTOCOMPLETE_FIELDS = {
  function_category: 'experience.employment_details.current.function_category',
  seniority_level: 'experience.employment_details.current.seniority_level',
  company: 'experience.employment_details.current.name',
  company_past: 'experience.employment_details.past.name',
  industry: 'experience.employment_details.current.company_industries',
  country: 'basic_profile.location.country',
  region: 'basic_profile.location.state',
  city: 'basic_profile.location.city',
  school: 'education.schools.school',
  degree: 'education.schools.degree',
  field_of_study: 'education.schools.field_of_study',
  skill: 'skills.professional_network_skills',
} as const

export type AutocompleteFieldKey = keyof typeof AUTOCOMPLETE_FIELDS

// ─── Volume limits ───────────────────────────────────────────────────────

export const HARD_VOLUME_CAP = 5000
export const SOFT_VOLUME_WARNING = 1000
