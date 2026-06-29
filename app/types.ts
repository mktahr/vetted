// ─── Types matching the normalized database schema ────────────────────────

export type CandidateBucket =
  | 'vetted'
  | 'flagged'
  | 'needs_review'

export type FlaggedReason =
  | 'low_score'
  | 'contractor_only'
  | 'job_hopping'
  | 'unknown_seniority'

export interface ScoreComponent {
  name: string
  category: 'core' | 'bonus' | 'penalty'
  weight: number
  raw: number | null
  points: number
  note?: string
}

export interface ScoreBreakdown {
  components: ScoreComponent[]
  core_score: number
  bonus_score: number
  penalty_score: number
  total_score: number
  scoring_stage: 'pre_career' | 'early_career' | 'mid_career' | 'senior_career'
  years_experience: number | null
  function_normalized: string | null
  applied_recruiting_override: boolean
  applied_executive_override: boolean
  career_progression: 'rising' | 'flat' | 'declining' | 'insufficient_data' | null
  highest_seniority_reached: string | null
  has_early_stage_experience: boolean
  has_hypergrowth_experience: boolean
}

export interface BucketAssignment {
  bucket_assignment_id: string
  person_id: string
  candidate_bucket: CandidateBucket
  flagged_reasons: FlaggedReason[]
  assigned_by: string
  assignment_reason: string | null
  confidence: number | null
  effective_at: string
  created_at: string
  score_breakdown: ScoreBreakdown | null
}

export interface Person {
  person_id: string
  full_name: string
  linkedin_url: string | null
  location_name: string | null
  headline_raw: string | null
  summary_raw: string | null
  current_company_id: string | null
  current_title_raw: string | null
  current_title_normalized: string | null
  current_function_normalized: string | null
  years_experience_estimate: number | null
  career_stage_assigned: string | null
  // PR 2b: candidate | network_connection | both. Drives pool membership +
  // the network/warm-path indicator. Default 'candidate' for existing rows.
  record_kind: 'candidate' | 'network_connection' | 'both' | null
  // Derived signals (populated by scripts/compute-derived-fields.mjs)
  career_progression: 'rising' | 'flat' | 'declining' | 'insufficient_data' | null
  highest_seniority_reached: string | null
  title_level_slope: 'rising' | 'flat' | 'declining' | 'insufficient_data' | null
  slope_score: number | null
  primary_specialty: string | null
  secondary_specialty: string | null
  historical_specialty: string | null
  specialty_transition_flag: boolean
  has_early_stage_experience: boolean
  early_stage_companies_count: number
  has_hypergrowth_experience: boolean
  hypergrowth_companies_count: number
  is_current_founder: boolean
  is_former_founder: boolean
  is_vc_backed_founder: boolean
  is_bootstrapped_founder: boolean
  narrative_summary: string | null
  narrative_summary_generated_at: string | null
  clearance_level: ClearanceLevel
  clearance_notes: string | null
  created_at: string
  updated_at: string
  // Joined data (not on the table itself)
  current_company_name?: string | null
  latest_bucket?: CandidateBucket | null
  latest_bucket_reason?: string | null
  latest_flagged_reasons?: FlaggedReason[] | null
  person_experiences?: Experience[]
  person_education?: Education[]
}

export type ClearanceLevel =
  | 'unknown' | 'none' | 'confidential' | 'secret' | 'top_secret'
  | 'ts_sci' | 'q_clearance' | 'other'

export interface Experience {
  person_experience_id: string
  person_id: string
  company_id: string | null
  title_raw: string | null
  title_normalized: string | null
  title_level: number | null
  function_normalized: string | null
  specialty_normalized: string | null
  seniority_normalized: string | null
  employment_type_normalized: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  duration_months: number | null
  description_raw: string | null
  // Joined
  company_name?: string | null
  company_review_status?: 'vetted' | 'unreviewed' | 'excluded' | null
}

export interface Education {
  person_education_id: string
  person_id: string
  school_id: string | null
  school_name_raw: string | null
  degree_raw: string | null
  degree_normalized: string | null
  degree_level: string | null
  field_of_study_raw: string | null
  field_of_study_normalized: string | null
  start_year: number | null
  end_year: number | null
  description_raw: string | null
  activities_raw: string | null
  grade_raw: string | null
  // Joined
  school_name?: string | null
}

export type SortField = 'years_experience_estimate' | 'current_tenure' | 'avg_tenure' | null
export type SortDirection = 'asc' | 'desc'

// ─── Company types ─────────────────────────────────────────────────────────

export type CompanyBucket = 'static_mature' | 'high_bar_tech' | 'growth_startup' | 'emerging_startup'
export type CompanyStatus = 'active' | 'acquired' | 'public' | 'shut_down'
export type CompanyScoreMode = 'manual' | 'calculated' | 'hybrid'

// V1 (post-migration 031). See lib/companies/taxonomy.ts for the controlled vocabularies.
export type CompanyCategory = 'hardware' | 'non_hardware'         // OR null when unclassified
export type CompanyReviewStatus = 'vetted' | 'unreviewed' | 'excluded'
export type CompanyTaggingMethod = 'claude' | 'claude_dict_agree' | 'claude_dict_disagree' | 'manual'

export interface Company {
  company_id: string
  company_name: string
  // V1 taxonomy
  category: CompanyCategory | null
  primary_industry: string | null
  industries: string[]
  domain_tags: string[]
  review_status: CompanyReviewStatus
  // Identity
  crustdata_company_id: number | null
  professional_network_id: string | null
  linkedin_url: string | null
  website_url: string | null
  // Firmographics
  company_type: string | null
  founding_year: number | null
  headcount_range: string | null
  headcount_latest: number | null
  headcount_latest_at: string | null
  hq_location_name: string | null
  // Funding
  funding_stage: string | null
  total_funding_usd: number | null
  last_funding_amount_usd: number | null
  last_funding_date: string | null
  last_funding_round_type: string | null
  // V2 firmographics + locations + founders + growth
  description: string | null
  logo_permalink: string | null
  locations: { headquarters: string | null; offices: string[] } | null
  founders: Array<{
    name?: string
    title?: string
    professional_network_url?: string
  }> | null
  headcount_growth_3m_pct: number | null
  headcount_growth_6m_pct: number | null
  headcount_growth_12m_pct: number | null
  headcount_timeseries: Array<{ date: string; count: number }> | null
  // Tagger metadata
  tagging_method: CompanyTaggingMethod | null
  tagging_confidence: number | null
  tagging_notes: string | null
  // Lifecycle
  current_status: CompanyStatus
  is_stealth_company: boolean
  company_bucket: CompanyBucket | null
  company_score_mode: CompanyScoreMode
  founding_date: string | null
  notes: string | null
  // Legacy taxonomy (renamed; preserved for read-only display in collapsed pane)
  legacy_primary_industry_tag: string | null
  legacy_sub_industry_1: string | null
  legacy_sub_industry_2: string | null
  legacy_sub_industry_3: string | null
  // Audit
  created_at: string
  updated_at: string
  // joined
  year_scores?: CompanyYearScore[]
}

export interface CompanyYearScore {
  company_id: string
  year: number
  company_score: number // 1-5
  score_notes?: string | null
}

export interface CompanyFunctionScore {
  company_id: string
  function_normalized: string
  year: number
  function_score: number // 0-3
}
