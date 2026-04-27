'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Company, CompanyBucket, CompanyStatus, CompanyFocus, CompanyYearScore, CompanyFunctionScore } from '@/app/types'
import CompanyLogo, { guessDomain } from '@/app/components/CompanyLogo'
import { COMPANY_FUNCTIONS } from '@/app/constants'
import ThemeToggle from '@/app/components/ThemeToggle'

const BUCKET_OPTIONS: Array<{ value: CompanyBucket; label: string }> = [
  { value: 'static_mature',    label: 'Static Mature' },
  { value: 'high_bar_tech',    label: 'High Bar Tech' },
  { value: 'growth_startup',   label: 'Growth Startup' },
  { value: 'emerging_startup', label: 'Emerging Startup' },
]

const STATUS_OPTIONS: Array<{ value: CompanyStatus; label: string }> = [
  { value: 'active',    label: 'Active' },
  { value: 'acquired',  label: 'Acquired' },
  { value: 'public',    label: 'Public' },
  { value: 'shut_down', label: 'Shut Down' },
]

const FOCUS_OPTIONS: Array<{ value: CompanyFocus; label: string }> = [
  { value: 'hard_tech',  label: 'Hard Tech' },
  { value: 'all_tech',   label: 'All Tech' },
  { value: 'unreviewed', label: 'Unreviewed' },
]

// Default focus filter shows reviewed companies only (hard_tech + all_tech).
// Use 'all' to include unreviewed in the view.
type FocusFilter = '' | 'hard_tech' | 'all_tech' | 'unreviewed' | 'all'

type SortBy = 'name_asc' | 'name_desc' | 'year_score' | 'function_score'

