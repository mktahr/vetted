// app/components/IndustryBadge.tsx
//
// V1 multi-industry display component. Shows the primary industry as the
// main label and a "+N" badge when there are additional industries.
//
// IMPLEMENTATION NOTE: a previous version used a custom React-rendered
// dropdown on hover. That had stacking-context issues when rendered inside
// table cells (the dropdown got clipped) and felt sluggish due to hover
// state churn. Replaced with a native `title` attribute — instant browser
// tooltip, no clipping, no JS overhead.

'use client'

interface IndustryBadgeProps {
  primary: string | null | undefined
  industries: readonly string[]
  /** Optional: a small visual variant for compact contexts */
  compact?: boolean
}

export default function IndustryBadge({ primary, industries, compact = false }: IndustryBadgeProps) {
  if (!primary && (!industries || industries.length === 0)) {
    return <span className="text-tertiary text-xs">—</span>
  }

  const secondary = (industries || []).filter(i => i !== primary)
  const hasMore = secondary.length > 0

  // Tooltip text shown by the browser natively. Lists primary + secondary
  // industries, one per line.
  const tooltip = hasMore
    ? `All industries:\n${primary || '(none)'} (primary)\n${secondary.join('\n')}`
    : undefined

  return (
    <span
      className="inline-flex items-center gap-1"
      title={tooltip}
    >
      <span className={compact ? 'text-xs' : 'text-sm'}>
        {primary || '(no primary)'}
      </span>
      {hasMore && (
        <span className="inline-flex items-center justify-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
          +{secondary.length}
        </span>
      )}
    </span>
  )
}
