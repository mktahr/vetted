'use client'

// TODO: Move Boolean search and main filter logic to a server-side API endpoint
// when people count exceeds ~500. Client-side filtering becomes too slow above that threshold.

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, fetchAllRows } from '@/lib/supabase'
import { Person, SortField, SortDirection, CandidateBucket } from '../types'
import ProfileDrawer, { DrawerExperience, DrawerSignal } from './ProfileDrawer'
import { MultiSelectOption } from './MultiSelect'
import CompanyLogo, { guessDomain } from './CompanyLogo'
import FilterSidebar from './FilterSidebar'
import { buildLocationOptions } from '@/lib/locations/us-locations'

function cleanCompanyName(name: string | null | undefined): string | null {
  if (!name) return null
  return name.split('·')[0].split('•')[0].trim() || null
}

// Bucket chip using design system tag palette
const BUCKET_TAG: Record<CandidateBucket, { label: string; bg: string; border: string; text: string }> = {
  vetted_talent:    { label: 'Vetted Talent',    bg: 'var(--tag-sage-bg)',  border: 'var(--tag-sage-border)',  text: 'var(--tag-sage-text)' },
  high_potential:   { label: 'High Potential',   bg: 'var(--tag-steel-bg)', border: 'var(--tag-steel-border)', text: 'var(--tag-steel-text)' },
  silver_medalist:  { label: 'Silver Medalist',  bg: 'var(--tag-slate-bg)', border: 'var(--tag-slate-border)', text: 'var(--tag-slate-text)' },
  non_vetted:       { label: 'Non-Vetted',       bg: 'var(--tag-sand-bg)',  border: 'var(--tag-sand-border)',  text: 'var(--tag-sand-text)' },
  needs_review:     { label: 'Needs Review',     bg: 'var(--tag-clay-bg)',  border: 'var(--tag-clay-border)',  text: 'var(--tag-clay-text)' },
}

function BucketChip({ bucket }: { bucket: CandidateBucket | null | undefined }) {
  if (!bucket) return <span style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)' }}>Unscored</span>
  const s = BUCKET_TAG[bucket]
  return <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 'var(--r-chip)', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-medium)', fontFamily: 'var(--font-sans)', background: s.bg, border: `1px solid ${s.border}`, color: s.text }}>{s.label}</span>
}

type FocusScope = 'all' | 'hard_tech' | 'all_tech'

interface ExperienceLite {
  company_id: string | null
  company_focus: 'hard_tech' | 'all_tech' | 'unreviewed' | null
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
  end_year: number | null
}

interface PersonWithFilters extends Person {
  company_ids_all: Set<string>
  school_ids_all: Set<string>
  experiences_lite: ExperienceLite[]
  education_lite: EducationLite[]
  all_specialties: Set<string>
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
  const [roleSel, setRoleSel] = useState<string[]>([])
  const [bucketSel, setBucketSel] = useState<string[]>([])
  const [stageSel, setStageSel] = useState<string[]>([])
  const [senioritySel, setSenioritySel] = useState<string[]>([])
  const [schoolSel, setSchoolSel] = useState<string[]>([])
  const [locationSel, setLocationSel] = useState<string[]>([])
  const [specialtySel, setSpecialtySel] = useState<string[]>([])
  const [clearanceSel, setClearanceSel] = useState<string[]>([])
  // Temporal scope type: 'ever' (default) | 'currently' | 'previously'
  type TemporalScope = 'ever' | 'currently' | 'previously'
  const [specialtyScope, setSpecialtyScope] = useState<TemporalScope>('ever')
  const [seniorityScope, setSeniorityScope] = useState<TemporalScope>('ever')
  const [focusScope, setFocusScope] = useState<FocusScope>('all')
  const [compoundCompany, setCompoundCompany] = useState<string>('')
  const [compoundCompanyScope, setCompoundCompanyScope] = useState<TemporalScope>('ever')
  const [compoundSpecialties, setCompoundSpecialties] = useState<string[]>([])
  const [compoundYearMin, setCompoundYearMin] = useState<string>('')
  const [compoundYearMax, setCompoundYearMax] = useState<string>('')
  const [compoundRelationship, setCompoundRelationship] = useState<string>('any')
  const [yearsMin, setYearsMin] = useState<string>('')
  const [yearsMax, setYearsMax] = useState<string>('')
  const [schoolScope, setSchoolScope] = useState<'us' | 'all'>('us')
  const [schoolTemporalScope, setSchoolTemporalScope] = useState<TemporalScope>('ever')
  const [schoolGroupScope, setSchoolGroupScope] = useState<TemporalScope>('ever')
  const [companyGroupScope, setCompanyGroupScope] = useState<TemporalScope>('ever')
  const [titleBoolean, setTitleBoolean] = useState('')
  const [titleBooleanScope, setTitleBooleanScope] = useState<TemporalScope>('ever')
  const [experienceBoolean, setExperienceBoolean] = useState('')

