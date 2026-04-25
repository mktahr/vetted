'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Person, SortField, SortDirection, CandidateBucket, ClearanceLevel } from '../types'
import ProfileDrawer from './ProfileDrawer'
import { MultiSelectOption } from './MultiSelect'
import CompanyLogo, { guessDomain } from './CompanyLogo'
import FilterSidebar from './FilterSidebar'

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

const HARDWARE_SPECIALTIES = new Set([
  'mechanical_engineering','electrical_engineering','firmware','flight_software',
  'avionics','gnc','propulsion','controls_engineering','rf_engineering',
  'fpga_engineering','asic_engineering','hardware_engineering','systems_engineering',
  'test_engineering','manufacturing_engineering','reliability_engineering',
  'quality_engineering','structural_engineering','thermal_engineering',
  'materials_engineering','power_electronics','optics_engineering','mechatronics',
  'embedded','robotics',
])
const SOFTWARE_SPECIALTIES = new Set([
  'backend','frontend','fullstack','mobile_ios','mobile_android',
  'data_engineering','devops','sre','infrastructure','platform',
  'ml_engineering','ai_research','computer_vision','nlp','blockchain',
  'game_engineering','security','qa_testing','devrel',
])

type FocusScope = 'all' | 'hard_tech' | 'all_tech'

interface ExperienceLite {
  company_id: string | null
  company_focus: 'hard_tech' | 'all_tech' | 'unreviewed' | null
  specialty: string | null
  start_date: string | null
  end_date: string | null
}

interface PersonWithFilters extends Person {
  company_ids_all: Set<string>
  school_ids_all: Set<string>
  experiences_lite: ExperienceLite[]
  all_specialties: Set<string>
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

  // All filter state
  const [bucketSel, setBucketSel] = useState<string[]>([])
  const [stageSel, setStageSel] = useState<string[]>([])
  const [functionSel, setFunctionSel] = useState<string[]>([])
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
  const [yearsMin, setYearsMin] = useState<string>('')
  const [yearsMax, setYearsMax] = useState<string>('')
  const [schoolScope, setSchoolScope] = useState<'us' | 'all'>('us')

  // Dropdown options
  const [functionOptions, setFunctionOptions] = useState<MultiSelectOption[]>([])
  const [seniorityOptions, setSeniorityOptions] = useState<MultiSelectOption[]>([])
  const [companyOptions, setCompanyOptions] = useState<MultiSelectOption[]>([])
  const [schoolOptions, setSchoolOptions] = useState<MultiSelectOption[]>([])
  const [locationOptions, setLocationOptions] = useState<MultiSelectOption[]>([])
  const [specialtyOptions, setSpecialtyOptions] = useState<MultiSelectOption[]>([])

  // ─── Fetch everything ──────────────────────────────────────────────────

