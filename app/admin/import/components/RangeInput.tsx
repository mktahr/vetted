'use client'

interface Props {
  label: string
  min: string
  max: string
  onMinChange: (v: string) => void
  onMaxChange: (v: string) => void
  step?: number
  hint?: string
  unit?: string
}

export default function RangeInput(props: Props) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        title={props.hint}
        style={{
          display: 'block', marginBottom: 4,
          fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-medium)' as any,
          color: 'var(--fg-tertiary)', textTransform: 'uppercase',
          letterSpacing: 'var(--tr-eyebrow)', fontFamily: 'var(--font-sans)',
        }}
      >
        {props.label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number" min={0} step={props.step ?? 1}
          value={props.min}
          onChange={e => props.onMinChange(e.target.value)}
          placeholder="min"
          style={inputStyle}
        />
        <span style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)' }}>–</span>
        <input
          type="number" min={0} step={props.step ?? 1}
          value={props.max}
          onChange={e => props.onMaxChange(e.target.value)}
          placeholder="max"
          style={inputStyle}
        />
        {props.unit && (
          <span style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)' }}>{props.unit}</span>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px',
  border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-button)',
  background: 'var(--bg-surface)', color: 'var(--fg-primary)',
  fontSize: 'var(--fs-13)', fontFamily: 'var(--font-sans)', outline: 'none',
}
