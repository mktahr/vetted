'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Company, CompanyBucket, CompanyStatus, CompanyYearScore, CompanyFunctionScore } from '@/app/types'
import CompanyLogo, { guessDomain } from '@/app/components/CompanyLogo'

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

type SortBy = 'name_asc' | 'name_desc' | 'year_score' | 'function_score'

export default function CompaniesListPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [yearScoresAll, setYearScoresAll] = useState<CompanyYearScore[]>([])
  const [functionScoresAll, setFunctionScoresAll] = useState<CompanyFunctionScore[]>([])
  const [functionOptions, setFunctionOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [industryFilter, setIndustryFilter] = useState('')
  const [bucketFilter, setBucketFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

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

        const { data: fns } = await supabase
          .from('function_dictionary')
          .select('function_normalized')
          .eq('active', true)
          .order('function_normalized')
        setFunctionOptions((fns || []).map(f => f.function_normalized))
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
  }, [companies, searchQuery, industryFilter, bucketFilter, statusFilter, sortBy, sortYear, sortFunction, scoresByCompany, functionScoreByCompany])

  const activeFilters = [industryFilter, bucketFilter, statusFilter].filter(Boolean).length
  const clearAll = () => {
    setSearchQuery('')
    setIndustryFilter('')
    setBucketFilter('')
    setStatusFilter('')
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
    if (rows.length === 0) return <span className="text-xs text-gray-400">—</span>
    const latest = rows[0]
    const min = Math.min(...rows.map(r => r.company_score))
    const max = Math.max(...rows.map(r => r.company_score))
    const label = min === max ? `${min}` : `${min}–${max}`
    return (
      <span className="text-xs text-gray-700" title={rows.map(r => `${r.year}: ${r.company_score}`).join('\n')}>
        <span className="font-semibold">{latest.year}: {latest.company_score}</span>
        <span className="text-gray-500 ml-2">({rows.length}yrs, range {label})</span>
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading companies...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-semibold mb-2">Error</h2>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <a href="/" className="text-sm text-blue-600 hover:text-blue-800">← Back to people</a>
          <h1 className="text-3xl font-bold mt-2">Companies</h1>
        </div>
        <button
          onClick={() => router.push('/admin/companies/new')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Company
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Filters + Sort */}
      <div className="mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Industry</label>
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All industries</option>
            {industryOptions.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bucket</label>
          <select
            value={bucketFilter}
            onChange={(e) => setBucketFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All buckets</option>
            {BUCKET_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="border-l border-gray-300 pl-3 ml-2 flex gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name_asc">Name (A→Z)</option>
              <option value="name_desc">Name (Z→A)</option>
              <option value="year_score">Year Score</option>
              <option value="function_score">Top by Function</option>
            </select>
          </div>

          {sortBy === 'year_score' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
              <select
                value={sortYear}
                onChange={(e) => setSortYear(parseInt(e.target.value, 10))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {yearRange.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {sortBy === 'function_score' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Function</label>
              <select
                value={sortFunction}
                onChange={(e) => setSortFunction(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Pick one…</option>
                {functionOptions.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          )}
        </div>

        {(activeFilters > 0 || searchQuery) && (
          <button
            onClick={clearAll}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mb-4 text-sm text-gray-600">
        Showing {filtered.length} of {companies.length} companies
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Industry</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Founded</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bucket</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year Scores</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Links</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-4 text-center text-gray-500">No companies found</td></tr>
              ) : (
                filtered.map(c => (
                  <tr
                    key={c.company_id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/admin/companies/${c.company_id}`)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <CompanyLogo domain={guessDomain(c.company_name)} companyName={c.company_name} size={20} />
                        <span className="text-blue-600 font-medium">{c.company_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{c.primary_industry_tag || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{c.founding_year ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 capitalize">{c.current_status.replace('_', ' ')}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {c.company_bucket ? c.company_bucket.replace(/_/g, ' ') : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{renderYearScores(c.company_id)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {c.linkedin_url && (
                          <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800" title="LinkedIn">
                            LI
                          </a>
                        )}
                        {(c.website_url || guessDomain(c.company_name)) && (
                          <a
                            href={c.website_url || `https://${guessDomain(c.company_name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-500 hover:text-gray-700"
                            title="Website"
                          >
                            www
                          </a>
                        )}
                        {!c.linkedin_url && !c.website_url && !guessDomain(c.company_name) && '—'}
                      </div>
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
