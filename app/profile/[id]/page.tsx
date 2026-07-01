'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Person, Experience, Education, BucketAssignment, CandidateBucket, FlaggedReason, ClearanceLevel, ScoreComponent } from '../../types'
import CompanyLogo, { guessDomain, guessSchoolDomain } from '../../components/CompanyLogo'
import CrossOrgNetwork from '../../components/CrossOrgNetwork'
import { filterEducationForDisplay } from '@/lib/education/display-filter'
import { formatSeniorityLabel } from '@/lib/normalize/seniority'

function cleanCompanyName(name: string | null | undefined): string | null {
  if (!name) return null
  return name.split('·')[0].split('•')[0].trim() || null
}

const BUCKET_STYLES: Record<CandidateBucket, { label: string; bg: string; text: string; border: string }> = {
  vetted:           { label: 'Vetted',           bg: 'bg-positive/10',  text: 'text-positive',         border: 'border-positive/30' },
  needs_review:     { label: 'Needs Review',     bg: 'bg-watch/10',     text: 'text-watch',            border: 'border-watch/30' },
  flagged:          { label: 'Flagged',          bg: 'bg-background',   text: 'text-muted-foreground', border: 'border-border' },
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
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideSaving, setOverrideSaving] = useState(false)
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [narrative, setNarrative] = useState<string | null>(null)
  const [narrativeAt, setNarrativeAt] = useState<string | null>(null)
  const [narrativeLoading, setNarrativeLoading] = useState(false)
  const [narrativeError, setNarrativeError] = useState<string | null>(null)
  const [skillsTags, setSkillsTags] = useState<string[]>([])
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [profileSignals, setProfileSignals] = useState<Array<{ canonical_name: string; category: string; evidence_url: string | null; canonical_url: string | null }>>([])
  const [currentCompanyReviewStatus, setCurrentCompanyReviewStatus] = useState<'vetted' | 'unreviewed' | 'excluded' | null>(null)


  useEffect(() => {
    async function fetchAll() {
      try {
        // Fetch person with company name + review status (for excluded-company display).
        const { data: personData, error: personErr } = await supabase
          .from('people')
          .select(`
            *,
            companies:current_company_id ( company_name, review_status )
          `)
          .eq('person_id', params.id)
          .single()

        if (personErr) throw personErr

        const p: Person = {
          ...personData,
          current_company_name: personData.companies?.company_name || null,
        }
        setPerson(p)
        setCurrentCompanyReviewStatus(personData.companies?.review_status ?? null)
        if (p.narrative_summary) {
          setNarrative(p.narrative_summary)
          setNarrativeAt(p.narrative_summary_generated_at)
        }

        // Fetch experiences with company names + review status.
        const { data: expData } = await supabase
          .from('person_experiences')
          .select(`
            *,
            companies:company_id ( company_name, review_status )
          `)
          .eq('person_id', params.id)
          .order('is_current', { ascending: false })
          .order('start_date', { ascending: false })

        const exps: Experience[] = (expData || []).map((row: any) => ({
          ...row,
          company_name: row.companies?.company_name || null,
          company_review_status: row.companies?.review_status ?? null,
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

        // Fetch signals
        const { data: sigData } = await supabase
          .from('person_signals_active')
          .select('signal_id, canonical_name, category, evidence_url, canonical_url')
          .eq('person_id', params.id)
          .order('confidence', { ascending: false })
        // Deduplicate by signal_id
        const seen = new Set<string>()
        setProfileSignals((sigData || []).filter(s => { if (seen.has(s.signal_id)) return false; seen.add(s.signal_id); return true }))

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

  async function submitBucketOverride(args: { bucket: CandidateBucket; flagged_reasons: string[]; reason: string }) {
    setOverrideSaving(true)
    setOverrideError(null)
    try {
      const r = await fetch(`/api/admin/bucket/${params.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
      // Update local bucket with the new assignment
      setBucket({
        ...(bucket || {} as BucketAssignment),
        bucket_assignment_id: data.assignment.bucket_assignment_id,
        person_id: params.id as string,
        candidate_bucket: data.assignment.candidate_bucket,
        flagged_reasons: data.assignment.flagged_reasons,
        assignment_reason: data.assignment.assignment_reason,
        assigned_by: 'admin',
        effective_at: data.assignment.effective_at,
        score_breakdown: null,
        confidence: null,
        created_at: data.assignment.effective_at,
      })
      setOverrideOpen(false)
    } catch (err) {
      setOverrideError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setOverrideSaving(false)
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
          className="text-muted-foreground hover:text-foreground"
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
                    className="text-muted-foreground hover:text-foreground underline"
                  >
                    LinkedIn
                  </a>
                )}
              </div>
            </div>

            {/* Bucket badge — admin override pencil here, founder lives separately below */}
            {bucket && (
              <div className="relative">
                <div className={`px-4 py-2 rounded-lg border-2 ${BUCKET_STYLES[bucket.candidate_bucket].bg} ${BUCKET_STYLES[bucket.candidate_bucket].border}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-wide text-tertiary">Bucket</p>
                    <button
                      onClick={() => setOverrideOpen(o => !o)}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                      title="Override bucket"
                    >
                      Edit
                    </button>
                  </div>
                  <p className={`text-lg font-bold ${BUCKET_STYLES[bucket.candidate_bucket].text}`}>
                    {BUCKET_STYLES[bucket.candidate_bucket].label}
                  </p>
                </div>
                {overrideOpen && (
                  <BucketOverridePopover
                    currentBucket={bucket.candidate_bucket}
                    currentFlags={bucket.flagged_reasons || []}
                    saving={overrideSaving}
                    error={overrideError}
                    onClose={() => setOverrideOpen(false)}
                    onSubmit={submitBucketOverride}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Highlights chip strip — Former/Current Founder + early-stage + hypergrowth.
            Lives below the header, above the overview cards, so it's visible at a
            glance but not conflated with bucket editing. */}
        {(person.is_current_founder || person.is_former_founder) && (
          <div className="mb-4 flex flex-wrap gap-2">
            {person.is_former_founder && (
              <span className="px-2 py-1 text-xs font-medium rounded-md border border-positive/30 bg-positive/10 text-positive">
                Former Founder
              </span>
            )}
            {person.is_current_founder && (
              <span className="px-2 py-1 text-xs font-medium rounded-md border border-watch/30 bg-watch/10 text-watch">
                Current Founder
              </span>
            )}
          </div>
        )}

        {/* Overview — Title, Company, Experience, Stage (moved to top) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-background rounded-lg">
          <div>
            <p className="text-xs text-tertiary uppercase">Title</p>
            <p className="font-medium text-sm">{person.current_title_normalized || person.current_title_raw || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-tertiary uppercase">Company</p>
            <div
              className="flex items-center gap-1.5 font-medium text-sm"
              style={{ opacity: currentCompanyReviewStatus === 'excluded' ? 0.6 : 1 }}
              title={currentCompanyReviewStatus === 'excluded' ? 'Company excluded from talent pool.' : undefined}
            >
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

        {/* Cross-org network — who can warm-intro this candidate (renders nothing if none) */}
        <CrossOrgNetwork personId={params.id as string} />

        {/* Education — right after overview, before summary */}
        {education.length > 0 && (() => {
          const displayEdus = filterEducationForDisplay(education)
          return displayEdus.length > 0 ? (
          <div className="mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Education</h2>
            <div className="space-y-3">
              {displayEdus.map((edu) => (
                <div key={edu.person_education_id} className="flex items-start gap-3">
                  <CompanyLogo domain={guessSchoolDomain(edu.school_name || edu.school_name_raw)} companyName={edu.school_name || edu.school_name_raw} size={20} shape="circle" />
                  <div>
                    <p className="font-medium text-sm">{edu.school_name || edu.school_name_raw || 'Unknown school'}</p>
                    {(edu.degree_normalized || edu.degree_raw || edu.field_of_study_raw) && (
                      <p className="text-muted-foreground text-xs">
                        {edu.degree_normalized || edu.degree_raw}
                        {edu.field_of_study_normalized || edu.field_of_study_raw ? `, ${edu.field_of_study_normalized || edu.field_of_study_raw}` : ''}
                      </p>
                    )}
                    {(edu.start_year || edu.end_year) && (
                      <p className="text-tertiary text-xs">{edu.start_year ?? ''}{edu.start_year && edu.end_year ? ' — ' : ''}{edu.end_year ?? ''}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          ) : null
        })()}

        {/* AI narrative summary */}
        <div className="mb-6 p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Summary</p>
            <button
              onClick={regenerateNarrative}
              disabled={narrativeLoading}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed underline"
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

            {bucket.flagged_reasons && bucket.flagged_reasons.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {bucket.flagged_reasons.map(flag => (
                  <span key={flag} className="px-1.5 py-0.5 text-xs rounded border border-watch/30 bg-watch/10 text-watch">
                    {flag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            {bucket.score_breakdown ? (
              <>
                <button
                  onClick={() => setBreakdownOpen(o => !o)}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
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

        {/* Classification metadata — quiet label-value grid.
            PREVIEW: the OLD person-level Specialty / Secondary / Function rows (driven by the
            legacy deterministic classifier — e.g. the bogus "fullstack") are hidden here so the
            ONLY classification shown is the new per-role "AI Classification (preview)" panel below. */}
        <div className="grid gap-x-4 gap-y-0.5 mb-6 text-sm" style={{ gridTemplateColumns: 'auto 1fr', maxWidth: 400 }}>
          {(() => {
            const currentExp = experiences.find(e => e.is_current && e.seniority_normalized && e.seniority_normalized !== 'unknown')
            const currentSen = currentExp?.seniority_normalized ?? null
            return <>
              {currentSen && (
                <><span className="text-muted-foreground">Seniority</span><span>{formatSeniorityLabel(currentSen)}</span></>
              )}
              {person.highest_seniority_reached && person.highest_seniority_reached !== currentSen && (
                <><span className="text-muted-foreground">Highest seniority</span><span>{formatSeniorityLabel(person.highest_seniority_reached)}</span></>
              )}
            </>
          })()}
          {person.title_level_slope && person.title_level_slope !== 'insufficient_data' && (
            <><span className="text-muted-foreground">Progression</span><span>{person.title_level_slope}</span></>
          )}
          {person.slope_score !== null && person.slope_score !== undefined && (
            <><span className="text-muted-foreground">Slope</span><span>{person.slope_score}</span></>
          )}
          {person.has_early_stage_experience && (
            <><span className="text-muted-foreground">Early-stage</span><span>{person.early_stage_companies_count} companies</span></>
          )}
          {person.has_hypergrowth_experience && (
            <><span className="text-muted-foreground">Hypergrowth</span><span>{person.hypergrowth_companies_count} companies</span></>
          )}
        </div>

        {/* Achievement signals — toned-down chips */}
        {profileSignals.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Signals</h2>
            <div className="flex flex-wrap gap-1.5">
              {profileSignals.map(sig => {
                const url = sig.evidence_url || sig.canonical_url
                const chip = (
                  <span key={sig.canonical_name + sig.category} className="px-1.5 py-0.5 text-xs rounded border" style={{ background: 'var(--bg-surface-raised)', color: 'var(--fg-secondary)', borderColor: 'var(--border-default)' }}>
                    {sig.canonical_name}
                  </span>
                )
                if (url) return <a key={sig.canonical_name + sig.category} href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{chip}</a>
                return chip
              })}
            </div>
          </div>
        )}

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
                  <div
                    className="flex items-center gap-1.5 text-muted-foreground text-sm"
                    style={{ opacity: exp.company_review_status === 'excluded' ? 0.6 : 1 }}
                    title={exp.company_review_status === 'excluded' ? 'Company excluded from talent pool.' : undefined}
                  >
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
                  {/* Five-axis classification (PREVIEW — inert columns, not used by search/scoring yet) */}
                  {(() => {
                    const fn = (exp as any).function_inferred_preview as string[] | null
                    const sp = (exp as any).specialty_inferred_preview as string[] | null
                    const sk = (exp as any).skills_inferred_preview as string[] | null
                    const tn = (exp as any).title_normalized_inferred_preview as string | null
                    const founding = (exp as any).is_founding_engineer_role as boolean
                    const ver = (exp as any).classification_preview_version as string | null
                    if ((!fn || fn.length === 0) && (!sp || sp.length === 0) && !tn) return null
                    const clean = (s: string) => s.replace(/_/g, ' ')
                    return (
                      <div className="mt-2 rounded border border-border bg-muted px-2.5 py-1.5 text-xs space-y-0.5">
                        <div className="font-semibold uppercase" style={{ fontSize: '10px', letterSpacing: '0.05em', color: 'var(--accent-strong)' }}>
                          AI Classification (preview{ver ? ` · ${ver}` : ''})
                        </div>
                        {fn && fn.length > 0 && <div><span className="text-tertiary">function: </span><span className="text-foreground">{fn.map(clean).join(', ')}</span></div>}
                        {sp && sp.length > 0 && <div><span className="text-tertiary">specialty: </span><span className="text-foreground">{sp.map(clean).join(', ')}</span></div>}
                        {sk && sk.length > 0 && <div><span className="text-tertiary">skills: </span><span className="text-foreground">{sk.map(clean).join(', ')}</span></div>}
                        {tn && <div><span className="text-tertiary">title: </span><span className="text-foreground">{tn}</span></div>}
                        {founding && <div style={{ color: 'var(--accent-strong)' }}>★ founding / early engineer</div>}
                      </div>
                    )
                  })()}
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
              {b.applied_executive_override && <span className="ml-2 text-watch">[senior-leader override]</span>}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Admin bucket override popover ─────────────────────────────────────────
// Anchored to the bucket badge. Lets admin re-bucket a candidate and
// optionally edit flagged_reasons. Overriding to 'vetted' forces flags=[]
// (semantic — a vetted candidate has no system flags).

const KNOWN_FLAGS: FlaggedReason[] = ['unknown_seniority', 'contractor_only', 'job_hopping', 'low_score']

function BucketOverridePopover({
  currentBucket,
  currentFlags,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  currentBucket: CandidateBucket
  currentFlags: string[]
  saving: boolean
  error: string | null
  onClose: () => void
  onSubmit: (args: { bucket: CandidateBucket; flagged_reasons: string[]; reason: string }) => void
}) {
  const [pickBucket, setPickBucket] = useState<CandidateBucket>(currentBucket)
  const [knownFlagSel, setKnownFlagSel] = useState<Set<string>>(new Set(currentFlags.filter(f => (KNOWN_FLAGS as string[]).includes(f))))
  const [extraFlagsText, setExtraFlagsText] = useState<string>(
    currentFlags.filter(f => !(KNOWN_FLAGS as string[]).includes(f)).join(', ')
  )
  const [reason, setReason] = useState<string>('')

  const flagsDisabled = pickBucket === 'vetted'

  function toggleFlag(f: string) {
    const next = new Set(knownFlagSel)
    if (next.has(f)) next.delete(f)
    else next.add(f)
    setKnownFlagSel(next)
  }

  function handleSubmit() {
    const extras = extraFlagsText.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    const merged = Array.from(new Set<string>([...Array.from(knownFlagSel), ...extras]))
    onSubmit({
      bucket: pickBucket,
      flagged_reasons: pickBucket === 'vetted' ? [] : merged,
      reason: reason.trim(),
    })
  }

  return (
    <div
      className="absolute left-0 top-full mt-2 z-50 w-80 p-4 rounded-lg border-2 border-border bg-card shadow-lg"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">Override bucket</p>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-tertiary mb-1">Bucket</p>
          <div className="flex flex-col gap-1">
            {(['vetted', 'needs_review', 'flagged'] as CandidateBucket[]).map(b => (
              <label key={b} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={pickBucket === b}
                  onChange={() => setPickBucket(b)}
                />
                {BUCKET_STYLES[b].label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-tertiary mb-1">
            Flags {flagsDisabled && <span className="text-tertiary normal-case">— forced empty when Vetted</span>}
          </p>
          <div className={`space-y-1 ${flagsDisabled ? 'opacity-50' : ''}`}>
            {KNOWN_FLAGS.map(f => (
              <label key={f} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={knownFlagSel.has(f)}
                  onChange={() => toggleFlag(f)}
                  disabled={flagsDisabled}
                />
                {f.replace(/_/g, ' ')}
              </label>
            ))}
            <input
              type="text"
              placeholder="Custom flags, comma-separated"
              value={extraFlagsText}
              onChange={e => setExtraFlagsText(e.target.value)}
              disabled={flagsDisabled}
              className="w-full text-sm px-2 py-1 mt-2 border border-border rounded bg-background"
            />
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-tertiary mb-1">Reason (optional)</p>
          <input
            type="text"
            placeholder="Why override?"
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full text-sm px-2 py-1 border border-border rounded bg-background"
          />
        </div>

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="text-sm px-3 py-1 rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="text-sm px-3 py-1 rounded bg-foreground text-background hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
