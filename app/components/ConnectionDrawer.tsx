'use client'

// app/components/ConnectionDrawer.tsx
//
// PR 2 (2a) — row-click detail drawer for a network connection. Mirrors the
// ProfileDrawer overlay/nav conventions but renders connection-specific data:
// the warm-path owners, classification, and the cached Crust enrichment.
//
// NOTE: the cached /person/enrich blob is a CURRENT-SNAPSHOT (basic_profile only
// — no employment history / education). This drawer surfaces exactly what we
// have; full-history axes arrive only with richer enrichment (PR 2b decision).

export interface ConnectionOwner {
  employee_id: string
  full_name: string | null
  is_active: boolean
  connected_on: string | null
}

export interface ConnectionDetail {
  connection: {
    connection_id: string
    full_name: string | null
    current_company: string | null
    current_title: string | null
    title_bucket: 'yes' | 'maybe' | 'no'
    title_bucket_source: string | null
    specialty_normalized: string | null
    function_scope: string | null
    status: string
    company_score: number | null
    company_score_year: number | null
    enriched: boolean
    last_enriched_at: string | null
    connected_on: string | null
    canonical_url: string
    raw_url: string | null
    llm_triage_guess: string | null
    llm_triage_reason: string | null
  }
  enriched: {
    headline: string | null
    location_name: string | null
    current_title: string | null
    display_name: string | null
    last_enriched_at: string | null
    enriched_profile: any
  } | null
  owners: ConnectionOwner[]
}

interface ConnectionDrawerProps {
  detail: ConnectionDetail | null
  loading: boolean
  isOpen: boolean
  onClose: () => void
  onPrev: (() => void) | null
  onNext: (() => void) | null
}

const BUCKET_TAG: Record<string, { label: string; c: string }> = {
  yes: { label: 'YES', c: '#1e7e45' },
  maybe: { label: 'MAYBE', c: 'var(--accent-600)' },
  no: { label: 'NO', c: 'var(--fg-tertiary)' },
}

const navBtn: React.CSSProperties = {
  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 'var(--r-button)', color: 'var(--fg-tertiary)', cursor: 'pointer',
  background: 'none', border: 'none', fontSize: 18,
}
const sectionLabel: React.CSSProperties = {
  fontSize: 'var(--fs-11)', textTransform: 'uppercase', letterSpacing: '0.04em',
  color: 'var(--fg-tertiary)', fontWeight: 700, marginBottom: 8,
}
const metaKey: React.CSSProperties = { fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)' }
const metaVal: React.CSSProperties = { fontSize: 'var(--fs-13)', color: 'var(--fg-primary)', fontWeight: 600 }

function scoreColor(n: number): string {
  if (n >= 5) return '#1e7e45'
  if (n >= 4) return '#3a9d5d'
  if (n >= 3) return '#b8860b'
  if (n >= 2) return 'var(--fg-tertiary)'
  return 'var(--fg-disabled)'
}

