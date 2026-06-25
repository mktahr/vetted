'use client'

// app/network/review/page.tsx
//
// MAYBE review queue — batch through ambiguous connections one at a time. Shows
// the LLM triage guess + reason, the LinkedIn URL one click away, Keep/Drop
// actions, and an on-demand single-person web-check button (Claude web search).

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface Conn {
  connection_id: string; full_name: string; current_company: string | null; current_title: string | null
  company_score: number | null; raw_url: string | null; canonical_url: string
  llm_triage_guess: string | null; llm_triage_reason: string | null
}
interface WebCheck { verdict: string; summary: string; sources: Array<{ title: string; url: string }> }

const wrap: React.CSSProperties = { maxWidth: 640, margin: '0 auto', padding: '24px 20px' }
const btn: React.CSSProperties = { padding: '9px 16px', fontSize: 'var(--fs-14)', fontWeight: 600, cursor: 'pointer', borderRadius: 7, border: 'none' }
const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 24 }

const GUESS_RANK: Record<string, number> = { probably_yes: 0, unclear: 1, probably_no: 3 }
const GUESS_BADGE: Record<string, { t: string; c: string }> = {
  probably_yes: { t: 'LLM: probably engineer', c: '#1e7e45' },
  probably_no: { t: 'LLM: probably not', c: '#b04632' },
  unclear: { t: 'LLM: unclear', c: 'var(--fg-tertiary)' },
}

function ReviewInner() {
  const params = useSearchParams()
  const orgId = params.get('org_id') ?? ''

  const [queue, setQueue] = useState<Conn[]>([])
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [triaging, setTriaging] = useState(false)
  const [acting, setActing] = useState(false)
  const [webChecking, setWebChecking] = useState(false)
  const [webResult, setWebResult] = useState<WebCheck | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const r = await fetch(`/api/network/connections?org_id=${orgId}&bucket=maybe`).then((r) => r.json())
    const rows: Conn[] = (r.connections ?? []).slice().sort((a: Conn, b: Conn) => {
      const ra = GUESS_RANK[a.llm_triage_guess ?? ''] ?? 2
      const rb = GUESS_RANK[b.llm_triage_guess ?? ''] ?? 2
      if (ra !== rb) return ra - rb
      return (b.company_score ?? -1) - (a.company_score ?? -1)
    })
    setQueue(rows); setIdx(0); setWebResult(null); setLoading(false)
  }, [orgId])

  useEffect(() => { load() }, [load])

  const current = queue[idx]
  const remaining = queue.length - idx

  async function runTriage() {
    setTriaging(true)
    await fetch('/api/network/triage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ org_id: orgId }) }).then((r) => r.json())
    setTriaging(false); load()
  }

  async function act(action: 'keep' | 'drop') {
    if (!current) return
    setActing(true)
    await fetch(`/api/network/connections/${current.connection_id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) }).then((r) => r.json())
    setActing(false); setWebResult(null); setIdx((i) => i + 1)
  }

  async function webCheck() {
    if (!current) return
    setWebChecking(true); setWebResult(null)
    const r = await fetch('/api/network/web-check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ connection_id: current.connection_id }) }).then((r) => r.json())
    setWebChecking(false)
    if (r.result) setWebResult(r.result)
    else setWebResult({ verdict: 'error', summary: r.error ?? 'web-check failed', sources: [] })
  }

  const untriaged = useMemo(() => queue.some((c) => !c.llm_triage_guess), [queue])

  if (!orgId) return <div style={wrap}>Missing org_id.</div>

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <a href={`/network/connections?org_id=${orgId}`} style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)', textDecoration: 'none' }}>← Connections</a>
          <h1 style={{ fontSize: 'var(--fs-22)', fontWeight: 700, color: 'var(--fg-primary)' }}>Review queue</h1>
        </div>
        <button style={{ ...btn, background: 'transparent', color: 'var(--fg-secondary)', border: '1px solid var(--border-subtle)', opacity: triaging ? 0.6 : 1 }} disabled={triaging} onClick={runTriage}>
          {triaging ? 'Triaging…' : untriaged ? 'Run LLM triage' : 'Re-run triage'}
        </button>
      </div>

      {loading ? (
        <div style={card}>Loading…</div>
      ) : !current ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--fg-secondary)' }}>
          🎉 Review queue clear — no MAYBE connections left.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)', marginBottom: 8 }}>{remaining} remaining</div>
          <div style={card}>
            <div style={{ fontSize: 'var(--fs-18)', fontWeight: 700, color: 'var(--fg-primary)' }}>{current.full_name}</div>
            <div style={{ fontSize: 'var(--fs-14)', color: 'var(--fg-secondary)', marginTop: 4 }}>
              {current.current_title || '(no title)'}{current.current_company ? ` · ${current.current_company}` : ''}
              {current.company_score != null && <span style={{ marginLeft: 6, fontWeight: 700, color: '#1e7e45' }}>· score {current.company_score}</span>}
            </div>

            {current.llm_triage_guess && (
              <div style={{ marginTop: 14, padding: '8px 12px', background: 'var(--bg-canvas)', borderRadius: 8, fontSize: 'var(--fs-13)' }}>
                <span style={{ fontWeight: 700, color: GUESS_BADGE[current.llm_triage_guess]?.c }}>{GUESS_BADGE[current.llm_triage_guess]?.t}</span>
                {current.llm_triage_reason && <span style={{ color: 'var(--fg-tertiary)' }}> — {current.llm_triage_reason}</span>}
              </div>
            )}

            {webResult && (
              <div style={{ marginTop: 12, padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 'var(--fs-13)' }}>
                <div style={{ fontWeight: 700, color: 'var(--fg-primary)' }}>Web check: {webResult.verdict}</div>
                <div style={{ color: 'var(--fg-secondary)', marginTop: 4 }}>{webResult.summary}</div>
                {webResult.sources.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {webResult.sources.map((s, i) => (
                      <a key={i} href={s.url} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 'var(--fs-12)', color: 'var(--accent-700)', textDecoration: 'none' }}>{s.title}</a>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
              <button style={{ ...btn, background: '#1e7e45', color: '#fff', opacity: acting ? 0.6 : 1 }} disabled={acting} onClick={() => act('keep')}>Keep (engineer)</button>
              <button style={{ ...btn, background: 'var(--bg-canvas)', color: 'var(--fg-secondary)', border: '1px solid var(--border-subtle)', opacity: acting ? 0.6 : 1 }} disabled={acting} onClick={() => act('drop')}>Drop</button>
              {current.raw_url && <a href={current.raw_url} target="_blank" rel="noreferrer" style={{ ...btn, background: 'transparent', color: 'var(--accent-700)', border: '1px solid var(--border-subtle)', textDecoration: 'none' }}>Open LinkedIn ↗</a>}
              <button style={{ ...btn, background: 'transparent', color: 'var(--fg-secondary)', border: '1px solid var(--border-subtle)', opacity: webChecking ? 0.6 : 1 }} disabled={webChecking} onClick={webCheck}>{webChecking ? 'Checking…' : 'Web-check'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function ReviewPage() {
  return <Suspense fallback={<div style={wrap}>Loading…</div>}><ReviewInner /></Suspense>
}
