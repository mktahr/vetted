'use client'

// /admin/companies/triage
//
// Surfaces companies that need admin attention:
//   review_status='unreviewed' OR tagging_confidence < 0.7 OR tagging_method IS NULL
//
// Sort: candidate count DESC (more candidates = higher impact),
// then tagging_confidence ASC (lowest confidence first).
//
// Inline edit allowed: category, review_status. Anything richer goes to the
// detail page. "Skip for now" is client-only (does NOT persist).

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Company, CompanyCategory, CompanyReviewStatus } from '@/app/types'
import CompanyLogo, { guessDomain } from '@/app/components/CompanyLogo'
import IndustryBadge from '@/app/components/IndustryBadge'
import TopNav from '@/app/components/TopNav'
import { fetchAllRows } from '@/lib/supabase'
import { TAGGING_METHOD_LABELS, taggingMethodLabel } from '@/lib/companies/taxonomy'

type ReasonFilter = 'all' | 'unreviewed' | 'low_confidence' | 'untagged'
type CategoryFilter = '' | 'hardware' | 'non_hardware' | 'unclassified'

const REASON_OPTIONS: Array<{ value: ReasonFilter; label: string }> = [
  { value: 'all',            label: 'All reasons' },
  { value: 'unreviewed',     label: 'Unreviewed' },
  { value: 'low_confidence', label: 'Low confidence (<0.7)' },
  { value: 'untagged',       label: 'Untagged (cron pending)' },
]

const CATEGORY_OPTIONS: Array<{ value: CategoryFilter; label: string }> = [
  { value: '',             label: 'All categories' },
  { value: 'hardware',     label: 'Hardware' },
  { value: 'non_hardware', label: 'Non-hardware' },
  { value: 'unclassified', label: 'Unclassified (NULL)' },
]

const TAGGING_METHOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',         label: 'All tagging methods' },
  { value: 'untagged', label: 'Waiting for tagger' },
  ...Object.entries(TAGGING_METHOD_LABELS).map(([value, label]) => ({ value, label })),
]

