// ─── Types matching the normalized database schema ────────────────────────

export type CandidateBucket =
  | 'vetted_talent'
  | 'high_potential'
  | 'silver_medalist'
  | 'non_vetted'
  | 'needs_review'

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
  // Derived signals (populated by scripts/compute-derived-fields.mjs)
  career_progression: 'rising' | 'flat' | 'declining' | 'insufficient_data' | null
  highest_seniority_reached: string | null
  title_level_slope: 'rising' | 'flat' | 'declining' | 'insufficient_data' | null
  has_early_stage_experience: boolean
  early_stage_companies_count: number
  has_hypergrowth_experience: boolean
  hypergrowth_companies_count: number
  narrative_summary: string | null
  narrative_summary_generated_at: string | null
  created_at: string
  updated_at: string
  // Joined data (not on the table itself)
  current_company_name?: string | null
  latest_bucket?: CandidateBucket | null
  latest_bucket_reason?: string | null
  person_experiences?: Experience[]
  person_education?: Education[]
}

export interface Experience {
  person_experience_id: string
  person_id: string
  company_id: string | null
  title_raw: string | null
  title_normalized: string | null
  function_normalized: string | null
  seniority_normalized: string | null
  employment_type_normalized: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  duration_months: number | null
  description_raw: string | null
  // Joined
  company_name?: string | null
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
  // Joined
  school_name?: string | null
}

export type SortField = 'years_experience_estimate' | null
export type SortDirection = 'asc' | 'desc'

// ─── Company types ─────────────────────────────────────────────────────────

export type CompanyBucket = 'static_mature' | 'high_bar_tech' | 'growth_startup' | 'emerging_startup'
export type CompanyStatus = 'active' | 'acquired' | 'public' | 'shut_down'
export type CompanyScoreMode = 'manual' | 'calculated' | 'hybrid'
export type CompanyReviewStatus = 'unreviewed' | 'reviewed' | 'locked'

export interface Company {
  company_id: string
  company_name: string
  primary_industry_tag: string | null
  company_bucket: CompanyBucket | null
  company_score_mode: CompanyScoreMode
  manual_review_status: CompanyReviewStatus
  is_stealth_company: boolean
  founding_date: string | null
  founding_year: number | null
  current_status: CompanyStatus
  hq_location_name: string | null
  linkedin_url: string | null
  website_url: string | null
  notes: string | null
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
