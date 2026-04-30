'use client'

// /admin/import — Crust Import V1 filter builder.
//
// Sidebar with collapsible filter groups → top-of-page summary →
// volume control + credit estimate → preview sample / run full import.
// Uses NDJSON streaming for live progress on full import.

import { useMemo, useState } from 'react'
import AutocompleteSelect from './components/AutocompleteSelect'
import RangeInput from './components/RangeInput'
import CompanyMultiSelect from './components/CompanyMultiSelect'
import InfoTooltip from './components/InfoTooltip'
import {
  EMPTY_FILTERS,
  HEADCOUNT_RANGES,
  HARD_VOLUME_CAP,
  SOFT_VOLUME_WARNING,
  type UIFilterState,
} from '@/lib/crust/types'
import { summarizeFilters } from '@/lib/crust/build-filter'

// ─── Section wrapper ────────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)', padding: '12px 0' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semibold)' as any,
          color: 'var(--fg-primary)', textTransform: 'uppercase',
          letterSpacing: 'var(--tr-eyebrow)', fontFamily: 'var(--font-sans)',
          marginBottom: open ? 8 : 0,
        }}
      >
        <span>{title}</span>
        <span style={{ color: 'var(--fg-tertiary)' }}>{open ? '−' : '+'}</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

// ─── Sample row helpers ────────────────────────────────────────────────────
//
// Crust v2 /person/search response does NOT include `years_of_experience_raw`
// or `years_at_company_raw` — those are filter-only fields per the docs.
// We compute YOE and tenure locally from start_date fields that ARE returned.
// Same approach the existing crust-v2 mapper uses for years_experience.

function parseStartYear(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== 'string') return null
  const m = iso.match(/^(\d{4})-(\d{2})/)
  if (!m) return null
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  if (isNaN(y) || isNaN(mo)) return null
  return y + (mo - 1) / 12
}

function yearsBetween(startYearFractional: number | null, endYearFractional: number | null): number | null {
  if (startYearFractional === null) return null
  const end = endYearFractional ?? (new Date().getFullYear() + new Date().getMonth() / 12)
  const diff = end - startYearFractional
  return diff >= 0 ? Math.round(diff * 10) / 10 : null
}

function isInternshipTitle(title: string | undefined | null): boolean {
  if (!title) return false
  return /\bintern\b|\binternship\b|\bco-?op\b/i.test(title)
}

/**
 * Years of experience: span from earliest non-internship start_date to now.
 * Walks both current and past employers.
 */
function computeYOE(profile: any): number | null {
  const cur = profile?.experience?.employment_details?.current ?? []
  const past = profile?.experience?.employment_details?.past ?? []
  const all = [...cur, ...past] as Array<{ title?: string; start_date?: string }>
  let earliest: number | null = null
  for (const e of all) {
    if (isInternshipTitle(e.title)) continue
    const y = parseStartYear(e.start_date)
    if (y === null) continue
    if (earliest === null || y < earliest) earliest = y
  }
  return yearsBetween(earliest, null)
}

/**
 * Years at current company: prefer the is_default=true current role's
 * start_date. Fall back to current[0].start_date.
 */
function computeTenure(profile: any): number | null {
  const cur = profile?.experience?.employment_details?.current ?? []
  if (cur.length === 0) return null
  const primary = cur.find((c: any) => c?.is_default === true) ?? cur[0]
  const y = parseStartYear(primary?.start_date)
  return yearsBetween(y, null)
}

interface ProgressEvent {
  type: string
  current?: number
  total?: number
  name?: string
  status?: 'success' | 'failed' | 'skipped'
  message?: string
  excluded_count?: number
  processed?: number
  success?: number
  failed?: number
  skipped?: number
  total_count?: number | null
}

const CREDITS_PER_PROFILE = parseFloat(process.env.NEXT_PUBLIC_CRUST_CREDITS_PER_PROFILE || '0.03')
const USD_PER_CREDIT = parseFloat(process.env.NEXT_PUBLIC_CRUST_USD_PER_CREDIT || '0')
const DOLLAR_ESTIMATE_AVAILABLE = USD_PER_CREDIT > 0

