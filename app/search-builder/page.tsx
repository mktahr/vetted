'use client'

// TODO: Refactor filter state to individual URL params when search-URL-sharing becomes a use case.
// Currently uses a single JSON param for simplicity.

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MultiSelect, MultiSelectOption } from '../components/MultiSelect'
import { buildLocationOptions } from '@/lib/locations/us-locations'

// Next.js 14 requires useSearchParams() to be inside a Suspense boundary.
export default function SearchBuilderPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="text-gray-500">Loading search builder...</div></div>}>
      <SearchBuilderInner />
    </Suspense>
  )
}

const BUCKET_OPTIONS: MultiSelectOption[] = [
  { value: 'vetted_talent', label: 'Vetted Talent' }, { value: 'high_potential', label: 'High Potential' },
  { value: 'silver_medalist', label: 'Silver Medalist' }, { value: 'non_vetted', label: 'Non-Vetted' },
  { value: 'needs_review', label: 'Needs Review' },
]
const STAGE_OPTIONS: MultiSelectOption[] = [
  { value: 'pre_career', label: 'Pre-Career' }, { value: 'early_career', label: 'Early Career' },
  { value: 'mid_career', label: 'Mid Career' }, { value: 'senior_career', label: 'Senior Career' },
]
const CLEARANCE_OPTIONS: MultiSelectOption[] = [
  { value: 'none', label: 'None' }, { value: 'confidential', label: 'Confidential' },
  { value: 'secret', label: 'Secret' }, { value: 'top_secret', label: 'Top Secret' },
  { value: 'ts_sci', label: 'TS/SCI' }, { value: 'q_clearance', label: 'Q (DOE)' },
  { value: 'other', label: 'Other' }, { value: 'unknown', label: 'Unknown' },
]

function SearchBuilderInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)

  // Filter state (mirrors ProfileTable)
  const [roleSel, setRoleSel] = useState<string[]>([])
  const [specialtySel, setSpecialtySel] = useState<string[]>([])
  const [specialtyScope, setSpecialtyScope] = useState<'current' | 'any'>('any')
  const [senioritySel, setSenioritySel] = useState<string[]>([])
  const [bucketSel, setBucketSel] = useState<string[]>([])
  const [stageSel, setStageSel] = useState<string[]>([])
  const [yearsMin, setYearsMin] = useState('')
  const [yearsMax, setYearsMax] = useState('')
  const [clearanceSel, setClearanceSel] = useState<string[]>([])
  const [locationSel, setLocationSel] = useState<string[]>([])
  const [focusScope, setFocusScope] = useState<'all' | 'hard_tech' | 'all_tech'>('all')
  const [compoundCompany, setCompoundCompany] = useState('')
  const [compoundSpecialties, setCompoundSpecialties] = useState<string[]>([])
  const [compoundYearMin, setCompoundYearMin] = useState('')
  const [compoundYearMax, setCompoundYearMax] = useState('')
  const [compoundRelationship, setCompoundRelationship] = useState('any')
  const [schoolSel, setSchoolSel] = useState<string[]>([])
  const [titleBoolean, setTitleBoolean] = useState('')
  const [experienceBoolean, setExperienceBoolean] = useState('')

  // Options (loaded from DB)
  const [roleOptions, setRoleOptions] = useState<MultiSelectOption[]>([])
  const [seniorityOptions, setSeniorityOptions] = useState<MultiSelectOption[]>([])
  const [companyOptions, setCompanyOptions] = useState<MultiSelectOption[]>([])
  const [schoolOptions, setSchoolOptions] = useState<MultiSelectOption[]>([])
  const [specialtyOptions, setSpecialtyOptions] = useState<MultiSelectOption[]>([])
  const locationOptions = buildLocationOptions()

  // Load options + parse incoming filter state
  useEffect(() => {
    async function load() {
      const [{ data: roles }, { data: srs }, { data: companies }, { data: schools }, { data: specs }] = await Promise.all([
        supabase.from('role_dictionary').select('role_id, role_name, display_order').eq('active', true).order('display_order'),
        supabase.from('seniority_dictionary').select('seniority_normalized, rank_order').eq('active', true).order('rank_order'),
        supabase.from('companies').select('company_id, company_name, primary_industry_tag, focus').order('company_name'),
        supabase.from('schools').select('school_id, school_name, school_score, is_foreign').order('school_name'),
        supabase.from('specialty_dictionary').select('specialty_normalized, parent_function').eq('active', true).order('specialty_normalized'),
      ])
      setRoleOptions((roles || []).map((r: any) => ({ value: r.role_id, label: r.role_name })))
      setSeniorityOptions((srs || []).map(s => ({ value: s.seniority_normalized, label: s.seniority_normalized.replace(/_/g, ' ') })))
      setCompanyOptions((companies || []).filter((c: any) => c.focus === 'hard_tech' || c.focus === 'all_tech').map((c: any) => ({ value: c.company_id, label: c.company_name, sublabel: c.primary_industry_tag || undefined })))
      setSchoolOptions((schools || []).filter((s: any) => s.school_score != null).map((s: any) => ({ value: s.school_id, label: s.school_name, sublabel: s.is_foreign ? "Int'l" : undefined })))
      setSpecialtyOptions((specs || []).map((d: any) => ({ value: d.specialty_normalized, label: d.specialty_normalized.replace(/_/g, ' '), sublabel: (d.parent_function || '').replace(/_/g, ' ') })))

      // Parse incoming filter state from URL
      const raw = searchParams.get('filters')
      if (raw) {
        try {
          const f = JSON.parse(decodeURIComponent(raw))
          if (f.roleSel) setRoleSel(f.roleSel)
          if (f.specialtySel) setSpecialtySel(f.specialtySel)
          if (f.specialtyScope) setSpecialtyScope(f.specialtyScope)
          if (f.senioritySel) setSenioritySel(f.senioritySel)
          if (f.bucketSel) setBucketSel(f.bucketSel)
          if (f.stageSel) setStageSel(f.stageSel)
          if (f.yearsMin) setYearsMin(f.yearsMin)
          if (f.yearsMax) setYearsMax(f.yearsMax)
          if (f.clearanceSel) setClearanceSel(f.clearanceSel)
          if (f.locationSel) setLocationSel(f.locationSel)
          if (f.focusScope) setFocusScope(f.focusScope)
          if (f.compoundCompany) setCompoundCompany(f.compoundCompany)
          if (f.compoundSpecialties) setCompoundSpecialties(f.compoundSpecialties)
          if (f.compoundYearMin) setCompoundYearMin(f.compoundYearMin)
          if (f.compoundYearMax) setCompoundYearMax(f.compoundYearMax)
          if (f.compoundRelationship) setCompoundRelationship(f.compoundRelationship)
          if (f.schoolSel) setSchoolSel(f.schoolSel)
          if (f.titleBoolean) setTitleBoolean(f.titleBoolean)
          if (f.experienceBoolean) setExperienceBoolean(f.experienceBoolean)
        } catch { /* ignore bad JSON */ }
      }
      setLoading(false)
    }
    load()
  }, [searchParams])

  function runSearch() {
    const state = { roleSel, specialtySel, specialtyScope, senioritySel, bucketSel, stageSel, yearsMin, yearsMax, clearanceSel, locationSel, focusScope, compoundCompany, compoundSpecialties, compoundYearMin, compoundYearMax, compoundRelationship, schoolSel, titleBoolean, experienceBoolean }
    // Navigate back to home with filters encoded
    // TODO: The home page doesn't currently read URL filters — this navigates back and the
    // user needs to re-apply. Full round-trip requires ProfileTable to read URL params on mount.
    router.push('/')
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64vh', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)', background: 'var(--bg-canvas)' }}>Loading search builder...</div>

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', background: 'var(--bg-canvas)', color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <a href="/" className="text-sm text-blue-600 hover:text-blue-800">← Back to results</a>
          <h1 className="text-3xl font-bold mt-2">Build a Search</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Search Scope */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Search Scope</h2>
          <select value={focusScope} onChange={e => setFocusScope(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="all">All candidates</option>
            <option value="hard_tech">Hard tech experience</option>
            <option value="all_tech">All tech experience</option>
          </select>
        </div>

        {/* Who They Are */}
        <div className="bg-white rounded-lg shadow p-5 md:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Who They Are</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MultiSelect label="Role" options={roleOptions} selected={roleSel} onChange={setRoleSel} placeholder="Any role" />
            <MultiSelect label="Specialty" options={specialtyOptions} selected={specialtySel} onChange={setSpecialtySel} placeholder="Any specialty" />
            <MultiSelect label="Seniority" options={seniorityOptions} selected={senioritySel} onChange={setSenioritySel} placeholder="Any seniority" />
            <MultiSelect label="Bucket" options={BUCKET_OPTIONS} selected={bucketSel} onChange={setBucketSel} placeholder="Any bucket" />
            <MultiSelect label="Career Stage" options={STAGE_OPTIONS} selected={stageSel} onChange={setStageSel} placeholder="Any stage" />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Years of Experience</label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" step="0.5" value={yearsMin} onChange={e => setYearsMin(e.target.value)} placeholder="min" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <span className="text-gray-400">–</span>
                <input type="number" min="0" step="0.5" value={yearsMax} onChange={e => setYearsMax(e.target.value)} placeholder="max" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
            <MultiSelect label="Clearance" options={CLEARANCE_OPTIONS} selected={clearanceSel} onChange={setClearanceSel} placeholder="Any clearance" />
            <MultiSelect label="Location (US)" options={locationOptions} selected={locationSel} onChange={setLocationSel} placeholder="State or city" />
          </div>
        </div>

        {/* Where They Worked */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Where They Worked</h2>
          <MultiSelect label="Company" options={companyOptions} selected={compoundCompany ? [compoundCompany] : []} onChange={v => setCompoundCompany(v[0] || '')} placeholder="Search companies…" />
          {compoundCompany && (
            <div className="mt-3 space-y-3">
              <MultiSelect label="Specialty there" options={specialtyOptions} selected={compoundSpecialties} onChange={setCompoundSpecialties} placeholder="Any" />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Year range</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="1950" max="2100" value={compoundYearMin} onChange={e => setCompoundYearMin(e.target.value)} placeholder="from" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  <span className="text-gray-400">–</span>
                  <input type="number" min="1950" max="2100" value={compoundYearMax} onChange={e => setCompoundYearMax(e.target.value)} placeholder="to" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Where They Studied */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Where They Studied</h2>
          <MultiSelect label="School" options={schoolOptions} selected={schoolSel} onChange={setSchoolSel} placeholder="Search ranked schools…" />
        </div>

        {/* Keyword Search */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Keyword Search</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title keywords</label>
              <input type="text" value={titleBoolean} onChange={e => setTitleBoolean(e.target.value)} placeholder='e.g. "staff engineer" OR principal' className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Experience & skills keywords</label>
              <input type="text" value={experienceBoolean} onChange={e => setExperienceBoolean(e.target.value)} placeholder='e.g. MATLAB OR Simulink' className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <p className="text-[10px] text-gray-400 mt-1">Use AND, OR, NOT, quotes for exact phrases.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-4">
        <button onClick={runSearch} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          Run Search
        </button>
        <a href="/" className="text-sm text-gray-500 hover:text-gray-700">Cancel</a>
      </div>
    </div>
  )
}
