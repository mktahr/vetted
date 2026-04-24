'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Person, SortField, SortDirection, CandidateBucket, ClearanceLevel } from '../types'
import ProfileDrawer from './ProfileDrawer'
import { MultiSelect, MultiSelectOption } from './MultiSelect'
import CompanyLogo, { guessDomain } from './CompanyLogo'

/** Strip employment type from company name: "Acme · Full-time" → "Acme" */
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
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  )
}

// ─── Static option sets ────────────────────────────────────────────────────

const BUCKET_OPTIONS: MultiSelectOption[] = [
  { value: 'vetted_talent',   label: 'Vetted Talent' },
  { value: 'high_potential',  label: 'High Potential' },
  { value: 'silver_medalist', label: 'Silver Medalist' },
  { value: 'non_vetted',      label: 'Non-Vetted' },
  { value: 'needs_review',    label: 'Needs Review' },
]

const STAGE_OPTIONS: MultiSelectOption[] = [
  { value: 'pre_career',    label: 'Pre-Career' },
  { value: 'early_career',  label: 'Early Career' },
  { value: 'mid_career',    label: 'Mid Career' },
  { value: 'senior_career', label: 'Senior Career' },
]

const CLEARANCE_OPTIONS: MultiSelectOption[] = [
  { value: 'none',         label: 'None' },
  { value: 'confidential', label: 'Confidential' },
  { value: 'secret',       label: 'Secret' },
  { value: 'top_secret',   label: 'Top Secret' },
  { value: 'ts_sci',       label: 'TS/SCI' },
  { value: 'q_clearance',  label: 'Q (DOE)' },
  { value: 'other',        label: 'Other' },
  { value: 'unknown',      label: 'Unknown' },
]

// Hard-tech specialties surface first when focus scope is hard_tech.
// Matches migration 016's new specialty entries plus pre-existing hardware
// specialties (embedded, robotics).
const HARDWARE_SPECIALTIES = new Set([
  'mechanical_engineering', 'electrical_engineering', 'firmware', 'flight_software',
  'avionics', 'gnc', 'propulsion', 'controls_engineering', 'rf_engineering',
  'fpga_engineering', 'asic_engineering', 'hardware_engineering', 'systems_engineering',
  'test_engineering', 'manufacturing_engineering', 'reliability_engineering',
  'quality_engineering', 'structural_engineering', 'thermal_engineering',
  'materials_engineering', 'power_electronics', 'optics_engineering', 'mechatronics',
  'embedded', 'robotics',
])

const SOFTWARE_SPECIALTIES = new Set([
  'backend', 'frontend', 'fullstack', 'mobile_ios', 'mobile_android',
  'data_engineering', 'devops', 'sre', 'infrastructure', 'platform',
  'ml_engineering', 'ai_research', 'computer_vision', 'nlp', 'blockchain',
  'game_engineering', 'security', 'qa_testing', 'devrel',
])

type FocusScope = 'all' | 'hard_tech' | 'all_tech'

/** Compact per-experience record kept on each Person for in-memory filtering. */
interface ExperienceLite {
  company_id: string | null
  company_focus: 'hard_tech' | 'all_tech' | 'unreviewed' | null
  specialty: string | null
  start_date: string | null
  end_date: string | null
}

// ─── Enriched person record (people table + filter lookup sets) ────────────

interface PersonWithFilters extends Person {
  company_ids_all: Set<string>
  school_ids_all: Set<string>
  // Per-experience lite records for focus-scope + compound filters
  experiences_lite: ExperienceLite[]
  // Union of specialties across ALL experiences (for "any past specialty")
  all_specialties: Set<string>
}

