'use client'

import { useState } from 'react'
import { MultiSelect, MultiSelectOption } from './MultiSelect'

// Inline SVG icons (16px, Lucide-style, 1.5px stroke)
const IconSearch = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
const IconUser = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const IconBriefcase = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
const IconGrad = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1 4 3 6 3s6-2 6-3v-5"/></svg>
const IconCode = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
const IconChevron = ({ collapsed }: { collapsed: boolean }) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ transition: 'transform var(--dur-hover) var(--ease)', transform: collapsed ? 'rotate(180deg)' : '' }}><path d="m15 18-6-6 6-6"/></svg>

type FocusScope = 'all' | 'hard_tech' | 'all_tech'

export interface FilterSidebarProps {
  roleSel: string[];             setRoleSel: (v: string[]) => void
  roleOptions: MultiSelectOption[]
  specialtySel: string[];        setSpecialtySel: (v: string[]) => void
  specialtyScope: 'current' | 'any'; setSpecialtyScope: (v: 'current' | 'any') => void
  specialtyOptions: MultiSelectOption[]
  allSpecialtyOptions: MultiSelectOption[]
  senioritySel: string[];        setSenioritySel: (v: string[]) => void
  seniorityOptions: MultiSelectOption[]
  bucketSel: string[];           setBucketSel: (v: string[]) => void
  stageSel: string[];            setStageSel: (v: string[]) => void
  yearsMin: string;              setYearsMin: (v: string) => void
  yearsMax: string;              setYearsMax: (v: string) => void
  clearanceSel: string[];        setClearanceSel: (v: string[]) => void
  locationSel: string[];         setLocationSel: (v: string[]) => void
  locationOptions: MultiSelectOption[]
  focusScope: FocusScope;        setFocusScope: (v: FocusScope) => void
  compoundCompany: string;       setCompoundCompany: (v: string) => void
  compoundSpecialties: string[]; setCompoundSpecialties: (v: string[]) => void
  compoundYearMin: string;       setCompoundYearMin: (v: string) => void
  compoundYearMax: string;       setCompoundYearMax: (v: string) => void
  compoundRelationship: string;  setCompoundRelationship: (v: string) => void
  companyOptions: MultiSelectOption[]
  schoolSel: string[];           setSchoolSel: (v: string[]) => void
  schoolOptions: MultiSelectOption[]
  schoolScope: 'us' | 'all';    setSchoolScope: (v: 'us' | 'all') => void
  schoolGroupSel: string[];     setSchoolGroupSel: (v: string[]) => void
  schoolGroupOptions: MultiSelectOption[]
  companyGroupSel: string[];    setCompanyGroupSel: (v: string[]) => void
  companyGroupOptions: MultiSelectOption[]
  signalSel: string[];          setSignalSel: (v: string[]) => void
  signalOptions: MultiSelectOption[]
  titleBoolean: string;          setTitleBoolean: (v: string) => void
  experienceBoolean: string;     setExperienceBoolean: (v: string) => void
  clearAllFilters: () => void
  activeFilterCount: number
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

// Shared input style using design system tokens
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px',
  border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-button)',
  background: 'var(--bg-surface)', color: 'var(--fg-primary)',
  fontSize: 'var(--fs-13)', fontFamily: 'var(--font-sans)',
  outline: 'none',
}
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none' as const }