  // Options
  const [roleOptions, setRoleOptions] = useState<MultiSelectOption[]>([])
  const [seniorityOptions, setSeniorityOptions] = useState<MultiSelectOption[]>([])
  const [companyOptions, setCompanyOptions] = useState<MultiSelectOption[]>([])
  const [schoolOptions, setSchoolOptions] = useState<MultiSelectOption[]>([])
  const [allSpecialtyOptions, setAllSpecialtyOptions] = useState<MultiSelectOption[]>([])
  // Role→specialty mapping for contextual filtering
  const [roleSpecialtyMap, setRoleSpecialtyMap] = useState<Record<string, string[]>>({})
  const [companyNameMap, setCompanyNameMap] = useState<Record<string, string>>({})
  const [signalsByPerson, setSignalsByPerson] = useState<Record<string, DrawerSignal[]>>({})

  // New filter state: signals, school groups, company groups
  const [signalSel, setSignalSel] = useState<string[]>([])
  const [signalOptions, setSignalOptions] = useState<MultiSelectOption[]>([])
  const [schoolGroupSel, setSchoolGroupSel] = useState<string[]>([])
  const [schoolGroupOptions, setSchoolGroupOptions] = useState<MultiSelectOption[]>([])
  const [companyGroupSel, setCompanyGroupSel] = useState<string[]>([])
  const [companyGroupOptions, setCompanyGroupOptions] = useState<MultiSelectOption[]>([])
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
      if (f.roleSel) setRoleSel(f.roleSel)
      if (f.specialtySel) setSpecialtySel(f.specialtySel)
      // Backward compat: old 'any'/'current' → 'ever'/'currently'
      if (f.specialtyScope === 'any') setSpecialtyScope('ever')
      else if (f.specialtyScope === 'current') setSpecialtyScope('currently')
      else if (f.specialtyScope) setSpecialtyScope(f.specialtyScope)
      if (f.senioritySel) setSenioritySel(f.senioritySel)
      if (f.seniorityScope) setSeniorityScope(f.seniorityScope)
      if (f.bucketSel) setBucketSel(f.bucketSel)
      if (f.stageSel) setStageSel(f.stageSel)
      if (f.yearsMin) setYearsMin(f.yearsMin)
      if (f.yearsMax) setYearsMax(f.yearsMax)
      if (f.clearanceSel) setClearanceSel(f.clearanceSel)
      if (f.locationSel) setLocationSel(f.locationSel)
      if (f.focusScope) setFocusScope(f.focusScope)
      if (f.compoundCompany) setCompoundCompany(f.compoundCompany)
      if (f.compoundCompanyScope) setCompoundCompanyScope(f.compoundCompanyScope)
      // Backward compat: old compoundRelationship
      else if (f.compoundRelationship === 'current') setCompoundCompanyScope('currently')
      else if (f.compoundRelationship === 'previous') setCompoundCompanyScope('previously')
      if (f.compoundSpecialties) setCompoundSpecialties(f.compoundSpecialties)
      if (f.compoundYearMin) setCompoundYearMin(f.compoundYearMin)
      if (f.compoundYearMax) setCompoundYearMax(f.compoundYearMax)
      if (f.compoundRelationship) setCompoundRelationship(f.compoundRelationship)
      if (f.schoolSel) setSchoolSel(f.schoolSel)
      if (f.schoolTemporalScope) setSchoolTemporalScope(f.schoolTemporalScope)
      if (f.titleBoolean) setTitleBoolean(f.titleBoolean)
      if (f.titleBooleanScope) setTitleBooleanScope(f.titleBooleanScope)
      if (f.experienceBoolean) setExperienceBoolean(f.experienceBoolean)
      if (f.signalSel) setSignalSel(f.signalSel)
      if (f.schoolGroupSel) setSchoolGroupSel(f.schoolGroupSel)
      if (f.schoolGroupScope) setSchoolGroupScope(f.schoolGroupScope)
      if (f.companyGroupSel) setCompanyGroupSel(f.companyGroupSel)
      if (f.companyGroupScope) setCompanyGroupScope(f.companyGroupScope)
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
        ] = await Promise.all([
          supabase.from('people').select('*, companies:current_company_id ( company_name )').order('created_at', { ascending: false }),
          supabase.from('candidate_bucket_assignments').select('person_id, candidate_bucket, assignment_reason, effective_at').order('effective_at', { ascending: false }),
          supabase.from('person_experiences').select('person_id, company_id, specialty_normalized, seniority_normalized, start_date, end_date, is_current, employment_type_normalized, title_raw, description_raw'),
          supabase.from('person_education').select('person_id, school_id, end_year'),
          supabase.from('seniority_dictionary').select('seniority_normalized, rank_order').eq('active', true).order('rank_order'),
          fetchAllRows<any>('companies', 'company_id, company_name, primary_industry_tag, focus, company_groups', 'company_name').then(data => ({ data })),
          fetchAllRows<any>('schools', 'school_id, school_name, school_score, is_foreign, school_groups', 'school_name').then(data => ({ data })),
          supabase.from('specialty_dictionary').select('specialty_normalized, parent_function').eq('active', true).order('specialty_normalized'),
          supabase.from('role_dictionary').select('role_id, role_name, display_order').eq('active', true).order('display_order'),
          supabase.from('role_specialty_map').select('role_id, specialty_normalized, is_primary'),
          supabase.from('person_signals_active').select('person_id, signal_id, canonical_name, category, canonical_url, evidence_url, source_text, source, confidence').order('confidence', { ascending: false }),
        ])

        if (peopleErr) { setError(`Database error: ${peopleErr.message}`); return }

        const latestBucket: Record<string, { bucket: CandidateBucket; reason: string | null }> = {}
        for (const r of bucketData || []) { if (!latestBucket[r.person_id]) latestBucket[r.person_id] = { bucket: r.candidate_bucket as CandidateBucket, reason: r.assignment_reason } }

        const companyFocus: Record<string, string> = {}
        for (const c of companies || []) companyFocus[c.company_id] = (c as any).focus ?? 'all_tech'

        const companyIds: Record<string, Set<string>> = {}
        const expLite: Record<string, ExperienceLite[]> = {}
        const allSpecs: Record<string, Set<string>> = {}
        for (const r of expData || []) {
          const pid = r.person_id
          if (r.company_id) { if (!companyIds[pid]) companyIds[pid] = new Set(); companyIds[pid].add(r.company_id) }
          if (!expLite[pid]) expLite[pid] = []
          expLite[pid].push({
            company_id: r.company_id, company_focus: r.company_id ? (companyFocus[r.company_id] as any ?? null) : null,
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
            eduLite[r.person_id].push({ school_id: r.school_id, end_year: (r as any).end_year ?? null })
          }
        }

        setPeople((peopleData || []).map((r: any) => ({
          ...r, current_company_name: r.companies?.company_name || null,
          latest_bucket: latestBucket[r.person_id]?.bucket ?? null, latest_bucket_reason: latestBucket[r.person_id]?.reason ?? null,
          company_ids_all: companyIds[r.person_id] || new Set(), school_ids_all: schoolIds[r.person_id] || new Set(),
          experiences_lite: expLite[r.person_id] || [], education_lite: eduLite[r.person_id] || [],
          all_specialties: allSpecs[r.person_id] || new Set(),
        })))

        setSeniorityOptions((srs || []).map(s => ({ value: s.seniority_normalized, label: s.seniority_normalized.replace(/_/g, ' ') })))
        setCompanyOptions((companies || []).filter((c: any) => c.focus === 'hard_tech' || c.focus === 'all_tech').map((c: any) => ({ value: c.company_id, label: c.company_name, sublabel: c.primary_industry_tag || undefined })))
        const cMap: Record<string, string> = {}
        for (const c of companies || []) cMap[c.company_id] = c.company_name
        setCompanyNameMap(cMap)
        setSchoolOptions((schools || []).filter((s: any) => s.school_score != null).map((s: any) => ({ value: s.school_id, label: s.school_name, sublabel: s.is_foreign ? "Int'l" : undefined })))

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
        const SIGNAL_CATEGORY_ORDER = ['founder','military','fellowship','scholarship','academic_distinction','competition','hackathon','athletics','engineering_team','student_leadership','greek_life']
        const SIGNAL_CATEGORY_LABELS: Record<string, string> = {
          founder:'Founder', military:'Military', fellowship:'Fellowship', scholarship:'Scholarship',
          academic_distinction:'Academic', competition:'Competition', hackathon:'Hackathon',
          athletics:'Athletics', engineering_team:'Eng. Team', student_leadership:'Leadership', greek_life:'Greek Life',
        }
        // Collect unique categories that have signals on any person
        const catsWithSignals = new Set<string>()
        for (const sigs of Object.values(sigMap)) { for (const s of sigs) catsWithSignals.add(s.category) }
        const sigOpts: MultiSelectOption[] = []
        for (const cat of SIGNAL_CATEGORY_ORDER) {
          if (!catsWithSignals.has(cat)) continue
          sigOpts.push({ value: `cat:${cat}`, label: `Any ${SIGNAL_CATEGORY_LABELS[cat] || cat}`, sublabel: 'Category' })
        }
        // Add individual signals (all unique signal_ids across all people)
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
          sigOpts.push({ value: id, label: info.name, sublabel: SIGNAL_CATEGORY_LABELS[info.cat] || info.cat })
        }
        setSignalOptions(sigOpts)

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
        const dict = (specDict || []) as Array<{ specialty_normalized: string; parent_function: string | null }>
        setAllSpecialtyOptions(dict.map(d => ({ value: d.specialty_normalized, label: d.specialty_normalized.replace(/_/g, ' '), sublabel: (d.parent_function || '').replace(/_/g, ' ') })))

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
    if (searchQuery) { const q = searchQuery.toLowerCase(); rows = rows.filter(p => p.full_name?.toLowerCase().includes(q) || p.current_company_name?.toLowerCase().includes(q) || p.current_title_raw?.toLowerCase().includes(q) || p.location_name?.toLowerCase().includes(q)) }
    if (bucketSel.length > 0) { const s = new Set(bucketSel); rows = rows.filter(p => p.latest_bucket && s.has(p.latest_bucket)) }
    if (stageSel.length > 0) { const s = new Set(stageSel); rows = rows.filter(p => p.career_stage_assigned && s.has(p.career_stage_assigned)) }
    // Seniority with temporal scope
    if (senioritySel.length > 0) {
      const s = new Set(senioritySel)
      if (seniorityScope === 'currently') {
        // Match current role's seniority (from experiences_lite where is_current)
        rows = rows.filter(p => p.experiences_lite.some(e => e.is_current && e.seniority && s.has(e.seniority)))
      } else if (seniorityScope === 'previously') {
        // Had seniority in past but NOT in current role
        rows = rows.filter(p => {
          const hasPast = p.experiences_lite.some(e => !e.is_current && e.seniority && s.has(e.seniority))
          const hasCurrent = p.experiences_lite.some(e => e.is_current && e.seniority && s.has(e.seniority))
          return hasPast && !hasCurrent
        })
      } else {
        rows = rows.filter(p => p.highest_seniority_reached && s.has(p.highest_seniority_reached))
      }
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

    // Location
    if (locationSel.length > 0) {
      rows = rows.filter(p => { if (!p.location_name) return false; return locationSel.some(sel => p.location_name!.toLowerCase().includes(sel.toLowerCase())) })
    }

    // Role filter with specialty scope
    if (roleSel.length > 0) {
      const roleSpecs = new Set<string>()
      for (const rid of roleSel) { for (const s of roleSpecialtyMap[rid] || []) roleSpecs.add(s) }
      if (specialtyScope === 'currently') {
        rows = rows.filter(p => p.primary_specialty && roleSpecs.has(p.primary_specialty))
      } else if (specialtyScope === 'previously') {
        rows = rows.filter(p => {
          const hasPast = p.experiences_lite.some(e => !e.is_current && e.specialty && roleSpecs.has(e.specialty))
          const hasCurrent = p.primary_specialty && roleSpecs.has(p.primary_specialty)
          return hasPast && !hasCurrent
        })
      } else {
        rows = rows.filter(p => Array.from(p.all_specialties).some(s => roleSpecs.has(s)))
      }
    }

    // Specialty filter with temporal scope
    if (specialtySel.length > 0) {
      const s = new Set(specialtySel)
      if (specialtyScope === 'currently') {
        rows = rows.filter(p => p.primary_specialty && s.has(p.primary_specialty))
      } else if (specialtyScope === 'previously') {
        rows = rows.filter(p => {
          const hasPast = p.experiences_lite.some(e => !e.is_current && e.specialty && s.has(e.specialty))
          const hasCurrent = p.primary_specialty && s.has(p.primary_specialty)
          return hasPast && !hasCurrent
        })
      } else {
        rows = rows.filter(p => Array.from(p.all_specialties).some(spec => s.has(spec)))
      }
    }

    if (clearanceSel.length > 0) { const s = new Set(clearanceSel); rows = rows.filter(p => p.clearance_level && s.has(p.clearance_level)) }

    // Signals filter (no temporal scope — achievements are timeless)
    if (signalSel.length > 0) {
      const selectedCats = signalSel.filter(v => v.startsWith('cat:')).map(v => v.slice(4))
      const selectedIds = new Set(signalSel.filter(v => !v.startsWith('cat:')))
      rows = rows.filter(p => {
        const personSigs = signalsByPerson[p.person_id] || []
        return personSigs.some(s => selectedIds.has(s.signal_id) || selectedCats.includes(s.category))
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

    if (focusScope === 'hard_tech') rows = rows.filter(p => p.experiences_lite.some(e => e.company_focus === 'hard_tech'))
    else if (focusScope === 'all_tech') rows = rows.filter(p => p.experiences_lite.some(e => e.company_focus === 'hard_tech' || e.company_focus === 'all_tech'))

    // Compound company filter with temporal scope
    if (compoundCompany) {
      const y1 = compoundYearMin ? parseInt(compoundYearMin, 10) : null
      const y2 = compoundYearMax ? parseInt(compoundYearMax, 10) : null
      const needSpecs = compoundSpecialties.length > 0 ? new Set(compoundSpecialties) : null
      const rStart = y1 && !isNaN(y1) ? new Date(y1, 0, 1).getTime() : null
      const rEnd = y2 && !isNaN(y2) ? new Date(y2, 11, 31).getTime() : null
      const matchesExp = (e: typeof rows[0]['experiences_lite'][0]) => {
        if (e.company_id !== compoundCompany) return false
        if (needSpecs && !(e.specialty && needSpecs.has(e.specialty))) return false
        // Legacy relationship filter (sidebar still uses this)
        if (compoundRelationship === 'current' && !e.is_current) return false
        if (compoundRelationship === 'previous' && (e.is_current || e.employment_type === 'internship')) return false
        if (compoundRelationship === 'intern' && e.employment_type !== 'internship') return false
        // Temporal scope (from search builder)
        if (compoundCompanyScope === 'currently' && !e.is_current) return false
        if (compoundCompanyScope === 'previously' && e.is_current) return false
        // Date range
        if (rStart || rEnd) {
          const eS = e.start_date ? new Date(e.start_date).getTime() : null
          const eE = e.end_date ? new Date(e.end_date).getTime() : null
          if (rEnd && eS && eS > rEnd) return false
          if (rStart && eE && eE < rStart) return false
        }
        return true
      }
      if (compoundCompanyScope === 'previously') {
        // "Previously" = had a match in the past but NOT currently at that company
        rows = rows.filter(p => {
          const hasMatch = p.experiences_lite.some(e => matchesExp(e))
          const hasCurrent = p.experiences_lite.some(e => e.company_id === compoundCompany && e.is_current)
          return hasMatch && !hasCurrent
        })
      } else {
        rows = rows.filter(p => p.experiences_lite.some(e => matchesExp(e)))
      }
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

    if (sortField) rows.sort((a, b) => { const av = (a[sortField] as number) ?? -1, bv = (b[sortField] as number) ?? -1; return sortDirection === 'asc' ? av - bv : bv - av })
    return rows
  }, [people, searchQuery, bucketSel, stageSel, roleSel, senioritySel, seniorityScope, schoolSel, schoolTemporalScope, locationSel, specialtySel, specialtyScope, clearanceSel, focusScope, compoundCompany, compoundCompanyScope, compoundSpecialties, compoundYearMin, compoundYearMax, compoundRelationship, yearsMin, yearsMax, titleBoolean, titleBooleanScope, experienceBoolean, signalSel, schoolGroupSel, schoolGroupScope, companyGroupSel, companyGroupScope, signalsByPerson, schoolGroupsMap, companyGroupsMap, sortField, sortDirection, roleSpecialtyMap])

  const activeFilterCount =
    (roleSel.length > 0 ? 1 : 0) + (bucketSel.length > 0 ? 1 : 0) + (stageSel.length > 0 ? 1 : 0) +
    (senioritySel.length > 0 ? 1 : 0) + (schoolSel.length > 0 ? 1 : 0) + (locationSel.length > 0 ? 1 : 0) +
    (specialtySel.length > 0 ? 1 : 0) + (clearanceSel.length > 0 ? 1 : 0) + (focusScope !== 'all' ? 1 : 0) +
    (compoundCompany ? 1 : 0) + (yearsMin || yearsMax ? 1 : 0) + (titleBoolean ? 1 : 0) + (experienceBoolean ? 1 : 0) +
    (signalSel.length > 0 ? 1 : 0) + (schoolGroupSel.length > 0 ? 1 : 0) + (companyGroupSel.length > 0 ? 1 : 0)

  const clearAllFilters = () => {
    setSearchQuery(''); setRoleSel([]); setBucketSel([]); setStageSel([]); setSenioritySel([])
    setSchoolSel([]); setLocationSel([]); setSpecialtySel([])
    setClearanceSel([]); setFocusScope('all'); setCompoundCompany(''); setCompoundSpecialties([])
    setCompoundYearMin(''); setCompoundYearMax(''); setCompoundRelationship('any')
    setYearsMin(''); setYearsMax(''); setTitleBoolean(''); setTitleBooleanScope('ever'); setExperienceBoolean('')
    setSignalSel([]); setSchoolGroupSel([]); setCompanyGroupSel([])
    setSpecialtyScope('ever'); setSeniorityScope('ever'); setCompoundCompanyScope('ever')
    setSchoolTemporalScope('ever'); setSchoolGroupScope('ever'); setCompanyGroupScope('ever')
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
  if (focusScope !== 'all') chips.push({ label: `Scope: ${focusScope.replace('_', ' ')}`, onRemove: () => setFocusScope('all') })
  for (const v of roleSel) { const r = roleOptions.find(o => o.value === v); chips.push({ label: `Role: ${r?.label || v}`, onRemove: () => setRoleSel(roleSel.filter(x => x !== v)) }) }
  for (const v of specialtySel) chips.push({ label: `Specialty: ${v.replace(/_/g, ' ')}`, onRemove: () => setSpecialtySel(specialtySel.filter(x => x !== v)) })
  for (const v of senioritySel) chips.push({ label: `Seniority: ${v.replace(/_/g, ' ')}`, onRemove: () => setSenioritySel(senioritySel.filter(x => x !== v)) })
  for (const v of bucketSel) chips.push({ label: `Bucket: ${v.replace(/_/g, ' ')}`, onRemove: () => setBucketSel(bucketSel.filter(x => x !== v)) })
  for (const v of stageSel) chips.push({ label: `Stage: ${v.replace(/_/g, ' ')}`, onRemove: () => setStageSel(stageSel.filter(x => x !== v)) })
  if (yearsMin || yearsMax) chips.push({ label: `Yrs: ${yearsMin || '0'}–${yearsMax || '∞'}`, onRemove: () => { setYearsMin(''); setYearsMax('') } })
  for (const v of clearanceSel) chips.push({ label: `Clearance: ${v.replace(/_/g, ' ')}`, onRemove: () => setClearanceSel(clearanceSel.filter(x => x !== v)) })
  for (const v of locationSel) chips.push({ label: `Location: ${v}`, onRemove: () => setLocationSel(locationSel.filter(x => x !== v)) })
  if (compoundCompany) { const co = companyOptions.find(c => c.value === compoundCompany); chips.push({ label: `At: ${co?.label || '?'}`, onRemove: () => { setCompoundCompany(''); setCompoundSpecialties([]); setCompoundYearMin(''); setCompoundYearMax(''); setCompoundRelationship('any') } }) }
  for (const v of schoolSel) { const sc = schoolOptions.find(s => s.value === v); chips.push({ label: `School: ${sc?.label || v}`, onRemove: () => setSchoolSel(schoolSel.filter(x => x !== v)) }) }
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
        roleSel={roleSel} setRoleSel={setRoleSel} roleOptions={roleOptions}
        specialtySel={specialtySel} setSpecialtySel={setSpecialtySel}
        specialtyScope={specialtyScope} setSpecialtyScope={setSpecialtyScope}
        specialtyOptions={filteredSpecialtyOptions} allSpecialtyOptions={allSpecialtyOptions}
        senioritySel={senioritySel} setSenioritySel={setSenioritySel} seniorityOptions={seniorityOptions}
        bucketSel={bucketSel} setBucketSel={setBucketSel}
        stageSel={stageSel} setStageSel={setStageSel}
        yearsMin={yearsMin} setYearsMin={setYearsMin} yearsMax={yearsMax} setYearsMax={setYearsMax}
        clearanceSel={clearanceSel} setClearanceSel={setClearanceSel}
        locationSel={locationSel} setLocationSel={setLocationSel} locationOptions={locationOptions}
        focusScope={focusScope} setFocusScope={setFocusScope}
        compoundCompany={compoundCompany} setCompoundCompany={setCompoundCompany}
        compoundSpecialties={compoundSpecialties} setCompoundSpecialties={setCompoundSpecialties}
        compoundYearMin={compoundYearMin} setCompoundYearMin={setCompoundYearMin}
        compoundYearMax={compoundYearMax} setCompoundYearMax={setCompoundYearMax}
        compoundRelationship={compoundRelationship} setCompoundRelationship={setCompoundRelationship}
        companyOptions={companyOptions}
        schoolSel={schoolSel} setSchoolSel={setSchoolSel} schoolOptions={schoolOptions}
        schoolScope={schoolScope} setSchoolScope={setSchoolScope}
        schoolGroupSel={schoolGroupSel} setSchoolGroupSel={setSchoolGroupSel} schoolGroupOptions={schoolGroupOptions}
        companyGroupSel={companyGroupSel} setCompanyGroupSel={setCompanyGroupSel} companyGroupOptions={companyGroupOptions}
        signalSel={signalSel} setSignalSel={setSignalSel} signalOptions={signalOptions}
        titleBoolean={titleBoolean} setTitleBoolean={setTitleBoolean}
        experienceBoolean={experienceBoolean} setExperienceBoolean={setExperienceBoolean}
        clearAllFilters={clearAllFilters} activeFilterCount={activeFilterCount}
        onOpenBuilder={() => {
          // Encode current filter state as JSON in URL param
          const state = { roleSel, specialtySel, specialtyScope, senioritySel, seniorityScope, bucketSel, stageSel, yearsMin, yearsMax, clearanceSel, locationSel, focusScope, compoundCompany, compoundCompanyScope, compoundSpecialties, compoundYearMin, compoundYearMax, compoundRelationship, schoolSel, schoolTemporalScope, titleBoolean, titleBooleanScope, experienceBoolean, signalSel, schoolGroupSel, schoolGroupScope, companyGroupSel, companyGroupScope }
          // TODO: Refactor to individual URL params when search-URL-sharing becomes a use case.
          router.push(`/search-builder?filters=${encodeURIComponent(JSON.stringify(state))}`)
        }}
      />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '16px 24px' }}>
          {/* Top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h1 style={{ fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-semibold)', letterSpacing: '-0.01em' }}>Vetted Database</h1>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 'var(--fs-13)' }}>
              <a href="/admin/import" style={{ color: 'var(--fg-secondary)', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-secondary)')}>Import →</a>
              <a href="/admin/companies" style={{ color: 'var(--fg-secondary)', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-secondary)')}>Companies →</a>
              <ThemeToggle />
            </div>
          </div>

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
                    {[{h:'Name',sort:false},{h:'Company',sort:false},{h:'Title',sort:false},{h:'Specialty',sort:false},{h:'Yrs',sort:true},{h:'Location',sort:false}].map(({h,sort}) => (
                      <th key={h} onClick={sort ? () => handleSort('years_experience_estimate') : undefined}
                        style={{ ...eyebrow, cursor: sort ? 'pointer' : 'default' }}>
                        {h}{h === 'Yrs' && sortField === 'years_experience_estimate' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPeople.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--fg-tertiary)' }}>No candidates match these filters</td></tr>
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
                      {/* Name */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <button onClick={e => { e.stopPropagation(); router.push(`/profile/${person.person_id}`) }}
                          style={{ color: isSelected ? 'var(--accent)' : 'var(--fg-primary)', fontWeight: 'var(--fw-medium)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-13)', transition: 'color 150ms var(--ease)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.color = 'var(--fg-primary)' }}>
                          {person.full_name || 'N/A'}
                        </button>
                      </td>
                      {/* Company */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CompanyLogo domain={guessDomain(person.current_company_name)} companyName={person.current_company_name} size={20} />
                          <span style={{ color: 'var(--fg-primary)' }}>{cleanCompanyName(person.current_company_name) || '—'}</span>
                        </div>
                      </td>
                      {/* Title (text only, no pills) */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--fg-primary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {(person.current_title_normalized || person.current_title_raw || '—').split(/\s*[|–—]\s*/)[0].split(/,\s*/)[0]}
                      </td>
                      {/* Specialty (plain text, quiet) */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--fg-secondary)', fontSize: 'var(--fs-13)' }}>
                        {person.primary_specialty ? person.primary_specialty.replace(/_/g, ' ') : <span style={{ opacity: 0.4 }}>—</span>}
                      </td>
                      {/* Years */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--fg-secondary)' }}>{person.years_experience_estimate ?? '—'}</td>
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
        experiences={(() => {
          if (!selectedPerson) return []
          const sp = people.find(p => p.person_id === selectedPerson.person_id)
          if (!sp) return []
          return sp.experiences_lite.map(e => ({
            company_id: e.company_id,
            company_name: e.company_id ? (companyNameMap[e.company_id] ?? null) : null,
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
