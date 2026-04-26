'use client'

import { Person, CandidateBucket } from '../types'
import CompanyLogo, { guessDomain } from './CompanyLogo'

export interface DrawerExperience {
  company_id: string | null
  company_name: string | null
  title_raw: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  employment_type: string | null
}

export interface DrawerSignal {
  signal_id: string
  canonical_name: string
  category: string
  canonical_url: string | null
  evidence_url: string | null
  source_text: string | null
  source: string
  confidence: number
}

interface ProfileDrawerProps {
  person: Person | null
  experiences: DrawerExperience[]
  signals: DrawerSignal[]
  isOpen: boolean
  onClose: () => void
  onPrev: (() => void) | null
  onNext: (() => void) | null
}

function cleanCompanyName(name: string | null | undefined): string | null {
  if (!name) return null
  return name.split('·')[0].split('•')[0].trim() || null
}

const BUCKET_TAG: Record<CandidateBucket, { label: string; bg: string; border: string; text: string }> = {
  vetted_talent:    { label: 'Vetted Talent',    bg: 'var(--tag-sage-bg)',  border: 'var(--tag-sage-border)',  text: 'var(--tag-sage-text)' },
  high_potential:   { label: 'High Potential',   bg: 'var(--tag-steel-bg)', border: 'var(--tag-steel-border)', text: 'var(--tag-steel-text)' },
  silver_medalist:  { label: 'Silver Medalist',  bg: 'var(--tag-slate-bg)', border: 'var(--tag-slate-border)', text: 'var(--tag-slate-text)' },
  non_vetted:       { label: 'Non-Vetted',       bg: 'var(--tag-sand-bg)',  border: 'var(--tag-sand-border)',  text: 'var(--tag-sand-text)' },
  needs_review:     { label: 'Needs Review',     bg: 'var(--tag-clay-bg)',  border: 'var(--tag-clay-border)',  text: 'var(--tag-clay-text)' },
}

const navBtn: React.CSSProperties = {
  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 'var(--r-button)', color: 'var(--fg-tertiary)', cursor: 'pointer',
  background: 'none', border: 'none', fontSize: 18,
}

