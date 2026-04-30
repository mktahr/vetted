'use client'

// InfoTooltip — small ⓘ icon with a hover tooltip.
// Used inline next to filter labels in /admin/import.
// Hover-only (no click). Positioned absolutely so it doesn't push content.

import { useState, useRef, useEffect } from 'react'

interface Props {
  text: string
  /** Where to anchor the tooltip relative to the icon. Default: 'right' */
  placement?: 'right' | 'top' | 'bottom'
}

export default function InfoTooltip({ text, placement = 'right' }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLSpanElement | null>(null)

  // Close on scroll/click-outside so the tooltip never gets stuck if the
  // mouseleave doesn't fire (e.g., user scrolls the sidebar while hovering).
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('scroll', close, true)
    return () => document.removeEventListener('scroll', close, true)
  }, [open])

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 50,
    minWidth: 200,
    maxWidth: 280,
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
    pointerEvents: 'none',  // tooltip itself never blocks hover
    whiteSpace: 'normal',
  }

  if (placement === 'right') {
    tooltipStyle.left = 'calc(100% + 8px)'
    tooltipStyle.top = '50%'
    tooltipStyle.transform = 'translateY(-50%)'
  } else if (placement === 'top') {
    tooltipStyle.bottom = 'calc(100% + 6px)'
    tooltipStyle.left = '50%'
    tooltipStyle.transform = 'translateX(-50%)'
  } else {
    tooltipStyle.top = 'calc(100% + 6px)'
    tooltipStyle.left = '50%'
    tooltipStyle.transform = 'translateX(-50%)'
  }

  return (
    <span
      ref={containerRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        position: 'relative',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 14, height: 14, marginLeft: 4,
        borderRadius: '50%',
        border: '1px solid var(--border-default)',
        color: 'var(--fg-tertiary)',
        cursor: 'help',
        fontSize: 9, fontWeight: 600,
        lineHeight: 1,
        verticalAlign: 'middle',
        userSelect: 'none',
      }}
      aria-label={text}
    >
      i
      {open && <span style={tooltipStyle} role="tooltip">{text}</span>}
    </span>
  )
}