export default function CrustImportPage() {
  const [ui, setUi] = useState<UIFilterState>(EMPTY_FILTERS)
  const [volume, setVolume] = useState<number>(100)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewTotalCount, setPreviewTotalCount] = useState<number | null>(null)
  const [previewExcluded, setPreviewExcluded] = useState<number | null>(null)
  const [previewProfiles, setPreviewProfiles] = useState<unknown[]>([])
  const [previewCursor, setPreviewCursor] = useState<string | null>(null)
  const [previewLoadingMore, setPreviewLoadingMore] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ProgressEvent[]>([])
  const [completion, setCompletion] = useState<ProgressEvent | null>(null)

  const summary = useMemo(() => summarizeFilters(ui), [ui])
  const submitDisabled = !ui.function_category.trim()

  function update<K extends keyof UIFilterState>(k: K, v: UIFilterState[K]) {
    setUi(prev => ({ ...prev, [k]: v }))
  }

  async function runPreview() {
    setPreviewLoading(true); setPreviewError(null)
    setPreviewProfiles([]); setPreviewTotalCount(null); setPreviewExcluded(null)
    setPreviewCursor(null)
    try {
      const resp = await fetch('/api/admin/crust-import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: ui, limit: 50 }),
      })
      const data = await resp.json()
      if (!resp.ok || data.error) {
        setPreviewError(data.error || `HTTP ${resp.status}`)
      } else {
        setPreviewTotalCount(data.total_count)
        setPreviewExcluded(data.excluded_count ?? 0)
        setPreviewProfiles(data.profiles || [])
        setPreviewCursor(data.next_cursor ?? null)
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function loadMorePreview() {
    if (!previewCursor || previewProfiles.length >= 100) return
    setPreviewLoadingMore(true); setPreviewError(null)
    try {
      const resp = await fetch('/api/admin/crust-import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: ui, limit: 50, cursor: previewCursor }),
      })
      const data = await resp.json()
      if (!resp.ok || data.error) {
        setPreviewError(data.error || `HTTP ${resp.status}`)
      } else {
        setPreviewProfiles(prev => [...prev, ...(data.profiles || [])])
        setPreviewCursor(data.next_cursor ?? null)
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setPreviewLoadingMore(false)
    }
  }

  async function runFullImport() {
    setRunning(true); setProgress([]); setCompletion(null); setConfirmOpen(false)
    try {
      const resp = await fetch('/api/admin/crust-import/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: ui, volume }),
      })
      if (!resp.ok || !resp.body) {
        const txt = await resp.text().catch(() => '')
        setProgress(p => [...p, { type: 'error', message: `HTTP ${resp.status}: ${txt.slice(0, 200)}` }])
        setRunning(false)
        return
      }
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const ev = JSON.parse(line) as ProgressEvent
            if (ev.type === 'complete') setCompletion(ev)
            else setProgress(p => [...p, ev])
          } catch {
            // skip malformed line
          }
        }
      }
    } catch (err) {
      setProgress(p => [...p, { type: 'error', message: err instanceof Error ? err.message : 'Network error' }])
    } finally {
      setRunning(false)
    }
  }

  const credits = Math.ceil(volume * CREDITS_PER_PROFILE)
  const dollars = DOLLAR_ESTIMATE_AVAILABLE ? (credits * USD_PER_CREDIT) : null

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: 'var(--bg-canvas)', color: 'var(--fg-primary)',
      fontFamily: 'var(--font-sans)',
    }}>
      <aside style={{
        width: 320, flexShrink: 0, padding: 16,
        borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
        overflowY: 'auto', maxHeight: '100vh',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 style={{ fontSize: 'var(--fs-15)', fontWeight: 'var(--fw-semibold)' as any }}>
            Crust Import V1
          </h1>
          <button
            onClick={() => setUi(EMPTY_FILTERS)}
            style={{
              padding: '4px 10px',
              background: 'transparent', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--r-button)', cursor: 'pointer',
              fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)',
            }}
          >Clear all</button>
        </div>

        <Section title="Where they work">
          <CompanyMultiSelect
            value={ui.companies}
            onChange={v => update('companies', v)}
          />
          <RangeInput
            label="Years at current company" unit="yrs" step={1}
            min={ui.years_at_current_min} max={ui.years_at_current_max}
            onMinChange={v => update('years_at_current_min', v)}
            onMaxChange={v => update('years_at_current_max', v)}
            hint="experience.employment_details.current.years_at_company_raw"
          />
          <div style={{ marginBottom: 12 }}>
            <label
              title="experience.employment_details.current.company_headcount_range"
              style={{ ...lblStyle, display: 'block', marginBottom: 4 }}
            >
              Company headcount
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {HEADCOUNT_RANGES.map(r => {
                const active = ui.headcount_ranges.includes(r)
                return (
                  <button
                    key={r}
                    onClick={() => update('headcount_ranges', active
                      ? ui.headcount_ranges.filter(x => x !== r)
                      : [...ui.headcount_ranges, r])}
                    style={{
                      padding: '3px 8px', fontSize: 'var(--fs-11)', fontFamily: 'var(--font-sans)',
                      border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-chip)',
                      background: active ? 'var(--accent-950)' : 'transparent',
                      color: active ? 'var(--accent-400)' : 'var(--fg-tertiary)',
                      cursor: 'pointer',
                    }}
                  >{r}</button>
                )
              })}
            </div>
          </div>
          <AutocompleteSelect
            fieldKey="industry" label="Company industries" multi={true}
            value={ui.industries}
            onChange={v => update('industries', v as string[])}
            hint="experience.employment_details.current.company_industries"
          />
        </Section>

        <Section title="Who they are">
          <AutocompleteSelect
            fieldKey="function_category"
            label="Function category" required multi={false}
            value={ui.function_category}
            onChange={v => update('function_category', v as string)}
            hint="experience.employment_details.current.function_category"
            placeholder="Engineering, Sales, Marketing, …"
            helperText="Crust uses broad function categories (e.g., Engineering, Sales, Operations). To narrow within a function — say, software engineers vs hardware engineers — pick the function here and add keywords in the Title field."
          />
          <AutocompleteSelect
            fieldKey="skill" label="Skills" multi={true}
            value={ui.skills}
            onChange={v => update('skills', v as string[])}
            hint="skills.professional_network_skills"
            helperText="LinkedIn skill tags. Use specific tools to infer specialty (e.g., Cadence/Synopsys → chip, ROS → robotics, Simulink → controls)."
          />
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <label
                title="experience.employment_details.current.title"
                style={lblStyle}
              >
                Title
              </label>
              <InfoTooltip text="Comma-separated keywords. Profiles whose current title matches any term are returned. Single term = single match." />
            </div>
            <input
              type="text" value={ui.title}
              onChange={e => update('title', e.target.value)}
              placeholder="embedded, firmware, RTOS"
              style={inputStyle}
            />
          </div>
          <AutocompleteSelect
            fieldKey="seniority_level"
            label="Seniority level" multi={true}
            value={ui.seniority_levels}
            onChange={v => update('seniority_levels', v as string[])}
            hint="experience.employment_details.current.seniority_level"
            helperText="Crust's seniority enum: Entry Level (early IC), Entry Level Manager (first-line manager), Senior (senior IC or manager), Director, Vice President, CXO, Owner / Partner, Strategic, In Training, Experienced Manager."
          />
          <RangeInput
            label="Years of experience" unit="yrs" step={1}
            min={ui.years_experience_min} max={ui.years_experience_max}
            onMinChange={v => update('years_experience_min', v)}
            onMaxChange={v => update('years_experience_max', v)}
            hint="years_of_experience_raw"
          />
        </Section>

        <Section title="Where they are">
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <label style={lblStyle}>Geo mode</label>
              <InfoTooltip text="region/state covers US states and international regions. For city-level search, use radius." />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['none', 'country', 'region', 'radius'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => update('geo_mode', mode)}
                  style={{
                    padding: '4px 10px', fontSize: 'var(--fs-11)', fontFamily: 'var(--font-sans)',
                    border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-chip)',
                    background: ui.geo_mode === mode ? 'var(--accent-950)' : 'transparent',
                    color: ui.geo_mode === mode ? 'var(--accent-400)' : 'var(--fg-tertiary)',
                    cursor: 'pointer',
                  }}
                >{mode === 'region' ? 'region/state' : mode}</button>
              ))}
            </div>
          </div>
          {ui.geo_mode === 'country' && (
            <AutocompleteSelect
              fieldKey="country" label="Countries" multi={true}
              value={ui.countries}
              onChange={v => update('countries', v as string[])}
              hint="basic_profile.location.country"
            />
          )}
          {ui.geo_mode === 'region' && (
            <AutocompleteSelect
              fieldKey="region" label="Region / state" multi={true}
              value={ui.regions}
              onChange={v => update('regions', v as string[])}
              hint="basic_profile.location.state"
            />
          )}
          {ui.geo_mode === 'radius' && (
            <>
              <AutocompleteSelect
                fieldKey="city" label="City" multi={false}
                value={ui.radius_city}
                onChange={v => update('radius_city', v as string)}
                hint="geo_distance + professional_network.location.raw"
              />
              <div style={{ marginBottom: 12 }}>
                <label style={lblStyle}>Radius (miles): {ui.radius_miles}</label>
                <input
                  type="range" min={5} max={200} step={5}
                  value={ui.radius_miles}
                  onChange={e => update('radius_miles', parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </>
          )}
        </Section>

        <Section title="Education" defaultOpen={false}>
          <AutocompleteSelect
            fieldKey="school" label="School" multi={true}
            value={ui.schools}
            onChange={v => update('schools', v as string[])}
            hint="education.schools.school"
          />
          <AutocompleteSelect
            fieldKey="degree" label="Degree" multi={true}
            value={ui.degrees}
            onChange={v => update('degrees', v as string[])}
            hint="education.schools.degree"
          />
          <AutocompleteSelect
            fieldKey="field_of_study" label="Field of study" multi={true}
            value={ui.fields_of_study}
            onChange={v => update('fields_of_study', v as string[])}
            hint="education.schools.field_of_study"
          />
        </Section>

        <Section title="Signals" defaultOpen={false}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-13)', cursor: 'pointer' }} title="recently_changed_jobs">
            <input
              type="checkbox" checked={ui.recently_changed_jobs}
              onChange={e => update('recently_changed_jobs', e.target.checked)}
              style={{ accentColor: 'var(--accent-500)' }}
            />
            <span>Recently changed jobs</span>
          </label>
        </Section>
      </aside>

      <main style={{ flex: 1, padding: 24, overflowY: 'auto', maxHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-semibold)' as any, marginBottom: 4 }}>
              Build a search
            </h2>
            <div style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-secondary)' }}>
              {summary}
            </div>
          </div>
          <a href="/" style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-secondary)', textDecoration: 'none' }}>← Back to candidates</a>
        </div>

        {submitDisabled && (
          <div style={{
            padding: 12, marginBottom: 16,
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--r-card)', fontSize: 'var(--fs-13)', color: 'var(--fg-secondary)',
          }}>
            Pick a function category to enable preview / import.
          </div>
        )}

        <div style={{
          padding: 16, marginBottom: 16,
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--r-card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={lblStyle}>Match estimate</div>
              <div style={{ fontSize: 'var(--fs-22)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                {previewTotalCount === null ? '—' : `≈ ${previewTotalCount.toLocaleString()}`}
              </div>
              <div style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)' }}>
                {previewExcluded !== null
                  ? `Excluding ${previewExcluded.toLocaleString()} already in DB`
                  : 'Run Preview to fetch'}
              </div>
            </div>

            <div>
              <div style={lblStyle}>Pull how many?</div>
              <input
                type="number" min={1} max={HARD_VOLUME_CAP} step={1}
                value={volume}
                onChange={e => setVolume(Math.max(1, Math.min(HARD_VOLUME_CAP, parseInt(e.target.value) || 1)))}
                style={{ ...inputStyle, width: 120 }}
              />
              <div style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)', marginTop: 2 }}>
                Hard cap {HARD_VOLUME_CAP.toLocaleString()}
              </div>
            </div>

            <div>
              <div style={lblStyle}>Estimate</div>
              <div style={{ fontSize: 'var(--fs-13)', fontFamily: 'var(--font-mono)' }}>
                ≈ {credits} credits{dollars !== null ? ` ≈ $${dollars.toFixed(2)}` : ''}
              </div>
              {!DOLLAR_ESTIMATE_AVAILABLE && (
                <div style={{ fontSize: 'var(--fs-10)', color: 'var(--fg-tertiary)', opacity: 0.6 }}>
                  Set NEXT_PUBLIC_CRUST_USD_PER_CREDIT for $ amount
                </div>
              )}
            </div>

            {volume >= SOFT_VOLUME_WARNING && (
              <div style={{
                padding: '6px 10px', borderRadius: 'var(--r-chip)',
                background: 'var(--tag-clay-bg)', border: '1px solid var(--tag-clay-border)',
                color: 'var(--tag-clay-text)', fontSize: 'var(--fs-12)',
              }}>
                Large import — review filters before running
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={runPreview}
              disabled={submitDisabled || previewLoading || running}
              style={{ ...buttonStyle, opacity: submitDisabled || previewLoading || running ? 0.5 : 1 }}
            >{previewLoading ? 'Loading…' : 'Preview Sample'}</button>

            <button
              onClick={() => setConfirmOpen(true)}
              disabled={submitDisabled || running}
              style={{ ...buttonStyle, background: 'var(--accent-500)', color: 'white', opacity: submitDisabled || running ? 0.5 : 1 }}
            >Run Full Import</button>
          </div>
        </div>

        {previewError && (
          <div style={{
            padding: 12, marginBottom: 16,
            background: 'var(--red-950)', border: '1px solid var(--red-800)',
            borderRadius: 'var(--r-card)', fontSize: 'var(--fs-13)', color: 'var(--red-400)',
          }}>{previewError}</div>
        )}

        {previewProfiles.length > 0 && (
          <div style={{
            padding: 16, marginBottom: 16,
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--r-card)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-semibold)' as any }}>
                Sample ({previewProfiles.length}{previewProfiles.length < 100 ? ' / 100 max' : ''})
              </h3>
              <span style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)' }}>
                Autocomplete + sample fetches are free per Crust pricing
              </span>
            </div>
            <div style={{ maxHeight: 'min(70vh, 720px)', minHeight: 480, overflowY: 'auto', borderTop: '1px solid var(--border-subtle)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-12)' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                    <th style={{ ...thStyle, width: 36, padding: '6px 4px' }} title="LinkedIn">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="var(--fg-tertiary)" style={{ display: 'inline-block', verticalAlign: 'middle' }}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    </th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Title</th>
                    <th style={thStyle}>Company</th>
                    <th style={thStyle}>Location</th>
                    <th style={thStyleRight} title="Years of experience (computed from earliest non-intern start_date)">YOE</th>
                    <th style={thStyleRight} title="Years at current company (computed from current role start_date)">Tenure</th>
                  </tr>
                </thead>
                <tbody>
                  {previewProfiles.map((p: any, i) => {
                    // Prefer is_default=true (the candidate's actual primary current
                    // role, per Crust). Falls back to current[0] when no flag is set.
                    // Mirrors the canonical mapper's selection at lib/ingest/mappers/crust-v2.ts:149
                    const currents = p.experience?.employment_details?.current ?? []
                    const cur = currents.find((c: any) => c?.is_default === true) ?? currents[0]
                    const yoe = computeYOE(p)
                    const tenure = computeTenure(p)
                    const linkedinUrl = p.social_handles?.professional_network_identifier?.profile_url
                      ?? p.social_handles?.professional_network?.profile_url
                      ?? null
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ ...tdStyle, textAlign: 'center', width: 36, padding: '6px 4px' }}>
                          {linkedinUrl ? (
                            <a
                              href={linkedinUrl} target="_blank" rel="noopener noreferrer"
                              style={{ color: 'var(--fg-tertiary)', textDecoration: 'none', display: 'inline-block' }}
                              title={linkedinUrl}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg-primary)')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-tertiary)')}
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                              </svg>
                            </a>
                          ) : <span style={{ opacity: 0.3 }}>—</span>}
                        </td>
                        <td style={tdStyle}>{p.basic_profile?.name || '—'}</td>
                        <td style={tdStyle}>{cur?.title || '—'}</td>
                        <td style={tdStyle}>{cur?.name || '—'}</td>
                        <td style={tdStyle}>{p.basic_profile?.location?.raw || '—'}</td>
                        <td style={tdStyleRight}>{typeof yoe === 'number' ? yoe.toFixed(1) : '—'}</td>
                        <td style={tdStyleRight}>{typeof tenure === 'number' ? tenure.toFixed(1) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {previewProfiles.length < 100 && previewCursor && (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={loadMorePreview}
                  disabled={previewLoadingMore}
                  style={{ ...buttonStyle, opacity: previewLoadingMore ? 0.5 : 1 }}
                  title="Free per Crust pricing — autocomplete + sample fetches do not consume credits"
                >
                  {previewLoadingMore ? 'Loading…' : `Load 50 more (free)`}
                </button>
              </div>
            )}
            {previewProfiles.length >= 100 && (
              <div style={{ marginTop: 12, fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)', textAlign: 'center' }}>
                Sample cap reached (100). Run the full import to ingest more.
              </div>
            )}
          </div>
        )}

        {(running || progress.length > 0 || completion) && (
          <div style={{
            padding: 16, marginBottom: 16,
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--r-card)',
          }}>
            <h3 style={{ fontSize: 'var(--fs-14)', marginBottom: 8, fontWeight: 'var(--fw-semibold)' as any }}>
              {running ? 'Running…' : completion ? 'Complete' : 'Progress'}
            </h3>
            {(() => {
              const last = progress[progress.length - 1]
              if (last?.current && last?.total) {
                return (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-secondary)' }}>
                      {last.current} / {last.total} processed
                    </div>
                    <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2, marginTop: 4 }}>
                      <div style={{
                        width: `${(last.current / last.total) * 100}%`, height: '100%',
                        background: 'var(--accent-500)', borderRadius: 2, transition: 'width 100ms',
                      }} />
                    </div>
                  </div>
                )
              }
              return null
            })()}
            {completion && (
              <div style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-primary)', marginBottom: 8 }}>
                ✓ {completion.success} new · {completion.skipped} skipped · {completion.failed} failed
                {completion.total_count !== null && completion.total_count !== undefined && (
                  <span style={{ color: 'var(--fg-tertiary)' }}> · Crust reported {completion.total_count.toLocaleString()} total matches</span>
                )}
              </div>
            )}
            <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 'var(--fs-11)', fontFamily: 'var(--font-mono)' }}>
              {progress.slice(-50).map((ev, i) => (
                <div key={i} style={{ color: ev.status === 'failed' ? 'var(--red-400)' : ev.type === 'error' ? 'var(--red-400)' : 'var(--fg-tertiary)' }}>
                  {ev.type === 'progress'
                    ? `[${ev.current}] ${ev.status} · ${ev.name || '?'}${ev.status === 'failed' ? ` — ${(ev as any).error || ''}` : ''}`
                    : ev.type === 'info' || ev.type === 'error' || ev.type === 'start'
                    ? `[${ev.type}] ${ev.message || JSON.stringify(ev).slice(0, 200)}`
                    : ''}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {confirmOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--r-card)', padding: 24, maxWidth: 480, width: '90%',
          }}>
            <h3 style={{ fontSize: 'var(--fs-15)', fontWeight: 'var(--fw-semibold)' as any, marginBottom: 12 }}>
              Confirm import
            </h3>
            <div style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-secondary)', marginBottom: 12 }}>
              {summary}
            </div>
            <div style={{ fontSize: 'var(--fs-13)', marginBottom: 16 }}>
              Pulling up to <strong>{volume.toLocaleString()}</strong> profiles
              · ≈ <strong>{credits} credits</strong>
              {dollars !== null && <> · ≈ <strong>${dollars.toFixed(2)}</strong></>}
            </div>
            {volume >= SOFT_VOLUME_WARNING && (
              <div style={{
                padding: 8, marginBottom: 16,
                background: 'var(--tag-clay-bg)', border: '1px solid var(--tag-clay-border)',
                color: 'var(--tag-clay-text)', fontSize: 'var(--fs-12)', borderRadius: 'var(--r-chip)',
              }}>
                Large import ({volume.toLocaleString()}). Confirm intent before running.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmOpen(false)} style={buttonStyle}>Cancel</button>
              <button onClick={runFullImport} style={{ ...buttonStyle, background: 'var(--accent-500)', color: 'white' }}>
                Run import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const lblStyle: React.CSSProperties = {
  fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-medium)' as any,
  color: 'var(--fg-tertiary)', textTransform: 'uppercase',
  letterSpacing: 'var(--tr-eyebrow)', fontFamily: 'var(--font-sans)',
}
const hintStyle: React.CSSProperties = {
  fontSize: 'var(--fs-10)', color: 'var(--fg-tertiary)', opacity: 0.6, fontFamily: 'var(--font-mono)',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px',
  border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-button)',
  background: 'var(--bg-surface)', color: 'var(--fg-primary)',
  fontSize: 'var(--fs-13)', fontFamily: 'var(--font-sans)', outline: 'none',
}
const buttonStyle: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 'var(--r-button)', cursor: 'pointer',
  border: '1px solid var(--border-default)', background: 'var(--bg-surface)',
  color: 'var(--fg-primary)', fontSize: 'var(--fs-13)', fontFamily: 'var(--font-sans)',
  fontWeight: 'var(--fw-medium)' as any,
}
const thStyle: React.CSSProperties = {
  padding: '6px 8px', textAlign: 'left', fontSize: 'var(--fs-11)',
  textTransform: 'uppercase', letterSpacing: 'var(--tr-eyebrow)',
  color: 'var(--fg-tertiary)', whiteSpace: 'nowrap',
}
const thStyleRight: React.CSSProperties = { ...thStyle, textAlign: 'right' }
const tdStyle: React.CSSProperties = {
  padding: '6px 8px', whiteSpace: 'nowrap',
  overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240,
}
const tdStyleRight: React.CSSProperties = {
  ...tdStyle, textAlign: 'right',
  fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
}
