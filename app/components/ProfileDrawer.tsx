'use client'

import { Profile } from '../types'

interface ProfileDrawerProps {
  profile: Profile | null
  isOpen: boolean
  onClose: () => void
}

export default function ProfileDrawer({ profile, isOpen, onClose }: ProfileDrawerProps) {
  if (!isOpen || !profile) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Profile Details</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {profile.linkedin_url && (
              <div>
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  View LinkedIn Profile
                </a>
              </div>
            )}

            {/* Tags */}
            {profile.skills_tags && profile.skills_tags.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm text-gray-600 mb-2">Skills</h3>
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
                <h3 className="font-semibold text-sm text-gray-600 mb-2">Focus Areas</h3>
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
                <h3 className="font-semibold text-sm text-gray-600 mb-2">Excellence</h3>
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
                <h3 className="font-semibold text-sm text-gray-600 mb-2">Domains</h3>
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
                <h3 className="font-semibold text-sm text-gray-600 mb-2">Notes</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{profile.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

