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
    try {
      const resp = await fetch('/api/admin/crust-import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: ui }),
      })
      const data = await resp.json()
      if (!resp.ok || data.error) {
        setPreviewError(data.error || `HTTP ${resp.status}`)
      } else {
        setPreviewTotalCount(data.total_count)
        setPreviewExcluded(data.excluded_count ?? 0)
        setPreviewProfiles(data.profiles || [])
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setPreviewLoading(false)
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
        <h1 style={{ fontSize: 'var(--fs-15)', marginBottom: 16, fontWeight: 'var(--fw-semibold)' as any }}>
          Crust Import V1
        </h1>

        <Section title="Who they are">
          <AutocompleteSelect
            fieldKey="function_category"
            label="Function category" required multi={false}
            value={ui.function_category}
            onChange={v => update('function_category', v as string)}
            hint="experience.employment_details.current.function_category"
            placeholder="Engineering, Sales, Marketing, …"
          />
          <AutocompleteSelect
            fieldKey="seniority_level"
            label="Seniority level" multi={true}
            value={ui.seniority_levels}
            onChange={v => update('seniority_levels', v as string[])}
            hint="experience.employment_details.current.seniority_level"
          />
          <RangeInput
            label="Years of experience" unit="yrs" step={1}
            min={ui.years_experience_min} max={ui.years_experience_max}
            onMinChange={v => update('years_experience_min', v)}
            onMaxChange={v => update('years_experience_max', v)}
            hint="years_of_experience_raw"
          />
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <label style={lblStyle}>Title</label>
              <span style={hintStyle}>experience.employment_details.current.title</span>
            </div>
            <input
              type="text" value={ui.title}
              onChange={e => update('title', e.target.value)}
              placeholder="VP, Director, Engineer…"
              style={inputStyle}
            />
          </div>
        </Section>

        <Section title="Where they are">
          <div style={{ marginBottom: 8 }}>
            <label style={lblStyle}>Geo mode</label>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
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
                >{mode}</button>
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
              fieldKey="region" label="Regions / states" multi={true}
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

        <Section title="Where they work">
          <CompanyMultiSelect
            value={ui.companies}
            onChange={v => update('companies', v)}
          />
          <AutocompleteSelect
            fieldKey="industry" label="Company industries" multi={true}
            value={ui.industries}
            onChange={v => update('industries', v as string[])}
            hint="experience.employment_details.current.company_industries"
          />
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <label style={lblStyle}>Headcount range</label>
              <span style={hintStyle}>company_headcount_range</span>
            </div>
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
          <RangeInput
            label="Years at current company" unit="yrs" step={1}
            min={ui.years_at_current_min} max={ui.years_at_current_max}
            onMinChange={v => update('years_at_current_min', v)}
            onMaxChange={v => update('years_at_current_max', v)}
            hint="experience.employment_details.current.years_at_company_raw"
          />
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-13)', cursor: 'pointer' }}>
            <input
              type="checkbox" checked={ui.recently_changed_jobs}
              onChange={e => update('recently_changed_jobs', e.target.checked)}
              style={{ accentColor: 'var(--accent-500)' }}
            />
            <span>Recently changed jobs</span>
            <span style={{ ...hintStyle, marginLeft: 'auto' }}>recently_changed_jobs</span>
          </label>
        </Section>

        <button
          onClick={() => setUi(EMPTY_FILTERS)}
          style={{
            marginTop: 16, padding: '6px 12px', width: '100%',
            background: 'transparent', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--r-button)', cursor: 'pointer',
            fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)',
          }}
        >Clear all filters</button>
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
            <h3 style={{ fontSize: 'var(--fs-14)', marginBottom: 8, fontWeight: 'var(--fw-semibold)' as any }}>
              Sample ({previewProfiles.length})
            </h3>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-12)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Title</th>
                    <th style={thStyle}>Company</th>
                    <th style={thStyle}>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {previewProfiles.map((p: any, i) => {
                    const cur = p.experience?.employment_details?.current?.[0]
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={tdStyle}>{p.basic_profile?.name || '—'}</td>
                        <td style={tdStyle}>{cur?.title || '—'}</td>
                        <td style={tdStyle}>{cur?.name || '—'}</td>
                        <td style={tdStyle}>{p.basic_profile?.location?.raw || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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
const tdStyle: React.CSSProperties = {
  padding: '6px 8px', whiteSpace: 'nowrap',
  overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240,
}