export default function ConnectionDrawer({ detail, loading, isOpen, onClose, onPrev, onNext }: ConnectionDrawerProps) {
  if (!isOpen) return null

  const c = detail?.connection
  const e = detail?.enriched
  const bp = e?.enriched_profile?.basic_profile ?? null
  const summary: string | null = bp?.summary ?? null
  const languages: string[] = Array.isArray(bp?.languages) ? bp.languages : []
  const profilePic: string | null = bp?.profile_picture_permalink ?? null
  const bucket = c ? BUCKET_TAG[c.title_bucket] : null

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60 }}
      />
      {/* Panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(520px, 92vw)', zIndex: 61,
          background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-subtle)',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.18)', overflowY: 'auto', padding: '18px 20px',
        }}
      >
        {/* Header row: nav + close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={{ ...navBtn, opacity: onPrev ? 1 : 0.3, cursor: onPrev ? 'pointer' : 'default' }} disabled={!onPrev} onClick={onPrev ?? undefined} aria-label="Previous">↑</button>
            <button style={{ ...navBtn, opacity: onNext ? 1 : 0.3, cursor: onNext ? 'pointer' : 'default' }} disabled={!onNext} onClick={onNext ?? undefined} aria-label="Next">↓</button>
          </div>
          <button style={navBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {loading || !c ? (
          <div style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--fs-13)' }}>Loading…</div>
        ) : (
          <>
            {/* Identity */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
              {profilePic && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profilePic} alt="" width={48} height={48} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {c.raw_url ? (
                    <a href={c.raw_url} target="_blank" rel="noreferrer" style={{ fontSize: 'var(--fs-18)', fontWeight: 700, color: 'var(--fg-primary)', textDecoration: 'none' }}>{c.full_name || '—'}</a>
                  ) : (
                    <span style={{ fontSize: 'var(--fs-18)', fontWeight: 700, color: 'var(--fg-primary)' }}>{c.full_name || '—'}</span>
                  )}
                  {bucket && (
                    <span style={{ fontSize: 'var(--fs-11)', fontWeight: 700, color: bucket.c, border: `1px solid ${bucket.c}`, borderRadius: 10, padding: '1px 8px' }}>{bucket.label}</span>
                  )}
                  {c.status === 'excluded' && (
                    <span style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)' }}>excluded</span>
                  )}
                </div>
                <div style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-secondary)', marginTop: 2 }}>
                  {(e?.headline || c.current_title || '—')}
                </div>
                <div style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)', marginTop: 2 }}>
                  {[c.current_company, e?.location_name].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
            </div>

            {/* Warm path / owners */}
            <div style={{ marginBottom: 18 }}>
              <div style={sectionLabel}>Warm path (via)</div>
              {detail!.owners.length === 0 ? (
                <div style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-tertiary)' }}>—</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {detail!.owners.map((o) => (
                    <span key={o.employee_id} style={{ fontSize: 'var(--fs-12)', color: o.is_active ? 'var(--fg-primary)' : 'var(--fg-tertiary)', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '2px 10px', textDecoration: o.is_active ? 'none' : 'line-through' }}>
                      {o.full_name || 'Unknown'}{!o.is_active && ' (disconnected)'}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Classification */}
            <div style={{ marginBottom: 18 }}>
              <div style={sectionLabel}>Classification</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 6, columnGap: 12 }}>
                <span style={metaKey}>Specialty</span><span style={metaVal}>{c.specialty_normalized || '—'}</span>
                <span style={metaKey}>Scope</span><span style={metaVal}>{c.function_scope || '—'}</span>
                <span style={metaKey}>Bucket source</span><span style={metaVal}>{c.title_bucket_source || '—'}</span>
                <span style={metaKey}>Company</span>
                <span style={metaVal}>
                  {c.current_company || '—'}
                  {c.company_score != null && (
                    <span style={{ marginLeft: 8, display: 'inline-block', minWidth: 22, textAlign: 'center', padding: '1px 6px', borderRadius: 10, fontSize: 'var(--fs-12)', fontWeight: 700, color: '#fff', background: scoreColor(c.company_score) }}>{c.company_score}</span>
                  )}
                </span>
              </div>
              {c.llm_triage_guess && (
                <div style={{ marginTop: 8, fontSize: 'var(--fs-12)', color: 'var(--fg-secondary)' }}>
                  <strong style={{ color: c.llm_triage_guess === 'probably_yes' ? '#1e7e45' : c.llm_triage_guess === 'probably_no' ? 'var(--accent-600)' : 'var(--fg-tertiary)' }}>LLM: {c.llm_triage_guess.replace('probably_', 'probably ').replace('_', ' ')}</strong>
                  {c.llm_triage_reason ? ` — ${c.llm_triage_reason}` : ''}
                </div>
              )}
            </div>

            {/* Enrichment */}
            <div style={{ marginBottom: 18 }}>
              <div style={sectionLabel}>Enrichment {c.enriched ? '' : '(not enriched)'}</div>
              {!c.enriched || !e ? (
                <div style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-tertiary)' }}>Not enriched yet — run enrichment from the connections toolbar.</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 6, columnGap: 12 }}>
                    <span style={metaKey}>Title</span><span style={metaVal}>{e.current_title || c.current_title || '—'}</span>
                    <span style={metaKey}>Location</span><span style={metaVal}>{e.location_name || '—'}</span>
                    {languages.length > 0 && (<><span style={metaKey}>Languages</span><span style={metaVal}>{languages.join(', ')}</span></>)}
                    <span style={metaKey}>Enriched</span><span style={metaVal}>{e.last_enriched_at ? new Date(e.last_enriched_at).toLocaleDateString() : '—'}</span>
                  </div>
                  {summary && (
                    <div style={{ marginTop: 10 }}>
                      <div style={metaKey}>Summary</div>
                      <p style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-secondary)', lineHeight: 1.5, marginTop: 4, whiteSpace: 'pre-wrap' }}>{summary}</p>
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)' }}>
                    Current snapshot only — no work history / education in this enrichment tier.
                  </div>
                </>
              )}
            </div>

            {/* Footer meta */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)' }}>
              {c.connected_on && <div>Connected: {new Date(c.connected_on).toLocaleDateString()}</div>}
              {c.raw_url && <a href={c.raw_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-600)', textDecoration: 'none' }}>Open LinkedIn ↗</a>}
            </div>
          </>
        )}
      </div>
    </>
  )
}
