'use client'

// /lists — browse all user-owned lists for both candidates and companies.
// Click a list to drill into its items.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchLists, deleteList, type ListRow } from '@/lib/lists/api'
import TopNav from '@/app/components/TopNav'

export default function ListsPage() {
  const router = useRouter()
  const [candidateLists, setCandidateLists] = useState<ListRow[]>([])
  const [companyLists, setCompanyLists] = useState<ListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [cand, comp] = await Promise.all([fetchLists('candidate'), fetchLists('company')])
        if (cancelled) return
        setCandidateLists(cand)
        setCompanyLists(comp)
      } catch (err: any) {
        if (cancelled) return
        setError(err?.message || 'Failed to load lists')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function handleDelete(listId: string, kind: 'candidate' | 'company') {
    if (deleteConfirm !== listId) {
      setDeleteConfirm(listId)
      return
    }
    try {
      await deleteList(listId)
      if (kind === 'candidate') setCandidateLists(prev => prev.filter(l => l.id !== listId))
      else setCompanyLists(prev => prev.filter(l => l.id !== listId))
      setDeleteConfirm(null)
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`)
      setDeleteConfirm(null)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)', background: 'var(--bg-canvas)', minHeight: '100vh' }}>
        Loading lists…
      </div>
    )
  }

  return (
    <div style={{ padding: 24, background: 'var(--bg-canvas)', color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>
      <TopNav
        title="Lists"
        subtitle={<>Bookmarks of candidates and companies. Add items via the &ldquo;+&rdquo; button on any row.</>}
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ListColumn
          title="Candidate lists"
          lists={candidateLists}
          onOpen={(id) => router.push(`/lists/${id}`)}
          onDelete={(id) => handleDelete(id, 'candidate')}
          deleteConfirm={deleteConfirm}
        />
        <ListColumn
          title="Company lists"
          lists={companyLists}
          onOpen={(id) => router.push(`/lists/${id}`)}
          onDelete={(id) => handleDelete(id, 'company')}
          deleteConfirm={deleteConfirm}
        />
      </div>
    </div>
  )
}

function ListColumn({
  title,
  lists,
  onOpen,
  onDelete,
  deleteConfirm,
}: {
  title: string
  lists: ListRow[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  deleteConfirm: string | null
}) {
  return (
    <section className="bg-card border border-border rounded-lg">
      <header className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-tertiary">{title}</h2>
        <span className="text-xs text-tertiary">{lists.length}</span>
      </header>
      {lists.length === 0 ? (
        <div className="px-4 py-6 text-sm text-tertiary text-center">No lists yet.</div>
      ) : (
        <div className="divide-y divide-border">
          {lists.map(l => (
            <div key={l.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-background cursor-pointer" onClick={() => onOpen(l.id)}>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{l.name}</div>
                <div className="text-xs text-tertiary">{l.item_count ?? 0} item{(l.item_count ?? 0) === 1 ? '' : 's'} · updated {new Date(l.updated_at).toLocaleDateString()}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(l.id) }}
                className={`text-xs px-2 py-0.5 rounded ${
                  deleteConfirm === l.id
                    ? 'bg-destructive text-white'
                    : 'text-tertiary hover:text-destructive border border-transparent hover:border-destructive/30'
                }`}
              >
                {deleteConfirm === l.id ? 'Confirm?' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
