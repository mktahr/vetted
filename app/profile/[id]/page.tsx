'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Person, Experience, Education, BucketAssignment, CandidateBucket, ClearanceLevel, ScoreComponent } from '../../types'
import CompanyLogo, { guessDomain } from '../../components/CompanyLogo'

function cleanCompanyName(name: string | null | undefined): string | null {
  if (!name) return null
  return name.split('·')[0].split('•')[0].trim() || null
}

const BUCKET_STYLES: Record<CandidateBucket, { label: string; bg: string; text: string; border: string }> = {
  vetted_talent:    { label: 'Vetted Talent',    bg: 'bg-positive/10',  text: 'text-positive', border: 'border-positive/30' },
  high_potential:   { label: 'High Potential',   bg: 'bg-selected',     text: 'text-foreground',    border: 'border-primary' },
  silver_medalist:  { label: 'Silver Medalist',  bg: 'bg-muted',    text: 'text-foreground',   border: 'border-border' },
  non_vetted:       { label: 'Non-Vetted',       bg: 'bg-background',     text: 'text-muted-foreground',    border: 'border-border' },
  needs_review:     { label: 'Needs Review',     bg: 'bg-watch/10',    text: 'text-watch',   border: 'border-watch/30' },
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
  const [skillsTags, setSkillsTags] = useState<string[]>([])
  const [skillsOpen, setSkillsOpen] = useState(false)

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

        // Fetch skills from the latest profile snapshot's canonical_json
        const { data: snapData } = await supabase
          .from('profile_snapshots')
          .select('canonical_json')
          .eq('linkedin_url', p.linkedin_url)
          .order('scraped_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const skills = (snapData?.canonical_json as Record<string, unknown>)?.skills_tags
        if (Array.isArray(skills) && skills.length > 0) {
          setSkillsTags(skills as string[])
        }
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

  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Editable clearance fields
  const [clearanceLevel, setClearanceLevel] = useState<ClearanceLevel>('unknown')
  const [clearanceNotes, setClearanceNotes] = useState<string>('')
  const [clearanceSaving, setClearanceSaving] = useState(false)
  const [clearanceMsg, setClearanceMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (person) {
      setClearanceLevel(person.clearance_level || 'unknown')
      setClearanceNotes(person.clearance_notes || '')
    }
  }, [person])

  async function handleSaveClearance() {
    setClearanceSaving(true)
    setClearanceMsg(null)
    try {
      const { error } = await supabase
        .from('people')
        .update({ clearance_level: clearanceLevel, clearance_notes: clearanceNotes || null })
        .eq('person_id', params.id as string)
      if (error) throw error
      setClearanceMsg({ text: 'Saved', ok: true })
      setPerson(prev => prev ? { ...prev, clearance_level: clearanceLevel, clearance_notes: clearanceNotes || null } : prev)
    } catch (err: any) {
      setClearanceMsg({ text: `Save failed: ${err.message}`, ok: false })
    } finally {
      setClearanceSaving(false)
      setTimeout(() => setClearanceMsg(null), 2500)
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setDeleting(true)
    try {
      const r = await fetch(`/api/people/${params.id}`, { method: 'DELETE' })
      if (!r.ok) {
        const data = await r.json()
        alert(`Delete failed: ${data.error}`)
        return
      }
      router.push('/')
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDeleting(false)
      setDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64vh', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)', background: 'var(--bg-canvas)' }}>
        Loading profile...
      </div>
    )
  }

  if (!person) {
    return (
      <div style={{ padding: 24, background: 'var(--bg-canvas)', color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>
        <div style={{ color: 'var(--red-400)' }}>Person not found</div>
        <button
          onClick={() => router.push('/')}
          style={{ marginTop: 16, padding: '8px 16px', background: 'var(--accent-500)', color: 'var(--fg-on-accent)', border: 'none', borderRadius: 'var(--r-button)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
        >
          Back to List
        </button>
      </div>
    )
  }

  const companyName = cleanCompanyName(person.current_company_name)

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', background: 'var(--bg-canvas)', color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push('/')}
          className="text-primary hover:text-accent-strong"
        >
          ← Back to List
        </button>
        <button
          onClick={handleDelete}
          onBlur={() => setDeleteConfirm(false)}
          disabled={deleting}
          className={`px-3 py-1.5 text-sm rounded-lg border ${
            deleteConfirm
              ? 'bg-destructive text-white border-red-600 hover:bg-destructive'
              : 'text-destructive border-destructive/30 hover:bg-destructive/10'
          } disabled:opacity-50`}
        >
          {deleting ? 'Deleting…' : deleteConfirm ? 'Click again to confirm' : 'Delete'}
        </button>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-card)', padding: 32 }}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{person.full_name}</h1>
              {person.headline_raw && (
                <p className="text-muted-foreground mt-1">{person.headline_raw}</p>
              )}
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-tertiary">
                {person.location_name && <span>{person.location_name}</span>}
                {person.linkedin_url && (
                  <a
                    href={person.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-accent-strong underline"
                  >
                    LinkedIn
                  </a>
                )}
              </div>
            </div>

            {/* Bucket badge */}
            {bucket && (
              <div className={`px-4 py-2 rounded-lg border-2 ${BUCKET_STYLES[bucket.candidate_bucket].bg} ${BUCKET_STYLES[bucket.candidate_bucket].border}`}>
                <p className="text-xs uppercase tracking-wide text-tertiary">Bucket</p>
                <p className={`text-lg font-bold ${BUCKET_STYLES[bucket.candidate_bucket].text}`}>
                  {BUCKET_STYLES[bucket.candidate_bucket].label}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* AI narrative summary */}
        <div className="mb-6 p-4 bg-selected border border-primary rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-primary uppercase tracking-wide font-medium">Summary</p>
            <button
              onClick={regenerateNarrative}
              disabled={narrativeLoading}
              className="text-xs text-primary hover:text-accent-strong disabled:opacity-50 disabled:cursor-not-allowed underline"
            >
              {narrativeLoading ? 'Generating…' : 'Regenerate'}
            </button>
          </div>
          {narrativeError ? (
            <p className="text-sm text-destructive">Could not generate summary: {narrativeError}</p>
          ) : narrative ? (
            <>
              <p className="text-sm text-foreground whitespace-pre-wrap">{narrative}</p>
              {narrativeAt && (
                <p className="text-xs text-tertiary mt-2">
                  Generated {new Date(narrativeAt).toLocaleString()}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-tertiary italic">
              {narrativeLoading ? 'Generating summary…' : 'No summary yet.'}
            </p>
          )}
        </div>

        {/* Score breakdown — one-line summary + expandable itemized view */}
        {bucket?.assignment_reason && (
          <div className="mb-8 p-4 bg-background rounded-lg">
            <p className="text-xs text-tertiary uppercase mb-1">Score breakdown</p>
            <p className="text-sm font-mono text-muted-foreground whitespace-pre-wrap">{bucket.assignment_reason}</p>

            {bucket.score_breakdown ? (
              <>
                <button
                  onClick={() => setBreakdownOpen(o => !o)}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:text-accent-strong"
                  aria-expanded={breakdownOpen}
                >
                  <span className="inline-block w-3">{breakdownOpen ? '▾' : '▸'}</span>
                  {breakdownOpen ? 'Hide per-signal breakdown' : 'Show per-signal breakdown'}
                </button>
                {breakdownOpen && <ScoreBreakdownTable bucket={bucket} />}
              </>
            ) : (
              <p className="mt-3 text-xs text-watch bg-watch/10 border border-watch/30 rounded px-2 py-1 inline-block">
                No itemized breakdown on this assignment row — run batch rescore to populate.
              </p>
            )}

            <p className="text-xs text-tertiary mt-3">
              Assigned by {bucket.assigned_by} on {new Date(bucket.effective_at).toLocaleString()}
            </p>
          </div>
        )}

        {/* Derived signals */}
        <div className="flex flex-wrap gap-2 mb-6">
          {person.primary_specialty ? (
            <span className="px-2 py-1 bg-info/10 text-info rounded text-xs border border-info/30">
              {person.primary_specialty.replace(/_/g, ' ')}
            </span>
          ) : (
            <span className="px-2 py-1 bg-background text-tertiary rounded text-xs border border-border">
              specialty: unknown
            </span>
          )}
          {person.secondary_specialty && (
            <span className="px-2 py-1 bg-info/10 text-info rounded text-xs border border-info/20">
              also: {person.secondary_specialty.replace(/_/g, ' ')}
            </span>
          )}
          {person.specialty_transition_flag && person.historical_specialty && (
            <span className="px-2 py-1 bg-watch/10 text-watch rounded text-xs border border-watch/30">
              career transition — previously {person.historical_specialty.replace(/_/g, ' ')}
            </span>
          )}
          {person.title_level_slope && person.title_level_slope !== 'insufficient_data' && (
            <span className={`px-2 py-1 rounded text-xs border ${
              person.title_level_slope === 'rising' ? 'bg-positive/10 text-positive border-positive/30' :
              person.title_level_slope === 'declining' ? 'bg-destructive/10 text-destructive border-destructive/30' :
              'bg-background text-muted-foreground border-border'
            }`}>
              progression: {person.title_level_slope}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-4 bg-background rounded-lg">
          <div>
            <p className="text-xs text-tertiary uppercase">Title</p>
            <p className="font-medium text-sm">{person.current_title_normalized || person.current_title_raw || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-tertiary uppercase">Company</p>
            <div className="flex items-center gap-1.5 font-medium text-sm">
              <CompanyLogo domain={guessDomain(companyName)} companyName={companyName} size={18} />
              {companyName || 'N/A'}
            </div>
          </div>
          <div>
            <p className="text-xs text-tertiary uppercase">Experience</p>
            <p className="font-medium text-sm">{person.years_experience_estimate != null ? `${person.years_experience_estimate} years` : 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-tertiary uppercase">Stage</p>
            <p className="font-medium text-sm">{person.career_stage_assigned?.replace(/_/g, ' ') || 'N/A'}</p>
          </div>
        </div>

        {/* Admin — clearance */}
        <div className="mb-8 p-4 bg-muted border border-border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Clearance (admin)</h2>
            {clearanceMsg && (
              <span className={`text-xs ${clearanceMsg.ok ? 'text-positive' : 'text-destructive'}`}>
                {clearanceMsg.text}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[180px,1fr,auto] gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Level</label>
              <select
                value={clearanceLevel}
                onChange={e => setClearanceLevel(e.target.value as ClearanceLevel)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="unknown">Unknown</option>
                <option value="none">None</option>
                <option value="confidential">Confidential</option>
                <option value="secret">Secret</option>
                <option value="top_secret">Top Secret</option>
                <option value="ts_sci">TS / SCI</option>
                <option value="q_clearance">Q (DOE)</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
              <input
                type="text"
                value={clearanceNotes}
                onChange={e => setClearanceNotes(e.target.value)}
                placeholder="e.g. active since 2021, requires polygraph"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={handleSaveClearance}
              disabled={clearanceSaving}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-accent-strong disabled:opacity-50"
            >
              {clearanceSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Summary */}
        {person.summary_raw && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3">About</h2>
            <p className="text-muted-foreground whitespace-pre-wrap text-sm">{person.summary_raw}</p>
          </div>
        )}

        {/* Experience */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">
            Experience {experiences.length > 0 && <span className="text-tertiary font-normal">({experiences.length})</span>}
          </h2>
          {experiences.length === 0 ? (
            <p className="text-tertiary text-sm">No experience data yet</p>
          ) : (
            <div className="space-y-4">
              {experiences.map((exp) => (
                <div key={exp.person_experience_id} className="border-l-2 border-border pl-4 py-1">
                  <p className="font-medium">
                    {exp.title_normalized || exp.title_raw || 'Unknown title'}
                  </p>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                    <CompanyLogo domain={guessDomain(exp.company_name)} companyName={exp.company_name} size={16} />
                    <span>
                      {cleanCompanyName(exp.company_name) || 'Unknown company'}
                      {exp.employment_type_normalized && exp.employment_type_normalized !== 'unknown' && (
                        <span className="text-tertiary"> · {exp.employment_type_normalized.replace(/_/g, ' ')}</span>
                      )}
                    </span>
                  </div>
                  <p className="text-tertiary text-xs mt-0.5">
                    {exp.start_date && formatDate(exp.start_date)}
                    {exp.start_date && ' — '}
                    {exp.is_current ? 'Present' : (exp.end_date ? formatDate(exp.end_date) : '')}
                    {exp.duration_months ? ` · ${formatDuration(exp.duration_months)}` : ''}
                  </p>
                  {exp.description_raw && (
                    <p className="text-muted-foreground text-sm mt-1">{exp.description_raw}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Education */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">
            Education {education.length > 0 && <span className="text-tertiary font-normal">({education.length})</span>}
          </h2>
          {education.length === 0 ? (
            <p className="text-tertiary text-sm">No education data yet</p>
          ) : (
            <div className="space-y-4">
              {education.map((edu) => (
                <div key={edu.person_education_id} className="border-l-2 border-border pl-4 py-1">
                  <p className="font-medium">
                    {edu.school_name || edu.school_name_raw || 'Unknown school'}
                  </p>
                  {(edu.degree_normalized || edu.degree_raw || edu.field_of_study_raw) && (
                    <p className="text-muted-foreground text-sm">
                      {edu.degree_normalized || edu.degree_raw}
                      {edu.field_of_study_normalized || edu.field_of_study_raw
                        ? `, ${edu.field_of_study_normalized || edu.field_of_study_raw}`
                        : ''}
                    </p>
                  )}
                  {(edu.start_year || edu.end_year) && (
                    <p className="text-tertiary text-xs mt-0.5">
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

        {/* Skills & Technologies */}
        {skillsTags.length > 0 && (
          <div className="mb-8">
            <button
              onClick={() => setSkillsOpen(o => !o)}
              className="flex items-center gap-2 text-lg font-semibold hover:text-muted-foreground"
            >
              <span className="inline-block w-3 text-sm">{skillsOpen ? '▾' : '▸'}</span>
              Skills & Technologies
              <span className="text-tertiary font-normal text-sm">({skillsTags.length})</span>
            </button>
            {skillsOpen && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {skillsTags.map((skill, i) => (
                  <span key={i} className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs border border-border">
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timestamps */}
        <div className="pt-6 border-t border-border text-xs text-tertiary">
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
  core:    { label: 'Core',    cls: 'bg-muted text-muted-foreground border-border' },
  bonus:   { label: 'Bonus',   cls: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  penalty: { label: 'Penalty', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
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
    <div className="mt-4 border border-border rounded-lg bg-card overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-background border-b border-border">
          <tr className="text-tertiary uppercase tracking-wide">
            <th className="text-left px-3 py-2 w-20">Category</th>
            <th className="text-left px-3 py-2">Signal</th>
            <th className="text-right px-3 py-2 w-16">Weight</th>
            <th className="text-right px-3 py-2 w-20">Raw</th>
            <th className="text-right px-3 py-2 w-20">Points</th>
            <th className="text-left px-3 py-2">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((c, i) => {
            const unsourced = c.category === 'bonus' && c.raw === null
            const style = CATEGORY_STYLE[c.category]
            return (
              <tr key={i} className={unsourced ? 'text-tertiary' : 'text-foreground'}>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-medium ${style.cls}`}>
                    {style.label}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono">{c.name}</td>
                <td className="px-3 py-2 text-right font-mono">{c.weight}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtRaw(c.raw)}</td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${c.points < 0 ? 'text-destructive' : c.points > 0 ? 'text-foreground' : 'text-tertiary'}`}>
                  {fmtPts(c.points)}
                </td>
                <td className="px-3 py-2 text-tertiary">{c.note || ''}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot className="bg-background border-t border-border font-medium">
          <tr>
            <td colSpan={4} className="px-3 py-2 text-right text-tertiary">Core</td>
            <td className="px-3 py-2 text-right font-mono">{b.core_score.toFixed(2)}</td>
            <td />
          </tr>
          <tr>
            <td colSpan={4} className="px-3 py-2 text-right text-tertiary">Bonus</td>
            <td className="px-3 py-2 text-right font-mono">{(b.bonus_score >= 0 ? '+' : '') + b.bonus_score.toFixed(2)}</td>
            <td />
          </tr>
          <tr>
            <td colSpan={4} className="px-3 py-2 text-right text-tertiary">Penalty</td>
            <td className="px-3 py-2 text-right font-mono">{b.penalty_score.toFixed(2)}</td>
            <td />
          </tr>
          <tr className="border-t border-border">
            <td colSpan={4} className="px-3 py-2 text-right font-semibold">Total</td>
            <td className="px-3 py-2 text-right font-mono font-semibold">{b.total_score.toFixed(2)}</td>
            <td className="px-3 py-2 text-tertiary">
              stage: {b.scoring_stage}
              {b.applied_recruiting_override && <span className="ml-2 text-indigo-600">[recruiting override]</span>}
              {b.applied_executive_override && <span className="ml-2 text-watch">[executive override]</span>}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
