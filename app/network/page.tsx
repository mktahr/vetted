'use client'

// app/network/page.tsx
//
// Network connections — admin upload screen.
// Pick (or create) an org → pick (or create) an employee → upload that
// employee's LinkedIn Connections.csv → see the post-upload summary
// (counts + bucket breakdown + pre-enrichment cost estimate).
//
// Enrichment is NOT triggered here — it's a separate, explicit, count-first
// action on the connections table.

import { useEffect, useState } from 'react'
import type { IngestSummary } from '@/lib/network/ingest'

interface Org { org_id: string; name: string; employee_count: number; connection_count: number }
interface Employee { employee_id: string; org_id: string; full_name: string; email: string | null; connection_count: number }

const card: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg, 10px)', padding: 20, marginBottom: 16,
}
const label: React.CSSProperties = { fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }
const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 'var(--fs-14)',
  background: 'var(--bg-canvas)', color: 'var(--fg-primary)',
  border: '1px solid var(--border-subtle)', borderRadius: 6,
}
const btn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 'var(--fs-13)', fontWeight: 600, cursor: 'pointer',
  background: 'var(--accent-600)', color: 'var(--fg-on-accent)', border: 'none', borderRadius: 6,
}
const btnGhost: React.CSSProperties = { ...btn, background: 'transparent', color: 'var(--fg-secondary)', border: '1px solid var(--border-subtle)' }

export default function NetworkUploadPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [orgId, setOrgId] = useState<string>('')
  const [employeeId, setEmployeeId] = useState<string>('')

  const [newOrgName, setNewOrgName] = useState('')
  const [newEmp, setNewEmp] = useState({ full_name: '', email: '', linkedin_url: '' })

  const [csvText, setCsvText] = useState<string>('')
  const [filename, setFilename] = useState<string>('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<IngestSummary | null>(null)

  async function loadOrgs() {
    const r = await fetch('/api/network/orgs').then((r) => r.json())
    setOrgs(r.orgs ?? [])
  }
  async function loadEmployees(oid: string) {
    if (!oid) { setEmployees([]); return }
    const r = await fetch(`/api/network/employees?org_id=${oid}`).then((r) => r.json())
    setEmployees(r.employees ?? [])
  }

  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { setEmployeeId(''); loadEmployees(orgId) }, [orgId])

  async function createOrg() {
    if (!newOrgName.trim()) return
    setError(null)
    const r = await fetch('/api/network/orgs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: newOrgName.trim() }) }).then((r) => r.json())
    if (r.error) return setError(r.error)
    setNewOrgName('')
    await loadOrgs()
    setOrgId(r.org.org_id)
  }

  async function createEmployee() {
    if (!orgId || !newEmp.full_name.trim()) return
    setError(null)
    const r = await fetch('/api/network/employees', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ org_id: orgId, ...newEmp }) }).then((r) => r.json())
    if (r.error) return setError(r.error)
    setNewEmp({ full_name: '', email: '', linkedin_url: '' })
    await loadEmployees(orgId)
    setEmployeeId(r.employee.employee_id)
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFilename(f.name)
    setCsvText(await f.text())
    setSummary(null)
  }

  async function upload() {
    if (!orgId || !employeeId || !csvText) return
    setBusy(true); setError(null); setSummary(null)
    try {
      const r = await fetch('/api/network/upload', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, employee_id: employeeId, filename, csv: csvText }),
      }).then((r) => r.json())
      if (r.error) setError(r.error)
      else { setSummary(r.summary); await loadOrgs(); await loadEmployees(orgId) }
    } catch (e: any) {
      setError(e?.message ?? 'upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px' }}>
      <h1 style={{ fontSize: 'var(--fs-22)', fontWeight: 700, color: 'var(--fg-primary)', marginBottom: 4 }}>Network connections</h1>
      <p style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-tertiary)', marginBottom: 20 }}>
        Upload an employee&apos;s LinkedIn Connections.csv. Connections are siloed per organization — never added to the global candidate pool.
      </p>

      {error && (
        <div style={{ ...card, borderColor: 'var(--danger-500, #c0392b)', color: 'var(--danger-500, #c0392b)', fontSize: 'var(--fs-13)' }}>{error}</div>
      )}

      {/* Step 1 — org */}
      <div style={card}>
        <div style={label}>1 · Organization</div>
        <select style={{ ...input, marginBottom: 10 }} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
          <option value="">— select an organization —</option>
          {orgs.map((o) => (
            <option key={o.org_id} value={o.org_id}>{o.name} · {o.employee_count} employees · {o.connection_count} connections</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={input} placeholder="New organization name" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} />
          <button style={btnGhost} onClick={createOrg}>Create</button>
        </div>
        {/* Persistent entry to review an existing org's connections (not just post-upload). */}
        {orgId && (
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <a href={`/network/connections?org_id=${orgId}`} style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>View / review connections</a>
            <a href={`/network/review?org_id=${orgId}`} style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }}>Review queue</a>
          </div>
        )}
      </div>

      {/* Step 2 — employee */}
      <div style={{ ...card, opacity: orgId ? 1 : 0.5, pointerEvents: orgId ? 'auto' : 'none' }}>
        <div style={label}>2 · Employee</div>
        <select style={{ ...input, marginBottom: 10 }} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">— select an employee —</option>
          {employees.map((em) => (
            <option key={em.employee_id} value={em.employee_id}>{em.full_name} · {em.connection_count} connections</option>
          ))}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <input style={input} placeholder="Full name" value={newEmp.full_name} onChange={(e) => setNewEmp({ ...newEmp, full_name: e.target.value })} />
          <input style={input} placeholder="Email (optional)" value={newEmp.email} onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={input} placeholder="LinkedIn URL (optional)" value={newEmp.linkedin_url} onChange={(e) => setNewEmp({ ...newEmp, linkedin_url: e.target.value })} />
          <button style={btnGhost} onClick={createEmployee}>Add</button>
        </div>
      </div>

      {/* Step 3 — upload */}
      <div style={{ ...card, opacity: employeeId ? 1 : 0.5, pointerEvents: employeeId ? 'auto' : 'none' }}>
        <div style={label}>3 · Connections.csv</div>
        <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ fontSize: 'var(--fs-13)', marginBottom: 12 }} />
        {filename && <div style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-tertiary)', marginBottom: 12 }}>{filename}</div>}
        <button style={{ ...btn, opacity: busy || !csvText ? 0.6 : 1 }} disabled={busy || !csvText} onClick={upload}>
          {busy ? 'Processing…' : 'Upload & classify'}
        </button>
      </div>

      {summary && <SummaryPanel summary={summary} orgId={orgId} />}
    </div>
  )
}

