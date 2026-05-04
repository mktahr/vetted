'use client'

// /admin/import/companies
//
// V1 Phase 1 ships the SINGLE-import workflow. Bulk import is stubbed (TBD).
//
// Single workflow:
//   1. Admin enters a company name, paste a LinkedIn URL, or paste a domain
//   2. Click "Find" → POST /identify → matches list (with disambiguators)
//   3. Admin picks the canonical match + target review_status
//   4. Click "Import" → POST /single → enrich + tag + write
//   5. Result panel shows tagger output + link to detail page

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/app/components/ThemeToggle'

type InputMode = 'name' | 'linkedin_url' | 'domain'

interface IdentifyMatch {
  crustdata_company_id: number
  name: string | null
  primary_domain: string | null
  professional_network_url: string | null
  professional_network_id: string | null
  employee_count_range: string | null
  year_founded: string | null
  industries: string[]
  logo_permalink: string | null
  description: string | null
  confidence_score: number | null
  existing: { company_id: string; review_status: string } | null
}

interface ImportResult {
  company_id: string
  created: boolean
  already_imported?: boolean
  race_resolved?: boolean
  existing?: any
  tagger?: {
    category: string | null
    primary_industry: string | null
    industries: string[]
    domain_tags: string[]
    confidence: number
    method: string
    agreement: string
    reasoning: string
  }
  basic_info?: any
}

