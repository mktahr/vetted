// app/api/admin/companies-import/autocomplete/route.ts
//
// Proxies typeahead requests for company-name lookup to Crust's
// /company/search/autocomplete endpoint. Keeps the API key on the server.
//
// Request body: { query: string, limit?: number, field?: string }
//   field defaults to 'basic_info.name'. Other valid values per the docs:
//     basic_info.primary_domain | basic_info.industries |
//     taxonomy.professional_network_industry | taxonomy.categories
//
// Response: { suggestions: [{ value }], error?: string }
//
// Cost: FREE (per Crust's pricing for autocomplete).
// Rate limit: 15 req/min default.

import { NextRequest } from 'next/server'

export const runtime = 'edge'
export const maxDuration = 30

const COMPANY_AUTOCOMPLETE_FIELDS = new Set([
  'basic_info.name',
  'basic_info.primary_domain',
  'basic_info.industries',
  'basic_info.company_type',
  'basic_info.employee_count_range',
  'taxonomy.professional_network_industry',
  'taxonomy.categories',
  'locations.country',
  'locations.state',
  'locations.city',
])

export async function POST(req: NextRequest) {
  const apiKey = process.env.CRUSTDATA_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'CRUSTDATA_API_KEY not set' }, { status: 500 })
  }

  let body: { query?: string; limit?: number; field?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const field = typeof body.field === 'string' ? body.field : 'basic_info.name'
  if (!COMPANY_AUTOCOMPLETE_FIELDS.has(field)) {
    return Response.json({ error: `Unsupported field: ${field}` }, { status: 400 })
  }
  const query = typeof body.query === 'string' ? body.query : ''
  const limit = typeof body.limit === 'number' && body.limit > 0 && body.limit <= 100
    ? body.limit
    : 20

  const resp = await fetch('https://api.crustdata.com/company/search/autocomplete', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'x-api-version': '2025-11-01',
    },
    body: JSON.stringify({ field, query, limit }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    return Response.json({ suggestions: [], error: `Crust HTTP ${resp.status}: ${text.slice(0, 300)}` }, { status: 502 })
  }

  const data = await resp.json().catch(() => null)
  const suggestions: Array<{ value: string }> = Array.isArray(data?.suggestions)
    ? data.suggestions
        .filter((s: any) => s && typeof s.value === 'string' && s.value.trim().length > 0)
        .map((s: any) => ({ value: s.value }))
    : []

  return Response.json({ suggestions })
}
