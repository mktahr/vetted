'use client'

// app/network/connections/page.tsx
//
// Basic org-scoped admin connections table (real UX comes in PR 2). Triage +
// cost-visibility tool. Columns: name, company (+ score chip), title, bucket,
// specialty, enriched, connecting employee(s). Filters: bucket, employee,
// enriched, scored-company.

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import ConnectionDrawer, { ConnectionDetail } from '../../components/ConnectionDrawer'

interface Owner { employee_id: string; full_name: string }
interface Conn {
  connection_id: string; full_name: string; current_company: string | null; current_title: string | null
  title_bucket: 'yes' | 'maybe' | 'no'; status: string; specialty_normalized: string | null
  company_score: number | null; company_score_year: number | null
  enriched: boolean; last_enriched_at: string | null; raw_url: string | null; canonical_url: string
  owners: Owner[]
}
interface Employee { employee_id: string; full_name: string }

const wrap: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }
const sel: React.CSSProperties = { padding: '6px 8px', fontSize: 'var(--fs-13)', background: 'var(--bg-canvas)', color: 'var(--fg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 6 }
const btn: React.CSSProperties = { padding: '7px 12px', fontSize: 'var(--fs-13)', fontWeight: 600, cursor: 'pointer', background: 'var(--accent-600)', color: 'var(--fg-on-accent)', border: 'none', borderRadius: 6 }
const th: React.CSSProperties = { textAlign: 'left', fontSize: 'var(--fs-11)', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--fg-tertiary)', padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', position: 'sticky', top: 0, background: 'var(--bg-canvas)' }
const td: React.CSSProperties = { fontSize: 'var(--fs-13)', color: 'var(--fg-primary)', padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' }

function scoreColor(n: number): string {
  if (n >= 5) return '#1e7e45'
  if (n >= 4) return '#3a9d5d'
  if (n >= 3) return '#b8860b'
  if (n >= 2) return 'var(--fg-tertiary)'
  return 'var(--fg-disabled)'
}
function ScoreChip({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: 'var(--fg-disabled)', fontSize: 'var(--fs-12)' }}>—</span>
  return (
    <span style={{ display: 'inline-block', minWidth: 22, textAlign: 'center', padding: '1px 6px', borderRadius: 10, fontSize: 'var(--fs-12)', fontWeight: 700, color: '#fff', background: scoreColor(score) }}>{score}</span>
  )
}
const BUCKET_LABEL: Record<string, { t: string; c: string }> = {
  yes: { t: 'YES', c: '#1e7e45' }, maybe: { t: 'MAYBE', c: 'var(--accent-600)' }, no: { t: 'NO', c: 'var(--fg-tertiary)' },
}

