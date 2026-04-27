'use client'

import { useState } from 'react'
import type { ConditionRow, ConditionEntityType, TemporalScope } from './types'
import { MultiSelectOption } from '../MultiSelect'
import ConditionRowPill from './ConditionRowPill'
import ConditionRowEditor from './ConditionRowEditor'

interface ConditionRowListProps {
  rows: ConditionRow[]
  onChange: (rows: ConditionRow[]) => void
  entityType: ConditionEntityType
  entityOptions: MultiSelectOption[]
  entityNameMap: Record<string, string>
  specialtyOptions: MultiSelectOption[]
  seniorityOptions: MultiSelectOption[]
  defaultScope: TemporalScope
  onDefaultScopeChange: (v: TemporalScope) => void
  // Attribute options
  industryOptions?: MultiSelectOption[]
  focusOptions?: MultiSelectOption[]
  stageOptions?: MultiSelectOption[]
  schoolGroupOptions?: MultiSelectOption[]
  label: string
}

const scopeBtn = (active: boolean): React.CSSProperties => ({
  padding: '2px 8px', fontSize: 'var(--fs-11)', fontFamily: 'var(--font-sans)',
  border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-chip)',
  background: active ? 'var(--bg-surface-raised)' : 'transparent',
  color: active ? 'var(--fg-primary)' : 'var(--fg-tertiary)',
  fontWeight: active ? 'var(--fw-medium)' as any : 'normal',
  cursor: 'pointer', lineHeight: '1.5',
})

export default function ConditionRowList({
  rows, onChange, entityType, entityOptions, entityNameMap,
  specialtyOptions, seniorityOptions, defaultScope, onDefaultScopeChange,
  industryOptions, focusOptions, stageOptions, schoolGroupOptions, label,
}: ConditionRowListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  function addRow() {
    const newRow: ConditionRow = {
      id: crypto.randomUUID(),
      scope: defaultScope,
      target: { type: 'specific' },
    }
    setIsAdding(true)
    setEditingId(newRow.id)
    onChange([...rows, newRow])
  }

  function updateRow(updated: ConditionRow) {
    onChange(rows.map(r => r.id === updated.id ? updated : r))
    setEditingId(null)
    setIsAdding(false)
  }

  function removeRow(id: string) {
    onChange(rows.filter(r => r.id !== id))
    setEditingId(null)
    setIsAdding(false)
  }

  function cancelEdit() {
    if (isAdding && editingId) {
      // Remove the row that was being added
      onChange(rows.filter(r => r.id !== editingId))
    }
    setEditingId(null)
    setIsAdding(false)
  }

  return (
    <div>
      {/* Header with label + default scope */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-medium)' as any, color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)' }}>{label}</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button style={scopeBtn(defaultScope === 'currently')} onClick={() => onDefaultScopeChange('currently')}>Currently</button>
          <button style={scopeBtn(defaultScope === 'ever')} onClick={() => onDefaultScopeChange('ever')}>Ever</button>
          <button style={scopeBtn(defaultScope === 'previously')} onClick={() => onDefaultScopeChange('previously')}>Previously</button>
        </div>
      </div>

      {/* Pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6, position: 'relative' }}>
        {rows.map(row => (
          <div key={row.id} style={{ position: 'relative' }}>
            <ConditionRowPill
              row={row}
              entityType={entityType}
              entityNameMap={entityNameMap}
              onEdit={() => setEditingId(editingId === row.id ? null : row.id)}
              onRemove={() => removeRow(row.id)}
            />
            {editingId === row.id && (
              <ConditionRowEditor
                row={row}
                entityType={entityType}
                entityOptions={entityOptions}
                specialtyOptions={specialtyOptions}
                seniorityOptions={seniorityOptions}
                industryOptions={industryOptions}
                focusOptions={focusOptions}
                stageOptions={stageOptions}
                schoolGroupOptions={schoolGroupOptions}
                onSave={updateRow}
                onCancel={cancelEdit}
                onDelete={() => removeRow(row.id)}
              />
            )}
          </div>
        ))}

        {/* Add button */}
        <button
          onClick={addRow}
          style={{
            padding: '3px 10px', fontSize: 'var(--fs-12)', fontFamily: 'var(--font-sans)',
            background: 'none', border: '1px dashed var(--border-subtle)',
            borderRadius: 'var(--r-chip)', color: 'var(--fg-tertiary)',
            cursor: 'pointer',
          }}
        >
          + Add {entityType}
        </button>
      </div>

      {/* Summary count */}
      {rows.length > 0 && (
        <div style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)' }}>
          {rows.length} condition{rows.length !== 1 ? 's' : ''} (AND)
        </div>
      )}
    </div>
  )
}
