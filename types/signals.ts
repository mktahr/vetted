// types/signals.ts
//
// Type definitions for the signals system (migration 022).
//
// ─── UI PLACEMENT CONTRACT ─────────────────────────────────────────────────
//
// LIST VIEW:        No signals. List stays scannable. Never add signal
//                   columns or icons to candidate list rows.
//
// DRAWER:           Compact section with chips, grouped by category.
//                   Show top 6–10 signals by relevance/recency. Each chip
//                   is clickable when evidence_url is present (opens new tab).
//                   Signals are decision-making context — knowing someone
//                   won HackMIT or was a Formula SAE captain is exactly
//                   what you peek for.
//
// FULL PROFILE:     Full Signals section with all categories, all evidence
//                   metadata, all URLs, grouped by category. Distinct from
//                   the existing Skills section.
//
// SEARCH BUILDER:   Signal filters appear as collapsible category groups.
//                   Users toggle individual signals or whole categories.
//
// FILTER SIDEBAR:   Never. Signals are deeper-dive, not scan-level filters.
// ────────────────────────────────────────────────────────────────────────────

// ─── Enums (matching CHECK constraints) ────────────────────────────────────

export type SignalCategory =
  | 'fellowship'
  | 'scholarship'
  | 'hackathon'
  | 'greek_life'
  | 'athletics'
  | 'engineering_team'
  | 'student_leadership'
  | 'academic_distinction'
  | 'founder'
  | 'open_source'
  | 'publication'
  | 'patent'
  | 'speaking'
  | 'writing'
  | 'military'
  | 'hospitality'
  | 'teaching'
  | 'career_changer'
  | 'self_taught'
  | 'language'
  | 'competition'
  | 'other'

export type SignalSource =
  | 'pattern_extractor'
  | 'claude_classifier'
  | 'github_enrichment'
  | 'scholar_enrichment'
  | 'patents_enrichment'
  | 'manual_admin'

export type AdminOverrideStatus = 'confirmed' | 'rejected' | null

export type SourceFieldHint =
  | 'activities_honors'
  | 'volunteer'
  | 'education_description'
  | 'experience_description'
  | 'projects'
  | 'publications'
  | 'certifications'
  | 'headline'
  | 'about'
  | 'title'
  | 'company_name'
  | 'external'

// ─── Evidence metadata (discriminated by category) ─────────────────────────

export interface FellowshipEvidence {
  program_year?: number
  cohort?: string
}

export interface ScholarshipEvidence {
  award_year?: number
  amount_usd?: number
}

export interface HackathonEvidence {
  event?: string
  team_size?: number
  project_url?: string
  prize?: string
}

export interface GreekLifeEvidence {
  chapter?: string
  organization?: string
  role?: string
}

export interface AthleticsEvidence {
  sport?: string
  team?: string
  years_active?: string
  position?: string
}

export interface EngineeringTeamEvidence {
  team_name?: string
  role?: string
  years_active?: string
  competition?: string
}

export interface AcademicDistinctionEvidence {
  gpa?: number
  year?: number
}

export interface FounderEvidence {
  company_name?: string
  company_url?: string
  funding_stage?: string
  investors?: string[]
  raised_amount_usd?: number
}

export interface OpenSourceEvidence {
  github_url?: string
  stars_received?: number
  contributions_last_year?: number
  top_repos?: string[]
}

export interface PublicationEvidence {
  title?: string
  venue?: string
  citations?: number
  scholar_url?: string
}

export interface PatentEvidence {
  patent_number?: string
  title?: string
  filing_date?: string
  grant_date?: string
}

export interface SpeakingEvidence {
  event?: string
  talk_title?: string
  event_url?: string
}

export interface WritingEvidence {
  platform?: string
  publication_name?: string
  subscribers?: number
}

export interface MilitaryEvidence {
  branch?: 'army' | 'navy' | 'air_force' | 'marines' | 'space_force' | 'coast_guard'
  rank_at_separation?: string
  unit?: string
  years_active?: string
  combat_deployment?: boolean
  commissioning_source?: 'service_academy' | 'rotc' | 'ocs' | 'ots' | 'occ' | 'direct_commission' | 'other'
}

export interface CompetitionEvidence {
  event?: string
  year?: number
  placement?: string
  division?: string
  project_url?: string
  team_size?: number
}

export interface LanguageEvidence {
  language?: string
  proficiency?: 'basic' | 'conversational' | 'professional' | 'native'
}

// Fallback for categories without specific evidence shapes
export interface GenericEvidence {
  [key: string]: unknown
}

export type EvidenceMetadata<C extends SignalCategory> =
  C extends 'fellowship' ? FellowshipEvidence :
  C extends 'scholarship' ? ScholarshipEvidence :
  C extends 'hackathon' ? HackathonEvidence :
  C extends 'greek_life' ? GreekLifeEvidence :
  C extends 'athletics' ? AthleticsEvidence :
  C extends 'engineering_team' ? EngineeringTeamEvidence :
  C extends 'academic_distinction' ? AcademicDistinctionEvidence :
  C extends 'founder' ? FounderEvidence :
  C extends 'open_source' ? OpenSourceEvidence :
  C extends 'publication' ? PublicationEvidence :
  C extends 'patent' ? PatentEvidence :
  C extends 'speaking' ? SpeakingEvidence :
  C extends 'writing' ? WritingEvidence :
  C extends 'military' ? MilitaryEvidence :
  C extends 'competition' ? CompetitionEvidence :
  C extends 'language' ? LanguageEvidence :
  GenericEvidence

// ─── Table row interfaces ──────────────────────────────────────────────────

export interface SignalDictionaryRow {
  id: string
  canonical_name: string
  category: SignalCategory
  subcategory: string | null
  tier_group: string | null
  aliases: string[]
  source_field_hints: SourceFieldHint[]
  canonical_url: string | null
  description: string | null
  is_positive: boolean
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PersonSignalRow {
  id: string
  person_id: string
  signal_id: string
  source: SignalSource
  source_experience_id: string | null
  source_education_id: string | null
  source_text: string | null
  evidence_url: string | null
  evidence_metadata: Record<string, unknown>
  detected_at: string
  last_verified_at: string
  confidence: number
  verified_by_admin: boolean
  admin_override_status: AdminOverrideStatus
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export interface ActiveSignalRow {
  id: string
  person_id: string
  signal_id: string
  canonical_name: string
  category: SignalCategory
  subcategory: string | null
  tier_group: string | null
  canonical_url: string | null
  evidence_url: string | null
  evidence_metadata: Record<string, unknown>
  source_text: string | null
  source: SignalSource
  confidence: number
  verified_by_admin: boolean
  detected_at: string
}
