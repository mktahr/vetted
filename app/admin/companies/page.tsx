'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Company, CompanyBucket, CompanyStatus, CompanyCategory, CompanyReviewStatus, CompanyYearScore, CompanyFunctionScore } from '@/app/types'
import CompanyLogo, { guessDomain } from '@/app/components/CompanyLogo'
import { COMPANY_FUNCTIONS } from '@/app/constants'
import IndustryBadge from '@/app/components/IndustryBadge'
import TopNav from '@/app/components/TopNav'
import AddToListMenu from '@/app/components/AddToListMenu'
import {
  HARDWARE_INDUSTRIES, NON_HARDWARE_INDUSTRIES,
  HARDWARE_DOMAIN_TAGS, NON_HARDWARE_DOMAIN_TAGS,
  REVIEW_STATUSES, industriesFor,
  TAGGING_METHOD_LABELS, taggingMethodLabel,
  FUNDING_STAGES, FUNDING_STAGE_LABELS,
} from '@/lib/companies/taxonomy'
import { formatFundingAmount } from '@/lib/companies/funding'
import { formatGrowthPct, growthSign, compactLocation, allLocations, matchesLocation } from '@/lib/companies/firmographics'
import { highestTier, type InvestorTier } from '@/lib/companies/investor-tiers'

// Stage ordering for sort. pre_seed=1 → series_k=13. Higher = later stage.
const FUNDING_STAGE_ORDER: Record<string, number> = {
  pre_seed: 1, seed: 2,
  series_a: 3, series_b: 4, series_c: 5, series_d: 6, series_e: 7,
  series_f: 8, series_g: 9, series_h: 10, series_i: 11, series_j: 12, series_k: 13,
}

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

type SortBy =
  | 'name_asc' | 'name_desc'
  | 'year_score' | 'function_score'
  | 'tagging_confidence_asc'
  | 'headcount_desc' | 'headcount_asc'
  | 'funding_stage_asc' | 'funding_stage_desc'
  | 'total_funding_desc' | 'total_funding_asc'
  | 'founding_year_desc' | 'founding_year_asc'

const SORT_OPTIONS: Array<{ value: SortBy; label: string; help?: string }> = [
  { value: 'name_asc',                label: 'Name (A → Z)' },
  { value: 'name_desc',               label: 'Name (Z → A)' },
  { value: 'headcount_desc',          label: 'Headcount (large → small)' },
  { value: 'headcount_asc',           label: 'Headcount (small → large)' },
  { value: 'founding_year_desc',      label: 'Founded (newest → oldest)' },
  { value: 'founding_year_asc',       label: 'Founded (oldest → newest)' },
  { value: 'total_funding_desc',      label: 'Total raised (high → low)',     help: 'Companies without a stored total at the bottom.' },
  { value: 'total_funding_asc',       label: 'Total raised (low → high)' },
  { value: 'funding_stage_asc',       label: 'Funding stage (early → late)',  help: 'Pre-seed/seed first; Series K last; companies without a stored stage at the bottom.' },
  { value: 'funding_stage_desc',      label: 'Funding stage (late → early)' },
  { value: 'tagging_confidence_asc',  label: 'Tagger confidence (low → high)', help: 'Useful for finding rows that need a manual review.' },
  { value: 'year_score',              label: 'Manual quality (year)',          help: 'Manually set 1–5 quality rating per company per year. Used for candidate scoring.' },
  { value: 'function_score',          label: 'Manual quality (function)',      help: 'Manually set 1–3 quality rating for non-engineering functions.' },
]

