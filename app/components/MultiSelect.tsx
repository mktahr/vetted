'use client'

// MultiSelect — searchable, pillable multi-select dropdown.
// Styled with Vetted design system tokens (CSS custom properties).

import { useEffect, useRef, useState } from 'react'

export interface MultiSelectOption {
  value: string
  label: string
  sublabel?: string
}

interface Props {
  label: string
  options: MultiSelectOption[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  emptyMessage?: string
}

export function MultiSelect({ label, options, selected, onChange, placeholder, emptyMessage }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOrFocus(e: Event) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOrFocus)
    document.addEventListener('focusin', onClickOrFocus)
    return () => { document.removeEventListener('mousedown', onClickOrFocus); document.removeEventListener('focusin', onClickOrFocus) }
  }, [open])

  const selectedSet = new Set(selected)
  const q = query.trim().toLowerCase()
  const filtered = q
    ? options.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q) || (o.sublabel || '').toLowerCase().includes(q))
    : options

  function toggle(value: string) {
    if (selectedSet.has(value)) onChange(selected.filter(v => v !== value))
    else onChange([...selected, value])
  }

  const selectedLabels = selected.map(v => { const opt = options.find(o => o.value === v); return opt?.label || v })

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {label && <label style={{ display: 'block', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-medium)', color: 'var(--fg-secondary)', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>{label}</label>}

      <button type="button" onClick={() => { const next = !open; setOpen(next); if (next) setTimeout(() => inputRef.current?.focus(), 0) }}
        style={{
          width: '100%', padding: '6px 8px', minHeight: 32,
          border: `1px solid ${open ? 'var(--accent-500)' : 'var(--border-subtle)'}`,
          borderRadius: 'var(--r-button)', background: 'var(--bg-surface)',
          color: 'var(--fg-primary)', fontSize: 'var(--fs-13)', fontFamily: 'var(--font-sans)',
          textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          outline: open ? '2px solid var(--accent-500)' : 'none', outlineOffset: -1,
          transition: 'border-color var(--dur-hover) var(--ease)',
        }}>
        <span style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {selected.length === 0 ? (
            <span style={{ color: 'var(--fg-tertiary)' }}>{placeholder || 'Any'}</span>
          ) : selected.length <= 2 ? (
            selectedLabels.map(l => (
              <span key={l} style={{ padding: '1px 6px', background: 'var(--accent-950)', color: 'var(--accent-400)', borderRadius: 'var(--r-chip)', fontSize: 'var(--fs-12)' }}>{l}</span>
            ))
          ) : (
            <span style={{ color: 'var(--fg-secondary)' }}>{selected.length} selected</span>
          )}
        </span>
        {selected.length > 0 && (
          <span role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onChange([]) }}
            style={{ color: 'var(--fg-tertiary)', padding: '0 2px', cursor: 'pointer', fontSize: 'var(--fs-14)' }} title="Clear">×</span>
        )}
        <span style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--fs-11)' }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', zIndex: 40, marginTop: 4, width: '100%', minWidth: 200,
          background: 'var(--bg-surface-raised)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--r-card)', boxShadow: 'var(--shadow-float)',
        }}>
          <div style={{ padding: 8, borderBottom: '1px solid var(--border-subtle)' }}>
            <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder={`Search…`}
              style={{
                width: '100%', padding: '4px 8px', fontSize: 'var(--fs-13)', fontFamily: 'var(--font-sans)',
                border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-button)',
                background: 'var(--bg-surface)', color: 'var(--fg-primary)', outline: 'none',
              }} />
          </div>
          <ul style={{ maxHeight: 256, overflowY: 'auto', padding: '4px 0', margin: 0, listStyle: 'none' }}>
            {filtered.length === 0 ? (
              <li style={{ padding: '8px 12px', color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)' }}>{emptyMessage || 'No matches'}</li>
            ) : (
              filtered.map(o => {
                const isSel = selectedSet.has(o.value)
                return (
                  <li key={o.value} onClick={() => toggle(o.value)}
                    style={{
                      padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      background: isSel ? 'var(--bg-selected)' : 'transparent',
                      transition: 'background var(--dur-hover) var(--ease)',
                    }}
                    onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isSel ? 'var(--bg-selected)' : 'transparent' }}>
                    <span style={{
                      width: 14, height: 14, border: `1px solid ${isSel ? 'var(--accent-500)' : 'var(--border-strong)'}`,
                      borderRadius: 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isSel ? 'var(--accent-500)' : 'transparent',
                    }}>
                      {isSel && <svg viewBox="0 0 16 16" fill="none" width="12" height="12"><path d="M3 8 L7 12 L13 4" stroke="var(--fg-on-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </span>
                    <span style={{ flex: 1 }}>
                      <span style={{ color: 'var(--fg-primary)', fontSize: 'var(--fs-13)', fontFamily: 'var(--font-sans)' }}>{o.label}</span>
                      {o.sublabel && <span style={{ marginLeft: 8, fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)' }}>{o.sublabel}</span>}
                    </span>
                  </li>
                )
              })
            )}
          </ul>
          {selected.length > 0 && (
            <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)' }}>{selected.length} selected</span>
              <button onClick={() => onChange([])} style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
