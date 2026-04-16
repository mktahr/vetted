// app/api/admin/import/preview/route.ts
//
// Sample-first workflow step 1: call Crust Person Search with preview=true
// and limit=50, returning a JSON preview of results + total_count.

import { NextRequest } from 'next/server'
import {
  buildPersonSearchBody,
  fetchPersonSearchPage,
  type PersonSearchInputs,
} from '@/lib/ingest/crust-person-search'

export async function POST(req: NextRequest) {
  const apiKey = process.env.CRUSTDATA_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'CRUSTDATA_API_KEY not set' }, { status: 500 })
  }

  let inputs: PersonSearchInputs
  try {
    inputs = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  let body
  try {
    // preview=true isn't available on this Crust plan; a limit=50 call still
    // returns a small sample plus total_count for the confirm dialog.
    body = buildPersonSearchBody(inputs, { limit: 50 })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Bad inputs' },
      { status: 400 },
    )
  }

  const page = await fetchPersonSearchPage(apiKey, body)
  if (page.error) {
    return Response.json({ error: page.error }, { status: 502 })
  }

  // Extract display-friendly fields for the preview table.
  // Note: seniority_level and function_category are filter-only fields in v2
  // — they aren't returned in responses, so the Seniority column shows '—'.
  const samples = page.records.map(r => {
    const cur = r.experience?.employment_details?.current ?? []
    const primary = cur.find(e => e.is_default === true) ?? cur[0]
    const loc = r.basic_profile?.location
    const location = loc?.raw?.trim()
      || [loc?.city, loc?.state, loc?.country].filter(Boolean).join(', ')
      || null
    let yearsAtCompany: number | null = null
    if (primary?.start_date) {
      const start = new Date(primary.start_date)
      if (!isNaN(start.getTime())) {
        const years = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
        yearsAtCompany = Math.round(years * 10) / 10
      }
    }
    return {
      name: r.basic_profile?.name ?? '(unknown)',
      current_title: primary?.title ?? r.basic_profile?.current_title ?? null,
      current_company: primary?.name ?? null,
      location,
      seniority_level: null,
      years_at_company: yearsAtCompany,
      linkedin_url: r.social_handles?.professional_network_identifier?.profile_url ?? null,
    }
  })

  return Response.json({
    total_count: page.total_count,
    sample_count: samples.length,
    samples,
    filters: inputs,
  })
}
