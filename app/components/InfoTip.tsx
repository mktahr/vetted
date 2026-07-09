'use client'

// InfoTip — instant custom hover tooltip for ⓘ provenance markers.
// Replaces native `title` attributes (slow hover delay, help cursor, invisible
// on touch — Matt's 2026-07-08 preview note, BUGS.md). Rendered through a
// portal with fixed positioning so scroll containers (ProfileDrawer) and
// sticky-header stacking contexts can't clip it — same reasoning as the
// AddToListMenu / GlobalNav portals. Click toggles for touch devices.

import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

export default function InfoTip({ text }: { text: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLSpanElement>(null)

  const show = useCallback(() => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ x: r.left + r.width / 2, y: r.top })
  }, [])
  const hide = useCallback(() => setPos(null), [])

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={hide}
      onClick={e => { e.stopPropagation(); pos ? hide() : show() }}
      style={{ cursor: 'pointer', display: 'inline-block', fontStyle: 'normal' }}
      aria-label={text}
    >
      ⓘ
      {pos && createPortal(
        <span
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y - 8,
            transform: 'translate(-50%, -100%)',
            background: 'var(--bg-surface-raised)',
            color: 'var(--fg-primary)',
            border: '1px solid var(--border-default)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            lineHeight: 1.45,
            maxWidth: 300,
            zIndex: 9999,
            pointerEvents: 'none',
            fontFamily: 'var(--font-sans)',
            fontStyle: 'normal',
            fontWeight: 'normal',
            textTransform: 'none',
            letterSpacing: 'normal',
            whiteSpace: 'normal',
            textAlign: 'left',
            boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
          }}
        >
          {text}
        </span>,
        document.body
      )}
    </span>
  )
}
