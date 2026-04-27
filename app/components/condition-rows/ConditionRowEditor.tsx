'use client'

import { useState, useEffect, useRef } from 'react'
import type { ConditionRow, ConditionEntityType, TemporalScope, ConditionTargetType } from './types'
import { MultiSelect, MultiSelectOption } from '../MultiSelect'

interface ConditionRowEditorProps {
  row: ConditionRow
  entityType: ConditionEntityType
  entityOptions: MultiSelectOption[]         // company or school options
  specialtyOptions: MultiSelectOption[]
  seniorityOptions: MultiSelectOption[]
  // Attribute options (company-specific)
  industryOptions?: MultiSelectOption[]
  focusOptions?: MultiSelectOption[]
  stageOptions?: MultiSelectOption[]
  // School-specific
  schoolGroupOptions?: MultiSelectOption[]
  onSave: (row: ConditionRow) => void
  onCancel: () => void
  onDelete: () => void
}

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
  industryOptions, focusOptions, stageOptions, schoolGroupOptions,
  onSave, onCancel, onDelete,
}: ConditionRowEditorProps) {
  const [scope, setScope] = useState<TemporalScope>(row.scope)
  const [targetType, setTargetType] = useState<ConditionTargetType>(row.target.type)
  const [entityIds, setEntityIds] = useState<string[]>(
    entityType === 'company' ? (row.target.companyIds || []) : (row.target.schoolIds || [])
  )
  // Attributes
  const [attrIndustry, setAttrIndustry] = useState<string[]>(row.target.companyAttributes?.industry || [])
  const [attrFocus, setAttrFocus] = useState<string[]>(row.target.companyAttributes?.focus || [])
  const [attrStage, setAttrStage] = useState<string[]>(row.target.companyAttributes?.stage || [])
  const [attrFoundedAfter, setAttrFoundedAfter] = useState(row.target.companyAttributes?.foundedAfter?.toString() || '')
  const [attrFoundedBefore, setAttrFoundedBefore] = useState(row.target.companyAttributes?.foundedBefore?.toString() || '')
  const [attrSchoolGroups, setAttrSchoolGroups] = useState<string[]>(row.target.schoolAttributes?.schoolGroups || [])

  const [yearFrom, setYearFrom] = useState(row.yearFrom?.toString() || '')
  const [yearTo, setYearTo] = useState(row.yearTo?.toString() || '')
  const [specialty, setSpecialty] = useState(row.specialty || '')
  const [showAdvanced, setShowAdvanced] = useState(!!row.seniority)
  const [seniority, setSeniority] = useState(row.seniority || '')

  const ref = useRef<HTMLDivElement>(null)

  // Click outside to cancel
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onCancel])

  // Smart auto-detection: year range end < current year → scope = previously
  useEffect(() => {
    const yt = yearTo ? parseInt(yearTo) : null
    if (yt && yt < new Date().getFullYear()) setScope('previously')
    else if (yearFrom && !yearTo) setScope('currently')
  }, [yearFrom, yearTo])

  function handleSave() {
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

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 100,
      width: 320, padding: 12, marginTop: 4,
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
      borderRadius: 'var(--r-card, 8px)', boxShadow: 'var(--shadow-float)',
      fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-12)',
    }}>
      {/* Target type toggle */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
        <button style={scopeBtn(targetType === 'specific')} onClick={() => setTargetType('specific')}>
          Specific {entityType === 'company' ? 'companies' : 'schools'}
        </button>
        <button style={scopeBtn(targetType === 'attributes')} onClick={() => setTargetType('attributes')}>
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
              {stageOptions && stageOptions.length > 0 && (
                <MultiSelect label="Stage" options={stageOptions} selected={attrStage} onChange={setAttrStage} placeholder="Any stage" />
              )}
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

      {/* Advanced */}
      {entityType === 'company' && (
        <>
          <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-tertiary)', fontSize: 'var(--fs-11)', fontFamily: 'var(--font-sans)', marginBottom: showAdvanced ? 4 : 0 }}>
            {showAdvanced ? '▾ Advanced' : '▸ Advanced'}
          </button>
          {showAdvanced && seniorityOptions.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <MultiSelect label="Seniority" options={seniorityOptions} selected={seniority ? [seniority] : []}
                onChange={v => setSeniority(v[0] || '')} placeholder="Any seniority" />
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleSave} style={{ padding: '4px 12px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--r-button)', cursor: 'pointer', fontSize: 'var(--fs-12)', fontFamily: 'var(--font-sans)' }}>Save</button>
          <button onClick={onCancel} style={{ padding: '4px 12px', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-button)', cursor: 'pointer', color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)', fontFamily: 'var(--font-sans)' }}>Cancel</button>
        </div>
        <button onClick={onDelete} style={{ padding: '4px 12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)', fontFamily: 'var(--font-sans)' }}>Delete</button>
      </div>
    </div>
  )
}
