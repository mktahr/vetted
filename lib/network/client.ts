// lib/network/client.ts
//
// Server-side Supabase access for the network module. Uses the service-role key
// (same pattern as app/api/ingest/route.ts) so reads/writes bypass RLS. The
// module's tables have RLS disabled (migration 076); this client is for server
// route handlers and scripts only — never import it into client components.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function getServiceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Paginated full-table read for server code (the browser fetchAllRows helper in
 * lib/supabase.ts uses the anon client). Pulls every row in `pageSize` chunks.
 */
export async function fetchAllServer<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  applyFilter?: (q: ReturnType<SupabaseClient['from']>['select'] extends never ? never : any) => any,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    let q = supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (applyFilter) q = applyFilter(q);
    const { data, error } = await q;
    if (error) throw new Error(`fetchAllServer(${table}): ${error.message}`);
    const batch = (data ?? []) as T[];
    out.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return out;
}
