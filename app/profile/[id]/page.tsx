'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Person, Experience, Education, BucketAssignment, CandidateBucket } from '../../types'

function cleanCompanyName(name: string | null | undefined): string | null {
  if (!name) return null
  return name.split('·')[0].split('•')[0].trim() || null
}

const BUCKET_STYLES: Record<CandidateBucket, { label: string; bg: string; text: string; border: string }> = {
  vetted_talent:    { label: 'Vetted Talent',    bg: 'bg-emerald-50',  text: 'text-emerald-900', border: 'border-emerald-300' },
  high_potential:   { label: 'High Potential',   bg: 'bg-blue-50',     text: 'text-blue-900',    border: 'border-blue-300' },
  silver_medalist:  { label: 'Silver Medalist',  bg: 'bg-slate-50',    text: 'text-slate-900',   border: 'border-slate-300' },
  non_vetted:       { label: 'Non-Vetted',       bg: 'bg-gray-50',     text: 'text-gray-700',    border: 'border-gray-300' },
  needs_review:     { label: 'Needs Review',     bg: 'bg-amber-50',    text: 'text-amber-900',   border: 'border-amber-300' },
}

function formatDuration(months: number | null): string {
  if (!months) return ''
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y > 0 && m > 0) return `${y} yr${y !== 1 ? 's' : ''} ${m} mo${m !== 1 ? 's' : ''}`
  if (y > 0) return `${y} yr${y !== 1 ? 's' : ''}`
  return `${m} mo${m !== 1 ? 's' : ''}`
}

