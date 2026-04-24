'use client'

// MultiSelect — searchable, pillable multi-select dropdown.
// Designed for small/medium option sets (≤ a few hundred); filters in-memory.

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

  // Click-outside close
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const selectedSet = new Set(selected)
  const q = query.trim().toLowerCase()
  const filtered = q
    ? options.filter(o =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.sublabel || '').toLowerCase().includes(q)
      )
    : options

  function toggle(value: string) {
    if (selectedSet.has(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange([])
  }

  const selectedLabels = selected.map(v => {
    const opt = options.find(o => o.value === v)
    return opt?.label || v
  })

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>}

      <button
        type="button"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) setTimeout(() => inputRef.current?.focus(), 0)
        }}
        className={`min-w-[10rem] max-w-xs px-3 py-2 border rounded-lg text-sm bg-white text-left flex items-center gap-2 min-h-[38px] ${
          open ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50' : 'border-gray-300'
        } hover:border-gray-400`}
      >
        <span className="flex-1 flex flex-wrap gap-1">
          {selected.length === 0 ? (
            <span className="text-gray-400">{placeholder || 'Any'}</span>
          ) : selected.length <= 2 ? (
            selectedLabels.map(l => (
              <span key={l} className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                {l}
              </span>
            ))
          ) : (
            <span className="text-gray-700">{selected.length} selected</span>
          )}
        </span>
        {selected.length > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={clear}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clear(e as unknown as React.MouseEvent) } }}
            className="text-gray-400 hover:text-gray-600 px-1 cursor-pointer"
            title="Clear"
            aria-label="Clear selection"
          >
            ×
          </span>
        )}
        <span className="text-gray-400 text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-72 max-w-[90vw] bg-white border border-gray-300 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1 text-sm">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-gray-400 text-xs">
                {emptyMessage || 'No matches'}
              </li>
            ) : (
              filtered.map(o => {
                const isSel = selectedSet.has(o.value)
                return (
                  <li
                    key={o.value}
                    onClick={() => toggle(o.value)}
                    className={`px-3 py-1.5 cursor-pointer flex items-center gap-2 ${
                      isSel ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className={`inline-block w-4 h-4 border rounded flex-shrink-0 ${
                      isSel ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                    }`}>
                      {isSel && (
                        <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                          <path d="M3 8 L7 12 L13 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className="flex-1">
                      <span className="text-gray-900">{o.label}</span>
                      {o.sublabel && <span className="ml-2 text-xs text-gray-400">{o.sublabel}</span>}
                    </span>
                  </li>
                )
              })
            )}
          </ul>
          {selected.length > 0 && (
            <div className="p-2 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs text-gray-500">{selected.length} selected</span>
              <button
                onClick={() => onChange([])}
                className="text-xs text-gray-500 hover:text-gray-800 underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
