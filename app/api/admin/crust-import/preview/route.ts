// app/api/admin/crust-import/preview/route.ts
//
// Preview a Crust import: returns total_count + 25 sample profiles.
// No DB writes. Used by the UI's "Preview Sample" button.
//
// Request body: { filters: UIFilterState }
// Response: {
//   total_count: number | null,
//   sample_count: number,
//   profiles: PersonSearchResult[],
//   excluded_count: number,
//   error?: string
// }

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchAllRows } from '@/lib/supabase'
import { fetchPersonSearch } from '@/lib/crust/api'
import { buildCrustFilter } from '@/lib/crust/build-filter'
import { writeCrustLog, estimateCredits } from '@/lib/crust/log'
import type { UIFilterState } from '@/lib/crust/types'

export const maxDuration = 60

const SAMPLE_LIMIT = 25
const EXCLUDE_PROFILES_CAP = 50000  // Crust supports up to this; chunk above

export async function POST(req: NextRequest) {
  const apiKey = process.env.CRUSTDATA_API_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!apiKey) return Response.json({ error: 'CRUSTDATA_API_KEY not set' }, { status: 500 })
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: 'Missing SUPABASE env vars' }, { status: 500 })
  }

  let body: { filters?: UIFilterState }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.filters) {
    return Response.json({ error: 'filters required' }, { status: 400 })
  }
  if (!body.filters.function_category || !body.filters.function_category.trim()) {
    return Response.json(
      { error: 'function_category is required' },
      { status: 400 },
    )
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const filterBody = buildCrustFilter(body.filters)
  if (!filterBody) {
    return Response.json({ error: 'No filters resolved from UI state' }, { status: 400 })
  }

  // Fetch existing linkedin_urls for exclude_profiles dedup
  let excludeProfiles: string[] = []
  try {
    const existing = await fetchAllRows<{ linkedin_url: string | null }>(
      'people',
      'linkedin_url',
      'linkedin_url',
    )
    excludeProfiles = existing
      .map(r => r.linkedin_url)
      .filter((u): u is string => !!u && u.trim().length > 0)
      .slice(0, EXCLUDE_PROFILES_CAP)
  } catch (err) {
    console.error('[crust-import/preview] exclude_profiles fetch failed:', err)
  }

  // Hit Crust with limit=SAMPLE_LIMIT
  const page = await fetchPersonSearch(apiKey, {
    filters: filterBody,
    limit: SAMPLE_LIMIT,
    post_processing: excludeProfiles.length > 0 ? { exclude_profiles: excludeProfiles } : undefined,
  })

  await writeCrustLog(supabase, {
    request_kind: 'preview',
    filter_body: filterBody as unknown,
    results_count: page.profiles.length,
    credits_used: estimateCredits(page.profiles.length),
    error_message: page.error ?? null,
  })

  if (page.error) {
    return Response.json(
      { error: page.error, total_count: null, sample_count: 0, profiles: [], excluded_count: excludeProfiles.length },
      { status: 502 },
    )
  }

  return Response.json({
    total_count: page.total_count,
    sample_count: page.profiles.length,
    profiles: page.profiles,
    excluded_count: excludeProfiles.length,
  })
}
