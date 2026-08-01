'use client'

// "Send to ATS" bulk action — lives in ProfileTable's selection bar.
// Opens a job picker (jobs fetched from /api/ats/jobs, which proxies the
// ATS server-side so the ingest secret never reaches the browser), then
// POSTs the selection to /api/ats/export and reports the ATS's summary.

import { useEffect, useRef, useState } from 'react'

interface AtsJob { job_id: string; title: string; team: string | null; status: string }

interface ImportSummary {
  job?: string
  peopleCreated?: number
  peopleExisting?: number
  applicationsCreated?: number
  applicationsExisting?: number
  errors?: string[]
}

export default function SendToAtsButton({ selectedIds }: { selectedIds: string[] }) {
  const [open, setOpen] = useState(false)
  const [jobs, setJobs] = useState<AtsJob[] | null>(null)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // A result message describes a PAST selection — drop it when the selection changes
  useEffect(() => { setMessage(null) }, [selectedIds.length])

  async function toggleOpen() {
    setMessage(null)
    if (open) { setOpen(false); return }
    setOpen(true)
    if (jobs === null) {
      setJobsError(null) // reopening retries a failed load
      try {
        const resp = await fetch('/api/ats/jobs')
        const body = await resp.json()
        if (!resp.ok) throw new Error(body?.error ?? `HTTP ${resp.status}`)
        setJobs(body.jobs ?? [])
      } catch (err) {
        setJobsError(err instanceof Error ? err.message : 'Failed to load ATS jobs')
      }
    }
  }

  async function sendTo(job: AtsJob) {
    setSending(true)
    setMessage(null)
    try {
      const resp = await fetch('/api/ats/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_ids: selectedIds, ats_job_id: job.job_id }),
      })
      const body = await resp.json()
      if (!resp.ok) throw new Error(body?.error ?? `HTTP ${resp.status}`)
      const s: ImportSummary = body.summary ?? {}
      const parts = [`${s.applicationsCreated ?? 0} added to "${s.job ?? job.title}"`]
      if (s.applicationsExisting) parts.push(`${s.applicationsExisting} already in pipeline`)
      if (body.skipped?.length) parts.push(`${body.skipped.length} skipped (no LinkedIn URL)`)
      if (s.errors?.length) parts.push(`${s.errors.length} failed — first: ${s.errors[0]}`)
      // Per-candidate ATS errors = partial failure, styled as such
      setMessage({ text: parts.join(' · '), isError: Boolean(body.partial) })
      setOpen(false)
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Send failed', isError: true })
    } finally {
      setSending(false)
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={toggleOpen} disabled={sending || selectedIds.length === 0}
        style={{ padding: '4px 12px', fontSize: 'var(--fs-13)', borderRadius: 'var(--r-button)', cursor: 'pointer',
          background: 'transparent', color: 'var(--accent-500)', border: '1px solid var(--accent-500)',
          opacity: sending ? 0.5 : 1 }}>
        {sending ? 'Sending…' : 'Send to ATS'}
      </button>
      {message && (
        <span style={{ fontSize: 'var(--fs-12)', color: message.isError ? 'var(--red-400)' : 'var(--fg-secondary)' }}>
          {message.text}
        </span>
      )}
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, minWidth: 260,
          background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-card)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)', padding: 6 }}>
          <div style={{ padding: '4px 8px', fontSize: 'var(--fs-11)', textTransform: 'uppercase',
            letterSpacing: 'var(--tr-eyebrow)', color: 'var(--fg-tertiary)' }}>
            Send {selectedIds.length} to job
          </div>
          {jobsError && <div style={{ padding: '6px 8px', fontSize: 'var(--fs-12)', color: 'var(--red-400)' }}>{jobsError}</div>}
          {!jobsError && jobs === null && <div style={{ padding: '6px 8px', fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)' }}>Loading jobs…</div>}
          {jobs !== null && jobs.length === 0 && <div style={{ padding: '6px 8px', fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)' }}>No open jobs in the ATS</div>}
          {(jobs ?? []).map(j => (
            <button key={j.job_id} onClick={() => sendTo(j)} disabled={sending}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', fontSize: 'var(--fs-13)',
                background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--fg-primary)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              {j.title}
              {j.team && <span style={{ color: 'var(--fg-tertiary)' }}> · {j.team}</span>}
              {j.status !== 'active' && <span style={{ color: 'var(--fg-tertiary)' }}> ({j.status})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
