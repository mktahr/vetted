'use client'

// TODO: Move Boolean search and main filter logic to a server-side API endpoint
// when people count exceeds ~500. Client-side filtering becomes too slow above that threshold.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Person, SortField, SortDirection, CandidateBucket } from '../types'
import ProfileDrawer from './ProfileDrawer'
import { MultiSelectOption } from './MultiSelect'
import CompanyLogo, { guessDomain } from './CompanyLogo'
import FilterSidebar from './FilterSidebar'
import { buildLocationOptions } from '@/lib/locations/us-locations'

function cleanCompanyName(name: string | null | undefined): string | null {
  if (!name) return null
  return name.split('·')[0].split('•')[0].trim() || null
}

const BUCKET_STYLES: Record<CandidateBucket, { label: string; className: string }> = {
  vetted_talent:    { label: 'Vetted Talent',    className: 'bg-emerald-100 text-emerald-800 border border-emerald-300' },
  high_potential:   { label: 'High Potential',   className: 'bg-blue-100 text-blue-800 border border-blue-300' },
  silver_medalist:  { label: 'Silver Medalist',  className: 'bg-slate-200 text-slate-800 border border-slate-300' },
  non_vetted:       { label: 'Non-Vetted',       className: 'bg-gray-100 text-gray-600 border border-gray-300' },
  needs_review:     { label: 'Needs Review',     className: 'bg-amber-100 text-amber-800 border border-amber-300' },
}

