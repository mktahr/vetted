'use client'

// TODO: Move Boolean search and main filter logic to a server-side API endpoint
// when people count exceeds ~500. Client-side filtering becomes too slow above that threshold.

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, fetchAllRows } from '@/lib/supabase'
import { Person, SortField, SortDirection, CandidateBucket } from '../types'
import ProfileDrawer, { DrawerExperience, DrawerEducation, DrawerSignal } from './ProfileDrawer'
import AddToListMenu from './AddToListMenu'
import TopNav from './TopNav'
import { MultiSelectOption } from './MultiSelect'
import CompanyLogo, { guessDomain, guessSchoolDomain } from './CompanyLogo'
import type { ConditionRow } from './condition-rows/types'
import { conditionToCompact, compactToCondition, migrateOldCompanyState, migrateOldSchoolState } from './condition-rows/types'
import FilterSidebar from './FilterSidebar'
import { buildLocationOptions } from '@/lib/locations/us-locations'
import { computeTenureSummary, type FtExperience, type FtEducation, type TenureSummary } from '@/lib/tenure/helpers'
import { filterEducationForDisplay } from '@/lib/education/display-filter'
import { formatSeniorityLabel } from '@/lib/normalize/seniority'

function cleanCompanyName(name: string | null | undefined): string | null {
  if (!name) return null
  return name.split('·')[0].split('•')[0].trim() || null
}

// Bucket chip using design system tag palette
const BUCKET_TAG: Record<CandidateBucket, { label: string; bg: string; border: string; text: string }> = {
  vetted:           { label: 'Vetted',           bg: 'var(--tag-sage-bg)',  border: 'var(--tag-sage-border)',  text: 'var(--tag-sage-text)' },
  needs_review:     { label: 'Needs Review',     bg: 'var(--tag-clay-bg)',  border: 'var(--tag-clay-border)',  text: 'var(--tag-clay-text)' },
  flagged:          { label: 'Flagged',          bg: 'var(--tag-sand-bg)',  border: 'var(--tag-sand-border)',  text: 'var(--tag-sand-text)' },
}

function BucketChip({ bucket }: { bucket: CandidateBucket | null | undefined }) {
  if (!bucket) return <span style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)' }}>Unscored</span>
  const s = BUCKET_TAG[bucket]
  return <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 'var(--r-chip)', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-medium)', fontFamily: 'var(--font-sans)', background: s.bg, border: `1px solid ${s.border}`, color: s.text }}>{s.label}</span>
}

// V1: replaces the old FocusScope. Imported from FilterSidebar where the types live.
import type { CategoryScope, ReviewStatusScope } from './FilterSidebar'

interface ExperienceLite {
  company_id: string | null
  // V1 (post-migration 031): two independent dimensions per company
  company_category: 'hardware' | 'non_hardware' | null
  company_review_status: 'vetted' | 'unreviewed' | 'excluded' | null
  specialty: string | null
  seniority: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  employment_type: string | null
  title_raw: string | null
  description_raw: string | null
}

interface EducationLite {
  school_id: string
  school_name_raw: string | null
  school_type: string | null
  degree_raw: string | null
  degree_level: string | null
  field_of_study_raw: string | null
  field_of_study_normalized: string | null
  start_year: number | null
  end_year: number | null
}

interface PersonWithFilters extends Person {
  company_ids_all: Set<string>
  school_ids_all: Set<string>
  experiences_lite: ExperienceLite[]
  education_lite: EducationLite[]
  all_specialties: Set<string>
  tenure: TenureSummary
}

// ─── Boolean keyword matcher ────────────────────────────────────────────────
// Simple implementation: splits on AND/OR, handles NOT and quoted phrases.
// Not a full AST parser but covers the 80% use case.

function matchesBoolean(text: string, query: string): boolean {
  if (!query.trim()) return true
  const lower = text.toLowerCase()
  // Split by OR (case insensitive)
  const orGroups = query.split(/\bOR\b/i)
  return orGroups.some(group => {
    // Within each OR group, split by AND
    const andTerms = group.split(/\bAND\b/i)
    return andTerms.every(term => {
      const t = term.trim()
      if (!t) return true
      const negated = t.startsWith('NOT ') || t.startsWith('not ')
      const cleaned = negated ? t.slice(4).trim() : t
      // Quoted phrase = exact substring
      const quoted = cleaned.match(/^"(.+)"$/)
      const search = (quoted ? quoted[1] : cleaned).toLowerCase()
      const found = lower.includes(search)
      return negated ? !found : found
    })
  })
}

// Derive primary education row for display in the table
const DEGREE_LEVEL_PRIORITY: Record<string, number> = { phd: 5, mba: 4, master: 3, bachelor: 2, certificate: 1 }
const DEGREE_ABBREV: Record<string, string> = { bachelor: 'BS', master: 'MS', mba: 'MBA', phd: 'PhD', certificate: 'Cert' }

function derivePrimaryEducation(
  eduLite: EducationLite[],
  schoolNameMap: Record<string, string>,
): { schoolName: string; degree: string } | null {
  if (eduLite.length === 0) return null

  // Use the shared display filter to remove junk (yoga, bootcamps, incubators, etc.)
  const degreeGranting = filterEducationForDisplay(eduLite)

  // Priority: bachelor (earliest by end_year) → highest degree_level → first row with field_of_study → first row
  const candidates = degreeGranting.length > 0 ? degreeGranting : eduLite
  const bachelors = candidates.filter(e => e.degree_level === 'bachelor')
  let primary: EducationLite
  if (bachelors.length > 0) {
    primary = bachelors.sort((a, b) => (a.end_year ?? 9999) - (b.end_year ?? 9999))[0]
  } else {
    // Highest available degree with degree_level populated
    const withLevel = candidates.filter(e => e.degree_level && DEGREE_LEVEL_PRIORITY[e.degree_level])
    if (withLevel.length > 0) {
      primary = withLevel.sort((a, b) => (DEGREE_LEVEL_PRIORITY[b.degree_level || ''] ?? 0) - (DEGREE_LEVEL_PRIORITY[a.degree_level || ''] ?? 0))[0]
    } else {
      // No degree_level at all — prefer most recent by end_year, then row with field_of_study_raw
      const sorted = [...candidates].sort((a, b) => (b.end_year ?? 0) - (a.end_year ?? 0))
      const withField = sorted.filter(e => e.field_of_study_raw)
      primary = withField.length > 0 ? withField[0] : sorted[0]
    }
  }

  // School name: prefer canonical from schools table, fall back to raw
  const schoolName = schoolNameMap[primary.school_id] || primary.school_name_raw || '—'

  // Degree formatting: "BS Computer Science" or degree_raw fallback
  let degree = ''
  if (primary.degree_level && DEGREE_ABBREV[primary.degree_level]) {
    degree = DEGREE_ABBREV[primary.degree_level]
    if (primary.field_of_study_raw) {
      // Truncate long field names
      const field = primary.field_of_study_raw.length > 30 ? primary.field_of_study_raw.slice(0, 28) + '…' : primary.field_of_study_raw
      degree += ' ' + field
    }
  } else if (primary.degree_raw) {
    degree = primary.degree_raw.length > 35 ? primary.degree_raw.slice(0, 33) + '…' : primary.degree_raw
  }

  return { schoolName, degree }
}

