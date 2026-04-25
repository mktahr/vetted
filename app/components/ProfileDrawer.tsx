'use client'

import { Person, CandidateBucket } from '../types'
import CompanyLogo, { guessDomain } from './CompanyLogo'

interface ProfileDrawerProps {
  person: Person | null
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

export default function ProfileDrawer({ person, isOpen, onClose, onPrev, onNext }: ProfileDrawerProps) {
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
                  style={{ color: 'var(--accent)', fontSize: 'var(--fs-13)', textDecoration: 'none' }}>
                  View LinkedIn Profile
                </a>
              </div>
            )}
          </div>
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
