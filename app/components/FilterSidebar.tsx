'use client'

import { useState } from 'react'
import { MultiSelect, MultiSelectOption } from './MultiSelect'

// ─── Inline SVG icons ───────────────────────────────────────────────────────

const IconSearch = () => <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
const IconUser = () => <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const IconBriefcase = () => <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
const IconGrad = () => <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1 4 3 6 3s6-2 6-3v-5"/></svg>
const IconCode = () => <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
const IconChevron = ({ collapsed }: { collapsed: boolean }) => <svg viewBox="0 0 24 24" className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>

type FocusScope = 'all' | 'hard_tech' | 'all_tech'

export interface FilterSidebarProps {
  // Role + Specialty
  roleSel: string[];             setRoleSel: (v: string[]) => void
  roleOptions: MultiSelectOption[]
  specialtySel: string[];        setSpecialtySel: (v: string[]) => void
  specialtyScope: 'current' | 'any'; setSpecialtyScope: (v: 'current' | 'any') => void
  specialtyOptions: MultiSelectOption[]  // contextually filtered by role if role is selected
  allSpecialtyOptions: MultiSelectOption[]  // unfiltered
  // Who they are
  senioritySel: string[];        setSenioritySel: (v: string[]) => void
  seniorityOptions: MultiSelectOption[]
  bucketSel: string[];           setBucketSel: (v: string[]) => void
  stageSel: string[];            setStageSel: (v: string[]) => void
  yearsMin: string;              setYearsMin: (v: string) => void
  yearsMax: string;              setYearsMax: (v: string) => void
  clearanceSel: string[];        setClearanceSel: (v: string[]) => void
  locationSel: string[];         setLocationSel: (v: string[]) => void
  locationOptions: MultiSelectOption[]
  // Search scope
  focusScope: FocusScope;        setFocusScope: (v: FocusScope) => void
  // Where they worked (compound)
  compoundCompany: string;       setCompoundCompany: (v: string) => void
  compoundSpecialties: string[]; setCompoundSpecialties: (v: string[]) => void
  compoundYearMin: string;       setCompoundYearMin: (v: string) => void
  compoundYearMax: string;       setCompoundYearMax: (v: string) => void
  compoundRelationship: string;  setCompoundRelationship: (v: string) => void
  companyOptions: MultiSelectOption[]
  // Where they studied
  schoolSel: string[];           setSchoolSel: (v: string[]) => void
  schoolOptions: MultiSelectOption[]
  schoolScope: 'us' | 'all';    setSchoolScope: (v: 'us' | 'all') => void
  // Boolean search
  titleBoolean: string;          setTitleBoolean: (v: string) => void
  experienceBoolean: string;     setExperienceBoolean: (v: string) => void
  // Clear
  clearAllFilters: () => void
  activeFilterCount: number
  // Search builder link
  onOpenBuilder?: () => void
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

export default function FilterSidebar(props: FilterSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [booleanOpen, setBooleanOpen] = useState(false)

  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col items-center pt-3">
        <button onClick={() => setCollapsed(false)} className="p-1 rounded hover:bg-gray-200 text-gray-500" title="Expand filters">
          <IconChevron collapsed={true} />
        </button>
      </div>
    )
  }

  // Specialty options: filter by selected roles if any
  const displayedSpecialties = props.roleSel.length > 0 ? props.specialtyOptions : props.allSpecialtyOptions

  return (
    <div className="w-[300px] flex-shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Filters</h2>
          <button onClick={() => setCollapsed(true)} className="p-1 rounded hover:bg-gray-200 text-gray-400" title="Collapse">
            <IconChevron collapsed={false} />
          </button>
        </div>

        {props.onOpenBuilder && (
          <button onClick={props.onOpenBuilder} className="w-full mb-4 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Open Full Search Builder
          </button>
        )}

        {/* ── SEARCH SCOPE ─────────────────────────────────────────── */}
        <SH icon={<IconSearch />} label="Search Scope" />
        <div className="mb-4">
          <select value={props.focusScope} onChange={e => props.setFocusScope(e.target.value as FocusScope)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="all">All candidates</option>
            <option value="hard_tech">Hard tech experience</option>
            <option value="all_tech">All tech experience</option>
          </select>
        </div>

        {/* ── WHO THEY ARE ─────────────────────────────────────────── */}
        <SH icon={<IconUser />} label="Who They Are" />

        <div className="mb-3">
          <MultiSelect label="Role" options={props.roleOptions} selected={props.roleSel} onChange={props.setRoleSel} placeholder="Any role" />
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-600">Specialty</label>
            <div className="flex items-center gap-0.5 text-[10px]">
              <button type="button" onClick={() => props.setSpecialtyScope('any')}
                className={`px-1 py-0.5 rounded ${props.specialtyScope === 'any' ? 'bg-blue-100 text-blue-800' : 'text-gray-400'}`}>Any past</button>
              <button type="button" onClick={() => props.setSpecialtyScope('current')}
                className={`px-1 py-0.5 rounded ${props.specialtyScope === 'current' ? 'bg-blue-100 text-blue-800' : 'text-gray-400'}`}>Current</button>
            </div>
          </div>
          <MultiSelect label="" options={displayedSpecialties} selected={props.specialtySel} onChange={props.setSpecialtySel}
            placeholder={props.roleSel.length > 0 ? 'Specialties for selected role(s)' : 'Any specialty'} emptyMessage="No match" />
        </div>

        <div className="mb-3"><MultiSelect label="Seniority" options={props.seniorityOptions} selected={props.senioritySel} onChange={props.setSenioritySel} placeholder="Any seniority" /></div>
        <div className="mb-3"><MultiSelect label="Bucket" options={BUCKET_OPTIONS} selected={props.bucketSel} onChange={props.setBucketSel} placeholder="Any bucket" /></div>
        <div className="mb-3"><MultiSelect label="Career Stage" options={STAGE_OPTIONS} selected={props.stageSel} onChange={props.setStageSel} placeholder="Any stage" /></div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">Years of Experience</label>
          <div className="flex items-center gap-1">
            <input type="number" min="0" step="0.5" value={props.yearsMin} onChange={e => props.setYearsMin(e.target.value)} placeholder="min" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <span className="text-gray-400 text-xs">–</span>
            <input type="number" min="0" step="0.5" value={props.yearsMax} onChange={e => props.setYearsMax(e.target.value)} placeholder="max" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
        <div className="mb-3"><MultiSelect label="Clearance" options={CLEARANCE_OPTIONS} selected={props.clearanceSel} onChange={props.setClearanceSel} placeholder="Any clearance" /></div>
        <div className="mb-4"><MultiSelect label="Location (US)" options={props.locationOptions} selected={props.locationSel} onChange={props.setLocationSel} placeholder="State or city" emptyMessage="No match" /></div>

        {/* ── WHERE THEY WORKED ────────────────────────────────────── */}
        <SH icon={<IconBriefcase />} label="Where They Worked" />
        <div className="mb-3">
          <MultiSelect label="Company" options={props.companyOptions} selected={props.compoundCompany ? [props.compoundCompany] : []}
            onChange={vals => props.setCompoundCompany(vals[0] || '')} placeholder="Search companies…" emptyMessage="No match" />
        </div>
        {props.compoundCompany && (
          <>
            <div className="mb-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Relationship</label>
              <div className="flex gap-1 text-[10px]">
                {(['any','current','previous','intern'] as const).map(v => (
                  <button key={v} type="button" onClick={() => props.setCompoundRelationship(v)}
                    className={`px-1.5 py-0.5 rounded border ${props.compoundRelationship === v ? 'bg-blue-100 text-blue-800 border-blue-200' : 'text-gray-500 border-gray-200'}`}>
                    {v === 'any' ? 'Any' : v === 'current' ? 'Current' : v === 'previous' ? 'Previous' : 'Intern'}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-3"><MultiSelect label="Specialty there" options={props.allSpecialtyOptions} selected={props.compoundSpecialties} onChange={props.setCompoundSpecialties} placeholder="Any" /></div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Year range</label>
              <div className="flex items-center gap-1">
                <input type="number" min="1950" max="2100" value={props.compoundYearMin} onChange={e => props.setCompoundYearMin(e.target.value)} placeholder="from" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <span className="text-gray-400 text-xs">–</span>
                <input type="number" min="1950" max="2100" value={props.compoundYearMax} onChange={e => props.setCompoundYearMax(e.target.value)} placeholder="to" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
          </>
        )}

        {/* ── WHERE THEY STUDIED ───────────────────────────────────── */}
        <SH icon={<IconGrad />} label="Where They Studied" />
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-600">School</label>
            <div className="flex items-center gap-0.5 text-[10px]">
              <button type="button" onClick={() => props.setSchoolScope('us')}
                className={`px-1 py-0.5 rounded ${props.schoolScope === 'us' ? 'bg-blue-100 text-blue-800' : 'text-gray-400'}`}>US only</button>
              <button type="button" onClick={() => props.setSchoolScope('all')}
                className={`px-1 py-0.5 rounded ${props.schoolScope === 'all' ? 'bg-blue-100 text-blue-800' : 'text-gray-400'}`}>All</button>
            </div>
          </div>
          <MultiSelect label="" options={props.schoolScope === 'us' ? props.schoolOptions.filter(s => !s.sublabel?.includes("Int'l")) : props.schoolOptions}
            selected={props.schoolSel} onChange={props.setSchoolSel} placeholder="Search ranked schools…" emptyMessage="No match" />
        </div>

        {/* ── KEYWORD SEARCH ───────────────────────────────────────── */}
        <button onClick={() => setBooleanOpen(o => !o)} className="flex items-center gap-1.5 w-full text-left border-t border-gray-200 pt-3 mb-2">
          <IconCode />
          <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Keyword Search</span>
          <span className="text-gray-400 text-xs ml-auto">{booleanOpen ? '▾' : '▸'}</span>
        </button>
        {booleanOpen && (
          <div className="mb-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title keywords</label>
              <input type="text" value={props.titleBoolean} onChange={e => props.setTitleBoolean(e.target.value)}
                placeholder='e.g. "staff engineer" OR principal'
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Experience & skills keywords</label>
              <input type="text" value={props.experienceBoolean} onChange={e => props.setExperienceBoolean(e.target.value)}
                placeholder='e.g. MATLAB OR Simulink'
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <p className="text-[10px] text-gray-400 mt-1">Searches descriptions, headlines, and skills. Use AND, OR, NOT, quotes for exact phrases.</p>
            </div>
          </div>
        )}

        {/* ── Clear all ────────────────────────────────────────────── */}
        {props.activeFilterCount > 0 && (
          <button onClick={props.clearAllFilters} className="w-full mt-2 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded bg-white hover:bg-gray-50">
            Clear all filters
          </button>
        )}
      </div>
    </div>
  )
}

function SH({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 border-t border-gray-200 pt-3 mb-2">
      <span className="text-gray-400">{icon}</span>
      <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{label}</span>
    </div>
  )
}