function formatDate(d: string | null): string {
  if (!d) return ''
  const date = new Date(d)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const [person, setPerson] = useState<Person | null>(null)
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [education, setEducation] = useState<Education[]>([])
  const [bucket, setBucket] = useState<BucketAssignment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      try {
        // Fetch person with company name
        const { data: personData, error: personErr } = await supabase
          .from('people')
          .select(`
            *,
            companies:current_company_id ( company_name )
          `)
          .eq('person_id', params.id)
          .single()

        if (personErr) throw personErr

        const p: Person = {
          ...personData,
          current_company_name: personData.companies?.company_name || null,
        }
        setPerson(p)

        // Fetch experiences with company names
        const { data: expData } = await supabase
          .from('person_experiences')
          .select(`
            *,
            companies:company_id ( company_name )
          `)
          .eq('person_id', params.id)
          .order('is_current', { ascending: false })
          .order('start_date', { ascending: false })

        const exps: Experience[] = (expData || []).map((row: any) => ({
          ...row,
          company_name: row.companies?.company_name || null,
        }))
        setExperiences(exps)

        // Fetch education with school names
        const { data: eduData } = await supabase
          .from('person_education')
          .select(`
            *,
            schools:school_id ( school_name )
          `)
          .eq('person_id', params.id)
          .order('end_year', { ascending: false })

        const edus: Education[] = (eduData || []).map((row: any) => ({
          ...row,
          school_name: row.schools?.school_name || null,
        }))
        setEducation(edus)

        // Fetch latest bucket assignment
        const { data: bucketData } = await supabase
          .from('candidate_bucket_assignments')
          .select('*')
          .eq('person_id', params.id)
          .order('effective_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        setBucket(bucketData as BucketAssignment | null)
      } catch (err) {
        console.error('Error fetching person:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading profile...</div>
      </div>
    )
  }

  if (!person) {
    return (
      <div className="p-6">
        <div className="text-red-600">Person not found</div>
        <button
          onClick={() => router.push('/')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to List
        </button>
      </div>
    )
  }

  const companyName = cleanCompanyName(person.current_company_name)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => router.push('/')}
        className="mb-6 text-blue-600 hover:text-blue-800"
      >
        ← Back to List
      </button>

      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{person.full_name}</h1>
              {person.headline_raw && (
                <p className="text-gray-600 mt-1">{person.headline_raw}</p>
              )}
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                {person.location_name && <span>{person.location_name}</span>}
                {person.linkedin_url && (
                  <a
                    href={person.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    LinkedIn
                  </a>
                )}
              </div>
            </div>

            {/* Bucket badge */}
            {bucket && (
              <div className={`px-4 py-2 rounded-lg border-2 ${BUCKET_STYLES[bucket.candidate_bucket].bg} ${BUCKET_STYLES[bucket.candidate_bucket].border}`}>
                <p className="text-xs uppercase tracking-wide text-gray-500">Bucket</p>
                <p className={`text-lg font-bold ${BUCKET_STYLES[bucket.candidate_bucket].text}`}>
                  {BUCKET_STYLES[bucket.candidate_bucket].label}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Score breakdown */}
        {bucket?.assignment_reason && (
          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 uppercase mb-1">Score breakdown</p>
            <p className="text-sm font-mono text-gray-700 whitespace-pre-wrap">{bucket.assignment_reason}</p>
            <p className="text-xs text-gray-400 mt-2">
              Assigned by {bucket.assigned_by} on {new Date(bucket.effective_at).toLocaleString()}
            </p>
          </div>
        )}

        {/* Derived signals */}
        <div className="flex flex-wrap gap-2 mb-6">
          {person.career_progression && (
            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs border border-indigo-200">
              progression: {person.career_progression}
            </span>
          )}
          {person.highest_seniority_reached && (
            <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs border border-purple-200">
              top seniority: {person.highest_seniority_reached.replace(/_/g, ' ')}
            </span>
          )}
          {person.has_early_stage_experience && (
            <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs border border-orange-200">
              early-stage experience ({person.early_stage_companies_count})
            </span>
          )}
          {person.has_hypergrowth_experience && (
            <span className="px-2 py-1 bg-pink-50 text-pink-700 rounded text-xs border border-pink-200">
              hypergrowth experience ({person.hypergrowth_companies_count})
            </span>
          )}
        </div>

        {/* Overview grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs text-gray-500 uppercase">Title</p>
            <p className="font-medium text-sm">{person.current_title_normalized || person.current_title_raw || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Company</p>
            <p className="font-medium text-sm">{companyName || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Experience</p>
            <p className="font-medium text-sm">{person.years_experience_estimate != null ? `${person.years_experience_estimate} years` : 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Stage</p>
            <p className="font-medium text-sm">{person.career_stage_assigned?.replace(/_/g, ' ') || 'N/A'}</p>
          </div>
        </div>

        {/* Summary */}
        {person.summary_raw && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3">About</h2>
            <p className="text-gray-700 whitespace-pre-wrap text-sm">{person.summary_raw}</p>
          </div>
        )}

        {/* Experience */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">
            Experience {experiences.length > 0 && <span className="text-gray-400 font-normal">({experiences.length})</span>}
          </h2>
          {experiences.length === 0 ? (
            <p className="text-gray-500 text-sm">No experience data yet</p>
          ) : (
            <div className="space-y-4">
              {experiences.map((exp) => (
                <div key={exp.person_experience_id} className="border-l-2 border-gray-200 pl-4 py-1">
                  <p className="font-medium">
                    {exp.title_normalized || exp.title_raw || 'Unknown title'}
                  </p>
                  <p className="text-gray-700 text-sm">
                    {cleanCompanyName(exp.company_name) || 'Unknown company'}
                    {exp.employment_type_normalized && exp.employment_type_normalized !== 'unknown' && (
                      <span className="text-gray-500"> · {exp.employment_type_normalized.replace(/_/g, ' ')}</span>
                    )}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {exp.start_date && formatDate(exp.start_date)}
                    {exp.start_date && ' — '}
                    {exp.is_current ? 'Present' : (exp.end_date ? formatDate(exp.end_date) : '')}
                    {exp.duration_months ? ` · ${formatDuration(exp.duration_months)}` : ''}
                  </p>
                  {exp.description_raw && (
                    <p className="text-gray-600 text-sm mt-1">{exp.description_raw}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Education */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">
            Education {education.length > 0 && <span className="text-gray-400 font-normal">({education.length})</span>}
          </h2>
          {education.length === 0 ? (
            <p className="text-gray-500 text-sm">No education data yet</p>
          ) : (
            <div className="space-y-4">
              {education.map((edu) => (
                <div key={edu.person_education_id} className="border-l-2 border-gray-200 pl-4 py-1">
                  <p className="font-medium">
                    {edu.school_name || edu.school_name_raw || 'Unknown school'}
                  </p>
                  {(edu.degree_normalized || edu.degree_raw || edu.field_of_study_raw) && (
                    <p className="text-gray-700 text-sm">
                      {edu.degree_normalized || edu.degree_raw}
                      {edu.field_of_study_normalized || edu.field_of_study_raw
                        ? `, ${edu.field_of_study_normalized || edu.field_of_study_raw}`
                        : ''}
                    </p>
                  )}
                  {(edu.start_year || edu.end_year) && (
                    <p className="text-gray-500 text-xs mt-0.5">
                      {edu.start_year && `${edu.start_year}`}
                      {edu.start_year && edu.end_year && ' — '}
                      {edu.end_year && `${edu.end_year}`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timestamps */}
        <div className="pt-6 border-t border-gray-200 text-xs text-gray-400">
          <p>Added: {new Date(person.created_at).toLocaleString()}</p>
          <p>Updated: {new Date(person.updated_at).toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}
