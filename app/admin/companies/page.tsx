'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Company, CompanyBucket, CompanyStatus, CompanyCategory, CompanyReviewStatus, CompanyYearScore, CompanyFunctionScore } from '@/app/types'
import CompanyLogo, { guessDomain } from '@/app/components/CompanyLogo'
import { COMPANY_FUNCTIONS } from '@/app/constants'
import ThemeToggle from '@/app/components/ThemeToggle'
import IndustryBadge from '@/app/components/IndustryBadge'
import {
  HARDWARE_INDUSTRIES, NON_HARDWARE_INDUSTRIES,
  HARDWARE_DOMAIN_TAGS, NON_HARDWARE_DOMAIN_TAGS,
  REVIEW_STATUSES, industriesFor,
  TAGGING_METHOD_LABELS, taggingMethodLabel,
  FUNDING_STAGE_LABELS,
} from '@/lib/companies/taxonomy'

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

// V1 category options (with NULL=unclassified represented as 'unclassified')
type CategoryFilter = '' | 'hardware' | 'non_hardware' | 'unclassified'
const CATEGORY_OPTIONS: Array<{ value: CategoryFilter; label: string }> = [
  { value: '',             label: 'All categories' },
  { value: 'hardware',     label: 'Hardware' },
  { value: 'non_hardware', label: 'Non-hardware' },
  { value: 'unclassified', label: 'Unclassified (NULL)' },
]

const REVIEW_OPTIONS: Array<{ value: '' | CompanyReviewStatus; label: string }> = [
  { value: '',           label: 'All review statuses' },
  { value: 'vetted',     label: 'Vetted' },
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'excluded',   label: 'Excluded' },
]

