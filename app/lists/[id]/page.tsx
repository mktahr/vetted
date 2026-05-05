'use client'

// /lists/[id] — show items in a list. Pulls list metadata, then the
// underlying candidate/company rows for each item so we render a useful
// table (not just IDs).

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
  current_company_name: string | null
}

interface CompanyRow {
  company_id: string
  company_name: string
  hq_location_name: string | null
  primary_industry: string | null
  total_funding_usd: number | null
  funding_stage: string | null
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
              location_name,
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
              current_company_name: r.companies?.company_name || null,
            }
          }
          setCandidates(map)
        } else {
          const { data: rows } = await supabase
            .from('companies')
            .select('company_id, company_name, hq_location_name, primary_industry, total_funding_usd, funding_stage, logo_permalink, website_url')
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

  async function handleRemove(itemId: string) {
    try {
      await removeFromList(listId, itemId)
      setItems(prev => prev.filter(i => i.item_id !== itemId))
    } catch (err: any) {
      alert(`Remove failed: ${err.message}`)
    }
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
    return <div style={{ padding: 24, color: 'var(--fg-primary)', background: 'var(--bg-canvas)', minHeight: '100vh', fontFamily: 'var(--font-sans)' }}>
      <a href="/lists" className="text-sm text-muted-foreground">← All lists</a>
      <p className="mt-3 text-red-500">{error || 'List not found'}</p>
    </div>
  }

  return (
    <div style={{ padding: 24, background: 'var(--bg-canvas)', color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>
      <div className="mb-6">
        <a href="/lists" className="text-sm text-muted-foreground hover:text-foreground">← All lists</a>
        <div className="mt-2 flex items-center gap-3">
          {editName == null ? (
            <h1 className="text-3xl font-bold cursor-text" onClick={() => setEditName(meta.name)}>{meta.name}</h1>
          ) : (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditName(null) }}
              className="text-3xl font-bold bg-transparent border-b border-border focus:outline-none focus:border-accent"
            />
          )}
          <span className="px-2 py-0.5 text-xs rounded bg-card border border-border text-tertiary uppercase">{meta.kind}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{items.length} item{items.length === 1 ? '' : 's'}</p>
      </div>

      {items.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-tertiary">
          No items yet. Add some via the &ldquo;+ List&rdquo; button on a {meta.kind} row.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {meta.kind === 'candidate' ? (
            <CandidateTable items={items} candidates={candidates} onRemove={handleRemove} onOpen={(id) => router.push(`/profile/${id}`)} />
          ) : (
            <CompanyTable items={items} companies={companies} onRemove={handleRemove} onOpen={(id) => router.push(`/admin/companies/${id}`)} />
          )}
        </div>
      )}
    </div>
  )
}

function CandidateTable({ items, candidates, onRemove, onOpen }: {
  items: { item_id: string; added_at: string }[]
  candidates: Record<string, CandidateRow>
  onRemove: (id: string) => void
  onOpen: (id: string) => void
}) {
  return (
    <table className="min-w-full divide-y divide-border">
      <thead className="bg-background">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Name</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Current company</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Title</th>
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
              <td colSpan={6} className="px-4 py-3 text-xs text-tertiary">(unknown candidate {it.item_id})</td>
            </tr>
          )
          return (
            <tr key={it.item_id} className="hover:bg-background cursor-pointer" onClick={() => onOpen(p.person_id)}>
              <td className="px-4 py-3 whitespace-nowrap font-medium text-sm">{p.full_name || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{p.current_company_name || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{p.current_title_normalized || p.current_title_raw || '—'}</td>
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

function CompanyTable({ items, companies, onRemove, onOpen }: {
  items: { item_id: string; added_at: string }[]
  companies: Record<string, CompanyRow>
  onRemove: (id: string) => void
  onOpen: (id: string) => void
}) {
  return (
    <table className="min-w-full divide-y divide-border">
      <thead className="bg-background">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Company</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">HQ</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Industry</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Stage</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Added</th>
          <th className="px-4 py-3 w-1" />
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {items.map(it => {
          const c = companies[it.item_id]
          if (!c) return (
            <tr key={it.item_id}>
              <td colSpan={6} className="px-4 py-3 text-xs text-tertiary">(unknown company {it.item_id})</td>
            </tr>
          )
          return (
            <tr key={it.item_id} className="hover:bg-background cursor-pointer" onClick={() => onOpen(c.company_id)}>
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
              <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{c.hq_location_name || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{c.primary_industry || '—'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">{c.funding_stage || '—'}</td>
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
