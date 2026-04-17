'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Person, Experience, Education, BucketAssignment, CandidateBucket, ScoreComponent } from '../../types'

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
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [narrative, setNarrative] = useState<string | null>(null)
  const [narrativeAt, setNarrativeAt] = useState<string | null>(null)
  const [narrativeLoading, setNarrativeLoading] = useState(false)
  const [narrativeError, setNarrativeError] = useState<string | null>(null)

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
        if (p.narrative_summary) {
          setNarrative(p.narrative_summary)
          setNarrativeAt(p.narrative_summary_generated_at)
        }

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

  // Auto-generate narrative on first visit if cache is empty.
  useEffect(() => {
    if (loading || !person || narrative || narrativeLoading) return
    setNarrativeLoading(true)
    setNarrativeError(null)
    fetch(`/api/people/${params.id}/narrative`)
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
        setNarrative(data.narrative)
        setNarrativeAt(data.generated_at)
      })
      .catch(err => setNarrativeError(err.message))
      .finally(() => setNarrativeLoading(false))
  }, [loading, person, narrative, narrativeLoading, params.id])

  async function regenerateNarrative() {
    setNarrativeLoading(true)
    setNarrativeError(null)
    try {
      const r = await fetch(`/api/people/${params.id}/narrative`, { method: 'POST' })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
      setNarrative(data.narrative)
      setNarrativeAt(data.generated_at)
    } catch (err) {
      setNarrativeError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setNarrativeLoading(false)
    }
  }

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

        {/* AI narrative summary */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-blue-700 uppercase tracking-wide font-medium">Summary</p>
            <button
              onClick={regenerateNarrative}
              disabled={narrativeLoading}
              className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed underline"
            >
              {narrativeLoading ? 'Generating…' : 'Regenerate'}
            </button>
          </div>
          {narrativeError ? (
            <p className="text-sm text-red-700">Could not generate summary: {narrativeError}</p>
          ) : narrative ? (
            <>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{narrative}</p>
              {narrativeAt && (
                <p className="text-xs text-gray-400 mt-2">
                  Generated {new Date(narrativeAt).toLocaleString()}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500 italic">
              {narrativeLoading ? 'Generating summary…' : 'No summary yet.'}
            </p>
          )}
        </div>

        {/* Score breakdown — one-line summary + expandable itemized view */}
        {bucket?.assignment_reason && (
          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 uppercase mb-1">Score breakdown</p>
            <p className="text-sm font-mono text-gray-700 whitespace-pre-wrap">{bucket.assignment_reason}</p>

            {bucket.score_breakdown ? (
              <>
                <button
                  onClick={() => setBreakdownOpen(o => !o)}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  aria-expanded={breakdownOpen}
                >
                  <span className="inline-block w-3">{breakdownOpen ? '▾' : '▸'}</span>
                  {breakdownOpen ? 'Hide per-signal breakdown' : 'Show per-signal breakdown'}
                </button>
                {breakdownOpen && <ScoreBreakdownTable bucket={bucket} />}
              </>
            ) : (
              <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                No itemized breakdown on this assignment row — run batch rescore to populate.
              </p>
            )}

            <p className="text-xs text-gray-400 mt-3">
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

// ─── Score breakdown table ────────────────────────────────────────────────
// Renders each ScoreComponent (core / bonus / penalty) from the stored
// score_breakdown jsonb. Field names match lib/scoring/score-candidate.ts
// exactly — no invented labels.

const CATEGORY_STYLE: Record<ScoreComponent['category'], { label: string; cls: string }> = {
  core:    { label: 'Core',    cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  bonus:   { label: 'Bonus',   cls: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  penalty: { label: 'Penalty', cls: 'bg-red-50 text-red-800 border-red-200' },
}

function ScoreBreakdownTable({ bucket }: { bucket: BucketAssignment }) {
  const b = bucket.score_breakdown
  if (!b) return null

  // Stable ordering: core first, then bonus, then penalty.
  // Within a category, preserve the engine's emission order.
  const order: ScoreComponent['category'][] = ['core', 'bonus', 'penalty']
  const rows: ScoreComponent[] = []
  for (const cat of order) {
    for (const c of b.components) if (c.category === cat) rows.push(c)
  }

  const fmtRaw = (r: number | null) => r === null ? '—' : r.toFixed(3)
  const fmtPts = (p: number) => (p >= 0 ? '+' : '') + p.toFixed(2)

  return (
    <div className="mt-4 border border-gray-200 rounded-lg bg-white overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr className="text-gray-500 uppercase tracking-wide">
            <th className="text-left px-3 py-2 w-20">Category</th>
            <th className="text-left px-3 py-2">Signal</th>
            <th className="text-right px-3 py-2 w-16">Weight</th>
            <th className="text-right px-3 py-2 w-20">Raw</th>
            <th className="text-right px-3 py-2 w-20">Points</th>
            <th className="text-left px-3 py-2">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((c, i) => {
            const unsourced = c.category === 'bonus' && c.raw === null
            const style = CATEGORY_STYLE[c.category]
            return (
              <tr key={i} className={unsourced ? 'text-gray-400' : 'text-gray-800'}>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-medium ${style.cls}`}>
                    {style.label}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono">{c.name}</td>
                <td className="px-3 py-2 text-right font-mono">{c.weight}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtRaw(c.raw)}</td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${c.points < 0 ? 'text-red-600' : c.points > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                  {fmtPts(c.points)}
                </td>
                <td className="px-3 py-2 text-gray-500">{c.note || ''}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot className="bg-gray-50 border-t border-gray-200 font-medium">
          <tr>
            <td colSpan={4} className="px-3 py-2 text-right text-gray-500">Core</td>
            <td className="px-3 py-2 text-right font-mono">{b.core_score.toFixed(2)}</td>
            <td />
          </tr>
          <tr>
            <td colSpan={4} className="px-3 py-2 text-right text-gray-500">Bonus</td>
            <td className="px-3 py-2 text-right font-mono">{(b.bonus_score >= 0 ? '+' : '') + b.bonus_score.toFixed(2)}</td>
            <td />
          </tr>
          <tr>
            <td colSpan={4} className="px-3 py-2 text-right text-gray-500">Penalty</td>
            <td className="px-3 py-2 text-right font-mono">{b.penalty_score.toFixed(2)}</td>
            <td />
          </tr>
          <tr className="border-t border-gray-300">
            <td colSpan={4} className="px-3 py-2 text-right font-semibold">Total</td>
            <td className="px-3 py-2 text-right font-mono font-semibold">{b.total_score.toFixed(2)}</td>
            <td className="px-3 py-2 text-gray-500">
              stage: {b.scoring_stage}
              {b.applied_recruiting_override && <span className="ml-2 text-indigo-600">[recruiting override]</span>}
              {b.applied_executive_override && <span className="ml-2 text-amber-600">[executive override]</span>}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
