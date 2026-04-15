'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Person, SortField, SortDirection, CandidateBucket } from '../types'
import ProfileDrawer from './ProfileDrawer'

/** Strip employment type from company name: "Acme · Full-time" → "Acme" */
function cleanCompanyName(name: string | null | undefined): string | null {
  if (!name) return null
  return name.split('·')[0].split('•')[0].trim() || null
}

const BUCKET_STYLES: Record<CandidateBucket, { label: string; className: string }> = {
  vetted_talent:    { label: 'Vetted Talent',    className: 'bg-emerald-100 text-emerald-800 border border-emerald-300' },
  high_potential:   { label: 'High Potential',   className: 'bg-blue-100 text-blue-800 border border-blue-300' },
  silver_medalist:  { label: 'Silver Medalist',  className: 'bg-slate-200 text-slate-800 border border-slate-300' },
  non_vetted:       { label: 'Non-Vetted',       className: 'bg-gray-100 text-gray-600 border border-gray-300' },
  needs_review:     { label: 'Needs Review',     className: 'bg-amber-100 text-amber-800 border border-amber-300' },
}

function BucketChip({ bucket }: { bucket: CandidateBucket | null | undefined }) {
  if (!bucket) return <span className="text-xs text-gray-400">Unscored</span>
  const s = BUCKET_STYLES[bucket]
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  )
}

const BUCKET_OPTIONS: Array<{ value: CandidateBucket; label: string }> = [
  { value: 'vetted_talent',   label: 'Vetted Talent' },
  { value: 'high_potential',  label: 'High Potential' },
  { value: 'silver_medalist', label: 'Silver Medalist' },
  { value: 'non_vetted',      label: 'Non-Vetted' },
  { value: 'needs_review',    label: 'Needs Review' },
]

const STAGE_OPTIONS = [
  { value: 'pre_career',    label: 'Pre-Career' },
  { value: 'early_career',  label: 'Early Career' },
  { value: 'mid_career',    label: 'Mid Career' },
  { value: 'senior_career', label: 'Senior Career' },
]

