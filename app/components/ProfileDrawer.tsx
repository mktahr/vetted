'use client'

import { Person, CandidateBucket } from '../types'

interface ProfileDrawerProps {
  person: Person | null
  isOpen: boolean
  onClose: () => void
}

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

export default function ProfileDrawer({ person, isOpen, onClose }: ProfileDrawerProps) {
  if (!isOpen || !person) return null

  const companyName = cleanCompanyName(person.current_company_name)

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
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold">{person.full_name}</h2>
              {person.latest_bucket && (
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${BUCKET_STYLES[person.latest_bucket].className}`}>
                  {BUCKET_STYLES[person.latest_bucket].label}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Score breakdown */}
          {person.latest_bucket_reason && (
            <div className="mb-4 p-2 bg-gray-50 rounded text-xs font-mono text-gray-600">
              {person.latest_bucket_reason}
            </div>
          )}

          {/* Content */}
          <div className="space-y-4">
            {/* Current role */}
            {(person.current_title_raw || companyName) && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Current Role</h3>
                <p className="text-gray-900 font-medium">
                  {person.current_title_normalized || person.current_title_raw || 'N/A'}
                </p>
                {companyName && (
                  <p className="text-gray-700">{companyName}</p>
                )}
              </div>
            )}

            {/* Location */}
            {person.location_name && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Location</h3>
                <p className="text-gray-900">{person.location_name}</p>
              </div>
            )}

            {/* Experience */}
            {person.years_experience_estimate != null && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Experience</h3>
                <p className="text-gray-900">
                  {person.years_experience_estimate} years
                  {person.career_stage_assigned && (
                    <span className="ml-2 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      {person.career_stage_assigned.replace(/_/g, ' ')}
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Function */}
            {person.current_function_normalized && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Function</h3>
                <p className="text-gray-900">{person.current_function_normalized.replace(/_/g, ' ')}</p>
              </div>
            )}

            {/* Headline */}
            {person.headline_raw && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Headline</h3>
                <p className="text-gray-700 text-sm">{person.headline_raw}</p>
              </div>
            )}

            {/* LinkedIn */}
            {person.linkedin_url && (
              <div>
                <a
                  href={person.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline text-sm"
                >
                  View LinkedIn Profile
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