function BucketChip({ bucket }: { bucket: CandidateBucket | null | undefined }) {
  if (!bucket) return <span className="text-xs text-gray-400">Unscored</span>
  const s = BUCKET_STYLES[bucket]
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.className}`}>{s.label}</span>
}

type FocusScope = 'all' | 'hard_tech' | 'all_tech'

interface ExperienceLite {
  company_id: string | null
  company_focus: 'hard_tech' | 'all_tech' | 'unreviewed' | null
  specialty: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  employment_type: string | null
  title_raw: string | null
  description_raw: string | null
}

interface PersonWithFilters extends Person {
  company_ids_all: Set<string>
  school_ids_all: Set<string>
  experiences_lite: ExperienceLite[]
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
  const [specialtyScope, setSpecialtyScope] = useState<'current' | 'any'>('any')
  const [focusScope, setFocusScope] = useState<FocusScope>('all')
  const [compoundCompany, setCompoundCompany] = useState<string>('')
  const [compoundSpecialties, setCompoundSpecialties] = useState<string[]>([])
  const [compoundYearMin, setCompoundYearMin] = useState<string>('')
  const [compoundYearMax, setCompoundYearMax] = useState<string>('')
  const [compoundRelationship, setCompoundRelationship] = useState<string>('any')
  const [yearsMin, setYearsMin] = useState<string>('')
  const [yearsMax, setYearsMax] = useState<string>('')
  const [schoolScope, setSchoolScope] = useState<'us' | 'all'>('us')
  const [titleBoolean, setTitleBoolean] = useState('')
  const [experienceBoolean, setExperienceBoolean] = useState('')

  // Options
  const [roleOptions, setRoleOptions] = useState<MultiSelectOption[]>([])
  const [seniorityOptions, setSeniorityOptions] = useState<MultiSelectOption[]>([])
  const [companyOptions, setCompanyOptions] = useState<MultiSelectOption[]>([])
  const [schoolOptions, setSchoolOptions] = useState<MultiSelectOption[]>([])
  const [allSpecialtyOptions, setAllSpecialtyOptions] = useState<MultiSelectOption[]>([])
  // Role→specialty mapping for contextual filtering
  const [roleSpecialtyMap, setRoleSpecialtyMap] = useState<Record<string, string[]>>({})

  const locationOptions = useMemo(() => buildLocationOptions(), [])

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
        ] = await Promise.all([
          supabase.from('people').select('*, companies:current_company_id ( company_name )').order('created_at', { ascending: false }),
          supabase.from('candidate_bucket_assignments').select('person_id, candidate_bucket, assignment_reason, effective_at').order('effective_at', { ascending: false }),
          supabase.from('person_experiences').select('person_id, company_id, specialty_normalized, start_date, end_date, is_current, employment_type_normalized, title_raw, description_raw'),
          supabase.from('person_education').select('person_id, school_id'),
          supabase.from('seniority_dictionary').select('seniority_normalized, rank_order').eq('active', true).order('rank_order'),
          supabase.from('companies').select('company_id, company_name, primary_industry_tag, focus').order('company_name'),
          supabase.from('schools').select('school_id, school_name, school_score, is_foreign').order('school_name'),
          supabase.from('specialty_dictionary').select('specialty_normalized, parent_function').eq('active', true).order('specialty_normalized'),
          supabase.from('role_dictionary').select('role_id, role_name, display_order').eq('active', true).order('display_order'),
          supabase.from('role_specialty_map').select('role_id, specialty_normalized, is_primary'),
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
            specialty: (r as any).specialty_normalized ?? null, start_date: (r as any).start_date ?? null,
            end_date: (r as any).end_date ?? null, is_current: (r as any).is_current ?? false,
            employment_type: (r as any).employment_type_normalized ?? null,
            title_raw: (r as any).title_raw ?? null, description_raw: (r as any).description_raw ?? null,
          })
          if ((r as any).specialty_normalized) { if (!allSpecs[pid]) allSpecs[pid] = new Set(); allSpecs[pid].add((r as any).specialty_normalized) }
        }
        const schoolIds: Record<string, Set<string>> = {}
        for (const r of eduData || []) { if (r.school_id) { if (!schoolIds[r.person_id]) schoolIds[r.person_id] = new Set(); schoolIds[r.person_id].add(r.school_id) } }

        setPeople((peopleData || []).map((r: any) => ({
          ...r, current_company_name: r.companies?.company_name || null,
          latest_bucket: latestBucket[r.person_id]?.bucket ?? null, latest_bucket_reason: latestBucket[r.person_id]?.reason ?? null,
          company_ids_all: companyIds[r.person_id] || new Set(), school_ids_all: schoolIds[r.person_id] || new Set(),
          experiences_lite: expLite[r.person_id] || [], all_specialties: allSpecs[r.person_id] || new Set(),
        })))

        setSeniorityOptions((srs || []).map(s => ({ value: s.seniority_normalized, label: s.seniority_normalized.replace(/_/g, ' ') })))
        setCompanyOptions((companies || []).filter((c: any) => c.focus === 'hard_tech' || c.focus === 'all_tech').map((c: any) => ({ value: c.company_id, label: c.company_name, sublabel: c.primary_industry_tag || undefined })))
        setSchoolOptions((schools || []).filter((s: any) => s.school_score != null).map((s: any) => ({ value: s.school_id, label: s.school_name, sublabel: s.is_foreign ? "Int'l" : undefined })))

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
    if (senioritySel.length > 0) { const s = new Set(senioritySel); rows = rows.filter(p => p.highest_seniority_reached && s.has(p.highest_seniority_reached)) }
    if (schoolSel.length > 0) { const s = new Set(schoolSel); rows = rows.filter(p => Array.from(p.school_ids_all).some(id => s.has(id))) }

    // Location: match state or city name as substring of people.location_name
    if (locationSel.length > 0) {
      rows = rows.filter(p => { if (!p.location_name) return false; return locationSel.some(sel => p.location_name!.toLowerCase().includes(sel.toLowerCase())) })
    }

    // Role filter: expand selected roles to all mapped specialties, then filter
    // people who have ANY of those specialties
    if (roleSel.length > 0) {
      const roleSpecs = new Set<string>()
      for (const rid of roleSel) { for (const s of roleSpecialtyMap[rid] || []) roleSpecs.add(s) }
      if (specialtyScope === 'current') {
        rows = rows.filter(p => p.primary_specialty && roleSpecs.has(p.primary_specialty))
      } else {
        rows = rows.filter(p => Array.from(p.all_specialties).some(s => roleSpecs.has(s)))
      }
    }

    // Specialty filter (in addition to role, or standalone)
    if (specialtySel.length > 0) {
      const s = new Set(specialtySel)
      if (specialtyScope === 'current') rows = rows.filter(p => p.primary_specialty && s.has(p.primary_specialty))
      else rows = rows.filter(p => Array.from(p.all_specialties).some(spec => s.has(spec)))
    }

    if (clearanceSel.length > 0) { const s = new Set(clearanceSel); rows = rows.filter(p => p.clearance_level && s.has(p.clearance_level)) }
    if (focusScope === 'hard_tech') rows = rows.filter(p => p.experiences_lite.some(e => e.company_focus === 'hard_tech'))
    else if (focusScope === 'all_tech') rows = rows.filter(p => p.experiences_lite.some(e => e.company_focus === 'hard_tech' || e.company_focus === 'all_tech'))

    // Compound filter with relationship
    if (compoundCompany) {
      const y1 = compoundYearMin ? parseInt(compoundYearMin, 10) : null
      const y2 = compoundYearMax ? parseInt(compoundYearMax, 10) : null
      const needSpecs = compoundSpecialties.length > 0 ? new Set(compoundSpecialties) : null
      const rStart = y1 && !isNaN(y1) ? new Date(y1, 0, 1).getTime() : null
      const rEnd = y2 && !isNaN(y2) ? new Date(y2, 11, 31).getTime() : null
      rows = rows.filter(p => p.experiences_lite.some(e => {
        if (e.company_id !== compoundCompany) return false
        if (needSpecs && !(e.specialty && needSpecs.has(e.specialty))) return false
        // Relationship filter
        if (compoundRelationship === 'current' && !e.is_current) return false
        if (compoundRelationship === 'previous' && (e.is_current || e.employment_type === 'internship')) return false
        if (compoundRelationship === 'intern' && e.employment_type !== 'internship') return false
        // Date range
        if (rStart || rEnd) {
          const eS = e.start_date ? new Date(e.start_date).getTime() : null
          const eE = e.end_date ? new Date(e.end_date).getTime() : null
          if (rEnd && eS && eS > rEnd) return false
          if (rStart && eE && eE < rStart) return false
        }
        return true
      }))
    }

    const minN = yearsMin ? parseFloat(yearsMin) : null
    const maxN = yearsMax ? parseFloat(yearsMax) : null
    if (minN && !isNaN(minN)) rows = rows.filter(p => p.years_experience_estimate != null && p.years_experience_estimate >= minN)
    if (maxN && !isNaN(maxN)) rows = rows.filter(p => p.years_experience_estimate != null && p.years_experience_estimate <= maxN)

    // Boolean title search
    if (titleBoolean.trim()) {
      rows = rows.filter(p => {
        if (specialtyScope === 'current') return matchesBoolean(p.current_title_raw || '', titleBoolean)
        return p.experiences_lite.some(e => matchesBoolean(e.title_raw || '', titleBoolean))
      })
    }
    // Boolean experience/skills search
    if (experienceBoolean.trim()) {
      rows = rows.filter(p => {
        const texts = [p.headline_raw || '', p.summary_raw || '', p.narrative_summary || '']
        for (const e of p.experiences_lite) { if (e.description_raw) texts.push(e.description_raw) }
        return texts.some(t => matchesBoolean(t, experienceBoolean))
      })
    }

    if (sortField) rows.sort((a, b) => { const av = (a[sortField] as number) ?? -1, bv = (b[sortField] as number) ?? -1; return sortDirection === 'asc' ? av - bv : bv - av })
    return rows
  }, [people, searchQuery, bucketSel, stageSel, roleSel, senioritySel, schoolSel, locationSel, specialtySel, specialtyScope, clearanceSel, focusScope, compoundCompany, compoundSpecialties, compoundYearMin, compoundYearMax, compoundRelationship, yearsMin, yearsMax, titleBoolean, experienceBoolean, sortField, sortDirection, roleSpecialtyMap])

  const activeFilterCount =
    (roleSel.length > 0 ? 1 : 0) + (bucketSel.length > 0 ? 1 : 0) + (stageSel.length > 0 ? 1 : 0) +
    (senioritySel.length > 0 ? 1 : 0) + (schoolSel.length > 0 ? 1 : 0) + (locationSel.length > 0 ? 1 : 0) +
    (specialtySel.length > 0 ? 1 : 0) + (clearanceSel.length > 0 ? 1 : 0) + (focusScope !== 'all' ? 1 : 0) +
    (compoundCompany ? 1 : 0) + (yearsMin || yearsMax ? 1 : 0) + (titleBoolean ? 1 : 0) + (experienceBoolean ? 1 : 0)

  const clearAllFilters = () => {
    setSearchQuery(''); setRoleSel([]); setBucketSel([]); setStageSel([]); setSenioritySel([])
    setSchoolSel([]); setLocationSel([]); setSpecialtySel([]); setSpecialtyScope('any')
    setClearanceSel([]); setFocusScope('all'); setCompoundCompany(''); setCompoundSpecialties([])
    setCompoundYearMin(''); setCompoundYearMax(''); setCompoundRelationship('any')
    setYearsMin(''); setYearsMax(''); setTitleBoolean(''); setExperienceBoolean('')
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

  if (loading) return <div className="flex justify-center items-center h-64"><div className="text-gray-500">Loading people...</div></div>
  if (error) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-red-700 text-sm">{error}</p></div></div>

  return (
    <div className="flex h-screen overflow-hidden">
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
        titleBoolean={titleBoolean} setTitleBoolean={setTitleBoolean}
        experienceBoolean={experienceBoolean} setExperienceBoolean={setExperienceBoolean}
        clearAllFilters={clearAllFilters} activeFilterCount={activeFilterCount}
        onOpenBuilder={() => {
          // Encode current filter state as JSON in URL param
          const state = { roleSel, specialtySel, specialtyScope, senioritySel, bucketSel, stageSel, yearsMin, yearsMax, clearanceSel, locationSel, focusScope, compoundCompany, compoundSpecialties, compoundYearMin, compoundYearMax, compoundRelationship, schoolSel, titleBoolean, experienceBoolean }
          // TODO: Refactor to individual URL params when search-URL-sharing becomes a use case.
          router.push(`/search-builder?filters=${encodeURIComponent(JSON.stringify(state))}`)
        }}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Vetted Database</h1>
            <div className="flex gap-4 text-sm">
              <a href="/admin/import" className="text-blue-600 hover:text-blue-800 underline">Import →</a>
              <a href="/admin/companies" className="text-blue-600 hover:text-blue-800 underline">Companies →</a>
            </div>
          </div>

          <input type="text" placeholder="Search by name, company, title, or location..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3" />

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {chips.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
                  {c.label}<button onClick={c.onRemove} className="text-blue-500 hover:text-blue-800 font-bold ml-0.5">×</button>
                </span>
              ))}
            </div>
          )}

          <div className="mb-3 text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{filteredPeople.length}</span> of <span className="text-gray-500">{people.length}</span> candidates
          </div>

          {selectedIds.size > 0 && (
            <div className="mb-3 flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-sm text-red-800 font-medium">{selectedIds.size} selected</span>
              <button onClick={handleBulkDelete} onBlur={() => setBulkDeleteConfirm(false)} disabled={bulkDeleting}
                className={`px-3 py-1 text-sm rounded ${bulkDeleteConfirm ? 'bg-red-600 text-white' : 'bg-white text-red-600 border border-red-300'} disabled:opacity-50`}>
                {bulkDeleting ? 'Deleting…' : bulkDeleteConfirm ? 'Click again to confirm' : 'Delete selected'}
              </button>
              <button onClick={() => { setSelectedIds(new Set()); setBulkDeleteConfirm(false) }} className="text-sm text-gray-500">Cancel</button>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-3 w-8"><input type="checkbox" checked={filteredPeople.length > 0 && selectedIds.size === filteredPeople.length} onChange={toggleSelectAll} className="rounded border-gray-300" /></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bucket</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('years_experience_estimate')}>
                      Yrs {sortField === 'years_experience_estimate' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LinkedIn</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPeople.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-4 text-center text-gray-500">No candidates match these filters</td></tr>
                  ) : filteredPeople.map(person => (
                    <tr key={person.person_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedPerson(person); setIsDrawerOpen(true) }}>
                      <td className="px-2 py-3" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(person.person_id)} onChange={() => toggleSelect(person.person_id)} className="rounded border-gray-300" /></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button onClick={e => { e.stopPropagation(); router.push(`/profile/${person.person_id}`) }} className="text-blue-600 hover:text-blue-800 font-medium">{person.full_name || 'N/A'}</button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><BucketChip bucket={person.latest_bucket} /></td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{person.location_name || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <CompanyLogo domain={guessDomain(person.current_company_name)} companyName={person.current_company_name} size={20} />
                          {cleanCompanyName(person.current_company_name) || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        <div className="truncate max-w-[220px]">{(person.current_title_normalized || person.current_title_raw || '—').split(/\s*[|–—]\s*/)[0].split(/,\s*/)[0]}</div>
                        {person.primary_specialty && <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-cyan-50 text-cyan-700 rounded text-[10px] border border-cyan-200">{person.primary_specialty.replace(/_/g, ' ')}</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{person.years_experience_estimate ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{person.career_stage_assigned?.replace(/_/g, ' ') || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {person.linkedin_url ? <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-600 hover:text-blue-800">View</a> : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <ProfileDrawer person={selectedPerson} isOpen={isDrawerOpen}
        onClose={() => { setIsDrawerOpen(false); setSelectedPerson(null) }}
        onPrev={(() => { if (!selectedPerson) return null; const i = filteredPeople.findIndex(p => p.person_id === selectedPerson.person_id); return i <= 0 ? null : () => setSelectedPerson(filteredPeople[i-1]) })()}
        onNext={(() => { if (!selectedPerson) return null; const i = filteredPeople.findIndex(p => p.person_id === selectedPerson.person_id); return i < 0 || i >= filteredPeople.length-1 ? null : () => setSelectedPerson(filteredPeople[i+1]) })()}
      />
    </div>
  )
}