function ConnectionsInner() {
  const params = useSearchParams()
  const orgId = params.get('org_id') ?? ''

  const [orgName, setOrgName] = useState('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [rows, setRows] = useState<Conn[]>([])
  const [loading, setLoading] = useState(true)
  const [triaging, setTriaging] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [bucket, setBucket] = useState('all')
  const [employeeId, setEmployeeId] = useState('')
  const [enriched, setEnriched] = useState('all')
  const [scored, setScored] = useState('all')

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [force, setForce] = useState(false)
  const [enriching, setEnriching] = useState(false)

  // Detail drawer (PR 2 / 2a)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [detail, setDetail] = useState<ConnectionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailIdx, setDetailIdx] = useState(-1)

  const openDrawerAt = useCallback(async (idx: number) => {
    const conn = rows[idx]
    if (!conn) return
    setDetailIdx(idx); setDrawerOpen(true); setDetailLoading(true); setDetail(null)
    const d = await fetch(`/api/network/connections/${conn.connection_id}`).then((r) => r.json()).catch(() => null)
    setDetail(d && !d.error ? d : null)
    setDetailLoading(false)
  }, [rows])

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const qs = new URLSearchParams({ org_id: orgId, bucket, enriched, scored })
    if (employeeId) qs.set('employee_id', employeeId)
    const r = await fetch(`/api/network/connections?${qs}`).then((r) => r.json())
    setRows(r.connections ?? [])
    setLoading(false)
  }, [orgId, bucket, employeeId, enriched, scored])

  useEffect(() => {
    if (!orgId) return
    fetch('/api/network/orgs').then((r) => r.json()).then((r) => setOrgName((r.orgs ?? []).find((o: any) => o.org_id === orgId)?.name ?? ''))
    fetch(`/api/network/employees?org_id=${orgId}`).then((r) => r.json()).then((r) => setEmployees(r.employees ?? []))
  }, [orgId])
  useEffect(() => { load() }, [load])

  async function runTriage() {
    setTriaging(true); setMsg(null)
    const r = await fetch('/api/network/triage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ org_id: orgId }) }).then((r) => r.json())
    setTriaging(false)
    setMsg(r.error ? `Triage error: ${r.error}` : `Triaged ${r.triaged} MAYBE connections.`)
    load()
  }

  function toggleSel(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function enrich(scope: 'org' | 'employee' | 'connections') {
    setMsg(null)
    const payloadBase: any = { org_id: orgId, scope, force }
    if (scope === 'employee') payloadBase.employee_id = employeeId
    if (scope === 'connections') payloadBase.connection_ids = Array.from(selected)

    // Count-first: estimate before spending.
    const est = await fetch('/api/network/enrich', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payloadBase, mode: 'estimate' }) }).then((r) => r.json())
    if (est.error) return setMsg(`Enrich error: ${est.error}`)
    const s = est.summary
    if (s.needs === 0 && s.reusedCrossSilo === 0 && s.reusedGlobalPool === 0) return setMsg('Nothing to enrich in this selection.')
    const ok = window.confirm(
      `Enrich ${s.target} connection(s):\n` +
      `• ${s.reusedCrossSilo} reused from cache (free)\n` +
      `• ${s.reusedGlobalPool} reused from candidate pool (free)\n` +
      `• ${s.needs} need fresh enrichment → ~${s.estimatedCredits} Crust credits\n\nProceed?`,
    )
    if (!ok) return

    setEnriching(true)
    const run = await fetch('/api/network/enrich', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payloadBase, mode: 'run' }) }).then((r) => r.json())
    setEnriching(false)
    if (run.error) return setMsg(`Enrich error: ${run.error}`)
    const rs = run.summary
    setMsg(`Enriched: ${rs.enrichedNew} new + ${rs.reusedCrossSilo + rs.reusedGlobalPool} reused. ${rs.failed ?? 0} failed. ~${rs.creditsSpent} credits (estimated).`)
    setSelected(new Set())
    load()
  }

  const counts = useMemo(() => {
    const c = { yes: 0, maybe: 0, no: 0 }
    for (const r of rows) (c as any)[r.title_bucket]++
    return c
  }, [rows])

  if (!orgId) return <div style={wrap}>Missing org_id.</div>

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-22)', fontWeight: 700, color: 'var(--fg-primary)' }}>{orgName || 'Connections'}</h1>
          <div style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)' }}>{rows.length} shown · {counts.yes} yes · {counts.maybe} maybe · {counts.no} no</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={`/network/review?org_id=${orgId}`} style={{ ...btn, background: 'transparent', color: 'var(--fg-secondary)', border: '1px solid var(--border-subtle)', textDecoration: 'none' }}>Review queue ({counts.maybe})</a>
          <button style={{ ...btn, opacity: triaging ? 0.6 : 1 }} disabled={triaging} onClick={runTriage}>{triaging ? 'Triaging…' : 'Run LLM triage'}</button>
        </div>
      </div>

      {/* Enrichment toolbar — every action is count-first (estimate → confirm → run). */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
        <span style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)', fontWeight: 600 }}>Enrich:</span>
        <button style={{ ...btn, opacity: enriching ? 0.6 : 1 }} disabled={enriching} onClick={() => enrich('org')}>Whole org</button>
        <button style={{ ...btn, background: 'transparent', color: 'var(--fg-secondary)', border: '1px solid var(--border-subtle)', opacity: enriching || !employeeId ? 0.5 : 1 }} disabled={enriching || !employeeId} onClick={() => enrich('employee')}>Selected employee</button>
        <button style={{ ...btn, background: 'transparent', color: 'var(--fg-secondary)', border: '1px solid var(--border-subtle)', opacity: enriching || selected.size === 0 ? 0.5 : 1 }} disabled={enriching || selected.size === 0} onClick={() => enrich('connections')}>Selected rows ({selected.size})</button>
        <label style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> force re-enrich
        </label>
      </div>

      {msg && <div style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-secondary)', marginBottom: 10 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <select style={sel} value={bucket} onChange={(e) => setBucket(e.target.value)}>
          <option value="all">All buckets</option><option value="yes">YES</option><option value="maybe">MAYBE</option><option value="no">NO</option>
        </select>
        <select style={sel} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">All employees</option>
          {employees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.full_name}</option>)}
        </select>
        <select style={sel} value={enriched} onChange={(e) => setEnriched(e.target.value)}>
          <option value="all">Any enrichment</option><option value="true">Enriched</option><option value="false">Not enriched</option>
        </select>
        <select style={sel} value={scored} onChange={(e) => setScored(e.target.value)}>
          <option value="all">Any company</option><option value="true">Scored company only</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 28 }}>
                <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length}
                  onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.connection_id)) : new Set())} />
              </th>
              <th style={th}>Name</th><th style={th}>Company</th><th style={th}>Title</th>
              <th style={th}>Bucket</th><th style={th}>Specialty</th><th style={th}>Enriched</th><th style={th}>Via</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td style={td} colSpan={8}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td style={td} colSpan={8}>No connections match these filters.</td></tr>
            ) : rows.map((c, idx) => (
              <tr key={c.connection_id} onClick={() => openDrawerAt(idx)} style={{ opacity: c.status === 'excluded' ? 0.55 : 1, cursor: 'pointer' }}>
                <td style={{ ...td, width: 28 }} onClick={(ev) => ev.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(c.connection_id)} onChange={() => toggleSel(c.connection_id)} />
                </td>
                <td style={td}>
                  {c.raw_url ? <a href={c.raw_url} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} style={{ color: 'var(--fg-primary)', textDecoration: 'none', fontWeight: 600 }}>{c.full_name}</a> : <span style={{ fontWeight: 600 }}>{c.full_name}</span>}
                </td>
                <td style={td}>
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <span>{c.current_company || '—'}</span>
                    <ScoreChip score={c.company_score} />
                  </span>
                </td>
                <td style={td}>{c.current_title || '—'}</td>
                <td style={td}><span style={{ fontWeight: 700, fontSize: 'var(--fs-11)', color: BUCKET_LABEL[c.title_bucket]?.c }}>{BUCKET_LABEL[c.title_bucket]?.t}</span></td>
                <td style={td}>{c.specialty_normalized || '—'}</td>
                <td style={td}>{c.enriched ? '✓' : '—'}</td>
                <td style={{ ...td, color: 'var(--fg-secondary)' }}>{c.owners.map((o) => o.full_name).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConnectionDrawer
        detail={detail}
        loading={detailLoading}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onPrev={detailIdx > 0 ? () => openDrawerAt(detailIdx - 1) : null}
        onNext={detailIdx >= 0 && detailIdx < rows.length - 1 ? () => openDrawerAt(detailIdx + 1) : null}
      />
    </div>
  )
}

export default function ConnectionsPage() {
  return <Suspense fallback={<div style={wrap}>Loading…</div>}><ConnectionsInner /></Suspense>
}
