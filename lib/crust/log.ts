// lib/crust/log.ts
//
// Helper to write a row to crust_import_log. Used by all three routes.

import { SupabaseClient } from '@supabase/supabase-js'

export interface CrustLogEntry {
  request_kind: 'preview' | 'run' | 'autocomplete' | 'network_enrich'
  filter_body: unknown
  results_count?: number | null
  credits_used?: number | null
  error_message?: string | null
  user_id?: string | null
}

export async function writeCrustLog(
  supabase: SupabaseClient,
  entry: CrustLogEntry,
): Promise<void> {
  try {
    const { error } = await supabase.from('crust_import_log').insert({
      request_kind: entry.request_kind,
      filter_body: entry.filter_body,
      results_count: entry.results_count ?? null,
      credits_used: entry.credits_used ?? null,
      error_message: entry.error_message ?? null,
      user_id: entry.user_id ?? 'admin',
    })
    if (error) console.error('[crust_import_log] insert failed:', error)
  } catch (err) {
    console.error('[crust_import_log] insert exception:', err)
  }
}

/**
 * Round up Crust's 0.03 credits/result rate to whole credits.
 * Pricing: https://docs.crustdata.com/general/pricing
 */
export function estimateCredits(profiles: number): number {
  return Math.ceil(profiles * 0.03)
}
