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
  // Pending row: held in local state until Save. Never touches rows array.
  const [pendingRow, setPendingRow] = useState<ConditionRow | null>(null)

  function startAdd() {
    setEditingId(null)
    setPendingRow({
      id: crypto.randomUUID(),
      scope: defaultScope,
      target: { type: 'specific' },
    })
  }

  function savePending(saved: ConditionRow) {
    onChange([...rows, saved])
    setPendingRow(null)
  }

  function cancelPending() {
    setPendingRow(null)
  }

  function updateRow(updated: ConditionRow) {
    onChange(rows.map(r => r.id === updated.id ? updated : r))
    setEditingId(null)
  }

  function removeRow(id: string) {
    onChange(rows.filter(r => r.id !== id))
    if (editingId === id) setEditingId(null)
  }

  function toggleEdit(id: string) {
    setPendingRow(null) // close any pending add
    setEditingId(editingId === id ? null : id)
  }

  return (
    <div>
      {/* Header: label + default scope toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-medium)' as any, color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)' }}>{label}</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button style={scopeBtn(defaultScope === 'currently')} onClick={() => onDefaultScopeChange('currently')}>Currently</button>
          <button style={scopeBtn(defaultScope === 'ever')} onClick={() => onDefaultScopeChange('ever')}>Ever</button>
          <button style={scopeBtn(defaultScope === 'previously')} onClick={() => onDefaultScopeChange('previously')}>Previously</button>
        </div>
      </div>

      {/* Committed rows: pill + inline editor */}
      {rows.map(row => (
        <div key={row.id} style={{ marginBottom: 4 }}>
          <ConditionRowPill
            row={row}
            entityType={entityType}
            entityNameMap={entityNameMap}
            onEdit={() => toggleEdit(row.id)}
            onRemove={() => removeRow(row.id)}
          />
          {editingId === row.id && (
            <div style={{ marginTop: 4, marginBottom: 8 }}>
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
                onSave={(updated) => { updateRow(updated); setEditingId(null) }}
                onCancel={() => setEditingId(null)}
                onDelete={() => removeRow(row.id)}
                inline
              />
            </div>
          )}
        </div>
      ))}

      {/* Pending add: inline editor (not in rows array until Save) */}
      {pendingRow && (
        <div style={{ marginTop: 4, marginBottom: 8 }}>
          <ConditionRowEditor
            row={pendingRow}
            entityType={entityType}
            entityOptions={entityOptions}
            specialtyOptions={specialtyOptions}
            seniorityOptions={seniorityOptions}
            industryOptions={industryOptions}
            focusOptions={focusOptions}
            stageOptions={stageOptions}
            schoolGroupOptions={schoolGroupOptions}
            onSave={savePending}
            onCancel={cancelPending}
            onDelete={cancelPending}
            inline
          />
        </div>
      )}

      {/* Add button */}
      {!pendingRow && (
        <button
          onClick={startAdd}
          style={{
            padding: '3px 10px', fontSize: 'var(--fs-12)', fontFamily: 'var(--font-sans)',
            background: 'none', border: '1px dashed var(--border-subtle)',
            borderRadius: 'var(--r-chip)', color: 'var(--fg-tertiary)',
            cursor: 'pointer', marginTop: 4,
          }}
        >
          + Add {entityType}
        </button>
      )}

      {/* Summary */}
      {rows.length > 0 && (
        <div style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)', marginTop: 6 }}>
          {rows.length} condition{rows.length !== 1 ? 's' : ''} (AND)
        </div>
      )}
    </div>
  )
}
