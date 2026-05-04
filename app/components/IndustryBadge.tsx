// app/components/IndustryBadge.tsx
//
// V1 multi-industry display component. Shows the primary industry as the
// main label and a "+N" badge when there are additional industries in the
// industries[] array. Hover/click reveals the full list as a tooltip.
//
// SCOPE per inventory: industry display only. Do NOT generalize to other
// multi-value fields (domain_tags, etc.) yet — V1 lock.

'use client'

import { useState, useRef } from 'react'

interface IndustryBadgeProps {
  primary: string | null | undefined
  industries: readonly string[]
  /** Optional: a small visual variant for compact contexts */
  compact?: boolean
}

export default function IndustryBadge({ primary, industries, compact = false }: IndustryBadgeProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  if (!primary && (!industries || industries.length === 0)) {
    return <span className="text-tertiary text-xs">—</span>
  }

  // Secondary industries = everything in industries[] except primary.
  const secondary = (industries || []).filter(i => i !== primary)
  const hasMore = secondary.length > 0

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center gap-1"
      onMouseEnter={() => hasMore && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className={compact ? 'text-xs' : 'text-sm'}>
        {primary || '(no primary)'}
      </span>
      {hasMore && (
        <span
          className="inline-flex items-center justify-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground cursor-help"
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
          title={`+${secondary.length} more: ${secondary.join(', ')}`}
        >
          +{secondary.length}
        </span>
      )}
      {open && hasMore && (
        <span
          className="absolute z-10 left-0 top-full mt-1 px-2 py-1 rounded bg-popover text-popover-foreground text-xs shadow-md border border-border whitespace-nowrap"
          style={{ minWidth: 160 }}
        >
          <div className="font-medium mb-1">All industries:</div>
          <div className="text-muted-foreground">{primary} <span className="text-tertiary">(primary)</span></div>
          {secondary.map(i => (
            <div key={i} className="text-muted-foreground">{i}</div>
          ))}
        </span>
      )}
    </span>
  )
}