// ─── Component ─────────────────────────────────────────────────────────────

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

  // Multi-select filters (all ANDed together; within a field, values OR)
  const [bucketSel, setBucketSel] = useState<string[]>([])
  const [stageSel, setStageSel] = useState<string[]>([])
  const [functionSel, setFunctionSel] = useState<string[]>([])
  const [senioritySel, setSenioritySel] = useState<string[]>([])
  const [companySel, setCompanySel] = useState<string[]>([])     // company_id values
  const [schoolSel, setSchoolSel] = useState<string[]>([])       // school_id values
  const [locationSel, setLocationSel] = useState<string[]>([])   // location_name values
  const [specialtySel, setSpecialtySel] = useState<string[]>([]) // specialty_normalized values
  const [clearanceSel, setClearanceSel] = useState<string[]>([]) // clearance_level values

  // Specialty scope: "current" reads people.primary_specialty;
  // "any" reads across all person_experiences.specialty_normalized.
  // Default "any" captures career switchers.
  const [specialtyScope, setSpecialtyScope] = useState<'current' | 'any'>('any')

  // Focus scope — narrows candidate list by whether they have experience
  // at hard_tech / all_tech companies.
  const [focusScope, setFocusScope] = useState<FocusScope>('all')

  // Compound filter: "worked at <company> as <specialty> between <y1> and <y2>"
  const [compoundCompany, setCompoundCompany] = useState<string>('') // single company_id
  const [compoundSpecialties, setCompoundSpecialties] = useState<string[]>([])
  const [compoundYearMin, setCompoundYearMin] = useState<string>('')
  const [compoundYearMax, setCompoundYearMax] = useState<string>('')

  // Years-of-experience range (min/max inclusive)
  const [yearsMin, setYearsMin] = useState<string>('')
  const [yearsMax, setYearsMax] = useState<string>('')

  // Dropdown option sources (loaded from dictionaries + data)
  const [functionOptions, setFunctionOptions] = useState<MultiSelectOption[]>([])
  const [seniorityOptions, setSeniorityOptions] = useState<MultiSelectOption[]>([])
  const [companyOptions, setCompanyOptions] = useState<MultiSelectOption[]>([])
  const [schoolOptions, setSchoolOptions] = useState<MultiSelectOption[]>([])
  const [locationOptions, setLocationOptions] = useState<MultiSelectOption[]>([])
  const [specialtyOptions, setSpecialtyOptions] = useState<MultiSelectOption[]>([])

  // ─── Fetch everything in parallel ────────────────────────────────────────
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
          supabase.from('people').select(`
            *,
            companies:current_company_id ( company_name )
          `).order('created_at', { ascending: false }),
          supabase.from('candidate_bucket_assignments')
            .select('person_id, candidate_bucket, assignment_reason, effective_at')
            .order('effective_at', { ascending: false }),
          supabase.from('person_experiences').select('person_id, company_id, specialty_normalized, start_date, end_date'),
          supabase.from('person_education').select('person_id, school_id'),
          supabase.from('function_dictionary').select('function_normalized').eq('active', true).order('function_normalized'),
          supabase.from('seniority_dictionary').select('seniority_normalized, rank_order').eq('active', true).order('rank_order'),
          supabase.from('companies').select('company_id, company_name, primary_industry_tag, focus').order('company_name'),
          supabase.from('schools').select('school_id, school_name, is_foreign').order('school_name'),
          supabase.from('specialty_dictionary').select('specialty_normalized, parent_function').eq('active', true).order('specialty_normalized'),
        ])

        if (peopleErr) {
          setError(`Database error: ${peopleErr.message}`)
          return
        }

        // Latest bucket per person (bucketData already sorted desc)
        const latestBucketByPerson: Record<string, { bucket: CandidateBucket; reason: string | null }> = {}
        for (const row of bucketData || []) {
          if (!latestBucketByPerson[row.person_id]) {
            latestBucketByPerson[row.person_id] = {
              bucket: row.candidate_bucket as CandidateBucket,
              reason: row.assignment_reason,
            }
          }
        }

        // Build company_id → focus lookup for per-experience enrichment
        const companyFocusById: Record<string, 'hard_tech' | 'all_tech' | 'unreviewed'> = {}
        for (const c of companies || []) {
          companyFocusById[c.company_id] = (c as any).focus ?? 'all_tech'
        }

        // company_ids per person (for "ever worked at" filter)
        const companyIdsByPerson: Record<string, Set<string>> = {}
        // Lite per-experience records (for focus scope + compound filter)
        const expLiteByPerson: Record<string, ExperienceLite[]> = {}
        // Union of specialties across all a person's experiences
        const allSpecialtiesByPerson: Record<string, Set<string>> = {}

        for (const row of expData || []) {
          const pid = row.person_id
          if (row.company_id) {
            if (!companyIdsByPerson[pid]) companyIdsByPerson[pid] = new Set()
            companyIdsByPerson[pid].add(row.company_id)
          }
          if (!expLiteByPerson[pid]) expLiteByPerson[pid] = []
          expLiteByPerson[pid].push({
            company_id: row.company_id,
            company_focus: row.company_id ? (companyFocusById[row.company_id] ?? null) : null,
            specialty: (row as any).specialty_normalized ?? null,
            start_date: (row as any).start_date ?? null,
            end_date: (row as any).end_date ?? null,
          })
          if ((row as any).specialty_normalized) {
            if (!allSpecialtiesByPerson[pid]) allSpecialtiesByPerson[pid] = new Set()
            allSpecialtiesByPerson[pid].add((row as any).specialty_normalized)
          }
        }

        // school_ids per person (for "ever studied at" filter)
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

        // Dropdown options
        setFunctionOptions((fns || []).map(f => ({
          value: f.function_normalized,
          label: f.function_normalized.replace(/_/g, ' '),
        })))
        setSeniorityOptions((srs || []).map(s => ({
          value: s.seniority_normalized,
          label: s.seniority_normalized.replace(/_/g, ' '),
        })))
        setCompanyOptions((companies || []).map((c: any) => ({
          value: c.company_id,
          label: c.company_name,
          sublabel: c.primary_industry_tag || undefined,
        })))
        setSchoolOptions((schools || []).map((s: any) => ({
          value: s.school_id,
          label: s.school_name,
          sublabel: s.is_foreign ? 'Int’l' : undefined,
        })))

        // Unique location_name values from people table (not a dictionary,
        // so we extract from what's actually stored)
        const locs = new Set<string>()
        for (const r of peopleData || []) if (r.location_name) locs.add(r.location_name)
        setLocationOptions(
          Array.from(locs).sort().map(l => ({ value: l, label: l }))
        )

        // Specialty options — all active specialties from the dictionary,
        // grouped: Hardware engineering first (for hard-tech recruiting),
        // then Software engineering, then non-engineering grouped by parent.
        const dict = (specDict || []) as Array<{ specialty_normalized: string; parent_function: string | null }>
        const hardware: MultiSelectOption[] = []
        const software: MultiSelectOption[] = []
        const byParent: Record<string, MultiSelectOption[]> = {}
        for (const d of dict) {
          const opt: MultiSelectOption = {
            value: d.specialty_normalized,
            label: d.specialty_normalized.replace(/_/g, ' '),
          }
          if (HARDWARE_SPECIALTIES.has(d.specialty_normalized)) {
            hardware.push({ ...opt, sublabel: 'hardware' })
          } else if (SOFTWARE_SPECIALTIES.has(d.specialty_normalized)) {
            software.push({ ...opt, sublabel: 'software' })
          } else {
            const parent = d.parent_function || 'other'
            if (!byParent[parent]) byParent[parent] = []
            byParent[parent].push({ ...opt, sublabel: parent.replace(/_/g, ' ') })
          }
        }
        const grouped: MultiSelectOption[] = [
          ...hardware.sort((a, b) => a.label.localeCompare(b.label)),
          ...software.sort((a, b) => a.label.localeCompare(b.label)),
          ...Object.keys(byParent).sort().flatMap(k =>
            byParent[k].sort((a, b) => a.label.localeCompare(b.label))
          ),
        ]
        setSpecialtyOptions(grouped)

        setError(null)
      } catch (err: any) {
        console.error('Error fetching people:', err)
        setError(err?.message || 'Failed to fetch people.')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // ─── Filter + sort ──────────────────────────────────────────────────────

  const filteredPeople = useMemo(() => {
    let rows: PersonWithFilters[] = [...people]

    // Free-text search on name/current-company/title/location
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      rows = rows.filter(p =>
        p.full_name?.toLowerCase().includes(q) ||
        p.current_company_name?.toLowerCase().includes(q) ||
        p.current_title_raw?.toLowerCase().includes(q) ||
        p.location_name?.toLowerCase().includes(q)
      )
    }

    // Multi-select: bucket
    if (bucketSel.length > 0) {
      const s = new Set(bucketSel)
      rows = rows.filter(p => p.latest_bucket && s.has(p.latest_bucket))
    }

    // Multi-select: career stage
    if (stageSel.length > 0) {
      const s = new Set(stageSel)
      rows = rows.filter(p => p.career_stage_assigned && s.has(p.career_stage_assigned))
    }

    // Multi-select: function
    if (functionSel.length > 0) {
      const s = new Set(functionSel)
      rows = rows.filter(p => p.current_function_normalized && s.has(p.current_function_normalized))
    }

    // Multi-select: seniority (highest_seniority_reached)
    if (senioritySel.length > 0) {
      const s = new Set(senioritySel)
      rows = rows.filter(p => p.highest_seniority_reached && s.has(p.highest_seniority_reached))
    }

    // Multi-select: company (ANY of the person's experience companies matches)
    if (companySel.length > 0) {
      const s = new Set(companySel)
      rows = rows.filter(p => Array.from(p.company_ids_all).some(id => s.has(id)))
    }

    // Multi-select: school
    if (schoolSel.length > 0) {
      const s = new Set(schoolSel)
      rows = rows.filter(p => Array.from(p.school_ids_all).some(id => s.has(id)))
    }

    // Multi-select: location
    if (locationSel.length > 0) {
      const s = new Set(locationSel)
      rows = rows.filter(p => p.location_name && s.has(p.location_name))
    }

    // Multi-select: specialty (scope-aware)
    if (specialtySel.length > 0) {
      const s = new Set(specialtySel)
      if (specialtyScope === 'current') {
        rows = rows.filter(p => p.primary_specialty && s.has(p.primary_specialty))
      } else {
        // "any past specialty" — scan all experiences
        rows = rows.filter(p => Array.from(p.all_specialties).some(spec => s.has(spec)))
      }
    }

    // Multi-select: clearance_level
    if (clearanceSel.length > 0) {
      const s = new Set(clearanceSel)
      rows = rows.filter(p => p.clearance_level && s.has(p.clearance_level))
    }

    // Focus scope — candidate must have at least one experience at a company
    // with the matching focus. 'all' = no filter.
    if (focusScope === 'hard_tech') {
      rows = rows.filter(p => p.experiences_lite.some(e => e.company_focus === 'hard_tech'))
    } else if (focusScope === 'all_tech') {
      rows = rows.filter(p => p.experiences_lite.some(e => e.company_focus === 'hard_tech' || e.company_focus === 'all_tech'))
    }

    // Compound filter: worked at <company> with <specialty> between <y1> and <y2>
    if (compoundCompany) {
      const y1 = compoundYearMin === '' ? null : parseInt(compoundYearMin, 10)
      const y2 = compoundYearMax === '' ? null : parseInt(compoundYearMax, 10)
      const needSpecs = compoundSpecialties.length > 0 ? new Set(compoundSpecialties) : null
      // Range bounds in days-since-epoch, inclusive
      const rangeStart = y1 !== null && !isNaN(y1) ? new Date(y1, 0, 1).getTime() : null
      const rangeEnd = y2 !== null && !isNaN(y2) ? new Date(y2, 11, 31).getTime() : null

      rows = rows.filter(p => {
        return p.experiences_lite.some(e => {
          if (e.company_id !== compoundCompany) return false
          if (needSpecs && !(e.specialty && needSpecs.has(e.specialty))) return false
          // Date-range overlap: exp.start <= rangeEnd AND (exp.end >= rangeStart OR exp.end is null)
          if (rangeStart !== null || rangeEnd !== null) {
            const expStart = e.start_date ? new Date(e.start_date).getTime() : null
            const expEnd = e.end_date ? new Date(e.end_date).getTime() : null // null = ongoing
            if (rangeEnd !== null && expStart !== null && expStart > rangeEnd) return false
            if (rangeStart !== null && expEnd !== null && expEnd < rangeStart) return false
          }
          return true
        })
      })
    }

    // Years-of-experience range
    const minN = yearsMin === '' ? null : parseFloat(yearsMin)
    const maxN = yearsMax === '' ? null : parseFloat(yearsMax)
    if (minN !== null && !isNaN(minN)) {
      rows = rows.filter(p => p.years_experience_estimate != null && p.years_experience_estimate >= minN)
    }
    if (maxN !== null && !isNaN(maxN)) {
      rows = rows.filter(p => p.years_experience_estimate != null && p.years_experience_estimate <= maxN)
    }

    if (sortField) {
      rows.sort((a, b) => {
        const aVal = (a[sortField] as number) ?? -1
        const bVal = (b[sortField] as number) ?? -1
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      })
    }

    return rows
  }, [people, searchQuery, bucketSel, stageSel, functionSel, senioritySel, companySel, schoolSel, locationSel, specialtySel, specialtyScope, clearanceSel, focusScope, compoundCompany, compoundSpecialties, compoundYearMin, compoundYearMax, yearsMin, yearsMax, sortField, sortDirection])

  const activeFilterCount =
    (bucketSel.length > 0 ? 1 : 0) +
    (stageSel.length > 0 ? 1 : 0) +
    (functionSel.length > 0 ? 1 : 0) +
    (senioritySel.length > 0 ? 1 : 0) +
    (companySel.length > 0 ? 1 : 0) +
    (schoolSel.length > 0 ? 1 : 0) +
    (locationSel.length > 0 ? 1 : 0) +
    (specialtySel.length > 0 ? 1 : 0) +
    (clearanceSel.length > 0 ? 1 : 0) +
    (focusScope !== 'all' ? 1 : 0) +
    (compoundCompany ? 1 : 0) +
    (yearsMin !== '' || yearsMax !== '' ? 1 : 0)

  const clearAllFilters = () => {
    setSearchQuery('')
    setBucketSel([])
    setStageSel([])
    setFunctionSel([])
    setSenioritySel([])
    setCompanySel([])
    setSchoolSel([])
    setLocationSel([])
    setSpecialtySel([])
    setSpecialtyScope('any')
    setClearanceSel([])
    setFocusScope('all')
    setCompoundCompany('')
    setCompoundSpecialties([])
    setCompoundYearMin('')
    setCompoundYearMax('')
    setYearsMin('')
    setYearsMax('')
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredPeople.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredPeople.map(p => p.person_id)))
    }
  }

  async function handleBulkDelete() {
    if (!bulkDeleteConfirm) { setBulkDeleteConfirm(true); return }
    setBulkDeleting(true)
    const ids = Array.from(selectedIds)
    let deleted = 0
    for (const id of ids) {
      const r = await fetch(`/api/people/${id}`, { method: 'DELETE' })
      if (r.ok) deleted++
    }
    // Remove deleted people from local state
    setPeople(prev => prev.filter(p => !selectedIds.has(p.person_id)))
    setSelectedIds(new Set())
    setBulkDeleting(false)
    setBulkDeleteConfirm(false)
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading people...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Vetted Database</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <h2 className="text-red-800 font-semibold mb-2">Error Loading Data</h2>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Vetted Database</h1>
        <div className="flex gap-4 text-sm">
          <a href="/admin/import" className="text-blue-600 hover:text-blue-800 underline">
            Import from Crust →
          </a>
          <a href="/admin/companies" className="text-blue-600 hover:text-blue-800 underline">
            Manage companies →
          </a>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, company, title, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Primary filters — specialty is the lead axis for recruiter search */}
      <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 items-end">
        {/* Specialty — primary filter, wider */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-600">Specialty</label>
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setSpecialtyScope('any')}
                className={`px-1.5 py-0.5 rounded ${specialtyScope === 'any' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'text-gray-500 border border-transparent hover:border-gray-200'}`}
                title="Match against any past specialty (captures career switchers)"
              >Any past</button>
              <button
                type="button"
                onClick={() => setSpecialtyScope('current')}
                className={`px-1.5 py-0.5 rounded ${specialtyScope === 'current' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'text-gray-500 border border-transparent hover:border-gray-200'}`}
                title="Match only the current primary specialty"
              >Current only</button>
            </div>
          </div>
          <MultiSelect
            label=""
            options={specialtyOptions}
            selected={specialtySel}
            onChange={setSpecialtySel}
            placeholder="Any specialty (backend, avionics, gnc, …)"
            emptyMessage="No specialties match"
          />
        </div>

        {/* Company focus scope */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Company focus scope</label>
          <select
            value={focusScope}
            onChange={(e) => setFocusScope(e.target.value as FocusScope)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All candidates</option>
            <option value="hard_tech">Hard tech experience</option>
            <option value="all_tech">All tech experience</option>
          </select>
        </div>

        <MultiSelect
          label="Bucket"
          options={BUCKET_OPTIONS}
          selected={bucketSel}
          onChange={setBucketSel}
          placeholder="Any bucket"
        />
        <MultiSelect
          label="Seniority"
          options={seniorityOptions}
          selected={senioritySel}
          onChange={setSenioritySel}
          placeholder="Any seniority"
        />
        <MultiSelect
          label="Company"
          options={companyOptions}
          selected={companySel}
          onChange={setCompanySel}
          placeholder="Any company"
          emptyMessage="No companies match"
        />
        <MultiSelect
          label="School"
          options={schoolOptions}
          selected={schoolSel}
          onChange={setSchoolSel}
          placeholder="Any school"
          emptyMessage="No schools match"
        />
        <MultiSelect
          label="Location"
          options={locationOptions}
          selected={locationSel}
          onChange={setLocationSel}
          placeholder="Any location"
          emptyMessage="No locations match"
        />
        <MultiSelect
          label="Clearance"
          options={CLEARANCE_OPTIONS}
          selected={clearanceSel}
          onChange={setClearanceSel}
          placeholder="Any clearance"
        />
        <MultiSelect
          label="Career Stage"
          options={STAGE_OPTIONS}
          selected={stageSel}
          onChange={setStageSel}
          placeholder="Any stage"
        />

        {/* Function — demoted to a secondary filter */}
        <MultiSelect
          label="Function (secondary)"
          options={functionOptions}
          selected={functionSel}
          onChange={setFunctionSel}
          placeholder="Any function"
        />

        {/* Years of experience range */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Years of Experience</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              step="0.5"
              value={yearsMin}
              onChange={e => setYearsMin(e.target.value)}
              placeholder="min"
              className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400">–</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={yearsMax}
              onChange={e => setYearsMax(e.target.value)}
              placeholder="max"
              className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Compound filter: worked at <company> as <specialty> between <year range> */}
      <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-2">
          Worked at specific company
          <span className="ml-2 font-normal text-slate-500 normal-case">
            e.g. “embedded engineers from SpaceX between 2011 and 2014”
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Company</label>
            <select
              value={compoundCompany}
              onChange={(e) => setCompoundCompany(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— none —</option>
              {companyOptions.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <MultiSelect
            label="Specialty (any match)"
            options={specialtyOptions}
            selected={compoundSpecialties}
            onChange={setCompoundSpecialties}
            placeholder="Any specialty"
          />
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Between year</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1950"
                max="2100"
                value={compoundYearMin}
                onChange={e => setCompoundYearMin(e.target.value)}
                placeholder="start"
                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400">–</span>
              <input
                type="number"
                min="1950"
                max="2100"
                value={compoundYearMax}
                onChange={e => setCompoundYearMax(e.target.value)}
                placeholder="end"
                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {compoundCompany && (
            <button
              onClick={() => { setCompoundCompany(''); setCompoundSpecialties([]); setCompoundYearMin(''); setCompoundYearMax('') }}
              className="px-3 py-2 text-sm text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg bg-white hover:bg-slate-100"
            >
              Clear compound filter
            </button>
          )}
        </div>
      </div>

      {/* Count + clear */}
      <div className="mb-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          <span className="font-semibold text-gray-900">{filteredPeople.length}</span>
          {' '}of{' '}
          <span className="text-gray-500">{people.length}</span>
          {' '}candidate{filteredPeople.length !== 1 ? 's' : ''}
          {activeFilterCount > 0 && <span className="ml-2 text-gray-500">({activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active)</span>}
        </span>
        {(activeFilterCount > 0 || searchQuery) && (
          <button
            onClick={clearAllFilters}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Bulk delete bar */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-sm text-red-800 font-medium">{selectedIds.size} selected</span>
          <button
            onClick={handleBulkDelete}
            onBlur={() => setBulkDeleteConfirm(false)}
            disabled={bulkDeleting}
            className={`px-3 py-1 text-sm rounded ${
              bulkDeleteConfirm
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-white text-red-600 border border-red-300 hover:bg-red-50'
            } disabled:opacity-50`}
          >
            {bulkDeleting ? 'Deleting…' : bulkDeleteConfirm ? 'Click again to confirm' : 'Delete selected'}
          </button>
          <button
            onClick={() => { setSelectedIds(new Set()); setBulkDeleteConfirm(false) }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={filteredPeople.length > 0 && selectedIds.size === filteredPeople.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bucket</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('years_experience_estimate')}
                >
                  Yrs {sortField === 'years_experience_estimate' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LinkedIn</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPeople.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center text-gray-500">
                    No candidates match these filters
                  </td>
                </tr>
              ) : (
                filteredPeople.map((person) => (
                  <tr
                    key={person.person_id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setSelectedPerson(person)
                      setIsDrawerOpen(true)
                    }}
                  >
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(person.person_id)}
                        onChange={() => toggleSelect(person.person_id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/profile/${person.person_id}`)
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {person.full_name || 'N/A'}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <BucketChip bucket={person.latest_bucket} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {person.location_name || '—'}
                    </td>
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
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {person.years_experience_estimate ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {person.career_stage_assigned?.replace(/_/g, ' ') || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {person.linkedin_url ? (
                        <a
                          href={person.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          View
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProfileDrawer
        person={selectedPerson}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false)
          setSelectedPerson(null)
        }}
        onPrev={(() => {
          if (!selectedPerson) return null
          const idx = filteredPeople.findIndex(p => p.person_id === selectedPerson.person_id)
          if (idx <= 0) return null
          return () => setSelectedPerson(filteredPeople[idx - 1])
        })()}
        onNext={(() => {
          if (!selectedPerson) return null
          const idx = filteredPeople.findIndex(p => p.person_id === selectedPerson.person_id)
          if (idx < 0 || idx >= filteredPeople.length - 1) return null
          return () => setSelectedPerson(filteredPeople[idx + 1])
        })()}
      />
    </div>
  )
}
