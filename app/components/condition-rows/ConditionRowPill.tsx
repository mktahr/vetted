'use client'

import type { ConditionRow, ConditionEntityType } from './types'

interface ConditionRowPillProps {
  row: ConditionRow
  entityType: ConditionEntityType
  entityNameMap: Record<string, string>
  onEdit: () => void
  onRemove: () => void
}

export default function ConditionRowPill({ row, entityType, entityNameMap, onEdit, onRemove }: ConditionRowPillProps) {
  // Build summary text
  const parts: string[] = []

  // Target summary
  if (row.target.type === 'specific') {
    const ids = entityType === 'company' ? row.target.companyIds : row.target.schoolIds
    if (ids && ids.length > 0) {
      const names = ids.map(id => entityNameMap[id] || '?')
      if (names.length <= 2) parts.push(names.join(', '))
      else parts.push(`${names[0]} +${names.length - 1}`)
    }
  } else {
    // Issue 2: Attributes summary with prefixed labels
    const attrs = entityType === 'company' ? row.target.companyAttributes : row.target.schoolAttributes
    if (attrs) {
      const attrParts: string[] = []
      if ('industry' in attrs && (attrs as any).industry?.length) attrParts.push('Industry: ' + (attrs as any).industry.slice(0, 2).join('/'))
      if ('stage' in attrs && (attrs as any).stage?.length) attrParts.push('Stage: ' + (attrs as any).stage.join('/'))
      if ('focus' in attrs && (attrs as any).focus?.length) attrParts.push('Focus: ' + (attrs as any).focus.join('/'))
      if ('foundedAfter' in attrs && (attrs as any).foundedAfter) attrParts.push('Founded ≥' + (attrs as any).foundedAfter)
      if ('foundedBefore' in attrs && (attrs as any).foundedBefore) attrParts.push('Founded ≤' + (attrs as any).foundedBefore)
      if ('schoolGroups' in attrs && (attrs as any).schoolGroups?.length) attrParts.push('Group: ' + (attrs as any).schoolGroups.map((g: string) => g.replace(/_/g, ' ')).join(', '))
      parts.push(attrParts.length > 0 ? attrParts.join(', ') : 'Any')
    }
  }

  // Scope
  parts.push(row.scope === 'ever' ? 'Ever' : row.scope === 'currently' ? 'Currently' : 'Previously')

  // Year range
  if (row.yearFrom || row.yearTo) {
    parts.push(`${row.yearFrom || '…'}–${row.yearTo || 'now'}`)
  }

  // Specialty
  if (row.specialty) parts.push(row.specialty.replace(/_/g, ' '))

  // Seniority
  if (row.seniority) parts.push(row.seniority.replace(/_/g, ' '))

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
        background: 'var(--accent-950)', color: 'var(--accent-400)',
        borderRadius: 'var(--r-chip)', fontSize: 'var(--fs-12)', fontFamily: 'var(--font-sans)',
        border: '1px solid var(--accent-900)', cursor: 'pointer',
        maxWidth: 280, overflow: 'hidden',
      }}
    >
      <span onClick={onEdit} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={parts.join(' · ')}>
        {parts.join(' · ')}
      </span>
      <button onClick={e => { e.stopPropagation(); onRemove() }} style={{ color: 'var(--accent-500)', fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', fontSize: 'var(--fs-12)', flexShrink: 0 }}>×</button>
    </span>
  )
}
