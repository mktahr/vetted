export interface Profile {
  id: string
  linkedin_url: string | null
  full_name: string | null
  location_resolved: string | null
  current_company: string | null
  current_title: string | null
  years_experience: number | null
  years_at_current_company: number | null
  skills_tags: string[] | null
  focus_area_tags: string[] | null
  excellence_tags: string[] | null
  domain_tags: string[] | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export type SortField = 'years_experience' | 'years_at_current_company' | null
export type SortDirection = 'asc' | 'desc'


