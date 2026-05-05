// lib/companies/firmographics.ts
//
// Helpers for normalizing Crust's enrich response into our schema.
// Counterpart to lib/companies/funding.ts; same pattern.
//
// Crust shapes verified live on 2026-05-05 against Anduril Industries:
//   basic_info.description          : string|null
//   basic_info.logo_permalink       : S3 URL
//   locations                       : { headquarters: "Orange, California, United States",
//                                       all_office_addresses: [", Seattle, WA, US", ...] }
//   people.founders                 : array (often empty even for known companies)
//   headcount.growth_percent        : { mom, qoq, six_months, yoy, two_years }
//   headcount.timeseries            : [{ date: "2025-03-16", employee_count: 7237 }, ...]

interface CrustBasicInfo {
  description?: string | null
  logo_permalink?: string | null
}

interface CrustLocations {
  headquarters?: string | null
  all_office_addresses?: unknown
}

interface CrustPeople {
  founders?: unknown
}

interface CrustHeadcount {
  total?: number | null
  growth_percent?: {
    mom?: number | null
    qoq?: number | null
    six_months?: number | null
    yoy?: number | null
    two_years?: number | null
  } | null
  timeseries?: unknown
}

export interface NormalizedLocations {
  headquarters: string | null
  offices: string[]
}

/**
 * Normalize Crust's locations object. Strips the leading ", " that
 * `all_office_addresses` mysteriously gets prefixed with, dedupes against
 * headquarters, drops empties.
 */
export function extractLocations(loc: CrustLocations | null | undefined): NormalizedLocations {
  const hq = loc?.headquarters || null
  const raw = loc?.all_office_addresses
  const offices = Array.isArray(raw)
    ? (raw as unknown[])
        .filter((s): s is string => typeof s === 'string')
        .map(s => s.trim().replace(/^,\s*/, '').trim())
        .filter(Boolean)
        .filter(s => s !== hq)
    : []
  return { headquarters: hq, offices }
}

/**
 * Pluck the founders array. Returns the raw Crust shape — we store as JSONB
 * and let the UI pick out fields (name, title, professional_network_url).
 * Returns [] when Crust has no data, which is most companies.
 */
export function extractFounders(people: CrustPeople | null | undefined): unknown[] {
  const fs = people?.founders
  return Array.isArray(fs) ? (fs as unknown[]) : []
}

export interface HeadcountGrowth {
  growth_3m_pct: number | null
  growth_6m_pct: number | null
  growth_12m_pct: number | null
}

/**
 * Pluck the three growth windows we display: 3m (qoq), 6m, 12m (yoy).
 * Crust returns these as floats already as percentages (e.g. 61.15 = +61.15%).
 */
export function extractHeadcountGrowth(hc: CrustHeadcount | null | undefined): HeadcountGrowth {
  const gp = hc?.growth_percent || {}
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null
  return {
    growth_3m_pct: num((gp as any).qoq),
    growth_6m_pct: num((gp as any).six_months),
    growth_12m_pct: num((gp as any).yoy),
  }
}

export interface HeadcountPoint {
  date: string
  count: number
}

/**
 * Normalize the headcount timeseries to a compact { date, count } shape.
 * Crust returns ~169 weekly points for older companies; we store as-is for
 * the optional growth chart.
 */
export function extractHeadcountTimeseries(hc: CrustHeadcount | null | undefined): HeadcountPoint[] {
  const ts = hc?.timeseries
  if (!Array.isArray(ts)) return []
  return (ts as unknown[])
    .filter((p): p is { date: string; employee_count: number } =>
      !!p && typeof p === 'object'
      && typeof (p as any).date === 'string'
      && typeof (p as any).employee_count === 'number',
    )
    .map(p => ({ date: p.date, count: p.employee_count }))
}

/**
 * Format a growth percentage for compact display.
 * 61.15  → "+61%"
 * -3.7   → "-4%"
 * 0      → "0%"
 * null   → "—"
 *
 * Rounded to integer for the column display; detail page can show the raw value.
 */
export function formatGrowthPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = Math.round(value)
  if (rounded === 0) return '0%'
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

export function growthSign(value: number | null | undefined): 'up' | 'down' | 'flat' | null {
  if (value == null || !Number.isFinite(value)) return null
  if (value > 1) return 'up'
  if (value < -1) return 'down'
  return 'flat'
}

/**
 * Compact display form of a Crust location string. Trims to the first two
 * comma-separated segments so "Orange, California, United States" shows as
 * "Orange, California" in tight column layouts.
 */
export function compactLocation(loc: string | null | undefined): string {
  if (!loc) return ''
  const parts = loc.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length <= 2) return parts.join(', ')
  return parts.slice(0, 2).join(', ')
}

/**
 * Build a flat array of all locations (HQ + offices) for popover display
 * and search-filter matching. HQ is always first.
 */
export function allLocations(
  locations: { headquarters: string | null; offices: string[] } | null | undefined,
): string[] {
  if (!locations) return []
  const out: string[] = []
  if (locations.headquarters) out.push(locations.headquarters)
  for (const o of locations.offices || []) {
    if (o && o !== locations.headquarters) out.push(o)
  }
  return out
}

/**
 * Case-insensitive substring match — used by the location search filter to
 * check if any of a company's locations contains the user's query.
 */
export function matchesLocation(
  locations: { headquarters: string | null; offices: string[] } | null | undefined,
  query: string,
  scope: 'hq' | 'any',
): boolean {
  if (!locations) return false
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (scope === 'hq') {
    return !!locations.headquarters && locations.headquarters.toLowerCase().includes(q)
  }
  // any
  if (locations.headquarters && locations.headquarters.toLowerCase().includes(q)) return true
  for (const o of locations.offices || []) {
    if (o && o.toLowerCase().includes(q)) return true
  }
  return false
}
