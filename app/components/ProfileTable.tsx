'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Profile, SortField, SortDirection } from '../types'
import ProfileDrawer from './ProfileDrawer'

export default function ProfileTable() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  
  // Tag filters
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<Set<string>>(new Set())
  const [selectedExcellence, setSelectedExcellence] = useState<Set<string>>(new Set())
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set())

  // Fetch all profiles
  useEffect(() => {
    async function fetchProfiles() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        setProfiles(data || [])
      } catch (error) {
        console.error('Error fetching profiles:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProfiles()
  }, [])

  // Get all unique tags for filters
  const allSkills = Array.from(
    new Set(profiles.flatMap(p => p.skills_tags || []))
  ).sort()
  const allFocusAreas = Array.from(
    new Set(profiles.flatMap(p => p.focus_area_tags || []))
  ).sort()
  const allExcellence = Array.from(
    new Set(profiles.flatMap(p => p.excellence_tags || []))
  ).sort()
  const allDomains = Array.from(
    new Set(profiles.flatMap(p => p.domain_tags || []))
  ).sort()

  // Filter and sort profiles
  useEffect(() => {
    let filtered = [...profiles]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(p => 
        (p.full_name?.toLowerCase().includes(query)) ||
        (p.current_company?.toLowerCase().includes(query)) ||
        (p.current_title?.toLowerCase().includes(query)) ||
        (p.location_resolved?.toLowerCase().includes(query))
      )
    }

    // Tag filters
    if (selectedSkills.size > 0) {
      filtered = filtered.filter(p => 
        p.skills_tags?.some(tag => selectedSkills.has(tag))
      )
    }
    if (selectedFocusAreas.size > 0) {
      filtered = filtered.filter(p => 
        p.focus_area_tags?.some(tag => selectedFocusAreas.has(tag))
      )
    }
    if (selectedExcellence.size > 0) {
      filtered = filtered.filter(p => 
        p.excellence_tags?.some(tag => selectedExcellence.has(tag))
      )
    }
    if (selectedDomains.size > 0) {
      filtered = filtered.filter(p => 
        p.domain_tags?.some(tag => selectedDomains.has(tag))
      )
    }

    // Sorting
    if (sortField) {
      filtered.sort((a, b) => {
        const aVal = a[sortField] ?? 0
        const bVal = b[sortField] ?? 0
        if (sortDirection === 'asc') {
          return (aVal as number) - (bVal as number)
        } else {
          return (bVal as number) - (aVal as number)
        }
      })
    }

    setFilteredProfiles(filtered)
  }, [profiles, searchQuery, selectedSkills, selectedFocusAreas, selectedExcellence, selectedDomains, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const toggleTagFilter = (
    tag: string,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>
  ) => {
    setter(prev => {
      const next = new Set(prev)
      if (next.has(tag)) {
        next.delete(tag)
      } else {
        next.add(tag)
      }
      return next
    })
  }

  const clearAllFilters = () => {
    setSearchQuery('')
    setSelectedSkills(new Set())
    setSelectedFocusAreas(new Set())
    setSelectedExcellence(new Set())
    setSelectedDomains(new Set())
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading profiles...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Recruiting Database</h1>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search by name, company, title, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {(searchQuery || selectedSkills.size > 0 || selectedFocusAreas.size > 0 || 
            selectedExcellence.size > 0 || selectedDomains.size > 0) && (
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Tag Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {allSkills.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Skills ({selectedSkills.size} selected)
              </label>
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded p-2">
                {allSkills.map(tag => (
                  <label key={tag} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedSkills.has(tag)}
                      onChange={() => toggleTagFilter(tag, setSelectedSkills)}
                      className="rounded"
                    />
                    <span>{tag}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {allFocusAreas.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Focus Areas ({selectedFocusAreas.size} selected)
              </label>
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded p-2">
                {allFocusAreas.map(tag => (
                  <label key={tag} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedFocusAreas.has(tag)}
                      onChange={() => toggleTagFilter(tag, setSelectedFocusAreas)}
                      className="rounded"
                    />
                    <span>{tag}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {allExcellence.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Excellence ({selectedExcellence.size} selected)
              </label>
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded p-2">
                {allExcellence.map(tag => (
                  <label key={tag} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedExcellence.has(tag)}
                      onChange={() => toggleTagFilter(tag, setSelectedExcellence)}
                      className="rounded"
                    />
                    <span>{tag}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {allDomains.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Domains ({selectedDomains.size} selected)
              </label>
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded p-2">
                {allDomains.map(tag => (
                  <label key={tag} className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedDomains.has(tag)}
                      onChange={() => toggleTagFilter(tag, setSelectedDomains)}
                      className="rounded"
                    />
                    <span>{tag}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-gray-600">
        Showing {filteredProfiles.length} of {profiles.length} profiles
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('years_experience')}
                >
                  Years Exp {sortField === 'years_experience' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('years_at_current_company')}
                >
                  Years @ Co {sortField === 'years_at_current_company' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  LinkedIn
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No profiles found
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((profile) => (
                  <tr
                    key={profile.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setSelectedProfile(profile)
                      setIsDrawerOpen(true)
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/profile/${profile.id}`)
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {profile.full_name || 'N/A'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {profile.location_resolved || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {profile.current_company || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {profile.current_title || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {profile.years_experience ?? 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {profile.years_at_current_company ?? 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {profile.linkedin_url ? (
                        <a
                          href={profile.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          View
                        </a>
                      ) : (
                        'N/A'
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
        profile={selectedProfile}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false)
          setSelectedProfile(null)
        }}
      />
    </div>
  )
}