export default function CompaniesListPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [yearScoresAll, setYearScoresAll] = useState<CompanyYearScore[]>([])
  const [functionScoresAll, setFunctionScoresAll] = useState<CompanyFunctionScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [industryFilter, setIndustryFilter] = useState('')
  const [bucketFilter, setBucketFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [reviewFilter, setReviewFilter] = useState('')
  // Default: reviewed-only view (hard_tech + all_tech). Matches recruiter
  // workflow — unreviewed is the admin-triage list, opted in explicitly.
  const [focusFilter, setFocusFilter] = useState<FocusFilter>('')
  const [bulkFocusing, setBulkFocusing] = useState(false)

  // Sort
  const [sortBy, setSortBy] = useState<SortBy>('name_asc')
  const [sortYear, setSortYear] = useState<number>(new Date().getFullYear())
  const [sortFunction, setSortFunction] = useState<string>('')

  // Load everything
  useEffect(() => {
    async function fetchAll() {
      try {
        // Fetch all companies — Supabase defaults to 1000 rows, so we
        // need to paginate or set a higher limit for 1300+ companies.
        let allCompanies: Company[] = []
        let from = 0
        const pageSize = 1000
        while (true) {
          const { data: page, error: pageErr } = await supabase
            .from('companies')
            .select('*')
            .order('company_name', { ascending: true })
            .range(from, from + pageSize - 1)
          if (pageErr) throw pageErr
          if (!page || page.length === 0) break
          allCompanies = allCompanies.concat(page)
          if (page.length < pageSize) break
          from += pageSize
        }
        setCompanies(allCompanies)

        const { data: ys } = await supabase
          .from('company_year_scores')
          .select('company_id, year, company_score')
        setYearScoresAll(ys || [])

        const { data: fs } = await supabase
          .from('company_function_scores')
          .select('company_id, function_normalized, year, function_score')
        setFunctionScoresAll(fs || [])

        // Function options come from curated COMPANY_FUNCTIONS constant
        // (not function_dictionary which has irrelevant entries like 'founder')
      } catch (err: any) {
        setError(err?.message || 'Failed to load companies.')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // Build per-company year-score lookups (latest score, all years, map by year)
  const scoresByCompany = useMemo(() => {
    const map: Record<string, CompanyYearScore[]> = {}
    for (const ys of yearScoresAll) {
      if (!map[ys.company_id]) map[ys.company_id] = []
      map[ys.company_id].push(ys)
    }
    for (const id of Object.keys(map)) {
      map[id].sort((a, b) => b.year - a.year) // newest first
    }
    return map
  }, [yearScoresAll])

  const functionScoreByCompany = useMemo(() => {
    const map: Record<string, number | null> = {}
    if (!sortFunction) return map
    // Take the MAX function_score for that function across years per company
    for (const fs of functionScoresAll) {
      if (fs.function_normalized !== sortFunction) continue
      const current = map[fs.company_id]
      if (current == null || fs.function_score > current) {
        map[fs.company_id] = fs.function_score
      }
    }
    return map
  }, [functionScoresAll, sortFunction])

  // Unique industries for the filter dropdown
  const industryOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of companies) if (c.primary_industry_tag) set.add(c.primary_industry_tag)
    return Array.from(set).sort()
  }, [companies])

  // Filter + sort
  const filtered = useMemo(() => {
    let rows = [...companies]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      rows = rows.filter(c => c.company_name.toLowerCase().includes(q))
    }
    if (industryFilter) rows = rows.filter(c => c.primary_industry_tag === industryFilter)
    if (bucketFilter)   rows = rows.filter(c => c.company_bucket === bucketFilter)
    if (statusFilter)   rows = rows.filter(c => c.current_status === statusFilter)
    if (reviewFilter === 'scored') rows = rows.filter(c => c.manual_review_status === 'reviewed' || c.manual_review_status === 'locked')
    if (reviewFilter === 'unscored') rows = rows.filter(c => c.manual_review_status === 'unreviewed')

    // Focus filter. Default ('') = reviewed only = hard_tech + all_tech.
    // 'all' explicitly includes unreviewed; specific values filter exactly.
    if (focusFilter === '' || focusFilter === 'all_tech') {
      rows = rows.filter(c => c.focus === 'hard_tech' || c.focus === 'all_tech')
    } else if (focusFilter === 'hard_tech') {
      rows = rows.filter(c => c.focus === 'hard_tech')
    } else if (focusFilter === 'unreviewed') {
      rows = rows.filter(c => c.focus === 'unreviewed')
    }
    // focusFilter === 'all' → no filter applied

    if (sortBy === 'name_asc') {
      rows.sort((a, b) => a.company_name.localeCompare(b.company_name))
    } else if (sortBy === 'name_desc') {
      rows.sort((a, b) => b.company_name.localeCompare(a.company_name))
    } else if (sortBy === 'year_score') {
      rows.sort((a, b) => {
        const aScore = scoresByCompany[a.company_id]?.find(s => s.year === sortYear)?.company_score ?? -1
        const bScore = scoresByCompany[b.company_id]?.find(s => s.year === sortYear)?.company_score ?? -1
        return bScore - aScore // highest first
      })
    } else if (sortBy === 'function_score') {
      rows.sort((a, b) => {
        const aScore = functionScoreByCompany[a.company_id] ?? -1
        const bScore = functionScoreByCompany[b.company_id] ?? -1
        return bScore - aScore
      })
    }

    return rows
  }, [companies, searchQuery, industryFilter, bucketFilter, statusFilter, reviewFilter, focusFilter, sortBy, sortYear, sortFunction, scoresByCompany, functionScoreByCompany])

  const activeFilters = [industryFilter, bucketFilter, statusFilter, reviewFilter, focusFilter].filter(Boolean).length
  const clearAll = () => {
    setSearchQuery('')
    setIndustryFilter('')
    setBucketFilter('')
    setStatusFilter('')
    setReviewFilter('')
    setFocusFilter('')
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(c => c.company_id)))
    }
  }

  async function handleBulkDelete() {
    if (!bulkDeleteConfirm) { setBulkDeleteConfirm(true); return }
    setBulkDeleting(true)
    const ids = Array.from(selectedIds)
    for (const id of ids) {
      await supabase.from('companies').delete().eq('company_id', id)
    }
    setCompanies(prev => prev.filter(c => !selectedIds.has(c.company_id)))
    setSelectedIds(new Set())
    setBulkDeleting(false)
    setBulkDeleteConfirm(false)
  }

  async function handleBulkSetFocus(newFocus: CompanyFocus) {
    if (selectedIds.size === 0) return
    setBulkFocusing(true)
    const ids = Array.from(selectedIds)
    const { error: updateErr } = await supabase
      .from('companies')
      .update({ focus: newFocus })
      .in('company_id', ids)
    if (updateErr) {
      alert(`Failed to update focus: ${updateErr.message}`)
    } else {
      setCompanies(prev => prev.map(c => selectedIds.has(c.company_id) ? { ...c, focus: newFocus } : c))
      setSelectedIds(new Set())
    }
    setBulkFocusing(false)
  }

  async function handleQuickPromote(companyId: string, newFocus: CompanyFocus) {
    const { error: updateErr } = await supabase
      .from('companies')
      .update({ focus: newFocus })
      .eq('company_id', companyId)
    if (updateErr) {
      alert(`Failed to promote: ${updateErr.message}`)
      return
    }
    setCompanies(prev => prev.map(c => c.company_id === companyId ? { ...c, focus: newFocus } : c))
  }

  // Year range for sort-by-year dropdown — build from data
  const yearRange = useMemo(() => {
    const years = new Set<number>()
    for (const ys of yearScoresAll) years.add(ys.year)
    return Array.from(years).sort((a, b) => b - a) // newest first
  }, [yearScoresAll])

  // Compact renderer for year scores in the table
  function renderYearScores(companyId: string): JSX.Element {
    const rows = scoresByCompany[companyId] || []
    if (rows.length === 0) return <span className="text-xs text-tertiary">—</span>
    const latest = rows[0]
    const min = Math.min(...rows.map(r => r.company_score))
    const max = Math.max(...rows.map(r => r.company_score))
    const label = min === max ? `${min}` : `${min}–${max}`
    return (
      <span className="text-xs text-muted-foreground" title={rows.map(r => `${r.year}: ${r.company_score}`).join('\n')}>
        <span className="font-semibold">{latest.year}: {latest.company_score}</span>
        <span className="text-tertiary ml-2">({rows.length}yrs, range {label})</span>
      </span>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64vh', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)', background: 'var(--bg-canvas)' }}>
        Loading companies...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 24, background: 'var(--bg-canvas)', minHeight: '100vh', fontFamily: 'var(--font-sans)' }}>
        <div style={{ background: 'var(--red-950)', border: '1px solid var(--red-800)', borderRadius: 'var(--r-card)', padding: 16 }}>
          <h2 style={{ color: 'var(--red-400)', fontWeight: 'var(--fw-semibold)', marginBottom: 8 }}>Error</h2>
          <p style={{ color: 'var(--red-300)', fontSize: 'var(--fs-13)' }}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, background: 'var(--bg-canvas)', color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to people</a>
          <h1 className="text-3xl font-bold mt-2">Companies</h1>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => router.push('/admin/companies/new')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-strong"
          >
            + Add Company
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Filters + Sort */}
      <div className="mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Industry</label>
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All industries</option>
            {industryOptions.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Bucket</label>
          <select
            value={bucketFilter}
            onChange={(e) => setBucketFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All buckets</option>
            {BUCKET_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Review Status</label>
          <select
            value={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All</option>
            <option value="scored">Scored only</option>
            <option value="unscored">Unscored only</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Focus</label>
          <select
            value={focusFilter}
            onChange={(e) => setFocusFilter(e.target.value as FocusFilter)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Tech (default)</option>
            <option value="hard_tech">Hard Tech only</option>
            <option value="unreviewed">Unreviewed only</option>
            <option value="all">Show everything</option>
          </select>
        </div>

        <div className="border-l border-border pl-3 ml-2 flex gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="name_asc">Name (A→Z)</option>
              <option value="name_desc">Name (Z→A)</option>
              <option value="year_score">Year Score</option>
              <option value="function_score">Top by Function</option>
            </select>
          </div>

          {sortBy === 'year_score' && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Year</label>
              <select
                value={sortYear}
                onChange={(e) => setSortYear(parseInt(e.target.value, 10))}
                className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {yearRange.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {sortBy === 'function_score' && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Function</label>
              <select
                value={sortFunction}
                onChange={(e) => setSortFunction(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Pick one…</option>
                {COMPANY_FUNCTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          )}
        </div>

        {(activeFilters > 0 || searchQuery) && (
          <button
            onClick={clearAll}
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg bg-card hover:bg-background"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Showing {filtered.length} of {companies.length} companies
        </span>
        {/* Header "Find candidates" button — shown when filters active but no checkboxes selected */}
        {selectedIds.size === 0 && (searchQuery || activeFilters > 0) && filtered.length > 0 && (
          <button
            onClick={() => {
              const ids = filtered.map(c => c.company_id)
              const state = { compoundCompany: ids, compoundCompanyScope: 'ever' }
              router.push(`/?filters=${encodeURIComponent(JSON.stringify(state))}`)
            }}
            style={{ padding: '6px 14px', fontSize: 'var(--fs-13)', fontFamily: 'var(--font-sans)', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--r-button)', cursor: 'pointer', fontWeight: 'var(--fw-medium)' as any }}
          >
            Find candidates from filtered list ({filtered.length})
          </button>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 p-3 bg-watch/10 border border-watch/30 rounded-lg">
          <span className="text-sm text-watch font-medium">{selectedIds.size} selected</span>

          {/* Find candidates from selected */}
          <button
            onClick={() => {
              const ids = Array.from(selectedIds)
              const state = { compoundCompany: ids, compoundCompanyScope: 'ever' }
              router.push(`/?filters=${encodeURIComponent(JSON.stringify(state))}`)
            }}
            style={{ padding: '4px 12px', fontSize: 'var(--fs-12)', fontFamily: 'var(--font-sans)', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--r-button)', cursor: 'pointer', fontWeight: 'var(--fw-medium)' as any }}
          >
            Find candidates at {selectedIds.size} selected
          </button>

          {/* Bulk focus change */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Set focus:</span>
            {FOCUS_OPTIONS.map(f => (
              <button
                key={f.value}
                onClick={() => handleBulkSetFocus(f.value)}
                disabled={bulkFocusing}
                className="px-2 py-1 text-xs bg-card border border-border rounded hover:bg-background disabled:opacity-50"
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <button
            onClick={handleBulkDelete}
            onBlur={() => setBulkDeleteConfirm(false)}
            disabled={bulkDeleting}
            className={`px-3 py-1 text-sm rounded ${
              bulkDeleteConfirm
                ? 'bg-destructive text-white hover:bg-destructive'
                : 'bg-card text-destructive border border-destructive/30 hover:bg-destructive/10'
            } disabled:opacity-50`}
          >
            {bulkDeleting ? 'Deleting…' : bulkDeleteConfirm ? 'Click again to confirm' : 'Delete selected'}
          </button>
          <button
            onClick={() => { setSelectedIds(new Set()); setBulkDeleteConfirm(false) }}
            className="text-sm text-tertiary hover:text-muted-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-background">
              <tr>
                <th className="px-2 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                    className="rounded border-border"
                  />
                </th>
                <th className="px-2 py-3 w-9" title="LinkedIn">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" className="text-tertiary"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Industry</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Founded</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Stage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Size</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Bucket</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Website</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-4 text-center text-tertiary">No companies found</td></tr>
              ) : (
                filtered.map(c => (
                  <tr
                    key={c.company_id}
                    className="hover:bg-background cursor-pointer"
                    onClick={() => router.push(`/admin/companies/${c.company_id}`)}
                  >
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.company_id)}
                        onChange={() => toggleSelect(c.company_id)}
                        className="rounded border-border"
                      />
                    </td>
                    {/* LinkedIn icon */}
                    <td className="px-2 py-3 w-9" onClick={(e) => e.stopPropagation()}>
                      {c.linkedin_url ? (
                        <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-tertiary hover:text-foreground">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        </a>
                      ) : (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" className="text-tertiary" style={{ opacity: 0.25 }}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      )}
                    </td>
                    {/* Name + logo */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <CompanyLogo domain={guessDomain(c.company_name)} companyName={c.company_name} size={20} />
                        <span className="text-foreground font-medium">{c.company_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{c.primary_industry_tag || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{c.founding_year ?? '—'}</td>
                    {/* Stage (funding) */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{(c as any).funding_stage || '—'}</td>
                    {/* Size (headcount) */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{(c as any).headcount_range || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                      {c.company_bucket ? c.company_bucket.replace(/_/g, ' ') : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const domain = c.website_url?.replace(/^https?:\/\//, '').replace(/\/+$/, '') || guessDomain(c.company_name)
                        if (!domain) return <span className="text-tertiary">—</span>
                        return (
                          <a href={c.website_url || `https://${domain}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground hover:underline">
                            {domain}
                          </a>
                        )
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
