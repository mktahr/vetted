import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Fetch all rows from a table, paginating past Supabase's 1000-row server limit.
 * Returns the full array. Use for reference tables (companies, schools) that may
 * exceed 1000 rows.
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  table: string,
  select: string,
  orderBy?: string,
): Promise<T[]> {
  const PAGE_SIZE = 1000
  let all: T[] = []
  let page = 0
  while (true) {
    let query = supabase.from(table).select(select).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (orderBy) query = query.order(orderBy)
    const { data, error } = await query
    if (error) throw new Error(`fetchAllRows(${table}): ${error.message}`)
    if (!data || data.length === 0) break
    all = all.concat(data as T[])
    if (data.length < PAGE_SIZE) break
    page++
  }
  return all
}