export default function TriagePage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [candidateCounts, setCandidateCounts] = useState<Record<string, number>>({})
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('')
  const [taggingMethodFilter, setTaggingMethodFilter] = useState<string>('')

  useEffect(() => {
    async function load() {
      try {
        // Pull queue (could be paginated with .or, but with 1.5k companies a
        // single fetch is fine; we paginate just to stay safe past 1k cap).
        let allRows: Company[] = []
        let from = 0
        const pageSize = 1000
        while (true) {
          const { data, error: pageErr } = await supabase
            .from('companies')
            .select('*')
            .or('review_status.eq.unreviewed,tagging_confidence.lt.0.7,tagging_method.is.null')
            .range(from, from + pageSize - 1)
          if (pageErr) throw pageErr
          if (!data || data.length === 0) break
          allRows = allRows.concat(data as Company[])
          if (data.length < pageSize) break
          from += pageSize
        }
        setCompanies(allRows)

        // Candidate counts per current_company_id. Tiny today (<100 people);
        // pre-aggregate client-side. If this grows past ~10k people, switch
        // to a Postgres view.
        const peopleRows = await fetchAllRows('people', 'current_company_id')
        const counts: Record<string, number> = {}
        for (const r of peopleRows as Array<{ current_company_id: string | null }>) {
          if (!r.current_company_id) continue
          counts[r.current_company_id] = (counts[r.current_company_id] || 0) + 1
        }
        setCandidateCounts(counts)
      } catch (err: any) {
        setError(err?.message || 'Failed to load triage queue.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    let rows = companies.filter(c => !skippedIds.has(c.company_id))

    // Reason filter — narrows the OR-condition queue.
    if (reasonFilter === 'unreviewed') {
      rows = rows.filter(c => c.review_status === 'unreviewed')
    } else if (reasonFilter === 'low_confidence') {
      rows = rows.filter(c => c.tagging_confidence != null && c.tagging_confidence < 0.7)
    } else if (reasonFilter === 'untagged') {
      rows = rows.filter(c => c.tagging_method == null)
    }

    if (categoryFilter === 'hardware') rows = rows.filter(c => c.category === 'hardware')
    else if (categoryFilter === 'non_hardware') rows = rows.filter(c => c.category === 'non_hardware')
    else if (categoryFilter === 'unclassified') rows = rows.filter(c => c.category == null)

    if (taggingMethodFilter === 'untagged') rows = rows.filter(c => c.tagging_method == null)
    else if (taggingMethodFilter) rows = rows.filter(c => c.tagging_method === taggingMethodFilter)

    // Sort: candidate count DESC, then confidence ASC, then name
    rows.sort((a, b) => {
      const ca = candidateCounts[a.company_id] || 0
      const cb = candidateCounts[b.company_id] || 0
      if (ca !== cb) return cb - ca
      const confA = a.tagging_confidence ?? -1
      const confB = b.tagging_confidence ?? -1
      if (confA !== confB) return confA - confB
      return a.company_name.localeCompare(b.company_name)
    })

    return rows
  }, [companies, candidateCounts, skippedIds, reasonFilter, categoryFilter, taggingMethodFilter])

  async function setCategoryInline(c: Company, newCategory: CompanyCategory | null) {
    setSavingId(c.company_id)
    // CHECK constraint forces clearing primary_industry/industries[]/domain_tags[]
    // when category goes NULL. Setting to a concrete category preserves those
    // (admin still has to fill them in on the detail page).
    const update: Record<string, unknown> =
      newCategory === null
        ? { category: null, primary_industry: null, industries: [], domain_tags: [], tagging_method: 'manual', tagging_confidence: 1.0 }
        : { category: newCategory, tagging_method: 'manual', tagging_confidence: 1.0 }
    const { error: updateErr } = await supabase
      .from('companies')
      .update(update)
      .eq('company_id', c.company_id)
    if (updateErr) {
      alert(`Failed to update category: ${updateErr.message}`)
    } else {
      setCompanies(prev => prev.map(x => x.company_id === c.company_id ? { ...x, ...(update as Partial<Company>) } as Company : x))
    }
    setSavingId(null)
  }

  async function setReviewInline(c: Company, newReview: CompanyReviewStatus) {
    setSavingId(c.company_id)
    const { error: updateErr } = await supabase
      .from('companies')
      .update({ review_status: newReview })
      .eq('company_id', c.company_id)
    if (updateErr) {
      alert(`Failed to update review_status: ${updateErr.message}`)
    } else {
      setCompanies(prev => prev.map(x => x.company_id === c.company_id ? { ...x, review_status: newReview } : x))
    }
    setSavingId(null)
  }

  function skip(c: Company) {
    setSkippedIds(prev => {
      const next = new Set(prev)
      next.add(c.company_id)
      return next
    })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64vh', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)', background: 'var(--bg-canvas)' }}>
        Loading triage queue…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 24, background: 'var(--bg-canvas)', minHeight: '100vh', fontFamily: 'var(--font-sans)' }}>
        <div style={{ background: 'var(--red-950)', border: '1px solid var(--red-800)', borderRadius: 'var(--r-card)', padding: 16 }}>
          <h2 style={{ color: 'var(--red-400)', fontWeight: 'var(--fw-semibold)', marginBottom: 8 }}>Error</h2>
          <p style={{ color: 'var(--red-300)', fontSize: 'var(--fs-13)' }}>{error}</p>
        </div>
      </div>
    )
  }

  const totalQueue = companies.length - skippedIds.size

  return (
    <div style={{ padding: 24, background: 'var(--bg-canvas)', color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>
      <div className="mb-6">
        <a href="/admin/companies" className="text-sm text-muted-foreground hover:text-foreground inline-block mb-2">← Back to companies</a>
        <h1 className="text-3xl font-bold tracking-tight">Triage queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {totalQueue} compan{totalQueue === 1 ? 'y' : 'ies'} need attention
          {skippedIds.size > 0 && <span className="text-tertiary"> · {skippedIds.size} skipped this session</span>}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Reason in queue</label>
          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value as ReasonFilter)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {REASON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Tagging method</label>
          <select
            value={taggingMethodFilter}
            onChange={(e) => setTaggingMethodFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {TAGGING_METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {(reasonFilter !== 'all' || categoryFilter || taggingMethodFilter) && (
          <button
            onClick={() => { setReasonFilter('all'); setCategoryFilter(''); setTaggingMethodFilter('') }}
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg bg-card hover:bg-background"
          >
            Clear filters
          </button>
        )}
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground">Showing {filtered.length} of {totalQueue}</span>
      </div>

      <div className="bg-card rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-background">
              <tr>
                <th className="px-2 py-3 w-9" title="LinkedIn">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" className="text-tertiary"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Candidates</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Industry</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Tags</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Tagging</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider">Review</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-tertiary uppercase tracking-wider w-1">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-tertiary">
                  {totalQueue === 0 ? '🎉 Triage queue is empty.' : 'No matching companies — try clearing filters.'}
                </td></tr>
              ) : (
                filtered.map(c => {
                  const count = candidateCounts[c.company_id] || 0
                  const saving = savingId === c.company_id
                  return (
                    <tr
                      key={c.company_id}
                      className="hover:bg-background cursor-pointer"
                      onClick={() => router.push(`/admin/companies/${c.company_id}`)}
                    >
                      <td className="px-2 py-3 w-9" onClick={(e) => e.stopPropagation()}>
                        {c.linkedin_url ? (
                          <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-tertiary hover:text-foreground">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                          </a>
                        ) : (
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" className="text-tertiary" style={{ opacity: 0.25 }}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <CompanyLogo domain={guessDomain(c.company_name)} companyName={c.company_name} size={20} />
                          <span className="text-foreground font-medium">{c.company_name}</span>
                          {c.tagging_method == null && (
                            <span title="Awaiting auto-tagger" className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">tagging…</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={count > 0 ? 'font-semibold' : 'text-tertiary'}>
                          {count}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        {c.category ? (
                          <span className={`inline-block px-2 py-0.5 rounded ${c.category === 'hardware' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>
                            {c.category === 'hardware' ? 'Hardware' : 'Non-hw'}
                          </span>
                        ) : <span className="text-tertiary">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                        <IndustryBadge primary={c.primary_industry} industries={c.industries || []} compact />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {c.domain_tags && c.domain_tags.length > 0 ? c.domain_tags.slice(0, 3).join(', ') + (c.domain_tags.length > 3 ? ` +${c.domain_tags.length - 3}` : '') : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground" title={c.tagging_notes || ''}>
                        {c.tagging_method ? (
                          <span>
                            {taggingMethodLabel(c.tagging_method)}
                            {c.tagging_confidence != null && <span className="text-tertiary ml-1">({c.tagging_confidence.toFixed(2)})</span>}
                          </span>
                        ) : <span className="text-tertiary">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        <span className={`inline-block px-2 py-0.5 rounded ${
                          c.review_status === 'vetted' ? 'bg-green-100 text-green-800'
                          : c.review_status === 'excluded' ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-700'
                        }`}>{c.review_status}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {/* Inline category set */}
                          <select
                            value={c.category ?? ''}
                            onChange={(e) => {
                              const v = e.target.value
                              setCategoryInline(c, v === '' ? null : (v as CompanyCategory))
                            }}
                            disabled={saving}
                            className="px-1 py-0.5 text-xs border border-border rounded bg-card disabled:opacity-50"
                            title="Set category (also marks tagging_method=manual)"
                          >
                            <option value="">—</option>
                            <option value="hardware">HW</option>
                            <option value="non_hardware">NH</option>
                          </select>
                          <button
                            onClick={() => setReviewInline(c, 'vetted')}
                            disabled={saving || c.review_status === 'vetted'}
                            className="px-2 py-0.5 text-xs bg-green-50 text-green-800 border border-green-200 rounded hover:bg-green-100 disabled:opacity-30"
                            title="Mark vetted"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setReviewInline(c, 'excluded')}
                            disabled={saving || c.review_status === 'excluded'}
                            className="px-2 py-0.5 text-xs bg-red-50 text-red-800 border border-red-200 rounded hover:bg-red-100 disabled:opacity-30"
                            title="Mark excluded"
                          >
                            ✗
                          </button>
                          <button
                            onClick={() => skip(c)}
                            className="px-2 py-0.5 text-xs text-muted-foreground border border-border rounded hover:bg-background"
                            title="Skip for this session (does not save)"
                          >
                            Skip
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