function SummaryPanel({ summary, orgId }: { summary: IngestSummary; orgId: string }) {
  const Row = ({ k, v, accent }: { k: string; v: React.ReactNode; accent?: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-secondary)' }}>{k}</span>
      <span style={{ fontSize: 'var(--fs-13)', fontWeight: 600, color: accent ?? 'var(--fg-primary)' }}>{v}</span>
    </div>
  )
  return (
    <div style={card}>
      <div style={label}>Post-upload summary</div>
      <Row k="Rows parsed" v={summary.rowsParsed} />
      <Row k="New connections" v={summary.rowsNew} />
      <Row k="Matched / refreshed" v={summary.rowsMatched} />
      <Row k="Skipped (no URL)" v={summary.rowsSkipped} />
      <Row k="Soft-disconnected (absent this upload)" v={summary.softDisconnected} />
      <div style={{ height: 12 }} />
      <div style={label}>Title classification</div>
      <Row k="YES — engineer" v={summary.bucketYes} accent="var(--success-600, #1e7e45)" />
      <Row k="MAYBE — review" v={summary.bucketMaybe} accent="var(--accent-600)" />
      <Row k="NO — excluded" v={summary.bucketNo} accent="var(--fg-tertiary)" />
      <div style={{ height: 12 }} />
      <div style={label}>Enrichment cost (before you spend)</div>
      <Row k="Already enriched (cross-silo cache)" v={summary.alreadyEnrichedCrossSilo} />
      <Row k="Already in global candidate pool" v={summary.alreadyInGlobalPool} />
      <Row k="Needs fresh enrichment" v={summary.needsEnrichment} accent="var(--accent-600)" />
      <Row k="Estimated Crust credits" v={`~${summary.estimatedCredits}`} accent="var(--accent-700)" />
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <a href={`/network/connections?org_id=${orgId}`} style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>View connections</a>
        <a href={`/network/review?org_id=${orgId}`} style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }}>Review queue ({summary.bucketMaybe})</a>
      </div>
    </div>
  )
}
