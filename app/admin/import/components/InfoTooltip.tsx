'use client'

// InfoTooltip — small Info icon with a hover tooltip.
// Used inline next to filter labels in /admin/import.
//
// - Hover-only (no click)
// - Tooltip rendered via React portal to document.body so it escapes the
//   sidebar's overflow clipping. Position is computed from the icon's
//   bounding rect on each open.
// - Collision detection: if the tooltip would clip the right edge of the
//   viewport, it flips to the left side of the icon.

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  text: string
}

const TOOLTIP_WIDTH = 240
const TOOLTIP_GAP = 8
const VIEWPORT_PAD = 8

export default function InfoTooltip({ text }: Props) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; placement: 'left' | 'right' }>({
    top: 0, left: 0, placement: 'right',
  })
  const [mounted, setMounted] = useState(false)
  const iconRef = useRef<HTMLSpanElement | null>(null)

  // Avoid SSR hydration mismatch — portals can only mount on the client
  useEffect(() => { setMounted(true) }, [])

  // Compute tooltip position from icon bounding rect each time it opens.
  // useLayoutEffect prevents a one-frame flicker where tooltip renders at
  // (0,0) before the rect is read.
  useLayoutEffect(() => {
    if (!open || !iconRef.current) return
    const rect = iconRef.current.getBoundingClientRect()
    const verticalCenter = rect.top + rect.height / 2

    // Try right placement first
    const rightLeft = rect.right + TOOLTIP_GAP
    const wouldClipRight = rightLeft + TOOLTIP_WIDTH + VIEWPORT_PAD > window.innerWidth

    if (wouldClipRight) {
      // Flip to left
      const leftLeft = rect.left - TOOLTIP_GAP - TOOLTIP_WIDTH
      setCoords({ top: verticalCenter, left: Math.max(VIEWPORT_PAD, leftLeft), placement: 'left' })
    } else {
      setCoords({ top: verticalCenter, left: rightLeft, placement: 'right' })
    }
  }, [open])

  // Close on scroll/resize so the tooltip doesn't drift away from its anchor
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <span
        ref={iconRef}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginLeft: 6,
          color: 'var(--fg-tertiary)',
          cursor: 'help',
          verticalAlign: 'middle',
          lineHeight: 0,
        }}
        aria-label={text}
      >
        <svg
          viewBox="0 0 24 24" width="14" height="14"
          fill="none" stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </span>
      {mounted && open && createPortal(
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: 'translateY(-50%)',
            width: TOOLTIP_WIDTH,
            padding: '8px 10px',
            background: 'var(--bg-canvas)',
            color: 'var(--fg-primary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--r-card)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            fontSize: 'var(--fs-12)',
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.45,
            fontWeight: 'normal',
            textTransform: 'none',
            letterSpacing: 'normal',
            pointerEvents: 'none',
            whiteSpace: 'normal',
            zIndex: 1000,
          }}
        >
          {text}
        </div>,
        document.body,
      )}
    </>
  )
}