type GrowthWindow = '3m' | '6m' | '12m'

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
  const [fundingStageFilter, setFundingStageFilter] = useState('')
  const [bulkUpdating, setBulkUpdating] = useState(false)

  // Sort
  const [sortBy, setSortBy] = useState<SortBy>('name_asc')
  const [sortYear, setSortYear] = useState<number>(new Date().getFullYear())
  const [sortFunction, setSortFunction] = useState<string>('')

  // Headcount-growth column window toggle (3m / 6m / 12m)
  const [growthWindow, setGrowthWindow] = useState<GrowthWindow>('12m')

  // Investor tier filter ('' = all, 't1' = has tier 1, 't1_or_t2' = has either)
  const [investorTierFilter, setInvestorTierFilter] = useState<'' | 't1' | 't1_or_t2'>('')

  // Location filter — substring match against HQ or any office
  const [locationQuery, setLocationQuery] = useState('')
  const [locationScope, setLocationScope] = useState<'hq' | 'any'>('any')

  // company_id → highest tier its investors achieve. Computed once on load.
  const [companyHighestTier, setCompanyHighestTier] = useState<Record<string, InvestorTier | null>>({})

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

        // Load investor tier map + all funding rounds, then compute the
        // highest tier any investor of each company achieves. Used for the
        // "Has Tier 1 investor" filter.
        const [{ data: tierRows }, { data: roundRows }] = await Promise.all([
          supabase.from('investor_tiers').select('investor_name, tier'),
          supabase.from('company_funding_rounds').select('company_id, investors'),
        ])
        const tierMap = new Map<string, InvestorTier>()
        for (const t of (tierRows || []) as any[]) tierMap.set(t.investor_name, t.tier as InvestorTier)
        const perCompanyInvestors: Record<string, Set<string>> = {}
        for (const r of (roundRows || []) as Array<{ company_id: string; investors: string[] | null }>) {
          if (!perCompanyInvestors[r.company_id]) perCompanyInvestors[r.company_id] = new Set()
          for (const name of r.investors || []) {
            if (typeof name === 'string' && name.trim()) perCompanyInvestors[r.company_id].add(name.trim())
          }
        }
        const map: Record<string, InvestorTier | null> = {}
        for (const cid of Object.keys(perCompanyInvestors)) {
          map[cid] = highestTier(tierMap, Array.from(perCompanyInvestors[cid]))
        }
        setCompanyHighestTier(map)
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
      rows = rows.filter(c => {
        // Match across name + industry + tags + location + description so
        // typing "drones" finds Anduril, "fintech" finds Stripe, etc.
        if (c.company_name?.toLowerCase().includes(q)) return true
        if (c.primary_industry?.toLowerCase().includes(q)) return true
        if (c.industries?.some(i => i.toLowerCase().includes(q))) return true
        if (c.domain_tags?.some(t => t.toLowerCase().includes(q))) return true
        if (c.hq_location_name?.toLowerCase().includes(q)) return true
        if (c.locations?.offices?.some((o: string) => o.toLowerCase().includes(q))) return true
        if (c.description?.toLowerCase().includes(q)) return true
        if (c.legacy_primary_industry_tag?.toLowerCase().includes(q)) return true
        return false
      })
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
    if (fundingStageFilter) {
      rows = rows.filter(c => c.funding_stage === fundingStageFilter)
    }
    if (investorTierFilter === 't1') {
      rows = rows.filter(c => companyHighestTier[c.company_id] === 1)
    } else if (investorTierFilter === 't1_or_t2') {
      rows = rows.filter(c => {
        const t = companyHighestTier[c.company_id]
        return t === 1 || t === 2
      })
    }
    if (locationQuery.trim()) {
      rows = rows.filter(c => matchesLocation(c.locations as any, locationQuery, locationScope))
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
    } else if (sortBy === 'tagging_confidence_asc') {
      // Lowest confidence first — useful for finding rows to QA
      rows.sort((a, b) => (a.tagging_confidence ?? Infinity) - (b.tagging_confidence ?? Infinity))
    } else if (sortBy === 'headcount_desc') {
      rows.sort((a, b) => (b.headcount_latest ?? -1) - (a.headcount_latest ?? -1))
    } else if (sortBy === 'headcount_asc') {
      rows.sort((a, b) => (a.headcount_latest ?? Infinity) - (b.headcount_latest ?? Infinity))
    } else if (sortBy === 'founding_year_desc') {
      rows.sort((a, b) => (b.founding_year ?? -1) - (a.founding_year ?? -1))
    } else if (sortBy === 'founding_year_asc') {
      rows.sort((a, b) => (a.founding_year ?? Infinity) - (b.founding_year ?? Infinity))
    } else if (sortBy === 'total_funding_desc') {
      rows.sort((a, b) => (b.total_funding_usd ?? -1) - (a.total_funding_usd ?? -1))
    } else if (sortBy === 'total_funding_asc') {
      rows.sort((a, b) => (a.total_funding_usd ?? Infinity) - (b.total_funding_usd ?? Infinity))
    } else if (sortBy === 'funding_stage_asc' || sortBy === 'funding_stage_desc') {
      const direction = sortBy === 'funding_stage_asc' ? 1 : -1
      rows.sort((a, b) => {
        const av = a.funding_stage ? FUNDING_STAGE_ORDER[a.funding_stage] ?? 0 : 0
        const bv = b.funding_stage ? FUNDING_STAGE_ORDER[b.funding_stage] ?? 0 : 0
        if (av === 0 && bv === 0) return a.company_name.localeCompare(b.company_name)
        if (av === 0) return 1   // null funding stage always to the bottom
        if (bv === 0) return -1
        return direction * (av - bv)
      })
    }

    return rows
  }, [companies, searchQuery, industryFilter, domainTagFilter, bucketFilter, statusFilter, reviewFilter, categoryFilter, taggingMethodFilter, confidenceMinFilter, fundingStageFilter, investorTierFilter, companyHighestTier, locationQuery, locationScope, sortBy, sortYear, sortFunction, scoresByCompany, functionScoreByCompany])

  const activeFilters = [industryFilter, domainTagFilter, bucketFilter, statusFilter, reviewFilter, categoryFilter, taggingMethodFilter, fundingStageFilter, investorTierFilter, locationQuery.trim()].filter(Boolean).length + (confidenceMinFilter !== '' ? 1 : 0)
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
    setFundingStageFilter('')
    setInvestorTierFilter('')
    setLocationQuery('')
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
    const successfulIds: string[] = []
    const failures: Array<{ id: string; name: string; reason: string }> = []
    for (const id of ids) {
      const name = companies.find(c => c.company_id === id)?.company_name || id
      // Cascade-delete dependents first. The companies table is referenced by
      // people.current_company_id, person_experiences.company_id, and the
      // score tables. The DB rejects DELETE on the parent without ON DELETE
      // CASCADE, so we clean up references manually.
      const { error: peopleErr } = await supabase
        .from('people')
        .update({ current_company_id: null })
        .eq('current_company_id', id)
      if (peopleErr) { failures.push({ id, name, reason: `people: ${peopleErr.message}` }); continue }

      const { error: expErr } = await supabase
        .from('person_experiences')
        .delete()
        .eq('company_id', id)
      if (expErr) { failures.push({ id, name, reason: `experiences: ${expErr.message}` }); continue }

      // Best-effort on score tables (they're unlikely to fail; ignore errors)
      await supabase.from('company_year_scores').delete().eq('company_id', id)
      await supabase.from('company_function_scores').delete().eq('company_id', id)

      const { error: delErr } = await supabase.from('companies').delete().eq('company_id', id)
      if (delErr) { failures.push({ id, name, reason: `company: ${delErr.message}` }); continue }
      successfulIds.push(id)
    }
    // Update local state from the DB truth, not optimistically
    setCompanies(prev => prev.filter(c => !successfulIds.includes(c.company_id)))
    setSelectedIds(new Set())
    setBulkDeleting(false)
    setBulkDeleteConfirm(false)
    if (failures.length > 0) {
      const detail = failures.slice(0, 5).map(f => `• ${f.name}: ${f.reason}`).join('\n')
      const more = failures.length > 5 ? `\n…and ${failures.length - 5} more` : ''
      alert(`Deleted ${successfulIds.length} of ${ids.length}. Failures:\n${detail}${more}`)
    } else if (successfulIds.length > 0) {
      // Brief success — no alert, the rows just vanish
    }
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
      <TopNav
        title="Companies"
        rightActions={
          <>
            <button
              onClick={() => router.push('/admin/companies/triage')}
              className="px-3 py-1.5 text-sm font-medium border border-border rounded-md bg-card text-foreground hover:bg-background transition"
              title="Companies needing review (unreviewed, low confidence, untagged)"
            >
              Triage
            </button>
            <button
              onClick={() => router.push('/admin/companies/new')}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-white hover:bg-accent-strong transition"
            >
              + Add company
            </button>
          </>
        }
      />

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search name, industry, tag, location, description…"
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
          <label className="block text-xs font-medium text-muted-foreground mb-1">Funding stage</label>
          <select
            value={fundingStageFilter}
            onChange={(e) => setFundingStageFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All stages</option>
            {FUNDING_STAGES.map(s => (
              <option key={s} value={s}>{FUNDING_STAGE_LABELS[s]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1" title="Substring match against company HQ + offices. Toggle to scope HQ-only.">
            Location
          </label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              placeholder="city, state, country…"
              className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ width: 180 }}
            />
            <select
              value={locationScope}
              onChange={(e) => setLocationScope(e.target.value as 'hq' | 'any')}
              className="px-2 py-2 border border-border rounded-lg text-xs bg-card focus:outline-none focus:ring-2 focus:ring-primary"
              title="Scope of location match"
            >
              <option value="any">Any office</option>
              <option value="hq">HQ only</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1" title="Show only companies whose disclosed investors include a curated tier-1 / tier-2 firm or angel.">
            Investors
          </label>
          <select
            value={investorTierFilter}
            onChange={(e) => setInvestorTierFilter(e.target.value as '' | 't1' | 't1_or_t2')}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All companies</option>
            <option value="t1">★ Tier 1 backers</option>
            <option value="t1_or_t2">Tier 1 or 2 backers</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1" title="Filter rows by their auto-tagger pipeline (admin / QA use). Most filters use Category or Review status instead.">
            Tagging method
          </label>
          <select
            value={taggingMethodFilter}
            onChange={(e) => setTaggingMethodFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary text-muted-foreground"
          >
            <option value="">All methods</option>
            <option value="untagged">Waiting for tagger</option>
            {Object.entries(TAGGING_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1" title="Show only rows where the auto-tagger was at least this confident.">Confidence ≥</label>
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
              title={SORT_OPTIONS.find(o => o.value === sortBy)?.help || ''}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value} title={o.help}>{o.label}</option>
              ))}
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
                <th className="px-1 py-3 w-7" title="Add to list" />
                <SortableTh label="Name"        ascValue="name_asc"           descValue="name_desc"           defaultDir="asc"  sortBy={sortBy} setSortBy={setSortBy} />
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider" title="HQ + offices. Click +N to see all locations.">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Industry</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Tags</th>
                <SortableTh label="Stage"       ascValue="funding_stage_asc"  descValue="funding_stage_desc"  defaultDir="asc"  sortBy={sortBy} setSortBy={setSortBy} />
                <SortableTh label="Total raised" ascValue="total_funding_asc"  descValue="total_funding_desc"  defaultDir="desc" sortBy={sortBy} setSortBy={setSortBy} />
                <SortableTh label="Founded"     ascValue="founding_year_asc"  descValue="founding_year_desc"  defaultDir="desc" sortBy={sortBy} setSortBy={setSortBy} />
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Review</th>
                <SortableTh label="Headcount"   ascValue="headcount_asc"      descValue="headcount_desc"      defaultDir="desc" sortBy={sortBy} setSortBy={setSortBy} />
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Growth</span>
                    <select
                      value={growthWindow}
                      onChange={(e) => setGrowthWindow(e.target.value as GrowthWindow)}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] uppercase tracking-wider px-1 py-0.5 border border-border rounded bg-card"
                      title="Toggle growth window"
                    >
                      <option value="3m">3m</option>
                      <option value="6m">6m</option>
                      <option value="12m">12m</option>
                    </select>
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Tagging</th>

              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={15} className="px-4 py-4 text-center text-tertiary">No companies found</td></tr>
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
                    <td className="px-1 py-3 w-7" onClick={(e) => e.stopPropagation()}>
                      <AddToListMenu itemId={c.company_id} kind="company" itemLabel={c.company_name} triggerLabel="+" className="text-tertiary hover:text-foreground" />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <CompanyLogo
                          domain={c.website_url || guessDomain(c.company_name)}
                          companyName={c.company_name}
                          logoUrl={c.logo_permalink}
                          size={20}
                        />
                        <span className="text-foreground font-medium" style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }} title={c.company_name}>
                          {c.company_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {(() => {
                        const locs = (c.locations as any) || null
                        const all = allLocations(locs)
                        const hq = locs?.headquarters || c.hq_location_name || null
                        if (!hq && all.length === 0) return <span className="text-tertiary">—</span>
                        // Use the multi-badge component for primary + N popover
                        return (
                          <IndustryBadge
                            primary={hq ? compactLocation(hq) : null}
                            industries={all.map(compactLocation)}
                            popoverLabel="All locations"
                            primaryLabel="HQ"
                            compact
                          />
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {c.category ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-muted-foreground"
                          title={c.category === 'hardware' ? 'Hardware' : 'Non-hardware'}
                        >
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${c.category === 'hardware' ? 'bg-emerald-500' : 'bg-sky-500'}`} aria-hidden />
                          {c.category === 'hardware' ? 'Hardware' : 'Non-hw'}
                        </span>
                      ) : <span className="text-tertiary">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                      <IndustryBadge primary={c.primary_industry} industries={c.industries || []} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {/* Tags compact: primary tag + +N popover (mirrors IndustryBadge style) */}
                      {c.domain_tags && c.domain_tags.length > 0 ? (
                        <IndustryBadge
                          primary={c.domain_tags[0]}
                          industries={c.domain_tags as readonly string[]}
                          compact
                        />
                      ) : <span className="text-tertiary">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {c.funding_stage
                        ? FUNDING_STAGE_LABELS[c.funding_stage as keyof typeof FUNDING_STAGE_LABELS] || c.funding_stage
                        : c.company_type === 'public'
                        ? <span className="italic text-tertiary">Public</span>
                        : c.company_type === 'subsidiary'
                        ? <span className="italic text-tertiary">Subsidiary</span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground" title={c.total_funding_usd ? `$${c.total_funding_usd.toLocaleString()}` : ''}>
                      {formatFundingAmount(c.total_funding_usd)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {c.founding_year || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                          c.review_status === 'vetted' ? 'bg-green-500'
                          : c.review_status === 'excluded' ? 'bg-red-500'
                          : 'bg-gray-400'
                        }`} aria-hidden />
                        {c.review_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {c.headcount_latest ? c.headcount_latest.toLocaleString() : (c.headcount_range || '—')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {(() => {
                        const v = growthWindow === '3m' ? c.headcount_growth_3m_pct
                          : growthWindow === '6m' ? c.headcount_growth_6m_pct
                          : c.headcount_growth_12m_pct
                        const sign = growthSign(v)
                        const color = sign === 'up' ? 'text-green-600' : sign === 'down' ? 'text-red-600' : 'text-muted-foreground'
                        return <span className={`font-mono ${color}`}>{formatGrowthPct(v)}</span>
                      })()}
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

// Header that toggles its column's sort direction on click.
// First click sets the column's "default" direction; subsequent click flips.
function SortableTh({
  label,
  ascValue,
  descValue,
  defaultDir,
  sortBy,
  setSortBy,
}: {
  label: string
  ascValue: SortBy
  descValue: SortBy
  defaultDir: 'asc' | 'desc'
  sortBy: SortBy
  setSortBy: (v: SortBy) => void
}) {
  const isActive = sortBy === ascValue || sortBy === descValue
  const isAsc = sortBy === ascValue
  const arrow = !isActive ? '' : isAsc ? '↑' : '↓'
  const onClick = () => {
    if (!isActive) setSortBy(defaultDir === 'asc' ? ascValue : descValue)
    else setSortBy(isAsc ? descValue : ascValue)
  }
  return (
    <th
      onClick={onClick}
      className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider cursor-pointer select-none hover:text-foreground"
      title={`Sort by ${label}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {arrow && <span className="text-foreground">{arrow}</span>}
      </span>
    </th>
  )
}
