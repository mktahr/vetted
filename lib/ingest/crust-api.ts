// lib/ingest/crust-api.ts
//
// Reusable helpers lifted from the old scripts/bulk-ingest.mjs so the
// /api/admin/import route can share the *exact* same Crust Data call,
// pagination, and retry logic. The mapper stays in mappers/crust.ts —
// this file is purely the network plumbing.

export const CRUST_SEARCH_URL = 'https://api.crustdata.com/screener/persondb/search'

// ─── Filter builder ─────────────────────────────────────────────────────────

export interface SearchInputs {
  company_name?: string | null
  job_title?: string | null
  location?: string | null
  /** How many records to return per Crust page (Crust max 1000, default 20). */
  pageSize?: number
}

export interface CrustRequestBody {
  filters: unknown
  limit: number
  cursor?: string
}

/**
 * Convert freeform user inputs to a Crust persondb search filter body.
 * Uses fuzzy `(.)` matching on each field. Any single field alone is valid;
 * throws if all fields are empty.
 */
export function buildFilterBody(inputs: SearchInputs): CrustRequestBody {
  const conditions: Array<{ column: string; type: string; value: string }> = []

  if (inputs.company_name?.trim()) {
    conditions.push({
      column: 'current_employers.name',
      type: '(.)',
      value: inputs.company_name.trim(),
    })
  }
  if (inputs.job_title?.trim()) {
    conditions.push({
      column: 'current_employers.title',
      type: '(.)',
      value: inputs.job_title.trim(),
    })
  }
  if (inputs.location?.trim()) {
    // Note: Crust docs warn `(.)` can fuzzy-match across country names.
    // Fine for single-city searches; adjust to `[.]` if false positives appear.
    conditions.push({
      column: 'region',
      type: '(.)',
      value: inputs.location.trim(),
    })
  }

  if (conditions.length === 0) {
    throw new Error('At least one of company_name, job_title, or location is required')
  }

  const filters = conditions.length === 1
    ? conditions[0]
    : { op: 'and', conditions }

  return {
    filters,
    limit: inputs.pageSize ?? 100,
  }
}

// ─── Crust search API call (same as bulk-ingest.mjs) ────────────────────────

export interface CrustPageResult {
  records: unknown[]
  cursor: string | null
  error?: string
}

export async function fetchCrustPage(
  apiKey: string,
  body: CrustRequestBody,
): Promise<CrustPageResult> {
  const resp = await fetch(CRUST_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text()
    return {
      records: [],
      cursor: null,
      error: `Crust API HTTP ${resp.status}: ${text.slice(0, 500)}`,
    }
  }

  const data = await resp.json()
  // Mirror bulk-ingest's fallback logic — try known record container keys.
  const records =
    (Array.isArray(data.results) && data.results) ||
    (Array.isArray(data.profiles) && data.profiles) ||
    (Array.isArray(data.data) && data.data) ||
    (Array.isArray(data) && data) ||
    []
  const cursor =
    data.next_cursor || data.cursor || data.next_page_cursor || null

  return { records, cursor }
}

// ─── Ingest POST with retry (same as bulk-ingest.mjs) ───────────────────────

export interface IngestPostResult {
  ok: boolean
  status: number
  body: Record<string, unknown>
}

export async function postIngest(
  endpoint: string,
  ingestSecret: string,
  payload: unknown,
  attempt = 0,
): Promise<IngestPostResult> {
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ingest-secret': ingestSecret,
      },
      body: JSON.stringify(payload),
    })
    const text = await resp.text()
    let body: Record<string, unknown>
    try {
      body = JSON.parse(text)
    } catch {
      body = { raw: text }
    }
    if (resp.ok) return { ok: true, status: resp.status, body }
    if (resp.status >= 500 && attempt < 2) {
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)))
      return postIngest(endpoint, ingestSecret, payload, attempt + 1)
    }
    return { ok: false, status: resp.status, body }
  } catch (err) {
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)))
      return postIngest(endpoint, ingestSecret, payload, attempt + 1)
    }
    return {
      ok: false,
      status: 0,
      body: { error: err instanceof Error ? err.message : 'Unknown error' },
    }
  }
}
