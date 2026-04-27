'use client'

import { useState, useEffect } from 'react'
import type { ConditionRow, ConditionEntityType, TemporalScope, ConditionTargetType } from './types'
import { MultiSelect, MultiSelectOption } from '../MultiSelect'

interface ConditionRowEditorProps {
  row: ConditionRow
  entityType: ConditionEntityType
  entityOptions: MultiSelectOption[]
  specialtyOptions: MultiSelectOption[]
  seniorityOptions: MultiSelectOption[]
  industryOptions?: MultiSelectOption[]
  focusOptions?: MultiSelectOption[]
  stageOptions?: MultiSelectOption[]
  schoolGroupOptions?: MultiSelectOption[]
  onSave: (row: ConditionRow) => void
  onCancel: () => void
  onDelete: () => void
  inline?: boolean
}

const STAGE_OPTIONS: MultiSelectOption[] = [
  { value: 'Pre-Seed', label: 'Pre-Seed' }, { value: 'Seed', label: 'Seed' },
  { value: 'Series A', label: 'Series A' }, { value: 'Series B', label: 'Series B' },
  { value: 'Series C', label: 'Series C' }, { value: 'Series D+', label: 'Series D+' },
  { value: 'Growth', label: 'Growth' }, { value: 'Public', label: 'Public' },
  { value: 'Acquired', label: 'Acquired' }, { value: 'Bootstrapped', label: 'Bootstrapped' },
]

const SIZE_OPTIONS: MultiSelectOption[] = [
  { value: '1-10', label: '1-10' }, { value: '11-50', label: '11-50' },
  { value: '51-200', label: '51-200' }, { value: '201-500', label: '201-500' },
  { value: '501-1000', label: '501-1000' }, { value: '1001-5000', label: '1001-5000' },
  { value: '5000+', label: '5000+' },
]

const scopeBtn = (active: boolean): React.CSSProperties => ({
  padding: '2px 8px', fontSize: 'var(--fs-11)', fontFamily: 'var(--font-sans)',
  border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-chip)',
  background: active ? 'var(--bg-surface-raised)' : 'transparent',
  color: active ? 'var(--fg-primary)' : 'var(--fg-tertiary)',
  fontWeight: active ? 'var(--fw-medium)' as any : 'normal',
  cursor: 'pointer', lineHeight: '1.5',
})

const lblStyle: React.CSSProperties = { fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)', marginBottom: 2, fontFamily: 'var(--font-sans)' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '4px 8px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-button)', fontSize: 'var(--fs-12)', fontFamily: 'var(--font-sans)', background: 'var(--bg-surface)', color: 'var(--fg-primary)' }