export default function ProfileTable() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [people, setPeople] = useState<PersonWithFilters[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  // Filter state
  const [bucketSel, setBucketSel] = useState<string[]>([])
  const [stageSel, setStageSel] = useState<string[]>([])
  const [schoolSel, setSchoolSel] = useState<string[]>([])
  const [degreeSel, setDegreeSel] = useState<string[]>([])
  const [fieldOfStudySel, setFieldOfStudySel] = useState<string[]>([])
  // Founder type filter: replaces old "Any Founder" category filter. Multi-select with 2 options.
  //   'vc_backed'    → matches people.is_vc_backed_founder = TRUE
  //   'bootstrapped' → matches people.is_bootstrapped_founder = TRUE
  const [founderTypeSel, setFounderTypeSel] = useState<string[]>([])
  const [locationSel, setLocationSel] = useState<string[]>([])
  const [clearanceSel, setClearanceSel] = useState<string[]>([])
  // Per-pill scope: each selected value has its own temporal scope
  type TemporalScope = 'ever' | 'currently' | 'previously'
  type ScopedPill = { value: string; scope: TemporalScope }
  const [rolePills, setRolePills] = useState<ScopedPill[]>([])
  const [specialtyPills, setSpecialtyPills] = useState<ScopedPill[]>([])
  const [seniorityPills, setSeniorityPills] = useState<ScopedPill[]>([])
  // Derived flat arrays for backward compat with code reading sel arrays
  const roleSel = rolePills.map(p => p.value)
  const specialtySel = specialtyPills.map(p => p.value)
  const senioritySel = seniorityPills.map(p => p.value)
  // Setter wrappers: when MultiSelect changes values, wrap new ones with default scope 'ever'
  const setRoleSel = (vals: string[]) => {
    setRolePills(vals.map(v => {
      const existing = rolePills.find(p => p.value === v)
      return existing || { value: v, scope: 'ever' as TemporalScope }
    }))
  }
  const setSpecialtySel = (vals: string[]) => {
    setSpecialtyPills(vals.map(v => {
      const existing = specialtyPills.find(p => p.value === v)
      return existing || { value: v, scope: 'ever' as TemporalScope }
    }))
  }
  const setSenioritySel = (vals: string[]) => {
    setSeniorityPills(vals.map(v => {
      const existing = seniorityPills.find(p => p.value === v)
      return existing || { value: v, scope: 'ever' as TemporalScope }
    }))
  }
  // V1 (post-migration 031): two independent scope filters, both default 'all'
  // per Matt's Option C decision (zero disruption to existing visibility).
  const [categoryScope, setCategoryScope] = useState<CategoryScope>('all')
  const [reviewStatusScope, setReviewStatusScope] = useState<ReviewStatusScope>('all')
  const [compoundCompanyPills, setCompoundCompanyPills] = useState<ScopedPill[]>([])
  // Derived for backward compat
  const compoundCompany = compoundCompanyPills.map(p => p.value)
  const setCompoundCompany = (vals: string[]) => {
    setCompoundCompanyPills(vals.map(v => compoundCompanyPills.find(p => p.value === v) || { value: v, scope: 'ever' as TemporalScope }))
  }
  const [compoundSpecialties, setCompoundSpecialties] = useState<string[]>([])
  const [compoundYearMin, setCompoundYearMin] = useState<string>('')
  const [compoundYearMax, setCompoundYearMax] = useState<string>('')
  const [yearsMin, setYearsMin] = useState<string>('')
  const [yearsMax, setYearsMax] = useState<string>('')
  const [schoolScope, setSchoolScope] = useState<'us' | 'all'>('us')
  const [schoolTemporalScope, setSchoolTemporalScope] = useState<TemporalScope>('ever')
  const [schoolGroupScope, setSchoolGroupScope] = useState<TemporalScope>('ever')
  const [companyGroupScope, setCompanyGroupScope] = useState<TemporalScope>('ever')
  const [titleBoolean, setTitleBoolean] = useState('')
  const [titleBooleanScope, setTitleBooleanScope] = useState<TemporalScope>('ever')
  const [experienceBoolean, setExperienceBoolean] = useState('')
  // Tenure filters
  const [currentTenureMin, setCurrentTenureMin] = useState<string>('')
  const [currentTenureMax, setCurrentTenureMax] = useState<string>('')
  const [avgTenureMin, setAvgTenureMin] = useState<string>('')
  const [avgTenureMax, setAvgTenureMax] = useState<string>('')
  const [avgTenureIncludeCurrent, setAvgTenureIncludeCurrent] = useState(true)

  // Options
  const [roleOptions, setRoleOptions] = useState<MultiSelectOption[]>([])
  const [seniorityOptions, setSeniorityOptions] = useState<MultiSelectOption[]>([])
  const [companyOptions, setCompanyOptions] = useState<MultiSelectOption[]>([])
  const [schoolOptions, setSchoolOptions] = useState<MultiSelectOption[]>([])
  const [allSpecialtyOptions, setAllSpecialtyOptions] = useState<MultiSelectOption[]>([])
  // Role→specialty mapping for contextual filtering
  const [roleSpecialtyMap, setRoleSpecialtyMap] = useState<Record<string, string[]>>({})
  const [companyNameMap, setCompanyNameMap] = useState<Record<string, string>>({})
  const [companiesRaw, setCompaniesRaw] = useState<any[]>([])
  const [schoolNameMap, setSchoolNameMap] = useState<Record<string, string>>({})
  const [signalsByPerson, setSignalsByPerson] = useState<Record<string, DrawerSignal[]>>({})

  // Condition rows (new model — coexists with old state for backward compat)
  const [companyConditions, setCompanyConditions] = useState<import('./condition-rows/types').ConditionRow[]>([])
  const [schoolConditions, setSchoolConditions] = useState<import('./condition-rows/types').ConditionRow[]>([])

  // New filter state: signals, school groups, company groups
  const [signalSel, setSignalSel] = useState<string[]>([])
  const [signalOptions, setSignalOptions] = useState<MultiSelectOption[]>([])
  const [schoolGroupSel, setSchoolGroupSel] = useState<string[]>([])
  const [schoolGroupOptions, setSchoolGroupOptions] = useState<MultiSelectOption[]>([])
  const [companyGroupSel, setCompanyGroupSel] = useState<string[]>([])
  const [companyGroupOptions, setCompanyGroupOptions] = useState<MultiSelectOption[]>([])
  // Accelerator filter removed (PR #4 cleanup) — was a legacy duplicate of incubator category.
  // Y Combinator now lives in signal_dictionary.incubator with full aliases.
  const [fieldOfStudyOptions, setFieldOfStudyOptions] = useState<MultiSelectOption[]>([])
  // Lookup: school_id → school_groups[], company_id → company_groups[]
  const [schoolGroupsMap, setSchoolGroupsMap] = useState<Record<string, string[]>>({})
  const [companyGroupsMap, setCompanyGroupsMap] = useState<Record<string, string[]>>({})

  const locationOptions = useMemo(() => buildLocationOptions(), [])

  // ─── Hydrate filter state from URL params (search builder round-trip) ──
  const [urlHydrated, setUrlHydrated] = useState(false)
  useEffect(() => {
    if (urlHydrated) return
    const raw = searchParams.get('filters')
    if (!raw) { setUrlHydrated(true); return }
    try {
      const f = JSON.parse(decodeURIComponent(raw))
      // Per-pill scope: new format has rolePills, old format has roleSel + roleScope
      if (f.rolePills) setRolePills(f.rolePills)
      else if (f.roleSel) {
        const scope = f.roleScope || 'ever'
        setRolePills((f.roleSel as string[]).map(v => ({ value: v, scope })))
      }
      if (f.specialtyPills) setSpecialtyPills(f.specialtyPills)
      else if (f.specialtySel) {
        let scope: TemporalScope = 'ever'
        if (f.specialtyScope === 'any' || f.specialtyScope === 'ever') scope = 'ever'
        else if (f.specialtyScope === 'current' || f.specialtyScope === 'currently') scope = 'currently'
        else if (f.specialtyScope === 'previously') scope = 'previously'
        setSpecialtyPills((f.specialtySel as string[]).map(v => ({ value: v, scope })))
      }
      if (f.seniorityPills) setSeniorityPills(f.seniorityPills)
      else if (f.senioritySel) {
        const scope = f.seniorityScope || 'ever'
        setSeniorityPills((f.senioritySel as string[]).map(v => ({ value: v, scope })))
      }
      if (f.bucketSel) setBucketSel(f.bucketSel)
      if (f.stageSel) setStageSel(f.stageSel)
      if (f.yearsMin) setYearsMin(f.yearsMin)
      if (f.yearsMax) setYearsMax(f.yearsMax)
      if (f.clearanceSel) setClearanceSel(f.clearanceSel)
      if (f.locationSel) setLocationSel(f.locationSel)
      // V1 backward-compat: old saved filters used `focusScope` with hard_tech/all_tech values.
      // Map: hard_tech → categoryScope=hardware, all_tech → categoryScope=all (no equivalent),
      // all → all. New saved filters use categoryScope + reviewStatusScope directly.
      if (f.focusScope === 'hard_tech') setCategoryScope('hardware')
      else if (f.focusScope) setCategoryScope('all')
      if (f.categoryScope) setCategoryScope(f.categoryScope)
      if (f.reviewStatusScope) setReviewStatusScope(f.reviewStatusScope)
      // Per-pill scope: new format has compoundCompanyPills, old format has compoundCompany + compoundCompanyScope
      if (f.compoundCompanyPills) setCompoundCompanyPills(f.compoundCompanyPills)
      else if (f.compoundCompany) {
        let scope: TemporalScope = 'ever'
        if (f.compoundCompanyScope === 'currently') scope = 'currently'
        else if (f.compoundCompanyScope === 'previously') scope = 'previously'
        else if (f.compoundRelationship === 'current') scope = 'currently'
        else if (f.compoundRelationship === 'previous') scope = 'previously'
        const ids = Array.isArray(f.compoundCompany) ? f.compoundCompany : [f.compoundCompany]
        setCompoundCompanyPills((ids as string[]).map(v => ({ value: v, scope })))
      }
      if (f.compoundSpecialties) setCompoundSpecialties(f.compoundSpecialties)
      if (f.compoundYearMin) setCompoundYearMin(f.compoundYearMin)
      if (f.compoundYearMax) setCompoundYearMax(f.compoundYearMax)
      if (f.schoolSel) setSchoolSel(f.schoolSel)
      if (f.schoolTemporalScope) setSchoolTemporalScope(f.schoolTemporalScope)
      if (f.degreeSel) setDegreeSel(f.degreeSel)
      if (f.titleBoolean) setTitleBoolean(f.titleBoolean)
      if (f.titleBooleanScope) setTitleBooleanScope(f.titleBooleanScope)
      if (f.experienceBoolean) setExperienceBoolean(f.experienceBoolean)
      if (f.signalSel) setSignalSel(f.signalSel)
      if (f.schoolGroupSel) setSchoolGroupSel(f.schoolGroupSel)
      if (f.schoolGroupScope) setSchoolGroupScope(f.schoolGroupScope)
      if (f.companyGroupSel) setCompanyGroupSel(f.companyGroupSel)
      if (f.companyGroupScope) setCompanyGroupScope(f.companyGroupScope)
      // accelerator filter removed (PR #4); accept legacy saved-search key as no-op
      if (f.currentTenureMin) setCurrentTenureMin(f.currentTenureMin)
      if (f.currentTenureMax) setCurrentTenureMax(f.currentTenureMax)
      if (f.avgTenureMin) setAvgTenureMin(f.avgTenureMin)
      if (f.avgTenureMax) setAvgTenureMax(f.avgTenureMax)
      if (typeof f.avgTenureIncludeCurrent === 'boolean') setAvgTenureIncludeCurrent(f.avgTenureIncludeCurrent)
      // New condition row format
      if (f.cc && Array.isArray(f.cc)) {
        setCompanyConditions(f.cc.map((c: any) => compactToCondition(c)))
      }
      if (f.sc && Array.isArray(f.sc)) {
        setSchoolConditions(f.sc.map((c: any) => compactToCondition(c)))
      }
    } catch { /* ignore bad JSON */ }
    setUrlHydrated(true)
  }, [searchParams, urlHydrated])

  // ─── Fetch ────────────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchAll() {
      try {
        const [
          { data: peopleData, error: peopleErr },
          { data: bucketData },
          { data: expData },
          { data: eduData },
          { data: srs },
          { data: companies },
          { data: schools },
          { data: specDict },
          { data: roles },
          { data: rsMap },
          { data: signalsData },
          { data: signalSearchableData },
          { data: fieldOfStudyData },
        ] = await Promise.all([
          supabase.from('people').select('*, companies:current_company_id ( company_name )').order('created_at', { ascending: false }),
          supabase.from('candidate_bucket_assignments').select('person_id, candidate_bucket, flagged_reasons, assignment_reason, effective_at').order('effective_at', { ascending: false }),
          supabase.from('person_experiences').select('person_id, company_id, specialty_normalized, seniority_normalized, start_date, end_date, is_current, employment_type_normalized, title_raw, description_raw'),
          supabase.from('person_education').select('person_id, school_id, school_name_raw, degree_raw, degree_level, field_of_study_raw, field_of_study_normalized, start_year, end_year'),
          supabase.from('seniority_dictionary').select('seniority_normalized, rank_order').eq('active', true).order('rank_order'),
          fetchAllRows<any>('companies', 'company_id, company_name, primary_industry, industries, category, review_status, legacy_primary_industry_tag, company_groups', 'company_name').then(data => ({ data })),
          fetchAllRows<any>('schools', 'school_id, school_name, school_score, is_foreign, school_groups, school_type', 'school_name').then(data => ({ data })),
          supabase.from('specialty_dictionary').select('specialty_normalized, parent_function').eq('active', true).order('specialty_normalized'),
          supabase.from('role_dictionary').select('role_id, role_name, display_order').eq('active', true).order('display_order'),
          supabase.from('role_specialty_map').select('role_id, specialty_normalized, is_primary'),
          supabase.from('person_signals_active').select('person_id, signal_id, canonical_name, category, canonical_url, evidence_url, source_text, source, confidence').order('confidence', { ascending: false }),
          supabase.from('signal_dictionary').select('id, is_searchable'),
          supabase.from('field_of_study_dictionary').select('field_of_study_normalized, domain_group'),
        ])

        if (peopleErr) { setError(`Database error: ${peopleErr.message}`); return }

        const latestBucket: Record<string, { bucket: CandidateBucket; reason: string | null; flagged_reasons: string[] }> = {}
        for (const r of bucketData || []) {
          if (!latestBucket[r.person_id]) {
            latestBucket[r.person_id] = {
              bucket: r.candidate_bucket as CandidateBucket,
              reason: r.assignment_reason,
              flagged_reasons: (r as any).flagged_reasons || [],
            }
          }
        }

        // V1 (post-migration 031): track company category + review_status separately
        const companyCategory: Record<string, 'hardware' | 'non_hardware' | null> = {}
        const companyReviewStatus: Record<string, 'vetted' | 'unreviewed' | 'excluded' | null> = {}
        for (const c of companies || []) {
          companyCategory[c.company_id] = (c as any).category ?? null
          companyReviewStatus[c.company_id] = (c as any).review_status ?? null
        }

        const companyIds: Record<string, Set<string>> = {}
        const expLite: Record<string, ExperienceLite[]> = {}
        const allSpecs: Record<string, Set<string>> = {}
        for (const r of expData || []) {
          const pid = r.person_id
          if (r.company_id) { if (!companyIds[pid]) companyIds[pid] = new Set(); companyIds[pid].add(r.company_id) }
          if (!expLite[pid]) expLite[pid] = []
          expLite[pid].push({
            company_id: r.company_id,
            company_category: r.company_id ? (companyCategory[r.company_id] ?? null) : null,
            company_review_status: r.company_id ? (companyReviewStatus[r.company_id] ?? null) : null,
            specialty: (r as any).specialty_normalized ?? null, seniority: (r as any).seniority_normalized ?? null,
            start_date: (r as any).start_date ?? null,
            end_date: (r as any).end_date ?? null, is_current: (r as any).is_current ?? false,
            employment_type: (r as any).employment_type_normalized ?? null,
            title_raw: (r as any).title_raw ?? null, description_raw: (r as any).description_raw ?? null,
          })
          if ((r as any).specialty_normalized) { if (!allSpecs[pid]) allSpecs[pid] = new Set(); allSpecs[pid].add((r as any).specialty_normalized) }
        }
        const schoolIds: Record<string, Set<string>> = {}
        const eduLite: Record<string, EducationLite[]> = {}
        for (const r of eduData || []) {
          if (r.school_id) {
            if (!schoolIds[r.person_id]) schoolIds[r.person_id] = new Set()
            schoolIds[r.person_id].add(r.school_id)
            if (!eduLite[r.person_id]) eduLite[r.person_id] = []
            // Look up school_type from the schools data (already fetched)
            const schoolRecord = (schools as any[])?.find((s: any) => s.school_id === r.school_id)
            eduLite[r.person_id].push({
              school_id: r.school_id, school_name_raw: (r as any).school_name_raw ?? null,
              school_type: schoolRecord?.school_type ?? null,
              degree_raw: (r as any).degree_raw ?? null, degree_level: (r as any).degree_level ?? null,
              field_of_study_raw: (r as any).field_of_study_raw ?? null,
              field_of_study_normalized: (r as any).field_of_study_normalized ?? null,
              start_year: (r as any).start_year ?? null, end_year: (r as any).end_year ?? null,
            })
          }
        }

        // Build cMap BEFORE setPeople — the tenure mapping below reads cMap
        // synchronously inside its .map() callback. Declaring const cMap after
        // setPeople(...) creates a Temporal Dead Zone violation on the client
        // (Cannot access 'cMap' before initialization) even though TypeScript
        // accepts the forward reference.
        const cMap: Record<string, string> = {}
        for (const c of companies || []) cMap[c.company_id] = c.company_name

        setPeople((peopleData || []).map((r: any) => ({
          ...r, current_company_name: r.companies?.company_name || null,
          latest_bucket: latestBucket[r.person_id]?.bucket ?? null, latest_bucket_reason: latestBucket[r.person_id]?.reason ?? null, latest_flagged_reasons: latestBucket[r.person_id]?.flagged_reasons ?? null,
          company_ids_all: companyIds[r.person_id] || new Set(), school_ids_all: schoolIds[r.person_id] || new Set(),
          experiences_lite: expLite[r.person_id] || [], education_lite: eduLite[r.person_id] || [],
          all_specialties: allSpecs[r.person_id] || new Set(),
          tenure: computeTenureSummary(
            (expLite[r.person_id] || []).map((e: ExperienceLite) => ({ company_id: e.company_id, company_name: e.company_id ? cMap[e.company_id] || null : null, title_raw: e.title_raw, start_date: e.start_date, end_date: e.end_date, is_current: e.is_current, employment_type: e.employment_type, seniority: e.seniority } as FtExperience)),
            (eduLite[r.person_id] || []).map((e: EducationLite) => ({ start_year: e.start_year, end_year: e.end_year, degree_raw: e.degree_raw, degree_level: e.degree_level } as FtEducation)),
          ),
        })))

        setSeniorityOptions((srs || []).map(s => ({ value: s.seniority_normalized, label: formatSeniorityLabel(s.seniority_normalized) })))
        // V1: filter the company autocomplete to vetted+unreviewed (exclude excluded companies).
        // The unreviewed-tier auto-creates need to surface so admin can use them in compound filters
        // even before they're tagged. Excluded companies are explicitly out of scope for searches.
        setCompanyOptions((companies || []).filter((c: any) => c.review_status !== 'excluded').map((c: any) => ({
          value: c.company_id,
          label: c.company_name,
          sublabel: c.primary_industry || c.legacy_primary_industry_tag || undefined,
        })))
        setCompanyNameMap(cMap)
        setCompaniesRaw(companies || [])
        setSchoolOptions((schools || []).filter((s: any) => s.school_score != null).map((s: any) => ({ value: s.school_id, label: s.school_name, sublabel: s.is_foreign ? "Int'l" : undefined })))
        const snMap: Record<string, string> = {}
        for (const s of schools || []) snMap[s.school_id] = s.school_name
        setSchoolNameMap(snMap)

        // Accelerator options (school_type = 'accelerator')
        // Accelerator options removed — Y Combinator now lives in signal_dictionary.incubator.

        // Signals: group by person, deduplicate by signal_id (keep highest confidence)
        const sigMap: Record<string, DrawerSignal[]> = {}
        for (const r of signalsData || []) {
          if (!sigMap[r.person_id]) sigMap[r.person_id] = []
          const existing = sigMap[r.person_id].find(s => s.signal_id === r.signal_id)
          if (!existing) {
            sigMap[r.person_id].push({
              signal_id: r.signal_id, canonical_name: r.canonical_name,
              category: r.category, canonical_url: r.canonical_url,
              evidence_url: r.evidence_url, source_text: r.source_text,
              source: r.source, confidence: r.confidence,
            })
          } else if (r.confidence > existing.confidence) {
            Object.assign(existing, { confidence: r.confidence, evidence_url: r.evidence_url || existing.evidence_url, source_text: r.source_text || existing.source_text })
          }
        }
        setSignalsByPerson(sigMap)

        // Signal filter options: category-level + individual signals
        // Display order. 'scholarship' is collapsed into 'academic_distinction'
        // (UI label "Academic Achievement"); it never appears as its own
        // 'founder' removed: replaced by VC-Backed / Bootstrapped founder type
        // filter (driven by people.is_vc_backed_founder + is_bootstrapped_founder,
        // not signal_dictionary). 'scholarship' rolls into 'academic_distinction'
        // (single Academic Achievement filter).
        const SIGNAL_CATEGORY_ORDER = ['incubator','university_incubator_accelerator','university_fellowship','fellowship','university_program','student_venture_fund','military','national_lab','research_institute','university_lab','academic_distinction','olympiad','competition','hackathon','athletics','engineering_team','student_leadership','greek_life']
        // Filter labels — no "Any X" prefix per universal one-bucket policy.
        // engineering_team / competition relabeled per category-rename spec.
        const SIGNAL_CATEGORY_LABELS: Record<string, string> = {
          incubator:'Incubator',
          university_program:'University Program', university_fellowship:'University Fellowship',
          university_incubator_accelerator:'University Accelerator', university_lab:'University Lab',
          research_institute:'Research Institute', student_venture_fund:'Student VC',
          military:'Military', national_lab:'National Lab',
          fellowship:'Fellowship', scholarship:'Academic Achievement',
          academic_distinction:'Academic Achievement', olympiad:'Olympiad',
          publication:'Publication', patent:'Patent', open_source:'Open Source',
          speaking:'Speaking', writing:'Writing',
          competition:'Engineering Competition', hackathon:'Hackathon',
          athletics:'Athletics', engineering_team:'University Team', student_leadership:'Leadership', greek_life:'Greek Life',
          career_changer:'Career Changer', self_taught:'Self-Taught',
          teaching:'Teaching', hospitality:'Hospitality',
          language:'Language', other:'Other',
          // Legacy 'founder' label kept for any old saved-search references that
          // still encode cat:founder — won't appear in the dropdown but profile
          // chip code can still resolve the label.
          founder:'Founder',
        }
        const searchableById = new Map<string, boolean>()
        for (const r of (signalSearchableData || []) as Array<{ id: string; is_searchable: boolean }>) {
          searchableById.set(r.id, r.is_searchable)
        }
        const sigOpts: MultiSelectOption[] = []
        // Universal one-bucket policy: emit ONLY category-level filters, no
        // individual signal options. Granular search (specific fellowships,
        // hackathons, etc.) happens via AI chat search workstream, not filter dropdown.
        for (const cat of SIGNAL_CATEGORY_ORDER) {
          sigOpts.push({ value: `cat:${cat}`, label: SIGNAL_CATEGORY_LABELS[cat] || cat })
        }
        // Per universal one-bucket policy (migration 063: is_searchable=FALSE on
        // all rows), no individual signal options appear. Block below is kept
        // structurally but produces no output today — defensive in case any row
        // is manually set is_searchable=TRUE in DB.
        const allSignalIds = new Map<string, { name: string; cat: string }>()
        for (const sigs of Object.values(sigMap)) {
          for (const s of sigs) { if (!allSignalIds.has(s.signal_id)) allSignalIds.set(s.signal_id, { name: s.canonical_name, cat: s.category }) }
        }
        const sorted = Array.from(allSignalIds.entries()).sort((a, b) => {
          const catA = SIGNAL_CATEGORY_ORDER.indexOf(a[1].cat), catB = SIGNAL_CATEGORY_ORDER.indexOf(b[1].cat)
          if (catA !== catB) return catA - catB
          return a[1].name.localeCompare(b[1].name)
        })
        for (const [id, info] of sorted) {
          if (searchableById.get(id) !== true) continue
          sigOpts.push({ value: id, label: info.name, sublabel: SIGNAL_CATEGORY_LABELS[info.cat] || info.cat })
        }
        setSignalOptions(sigOpts)

        // Field of study options: distinct normalized values from the dictionary.
        const fosByNorm = new Map<string, string>()  // norm → display label
        for (const r of (fieldOfStudyData || []) as Array<{ field_of_study_normalized: string; domain_group: string | null }>) {
          if (!fosByNorm.has(r.field_of_study_normalized)) {
            // Display label = title-cased version of the snake_case norm
            const label = r.field_of_study_normalized
              .split('_')
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')
              .replace(/\bMl\b/g, 'ML').replace(/\bAi\b/g, 'AI').replace(/\bEcs\b/g, 'ECS')
            fosByNorm.set(r.field_of_study_normalized, label)
          }
        }
        setFieldOfStudyOptions(Array.from(fosByNorm.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)))

        // School groups: build options from distinct values + lookup map
        const sgMap: Record<string, string[]> = {}
        const sgVals = new Set<string>()
        for (const s of schools || []) {
          const groups = (s as any).school_groups || []
          if (groups.length > 0) { sgMap[s.school_id] = groups; for (const g of groups) sgVals.add(g) }
        }
        setSchoolGroupsMap(sgMap)
        const sgLabels: Record<string, string> = { top_military_academy: 'Top Military Academy', top_mba: 'Top MBA Program', top_law_school: 'Top Law School' }
        setSchoolGroupOptions(Array.from(sgVals).sort().map(g => ({ value: g, label: sgLabels[g] || g.replace(/_/g, ' ') })))

        // Company groups: same pattern
        const cgMap: Record<string, string[]> = {}
        const cgVals = new Set<string>()
        for (const c of companies || []) {
          const groups = (c as any).company_groups || []
          if (groups.length > 0) { cgMap[c.company_id] = groups; for (const g of groups) cgVals.add(g) }
        }
        setCompanyGroupsMap(cgMap)
        const cgLabels: Record<string, string> = { top_law_firm: 'Top Law Firm' }
        setCompanyGroupOptions(Array.from(cgVals).sort().map(g => ({ value: g, label: cgLabels[g] || g.replace(/_/g, ' ') })))

        // Roles
        setRoleOptions((roles || []).map((r: any) => ({ value: r.role_id, label: r.role_name })))

        // Build role→specialties map
        const rm: Record<string, string[]> = {}
        for (const m of rsMap || []) { if (!rm[m.role_id]) rm[m.role_id] = []; rm[m.role_id].push(m.specialty_normalized) }
        setRoleSpecialtyMap(rm)

        // All specialties grouped
        const dict = (specDict || []) as Array<{ specialty_normalized: string; parent_function: string[] | null }>
        // parent_function is TEXT[] (migration 072, multi-parent). Join all parents
        // to a string FIRST, then format underscores. Guard against null/empty/legacy-string.
        setAllSpecialtyOptions(dict.map(d => ({ value: d.specialty_normalized, label: d.specialty_normalized.replace(/_/g, ' '), sublabel: (Array.isArray(d.parent_function) ? d.parent_function.join(', ') : (d.parent_function || '')).replace(/_/g, ' ') })))

        setError(null)
      } catch (err: any) { setError(err?.message || 'Failed to fetch.') }
      finally { setLoading(false) }
    }
    fetchAll()
  }, [])

  // Contextual specialty options (filtered by selected roles)
  const filteredSpecialtyOptions = useMemo(() => {
    if (roleSel.length === 0) return allSpecialtyOptions
    const allowedSpecs = new Set<string>()
    for (const rid of roleSel) { for (const s of roleSpecialtyMap[rid] || []) allowedSpecs.add(s) }
    return allSpecialtyOptions.filter(o => allowedSpecs.has(o.value))
  }, [roleSel, roleSpecialtyMap, allSpecialtyOptions])

  // ─── Filter + sort ────────────────────────────────────────────────────

  const filteredPeople = useMemo(() => {
    let rows: PersonWithFilters[] = [...people]
    // Default exclusion: current founders are not recruitable targets per V1 spec.
    // Opt-in toggle to include them lives in the backlog (kebab/recruiter view PR).
    rows = rows.filter(p => !p.is_current_founder)
    if (searchQuery) { const q = searchQuery.toLowerCase(); rows = rows.filter(p => p.full_name?.toLowerCase().includes(q) || p.current_company_name?.toLowerCase().includes(q) || p.current_title_raw?.toLowerCase().includes(q) || p.location_name?.toLowerCase().includes(q)) }
    // Bucket filter. Default-exclude 'flagged' unless admin explicitly opts in
    // via the bucket sidebar selection (matches user spec: "flagged means they
    // don't show up unless we manually override that it needs review").
    if (bucketSel.length > 0) {
      const s = new Set(bucketSel)
      rows = rows.filter(p => p.latest_bucket && s.has(p.latest_bucket))
    } else {
      rows = rows.filter(p => p.latest_bucket !== 'flagged')
    }
    if (stageSel.length > 0) { const s = new Set(stageSel); rows = rows.filter(p => p.career_stage_assigned && s.has(p.career_stage_assigned)) }
    // Seniority with per-pill scope (OR across pills)
    if (seniorityPills.length > 0) {
      rows = rows.filter(p => seniorityPills.some(pill => {
        if (pill.scope === 'currently') return p.experiences_lite.some(e => e.is_current && e.seniority === pill.value)
        if (pill.scope === 'previously') {
          const hasPast = p.experiences_lite.some(e => !e.is_current && e.seniority === pill.value)
          const hasCurrent = p.experiences_lite.some(e => e.is_current && e.seniority === pill.value)
          return hasPast && !hasCurrent
        }
        return p.highest_seniority_reached === pill.value
      }))
    }

    // School with temporal scope (infer current from end_year)
    if (schoolSel.length > 0) {
      const s = new Set(schoolSel)
      const currentYear = new Date().getFullYear()
      if (schoolTemporalScope === 'currently') {
        rows = rows.filter(p => p.education_lite?.some(e => s.has(e.school_id) && (e.end_year == null || e.end_year >= currentYear)))
      } else if (schoolTemporalScope === 'previously') {
        rows = rows.filter(p => {
          const hasEver = p.education_lite?.some(e => s.has(e.school_id))
          const hasCurrent = p.education_lite?.some(e => s.has(e.school_id) && (e.end_year == null || e.end_year >= currentYear))
          return hasEver && !hasCurrent
        })
      } else {
        rows = rows.filter(p => Array.from(p.school_ids_all).some(id => s.has(id)))
      }
    }

    // Degree level — match candidates with at least one education entry at any selected level
    if (degreeSel.length > 0) {
      const s = new Set(degreeSel)
      rows = rows.filter(p => p.education_lite?.some(e => e.degree_level && s.has(e.degree_level)))
    }

    // Field of study — match candidates with at least one education entry whose
    // normalized field_of_study matches the selection. Backfilled via dictionary join.
    if (fieldOfStudySel.length > 0) {
      const s = new Set(fieldOfStudySel)
      rows = rows.filter(p => p.education_lite?.some(e => e.field_of_study_normalized && s.has(e.field_of_study_normalized)))
    }

    // Founder type — VC-Backed and/or Bootstrapped (multi-select; OR semantics).
    if (founderTypeSel.length > 0) {
      const wantVc = founderTypeSel.includes('vc_backed')
      const wantBoot = founderTypeSel.includes('bootstrapped')
      rows = rows.filter(p => (wantVc && p.is_vc_backed_founder) || (wantBoot && p.is_bootstrapped_founder))
    }

    // Location
    if (locationSel.length > 0) {
      rows = rows.filter(p => { if (!p.location_name) return false; return locationSel.some(sel => p.location_name!.toLowerCase().includes(sel.toLowerCase())) })
    }

    // Role filter with per-pill scope (OR across pills)
    if (rolePills.length > 0) {
      rows = rows.filter(p => rolePills.some(pill => {
        const specs = new Set(roleSpecialtyMap[pill.value] || [])
        if (specs.size === 0) return false
        if (pill.scope === 'currently') return p.primary_specialty && specs.has(p.primary_specialty)
        if (pill.scope === 'previously') {
          const hasPast = p.experiences_lite.some(e => !e.is_current && e.specialty && specs.has(e.specialty))
          const hasCurrent = p.primary_specialty && specs.has(p.primary_specialty)
          return hasPast && !hasCurrent
        }
        return Array.from(p.all_specialties).some(s => specs.has(s))
      }))
    }

    // Specialty filter with per-pill scope (OR across pills)
    if (specialtyPills.length > 0) {
      rows = rows.filter(p => specialtyPills.some(pill => {
        if (pill.scope === 'currently') return p.primary_specialty === pill.value
        if (pill.scope === 'previously') {
          const hasPast = p.experiences_lite.some(e => !e.is_current && e.specialty === pill.value)
          const hasCurrent = p.primary_specialty === pill.value
          return hasPast && !hasCurrent
        }
        return p.all_specialties && (p.all_specialties as Set<string>).has(pill.value)
      }))
    }

    if (clearanceSel.length > 0) { const s = new Set(clearanceSel); rows = rows.filter(p => p.clearance_level && s.has(p.clearance_level)) }

    // Signals filter (no temporal scope — achievements are timeless)
    if (signalSel.length > 0) {
      const rawSelectedCats = signalSel.filter(v => v.startsWith('cat:')).map(v => v.slice(4))
      const selectedIds = new Set(signalSel.filter(v => !v.startsWith('cat:')))
      // 'academic_distinction' as a filter selection matches BOTH academic_distinction
      // AND scholarship person_signals (single "Academic Achievement" filter that spans both DB categories).
      const expandedCats = new Set<string>()
      for (const c of rawSelectedCats) {
        expandedCats.add(c)
        if (c === 'academic_distinction') expandedCats.add('scholarship')
      }
      rows = rows.filter(p => {
        const personSigs = signalsByPerson[p.person_id] || []
        return personSigs.some(s => selectedIds.has(s.signal_id) || expandedCats.has(s.category))
      })
    }

    // School groups filter with temporal scope
    if (schoolGroupSel.length > 0) {
      const selGroups = new Set(schoolGroupSel)
      const matchesGroup = (sid: string) => { const g = schoolGroupsMap[sid] || []; return g.some(v => selGroups.has(v)) }
      const currentYear = new Date().getFullYear()
      if (schoolGroupScope === 'currently') {
        rows = rows.filter(p => p.education_lite?.some(e => matchesGroup(e.school_id) && (e.end_year == null || e.end_year >= currentYear)))
      } else if (schoolGroupScope === 'previously') {
        rows = rows.filter(p => {
          const hasEver = p.education_lite?.some(e => matchesGroup(e.school_id))
          const hasCurrent = p.education_lite?.some(e => matchesGroup(e.school_id) && (e.end_year == null || e.end_year >= currentYear))
          return hasEver && !hasCurrent
        })
      } else {
        rows = rows.filter(p => Array.from(p.school_ids_all).some(sid => matchesGroup(sid)))
      }
    }

    // Company groups filter with temporal scope
    if (companyGroupSel.length > 0) {
      const selGroups = new Set(companyGroupSel)
      const matchesGroup = (cid: string) => { const g = companyGroupsMap[cid] || []; return g.some(v => selGroups.has(v)) }
      if (companyGroupScope === 'currently') {
        rows = rows.filter(p => p.experiences_lite.some(e => e.company_id && e.is_current && matchesGroup(e.company_id)))
      } else if (companyGroupScope === 'previously') {
        rows = rows.filter(p => {
          const hasEver = p.experiences_lite.some(e => e.company_id && matchesGroup(e.company_id))
          const hasCurrent = p.experiences_lite.some(e => e.company_id && e.is_current && matchesGroup(e.company_id))
          return hasEver && !hasCurrent
        })
      } else {
        rows = rows.filter(p => p.experiences_lite.some(e => e.company_id && matchesGroup(e.company_id)))
      }
    }

    // Accelerator filter removed (PR #4 cleanup).

    // V1 (Option C): both scopes default to 'all' so candidate visibility isn't silently
    // filtered after migration. Admin can opt into stricter scopes via FilterSidebar.
    if (categoryScope === 'hardware') rows = rows.filter(p => p.experiences_lite.some(e => e.company_category === 'hardware'))
    else if (categoryScope === 'non_hardware') rows = rows.filter(p => p.experiences_lite.some(e => e.company_category === 'non_hardware'))
    if (reviewStatusScope === 'vetted') rows = rows.filter(p => p.experiences_lite.some(e => e.company_review_status === 'vetted'))
    else if (reviewStatusScope === 'unreviewed') rows = rows.filter(p => p.experiences_lite.some(e => e.company_review_status === 'unreviewed'))
    else if (reviewStatusScope === 'excluded') rows = rows.filter(p => p.experiences_lite.some(e => e.company_review_status === 'excluded'))

    // Compound company filter with temporal scope + multi-select (OR across companies)
    // Compound company filter with per-pill scope (OR across pills)
    if (compoundCompanyPills.length > 0) {
      const y1 = compoundYearMin ? parseInt(compoundYearMin, 10) : null
      const y2 = compoundYearMax ? parseInt(compoundYearMax, 10) : null
      const needSpecs = compoundSpecialties.length > 0 ? new Set(compoundSpecialties) : null
      const rStart = y1 && !isNaN(y1) ? new Date(y1, 0, 1).getTime() : null
      const rEnd = y2 && !isNaN(y2) ? new Date(y2, 11, 31).getTime() : null

      rows = rows.filter(p => compoundCompanyPills.some(pill => {
        const matchesExp = (e: typeof rows[0]['experiences_lite'][0]) => {
          if (e.company_id !== pill.value) return false
          if (needSpecs && !(e.specialty && needSpecs.has(e.specialty))) return false
          if (pill.scope === 'currently' && !e.is_current) return false
          if (pill.scope === 'previously' && e.is_current) return false
          if (rStart || rEnd) {
            const eS = e.start_date ? new Date(e.start_date).getTime() : null
            const eE = e.end_date ? new Date(e.end_date).getTime() : null
            if (rEnd && eS && eS > rEnd) return false
            if (rStart && eE && eE < rStart) return false
          }
          return true
        }
        if (pill.scope === 'previously') {
          const hasMatch = p.experiences_lite.some(e => matchesExp(e))
          const hasCurrent = p.experiences_lite.some(e => e.company_id === pill.value && e.is_current)
          return hasMatch && !hasCurrent
        }
        return p.experiences_lite.some(e => matchesExp(e))
      }))
    }

    // ── Condition rows (new model) ──────────────────────────────────────
    // AND across all company condition rows. Skip rows with no valid target.
    for (const row of companyConditions) {
      // Resolve target to company IDs — skip if no valid target
      let targetIds: Set<string>
      if (row.target.type === 'specific' && row.target.companyIds?.length) {
        targetIds = new Set(row.target.companyIds)
      } else if (row.target.type === 'attributes' && row.target.companyAttributes) {
        const ca = row.target.companyAttributes
        if (!ca.stage?.length && !ca.size?.length && !ca.category?.length && !ca.industry?.length && !ca.foundedAfter && !ca.foundedBefore) continue // no attributes set
        const attrs = row.target.companyAttributes
        const matching = companiesRaw.filter(comp => {
          if (attrs.stage?.length && (!comp.funding_stage || !attrs.stage.includes(comp.funding_stage))) return false
          if (attrs.size?.length && (!comp.headcount_range || !attrs.size.includes(comp.headcount_range))) return false
          // V1: filter by category (hardware/non_hardware) — replaces legacy focus
          if (attrs.category?.length && (!comp.category || !attrs.category.includes(comp.category))) return false
          // V1: industry filter checks the primary_industry OR any element in industries[].
          // Falls back to legacy_primary_industry_tag for un-tagged companies.
          if (attrs.industry?.length) {
            const matchesNew = comp.primary_industry && attrs.industry.includes(comp.primary_industry)
            const matchesArray = Array.isArray(comp.industries) && comp.industries.some((i: string) => attrs.industry!.includes(i))
            const matchesLegacy = comp.legacy_primary_industry_tag && attrs.industry.includes(comp.legacy_primary_industry_tag)
            if (!matchesNew && !matchesArray && !matchesLegacy) return false
          }
          if (attrs.foundedAfter && (!comp.founding_year || comp.founding_year < attrs.foundedAfter)) return false
          if (attrs.foundedBefore && (!comp.founding_year || comp.founding_year > attrs.foundedBefore)) return false
          return true
        })
        targetIds = new Set(matching.map((m: any) => m.company_id))
      } else {
        continue // no valid target
      }
      if (targetIds.size === 0) continue

      rows = rows.filter(p => {
        const matchingExps = p.experiences_lite.filter(e => {
          if (!e.company_id || !targetIds.has(e.company_id)) return false
          if (row.scope === 'currently' && !e.is_current) return false
          if (row.scope === 'previously' && e.is_current) return false
          if (row.specialty && e.specialty !== row.specialty) return false
          if (row.seniority && e.seniority !== row.seniority) return false
          if (row.yearFrom || row.yearTo) {
            const eS = e.start_date ? new Date(e.start_date).getTime() : null
            const eE = e.end_date ? new Date(e.end_date).getTime() : null
            const rStart = row.yearFrom ? new Date(row.yearFrom, 0, 1).getTime() : null
            const rEnd = row.yearTo ? new Date(row.yearTo, 11, 31).getTime() : null
            if (rEnd && eS && eS > rEnd) return false
            if (rStart && eE && eE < rStart) return false
          }
          return true
        })
        if (row.scope === 'previously') {
          const hasCurrent = p.experiences_lite.some(e => e.company_id && targetIds.has(e.company_id) && e.is_current)
          return matchingExps.length > 0 && !hasCurrent
        }
        return matchingExps.length > 0
      })
    }

    // AND across all school condition rows. Skip rows with no valid target.
    const currentYear = new Date().getFullYear()
    for (const row of schoolConditions) {
      let targetIds: Set<string>
      if (row.target.type === 'specific' && row.target.schoolIds?.length) {
        targetIds = new Set(row.target.schoolIds)
      } else if (row.target.type === 'attributes' && row.target.schoolAttributes) {
        const attrs = row.target.schoolAttributes
        if (attrs.schoolGroups?.length) {
          const selGroups = new Set(attrs.schoolGroups)
          const matching = Object.entries(schoolGroupsMap).filter(([, groups]) => groups.some(g => selGroups.has(g))).map(([id]) => id)
          targetIds = new Set(matching)
        } else {
          continue
        }
      } else {
        continue
      }
      if (targetIds.size === 0) continue

      rows = rows.filter(p => {
        if (row.scope === 'currently') {
          return p.education_lite.some(e => targetIds.has(e.school_id) && (e.end_year == null || e.end_year >= currentYear))
        } else if (row.scope === 'previously') {
          const hasEver = p.education_lite.some(e => targetIds.has(e.school_id))
          const hasCurrent = p.education_lite.some(e => targetIds.has(e.school_id) && (e.end_year == null || e.end_year >= currentYear))
          return hasEver && !hasCurrent
        } else {
          return p.education_lite.some(e => targetIds.has(e.school_id))
        }
      })
    }

    const minN = yearsMin ? parseFloat(yearsMin) : null
    const maxN = yearsMax ? parseFloat(yearsMax) : null
    if (minN && !isNaN(minN)) rows = rows.filter(p => p.years_experience_estimate != null && p.years_experience_estimate >= minN)
    if (maxN && !isNaN(maxN)) rows = rows.filter(p => p.years_experience_estimate != null && p.years_experience_estimate <= maxN)

    // Boolean title search with temporal scope
    if (titleBoolean.trim()) {
      rows = rows.filter(p => {
        if (titleBooleanScope === 'currently') return matchesBoolean(p.current_title_raw || '', titleBoolean)
        if (titleBooleanScope === 'previously') {
          const hasPast = p.experiences_lite.some(e => !e.is_current && matchesBoolean(e.title_raw || '', titleBoolean))
          const hasCurrent = matchesBoolean(p.current_title_raw || '', titleBoolean)
          return hasPast && !hasCurrent
        }
        return p.experiences_lite.some(e => matchesBoolean(e.title_raw || '', titleBoolean))
      })
    }
    // Boolean experience/skills search (no temporal scope — searches all text)
    if (experienceBoolean.trim()) {
      rows = rows.filter(p => {
        const texts = [p.headline_raw || '', p.summary_raw || '', p.narrative_summary || '']
        for (const e of p.experiences_lite) { if (e.description_raw) texts.push(e.description_raw) }
        return texts.some(t => matchesBoolean(t, experienceBoolean))
      })
    }

    // Tenure filters
    const ctMin = currentTenureMin ? parseFloat(currentTenureMin) : null
    const ctMax = currentTenureMax ? parseFloat(currentTenureMax) : null
    if (ctMin !== null && !isNaN(ctMin)) rows = rows.filter(p => p.tenure.currentTenureYears != null && p.tenure.currentTenureYears >= ctMin)
    if (ctMax !== null && !isNaN(ctMax)) rows = rows.filter(p => p.tenure.currentTenureYears != null && p.tenure.currentTenureYears <= ctMax)
    const atMin = avgTenureMin ? parseFloat(avgTenureMin) : null
    const atMax = avgTenureMax ? parseFloat(avgTenureMax) : null
    const getAvg = (p: PersonWithFilters) => avgTenureIncludeCurrent ? p.tenure.avgTenureIncCurrentYears : p.tenure.avgTenureYears
    if (atMin !== null && !isNaN(atMin)) rows = rows.filter(p => { const v = getAvg(p); return v != null && v >= atMin })
    if (atMax !== null && !isNaN(atMax)) rows = rows.filter(p => { const v = getAvg(p); return v != null && v <= atMax })

    // Sort
    if (sortField) {
      rows.sort((a, b) => {
        let av: number, bv: number
        if (sortField === 'current_tenure') { av = a.tenure.currentTenureYears ?? -1; bv = b.tenure.currentTenureYears ?? -1 }
        else if (sortField === 'avg_tenure') { av = getAvg(a) ?? -1; bv = getAvg(b) ?? -1 }
        else { av = (a[sortField] as number) ?? -1; bv = (b[sortField] as number) ?? -1 }
        return sortDirection === 'asc' ? av - bv : bv - av
      })
    }
    return rows
  }, [people, searchQuery, bucketSel, stageSel, rolePills, seniorityPills, schoolSel, schoolTemporalScope, locationSel, specialtyPills, clearanceSel, categoryScope, reviewStatusScope, compoundCompanyPills, compoundSpecialties, compoundYearMin, compoundYearMax, yearsMin, yearsMax, titleBoolean, titleBooleanScope, experienceBoolean, signalSel, schoolGroupSel, schoolGroupScope, companyGroupSel, companyGroupScope, degreeSel, fieldOfStudySel, founderTypeSel, companyConditions, schoolConditions, companiesRaw, signalsByPerson, schoolGroupsMap, companyGroupsMap, sortField, sortDirection, roleSpecialtyMap, currentTenureMin, currentTenureMax, avgTenureMin, avgTenureMax, avgTenureIncludeCurrent])

  const activeFilterCount =
    (roleSel.length > 0 ? 1 : 0) + (bucketSel.length > 0 ? 1 : 0) + (stageSel.length > 0 ? 1 : 0) +
    (senioritySel.length > 0 ? 1 : 0) + (schoolSel.length > 0 ? 1 : 0) + (locationSel.length > 0 ? 1 : 0) +
    (specialtySel.length > 0 ? 1 : 0) + (clearanceSel.length > 0 ? 1 : 0) +
    (categoryScope !== 'all' ? 1 : 0) + (reviewStatusScope !== 'all' ? 1 : 0) +
    (compoundCompany.length > 0 ? 1 : 0) + (yearsMin || yearsMax ? 1 : 0) + (titleBoolean ? 1 : 0) + (experienceBoolean ? 1 : 0) +
    (signalSel.length > 0 ? 1 : 0) + (schoolGroupSel.length > 0 ? 1 : 0) + (companyGroupSel.length > 0 ? 1 : 0) +
    (degreeSel.length > 0 ? 1 : 0) + (fieldOfStudySel.length > 0 ? 1 : 0) + (founderTypeSel.length > 0 ? 1 : 0) +
    (companyConditions.length > 0 ? 1 : 0) + (schoolConditions.length > 0 ? 1 : 0) +
    (currentTenureMin || currentTenureMax ? 1 : 0) + (avgTenureMin || avgTenureMax ? 1 : 0)

  const clearAllFilters = () => {
    setSearchQuery(''); setRoleSel([]); setBucketSel([]); setStageSel([]); setSenioritySel([])
    setSchoolSel([]); setLocationSel([]); setSpecialtySel([])
    setClearanceSel([]); setCategoryScope('all'); setReviewStatusScope('all'); setCompoundCompany([]); setCompoundSpecialties([])
    setCompoundYearMin(''); setCompoundYearMax('')
    setYearsMin(''); setYearsMax(''); setTitleBoolean(''); setTitleBooleanScope('ever'); setExperienceBoolean('')
    setSignalSel([]); setSchoolGroupSel([]); setCompanyGroupSel([]); setDegreeSel([]); setFieldOfStudySel([]); setFounderTypeSel([])
    setCompanyConditions([]); setSchoolConditions([])
    setRolePills([]); setSpecialtyPills([]); setSeniorityPills([]); setCompoundCompanyPills([])
    setSchoolTemporalScope('ever'); setSchoolGroupScope('ever'); setCompanyGroupScope('ever')
    setCurrentTenureMin(''); setCurrentTenureMax(''); setAvgTenureMin(''); setAvgTenureMax(''); setAvgTenureIncludeCurrent(true)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(p => p === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection('desc') }
  }

  function toggleSelect(id: string) { setSelectedIds(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n }) }
  function toggleSelectAll() { setSelectedIds(selectedIds.size === filteredPeople.length ? new Set() : new Set(filteredPeople.map(p => p.person_id))) }
  async function handleBulkDelete() {
    if (!bulkDeleteConfirm) { setBulkDeleteConfirm(true); return }
    setBulkDeleting(true)
    for (const id of Array.from(selectedIds)) await fetch(`/api/people/${id}`, { method: 'DELETE' })
    setPeople(p => p.filter(x => !selectedIds.has(x.person_id)))
    setSelectedIds(new Set()); setBulkDeleting(false); setBulkDeleteConfirm(false)
  }

  // ─── Chips ────────────────────────────────────────────────────────────

  const chips: Array<{ label: string; onRemove: () => void }> = []
  if (categoryScope !== 'all') chips.push({ label: `Category: ${categoryScope.replace('_', ' ')}`, onRemove: () => setCategoryScope('all') })
  if (reviewStatusScope !== 'all') chips.push({ label: `Visibility: ${reviewStatusScope}`, onRemove: () => setReviewStatusScope('all') })
  for (const pill of rolePills) { const r = roleOptions.find(o => o.value === pill.value); chips.push({ label: `Role: ${r?.label || pill.value}${pill.scope !== 'ever' ? ` · ${pill.scope}` : ''}`, onRemove: () => setRolePills(rolePills.filter(p => p.value !== pill.value)) }) }
  for (const pill of specialtyPills) chips.push({ label: `Specialty: ${pill.value.replace(/_/g, ' ')}${pill.scope !== 'ever' ? ` · ${pill.scope}` : ''}`, onRemove: () => setSpecialtyPills(specialtyPills.filter(p => p.value !== pill.value)) })
  for (const pill of seniorityPills) chips.push({ label: `Seniority: ${formatSeniorityLabel(pill.value)}${pill.scope !== 'ever' ? ` · ${pill.scope}` : ''}`, onRemove: () => setSeniorityPills(seniorityPills.filter(p => p.value !== pill.value)) })
  for (const v of bucketSel) chips.push({ label: `Bucket: ${v.replace(/_/g, ' ')}`, onRemove: () => setBucketSel(bucketSel.filter(x => x !== v)) })
  for (const v of stageSel) chips.push({ label: `Stage: ${v.replace(/_/g, ' ')}`, onRemove: () => setStageSel(stageSel.filter(x => x !== v)) })
  if (yearsMin || yearsMax) chips.push({ label: `Yrs: ${yearsMin || '0'}–${yearsMax || '∞'}`, onRemove: () => { setYearsMin(''); setYearsMax('') } })
  for (const v of clearanceSel) chips.push({ label: `Clearance: ${v.replace(/_/g, ' ')}`, onRemove: () => setClearanceSel(clearanceSel.filter(x => x !== v)) })
  for (const v of locationSel) chips.push({ label: `Location: ${v}`, onRemove: () => setLocationSel(locationSel.filter(x => x !== v)) })
  for (const pill of compoundCompanyPills) {
    const label = companyOptions.find(c => c.value === pill.value)?.label || '?'
    chips.push({ label: `At: ${label}${pill.scope !== 'ever' ? ` · ${pill.scope}` : ''}`, onRemove: () => {
      setCompoundCompanyPills(compoundCompanyPills.filter(p => p.value !== pill.value))
    }})
  }
  for (const v of schoolSel) { const sc = schoolOptions.find(s => s.value === v); chips.push({ label: `School: ${sc?.label || v}`, onRemove: () => setSchoolSel(schoolSel.filter(x => x !== v)) }) }
  for (const v of degreeSel) { chips.push({ label: `Degree: ${v.toUpperCase()}`, onRemove: () => setDegreeSel(degreeSel.filter(x => x !== v)) }) }
  if (titleBoolean) chips.push({ label: `Title: "${titleBoolean}"`, onRemove: () => setTitleBoolean('') })
  if (experienceBoolean) chips.push({ label: `Keywords: "${experienceBoolean}"`, onRemove: () => setExperienceBoolean('') })

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64vh', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)' }}>Loading people...</div>
  if (error) return <div style={{ padding: 24 }}><div style={{ background: 'var(--red-950)', border: '1px solid var(--red-800)', borderRadius: 'var(--r-card)', padding: 16 }}><p style={{ color: 'var(--red-400)', fontSize: 'var(--fs-13)' }}>{error}</p></div></div>

  const ThemeToggle = require('./ThemeToggle').default
  const eyebrow: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-medium)' as any, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tr-eyebrow)', color: 'var(--fg-tertiary)', whiteSpace: 'nowrap' }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-canvas)', color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)' }}>
      <FilterSidebar
        roleSel={roleSel} setRoleSel={setRoleSel} rolePills={rolePills} setRolePills={setRolePills} roleOptions={roleOptions}
        specialtySel={specialtySel} setSpecialtySel={setSpecialtySel}
        specialtyPills={specialtyPills} setSpecialtyPills={setSpecialtyPills}
        specialtyOptions={filteredSpecialtyOptions} allSpecialtyOptions={allSpecialtyOptions}
        senioritySel={senioritySel} setSenioritySel={setSenioritySel} seniorityPills={seniorityPills} setSeniorityPills={setSeniorityPills} seniorityOptions={seniorityOptions}
        bucketSel={bucketSel} setBucketSel={setBucketSel}
        stageSel={stageSel} setStageSel={setStageSel}
        yearsMin={yearsMin} setYearsMin={setYearsMin} yearsMax={yearsMax} setYearsMax={setYearsMax}
        clearanceSel={clearanceSel} setClearanceSel={setClearanceSel}
        locationSel={locationSel} setLocationSel={setLocationSel} locationOptions={locationOptions}
        categoryScope={categoryScope} setCategoryScope={setCategoryScope}
        reviewStatusScope={reviewStatusScope} setReviewStatusScope={setReviewStatusScope}
        compoundCompany={compoundCompany} setCompoundCompany={setCompoundCompany}
        compoundCompanyPills={compoundCompanyPills} setCompoundCompanyPills={setCompoundCompanyPills}
        compoundSpecialties={compoundSpecialties} setCompoundSpecialties={setCompoundSpecialties}
        compoundYearMin={compoundYearMin} setCompoundYearMin={setCompoundYearMin}
        compoundYearMax={compoundYearMax} setCompoundYearMax={setCompoundYearMax}
        companyOptions={companyOptions}
        schoolSel={schoolSel} setSchoolSel={setSchoolSel} schoolOptions={schoolOptions}
        schoolScope={schoolScope} setSchoolScope={setSchoolScope}
        schoolGroupSel={schoolGroupSel} setSchoolGroupSel={setSchoolGroupSel} schoolGroupOptions={schoolGroupOptions}
        degreeSel={degreeSel} setDegreeSel={setDegreeSel}
        fieldOfStudySel={fieldOfStudySel} setFieldOfStudySel={setFieldOfStudySel} fieldOfStudyOptions={fieldOfStudyOptions}
        founderTypeSel={founderTypeSel} setFounderTypeSel={setFounderTypeSel}
        companyGroupSel={companyGroupSel} setCompanyGroupSel={setCompanyGroupSel} companyGroupOptions={companyGroupOptions}
        signalSel={signalSel} setSignalSel={setSignalSel} signalOptions={signalOptions}
        companyConditionCount={companyConditions.length}
        schoolConditionCount={schoolConditions.length}
        titleBoolean={titleBoolean} setTitleBoolean={setTitleBoolean}
        experienceBoolean={experienceBoolean} setExperienceBoolean={setExperienceBoolean}
        currentTenureMin={currentTenureMin} setCurrentTenureMin={setCurrentTenureMin}
        currentTenureMax={currentTenureMax} setCurrentTenureMax={setCurrentTenureMax}
        avgTenureMin={avgTenureMin} setAvgTenureMin={setAvgTenureMin}
        avgTenureMax={avgTenureMax} setAvgTenureMax={setAvgTenureMax}
        avgTenureIncludeCurrent={avgTenureIncludeCurrent} setAvgTenureIncludeCurrent={setAvgTenureIncludeCurrent}
        clearAllFilters={clearAllFilters} activeFilterCount={activeFilterCount}
        onOpenBuilder={() => {
          // Encode current filter state as JSON in URL param
          const state = {
            rolePills, specialtyPills, seniorityPills, bucketSel, stageSel, yearsMin, yearsMax, clearanceSel, locationSel, categoryScope, reviewStatusScope, compoundCompanyPills, compoundSpecialties, compoundYearMin, compoundYearMax, schoolSel, schoolTemporalScope, degreeSel, fieldOfStudySel, founderTypeSel, titleBoolean, titleBooleanScope, experienceBoolean, signalSel, schoolGroupSel, schoolGroupScope, companyGroupSel, companyGroupScope,
            currentTenureMin, currentTenureMax, avgTenureMin, avgTenureMax, avgTenureIncludeCurrent,
            cc: companyConditions.map(conditionToCompact),
            sc: schoolConditions.map(conditionToCompact),
          }
          // TODO: Refactor to individual URL params when search-URL-sharing becomes a use case.
          router.push(`/search-builder?filters=${encodeURIComponent(JSON.stringify(state))}`)
        }}
      />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '16px 24px' }}>
          {/* Page title — global nav is rendered at layout level */}
          <h1 className="text-3xl font-bold tracking-tight mb-4">Vetted Database</h1>

          {/* Search */}
          <input type="text" placeholder="Search by name, company, title, or location..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', marginBottom: 12,
              border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-button)',
              background: 'var(--bg-surface)', color: 'var(--fg-primary)',
              fontSize: 'var(--fs-14)', fontFamily: 'var(--font-sans)', outline: 'none',
            }} />

          {chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {chips.map((c, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                    background: 'var(--accent-950)', color: 'var(--accent-400)',
                    borderRadius: 'var(--r-chip)', fontSize: 'var(--fs-12)', fontFamily: 'var(--font-sans)',
                    border: '1px solid var(--accent-900)',
                  }}>
                    {c.label}
                    <button onClick={c.onRemove} style={{ color: 'var(--accent-500)', fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', fontSize: 'var(--fs-12)' }}>×</button>
                  </span>
              ))}
            </div>
          )}

          <div style={{ marginBottom: 12, fontSize: 'var(--fs-13)', color: 'var(--fg-secondary)' }}>
            <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--fg-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{filteredPeople.length}</span>
            {' '}of <span style={{ fontFamily: 'var(--font-mono)' }}>{people.length}</span> candidates
          </div>

          {selectedIds.size > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--red-950)', border: '1px solid var(--red-800)', borderRadius: 'var(--r-card)' }}>
              <span style={{ fontSize: 'var(--fs-13)', color: 'var(--red-400)', fontWeight: 'var(--fw-medium)' }}>{selectedIds.size} selected</span>
              <button onClick={handleBulkDelete} onBlur={() => setBulkDeleteConfirm(false)} disabled={bulkDeleting}
                style={{ padding: '4px 12px', fontSize: 'var(--fs-13)', borderRadius: 'var(--r-button)', cursor: 'pointer', border: 'none',
                  background: bulkDeleteConfirm ? 'var(--red-600)' : 'transparent', color: bulkDeleteConfirm ? 'white' : 'var(--red-400)',
                  ...(bulkDeleteConfirm ? {} : { border: '1px solid var(--red-700)' }), opacity: bulkDeleting ? 0.5 : 1 }}>
                {bulkDeleting ? 'Deleting…' : bulkDeleteConfirm ? 'Click again to confirm' : 'Delete selected'}
              </button>
              <button onClick={() => { setSelectedIds(new Set()); setBulkDeleteConfirm(false) }} style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
            </div>
          )}

          {/* Results table */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-card)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-13)', fontFamily: 'var(--font-sans)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                    <th style={{ padding: '8px 8px', width: 32 }}><input type="checkbox" checked={filteredPeople.length > 0 && selectedIds.size === filteredPeople.length} onChange={toggleSelectAll} style={{ accentColor: 'var(--accent-500)' }} /></th>
                    <th style={{ ...eyebrow, width: 36, padding: '8px 4px' }} title="LinkedIn">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="var(--fg-tertiary)"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    </th>
                    <th style={{ ...eyebrow, width: 28, padding: '8px 4px' }} title="Add to list" />
                    {[
                      {h:'Name',field:null},{h:'Bucket',field:null},{h:'Company',field:null},{h:'Title',field:null},{h:'Specialty',field:null},{h:'School',field:null},
                      {h:'Yrs',field:'years_experience_estimate' as SortField},
                      {h:'Cur Ten',field:'current_tenure' as SortField},
                      {h:'Avg Ten',field:'avg_tenure' as SortField},
                      {h:'Location',field:null},
                    ].map(({h,field}) => (
                      <th key={h} onClick={field ? () => handleSort(field) : undefined}
                        style={{ ...eyebrow, cursor: field ? 'pointer' : 'default' }}>
                        {h}{field && sortField === field && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPeople.length === 0 ? (
                    <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: 'var(--fg-tertiary)' }}>No candidates match these filters</td></tr>
                  ) : filteredPeople.map(person => {
                    const isSelected = selectedPerson?.person_id === person.person_id
                    return (
                    <tr key={person.person_id}
                      onClick={() => { setSelectedPerson(person); setIsDrawerOpen(true) }}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                        transition: 'background var(--dur-hover) var(--ease)',
                        borderLeft: isSelected ? '2px solid var(--accent-500)' : '2px solid transparent',
                        background: isSelected ? 'var(--bg-selected)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                      {/* Checkbox */}
                      <td style={{ padding: '8px 8px' }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(person.person_id)} onChange={() => toggleSelect(person.person_id)} style={{ accentColor: 'var(--accent-500)' }} />
                      </td>
                      {/* LinkedIn icon */}
                      <td style={{ padding: '8px 4px', width: 36 }} onClick={e => e.stopPropagation()}>
                        {person.linkedin_url ? (
                          <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fg-tertiary)', transition: 'color 150ms' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg-primary)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-tertiary)')}>
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                          </a>
                        ) : (
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="var(--fg-tertiary)" style={{ opacity: 0.25 }}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        )}
                      </td>
                      {/* Add to list */}
                      <td style={{ padding: '8px 4px', width: 28 }} onClick={e => e.stopPropagation()}>
                        <AddToListMenu itemId={person.person_id} kind="candidate" itemLabel={person.full_name || ''} triggerLabel="+" className="text-tertiary hover:text-foreground" />
                      </td>
                      {/* Name */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <button onClick={e => { e.stopPropagation(); router.push(`/profile/${person.person_id}`) }}
                          style={{ color: isSelected ? 'var(--accent)' : 'var(--fg-primary)', fontWeight: 'var(--fw-medium)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-13)', textDecoration: 'none' }}
                          onMouseEnter={e => {
                            e.currentTarget.style.textDecoration = 'underline'
                            e.currentTarget.style.textDecorationColor = 'var(--fg-secondary)'
                            e.currentTarget.style.textUnderlineOffset = '3px'
                            e.currentTarget.style.textDecorationThickness = '1px'
                          }}
                          onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}>
                          {person.full_name || 'N/A'}
                        </button>
                      </td>
                      {/* Bucket */}
                      <td style={{ padding: '8px 8px', whiteSpace: 'nowrap' }}>
                        <BucketChip bucket={person.latest_bucket} />
                      </td>
                      {/* Company */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const currentExp = person.experiences_lite.find(e => e.is_current && e.company_id)
                          const isExcluded = currentExp?.company_review_status === 'excluded'
                          return (
                            <div
                              style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: isExcluded ? 0.6 : 1 }}
                              title={isExcluded ? 'Company excluded from talent pool.' : undefined}
                            >
                              <CompanyLogo domain={guessDomain(person.current_company_name)} companyName={person.current_company_name} size={20} />
                              <span style={{ color: 'var(--fg-primary)' }}>{cleanCompanyName(person.current_company_name) || '—'}</span>
                            </div>
                          )
                        })()}
                      </td>
                      {/* Title */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--fg-primary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {(person.current_title_normalized || person.current_title_raw || '—').split(/\s*[|–—]\s*/)[0].split(/,\s*/)[0]}
                      </td>
                      {/* Specialty */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--fg-secondary)', fontSize: 'var(--fs-13)' }}>
                        {person.primary_specialty ? person.primary_specialty.replace(/_/g, ' ') : <span style={{ opacity: 0.4 }}>—</span>}
                      </td>
                      {/* School */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {(() => {
                          const edu = derivePrimaryEducation(person.education_lite, schoolNameMap)
                          if (!edu) return <span style={{ color: 'var(--fg-tertiary)', opacity: 0.4 }}>—</span>
                          const fullText = edu.schoolName + (edu.degree ? ' · ' + edu.degree : '')
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} title={fullText}>
                              <CompanyLogo domain={guessSchoolDomain(edu.schoolName)} companyName={edu.schoolName} size={20} shape="circle" />
                              <span style={{ color: 'var(--fg-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {edu.schoolName}
                              </span>
                            </div>
                          )
                        })()}
                      </td>
                      {/* Years */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--fg-secondary)' }}>{person.years_experience_estimate ?? '—'}</td>
                      {/* Current Tenure */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--fg-secondary)' }}>{person.tenure.currentTenureYears != null ? person.tenure.currentTenureYears + 'y' : '—'}</td>
                      {/* Avg Tenure */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--fg-secondary)' }}>{(() => { const v = avgTenureIncludeCurrent ? person.tenure.avgTenureIncCurrentYears : person.tenure.avgTenureYears; return v != null ? v + 'y' : '—' })()}</td>
                      {/* Location */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--fg-secondary)' }}>{person.location_name || '—'}</td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <ProfileDrawer person={selectedPerson} isOpen={isDrawerOpen}
        signals={selectedPerson ? (signalsByPerson[selectedPerson.person_id] || []) : []}
        currentSeniority={(() => {
          if (!selectedPerson) return null
          const sp = people.find(p => p.person_id === selectedPerson.person_id)
          if (!sp) return null
          const current = sp.experiences_lite.find(e => e.is_current && e.seniority && e.seniority !== 'unknown')
          return current?.seniority ?? null
        })()}
        education={(() => {
          if (!selectedPerson) return []
          const sp = people.find(p => p.person_id === selectedPerson.person_id)
          if (!sp) return []
          return filterEducationForDisplay(sp.education_lite)
            .map(e => {
              const sn = schoolNameMap[e.school_id] || e.school_name_raw || '?'
              let deg = ''
              if (e.degree_level && DEGREE_ABBREV[e.degree_level]) {
                deg = DEGREE_ABBREV[e.degree_level]
                if (e.field_of_study_raw) deg += ' ' + e.field_of_study_raw
              } else if (e.degree_raw) deg = e.degree_raw
              return { schoolName: sn, degree: deg, startYear: e.start_year, endYear: e.end_year } satisfies DrawerEducation
            })
        })()}
        experiences={(() => {
          if (!selectedPerson) return []
          const sp = people.find(p => p.person_id === selectedPerson.person_id)
          if (!sp) return []
          return sp.experiences_lite.map(e => ({
            company_id: e.company_id,
            company_name: e.company_id ? (companyNameMap[e.company_id] ?? null) : null,
            company_review_status: e.company_review_status,
            title_raw: e.title_raw,
            start_date: e.start_date,
            end_date: e.end_date,
            is_current: e.is_current,
            employment_type: e.employment_type,
          } satisfies DrawerExperience))
        })()}
        onClose={() => { setIsDrawerOpen(false); setSelectedPerson(null) }}
        onPrev={(() => { if (!selectedPerson) return null; const i = filteredPeople.findIndex(p => p.person_id === selectedPerson.person_id); return i <= 0 ? null : () => setSelectedPerson(filteredPeople[i-1]) })()}
        onNext={(() => { if (!selectedPerson) return null; const i = filteredPeople.findIndex(p => p.person_id === selectedPerson.person_id); return i < 0 || i >= filteredPeople.length-1 ? null : () => setSelectedPerson(filteredPeople[i+1]) })()}
      />
    </div>
  )
}
