// app/api/admin/companies-import/identify/route.ts
//
// Disambiguation step. Given a name OR LinkedIn URL OR domain, calls Crust
// /company/identify and returns the candidate matches so the admin can pick
// the canonical entity. Per resolved issue #8 in the inventory: do NOT
// auto-pick the top match — names like "Anduril" return multiple matches at
// confidence_score=1, and picking the first is wrong.
//
// Request: { name?, linkedin_url?, domain?, crustdata_company_id? }
//   Exactly one must be provided.
// Response: { matches: Array<{ crustdata_company_id, name, primary_domain,
//             professional_network_url, employee_count_range, year_founded,
//             industries, logo_permalink, confidence_score }> }
//
// Also flags any matches that already exist in our DB (so admin can avoid
// re-importing).

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

interface IdentifyRequestBody {
  name?: string
  linkedin_url?: string
  domain?: string
  crustdata_company_id?: number
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.CRUSTDATA_API_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!apiKey) return Response.json({ error: 'CRUSTDATA_API_KEY missing' }, { status: 500 })
  if (!supabaseUrl || !supabaseKey) return Response.json({ error: 'supabase env missing' }, { status: 500 })

  let body: IdentifyRequestBody
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const provided = [body.name, body.linkedin_url, body.domain, body.crustdata_company_id].filter(v => v !== undefined && v !== null && v !== '').length
  if (provided !== 1) {
    return Response.json({ error: 'Provide exactly one of: name, linkedin_url, domain, crustdata_company_id' }, { status: 400 })
  }

  const crustBody: Record<string, any> = {}
  if (body.crustdata_company_id) crustBody.crustdata_company_ids = [body.crustdata_company_id]
  else if (body.linkedin_url) crustBody.professional_network_profile_urls = [body.linkedin_url]
  else if (body.domain) crustBody.domains = [body.domain]
  else if (body.name) crustBody.names = [body.name]

  const resp = await fetch('https://api.crustdata.com/company/identify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'x-api-version': '2025-11-01',
    },
    body: JSON.stringify(crustBody),
  })

  if (!resp.ok) {
    const text = await resp.text()
    return Response.json({ matches: [], error: `Crust /company/identify HTTP ${resp.status}: ${text.slice(0, 300)}` }, { status: 502 })
  }

  const data = await resp.json().catch(() => null)
  const rawMatches = Array.isArray(data) && data[0]?.matches ? data[0].matches : []

  // Project to a clean shape for the UI.
  const matches = rawMatches.map((m: any) => {
    const bi = m?.company_data?.basic_info || {}
    return {
      crustdata_company_id: m?.company_data?.crustdata_company_id ?? bi.crustdata_company_id ?? null,
      name: bi.name || null,
      primary_domain: bi.primary_domain || null,
      professional_network_url: bi.professional_network_url || null,
      professional_network_id: bi.professional_network_id || null,
      employee_count_range: bi.employee_count_range || null,
      year_founded: bi.year_founded || null,
      industries: Array.isArray(bi.industries) ? bi.industries : [],
      logo_permalink: bi.logo_permalink || null,
      description: bi.description || null,
      confidence_score: typeof m?.confidence_score === 'number' ? m.confidence_score : null,
    }
  }).filter((x: any) => x.crustdata_company_id != null)

  // Cross-check against our DB — flag matches we already have. We don't gate
  // re-imports here; the import route is idempotent and will surface "already
  // imported" with the existing row.
  const supabase = createClient(supabaseUrl, supabaseKey)
  const ids = matches.map((m: any) => m.crustdata_company_id).filter(Boolean)
  let existing: Record<number, { company_id: string; review_status: string }> = {}
  if (ids.length > 0) {
    const { data: rows } = await supabase
      .from('companies')
      .select('company_id, crustdata_company_id, review_status')
      .in('crustdata_company_id', ids)
    for (const r of rows || []) {
      existing[r.crustdata_company_id as number] = { company_id: r.company_id, review_status: r.review_status }
    }
  }

  const annotated = matches.map((m: any) => ({
    ...m,
    existing: existing[m.crustdata_company_id] || null,
  }))

  return Response.json({ matches: annotated })
}