  useEffect(() => {
    async function fetchAll() {
      try {
        const [
          { data: peopleData, error: peopleErr },
          { data: bucketData },
          { data: expData },
          { data: eduData },
          { data: fns },
          { data: srs },
          { data: companies },
          { data: schools },
          { data: specDict },
        ] = await Promise.all([
          supabase.from('people').select(`*, companies:current_company_id ( company_name )`).order('created_at', { ascending: false }),
          supabase.from('candidate_bucket_assignments').select('person_id, candidate_bucket, assignment_reason, effective_at').order('effective_at', { ascending: false }),
          supabase.from('person_experiences').select('person_id, company_id, specialty_normalized, start_date, end_date'),
          supabase.from('person_education').select('person_id, school_id'),
          supabase.from('function_dictionary').select('function_normalized').eq('active', true).order('function_normalized'),
          supabase.from('seniority_dictionary').select('seniority_normalized, rank_order').eq('active', true).order('rank_order'),
          supabase.from('companies').select('company_id, company_name, primary_industry_tag, focus').order('company_name'),
          supabase.from('schools').select('school_id, school_name, school_score, is_foreign').order('school_name'),
          supabase.from('specialty_dictionary').select('specialty_normalized, parent_function').eq('active', true).order('specialty_normalized'),
        ])

        if (peopleErr) { setError(`Database error: ${peopleErr.message}`); return }

        const latestBucketByPerson: Record<string, { bucket: CandidateBucket; reason: string | null }> = {}
        for (const row of bucketData || []) {
          if (!latestBucketByPerson[row.person_id]) {
            latestBucketByPerson[row.person_id] = { bucket: row.candidate_bucket as CandidateBucket, reason: row.assignment_reason }
          }
        }

        const companyFocusById: Record<string, 'hard_tech' | 'all_tech' | 'unreviewed'> = {}
        for (const c of companies || []) companyFocusById[c.company_id] = (c as any).focus ?? 'all_tech'

        const companyIdsByPerson: Record<string, Set<string>> = {}
        const expLiteByPerson: Record<string, ExperienceLite[]> = {}
        const allSpecialtiesByPerson: Record<string, Set<string>> = {}
        for (const row of expData || []) {
          const pid = row.person_id
          if (row.company_id) {
            if (!companyIdsByPerson[pid]) companyIdsByPerson[pid] = new Set()
            companyIdsByPerson[pid].add(row.company_id)
          }
          if (!expLiteByPerson[pid]) expLiteByPerson[pid] = []
          expLiteByPerson[pid].push({
            company_id: row.company_id, company_focus: row.company_id ? (companyFocusById[row.company_id] ?? null) : null,
            specialty: (row as any).specialty_normalized ?? null, start_date: (row as any).start_date ?? null, end_date: (row as any).end_date ?? null,
          })
          if ((row as any).specialty_normalized) {
            if (!allSpecialtiesByPerson[pid]) allSpecialtiesByPerson[pid] = new Set()
            allSpecialtiesByPerson[pid].add((row as any).specialty_normalized)
          }
        }

        const schoolIdsByPerson: Record<string, Set<string>> = {}
        for (const row of eduData || []) {
          if (!row.school_id) continue
          if (!schoolIdsByPerson[row.person_id]) schoolIdsByPerson[row.person_id] = new Set()
          schoolIdsByPerson[row.person_id].add(row.school_id)
        }

        const rows: PersonWithFilters[] = (peopleData || []).map((row: any) => ({
          ...row,
          current_company_name: row.companies?.company_name || null,
          latest_bucket: latestBucketByPerson[row.person_id]?.bucket ?? null,
          latest_bucket_reason: latestBucketByPerson[row.person_id]?.reason ?? null,
          company_ids_all: companyIdsByPerson[row.person_id] || new Set(),
          school_ids_all: schoolIdsByPerson[row.person_id] || new Set(),
          experiences_lite: expLiteByPerson[row.person_id] || [],
          all_specialties: allSpecialtiesByPerson[row.person_id] || new Set(),
        }))
        setPeople(rows)

        setFunctionOptions((fns || []).map(f => ({ value: f.function_normalized, label: f.function_normalized.replace(/_/g, ' ') })))
        setSeniorityOptions((srs || []).map(s => ({ value: s.seniority_normalized, label: s.seniority_normalized.replace(/_/g, ' ') })))

        // Company options: ONLY hard_tech + all_tech (not unreviewed noise)
        setCompanyOptions((companies || []).filter((c: any) => c.focus === 'hard_tech' || c.focus === 'all_tech').map((c: any) => ({
          value: c.company_id, label: c.company_name, sublabel: c.primary_industry_tag || undefined,
        })))

        // School options: ONLY ranked schools (school_score IS NOT NULL)
        setSchoolOptions((schools || []).filter((s: any) => s.school_score != null).map((s: any) => ({
          value: s.school_id, label: s.school_name, sublabel: s.is_foreign ? 'Int\'l' : undefined,
        })))

        // Location options: extract US states from raw location strings
        // e.g. "San Francisco, California, United States" → state = "California"
        const US_STATES = new Set([
          'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
          'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
          'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
          'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
          'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
          'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
          'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
          'Wisconsin','Wyoming','District of Columbia',
        ])
        const stateSet = new Set<string>()
        const citySet = new Set<string>()
        const rawLocs = new Set<string>()
        for (const r of peopleData || []) {
          const loc = r.location_name as string | null
          if (!loc) continue
          rawLocs.add(loc)
          // Try to extract state from "City, State, Country" or "Metro Area"
          const parts = loc.split(',').map((s: string) => s.trim())
          for (const part of parts) {
            if (US_STATES.has(part)) stateSet.add(part)
          }
          // Also add major metro areas as-is if they contain "United States"
          if (loc.includes('United States') && parts.length >= 1) {
            citySet.add(parts[0]) // the city/metro part
          }
        }
        // Build options: US states first, then metro areas
        const locOpts: MultiSelectOption[] = [
          ...Array.from(stateSet).sort().map(s => ({ value: s, label: s, sublabel: 'state' })),
          ...Array.from(citySet).sort().map(c => ({ value: c, label: c, sublabel: 'city' })),
        ]
        setLocationOptions(locOpts)

        // Specialty options grouped: Hardware first, then Software, then others
        const dict = (specDict || []) as Array<{ specialty_normalized: string; parent_function: string | null }>
        const hw: MultiSelectOption[] = [], sw: MultiSelectOption[] = [], byP: Record<string, MultiSelectOption[]> = {}
        for (const d of dict) {
          const opt: MultiSelectOption = { value: d.specialty_normalized, label: d.specialty_normalized.replace(/_/g, ' ') }
          if (HARDWARE_SPECIALTIES.has(d.specialty_normalized)) hw.push({ ...opt, sublabel: 'hardware' })
          else if (SOFTWARE_SPECIALTIES.has(d.specialty_normalized)) sw.push({ ...opt, sublabel: 'software' })
          else { const p = d.parent_function || 'other'; if (!byP[p]) byP[p] = []; byP[p].push({ ...opt, sublabel: p.replace(/_/g, ' ') }) }
        }
        setSpecialtyOptions([
          ...hw.sort((a, b) => a.label.localeCompare(b.label)),
          ...sw.sort((a, b) => a.label.localeCompare(b.label)),
          ...Object.keys(byP).sort().flatMap(k => byP[k].sort((a, b) => a.label.localeCompare(b.label))),
        ])

        setError(null)
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch people.')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // ─── Filter + sort ────────────────────────────────────────────────────

  const filteredPeople = useMemo(() => {
    let rows: PersonWithFilters[] = [...people]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      rows = rows.filter(p => p.full_name?.toLowerCase().includes(q) || p.current_company_name?.toLowerCase().includes(q) || p.current_title_raw?.toLowerCase().includes(q) || p.location_name?.toLowerCase().includes(q))
    }
    if (bucketSel.length > 0) { const s = new Set(bucketSel); rows = rows.filter(p => p.latest_bucket && s.has(p.latest_bucket)) }
    if (stageSel.length > 0) { const s = new Set(stageSel); rows = rows.filter(p => p.career_stage_assigned && s.has(p.career_stage_assigned)) }
    if (functionSel.length > 0) { const s = new Set(functionSel); rows = rows.filter(p => p.current_function_normalized && s.has(p.current_function_normalized)) }
    if (senioritySel.length > 0) { const s = new Set(senioritySel); rows = rows.filter(p => p.highest_seniority_reached && s.has(p.highest_seniority_reached)) }
    if (schoolSel.length > 0) { const s = new Set(schoolSel); rows = rows.filter(p => Array.from(p.school_ids_all).some(id => s.has(id))) }
    if (locationSel.length > 0) {
      const s = new Set(locationSel)
      rows = rows.filter(p => {
        if (!p.location_name) return false
        // Match if any selected value appears as a substring in the location
        for (const sel of Array.from(s)) {
          if (p.location_name!.includes(sel)) return true
        }
        return false
      })
    }
    if (specialtySel.length > 0) {
      const s = new Set(specialtySel)
      if (specialtyScope === 'current') rows = rows.filter(p => p.primary_specialty && s.has(p.primary_specialty))
      else rows = rows.filter(p => Array.from(p.all_specialties).some(spec => s.has(spec)))
    }
    if (clearanceSel.length > 0) { const s = new Set(clearanceSel); rows = rows.filter(p => p.clearance_level && s.has(p.clearance_level)) }
    if (focusScope === 'hard_tech') rows = rows.filter(p => p.experiences_lite.some(e => e.company_focus === 'hard_tech'))
    else if (focusScope === 'all_tech') rows = rows.filter(p => p.experiences_lite.some(e => e.company_focus === 'hard_tech' || e.company_focus === 'all_tech'))
    if (compoundCompany) {
      const y1 = compoundYearMin === '' ? null : parseInt(compoundYearMin, 10)
      const y2 = compoundYearMax === '' ? null : parseInt(compoundYearMax, 10)
      const needSpecs = compoundSpecialties.length > 0 ? new Set(compoundSpecialties) : null
      const rangeStart = y1 !== null && !isNaN(y1) ? new Date(y1, 0, 1).getTime() : null
      const rangeEnd = y2 !== null && !isNaN(y2) ? new Date(y2, 11, 31).getTime() : null
      rows = rows.filter(p => p.experiences_lite.some(e => {
        if (e.company_id !== compoundCompany) return false
        if (needSpecs && !(e.specialty && needSpecs.has(e.specialty))) return false
        if (rangeStart !== null || rangeEnd !== null) {
          const eS = e.start_date ? new Date(e.start_date).getTime() : null
          const eE = e.end_date ? new Date(e.end_date).getTime() : null
          if (rangeEnd !== null && eS !== null && eS > rangeEnd) return false
          if (rangeStart !== null && eE !== null && eE < rangeStart) return false
        }
        return true
      }))
    }
    const minN = yearsMin === '' ? null : parseFloat(yearsMin)
    const maxN = yearsMax === '' ? null : parseFloat(yearsMax)
    if (minN !== null && !isNaN(minN)) rows = rows.filter(p => p.years_experience_estimate != null && p.years_experience_estimate >= minN)
    if (maxN !== null && !isNaN(maxN)) rows = rows.filter(p => p.years_experience_estimate != null && p.years_experience_estimate <= maxN)
    if (sortField) rows.sort((a, b) => { const av = (a[sortField] as number) ?? -1, bv = (b[sortField] as number) ?? -1; return sortDirection === 'asc' ? av - bv : bv - av })
    return rows
  }, [people, searchQuery, bucketSel, stageSel, functionSel, senioritySel, schoolSel, locationSel, specialtySel, specialtyScope, clearanceSel, focusScope, compoundCompany, compoundSpecialties, compoundYearMin, compoundYearMax, yearsMin, yearsMax, sortField, sortDirection])

  const activeFilterCount =
    (bucketSel.length > 0 ? 1 : 0) + (stageSel.length > 0 ? 1 : 0) + (functionSel.length > 0 ? 1 : 0) +
    (senioritySel.length > 0 ? 1 : 0) + (schoolSel.length > 0 ? 1 : 0) + (locationSel.length > 0 ? 1 : 0) +
    (specialtySel.length > 0 ? 1 : 0) + (clearanceSel.length > 0 ? 1 : 0) + (focusScope !== 'all' ? 1 : 0) +
    (compoundCompany ? 1 : 0) + (yearsMin !== '' || yearsMax !== '' ? 1 : 0)

  const clearAllFilters = () => {
    setSearchQuery(''); setBucketSel([]); setStageSel([]); setFunctionSel([]); setSenioritySel([])
    setSchoolSel([]); setLocationSel([]); setSpecialtySel([]); setSpecialtyScope('any')
    setClearanceSel([]); setFocusScope('all'); setCompoundCompany(''); setCompoundSpecialties([])
    setCompoundYearMin(''); setCompoundYearMax(''); setYearsMin(''); setYearsMax('')
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection('desc') }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleSelectAll() {
    if (selectedIds.size === filteredPeople.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredPeople.map(p => p.person_id)))
  }
  async function handleBulkDelete() {
    if (!bulkDeleteConfirm) { setBulkDeleteConfirm(true); return }
    setBulkDeleting(true)
    for (const id of Array.from(selectedIds)) await fetch(`/api/people/${id}`, { method: 'DELETE' })
    setPeople(prev => prev.filter(p => !selectedIds.has(p.person_id)))
    setSelectedIds(new Set()); setBulkDeleting(false); setBulkDeleteConfirm(false)
  }

  // ─── Active filter chips ──────────────────────────────────────────────

  const chips: Array<{ label: string; onRemove: () => void }> = []
  if (focusScope !== 'all') chips.push({ label: `Scope: ${focusScope.replace('_', ' ')}`, onRemove: () => setFocusScope('all') })
  for (const v of specialtySel) chips.push({ label: `Specialty: ${v.replace(/_/g, ' ')}`, onRemove: () => setSpecialtySel(specialtySel.filter(x => x !== v)) })
  for (const v of senioritySel) chips.push({ label: `Seniority: ${v.replace(/_/g, ' ')}`, onRemove: () => setSenioritySel(senioritySel.filter(x => x !== v)) })
  for (const v of bucketSel) chips.push({ label: `Bucket: ${v.replace(/_/g, ' ')}`, onRemove: () => setBucketSel(bucketSel.filter(x => x !== v)) })
  for (const v of stageSel) chips.push({ label: `Stage: ${v.replace(/_/g, ' ')}`, onRemove: () => setStageSel(stageSel.filter(x => x !== v)) })
  if (yearsMin || yearsMax) chips.push({ label: `Yrs: ${yearsMin || '0'}–${yearsMax || '∞'}`, onRemove: () => { setYearsMin(''); setYearsMax('') } })
  for (const v of clearanceSel) chips.push({ label: `Clearance: ${v.replace(/_/g, ' ')}`, onRemove: () => setClearanceSel(clearanceSel.filter(x => x !== v)) })
  for (const v of locationSel) chips.push({ label: `Location: ${v}`, onRemove: () => setLocationSel(locationSel.filter(x => x !== v)) })
  if (compoundCompany) {
    const co = companyOptions.find(c => c.value === compoundCompany)
    chips.push({ label: `At: ${co?.label || '?'}`, onRemove: () => { setCompoundCompany(''); setCompoundSpecialties([]); setCompoundYearMin(''); setCompoundYearMax('') } })
  }
  for (const v of schoolSel) {
    const sc = schoolOptions.find(s => s.value === v)
    chips.push({ label: `School: ${sc?.label || v}`, onRemove: () => setSchoolSel(schoolSel.filter(x => x !== v)) })
  }
  for (const v of functionSel) chips.push({ label: `Function: ${v.replace(/_/g, ' ')}`, onRemove: () => setFunctionSel(functionSel.filter(x => x !== v)) })

  // ─── Render ──────────────────────────────────────────────────────────

  if (loading) return <div className="flex justify-center items-center h-64"><div className="text-gray-500">Loading people...</div></div>
  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4"><p className="text-red-700 text-sm">{error}</p></div>
      <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Retry</button>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left sidebar */}
      <FilterSidebar
        specialtySel={specialtySel} setSpecialtySel={setSpecialtySel}
        specialtyScope={specialtyScope} setSpecialtyScope={setSpecialtyScope}
        specialtyOptions={specialtyOptions}
        senioritySel={senioritySel} setSenioritySel={setSenioritySel}
        seniorityOptions={seniorityOptions}
        bucketSel={bucketSel} setBucketSel={setBucketSel}
        stageSel={stageSel} setStageSel={setStageSel}
        yearsMin={yearsMin} setYearsMin={setYearsMin}
        yearsMax={yearsMax} setYearsMax={setYearsMax}
        clearanceSel={clearanceSel} setClearanceSel={setClearanceSel}
        locationSel={locationSel} setLocationSel={setLocationSel}
        locationOptions={locationOptions}
        focusScope={focusScope} setFocusScope={setFocusScope}
        compoundCompany={compoundCompany} setCompoundCompany={setCompoundCompany}
        compoundSpecialties={compoundSpecialties} setCompoundSpecialties={setCompoundSpecialties}
        compoundYearMin={compoundYearMin} setCompoundYearMin={setCompoundYearMin}
        compoundYearMax={compoundYearMax} setCompoundYearMax={setCompoundYearMax}
        companyOptions={companyOptions}
        schoolSel={schoolSel} setSchoolSel={setSchoolSel}
        schoolOptions={schoolOptions}
        schoolScope={schoolScope} setSchoolScope={setSchoolScope}
        functionSel={functionSel} setFunctionSel={setFunctionSel}
        functionOptions={functionOptions}
        clearAllFilters={clearAllFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* Right main area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Vetted Database</h1>
            <div className="flex gap-4 text-sm">
              <a href="/admin/import" className="text-blue-600 hover:text-blue-800 underline">Import →</a>
              <a href="/admin/companies" className="text-blue-600 hover:text-blue-800 underline">Companies →</a>
            </div>
          </div>

          {/* Search bar */}
          <input
            type="text"
            placeholder="Search by name, company, title, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          />

          {/* Active filter chips */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {chips.map((chip, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
                  {chip.label}
                  <button onClick={chip.onRemove} className="text-blue-500 hover:text-blue-800 font-bold ml-0.5">×</button>
                </span>
              ))}
            </div>
          )}

          {/* Count */}
          <div className="mb-3 flex items-center justify-between text-sm text-gray-600">
            <span>
              <span className="font-semibold text-gray-900">{filteredPeople.length}</span> of <span className="text-gray-500">{people.length}</span> candidates
            </span>
          </div>

          {/* Bulk delete bar */}
          {selectedIds.size > 0 && (
            <div className="mb-3 flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-sm text-red-800 font-medium">{selectedIds.size} selected</span>
              <button onClick={handleBulkDelete} onBlur={() => setBulkDeleteConfirm(false)} disabled={bulkDeleting}
                className={`px-3 py-1 text-sm rounded ${bulkDeleteConfirm ? 'bg-red-600 text-white' : 'bg-white text-red-600 border border-red-300'} disabled:opacity-50`}>
                {bulkDeleting ? 'Deleting…' : bulkDeleteConfirm ? 'Click again to confirm' : 'Delete selected'}
              </button>
              <button onClick={() => { setSelectedIds(new Set()); setBulkDeleteConfirm(false) }} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          )}

          {/* Results table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-3 w-8">
                      <input type="checkbox" checked={filteredPeople.length > 0 && selectedIds.size === filteredPeople.length} onChange={toggleSelectAll} className="rounded border-gray-300" />
                    </th>
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
                  ) : (
                    filteredPeople.map((person) => (
                      <tr key={person.person_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedPerson(person); setIsDrawerOpen(true) }}>
                        <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(person.person_id)} onChange={() => toggleSelect(person.person_id)} className="rounded border-gray-300" />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button onClick={e => { e.stopPropagation(); router.push(`/profile/${person.person_id}`) }} className="text-blue-600 hover:text-blue-800 font-medium">
                            {person.full_name || 'N/A'}
                          </button>
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
                          <div className="truncate max-w-[220px]">
                            {(person.current_title_normalized || person.current_title_raw || '—').split(/\s*[|–—]\s*/)[0].split(/,\s*/)[0]}
                          </div>
                          {person.primary_specialty && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-cyan-50 text-cyan-700 rounded text-[10px] border border-cyan-200">
                              {person.primary_specialty.replace(/_/g, ' ')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{person.years_experience_estimate ?? '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{person.career_stage_assigned?.replace(/_/g, ' ') || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {person.linkedin_url ? (
                            <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-600 hover:text-blue-800">View</a>
                          ) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <ProfileDrawer
        person={selectedPerson} isOpen={isDrawerOpen}
        onClose={() => { setIsDrawerOpen(false); setSelectedPerson(null) }}
        onPrev={(() => { if (!selectedPerson) return null; const i = filteredPeople.findIndex(p => p.person_id === selectedPerson.person_id); return i <= 0 ? null : () => setSelectedPerson(filteredPeople[i-1]) })()}
        onNext={(() => { if (!selectedPerson) return null; const i = filteredPeople.findIndex(p => p.person_id === selectedPerson.person_id); return i < 0 || i >= filteredPeople.length-1 ? null : () => setSelectedPerson(filteredPeople[i+1]) })()}
      />
    </div>
  )
}
