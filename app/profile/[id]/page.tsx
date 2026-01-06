'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Profile } from '../../types'

export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', params.id)
          .single()

        if (error) throw error
        setProfile(data)
      } catch (error) {
        console.error('Error fetching profile:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading profile...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-6">
        <div className="text-red-600">Profile not found</div>
        <button
          onClick={() => router.push('/')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to List
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => router.push('/')}
        className="mb-6 text-blue-600 hover:text-blue-800"
      >
        ← Back to List
      </button>

      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6">{profile.full_name || 'Unnamed Profile'}</h1>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Location</label>
              <p className="text-gray-900">{profile.location_resolved || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Current Company</label>
              <p className="text-gray-900">{profile.current_company || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Current Title</label>
              <p className="text-gray-900">{profile.current_title || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Years of Experience</label>
              <p className="text-gray-900">{profile.years_experience ?? 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Years at Current Company</label>
              <p className="text-gray-900">{profile.years_at_current_company ?? 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">LinkedIn</label>
              {profile.linkedin_url ? (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  View Profile
                </a>
              ) : (
                <p className="text-gray-900">N/A</p>
              )}
            </div>
          </div>

          {/* Tags */}
          {profile.skills_tags && profile.skills_tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Skills</label>
              <div className="flex flex-wrap gap-2">
                {profile.skills_tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.focus_area_tags && profile.focus_area_tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Focus Areas</label>
              <div className="flex flex-wrap gap-2">
                {profile.focus_area_tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.excellence_tags && profile.excellence_tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Excellence</label>
              <div className="flex flex-wrap gap-2">
                {profile.excellence_tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.domain_tags && profile.domain_tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Domains</label>
              <div className="flex flex-wrap gap-2">
                {profile.domain_tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {profile.notes && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Notes</label>
              <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                {profile.notes}
              </p>
            </div>
          )}

          {/* Timestamps */}
          <div className="pt-6 border-t border-gray-200 text-sm text-gray-500">
            {profile.created_at && (
              <p>Created: {new Date(profile.created_at).toLocaleString()}</p>
            )}
            {profile.updated_at && (
              <p>Updated: {new Date(profile.updated_at).toLocaleString()}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


