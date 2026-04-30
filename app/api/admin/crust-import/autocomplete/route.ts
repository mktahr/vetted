// app/api/admin/crust-import/autocomplete/route.ts
//
// Proxies typeahead requests from the admin import UI to Crust's
// /person/search/autocomplete endpoint. Keeps the API key on the server.
//
// Request body: { field: string, query: string, limit?: number }
// Response:     { suggestions: [{ value }], error?: string }
//
// Field must be one of the keys in AUTOCOMPLETE_FIELDS (lib/crust/types.ts).

import { NextRequest } from 'next/server'
import { fetchAutocomplete } from '@/lib/crust/api'
import { AUTOCOMPLETE_FIELDS, type AutocompleteFieldKey } from '@/lib/crust/types'

// Vercel Edge runtime — no cold starts. Crust autocomplete is small and
// pure (just proxies a fetch), so edge eliminates the 20s cold-start penalty
// that made the dropdowns appear hung on first interaction.
export const runtime = 'edge'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const apiKey = process.env.CRUSTDATA_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'CRUSTDATA_API_KEY not set' }, { status: 500 })
  }

  let body: { fieldKey?: string; query?: string; limit?: number }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const fieldKey = body.fieldKey as AutocompleteFieldKey
  if (!fieldKey || !(fieldKey in AUTOCOMPLETE_FIELDS)) {
    return Response.json(
      { error: `fieldKey must be one of: ${Object.keys(AUTOCOMPLETE_FIELDS).join(', ')}` },
      { status: 400 },
    )
  }

  const crustField = AUTOCOMPLETE_FIELDS[fieldKey]
  const query = typeof body.query === 'string' ? body.query : ''
  const limit = typeof body.limit === 'number' && body.limit > 0 && body.limit <= 100
    ? body.limit
    : 20

  const result = await fetchAutocomplete(apiKey, {
    field: crustField,
    query,
    limit,
  })

  if (result.error) {
    return Response.json({ suggestions: [], error: result.error }, { status: 502 })
  }

  // Filter out blank values (Crust may return "" as a top suggestion when
  // a field has many empty indexed records — see autocomplete recipes docs).
  const filtered = result.suggestions.filter(s => s.value && s.value.trim().length > 0)
  return Response.json({ suggestions: filtered })
}
