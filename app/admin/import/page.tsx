'use client'

import { useState } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FormState {
  company_name: string
  location: string
  seniority_level: string
  function_category: string
}

interface SampleRow {
  name: string
  current_title: string | null
  current_company: string | null
  location: string | null
  seniority_level: string | null
  years_at_company: number | null
  linkedin_url: string | null
}

interface PreviewResult {
  total_count: number | null
  sample_count: number
  samples: SampleRow[]
}

interface EntryResult {
  name: string
  status: 'success' | 'failed' | 'skipped'
  person_id?: string
  error?: string
}

interface Summary {
  processed: number
  success: number
  failed: number
  skipped: number
  errors: Array<{ name?: string; error?: string; reason?: string }>
}

type Phase = 'search' | 'previewing' | 'preview' | 'importing' | 'done'

const STATUS_STYLE: Record<EntryResult['status'], { icon: string; text: string }> = {
  success: { icon: '✓', text: 'text-positive' },
  failed:  { icon: '✗', text: 'text-destructive' },
  skipped: { icon: '⊘', text: 'text-tertiary' },
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [form, setForm] = useState<FormState>({
    company_name: '',
    location: '',
    seniority_level: '',
    function_category: '',
  })
  const [phase, setPhase] = useState<Phase>('search')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [progress, setProgress] = useState<{ current: number; total: number | null } | null>(null)
  const [entries, setEntries] = useState<EntryResult[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasFilter = !!(
    form.company_name.trim() ||
    form.location.trim() ||
    form.seniority_level.trim() ||
    form.function_category.trim()
  )
  const busy = phase === 'previewing' || phase === 'importing'

  // ── Step 1: Preview ─────────────────────────────────────────────────────

  async function runPreview() {
    if (!hasFilter || busy) return
    setPhase('previewing')
    setPreview(null)
    setError(null)
    setEntries([])
    setSummary(null)

    try {
      const resp = await fetch('/api/admin/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: form.company_name.trim() || undefined,
          location: form.location.trim() || undefined,
          seniority_level: form.seniority_level.trim() || undefined,
          function_category: form.function_category.trim() || undefined,
        }),
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }))
        throw new Error(data.error || `HTTP ${resp.status}`)
      }

      const data: PreviewResult = await resp.json()
      setPreview(data)
      setPhase('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setPhase('search')
    }
  }

  // ── Step 2: Full import ─────────────────────────────────────────────────

  async function runFullImport() {
    if (busy) return
    setPhase('importing')
    setEntries([])
    setSummary(null)
    setError(null)
    setProgress({ current: 0, total: preview?.total_count ?? null })

    try {
      const resp = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: form.company_name.trim() || undefined,
          location: form.location.trim() || undefined,
          seniority_level: form.seniority_level.trim() || undefined,
          function_category: form.function_category.trim() || undefined,
          total_count: preview?.total_count ?? undefined,
        }),
      })

      if (!resp.ok || !resp.body) {
        const text = await resp.text()
        throw new Error(`HTTP ${resp.status}: ${text.slice(0, 300)}`)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          try { handleEvent(JSON.parse(line)) } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setPhase('done')
    }
  }

  function handleEvent(ev: Record<string, unknown>) {
    const type = ev.type as string
    if (type === 'start') {
      setProgress({ current: 0, total: (ev.estimated_total as number | null) ?? null })
    } else if (type === 'progress') {
      setProgress({ current: ev.current as number, total: (ev.total as number | null) ?? null })
      setEntries(prev => [...prev, {
        name: (ev.name as string) || '(unknown)',
        status: ev.status as EntryResult['status'],
        person_id: ev.person_id as string | undefined,
        error: ev.error as string | undefined,
      }])
    } else if (type === 'complete') {
      setSummary({
        processed: ev.processed as number,
        success: ev.success as number,
        failed: ev.failed as number,
        skipped: ev.skipped as number,
        errors: (ev.errors as Summary['errors']) || [],
      })
    } else if (type === 'error') {
      setError(ev.message as string)
    }
  }

  function reset() {
    setPhase('search')
    setPreview(null)
    setEntries([])
    setSummary(null)
    setProgress(null)
    setError(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', background: 'var(--bg-canvas)', color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>
      <a href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to people</a>
      <h1 className="text-3xl font-bold mt-2 mb-1">Import from Crust Data</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Search for candidates, preview a sample, then confirm to import all results.
        Existing profiles in the database are automatically excluded.
      </p>

      {/* ── Search form ──────────────────────────────────────────────── */}
      <div className="bg-card rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="company_name" className="block text-sm font-medium text-muted-foreground mb-1">
              Company Name
            </label>
            <input
              id="company_name"
              type="text"
              value={form.company_name}
              onChange={e => setForm({ ...form, company_name: e.target.value })}
              placeholder="e.g. Stripe"
              disabled={busy}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-background"
            />
          </div>
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-muted-foreground mb-1">
              Location
            </label>
            <input
              id="location"
              type="text"
              value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. United States, California"
              disabled={busy}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-background"
            />
          </div>
          <div>
            <label htmlFor="seniority_level" className="block text-sm font-medium text-muted-foreground mb-1">
              Seniority Level
            </label>
            <input
              id="seniority_level"
              type="text"
              value={form.seniority_level}
              onChange={e => setForm({ ...form, seniority_level: e.target.value })}
              placeholder="e.g. Senior, Director, VP"
              disabled={busy}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-background"
            />
          </div>
          <div>
            <label htmlFor="function_category" className="block text-sm font-medium text-muted-foreground mb-1">
              Function Category
            </label>
            <input
              id="function_category"
              type="text"
              value={form.function_category}
              onChange={e => setForm({ ...form, function_category: e.target.value })}
              placeholder="e.g. Engineering, Product, Sales"
              disabled={busy}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-background"
            />
          </div>
        </div>

        <button
          onClick={runPreview}
          disabled={busy || !hasFilter}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-strong disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {phase === 'previewing' ? 'Searching…' : 'Search'}
        </button>
        {!hasFilter && !busy && (
          <span className="ml-3 text-sm text-tertiary">Fill at least one field to search</span>
        )}
      </div>

      {/* ── Error ────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6">
          <p className="text-destructive text-sm"><strong>Error:</strong> {error}</p>
        </div>
      )}

      {/* ── Preview table ────────────────────────────────────────────── */}
      {preview && phase === 'preview' && (
        <div className="bg-card rounded-lg shadow mb-6">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground">
                Sample preview
                {preview.total_count !== null && (
                  <span className="ml-2 text-sm font-normal text-tertiary">
                    ({preview.total_count.toLocaleString()} total matches)
                  </span>
                )}
              </h2>
              <p className="text-xs text-tertiary mt-0.5">
                Showing {preview.sample_count} of {preview.total_count?.toLocaleString() ?? '?'} results
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-background"
              >
                Cancel
              </button>
              <button
                onClick={runFullImport}
                className="px-3 py-1.5 text-sm bg-positive text-white rounded-lg hover:bg-positive"
              >
                Import all {preview.total_count?.toLocaleString() ?? ''} results
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background text-left text-xs text-tertiary uppercase tracking-wider">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2">Company</th>
                  <th className="px-4 py-2">Location</th>
                  <th className="px-4 py-2">Seniority</th>
                  <th className="px-4 py-2 text-right">Yrs at Co.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.samples.map((row, i) => (
                  <tr key={i} className="hover:bg-background">
                    <td className="px-4 py-2 font-medium text-foreground whitespace-nowrap">
                      {row.linkedin_url ? (
                        <a href={row.linkedin_url} target="_blank" rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground hover:underline">
                          {row.name}
                        </a>
                      ) : row.name}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate">{row.current_title ?? '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{row.current_company ?? '—'}</td>
                    <td className="px-4 py-2 text-tertiary whitespace-nowrap">{row.location ?? '—'}</td>
                    <td className="px-4 py-2 text-tertiary whitespace-nowrap">{row.seniority_level ?? '—'}</td>
                    <td className="px-4 py-2 text-tertiary text-right">{row.years_at_company ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Import progress ──────────────────────────────────────────── */}
      {phase === 'importing' && progress && (
        <div className="bg-selected border border-border rounded-lg p-4 mb-6">
          <p className="font-medium text-foreground mb-2">
            Importing… {progress.current}
            {progress.total !== null ? ` of ~${progress.total.toLocaleString()}` : ''} profiles
          </p>
          {progress.total !== null && progress.total > 0 && (
            <div className="w-full bg-primary/20 rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-200"
                style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Summary ──────────────────────────────────────────────────── */}
      {summary && (
        <div className="bg-positive/10 border border-positive/30 rounded-lg p-4 mb-6">
          <p className="font-semibold text-positive">
            Import complete: {summary.success} imported
            {summary.failed > 0 && <span className="text-destructive">, {summary.failed} failed</span>}
            {summary.skipped > 0 && <span className="text-muted-foreground">, {summary.skipped} skipped</span>}
          </p>
          {summary.errors.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-destructive font-medium">
                Error details ({summary.errors.length})
              </summary>
              <ul className="mt-2 list-disc pl-5 text-destructive space-y-1">
                {summary.errors.map((e, i) => (
                  <li key={i}>
                    <span className="font-medium">{e.name || '(unknown)'}:</span>{' '}
                    {e.error || e.reason || 'unknown error'}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button onClick={reset} className="mt-4 text-sm text-muted-foreground hover:text-foreground underline">
            Run another import
          </button>
        </div>
      )}

      {/* ── Per-profile results ──────────────────────────────────────── */}
      {entries.length > 0 && (
        <div className="bg-card rounded-lg shadow">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground">Per-profile results</h2>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {entries.map((e, i) => {
              const s = STATUS_STYLE[e.status]
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className={`${s.text} font-mono w-4`}>{s.icon}</span>
                  <span className="flex-1 truncate">{e.name}</span>
                  {e.error && (
                    <span className="text-xs text-destructive truncate max-w-xs">{e.error}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
