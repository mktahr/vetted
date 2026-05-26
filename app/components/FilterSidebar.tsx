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

// V1 (post-migration 031): two independent visibility filters replace the old `focusScope`.
// CategoryScope filters by company category (hardware/non_hardware classification).
// ReviewStatusScope filters by company review_status (vetted/unreviewed/excluded).
//
// Per Matt's Option C decision (2026-05-04): both filters DEFAULT to 'all' so candidate
// search is not silently filtered after migration. Admin can opt into stricter scopes.
export type CategoryScope = 'all' | 'hardware' | 'non_hardware'
export type ReviewStatusScope = 'all' | 'vetted' | 'unreviewed' | 'excluded'

export interface FilterSidebarProps {
  roleSel: string[];             setRoleSel: (v: string[]) => void
  rolePills: Array<{ value: string; scope: 'ever' | 'currently' | 'previously' }>
  setRolePills: (v: Array<{ value: string; scope: 'ever' | 'currently' | 'previously' }>) => void
  roleOptions: MultiSelectOption[]
  specialtySel: string[];        setSpecialtySel: (v: string[]) => void
  specialtyPills: Array<{ value: string; scope: 'ever' | 'currently' | 'previously' }>
  setSpecialtyPills: (v: Array<{ value: string; scope: 'ever' | 'currently' | 'previously' }>) => void
  specialtyOptions: MultiSelectOption[]
  allSpecialtyOptions: MultiSelectOption[]
  senioritySel: string[];        setSenioritySel: (v: string[]) => void
  seniorityPills: Array<{ value: string; scope: 'ever' | 'currently' | 'previously' }>
  setSeniorityPills: (v: Array<{ value: string; scope: 'ever' | 'currently' | 'previously' }>) => void
  seniorityOptions: MultiSelectOption[]
  bucketSel: string[];           setBucketSel: (v: string[]) => void
  stageSel: string[];            setStageSel: (v: string[]) => void
  yearsMin: string;              setYearsMin: (v: string) => void
  yearsMax: string;              setYearsMax: (v: string) => void
  clearanceSel: string[];        setClearanceSel: (v: string[]) => void
  locationSel: string[];         setLocationSel: (v: string[]) => void
  locationOptions: MultiSelectOption[]
  categoryScope: CategoryScope;          setCategoryScope: (v: CategoryScope) => void
  reviewStatusScope: ReviewStatusScope;  setReviewStatusScope: (v: ReviewStatusScope) => void
  compoundCompany: string[];     setCompoundCompany: (v: string[]) => void
  compoundCompanyPills: Array<{ value: string; scope: 'ever' | 'currently' | 'previously' }>
  setCompoundCompanyPills: (v: Array<{ value: string; scope: 'ever' | 'currently' | 'previously' }>) => void
  compoundSpecialties: string[]; setCompoundSpecialties: (v: string[]) => void
  compoundYearMin: string;       setCompoundYearMin: (v: string) => void
  compoundYearMax: string;       setCompoundYearMax: (v: string) => void
  companyOptions: MultiSelectOption[]
  companyConditionCount: number
  schoolConditionCount: number
  schoolSel: string[];           setSchoolSel: (v: string[]) => void
  schoolOptions: MultiSelectOption[]
  schoolScope: 'us' | 'all';    setSchoolScope: (v: 'us' | 'all') => void
  schoolGroupSel: string[];     setSchoolGroupSel: (v: string[]) => void
  schoolGroupOptions: MultiSelectOption[]
  degreeSel: string[];          setDegreeSel: (v: string[]) => void
  fieldOfStudySel: string[];    setFieldOfStudySel: (v: string[]) => void
  fieldOfStudyOptions: MultiSelectOption[]
  founderTypeSel: string[];     setFounderTypeSel: (v: string[]) => void
  companyGroupSel: string[];    setCompanyGroupSel: (v: string[]) => void
  companyGroupOptions: MultiSelectOption[]
  signalSel: string[];          setSignalSel: (v: string[]) => void
  signalOptions: MultiSelectOption[]
  titleBoolean: string;          setTitleBoolean: (v: string) => void
  experienceBoolean: string;     setExperienceBoolean: (v: string) => void
  // Tenure filters
  currentTenureMin: string;      setCurrentTenureMin: (v: string) => void
  currentTenureMax: string;      setCurrentTenureMax: (v: string) => void
  avgTenureMin: string;          setAvgTenureMin: (v: string) => void
  avgTenureMax: string;          setAvgTenureMax: (v: string) => void
  avgTenureIncludeCurrent: boolean; setAvgTenureIncludeCurrent: (v: boolean) => void
  clearAllFilters: () => void
  activeFilterCount: number
  onOpenBuilder?: () => void
}

