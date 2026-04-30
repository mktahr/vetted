'use client'

// AutocompleteSelect — typeahead dropdown that calls Crust autocomplete
// via /api/admin/crust-import/autocomplete. Strict-enum: only values
// returned by the API can be selected. Free-typed text that doesn't
// match a suggestion cannot be submitted.
//
// Used by the Crust Import UI for: function_category, seniority_level,
// company, country, region, city, school, degree, field_of_study, industry.
//
// Debounce: 300ms.

import { useEffect, useRef, useState } from 'react'
import type { AutocompleteFieldKey } from '@/lib/crust/types'

interface Props {
  fieldKey: AutocompleteFieldKey
  label: string
  placeholder?: string
  multi: boolean                // true = multi-select chips, false = single value
  value: string | string[]
  onChange: (v: string | string[]) => void
  required?: boolean
  hint?: string                 // tooltip text — Crust field name for debugging
  helperText?: string           // visible helper text below the input
}

interface Suggestion { value: string }

export default function AutocompleteSelect(props: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const selected: string[] = props.multi
    ? (Array.isArray(props.value) ? props.value : [])
    : (typeof props.value === 'string' && props.value ? [props.value] : [])

  // Fetch on query change (300ms debounce). Empty query → top values.
  // 30s abort timeout surfaces hung requests as a clear error rather than
  // an indefinite "Loading..." spinner.
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      const controller = new AbortController()
      const abortTimer = setTimeout(() => controller.abort(), 30_000)
      try {
        const resp = await fetch('/api/admin/crust-import/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldKey: props.fieldKey, query, limit: 25 }),
          signal: controller.signal,
        })
        const data = await resp.json()
        if (!resp.ok || data.error) {
          setError(data.error || `HTTP ${resp.status}`)
          console.error('[AutocompleteSelect]', props.fieldKey, 'error:', data)
          setSuggestions([])
        } else {
          setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
        }
      } catch (err) {
        const msg = err instanceof Error
          ? (err.name === 'AbortError' ? 'Request timed out (>30s) — Crust may be slow' : err.message)
          : 'Network error'
        setError(msg)
        console.error('[AutocompleteSelect]', props.fieldKey, 'exception:', err)
        setSuggestions([])
      } finally {
        clearTimeout(abortTimer)
        setLoading(false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, open, props.fieldKey])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function pick(v: string) {
    if (props.multi) {
      const arr = Array.isArray(props.value) ? props.value : []
      if (arr.includes(v)) return
      props.onChange([...arr, v])
      setQuery('')
      inputRef.current?.focus()
    } else {
      props.onChange(v)
      setQuery('')
      setOpen(false)
    }
  }

  function remove(v: string) {
    if (props.multi) {
      const arr = Array.isArray(props.value) ? props.value : []
      props.onChange(arr.filter(x => x !== v))
    } else {
      props.onChange('')
    }
  }

  return (
    <div ref={containerRef} style={{ marginBottom: 12 }}>
      <label
        title={props.hint /* Crust field name shown on hover only */}
        style={{
          display: 'block', marginBottom: 4,
          fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-medium)' as any,
          color: 'var(--fg-tertiary)', textTransform: 'uppercase',
          letterSpacing: 'var(--tr-eyebrow)', fontFamily: 'var(--font-sans)',
        }}
      >
        {props.label}{props.required ? ' *' : ''}
      </label>

      {/* Selected chips (multi) or selected value (single) */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
          {selected.map(v => (
            <span key={v} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
              background: 'var(--accent-950)', color: 'var(--accent-400)',
              borderRadius: 'var(--r-chip)', fontSize: 'var(--fs-12)',
              border: '1px solid var(--accent-900)', fontFamily: 'var(--font-sans)',
            }}>
              {v}
              <button onClick={() => remove(v)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--accent-500)', fontWeight: 700, fontSize: 'var(--fs-12)',
              }}>×</button>
            </span>
          ))}
        </div>
      )}

      {(props.multi || selected.length === 0) && (
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder={props.placeholder || 'Type to search…'}
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
              borderRadius: 'var(--r-button)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}>
              {loading && <div style={{ padding: 8, fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)' }}>Loading…</div>}
              {error && <div style={{ padding: 8, fontSize: 'var(--fs-12)', color: 'var(--red-400)' }}>{error}</div>}
              {!loading && !error && suggestions.length === 0 && (
                <div style={{ padding: 8, fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)' }}>No matches</div>
              )}
              {!loading && !error && suggestions.map(s => (
                <button
                  key={s.value}
                  onClick={() => pick(s.value)}
                  disabled={selected.includes(s.value)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '6px 10px', border: 'none', cursor: selected.includes(s.value) ? 'default' : 'pointer',
                    background: 'none', fontSize: 'var(--fs-13)', fontFamily: 'var(--font-sans)',
                    color: selected.includes(s.value) ? 'var(--fg-tertiary)' : 'var(--fg-primary)',
                  }}
                  onMouseEnter={e => { if (!selected.includes(s.value)) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {s.value}{selected.includes(s.value) ? ' ✓' : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {props.helperText && (
        <div style={{
          marginTop: 4, fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)',
          lineHeight: 1.4, fontFamily: 'var(--font-sans)',
        }}>
          {props.helperText}
        </div>
      )}
    </div>
  )
}
