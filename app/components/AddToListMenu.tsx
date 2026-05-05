'use client'

// AddToListMenu — per-row dropdown to add a candidate or company to one of
// the user's lists. Lazy-loads list state on first open. Supports inline
// "create new list" for fast workflows.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  fetchLists,
  createList,
  addToList,
  removeFromList,
  listsContaining,
  type ListRow,
  type ListKind,
} from '@/lib/lists/api'

interface Props {
  itemId: string
  kind: ListKind
  /** Display label, e.g., the company or candidate name (used in the menu header) */
  itemLabel?: string
  /** Optional override of the trigger button's display */
  triggerLabel?: string
  /** Optional className for the trigger button */
  className?: string
}

export default function AddToListMenu({ itemId, kind, itemLabel, triggerLabel = '+ List', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [lists, setLists] = useState<ListRow[]>([])
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set())
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (popRef.current?.contains(e.target as Node)) return
      if (triggerRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function loadLists() {
    setLoading(true)
    setError(null)
    try {
      const [all, mine] = await Promise.all([fetchLists(kind), listsContaining(itemId, kind)])
      setLists(all)
      setMemberOf(mine)
    } catch (err: any) {
      setError(err?.message || 'Failed to load lists')
    } finally {
      setLoading(false)
    }
  }

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (open) { setOpen(false); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setAnchor({ top: rect.bottom + 4, left: rect.left })
    setOpen(true)
    await loadLists()
  }

  async function handleToggleMembership(listId: string, currentlyMember: boolean) {
    setError(null)
    try {
      if (currentlyMember) {
        await removeFromList(listId, itemId)
        setMemberOf(prev => { const n = new Set(prev); n.delete(listId); return n })
      } else {
        await addToList(listId, itemId)
        setMemberOf(prev => { const n = new Set(prev); n.add(listId); return n })
      }
    } catch (err: any) {
      setError(err?.message || 'Action failed')
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const created = await createList(kind, newName)
      await addToList(created.id, itemId)
      setLists(prev => [created, ...prev])
      setMemberOf(prev => new Set(prev).add(created.id))
      setNewName('')
    } catch (err: any) {
      setError(err?.message || 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className={`text-xs px-2 py-0.5 border border-border rounded hover:bg-background ${className}`}
        title="Add to list"
      >
        {triggerLabel}
      </button>
      {mounted && open && anchor && createPortal(
        <div
          ref={popRef}
          style={{
            position: 'fixed',
            top: anchor.top,
            left: anchor.left,
            zIndex: 9999,
            minWidth: 240,
            maxWidth: 320,
            backgroundColor: '#1f1f24',
            color: 'var(--fg-primary)',
            border: '1px solid #3a3a42',
            borderRadius: 8,
            boxShadow: '0 16px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid #2a2a32', backgroundColor: '#16161a' }}>
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--fg-tertiary)' }}>
              Add to list
            </span>
            <button onClick={() => setOpen(false)} className="text-sm" style={{ color: 'var(--fg-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-3 text-xs text-tertiary">Loading…</div>
            ) : lists.length === 0 ? (
              <div className="px-3 py-3 text-xs text-tertiary">No lists yet — create one below.</div>
            ) : (
              lists.map(l => {
                const isMember = memberOf.has(l.id)
                return (
                  <button
                    key={l.id}
                    onClick={() => handleToggleMembership(l.id, isMember)}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-background flex items-center justify-between"
                  >
                    <span>
                      <span style={{ color: 'var(--fg-primary)' }}>{l.name}</span>
                      <span className="ml-2 text-tertiary text-xs">({l.item_count ?? 0})</span>
                    </span>
                    {isMember && <span aria-hidden style={{ color: 'var(--accent)' }}>✓</span>}
                  </button>
                )
              })
            )}
          </div>
          <div className="px-3 py-2 border-t" style={{ borderTop: '1px solid #2a2a32' }}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="New list name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                className="flex-1 px-2 py-1 text-xs"
                style={{ background: 'var(--bg-canvas)', border: '1px solid #3a3a42', color: 'var(--fg-primary)', borderRadius: 4 }}
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-2 py-1 text-xs"
                style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 4, cursor: creating ? 'default' : 'pointer', opacity: creating || !newName.trim() ? 0.5 : 1 }}
              >
                {creating ? '…' : 'Create'}
              </button>
            </div>
            {error && <div className="text-[11px] mt-1" style={{ color: '#f87171' }}>{error}</div>}
            {itemLabel && <div className="text-[10px] mt-2 text-tertiary">Adding: {itemLabel}</div>}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
