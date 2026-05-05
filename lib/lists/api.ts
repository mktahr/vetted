// lib/lists/api.ts
//
// Client helpers for the lists feature. Used from:
//   - AddToListMenu component (per-row dropdown on companies list / candidate table)
//   - /lists pages (browse + drill in)
//
// Single-user app for now: owner_id is hardcoded 'admin'. When real auth
// ships, swap that for the authenticated user_id.

import { supabase } from '@/lib/supabase'

const OWNER_ID = 'admin'  // TODO: replace with real auth user_id

export type ListKind = 'candidate' | 'company'

export interface ListRow {
  id: string
  name: string
  kind: ListKind
  notes: string | null
  created_at: string
  updated_at: string
  // Joined: count of items in this list
  item_count?: number
}

export interface ListItem {
  list_id: string
  item_id: string
  added_at: string
  notes: string | null
}

/**
 * Fetch all lists for a kind, with item counts.
 */
export async function fetchLists(kind: ListKind): Promise<ListRow[]> {
  const { data: lists, error } = await supabase
    .from('lists')
    .select('id, name, kind, notes, created_at, updated_at')
    .eq('owner_id', OWNER_ID)
    .eq('kind', kind)
    .order('updated_at', { ascending: false })
  if (error) throw error
  if (!lists || lists.length === 0) return []
  // Pull item counts via a separate query — supabase-js doesn't expose
  // SQL-level COUNT joins on the same select.
  const ids = lists.map(l => l.id)
  const { data: items } = await supabase
    .from('list_items')
    .select('list_id')
    .in('list_id', ids)
  const counts: Record<string, number> = {}
  for (const it of items || []) {
    counts[it.list_id] = (counts[it.list_id] || 0) + 1
  }
  return lists.map(l => ({ ...l, kind: l.kind as ListKind, item_count: counts[l.id] || 0 }))
}

/**
 * Fetch all items for a given list. Caller joins against people/companies
 * separately for full row data.
 */
export async function fetchListItems(listId: string): Promise<ListItem[]> {
  const { data, error } = await supabase
    .from('list_items')
    .select('list_id, item_id, added_at, notes')
    .eq('list_id', listId)
    .order('added_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createList(kind: ListKind, name: string): Promise<ListRow> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('List name cannot be empty')
  const { data, error } = await supabase
    .from('lists')
    .insert({ owner_id: OWNER_ID, kind, name: trimmed })
    .select('id, name, kind, notes, created_at, updated_at')
    .single()
  if (error) throw error
  return { ...data, kind: data.kind as ListKind, item_count: 0 }
}

export async function renameList(listId: string, newName: string): Promise<void> {
  const trimmed = newName.trim()
  if (!trimmed) throw new Error('List name cannot be empty')
  const { error } = await supabase
    .from('lists')
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq('id', listId)
  if (error) throw error
}

export async function deleteList(listId: string): Promise<void> {
  // CASCADE handles list_items
  const { error } = await supabase.from('lists').delete().eq('id', listId)
  if (error) throw error
}

export async function addToList(listId: string, itemId: string): Promise<void> {
  const { error } = await supabase
    .from('list_items')
    .upsert({ list_id: listId, item_id: itemId }, { onConflict: 'list_id,item_id', ignoreDuplicates: true })
  if (error) throw error
  // Touch the parent list's updated_at so it sorts to the top of recent activity
  await supabase
    .from('lists')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', listId)
}

export async function removeFromList(listId: string, itemId: string): Promise<void> {
  const { error } = await supabase
    .from('list_items')
    .delete()
    .eq('list_id', listId)
    .eq('item_id', itemId)
  if (error) throw error
}

/**
 * Returns a Set of list_ids that contain itemId. Used by AddToListMenu to
 * show a checkmark next to lists the item is already in.
 */
export async function listsContaining(itemId: string, kind: ListKind): Promise<Set<string>> {
  const { data: ownerLists } = await supabase
    .from('lists')
    .select('id')
    .eq('owner_id', OWNER_ID)
    .eq('kind', kind)
  const ids = (ownerLists || []).map(l => l.id)
  if (ids.length === 0) return new Set()
  const { data: items } = await supabase
    .from('list_items')
    .select('list_id')
    .in('list_id', ids)
    .eq('item_id', itemId)
  return new Set((items || []).map(i => i.list_id))
}