export default function ConditionRowEditor({
  row, entityType, entityOptions, specialtyOptions, seniorityOptions,
  industryOptions, focusOptions, schoolGroupOptions,
  onSave, onCancel, onDelete,
}: ConditionRowEditorProps) {
  const [scope, setScope] = useState<TemporalScope>(row.scope)
  const [targetType, setTargetType] = useState<ConditionTargetType>(row.target.type)
  const [entityIds, setEntityIds] = useState<string[]>(
    entityType === 'company' ? (row.target.companyIds || []) : (row.target.schoolIds || [])
  )
  const [attrIndustry, setAttrIndustry] = useState<string[]>(row.target.companyAttributes?.industry || [])
  const [attrFocus, setAttrFocus] = useState<string[]>(row.target.companyAttributes?.focus || [])
  const [attrStage, setAttrStage] = useState<string[]>(row.target.companyAttributes?.stage || [])
  const [attrFoundedAfter, setAttrFoundedAfter] = useState(row.target.companyAttributes?.foundedAfter?.toString() || '')
  const [attrFoundedBefore, setAttrFoundedBefore] = useState(row.target.companyAttributes?.foundedBefore?.toString() || '')
  const [attrSchoolGroups, setAttrSchoolGroups] = useState<string[]>(row.target.schoolAttributes?.schoolGroups || [])

  const [yearFrom, setYearFrom] = useState(row.yearFrom?.toString() || '')
  const [yearTo, setYearTo] = useState(row.yearTo?.toString() || '')
  const [specialty, setSpecialty] = useState(row.specialty || '')
  const [seniority, setSeniority] = useState(row.seniority || '')

  // Smart auto-detection
  useEffect(() => {
    const yt = yearTo ? parseInt(yearTo) : null
    if (yt && yt < new Date().getFullYear()) setScope('previously')
    else if (yearFrom && !yearTo) setScope('currently')
  }, [yearFrom, yearTo])

  // Validation: must have at least one target
  const isValid = targetType === 'specific'
    ? entityIds.length > 0
    : (attrIndustry.length > 0 || attrFocus.length > 0 || attrStage.length > 0 ||
       !!attrFoundedAfter || !!attrFoundedBefore || attrSchoolGroups.length > 0)

  function handleSave() {
    if (!isValid) return
    const built: ConditionRow = {
      id: row.id,
      scope,
      target: { type: targetType },
      yearFrom: yearFrom ? parseInt(yearFrom) : undefined,
      yearTo: yearTo ? parseInt(yearTo) : undefined,
      specialty: specialty || undefined,
      seniority: seniority || undefined,
    }
    if (targetType === 'specific') {
      if (entityType === 'company') built.target.companyIds = entityIds
      else built.target.schoolIds = entityIds
    } else {
      if (entityType === 'company') {
        built.target.companyAttributes = {
          industry: attrIndustry.length > 0 ? attrIndustry : undefined,
          focus: attrFocus.length > 0 ? attrFocus : undefined,
          stage: attrStage.length > 0 ? attrStage : undefined,
          foundedAfter: attrFoundedAfter ? parseInt(attrFoundedAfter) : undefined,
          foundedBefore: attrFoundedBefore ? parseInt(attrFoundedBefore) : undefined,
        }
      } else {
        built.target.schoolAttributes = {
          schoolGroups: attrSchoolGroups.length > 0 ? attrSchoolGroups : undefined,
        }
      }
    }
    onSave(built)
  }

  // Segmented control styles
  const segLeft: React.CSSProperties = {
    padding: '3px 10px', fontSize: 'var(--fs-11)', fontFamily: 'var(--font-sans)',
    border: '1px solid var(--border-default)', borderRight: 'none',
    borderRadius: 'var(--r-chip) 0 0 var(--r-chip)',
    background: targetType === 'specific' ? 'var(--bg-surface-raised)' : 'transparent',
    color: targetType === 'specific' ? 'var(--fg-primary)' : 'var(--fg-tertiary)',
    fontWeight: targetType === 'specific' ? 'var(--fw-medium)' as any : 'normal',
    cursor: 'pointer', lineHeight: '1.5',
  }
  const segRight: React.CSSProperties = {
    padding: '3px 10px', fontSize: 'var(--fs-11)', fontFamily: 'var(--font-sans)',
    border: '1px solid var(--border-default)',
    borderRadius: '0 var(--r-chip) var(--r-chip) 0',
    background: targetType === 'attributes' ? 'var(--bg-surface-raised)' : 'transparent',
    color: targetType === 'attributes' ? 'var(--fg-primary)' : 'var(--fg-tertiary)',
    fontWeight: targetType === 'attributes' ? 'var(--fw-medium)' as any : 'normal',
    cursor: 'pointer', lineHeight: '1.5',
  }

  // Inline expand: normal flow element inside the section card
  return (
    <div style={{
      padding: 12, background: 'var(--bg-canvas)', border: '1px solid var(--border-default)',
      borderRadius: 'var(--r-card, 8px)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-12)',
    }}>
      {/* Segmented control for target type */}
      <div style={{ display: 'flex', marginBottom: 8 }}>
        <button style={segLeft} onClick={() => setTargetType('specific')}>
          Specific {entityType === 'company' ? 'companies' : 'schools'}
        </button>
        <button style={segRight} onClick={() => setTargetType('attributes')}>
          {entityType === 'company' ? 'Company' : 'School'} attributes
        </button>
      </div>

      {/* Target content */}
      {targetType === 'specific' ? (
        <div style={{ marginBottom: 8 }}>
          <MultiSelect label="" options={entityOptions} selected={entityIds} onChange={setEntityIds}
            placeholder={`Search ${entityType === 'company' ? 'companies' : 'schools'}…`} emptyMessage="No match" />
        </div>
      ) : (
        <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entityType === 'company' ? (
            <>
              {industryOptions && industryOptions.length > 0 && (
                <MultiSelect label="Industry" options={industryOptions} selected={attrIndustry} onChange={setAttrIndustry} placeholder="Any industry" />
              )}
              {focusOptions && focusOptions.length > 0 && (
                <MultiSelect label="Focus" options={focusOptions} selected={attrFocus} onChange={setAttrFocus} placeholder="Any focus" />
              )}
              <MultiSelect label="Stage" options={STAGE_OPTIONS} selected={attrStage} onChange={setAttrStage} placeholder="Any stage" />
              <MultiSelect label="Size" options={SIZE_OPTIONS} selected={[]} onChange={() => {}} placeholder="Any size (data pending)" />
              <div>
                <div style={lblStyle}>Founded year</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" min="1900" max="2100" value={attrFoundedAfter} onChange={e => setAttrFoundedAfter(e.target.value)} placeholder="after" style={inputStyle} />
                  <span style={{ color: 'var(--fg-tertiary)' }}>–</span>
                  <input type="number" min="1900" max="2100" value={attrFoundedBefore} onChange={e => setAttrFoundedBefore(e.target.value)} placeholder="before" style={inputStyle} />
                </div>
              </div>
            </>
          ) : (
            <>
              {schoolGroupOptions && schoolGroupOptions.length > 0 && (
                <MultiSelect label="School group" options={schoolGroupOptions} selected={attrSchoolGroups} onChange={setAttrSchoolGroups} placeholder="Any group" />
              )}
            </>
          )}
        </div>
      )}

      {/* Scope */}
      <div style={{ marginBottom: 8 }}>
        <div style={lblStyle}>Scope</div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button style={scopeBtn(scope === 'currently')} onClick={() => setScope('currently')}>Currently</button>
          <button style={scopeBtn(scope === 'ever')} onClick={() => setScope('ever')}>Ever</button>
          <button style={scopeBtn(scope === 'previously')} onClick={() => setScope('previously')}>Previously</button>
        </div>
      </div>

      {/* Year range */}
      {entityType === 'company' && (
        <div style={{ marginBottom: 8 }}>
          <div style={lblStyle}>Year range</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" min="1950" max="2100" value={yearFrom} onChange={e => setYearFrom(e.target.value)} placeholder="from" style={inputStyle} />
            <span style={{ color: 'var(--fg-tertiary)' }}>–</span>
            <input type="number" min="1950" max="2100" value={yearTo} onChange={e => setYearTo(e.target.value)} placeholder="to" style={inputStyle} />
          </div>
        </div>
      )}

      {/* Specialty */}
      {entityType === 'company' && specialtyOptions.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <MultiSelect label="Specialty" options={specialtyOptions} selected={specialty ? [specialty] : []}
            onChange={v => setSpecialty(v[0] || '')} placeholder="Any specialty" />
        </div>
      )}

      {/* Seniority (inline, not hidden) */}
      {entityType === 'company' && seniorityOptions.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <MultiSelect label="Seniority" options={seniorityOptions} selected={seniority ? [seniority] : []}
            onChange={v => setSeniority(v[0] || '')} placeholder="Any seniority" />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleSave} disabled={!isValid} style={{ padding: '4px 12px', background: isValid ? 'var(--accent)' : 'var(--bg-surface-raised)', color: isValid ? 'white' : 'var(--fg-tertiary)', border: 'none', borderRadius: 'var(--r-button)', cursor: isValid ? 'pointer' : 'not-allowed', fontSize: 'var(--fs-12)', fontFamily: 'var(--font-sans)' }}>Save</button>
          <button onClick={onCancel} style={{ padding: '4px 12px', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-button)', cursor: 'pointer', color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)', fontFamily: 'var(--font-sans)' }}>Cancel</button>
        </div>
        <button onClick={onDelete} style={{ padding: '4px 12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)', fontFamily: 'var(--font-sans)' }}>Delete</button>
      </div>
    </div>
  )
}
