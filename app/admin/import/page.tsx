'use client'

import { useState } from 'react'

interface FormState {
  company_name: string
  job_title: string
  location: string
  limit: number
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

const STATUS_STYLE: Record<EntryResult['status'], { icon: string; text: string }> = {
  success: { icon: '✓', text: 'text-emerald-600' },
  failed:  { icon: '✗', text: 'text-red-600' },
  skipped: { icon: '⊘', text: 'text-gray-400' },
}

export default function ImportPage() {
  const [form, setForm] = useState<FormState>({
    company_name: '',
    job_title: '',
    location: '',
    limit: 25,
  })
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [entries, setEntries] = useState<EntryResult[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasFilter = !!(form.company_name.trim() || form.job_title.trim() || form.location.trim())

  async function runImport() {
    if (!hasFilter || running) return

    setRunning(true)
    setEntries([])
    setSummary(null)
    setProgress(null)
    setError(null)

    try {
      const resp = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: form.company_name.trim() || undefined,
          job_title: form.job_title.trim() || undefined,
          location: form.location.trim() || undefined,
          limit: form.limit,
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
          try {
            handleEvent(JSON.parse(line))
          } catch {
            // ignore unparseable
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setRunning(false)
    }
  }

  function handleEvent(ev: Record<string, unknown>) {
    const type = ev.type as string
    if (type === 'start') {
      setProgress({ current: 0, total: ev.target as number })
    } else if (type === 'progress') {
      setProgress({ current: ev.current as number, total: ev.total as number })
      setEntries(prev => [...prev, {
        name: (ev.name as string) || '(unknown)',
        status: ev.status as EntryResult['status'],
        person_id: ev.person_id as string | undefined,
        error: (ev.error as string | undefined),
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
    setEntries([])
    setSummary(null)
    setProgress(null)
    setError(null)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <a href="/" className="text-sm text-blue-600 hover:text-blue-800">← Back to people</a>
      <h1 className="text-3xl font-bold mt-2 mb-1">Import from Crust Data</h1>
      <p className="text-gray-600 mb-6 text-sm">
        Any single field is a valid search. Results are deduplicated on linkedin_url
        by the ingest pipeline — re-running the same import will upsert existing people.
      </p>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-1">
              Company Name
            </label>
            <input
              id="company_name"
              type="text"
              value={form.company_name}
              onChange={e => setForm({ ...form, company_name: e.target.value })}
              placeholder="e.g. Stripe"
              disabled={running}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label htmlFor="job_title" className="block text-sm font-medium text-gray-700 mb-1">
              Job Title
            </label>
            <input
              id="job_title"
              type="text"
              value={form.job_title}
              onChange={e => setForm({ ...form, job_title: e.target.value })}
              placeholder="e.g. Senior Product Manager"
              disabled={running}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              id="location"
              type="text"
              value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. San Francisco"
              disabled={running}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label htmlFor="limit" className="block text-sm font-medium text-gray-700 mb-1">
              Number of Profiles
              <span className="text-xs text-gray-500 ml-1">(default 25, max 500)</span>
            </label>
            <input
              id="limit"
              type="number"
              min={1}
              max={500}
              value={form.limit}
              onChange={e => setForm({ ...form, limit: Math.min(500, Math.max(1, parseInt(e.target.value) || 25)) })}
              disabled={running}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            />
          </div>
        </div>

        <button
          onClick={runImport}
          disabled={running || !hasFilter}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? 'Importing…' : 'Import'}
        </button>
        {!hasFilter && !running && (
          <span className="ml-3 text-sm text-gray-500">Fill at least one field to import</span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 text-sm"><strong>Error:</strong> {error}</p>
        </div>
      )}

      {progress && !summary && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="font-medium text-blue-900 mb-2">
            Importing… {progress.current} of {progress.total} profiles
          </p>
          <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-200"
              style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {summary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
          <p className="font-semibold text-emerald-900">
            ✓ {summary.success} imported.
            {summary.failed > 0 && <span className="text-red-700"> {summary.failed} failed.</span>}
            {summary.skipped > 0 && <span className="text-gray-600"> {summary.skipped} skipped.</span>}
          </p>
          {summary.errors && summary.errors.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-red-800 font-medium">
                Error details ({summary.errors.length})
              </summary>
              <ul className="mt-2 list-disc pl-5 text-red-700 space-y-1">
                {summary.errors.map((e, i) => (
                  <li key={i}>
                    <span className="font-medium">{e.name || '(unknown)'}:</span>{' '}
                    {e.error || e.reason || 'unknown error'}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button
            onClick={reset}
            className="mt-4 text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Run another import
          </button>
        </div>
      )}

      {entries.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800">Per-profile results</h2>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
            {entries.map((e, i) => {
              const s = STATUS_STYLE[e.status]
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className={`${s.text} font-mono w-4`}>{s.icon}</span>
                  <span className="flex-1 truncate">{e.name}</span>
                  {e.error && (
                    <span className="text-xs text-red-600 truncate max-w-xs">{e.error}</span>
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
