// Reverse serializer: person_id → the canonical payload the ATS's
// POST /api/import accepts ({ linkedin_url, full_name, canonical_json }).
//
// Vetted never stores canonical_json per candidate — ingest shreds it into
// the normalized tables — so this module reassembles it FROM those tables.
// That (not raw_ingest_events.payload) is the accurate source of truth: the
// archived payload goes stale the moment an admin edit or re-score lands.
//
// Field choices (deterministic, mirrors what ingest itself persists):
//   years_experience ← years_experience_estimate (NEVER Crust's raw YOE)
//   skills_tags      ← skills_matched (canonical) else skills_scraped_raw
//   experiences      ← person_experiences + companies.company_name
//   education        ← person_education (school_name_raw, else schools name)

import { SupabaseClient } from '@supabase/supabase-js'

export interface AtsCandidate {
  linkedin_url: string
  full_name: string
  canonical_json: {
    full_name: string
    location_resolved: string | null
    current_company: string | null
    current_title: string | null
    years_experience: number | null
    skills_tags: string[]
    experiences: Array<{
      company_name: string | null
      title: string | null
      start_date: string | null
      end_date: string | null
      is_current: boolean
      duration_months: number | null
      description: string | null
      employment_type: string | null
    }>
    education: Array<{
      school_name: string | null
      degree: string | null
      field_of_study: string | null
      start_year: number | null
      end_year: number | null
    }>
  }
}

export interface BuildResult {
  candidates: AtsCandidate[]
  // people we could not serialize, with the reason (surfaced to the UI —
  // never silently dropped)
  skipped: Array<{ person_id: string; full_name: string | null; reason: string }>
}

export async function buildAtsCandidates(
  db: SupabaseClient,
  personIds: string[],
): Promise<BuildResult> {
  const result: BuildResult = { candidates: [], skipped: [] }
  if (personIds.length === 0) return result

  const { data: people, error } = await db
    .from('people')
    .select('person_id, full_name, linkedin_url, location_name, current_title_raw, current_company_id, years_experience_estimate, skills_matched, skills_scraped_raw')
    .in('person_id', personIds)
  if (error) throw new Error(`people query failed: ${error.message}`)

  const foundIds = new Set((people ?? []).map(p => p.person_id))
  for (const id of personIds) {
    if (!foundIds.has(id)) result.skipped.push({ person_id: id, full_name: null, reason: 'person not found' })
  }

  const { data: experiences, error: expErr } = await db
    .from('person_experiences')
    .select('person_id, company_id, title_raw, start_date, end_date, is_current, is_primary_current, duration_months, description_raw, employment_type_normalized')
    .in('person_id', Array.from(foundIds))
  if (expErr) throw new Error(`person_experiences query failed: ${expErr.message}`)

  const { data: education, error: eduErr } = await db
    .from('person_education')
    .select('person_id, school_id, school_name_raw, degree_raw, field_of_study_raw, start_year, end_year')
    .in('person_id', Array.from(foundIds))
  if (eduErr) throw new Error(`person_education query failed: ${eduErr.message}`)

  // Resolve company + school names in two batch lookups
  const companyIds = new Set<string>()
  for (const p of people ?? []) if (p.current_company_id) companyIds.add(p.current_company_id)
  for (const e of experiences ?? []) if (e.company_id) companyIds.add(e.company_id)
  const companyName = new Map<string, string>()
  if (companyIds.size) {
    const { data: companies, error: coErr } = await db
      .from('companies').select('company_id, company_name').in('company_id', Array.from(companyIds))
    if (coErr) throw new Error(`companies query failed: ${coErr.message}`)
    for (const c of companies ?? []) companyName.set(c.company_id, c.company_name)
  }
  const schoolIds = Array.from(new Set((education ?? []).filter(e => !e.school_name_raw && e.school_id).map(e => e.school_id as string)))
  const schoolName = new Map<string, string>()
  if (schoolIds.length) {
    const { data: schools, error: scErr } = await db
      .from('schools').select('school_id, school_name').in('school_id', schoolIds)
    if (scErr) throw new Error(`schools query failed: ${scErr.message}`)
    for (const s of schools ?? []) schoolName.set(s.school_id, s.school_name)
  }

  const expByPerson = new Map<string, NonNullable<typeof experiences>>()
  for (const e of experiences ?? []) {
    const list = expByPerson.get(e.person_id) ?? []
    list.push(e)
    expByPerson.set(e.person_id, list)
  }
  const eduByPerson = new Map<string, NonNullable<typeof education>>()
  for (const e of education ?? []) {
    const list = eduByPerson.get(e.person_id) ?? []
    list.push(e)
    eduByPerson.set(e.person_id, list)
  }

  for (const p of people ?? []) {
    // The ATS requires a non-empty linkedin_url (its dedupe key)
    if (!p.linkedin_url || !p.linkedin_url.trim()) {
      result.skipped.push({ person_id: p.person_id, full_name: p.full_name, reason: 'no LinkedIn URL' })
      continue
    }
    if (!p.full_name) {
      result.skipped.push({ person_id: p.person_id, full_name: null, reason: 'no full name' })
      continue
    }

    // PRIMARY current first (Vetted's multi-current-role disambiguator,
    // migration 030), then other current, then reverse-chronological with
    // undated roles last — the ATS attaches person-level skills to the first
    // is_current row (else row 0), so the primary role must sort first.
    const exps = (expByPerson.get(p.person_id) ?? []).slice().sort((a, b) => {
      if (Boolean(a.is_primary_current) !== Boolean(b.is_primary_current)) return a.is_primary_current ? -1 : 1
      if (a.is_current !== b.is_current) return a.is_current ? -1 : 1
      if (a.start_date && b.start_date) return a.start_date < b.start_date ? 1 : -1
      if (a.start_date || b.start_date) return a.start_date ? -1 : 1
      return 0
    })

    const currentCompany = p.current_company_id
      ? companyName.get(p.current_company_id) ?? null
      : (exps.find(e => e.is_current)?.company_id ? companyName.get(exps.find(e => e.is_current)!.company_id as string) ?? null : null)

    const skills = (p.skills_matched?.length ? p.skills_matched : p.skills_scraped_raw) ?? []

    result.candidates.push({
      linkedin_url: p.linkedin_url,
      full_name: p.full_name,
      canonical_json: {
        full_name: p.full_name,
        location_resolved: p.location_name ?? null,
        current_company: currentCompany,
        current_title: p.current_title_raw ?? null,
        years_experience: p.years_experience_estimate ?? null,
        skills_tags: skills,
        experiences: exps.map(e => ({
          company_name: e.company_id ? companyName.get(e.company_id) ?? null : null,
          title: e.title_raw ?? null,
          start_date: e.start_date ?? null,
          end_date: e.end_date ?? null,
          is_current: e.is_current ?? false,
          duration_months: e.duration_months ?? null,
          description: e.description_raw ?? null,
          employment_type: e.employment_type_normalized ?? null,
        })),
        education: (eduByPerson.get(p.person_id) ?? []).map(e => ({
          school_name: e.school_name_raw ?? (e.school_id ? schoolName.get(e.school_id) ?? null : null),
          degree: e.degree_raw ?? null,
          field_of_study: e.field_of_study_raw ?? null,
          start_year: e.start_year ?? null,
          end_year: e.end_year ?? null,
        })),
      },
    })
  }

  return result
}