const BUCKET_OPTIONS: MultiSelectOption[] = [
  { value: 'vetted', label: 'Vetted' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'flagged', label: 'Flagged' },
]
const DEGREE_OPTIONS: MultiSelectOption[] = [
  { value: 'bachelor', label: "Bachelor's" },
  { value: 'master',   label: "Master's" },
  { value: 'mba',      label: 'MBA' },
  { value: 'jd',       label: 'JD' },
  { value: 'md',       label: 'MD' },
  { value: 'phd',      label: 'PhD' },
]
const FOUNDER_TYPE_OPTIONS: MultiSelectOption[] = [
  { value: 'vc_backed',    label: 'VC-Backed Founder' },
  { value: 'bootstrapped', label: 'Bootstrapped Founder' },
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
      <div style={{ padding: 16, paddingBottom: 240 }}>
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

        {/* CLEAR ALL — top */}
        {props.activeFilterCount > 0 && (
          <button onClick={props.clearAllFilters} style={{
            width: '100%', marginBottom: 12, padding: '5px 12px',
            fontSize: 'var(--fs-12)', fontFamily: 'var(--font-sans)',
            color: 'var(--fg-secondary)', background: 'none',
            border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-button)',
            cursor: 'pointer',
          }}>
            Clear all filters ({props.activeFilterCount})
          </button>
        )}

        {/* SEARCH SCOPE — V1: two independent filters, both default 'all' */}
        <SH icon={<IconSearch />} label="Search scope" />
        <div style={{ marginBottom: 8 }}>
          <Lbl>Category</Lbl>
          <select value={props.categoryScope} onChange={e => props.setCategoryScope(e.target.value as CategoryScope)} style={selectStyle}>
            <option value="all">All candidates</option>
            <option value="hardware">Hardware experience</option>
            <option value="non_hardware">Non-hardware experience</option>
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Lbl>Visibility</Lbl>
          <select value={props.reviewStatusScope} onChange={e => props.setReviewStatusScope(e.target.value as ReviewStatusScope)} style={selectStyle}>
            <option value="all">All companies (default)</option>
            <option value="vetted">Vetted only</option>
            <option value="unreviewed">Unreviewed only</option>
            <option value="excluded">Excluded only</option>
          </select>
        </div>

        {/* WHO THEY ARE */}
        <SH icon={<IconUser />} label="Who they are" />
        <div style={{ marginBottom: 12 }}>
          <Lbl>Role</Lbl>
          <MultiSelect label="" options={props.roleOptions} selected={props.roleSel} onChange={props.setRoleSel} placeholder="Any role" />
          {props.rolePills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
              {props.rolePills.map(pill => {
                const label = props.roleOptions.find(o => o.value === pill.value)?.label || pill.value
                return (
                  <span key={pill.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 6px', fontSize: 'var(--fs-11)', fontFamily: 'var(--font-sans)', background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--r-chip)' }}>
                    <span style={{ color: 'var(--fg-primary)' }}>{label}</span>
                    <select value={pill.scope} onChange={e => props.setRolePills(props.rolePills.map(p => p.value === pill.value ? { ...p, scope: e.target.value as any } : p))} style={{ background: 'none', border: 'none', color: 'var(--fg-tertiary)', fontSize: 'var(--fs-10)', fontFamily: 'var(--font-sans)', cursor: 'pointer', padding: 0 }}>
                      <option value="ever">ever</option>
                      <option value="currently">currently</option>
                      <option value="previously">previously</option>
                    </select>
                  </span>
                )
              })}
            </div>
          )}
        </div>
        <div style={{ marginBottom: 12 }}>
          <Lbl>Specialty</Lbl>
          <MultiSelect label="" options={displayedSpecialties} selected={props.specialtySel} onChange={props.setSpecialtySel}
            placeholder={props.roleSel.length > 0 ? 'Specialties for selected role(s)' : 'Any specialty'} emptyMessage="No match" />
          {props.specialtyPills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
              {props.specialtyPills.map(pill => (
                <span key={pill.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 6px', fontSize: 'var(--fs-11)', fontFamily: 'var(--font-sans)', background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--r-chip)' }}>
                  <span style={{ color: 'var(--fg-primary)' }}>{pill.value.replace(/_/g, ' ')}</span>
                  <select value={pill.scope} onChange={e => props.setSpecialtyPills(props.specialtyPills.map(p => p.value === pill.value ? { ...p, scope: e.target.value as any } : p))} style={{ background: 'none', border: 'none', color: 'var(--fg-tertiary)', fontSize: 'var(--fs-10)', fontFamily: 'var(--font-sans)', cursor: 'pointer', padding: 0 }}>
                    <option value="ever">ever</option>
                    <option value="currently">currently</option>
                    <option value="previously">previously</option>
                  </select>
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginBottom: 12 }}>
          <MultiSelect label="Seniority" options={props.seniorityOptions} selected={props.senioritySel} onChange={props.setSenioritySel} placeholder="Any seniority" />
          {props.seniorityPills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
              {props.seniorityPills.map(pill => (
                <span key={pill.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 6px', fontSize: 'var(--fs-11)', fontFamily: 'var(--font-sans)', background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--r-chip)' }}>
                  <span style={{ color: 'var(--fg-primary)' }}>{pill.value.replace(/_/g, ' ')}</span>
                  <select value={pill.scope} onChange={e => props.setSeniorityPills(props.seniorityPills.map(p => p.value === pill.value ? { ...p, scope: e.target.value as any } : p))} style={{ background: 'none', border: 'none', color: 'var(--fg-tertiary)', fontSize: 'var(--fs-10)', fontFamily: 'var(--font-sans)', cursor: 'pointer', padding: 0 }}>
                    <option value="ever">ever</option>
                    <option value="currently">currently</option>
                    <option value="previously">previously</option>
                  </select>
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginBottom: 12 }}><MultiSelect label="Bucket" options={BUCKET_OPTIONS} selected={props.bucketSel} onChange={props.setBucketSel} placeholder="Any bucket" /></div>
        <div style={{ marginBottom: 12 }}><MultiSelect label="Founder type" options={FOUNDER_TYPE_OPTIONS} selected={props.founderTypeSel} onChange={props.setFounderTypeSel} placeholder="Any founder type" /></div>
        <div style={{ marginBottom: 12 }}><MultiSelect label="Career stage" options={STAGE_OPTIONS} selected={props.stageSel} onChange={props.setStageSel} placeholder="Any stage" /></div>
        <div style={{ marginBottom: 12 }}>
          <Lbl>Years of experience</Lbl>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" min="0" step="0.5" value={props.yearsMin} onChange={e => props.setYearsMin(e.target.value)} placeholder="min" style={inputStyle} />
            <span style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)' }}>–</span>
            <input type="number" min="0" step="0.5" value={props.yearsMax} onChange={e => props.setYearsMax(e.target.value)} placeholder="max" style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <Lbl>Current tenure (years)</Lbl>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" min="0.25" step="0.25" value={props.currentTenureMin} onChange={e => props.setCurrentTenureMin(e.target.value)} placeholder="min" style={inputStyle} />
            <span style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)' }}>–</span>
            <input type="number" min="0.25" step="0.25" value={props.currentTenureMax} onChange={e => props.setCurrentTenureMax(e.target.value)} placeholder="10+" style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Lbl>Avg tenure (years)</Lbl>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
              <input type="checkbox" checked={props.avgTenureIncludeCurrent} onChange={e => props.setAvgTenureIncludeCurrent(e.target.checked)} style={{ accentColor: 'var(--accent-500)' }} />
              Incl. current
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" min="0.1" step="0.1" value={props.avgTenureMin} onChange={e => props.setAvgTenureMin(e.target.value)} placeholder="min" style={inputStyle} />
            <span style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)' }}>–</span>
            <input type="number" min="0.1" step="0.1" value={props.avgTenureMax} onChange={e => props.setAvgTenureMax(e.target.value)} placeholder="10+" style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}><MultiSelect label="Clearance" options={CLEARANCE_OPTIONS} selected={props.clearanceSel} onChange={props.setClearanceSel} placeholder="Any clearance" /></div>
        <div style={{ marginBottom: 12 }}><MultiSelect label="Signals" options={props.signalOptions} selected={props.signalSel} onChange={props.setSignalSel} placeholder="Any signal" emptyMessage="No match" /></div>
        <div style={{ marginBottom: 16 }}><MultiSelect label="Location (US)" options={props.locationOptions} selected={props.locationSel} onChange={props.setLocationSel} placeholder="State or city" emptyMessage="No match" /></div>

        {/* WHERE THEY WORKED */}
        <SH icon={<IconBriefcase />} label="Where they worked" />
        <div style={{ marginBottom: 8 }}>
          <Lbl>Company</Lbl>
          <MultiSelect label="" options={props.companyOptions} selected={props.compoundCompany}
            onChange={props.setCompoundCompany} placeholder="Search companies…" emptyMessage="No match" />
          {props.compoundCompanyPills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
              {props.compoundCompanyPills.map(pill => {
                const label = props.companyOptions.find(o => o.value === pill.value)?.label || pill.value
                return (
                  <span key={pill.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 6px', fontSize: 'var(--fs-11)', fontFamily: 'var(--font-sans)', background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--r-chip)' }}>
                    <span style={{ color: 'var(--fg-primary)' }}>{label}</span>
                    <select value={pill.scope} onChange={e => props.setCompoundCompanyPills(props.compoundCompanyPills.map(p => p.value === pill.value ? { ...p, scope: e.target.value as any } : p))} style={{ background: 'none', border: 'none', color: 'var(--fg-tertiary)', fontSize: 'var(--fs-10)', fontFamily: 'var(--font-sans)', cursor: 'pointer', padding: 0 }}>
                      <option value="ever">ever</option>
                      <option value="currently">currently</option>
                      <option value="previously">previously</option>
                    </select>
                  </span>
                )
              })}
            </div>
          )}
        </div>
        {props.compoundCompany.length > 0 && (
          <>
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
          <div style={{ marginBottom: 12 }}><MultiSelect label="Company group" options={props.companyGroupOptions} selected={props.companyGroupSel} onChange={props.setCompanyGroupSel} placeholder="Any company group" /></div>
        )}
        {props.companyConditionCount > 0 && (
          <div style={{ marginBottom: 16, padding: '6px 10px', background: 'var(--accent-950)', border: '1px solid var(--accent-900)', borderRadius: 'var(--r-chip)', fontSize: 'var(--fs-12)', color: 'var(--accent-400)', fontFamily: 'var(--font-sans)' }}>
            {props.companyConditionCount} company condition{props.companyConditionCount !== 1 ? 's' : ''} active · <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={props.onOpenBuilder}>Edit in builder</span>
          </div>
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
          <div style={{ marginBottom: 12 }}><MultiSelect label="School group" options={props.schoolGroupOptions} selected={props.schoolGroupSel} onChange={props.setSchoolGroupSel} placeholder="Any school group" /></div>
        )}
        <div style={{ marginBottom: 12 }}><MultiSelect label="Degree" options={DEGREE_OPTIONS} selected={props.degreeSel} onChange={props.setDegreeSel} placeholder="Any degree" /></div>
        {props.fieldOfStudyOptions.length > 0 && (
          <div style={{ marginBottom: 12 }}><MultiSelect label="Field of study" options={props.fieldOfStudyOptions} selected={props.fieldOfStudySel} onChange={props.setFieldOfStudySel} placeholder="Any field" /></div>
        )}
        {props.schoolConditionCount > 0 && (
          <div style={{ marginBottom: 16, padding: '6px 10px', background: 'var(--accent-950)', border: '1px solid var(--accent-900)', borderRadius: 'var(--r-chip)', fontSize: 'var(--fs-12)', color: 'var(--accent-400)', fontFamily: 'var(--font-sans)' }}>
            {props.schoolConditionCount} school condition{props.schoolConditionCount !== 1 ? 's' : ''} active · <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={props.onOpenBuilder}>Edit in builder</span>
          </div>
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
