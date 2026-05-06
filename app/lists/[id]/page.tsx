'use client'

// /lists/[id] — show items in a list. Pulls list metadata, then the
// underlying candidate/company rows for each item so we render a
// useful table that matches the main views.
//
// Features:
//   - Multi-select checkboxes
//   - Bulk: "Find candidates at N selected" (company lists) → routes to /
//     with the compoundCompany filter pre-applied so users land on the
//     candidates page filtered to people who worked at those companies
//   - Inline rename via clicking the title
//   - Per-row remove

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  fetchListItems,
  removeFromList,
  renameList,
  type ListKind,
} from '@/lib/lists/api'
import CompanyLogo, { guessDomain } from '@/app/components/CompanyLogo'
import TopNav from '@/app/components/TopNav'
import { formatFundingAmount } from '@/lib/companies/funding'
import { formatGrowthPct, growthSign } from '@/lib/companies/firmographics'
import { FUNDING_STAGE_LABELS } from '@/lib/companies/taxonomy'

interface ListMeta {
  id: string
  name: string
  kind: ListKind
  notes: string | null
}

interface CandidateRow {
  person_id: string
  full_name: string | null
  current_title_normalized: string | null
  current_title_raw: string | null
  location_name: string | null
  years_experience_estimate: number | null
  current_company_name: string | null
}

interface CompanyRow {
  company_id: string
  company_name: string
  hq_location_name: string | null
  primary_industry: string | null
  industries: string[] | null
  domain_tags: string[] | null
  category: string | null
  total_funding_usd: number | null
  funding_stage: string | null
  founding_year: number | null
  headcount_latest: number | null
  headcount_range: string | null
  headcount_growth_12m_pct: number | null
  company_type: string | null
  logo_permalink: string | null
  website_url: string | null
}