function formatDateRange(start: string | null, end: string | null, isCurrent: boolean): string {
  const fmt = (d: string) => {
    const [y, m] = d.split('-')
    if (!m) return y
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${months[parseInt(m, 10) - 1]} ${y}`
  }
  const s = start ? fmt(start) : '?'
  const e = isCurrent ? 'Present' : end ? fmt(end) : '?'
  return `${s} – ${e}`
}

function computeDuration(start: string | null, end: string | null, isCurrent: boolean): string | null {
  if (!start) return null
  const s = new Date(start)
  const e = isCurrent ? new Date() : end ? new Date(end) : null
  if (!e) return null
  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  if (months < 0) months = 0
  const yrs = Math.floor(months / 12)
  const mos = months % 12
  if (yrs === 0) return `${mos} mo`
  if (mos === 0) return `${yrs} yr`
  return `${yrs} yr ${mos} mo`
}

// Category display order for signals section
const SIGNAL_CATEGORY_ORDER = [
  'founder', 'military', 'fellowship', 'scholarship', 'academic_distinction',
  'competition', 'hackathon', 'athletics', 'engineering_team',
  'student_leadership', 'greek_life',
]

const SIGNAL_CATEGORY_LABELS: Record<string, string> = {
  founder: 'Founder',
  military: 'Military',
  fellowship: 'Fellowship',
  scholarship: 'Scholarship',
  academic_distinction: 'Academic',
  competition: 'Competition',
  hackathon: 'Hackathon',
  athletics: 'Athletics',
  engineering_team: 'Engineering Team',
  student_leadership: 'Leadership',
  greek_life: 'Greek Life',
}

export default function ProfileDrawer({ person, experiences, signals, isOpen, onClose, onPrev, onNext }: ProfileDrawerProps) {
  if (!isOpen || !person) return null

  const companyName = cleanCompanyName(person.current_company_name)
  const displayTitle = (person.current_title_normalized || person.current_title_raw || '')
    .split(/\s*[|–—]\s*/)[0].split(/,\s*/)[0] || 'N/A'

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', zIndex: 40 }} onClick={onClose} />

      <div style={{
        position: 'fixed', right: 0, top: 0, height: '100%', width: '100%', maxWidth: 420,
        background: 'var(--bg-surface)', boxShadow: 'var(--shadow-float)',
        borderLeft: '1px solid var(--border-subtle)', zIndex: 50, overflowY: 'auto',
        fontFamily: 'var(--font-sans)',
      }}>
        <div style={{ padding: 20 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-semibold)', color: 'var(--fg-primary)', letterSpacing: '-0.01em' }}>{person.full_name}</h2>
              {person.latest_bucket && (() => {
                const s = BUCKET_TAG[person.latest_bucket]
                return <span style={{ display: 'inline-block', marginTop: 8, padding: '2px 10px', borderRadius: 'var(--r-chip)', fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-medium)', background: s.bg, border: `1px solid ${s.border}`, color: s.text }}>{s.label}</span>
              })()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button onClick={onPrev ?? undefined} disabled={!onPrev} style={{ ...navBtn, opacity: onPrev ? 1 : 0.3, cursor: onPrev ? 'pointer' : 'not-allowed' }} title="Previous">‹</button>
              <button onClick={onNext ?? undefined} disabled={!onNext} style={{ ...navBtn, opacity: onNext ? 1 : 0.3, cursor: onNext ? 'pointer' : 'not-allowed' }} title="Next">›</button>
              <button onClick={onClose} style={{ ...navBtn, fontSize: 22 }}>×</button>
            </div>
          </div>

          {/* Score */}
          {person.latest_bucket_reason && (
            <div style={{ marginBottom: 16, padding: 8, background: 'var(--bg-surface-raised)', borderRadius: 'var(--r-button)', border: '1px solid var(--border-subtle)', fontSize: 'var(--fs-12)', fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)' }}>
              {person.latest_bucket_reason}
            </div>
          )}

          {/* Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(person.current_title_raw || companyName) && (
              <Field label="Current role">
                <div style={{ color: 'var(--fg-primary)', fontWeight: 'var(--fw-medium)' }}>{displayTitle}</div>
                {companyName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <CompanyLogo domain={guessDomain(companyName)} companyName={companyName} size={20} />
                    <span style={{ color: 'var(--fg-secondary)' }}>{companyName}</span>
                  </div>
                )}
              </Field>
            )}

            {person.primary_specialty && (
              <Field label="Specialty">
                <span style={{ padding: '2px 8px', background: 'var(--tag-mist-bg)', color: 'var(--tag-mist-text)', border: '1px solid var(--tag-mist-border)', borderRadius: 'var(--r-chip)', fontSize: 'var(--fs-12)' }}>
                  {person.primary_specialty.replace(/_/g, ' ')}
                </span>
              </Field>
            )}

            {person.location_name && <Field label="Location"><span style={{ color: 'var(--fg-primary)' }}>{person.location_name}</span></Field>}

            {person.years_experience_estimate != null && (
              <Field label="Experience">
                <span style={{ color: 'var(--fg-primary)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{person.years_experience_estimate}</span> years
                  {person.career_stage_assigned && (
                    <span style={{ marginLeft: 8, padding: '1px 8px', background: 'var(--bg-surface-raised)', color: 'var(--fg-tertiary)', borderRadius: 'var(--r-full)', fontSize: 'var(--fs-12)', border: '1px solid var(--border-subtle)' }}>
                      {person.career_stage_assigned.replace(/_/g, ' ')}
                    </span>
                  )}
                </span>
              </Field>
            )}

            {person.current_function_normalized && (
              <Field label="Function"><span style={{ color: 'var(--fg-primary)' }}>{person.current_function_normalized.replace(/_/g, ' ')}</span></Field>
            )}

            {person.headline_raw && (
              <Field label="Headline"><span style={{ color: 'var(--fg-secondary)', fontSize: 'var(--fs-13)' }}>{person.headline_raw}</span></Field>
            )}

            {person.linkedin_url && (
              <div>
                <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--fg-secondary)', fontSize: 'var(--fs-13)', textDecoration: 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--fg-primary)'; e.currentTarget.style.textDecoration = 'underline' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-secondary)'; e.currentTarget.style.textDecoration = 'none' }}>
                  View LinkedIn Profile
                </a>
              </div>
            )}
          </div>

          {/* Signals */}
          {signals.length > 0 && (() => {
            const MAX_DISPLAY = 10
            const displayed = signals.slice(0, MAX_DISPLAY)
            const overflow = signals.length - MAX_DISPLAY

            // Group by category in display order
            const grouped: Array<{ category: string; label: string; items: DrawerSignal[] }> = []
            for (const cat of SIGNAL_CATEGORY_ORDER) {
              const items = displayed.filter(s => s.category === cat)
              if (items.length > 0) {
                grouped.push({ category: cat, label: SIGNAL_CATEGORY_LABELS[cat] || cat.replace(/_/g, ' '), items })
              }
            }
            // Catch any categories not in the order list
            const coveredCats = new Set(SIGNAL_CATEGORY_ORDER)
            const uncovered = displayed.filter(s => !coveredCats.has(s.category))
            if (uncovered.length > 0) {
              const byCat: Record<string, DrawerSignal[]> = {}
              for (const s of uncovered) { if (!byCat[s.category]) byCat[s.category] = []; byCat[s.category].push(s) }
              for (const [cat, items] of Object.entries(byCat)) {
                grouped.push({ category: cat, label: cat.replace(/_/g, ' '), items })
              }
            }

            return (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-medium)', color: 'var(--fg-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--tr-eyebrow)', marginBottom: 12, fontFamily: 'var(--font-sans)' }}>Signals</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {grouped.map(group => (
                    <div key={group.category}>
                      <div style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>{group.label}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {group.items.map(sig => {
                          const isCatchall = sig.canonical_name.endsWith('(generic)')
                          const displayName = isCatchall ? sig.canonical_name.replace(/\s*\(generic\)$/, '') : sig.canonical_name
                          const url = sig.evidence_url || sig.canonical_url
                          const tooltip = `${sig.category.replace(/_/g, ' ')} · ${sig.source.replace(/_/g, ' ')}${sig.source_text ? ` · "${sig.source_text}"` : ''}`

                          const chipStyle: React.CSSProperties = isCatchall
                            ? { padding: '1px 7px', fontSize: 'var(--fs-11)', background: 'var(--bg-surface-raised)', color: 'var(--fg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-chip)', fontFamily: 'var(--font-sans)', cursor: url ? 'pointer' : 'default', textDecoration: 'none', lineHeight: '1.5' }
                            : { padding: '1px 7px', fontSize: 'var(--fs-12)', background: 'var(--tag-mist-bg)', color: 'var(--tag-mist-text)', border: '1px solid var(--tag-mist-border)', borderRadius: 'var(--r-chip)', fontFamily: 'var(--font-sans)', cursor: url ? 'pointer' : 'default', textDecoration: 'none', lineHeight: '1.5' }

                          if (url) {
                            return (
                              <a key={sig.signal_id} href={url} target="_blank" rel="noopener noreferrer" title={tooltip} style={chipStyle}>
                                {displayName}
                              </a>
                            )
                          }
                          return <span key={sig.signal_id} title={tooltip} style={chipStyle}>{displayName}</span>
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {overflow > 0 && (
                  <div style={{ marginTop: 6, fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)' }}>
                    +{overflow} more
                  </div>
                )}
              </div>
            )
          })()}

          {/* Work History */}
          {(() => {
            // All experiences in chronological order (most recent first)
            const allRoles = experiences
              .slice()
              .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
            if (allRoles.length === 0) return null
            return (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-medium)', color: 'var(--fg-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--tr-eyebrow)', marginBottom: 12, fontFamily: 'var(--font-sans)' }}>Work History</div>
                <div style={{ position: 'relative', paddingLeft: 20 }}>
                  {/* Timeline line */}
                  <div style={{ position: 'absolute', left: 4, top: 6, bottom: 6, width: 1, background: 'var(--border-subtle)' }} />
                  {allRoles.map((exp, i) => {
                    const title = (exp.title_raw || 'Untitled Role').split(/\s*[|–—]\s*/)[0].split(/,\s*/)[0]
                    const company = cleanCompanyName(exp.company_name)
                    const dateRange = formatDateRange(exp.start_date, exp.end_date, exp.is_current)
                    const duration = computeDuration(exp.start_date, exp.end_date, exp.is_current)
                    return (
                      <div key={i} style={{ position: 'relative', marginBottom: i < allRoles.length - 1 ? 16 : 0 }}>
                        {/* Timeline dot */}
                        <div style={{ position: 'absolute', left: -20, top: 6, width: 9, height: 9, borderRadius: 'var(--r-full)', border: '2px solid var(--border-default)', background: 'var(--bg-surface)' }} />
                        <div style={{ color: 'var(--fg-primary)', fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-medium)', fontFamily: 'var(--font-sans)' }}>{title}</div>
                        {company && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <CompanyLogo domain={guessDomain(company)} companyName={company} size={16} />
                            <span style={{ color: 'var(--fg-secondary)', fontSize: 'var(--fs-13)' }}>{company}</span>
                          </div>
                        )}
                        <div style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)', marginTop: 2, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                          {dateRange}{duration ? ` · ${duration}` : ''}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-medium)', color: 'var(--fg-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--tr-eyebrow)', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>{label}</div>
      <div style={{ fontSize: 'var(--fs-14)', fontFamily: 'var(--font-sans)' }}>{children}</div>
    </div>
  )
}
