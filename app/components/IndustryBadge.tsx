// app/components/IndustryBadge.tsx
//
// V1 multi-industry display component. Shows the primary industry plus a
// "+N" badge when there are additional industries. Click the +N to open a
// popover with the full list. Click outside or the × to close.
//
// IMPLEMENTATION NOTES:
// - Popover renders via React portal at document.body to avoid being
//   clipped by table cells / overflow:hidden parents (which was the bug
//   in v1).
// - Click trigger (not hover) — native browser hover-tooltips have a ~500ms
//   delay that feels laggy. Click is instant.

'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface IndustryBadgeProps {
  primary: string | null | undefined
  industries: readonly string[]
  /** Smaller text variant for tight contexts */
  compact?: boolean
  /** Header label inside the popover. Defaults to "All industries". */
  popoverLabel?: string
  /** Tag rendered next to the primary item. Defaults to "primary". */
  primaryLabel?: string
}

export default function IndustryBadge({
  primary,
  industries,
  compact = false,
  popoverLabel = 'All industries',
  primaryLabel = 'primary',
}: IndustryBadgeProps) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)
  const badgeRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (popRef.current?.contains(e.target as Node)) return
      if (badgeRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!primary && (!industries || industries.length === 0)) {
    return <span className="text-tertiary text-xs">—</span>
  }

  const secondary = (industries || []).filter(i => i !== primary)
  const hasMore = secondary.length > 0

  function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (open) { setOpen(false); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    // Position popover below the badge, aligned to its right edge
    setAnchor({ top: rect.bottom + 4, left: rect.left })
    setOpen(true)
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className={compact ? 'text-xs' : 'text-sm'}>
        {primary || '(no primary)'}
      </span>
      {hasMore && (
        <button
          ref={badgeRef}
          type="button"
          onClick={toggle}
          className="inline-flex items-center justify-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 cursor-pointer transition"
          title={`Click to see all ${secondary.length + 1} industries`}
        >
          +{secondary.length}
        </button>
      )}
      {mounted && open && anchor && hasMore && createPortal(
        <div
          ref={popRef}
          style={{
            position: 'fixed',
            top: anchor.top,
            left: anchor.left,
            zIndex: 9999,
            minWidth: 220,
            maxWidth: 320,
            // Lifted color + thicker outline to clearly separate from the
            // table content underneath.
            backgroundColor: '#1f1f24',
            color: 'var(--fg-primary)',
            border: '1px solid #3a3a42',
            borderRadius: 8,
            boxShadow: '0 16px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset',
            backdropFilter: 'none',
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: '1px solid #2a2a32', backgroundColor: '#16161a' }}
          >
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--fg-tertiary)' }}>
              {popoverLabel}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false) }}
              className="text-sm leading-none"
              style={{ color: 'var(--fg-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="px-3 py-2 space-y-1 max-h-64 overflow-y-auto">
            <div className="text-sm" style={{ color: 'var(--fg-primary)' }}>
              <span style={{ fontWeight: 600 }}>{primary || '(none)'}</span>
              <span className="ml-2 text-[10px] uppercase" style={{ color: 'var(--fg-tertiary)' }}>{primaryLabel}</span>
            </div>
            {secondary.map(i => (
              <div key={i} className="text-sm" style={{ color: 'var(--fg-secondary)' }}>{i}</div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}