export default function ListDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const listId = params.id

  const [meta, setMeta] = useState<ListMeta | null>(null)
  const [items, setItems] = useState<{ item_id: string; added_at: string }[]>([])
  const [candidates, setCandidates] = useState<Record<string, CandidateRow>>({})
  const [companies, setCompanies] = useState<Record<string, CompanyRow>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editName, setEditName] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: m, error: mErr } = await supabase
          .from('lists')
          .select('id, name, kind, notes')
          .eq('id', listId)
          .single()
        if (mErr) throw mErr
        const metaRow: ListMeta = { ...m, kind: m.kind as ListKind }
        if (cancelled) return
        setMeta(metaRow)

        const its = await fetchListItems(listId)
        if (cancelled) return
        setItems(its.map(i => ({ item_id: i.item_id, added_at: i.added_at })))
        if (its.length === 0) { setLoading(false); return }
        const ids = its.map(i => i.item_id)

        if (metaRow.kind === 'candidate') {
          const { data: rows } = await supabase
            .from('people')
            .select(`
              person_id, full_name, current_title_normalized, current_title_raw,
              location_name, years_experience_estimate,
              companies:current_company_id ( company_name )
            `)
            .in('person_id', ids)
          if (cancelled) return
          const map: Record<string, CandidateRow> = {}
          for (const r of (rows || []) as any[]) {
            map[r.person_id] = {
              person_id: r.person_id,
              full_name: r.full_name,
              current_title_normalized: r.current_title_normalized,
              current_title_raw: r.current_title_raw,
              location_name: r.location_name,
              years_experience_estimate: r.years_experience_estimate,
              current_company_name: r.companies?.company_name || null,
            }
          }
          setCandidates(map)
        } else {
          const { data: rows } = await supabase
            .from('companies')
            .select(`
              company_id, company_name, hq_location_name, primary_industry, industries, domain_tags,
              category, total_funding_usd, funding_stage, founding_year,
              headcount_latest, headcount_range, headcount_growth_12m_pct,
              company_type, logo_permalink, website_url
            `)
            .in('company_id', ids)
          if (cancelled) return
          const map: Record<string, CompanyRow> = {}
          for (const r of (rows || []) as CompanyRow[]) map[r.company_id] = r
          setCompanies(map)
        }
      } catch (err: any) {
        if (cancelled) return
        setError(err?.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [listId])

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleSelectAll() {
    if (selectedIds.size === items.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(items.map(i => i.item_id)))
  }

  async function handleRemove(itemId: string) {
    try {
      await removeFromList(listId, itemId)
      setItems(prev => prev.filter(i => i.item_id !== itemId))
      setSelectedIds(prev => { const n = new Set(prev); n.delete(itemId); return n })
    } catch (err: any) {
      alert(`Remove failed: ${err.message}`)
    }
  }

  async function handleBulkRemove() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (!confirm(`Remove ${ids.length} item${ids.length === 1 ? '' : 's'} from this list?`)) return
    for (const id of ids) {
      await removeFromList(listId, id).catch(() => {})
    }
    setItems(prev => prev.filter(i => !selectedIds.has(i.item_id)))
    setSelectedIds(new Set())
  }

  function findCandidatesAtSelected() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const state = {
      compoundCompany: ids,
      compoundCompanyScope: 'ever',
      cc: [{ s: 'ever', c: ids }],
    }
    router.push(`/?filters=${encodeURIComponent(JSON.stringify(state))}`)
  }

  async function handleRename() {
    if (editName == null || !meta) return
    const trimmed = editName.trim()
    if (!trimmed || trimmed === meta.name) { setEditName(null); return }
    try {
      await renameList(listId, trimmed)
      setMeta({ ...meta, name: trimmed })
    } catch (err: any) {
      alert(`Rename failed: ${err.message}`)
    } finally {
      setEditName(null)
    }
  }

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--fg-tertiary)', background: 'var(--bg-canvas)', minHeight: '100vh', fontFamily: 'var(--font-sans)' }}>Loading…</div>
  }

  if (error || !meta) {
    return (
      <div style={{ padding: 24, color: 'var(--fg-primary)', background: 'var(--bg-canvas)', minHeight: '100vh', fontFamily: 'var(--font-sans)' }}>
        <a href="/lists" className="text-sm text-muted-foreground hover:text-foreground">← All lists</a>
        <p className="mt-3 text-red-500">{error || 'List not found'}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, background: 'var(--bg-canvas)', color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>
      <div className="mb-6">
        <a href="/lists" className="text-sm text-muted-foreground hover:text-foreground inline-block mb-2">← All lists</a>
        {editName == null ? (
          <h1 className="text-3xl font-bold tracking-tight cursor-text" onClick={() => setEditName(meta.name)}>
            {meta.name}
            <span className="ml-3 align-middle px-2 py-0.5 text-xs rounded bg-card border border-border text-tertiary uppercase">{meta.kind}</span>
          </h1>
        ) : (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditName(null) }}
            className="text-3xl font-bold tracking-tight bg-transparent border-b border-border focus:outline-none focus:border-accent w-full"
          />
        )}
        <p className="text-sm text-muted-foreground mt-1">{items.length} item{items.length === 1 ? '' : 's'}</p>
      </div>

      {/* Bulk action toolbar (visible when rows selected) */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 p-3 bg-watch/10 border border-watch/30 rounded-lg">
          <span className="text-sm text-watch font-medium">{selectedIds.size} selected</span>
          {meta.kind === 'company' && (
            <button
              onClick={findCandidatesAtSelected}
              style={{ padding: '4px 12px', fontSize: 'var(--fs-12)', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--r-button)', cursor: 'pointer', fontWeight: 'var(--fw-medium)' as any }}
            >
              Find candidates at {selectedIds.size} selected
            </button>
          )}
          <button
            onClick={handleBulkRemove}
            className="px-3 py-1 text-sm rounded bg-card text-destructive border border-destructive/30 hover:bg-destructive/10"
          >
            Remove {selectedIds.size} from list
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-sm text-tertiary hover:text-muted-foreground">
            Cancel
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-tertiary">
          No items yet. Add some via the &ldquo;+&rdquo; button on a {meta.kind} row.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-x-auto">
          {meta.kind === 'candidate' ? (
            <CandidateTable
              items={items}
              candidates={candidates}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onRemove={handleRemove}
              onOpen={(id) => router.push(`/profile/${id}`)}
            />
          ) : (
            <CompanyTable
              items={items}
              companies={companies}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onRemove={handleRemove}
              onOpen={(id) => router.push(`/admin/companies/${id}`)}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Candidate sub-table ───────────────────────────────────────────────────

function CandidateTable({ items, candidates, selectedIds, onToggleSelect, onToggleSelectAll, onRemove, onOpen }: {
  items: { item_id: string; added_at: string }[]
  candidates: Record<string, CandidateRow>
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onRemove: (id: string) => void
  onOpen: (id: string) => void
}) {
  return (
    <table className="min-w-full divide-y divide-border">
      <thead className="bg-background">
        <tr>
          <th className="px-2 py-3 w-8">
            <input
              type="checkbox"
              checked={items.length > 0 && selectedIds.size === items.length}
              onChange={onToggleSelectAll}
              className="rounded border-border"
            />
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Name</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Current company</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Title</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Yrs</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Location</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Added</th>
          <th className="px-4 py-3 w-1" />
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {items.map(it => {
          const p = candidates[it.item_id]
          if (!p) return (
            <tr key={it.item_id}>
              <td className="px-2 py-3" />
              <td colSpan={7} className="px-4 py-3 text-xs text-tertiary">(unknown candidate {it.item_id})</td>
            </tr>
          )
          const isSelected = selectedIds.has(p.person_id)
          return (
            <tr key={it.item_id} className={`hover:bg-background cursor-pointer ${isSelected ? 'bg-watch/5' : ''}`} onClick={() => onOpen(p.person_id)}>
              <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(p.person_id)} className="rounded border-border" />
              </td>
              <td className="px-4 py-3 whitespace-nowrap font-medium text-sm">{p.full_name || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{p.current_company_name || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{p.current_title_normalized || p.current_title_raw || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground font-mono">{p.years_experience_estimate ?? '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{p.location_name || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-xs text-tertiary">{new Date(it.added_at).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => onRemove(p.person_id)} className="text-xs text-tertiary hover:text-destructive">Remove</button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Company sub-table ─────────────────────────────────────────────────────

function CompanyTable({ items, companies, selectedIds, onToggleSelect, onToggleSelectAll, onRemove, onOpen }: {
  items: { item_id: string; added_at: string }[]
  companies: Record<string, CompanyRow>
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onRemove: (id: string) => void
  onOpen: (id: string) => void
}) {
  return (
    <table className="min-w-full divide-y divide-border">
      <thead className="bg-background">
        <tr>
          <th className="px-2 py-3 w-8">
            <input
              type="checkbox"
              checked={items.length > 0 && selectedIds.size === items.length}
              onChange={onToggleSelectAll}
              className="rounded border-border"
            />
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Company</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">HQ</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Category</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Industry</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Stage</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Total raised</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Founded</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Headcount</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">12m growth</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Added</th>
          <th className="px-4 py-3 w-1" />
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {items.map(it => {
          const c = companies[it.item_id]
          if (!c) return (
            <tr key={it.item_id}>
              <td className="px-2 py-3" />
              <td colSpan={11} className="px-4 py-3 text-xs text-tertiary">(unknown company {it.item_id})</td>
            </tr>
          )
          const isSelected = selectedIds.has(c.company_id)
          const sign = growthSign(c.headcount_growth_12m_pct)
          const growthColor = sign === 'up' ? 'text-green-600' : sign === 'down' ? 'text-red-600' : 'text-muted-foreground'
          return (
            <tr key={it.item_id} className={`hover:bg-background cursor-pointer ${isSelected ? 'bg-watch/5' : ''}`} onClick={() => onOpen(c.company_id)}>
              <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(c.company_id)} className="rounded border-border" />
              </td>
              <td className="px-4 py-3 whitespace-nowrap font-medium text-sm">
                <div className="flex items-center gap-2">
                  <CompanyLogo
                    domain={c.website_url || guessDomain(c.company_name)}
                    companyName={c.company_name}
                    logoUrl={c.logo_permalink}
                    size={20}
                  />
                  {c.company_name}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{c.hq_location_name || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-xs">
                {c.category ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${c.category === 'hardware' ? 'bg-emerald-500' : 'bg-sky-500'}`} aria-hidden />
                    {c.category === 'hardware' ? 'Hardware' : 'Non-hw'}
                  </span>
                ) : <span className="text-tertiary">—</span>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{c.primary_industry || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                {c.funding_stage
                  ? FUNDING_STAGE_LABELS[c.funding_stage as keyof typeof FUNDING_STAGE_LABELS] || c.funding_stage
                  : c.company_type === 'public' ? <span className="italic text-tertiary">Public</span>
                  : '—'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{formatFundingAmount(c.total_funding_usd)}</td>
              <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{c.founding_year ?? '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{c.headcount_latest?.toLocaleString() || c.headcount_range || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-xs">
                <span className={`font-mono ${growthColor}`}>{formatGrowthPct(c.headcount_growth_12m_pct)}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-xs text-tertiary">{new Date(it.added_at).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => onRemove(c.company_id)} className="text-xs text-tertiary hover:text-destructive">Remove</button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