type SortBy = 'name_asc' | 'name_desc' | 'year_score' | 'function_score' | 'tagging_confidence' | 'headcount_latest'

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
  const [industryFilter, setIndustryFilter] = useState('')              // matches against industries[] (GIN containment)
  const [domainTagFilter, setDomainTagFilter] = useState('')            // matches against domain_tags[]
  const [bucketFilter, setBucketFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [reviewFilter, setReviewFilter] = useState<'' | CompanyReviewStatus>('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('')
  const [taggingMethodFilter, setTaggingMethodFilter] = useState('')
  const [confidenceMinFilter, setConfidenceMinFilter] = useState<number | ''>('')
  const [bulkUpdating, setBulkUpdating] = useState(false)

  // Sort
  const [sortBy, setSortBy] = useState<SortBy>('name_asc')
  const [sortYear, setSortYear] = useState<number>(new Date().getFullYear())
  const [sortFunction, setSortFunction] = useState<string>('')

  // Load everything
  useEffect(() => {
    async function fetchAll() {
      try {
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
          allCompanies = allCompanies.concat(page as Company[])
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
      } catch (err: any) {
        setError(err?.message || 'Failed to load companies.')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const scoresByCompany = useMemo(() => {
    const map: Record<string, CompanyYearScore[]> = {}
    for (const ys of yearScoresAll) {
      if (!map[ys.company_id]) map[ys.company_id] = []
      map[ys.company_id].push(ys)
    }
    for (const id of Object.keys(map)) {
      map[id].sort((a, b) => b.year - a.year)
    }
    return map
  }, [yearScoresAll])

  const functionScoreByCompany = useMemo(() => {
    const map: Record<string, number | null> = {}
    if (!sortFunction) return map
    for (const fs of functionScoresAll) {
      if (fs.function_normalized !== sortFunction) continue
      const current = map[fs.company_id]
      if (current == null || fs.function_score > current) {
        map[fs.company_id] = fs.function_score
      }
    }
    return map
  }, [functionScoresAll, sortFunction])

  // Industry options reflect the V1 controlled vocabulary, gated by category.
  const industryOptions = useMemo(() => {
    if (categoryFilter === 'hardware') return HARDWARE_INDUSTRIES.slice()
    if (categoryFilter === 'non_hardware') return NON_HARDWARE_INDUSTRIES.slice()
    if (categoryFilter === 'unclassified') return [] as string[]
    // Default: union (deduped)
    const set = new Set<string>([...HARDWARE_INDUSTRIES, ...NON_HARDWARE_INDUSTRIES])
    return Array.from(set).sort()
  }, [categoryFilter])

  const domainTagOptions = useMemo(() => {
    if (categoryFilter === 'hardware') return HARDWARE_DOMAIN_TAGS.slice()
    if (categoryFilter === 'non_hardware') return NON_HARDWARE_DOMAIN_TAGS.slice()
    if (categoryFilter === 'unclassified') return [] as string[]
    const set = new Set<string>([...HARDWARE_DOMAIN_TAGS, ...NON_HARDWARE_DOMAIN_TAGS])
    return Array.from(set).sort()
  }, [categoryFilter])

  const filtered = useMemo(() => {
    let rows = [...companies]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      rows = rows.filter(c => c.company_name.toLowerCase().includes(q))
    }
    if (industryFilter) {
      // Match against V1 industries[] OR legacy_primary_industry_tag (display compat)
      rows = rows.filter(c =>
        (c.industries && c.industries.includes(industryFilter)) ||
        c.legacy_primary_industry_tag === industryFilter,
      )
    }
    if (domainTagFilter) {
      rows = rows.filter(c => c.domain_tags && c.domain_tags.includes(domainTagFilter))
    }
    if (bucketFilter) rows = rows.filter(c => c.company_bucket === bucketFilter)
    if (statusFilter) rows = rows.filter(c => c.current_status === statusFilter)
    if (reviewFilter) rows = rows.filter(c => c.review_status === reviewFilter)

    if (categoryFilter === 'hardware') rows = rows.filter(c => c.category === 'hardware')
    else if (categoryFilter === 'non_hardware') rows = rows.filter(c => c.category === 'non_hardware')
    else if (categoryFilter === 'unclassified') rows = rows.filter(c => c.category === null || c.category === undefined)

    if (taggingMethodFilter) {
      if (taggingMethodFilter === 'untagged') rows = rows.filter(c => c.tagging_method === null || c.tagging_method === undefined)
      else rows = rows.filter(c => c.tagging_method === taggingMethodFilter)
    }
    if (confidenceMinFilter !== '') {
      rows = rows.filter(c => (c.tagging_confidence ?? 0) >= confidenceMinFilter)
    }

    if (sortBy === 'name_asc') {
      rows.sort((a, b) => a.company_name.localeCompare(b.company_name))
    } else if (sortBy === 'name_desc') {
      rows.sort((a, b) => b.company_name.localeCompare(a.company_name))
    } else if (sortBy === 'year_score') {
      rows.sort((a, b) => {
        const aScore = scoresByCompany[a.company_id]?.find(s => s.year === sortYear)?.company_score ?? -1
        const bScore = scoresByCompany[b.company_id]?.find(s => s.year === sortYear)?.company_score ?? -1
        return bScore - aScore
      })
    } else if (sortBy === 'function_score') {
      rows.sort((a, b) => {
        const aScore = functionScoreByCompany[a.company_id] ?? -1
        const bScore = functionScoreByCompany[b.company_id] ?? -1
        return bScore - aScore
      })
    } else if (sortBy === 'tagging_confidence') {
      rows.sort((a, b) => (b.tagging_confidence ?? -1) - (a.tagging_confidence ?? -1))
    } else if (sortBy === 'headcount_latest') {
      rows.sort((a, b) => (b.headcount_latest ?? -1) - (a.headcount_latest ?? -1))
    }

    return rows
  }, [companies, searchQuery, industryFilter, domainTagFilter, bucketFilter, statusFilter, reviewFilter, categoryFilter, taggingMethodFilter, confidenceMinFilter, sortBy, sortYear, sortFunction, scoresByCompany, functionScoreByCompany])

  const activeFilters = [industryFilter, domainTagFilter, bucketFilter, statusFilter, reviewFilter, categoryFilter, taggingMethodFilter].filter(Boolean).length + (confidenceMinFilter !== '' ? 1 : 0)
  const clearAll = () => {
    setSearchQuery('')
    setIndustryFilter('')
    setDomainTagFilter('')
    setBucketFilter('')
    setStatusFilter('')
    setReviewFilter('')
    setCategoryFilter('')
    setTaggingMethodFilter('')
    setConfidenceMinFilter('')
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(c => c.company_id)))
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

  // Per inventory: bulk-edit allowed on category and review_status only.
  // NOT on industry, domain_tags, or any other field (too easy to clobber per-row data).
  async function handleBulkSetCategory(newCategory: CompanyCategory | null) {
    if (selectedIds.size === 0) return
    setBulkUpdating(true)
    const ids = Array.from(selectedIds)
    // Setting category=null requires also clearing primary_industry, industries[], domain_tags[]
    // (per CHECK constraint). Setting category=hw/nhw doesn't auto-fill industry — admin still must.
    const update: Record<string, unknown> =
      newCategory === null
        ? { category: null, primary_industry: null, industries: [], domain_tags: [] }
        : { category: newCategory }
    const { error: updateErr } = await supabase
      .from('companies')
      .update(update)
      .in('company_id', ids)
    if (updateErr) {
      alert(`Failed to update category: ${updateErr.message}`)
    } else {
      setCompanies(prev => prev.map(c =>
        selectedIds.has(c.company_id)
          ? { ...c, category: newCategory, ...(newCategory === null ? { primary_industry: null, industries: [], domain_tags: [] } : {}) }
          : c
      ))
      setSelectedIds(new Set())
    }
    setBulkUpdating(false)
  }

  async function handleBulkSetReviewStatus(newReview: CompanyReviewStatus) {
    if (selectedIds.size === 0) return
    setBulkUpdating(true)
    const ids = Array.from(selectedIds)
    const { error: updateErr } = await supabase
      .from('companies')
      .update({ review_status: newReview })
      .in('company_id', ids)
    if (updateErr) {
      alert(`Failed to update review_status: ${updateErr.message}`)
    } else {
      setCompanies(prev => prev.map(c => selectedIds.has(c.company_id) ? { ...c, review_status: newReview } : c))
      setSelectedIds(new Set())
    }
    setBulkUpdating(false)
  }

  const yearRange = useMemo(() => {
    const years = new Set<number>()
    for (const ys of yearScoresAll) years.add(ys.year)
    return Array.from(years).sort((a, b) => b - a)
  }, [yearScoresAll])

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
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => router.push('/admin/companies/triage')}
            className="px-3 py-1.5 text-sm font-medium border border-border rounded-md bg-card text-foreground hover:bg-background transition"
            title="Companies needing review (unreviewed, low confidence, untagged)"
          >
            Triage
          </button>
          <button
            onClick={() => router.push('/admin/import/companies')}
            className="px-3 py-1.5 text-sm font-medium border border-border rounded-md bg-card text-foreground hover:bg-background transition"
            title="Pull companies from Crust"
          >
            Import
          </button>
          <button
            onClick={() => router.push('/admin/companies/new')}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-white hover:bg-accent-strong transition"
          >
            + Add company
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value as CategoryFilter); setIndustryFilter(''); setDomainTagFilter('') }}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Review status</label>
          <select
            value={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.value as '' | CompanyReviewStatus)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {REVIEW_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Industry</label>
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={categoryFilter === 'unclassified'}
          >
            <option value="">All industries</option>
            {industryOptions.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Domain tag</label>
          <select
            value={domainTagFilter}
            onChange={(e) => setDomainTagFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={categoryFilter === 'unclassified'}
          >
            <option value="">All tags</option>
            {domainTagOptions.map(t => <option key={t} value={t}>{t}</option>)}
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
          <label className="block text-xs font-medium text-muted-foreground mb-1">Tagging method</label>
          <select
            value={taggingMethodFilter}
            onChange={(e) => setTaggingMethodFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All methods</option>
            <option value="untagged">Waiting for tagger</option>
            {Object.entries(TAGGING_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Confidence ≥</label>
          <select
            value={confidenceMinFilter === '' ? '' : String(confidenceMinFilter)}
            onChange={(e) => setConfidenceMinFilter(e.target.value === '' ? '' : Number(e.target.value))}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Any</option>
            <option value="0.9">≥ 0.9</option>
            <option value="0.7">≥ 0.7</option>
            <option value="0.5">≥ 0.5</option>
            <option value="0.3">≥ 0.3</option>
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
              <option value="tagging_confidence">Confidence (high→low)</option>
              <option value="headcount_latest">Headcount (high→low)</option>
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
        {selectedIds.size === 0 && (searchQuery || activeFilters > 0) && filtered.length > 0 && (
          <button
            onClick={() => {
              const ids = filtered.map(c => c.company_id)
              const state = {
                compoundCompany: ids, compoundCompanyScope: 'ever',
                cc: [{ s: 'ever', c: ids }],
              }
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

          <button
            onClick={() => {
              const ids = Array.from(selectedIds)
              const state = {
                compoundCompany: ids, compoundCompanyScope: 'ever',
                cc: [{ s: 'ever', c: ids }],
              }
              router.push(`/?filters=${encodeURIComponent(JSON.stringify(state))}`)
            }}
            style={{ padding: '4px 12px', fontSize: 'var(--fs-12)', fontFamily: 'var(--font-sans)', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--r-button)', cursor: 'pointer', fontWeight: 'var(--fw-medium)' as any }}
          >
            Find candidates at {selectedIds.size} selected
          </button>

          {/* Bulk-edit category (per inventory: only category + review_status allowed for bulk) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Set category:</span>
            <button onClick={() => handleBulkSetCategory('hardware')} disabled={bulkUpdating}
              className="px-2 py-1 text-xs bg-card border border-border rounded hover:bg-background disabled:opacity-50">Hardware</button>
            <button onClick={() => handleBulkSetCategory('non_hardware')} disabled={bulkUpdating}
              className="px-2 py-1 text-xs bg-card border border-border rounded hover:bg-background disabled:opacity-50">Non-hw</button>
            <button onClick={() => handleBulkSetCategory(null)} disabled={bulkUpdating}
              className="px-2 py-1 text-xs bg-card border border-border rounded hover:bg-background disabled:opacity-50"
              title="Clears category, primary_industry, industries[], domain_tags[] per CHECK constraint">Clear (NULL)</button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Set review:</span>
            {REVIEW_STATUSES.map(rs => (
              <button
                key={rs}
                onClick={() => handleBulkSetReviewStatus(rs)}
                disabled={bulkUpdating}
                className="px-2 py-1 text-xs bg-card border border-border rounded hover:bg-background disabled:opacity-50"
              >
                {rs}
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
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Industry</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Tags</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Funding</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Review</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Headcount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Tagging</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-4 text-center text-tertiary">No companies found</td></tr>
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
                    <td className="px-2 py-3 w-9" onClick={(e) => e.stopPropagation()}>
                      {c.linkedin_url ? (
                        <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-tertiary hover:text-foreground">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        </a>
                      ) : (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" className="text-tertiary" style={{ opacity: 0.25 }}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <CompanyLogo domain={guessDomain(c.company_name)} companyName={c.company_name} size={20} />
                        <span className="text-foreground font-medium">{c.company_name}</span>
                        {c.tagging_method == null && (
                          <span title="Awaiting auto-tagger" className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">tagging…</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {c.category ? (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs ${
                            c.category === 'hardware' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                          }`}
                          title={c.category === 'hardware' ? 'Hardware' : 'Non-hardware'}
                        >
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${c.category === 'hardware' ? 'bg-emerald-600' : 'bg-sky-600'}`} aria-hidden />
                          {c.category === 'hardware' ? 'Hardware' : 'Non-hw'}
                        </span>
                      ) : <span className="text-tertiary text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                      <IndustryBadge primary={c.primary_industry} industries={c.industries || []} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {c.domain_tags && c.domain_tags.length > 0 ? c.domain_tags.slice(0, 3).join(', ') + (c.domain_tags.length > 3 ? ` +${c.domain_tags.length - 3}` : '') : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {c.funding_stage
                        ? FUNDING_STAGE_LABELS[c.funding_stage as keyof typeof FUNDING_STAGE_LABELS] || c.funding_stage
                        : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      <span className={`inline-block px-2 py-0.5 rounded ${
                        c.review_status === 'vetted' ? 'bg-green-100 text-green-800'
                        : c.review_status === 'excluded' ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-700'
                      }`}>{c.review_status}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {c.headcount_latest ? c.headcount_latest.toLocaleString() : (c.headcount_range || '—')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground" title={c.tagging_notes || ''}>
                      {c.tagging_method ? (
                        <span>
                          {taggingMethodLabel(c.tagging_method)}
                          {c.tagging_confidence != null && <span className="text-tertiary ml-1">({c.tagging_confidence.toFixed(2)})</span>}
                        </span>
                      ) : <span className="text-tertiary">—</span>}
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