export default function FilterSidebar(props: FilterSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [booleanOpen, setBooleanOpen] = useState(false)

  const displayedSpecialties = props.roleSel.length > 0 ? props.specialtyOptions : props.allSpecialtyOptions

  if (collapsed) {
    return (
      <div style={{ width: 40, flexShrink: 0, borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12 }}>
        <button onClick={() => setCollapsed(false)} style={{ padding: 4, borderRadius: 'var(--r-button)', color: 'var(--fg-tertiary)', cursor: 'pointer', background: 'none', border: 'none' }} title="Expand filters">
          <IconChevron collapsed={true} />
        </button>
      </div>
    )
  }

  return (
    <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', overflowY: 'auto' }}>
      <div style={{ padding: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 'var(--fs-13)', fontWeight: 'var(--fw-semibold)', color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)' }}>Filters</span>
          <button onClick={() => setCollapsed(true)} style={{ padding: 4, borderRadius: 'var(--r-button)', color: 'var(--fg-tertiary)', cursor: 'pointer', background: 'none', border: 'none' }} title="Collapse">
            <IconChevron collapsed={false} />
          </button>
        </div>

        {props.onOpenBuilder && (
          <button onClick={props.onOpenBuilder} style={{
            width: '100%', marginBottom: 16, padding: '8px 12px',
            fontSize: 'var(--fs-13)', fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-medium)',
            background: 'var(--accent-500)', color: 'var(--fg-on-accent)',
            border: 'none', borderRadius: 'var(--r-button)', cursor: 'pointer',
          }}>
            Open full search builder
          </button>
        )}

        {/* SEARCH SCOPE */}
        <SH icon={<IconSearch />} label="Search scope" />
        <div style={{ marginBottom: 16 }}>
          <select value={props.focusScope} onChange={e => props.setFocusScope(e.target.value as FocusScope)} style={selectStyle}>
            <option value="all">All candidates</option>
            <option value="hard_tech">Hard tech experience</option>
            <option value="all_tech">All tech experience</option>
          </select>
        </div>

        {/* WHO THEY ARE */}
        <SH icon={<IconUser />} label="Who they are" />
        <div style={{ marginBottom: 12 }}><MultiSelect label="Role" options={props.roleOptions} selected={props.roleSel} onChange={props.setRoleSel} placeholder="Any role" /></div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Lbl>Specialty</Lbl>
            <div style={{ display: 'flex', gap: 2 }}>
              <ToggleBtn active={props.specialtyScope === 'any'} onClick={() => props.setSpecialtyScope('any')}>Any past</ToggleBtn>
              <ToggleBtn active={props.specialtyScope === 'current'} onClick={() => props.setSpecialtyScope('current')}>Current</ToggleBtn>
            </div>
          </div>
          <MultiSelect label="" options={displayedSpecialties} selected={props.specialtySel} onChange={props.setSpecialtySel}
            placeholder={props.roleSel.length > 0 ? 'Specialties for selected role(s)' : 'Any specialty'} emptyMessage="No match" />
        </div>
        <div style={{ marginBottom: 12 }}><MultiSelect label="Seniority" options={props.seniorityOptions} selected={props.senioritySel} onChange={props.setSenioritySel} placeholder="Any seniority" /></div>
        <div style={{ marginBottom: 12 }}><MultiSelect label="Bucket" options={BUCKET_OPTIONS} selected={props.bucketSel} onChange={props.setBucketSel} placeholder="Any bucket" /></div>
        <div style={{ marginBottom: 12 }}><MultiSelect label="Career stage" options={STAGE_OPTIONS} selected={props.stageSel} onChange={props.setStageSel} placeholder="Any stage" /></div>
        <div style={{ marginBottom: 12 }}>
          <Lbl>Years of experience</Lbl>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" min="0" step="0.5" value={props.yearsMin} onChange={e => props.setYearsMin(e.target.value)} placeholder="min" style={inputStyle} />
            <span style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)' }}>–</span>
            <input type="number" min="0" step="0.5" value={props.yearsMax} onChange={e => props.setYearsMax(e.target.value)} placeholder="max" style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}><MultiSelect label="Clearance" options={CLEARANCE_OPTIONS} selected={props.clearanceSel} onChange={props.setClearanceSel} placeholder="Any clearance" /></div>
        <div style={{ marginBottom: 12 }}><MultiSelect label="Signals" options={props.signalOptions} selected={props.signalSel} onChange={props.setSignalSel} placeholder="Any signal" emptyMessage="No match" /></div>
        <div style={{ marginBottom: 16 }}><MultiSelect label="Location (US)" options={props.locationOptions} selected={props.locationSel} onChange={props.setLocationSel} placeholder="State or city" emptyMessage="No match" /></div>

        {/* WHERE THEY WORKED */}
        <SH icon={<IconBriefcase />} label="Where they worked" />
        <div style={{ marginBottom: 12 }}>
          <MultiSelect label="Company" options={props.companyOptions} selected={props.compoundCompany ? [props.compoundCompany] : []}
            onChange={vals => props.setCompoundCompany(vals[0] || '')} placeholder="Search companies…" emptyMessage="No match" />
        </div>
        {props.compoundCompany && (
          <>
            <div style={{ marginBottom: 8 }}>
              <Lbl>Relationship</Lbl>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['any','current','previous','intern'] as const).map(v => (
                  <ToggleBtn key={v} active={props.compoundRelationship === v} onClick={() => props.setCompoundRelationship(v)}>
                    {v === 'any' ? 'Any' : v === 'current' ? 'Current' : v === 'previous' ? 'Previous' : 'Intern'}
                  </ToggleBtn>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}><MultiSelect label="Specialty there" options={props.allSpecialtyOptions} selected={props.compoundSpecialties} onChange={props.setCompoundSpecialties} placeholder="Any" /></div>
            <div style={{ marginBottom: 12 }}>
              <Lbl>Year range</Lbl>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="number" min="1950" max="2100" value={props.compoundYearMin} onChange={e => props.setCompoundYearMin(e.target.value)} placeholder="from" style={inputStyle} />
                <span style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)' }}>–</span>
                <input type="number" min="1950" max="2100" value={props.compoundYearMax} onChange={e => props.setCompoundYearMax(e.target.value)} placeholder="to" style={inputStyle} />
              </div>
            </div>
          </>
        )}

        {props.companyGroupOptions.length > 0 && (
          <div style={{ marginBottom: 16 }}><MultiSelect label="Company group" options={props.companyGroupOptions} selected={props.companyGroupSel} onChange={props.setCompanyGroupSel} placeholder="Any company group" /></div>
        )}

        {/* WHERE THEY STUDIED */}
        <SH icon={<IconGrad />} label="Where they studied" />
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Lbl>School</Lbl>
            <div style={{ display: 'flex', gap: 2 }}>
              <ToggleBtn active={props.schoolScope === 'us'} onClick={() => props.setSchoolScope('us')}>US only</ToggleBtn>
              <ToggleBtn active={props.schoolScope === 'all'} onClick={() => props.setSchoolScope('all')}>All</ToggleBtn>
            </div>
          </div>
          <MultiSelect label="" options={props.schoolScope === 'us' ? props.schoolOptions.filter(s => !s.sublabel?.includes("Int'l")) : props.schoolOptions}
            selected={props.schoolSel} onChange={props.setSchoolSel} placeholder="Search ranked schools…" emptyMessage="No match" />
        </div>
        {props.schoolGroupOptions.length > 0 && (
          <div style={{ marginBottom: 16 }}><MultiSelect label="School group" options={props.schoolGroupOptions} selected={props.schoolGroupSel} onChange={props.setSchoolGroupSel} placeholder="Any school group" /></div>
        )}

        {/* KEYWORD SEARCH */}
        <button onClick={() => setBooleanOpen(o => !o)} style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
          borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginBottom: 8,
          background: 'none', border: 'none', borderTopStyle: 'solid', cursor: 'pointer', color: 'var(--fg-tertiary)',
        }}>
          <IconCode />
          <span style={{ fontSize: 'var(--fs-11)', textTransform: 'uppercase', letterSpacing: 'var(--tr-eyebrow)', fontWeight: 'var(--fw-medium)', fontFamily: 'var(--font-sans)' }}>Keyword search</span>
          <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-12)' }}>{booleanOpen ? '▾' : '▸'}</span>
        </button>
        {booleanOpen && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <Lbl>Title keywords</Lbl>
              <input type="text" value={props.titleBoolean} onChange={e => props.setTitleBoolean(e.target.value)}
                placeholder='"staff engineer" OR principal' style={inputStyle} />
            </div>
            <div>
              <Lbl>Experience & skills keywords</Lbl>
              <input type="text" value={props.experienceBoolean} onChange={e => props.setExperienceBoolean(e.target.value)}
                placeholder='MATLAB OR Simulink' style={inputStyle} />
              <p style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)', marginTop: 4, fontFamily: 'var(--font-sans)' }}>
                Searches descriptions, headlines, skills. Use AND, OR, NOT, quotes.
              </p>
            </div>
          </div>
        )}

        {/* CLEAR ALL */}
        {props.activeFilterCount > 0 && (
          <button onClick={props.clearAllFilters} style={{
            width: '100%', marginTop: 8, padding: '6px 12px',
            fontSize: 'var(--fs-13)', fontFamily: 'var(--font-sans)',
            color: 'var(--fg-secondary)', background: 'none',
            border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-button)',
            cursor: 'pointer',
          }}>
            Clear all filters
          </button>
        )}
      </div>
    </div>
  )
}

// Section header
function SH({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginBottom: 8 }}>
      <span style={{ color: 'var(--fg-tertiary)' }}>{icon}</span>
      <span style={{ fontSize: 'var(--fs-11)', textTransform: 'uppercase', letterSpacing: 'var(--tr-eyebrow)', color: 'var(--fg-tertiary)', fontWeight: 'var(--fw-medium)', fontFamily: 'var(--font-sans)' }}>{label}</span>
    </div>
  )
}

// Label
function Lbl({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-medium)', color: 'var(--fg-secondary)', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>{children}</label>
}

// Small toggle button
function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '2px 6px', fontSize: 'var(--fs-11)', fontFamily: 'var(--font-sans)',
      borderRadius: 'var(--r-chip)', cursor: 'pointer', border: 'none',
      background: active ? 'var(--accent-500)' : 'transparent',
      color: active ? 'var(--fg-on-accent)' : 'var(--fg-tertiary)',
      fontWeight: active ? 'var(--fw-medium)' : 'var(--fw-regular)',
    }}>{children}</button>
  )
}