export default function ProfileTable() {
  const router = useRouter()
  const [people, setPeople] = useState<Person[]>([])
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Facet filters
  const [bucketFilter, setBucketFilter] = useState<string>('')
  const [stageFilter, setStageFilter] = useState<string>('')
  const [functionFilter, setFunctionFilter] = useState<string>('')
  const [seniorityFilter, setSeniorityFilter] = useState<string>('')

  // Dropdown option sources (fetched from dictionaries)
  const [functionOptions, setFunctionOptions] = useState<string[]>([])
  const [seniorityOptions, setSeniorityOptions] = useState<string[]>([])

  useEffect(() => {
    async function fetchPeople() {
      try {
        // Query people table with company name join
        const { data, error } = await supabase
          .from('people')
          .select(`
            *,
            companies:current_company_id ( company_name )
          `)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Supabase error:', error)
          setError(`Database error: ${error.message}`)
          return
        }

        // Fetch latest bucket assignments for all people in parallel
        const { data: bucketData } = await supabase
          .from('candidate_bucket_assignments')
          .select('person_id, candidate_bucket, assignment_reason, effective_at')
          .order('effective_at', { ascending: false })

        // Keep only the most recent per person
        const latestBucketByPerson: Record<string, { bucket: CandidateBucket; reason: string | null }> = {}
        for (const row of bucketData || []) {
          if (!latestBucketByPerson[row.person_id]) {
            latestBucketByPerson[row.person_id] = {
              bucket: row.candidate_bucket as CandidateBucket,
              reason: row.assignment_reason,
            }
          }
        }

        const rows: Person[] = (data || []).map((row: any) => ({
          ...row,
          current_company_name: row.companies?.company_name || null,
          latest_bucket: latestBucketByPerson[row.person_id]?.bucket ?? null,
          latest_bucket_reason: latestBucketByPerson[row.person_id]?.reason ?? null,
        }))

        setPeople(rows)
        setError(null)
      } catch (err: any) {
        console.error('Error fetching people:', err)
        setError(err?.message || 'Failed to fetch people.')
      } finally {
        setLoading(false)
      }
    }
    fetchPeople()
  }, [])

  // Load filter option sources once
  useEffect(() => {
    async function loadOptions() {
      const { data: fns } = await supabase
        .from('function_dictionary')
        .select('function_normalized')
        .eq('active', true)
        .order('function_normalized')
      setFunctionOptions((fns || []).map(f => f.function_normalized))

      const { data: srs } = await supabase
        .from('seniority_dictionary')
        .select('seniority_normalized, rank_order')
        .eq('active', true)
        .order('rank_order')
      setSeniorityOptions((srs || []).map(s => s.seniority_normalized))
    }
    loadOptions()
  }, [])

  // Filter + sort
  useEffect(() => {
    let filtered = [...people]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(p =>
        p.full_name?.toLowerCase().includes(q) ||
        p.current_company_name?.toLowerCase().includes(q) ||
        p.current_title_raw?.toLowerCase().includes(q) ||
        p.location_name?.toLowerCase().includes(q)
      )
    }

    if (bucketFilter) {
      filtered = filtered.filter(p => p.latest_bucket === bucketFilter)
    }
    if (stageFilter) {
      filtered = filtered.filter(p => p.career_stage_assigned === stageFilter)
    }
    if (functionFilter) {
      filtered = filtered.filter(p => p.current_function_normalized === functionFilter)
    }
    if (seniorityFilter) {
      filtered = filtered.filter(p => p.highest_seniority_reached === seniorityFilter)
    }

    if (sortField) {
      filtered.sort((a, b) => {
        const aVal = (a[sortField] as number) ?? -1
        const bVal = (b[sortField] as number) ?? -1
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      })
    }

    setFilteredPeople(filtered)
  }, [people, searchQuery, bucketFilter, stageFilter, functionFilter, seniorityFilter, sortField, sortDirection])

  const activeFilterCount = [bucketFilter, stageFilter, functionFilter, seniorityFilter].filter(Boolean).length
  const clearAllFilters = () => {
    setSearchQuery('')
    setBucketFilter('')
    setStageFilter('')
    setFunctionFilter('')
    setSeniorityFilter('')
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading people...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Vetted Database</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <h2 className="text-red-800 font-semibold mb-2">Error Loading Data</h2>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Vetted Database</h1>
        <div className="flex gap-4 text-sm">
          <a href="/admin/import" className="text-blue-600 hover:text-blue-800 underline">
            Import from Crust →
          </a>
          <a href="/admin/companies" className="text-blue-600 hover:text-blue-800 underline">
            Manage companies →
          </a>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, company, title, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Faceted filters */}
      <div className="mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bucket</label>
          <select
            value={bucketFilter}
            onChange={(e) => setBucketFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All buckets</option>
            {BUCKET_OPTIONS.map(b => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Career Stage</label>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All stages</option>
            {STAGE_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Function</label>
          <select
            value={functionFilter}
            onChange={(e) => setFunctionFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All functions</option>
            {functionOptions.map(f => (
              <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Highest Seniority</label>
          <select
            value={seniorityFilter}
            onChange={(e) => setSeniorityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All seniorities</option>
            {seniorityOptions.map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {(activeFilterCount > 0 || searchQuery) && (
          <button
            onClick={clearAllFilters}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-gray-600">
        Showing {filteredPeople.length} of {people.length} people
        {activeFilterCount > 0 && ` (${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active)`}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bucket
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('years_experience_estimate')}
                >
                  Yrs {sortField === 'years_experience_estimate' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  LinkedIn
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPeople.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center text-gray-500">
                    No people found
                  </td>
                </tr>
              ) : (
                filteredPeople.map((person) => (
                  <tr
                    key={person.person_id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setSelectedPerson(person)
                      setIsDrawerOpen(true)
                    }}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/profile/${person.person_id}`)
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {person.full_name || 'N/A'}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <BucketChip bucket={person.latest_bucket} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {person.location_name || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {cleanCompanyName(person.current_company_name) || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {person.current_title_normalized || person.current_title_raw || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {person.years_experience_estimate ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {person.career_stage_assigned?.replace(/_/g, ' ') || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {person.linkedin_url ? (
                        <a
                          href={person.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          View
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProfileDrawer
        person={selectedPerson}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false)
          setSelectedPerson(null)
        }}
      />
    </div>
  )
}
