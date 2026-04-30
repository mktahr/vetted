'use client'

// Company filter with per-row scope toggle (current / past / ever).
// Built on top of AutocompleteSelect's typeahead search but with custom
// rendering for the scope chips.

import { useEffect, useRef, useState } from 'react'
import type { CompanyEntry, CompanyScope } from '@/lib/crust/types'
import InfoTooltip from './InfoTooltip'

interface Props {
  value: CompanyEntry[]
  onChange: (v: CompanyEntry[]) => void
}

interface Suggestion { value: string }

export default function CompanyMultiSelect(props: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true); setError(null)
      try {
        const resp = await fetch('/api/admin/crust-import/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldKey: 'company', query, limit: 25 }),
        })
        const data = await resp.json()
        if (!resp.ok || data.error) {
          setError(data.error || `HTTP ${resp.status}`); setSuggestions([])
        } else {
          setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error')
        setSuggestions([])
      } finally { setLoading(false) }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, open])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function add(v: string) {
    if (props.value.some(c => c.value === v)) return
    props.onChange([...props.value, { value: v, scope: 'current' }])
    setQuery('')
  }

  function remove(v: string) {
    props.onChange(props.value.filter(c => c.value !== v))
  }

  function setScope(v: string, scope: CompanyScope) {
    props.onChange(props.value.map(c => c.value === v ? { ...c, scope } : c))
  }

  return (
    <div ref={containerRef} style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <label
          title="experience.employment_details.{current,past}.name"
          style={{
            fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-medium)' as any,
            color: 'var(--fg-tertiary)', textTransform: 'uppercase',
            letterSpacing: 'var(--tr-eyebrow)', fontFamily: 'var(--font-sans)',
          }}
        >
          Companies
        </label>
        <InfoTooltip text="Add companies, then use the per-row dropdown to set scope: current (currently working there), past (previously), or ever (current OR past)." />
      </div>

      {props.value.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
          {props.value.map(c => (
            <div key={c.value} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
              background: 'var(--accent-950)', border: '1px solid var(--accent-900)',
              borderRadius: 'var(--r-chip)', fontSize: 'var(--fs-12)', fontFamily: 'var(--font-sans)',
            }}>
              <span style={{ color: 'var(--accent-400)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.value}</span>
              <select
                value={c.scope}
                onChange={e => setScope(c.value, e.target.value as CompanyScope)}
                style={{
                  background: 'none', border: 'none', color: 'var(--fg-tertiary)',
                  fontSize: 'var(--fs-10)', fontFamily: 'var(--font-sans)', cursor: 'pointer', padding: 0,
                }}
              >
                <option value="current">current</option>
                <option value="past">past</option>
                <option value="ever">ever</option>
              </select>
              <button onClick={() => remove(c.value)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--accent-500)', fontWeight: 700, fontSize: 'var(--fs-12)',
              }}>×</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          placeholder="Type a company name…"
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => setOpen(true)}
          style={{
            width: '100%', padding: '6px 8px',
            border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-button)',
            background: 'var(--bg-surface)', color: 'var(--fg-primary)',
            fontSize: 'var(--fs-13)', fontFamily: 'var(--font-sans)', outline: 'none',
          }}
        />
        {open && (
          <div style={{
            position: 'absolute', zIndex: 10, top: '100%', left: 0, right: 0,
            marginTop: 2, maxHeight: 240, overflowY: 'auto',
            background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--r-button)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }}>
            {loading && <div style={{ padding: 8, fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)' }}>Loading…</div>}
            {error && <div style={{ padding: 8, fontSize: 'var(--fs-12)', color: 'var(--red-400)' }}>{error}</div>}
            {!loading && !error && suggestions.length === 0 && (
              <div style={{ padding: 8, fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)' }}>No matches</div>
            )}
            {!loading && !error && suggestions.map(s => {
              const taken = props.value.some(c => c.value === s.value)
              return (
                <button
                  key={s.value}
                  onClick={() => add(s.value)}
                  disabled={taken}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '6px 10px', border: 'none',
                    cursor: taken ? 'default' : 'pointer', background: 'none',
                    fontSize: 'var(--fs-13)', fontFamily: 'var(--font-sans)',
                    color: taken ? 'var(--fg-tertiary)' : 'var(--fg-primary)',
                  }}
                  onMouseEnter={e => { if (!taken) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {s.value}{taken ? ' ✓' : ''}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