export default function CompaniesImportPage() {
  const router = useRouter()

  // Input state
  const [mode, setMode] = useState<InputMode>('name')
  const [input, setInput] = useState('')
  const [autocompleteOpen, setAutocompleteOpen] = useState(false)
  const [autocompleteResults, setAutocompleteResults] = useState<string[]>([])
  const [autocompleteLoading, setAutocompleteLoading] = useState(false)
  const acTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Identify state
  const [identifyLoading, setIdentifyLoading] = useState(false)
  const [identifyError, setIdentifyError] = useState<string | null>(null)
  const [matches, setMatches] = useState<IdentifyMatch[]>([])
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null)
  const [targetReviewStatus, setTargetReviewStatus] = useState<'vetted' | 'unreviewed'>('unreviewed')

  // Import state
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  // Auto-detect mode from input
  useEffect(() => {
    if (input.includes('linkedin.com/company/')) {
      if (mode !== 'linkedin_url') setMode('linkedin_url')
    }
  }, [input, mode])

  // Autocomplete (name mode only)
  useEffect(() => {
    if (mode !== 'name' || !autocompleteOpen || input.trim().length < 2) {
      setAutocompleteResults([])
      return
    }
    if (acTimer.current) clearTimeout(acTimer.current)
    acTimer.current = setTimeout(async () => {
      setAutocompleteLoading(true)
      try {
        const resp = await fetch('/api/admin/companies-import/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: 'basic_info.name', query: input.trim(), limit: 8 }),
        })
        const data = await resp.json()
        setAutocompleteResults(Array.isArray(data?.suggestions) ? data.suggestions.map((s: any) => s.value) : [])
      } catch {
        setAutocompleteResults([])
      } finally {
        setAutocompleteLoading(false)
      }
    }, 300)
    return () => { if (acTimer.current) clearTimeout(acTimer.current) }
  }, [input, mode, autocompleteOpen])

  async function findMatches() {
    if (!input.trim()) return
    setIdentifyLoading(true)
    setIdentifyError(null)
    setMatches([])
    setSelectedMatchId(null)
    setImportResult(null)
    setImportError(null)
    setAutocompleteOpen(false)
    try {
      const reqBody: Record<string, any> = {}
      if (mode === 'name')         reqBody.name = input.trim()
      else if (mode === 'linkedin_url') reqBody.linkedin_url = input.trim()
      else if (mode === 'domain')  reqBody.domain = input.trim()

      const resp = await fetch('/api/admin/companies-import/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      })
      const data = await resp.json()
      if (!resp.ok || data.error) {
        setIdentifyError(data.error || `HTTP ${resp.status}`)
      } else {
        setMatches(data.matches || [])
        if ((data.matches || []).length === 0) setIdentifyError('No matches found.')
      }
    } catch (err: any) {
      setIdentifyError(err?.message || 'Network error')
    } finally {
      setIdentifyLoading(false)
    }
  }

  async function importSelected() {
    if (selectedMatchId == null) return
    setImportLoading(true)
    setImportError(null)
    setImportResult(null)
    try {
      const resp = await fetch('/api/admin/companies-import/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crustdata_company_id: selectedMatchId,
          target_review_status: targetReviewStatus,
        }),
      })
      const data = await resp.json()
      if (!resp.ok || data.error) {
        setImportError(data.error || `HTTP ${resp.status}`)
      } else {
        setImportResult(data)
      }
    } catch (err: any) {
      setImportError(err?.message || 'Network error')
    } finally {
      setImportLoading(false)
    }
  }

  function reset() {
    setInput('')
    setMatches([])
    setSelectedMatchId(null)
    setImportResult(null)
    setImportError(null)
    setIdentifyError(null)
    setAutocompleteResults([])
  }

  const selectedMatch = matches.find(m => m.crustdata_company_id === selectedMatchId) || null

  return (
    <div style={{ padding: 24, background: 'var(--bg-canvas)', color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <a href="/admin/companies" className="text-sm text-muted-foreground hover:text-foreground">← Back to companies</a>
          <h1 className="text-3xl font-bold mt-2">Import companies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Find a canonical Crust entity and pull it into the database with auto-tagging.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Left column — single import */}
        <section className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-lg font-semibold mb-1">Single import</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Enter a company name, paste a LinkedIn URL, or paste a domain. We&apos;ll show
            the canonical Crust matches; pick the right one and we&apos;ll enrich + tag.
          </p>

          {/* Mode selector */}
          <div className="flex items-center gap-2 mb-3">
            {(['name', 'linkedin_url', 'domain'] as InputMode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setMatches([]); setSelectedMatchId(null); setIdentifyError(null) }}
                className={`px-3 py-1 text-xs rounded border ${mode === m ? 'bg-primary text-white border-primary' : 'border-border bg-background hover:bg-card'}`}
              >
                {m === 'name' ? 'Name' : m === 'linkedin_url' ? 'LinkedIn URL' : 'Domain'}
              </button>
            ))}
          </div>

          {/* Input + autocomplete */}
          <div className="relative mb-3">
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setAutocompleteOpen(mode === 'name') }}
              onFocus={() => mode === 'name' && setAutocompleteOpen(true)}
              onBlur={() => setTimeout(() => setAutocompleteOpen(false), 150)}
              onKeyDown={(e) => { if (e.key === 'Enter') findMatches() }}
              placeholder={
                mode === 'name' ? 'e.g. Anduril' :
                mode === 'linkedin_url' ? 'https://www.linkedin.com/company/anduril' :
                'e.g. anduril.com'
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {mode === 'name' && autocompleteOpen && input.trim().length >= 2 && (
              <div className="absolute z-10 left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto bg-card border border-border rounded-lg shadow-lg">
                {autocompleteLoading && <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>}
                {!autocompleteLoading && autocompleteResults.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No suggestions</div>
                )}
                {autocompleteResults.map(name => (
                  <button
                    key={name}
                    onMouseDown={(e) => { e.preventDefault(); setInput(name); setAutocompleteOpen(false) }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-background"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={findMatches}
              disabled={identifyLoading || !input.trim()}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-strong disabled:opacity-50 text-sm"
            >
              {identifyLoading ? 'Searching…' : 'Find'}
            </button>
            {(matches.length > 0 || importResult) && (
              <button
                onClick={reset}
                className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-background"
              >
                Reset
              </button>
            )}
          </div>

          {identifyError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm">
              {identifyError}
            </div>
          )}

          {/* Match list */}
          {matches.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-xs text-muted-foreground">
                {matches.length} match{matches.length === 1 ? '' : 'es'}. Pick the canonical entity.
              </p>
              {matches.map(m => {
                const isSelected = selectedMatchId === m.crustdata_company_id
                return (
                  <button
                    key={m.crustdata_company_id}
                    onClick={() => setSelectedMatchId(m.crustdata_company_id)}
                    className={`w-full text-left p-3 rounded-lg border transition ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{m.name || '(unnamed)'}</span>
                          {m.confidence_score != null && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-secondary rounded">conf {m.confidence_score.toFixed(2)}</span>
                          )}
                          {m.existing && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded" title={`Already imported as ${m.existing.review_status}`}>
                              imported · {m.existing.review_status}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {[m.primary_domain, m.employee_count_range, m.year_founded].filter(Boolean).join(' · ') || '—'}
                        </div>
                        {m.professional_network_url && (
                          <div className="text-xs text-muted-foreground truncate">{m.professional_network_url}</div>
                        )}
                        {m.industries.length > 0 && (
                          <div className="text-[11px] text-tertiary mt-1 line-clamp-1">{m.industries.join(', ')}</div>
                        )}
                      </div>
                      {m.logo_permalink && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.logo_permalink} alt="" width={32} height={32} className="rounded flex-shrink-0" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Import button + review status select */}
          {selectedMatch && !selectedMatch.existing && !importResult && (
            <div className="mt-4 p-3 bg-background border border-border rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <label className="text-xs font-medium text-muted-foreground">Save as:</label>
                <select
                  value={targetReviewStatus}
                  onChange={(e) => setTargetReviewStatus(e.target.value as 'vetted' | 'unreviewed')}
                  className="px-2 py-1 text-xs border border-border rounded bg-card"
                >
                  <option value="unreviewed">Unreviewed</option>
                  <option value="vetted">Vetted</option>
                </select>
              </div>
              <button
                onClick={importSelected}
                disabled={importLoading}
                className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-strong disabled:opacity-50 text-sm font-medium"
              >
                {importLoading ? 'Importing… (enrich + tag)' : `Import "${selectedMatch.name}" (2 Crust credits + ~$0.005 tagger)`}
              </button>
            </div>
          )}

          {selectedMatch?.existing && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <p className="text-amber-900">This company is already imported.</p>
              <button
                onClick={() => router.push(`/admin/companies/${selectedMatch.existing!.company_id}`)}
                className="mt-2 text-xs underline text-amber-900"
              >
                Open in admin →
              </button>
            </div>
          )}

          {importError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm">
              {importError}
            </div>
          )}

          {importResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">
                {importResult.already_imported ? 'Already imported' : '✓ Imported'}
              </h3>
              {importResult.tagger && (
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">Category:</span> <span className="font-medium">{importResult.tagger.category || '(unclassified)'}</span></div>
                  <div><span className="text-muted-foreground">Primary industry:</span> <span className="font-medium">{importResult.tagger.primary_industry || '—'}</span></div>
                  {importResult.tagger.industries.length > 0 && (
                    <div><span className="text-muted-foreground">Industries:</span> {importResult.tagger.industries.join(', ')}</div>
                  )}
                  {importResult.tagger.domain_tags.length > 0 && (
                    <div><span className="text-muted-foreground">Domain tags:</span> {importResult.tagger.domain_tags.join(', ')}</div>
                  )}
                  <div className="text-xs text-muted-foreground pt-1">
                    Method: <code>{importResult.tagger.method}</code> · Confidence: {importResult.tagger.confidence.toFixed(2)} · Agreement: {importResult.tagger.agreement}
                  </div>
                  {importResult.tagger.reasoning && (
                    <details className="text-xs mt-2">
                      <summary className="cursor-pointer text-muted-foreground">Reasoning</summary>
                      <pre className="mt-1 p-2 bg-card rounded text-[11px] whitespace-pre-wrap">{importResult.tagger.reasoning}</pre>
                    </details>
                  )}
                </div>
              )}
              <button
                onClick={() => router.push(`/admin/companies/${importResult.company_id}`)}
                className="mt-3 text-sm underline text-green-900"
              >
                Open in admin →
              </button>
            </div>
          )}
        </section>

        {/* Right column — bulk import (placeholder) */}
        <section className="bg-card border border-border rounded-lg p-5 opacity-60">
          <h2 className="text-lg font-semibold mb-1">Bulk import</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Filter-builder driven bulk pull from <code>/company/search</code>. Coming
            in a follow-up. For now, use single-import for the curated golden list.
          </p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Will support: industry / headcount / geo filters, preview-then-confirm,
              streaming progress, dedup by crustdata_company_id.</p>
            <p>Throttled to 15 req/min per Crust default + bounded by daily Anthropic spend cap.</p>
          </div>
          <button
            disabled
            className="mt-4 px-4 py-2 text-sm border border-border rounded-lg bg-background opacity-50 cursor-not-allowed"
          >
            Coming soon
          </button>
        </section>

      </div>
    </div>
  )
}
