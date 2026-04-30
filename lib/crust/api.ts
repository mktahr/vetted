// lib/crust/api.ts
//
// Server-side Crust Data v2 API client.
// Wraps /person/search and /person/search/autocomplete with auth headers,
// rate-limit retry, and typed responses.
//
// API base: https://api.crustdata.com
// Docs:     https://docs.crustdata.com/person-docs/search/reference

import type {
  CrustFilters,
  CrustFilterCondition,
  CrustFilterGroup,
} from './types'

const API_BASE = 'https://api.crustdata.com'
const API_VERSION = '2025-11-01'

// ─── Common headers ────────────────────────────────────────────────────────

function authHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'x-api-version': API_VERSION,
  }
}

// ─── Rate-limit retry wrapper ──────────────────────────────────────────────
//
// Crust's documented rate limit is 15 req/min on /person/search and the
// autocomplete endpoint. On 429 we retry with exponential backoff: 2s, 4s, 8s.

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let lastResp: Response | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, init)
    if (resp.status !== 429) return resp
    lastResp = resp
    if (attempt < maxRetries) {
      const delayMs = 2000 * Math.pow(2, attempt)
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
  return lastResp as Response
}

// ─── Autocomplete ──────────────────────────────────────────────────────────

export interface AutocompleteRequest {
  field: string                 // e.g. 'experience.employment_details.current.function_category'
  query: string                 // empty string returns top values by frequency
  limit?: number                // 1-100, default 20
  filters?: CrustFilters        // optional scope-down filter
}

export interface AutocompleteResponse {
  suggestions: Array<{ value: string }>
  error?: string
}

export async function fetchAutocomplete(
  apiKey: string,
  req: AutocompleteRequest,
): Promise<AutocompleteResponse> {
  const body: Record<string, unknown> = {
    field: req.field,
    query: req.query,
    limit: req.limit ?? 20,
  }
  if (req.filters) body.filters = req.filters

  const resp = await fetchWithRetry(
    `${API_BASE}/person/search/autocomplete`,
    {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify(body),
    },
  )

  if (!resp.ok) {
    const text = await resp.text()
    return {
      suggestions: [],
      error: `Crust autocomplete HTTP ${resp.status}: ${text.slice(0, 300)}`,
    }
  }

  const data = await resp.json().catch(() => null)
  const suggestions: Array<{ value: string }> = Array.isArray(data?.suggestions)
    ? data.suggestions
        .filter((s: unknown): s is { value: unknown } => typeof s === 'object' && s !== null && 'value' in s)
        .filter((s: { value: unknown }) => typeof s.value === 'string' && s.value.trim().length > 0)
        .map((s: { value: string }) => ({ value: s.value }))
    : []
  return { suggestions }
}

// ─── Person search ─────────────────────────────────────────────────────────

export interface PersonSearchRequest {
  filters: CrustFilters
  limit: number                 // 1-1000, default 20
  cursor?: string
  preview?: boolean
  post_processing?: {
    exclude_profiles?: string[]
  }
  sorts?: Array<{ field: string; order: 'asc' | 'desc' }>
}

export interface PersonSearchResponse {
  profiles: unknown[]           // intentionally any — handed to existing v2 mapper
  next_cursor: string | null
  total_count: number | null
  error?: string
}

export async function fetchPersonSearch(
  apiKey: string,
  req: PersonSearchRequest,
): Promise<PersonSearchResponse> {
  const resp = await fetchWithRetry(
    `${API_BASE}/person/search`,
    {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify(req),
    },
  )

  if (!resp.ok) {
    const text = await resp.text()
    return {
      profiles: [],
      next_cursor: null,
      total_count: null,
      error: `Crust /person/search HTTP ${resp.status}: ${text.slice(0, 500)}`,
    }
  }

  const data = await resp.json().catch(() => null)
  return {
    profiles: Array.isArray(data?.profiles) ? data.profiles : [],
    next_cursor: typeof data?.next_cursor === 'string' ? data.next_cursor : null,
    total_count: typeof data?.total_count === 'number' ? data.total_count : null,
  }
}

// ─── Filter validators ─────────────────────────────────────────────────────
// Type guards for routes to confirm shape before calling the API.

export function isCrustFilterCondition(x: unknown): x is CrustFilterCondition {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return typeof o.field === 'string' && typeof o.type === 'string' && 'value' in o
}

export function isCrustFilterGroup(x: unknown): x is CrustFilterGroup {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (o.op === 'and' || o.op === 'or') && Array.isArray(o.conditions)
}

export function isCrustFilters(x: unknown): x is CrustFilters {
  return isCrustFilterCondition(x) || isCrustFilterGroup(x)
}
