// lib/crust/build-filter.ts
//
// Translate the UI's UIFilterState into a Crust /person/search filter body.
// Filter docs: https://docs.crustdata.com/person-docs/search/filters
// Reference:   https://docs.crustdata.com/person-docs/search/reference
//
// Combination rules:
// - All filters AND together at the top level
// - Multi-select within one filter ORs as an `in` operator on a single field
// - Per-company scope (current / past / ever) translates to different
//   field paths and ORs them together for the same filter
// - GTE / LTE operators are =>  /  =<   (NOT >= / <=)

import {
  UIFilterState,
  CrustFilterCondition,
  CrustFilterGroup,
  CrustFilters,
} from './types'

function nz(s: string | undefined | null): string | null {
  if (s === undefined || s === null) return null
  const t = String(s).trim()
  return t.length > 0 ? t : null
}

function parseNum(s: string): number | null {
  const t = nz(s)
  if (!t) return null
  const n = parseFloat(t)
  return isFinite(n) ? n : null
}

function rangeConditions(field: string, minStr: string, maxStr: string): CrustFilterCondition[] {
  const out: CrustFilterCondition[] = []
  const min = parseNum(minStr)
  const max = parseNum(maxStr)
  if (min !== null) out.push({ field, type: '=>', value: min })
  if (max !== null) out.push({ field, type: '=<', value: max })
  return out
}

function multiSelectIn(field: string, values: string[]): CrustFilterCondition | null {
  const cleaned = values.map(v => nz(v)).filter((v): v is string => v !== null)
  if (cleaned.length === 0) return null
  if (cleaned.length === 1) return { field, type: '=', value: cleaned[0] }
  return { field, type: 'in', value: cleaned }
}

/**
 * Build the Crust filter body from UI state.
 * Returns null if no filters are set (function_category should always be required at the UI layer).
 */
export function buildCrustFilter(ui: UIFilterState): CrustFilters | null {
  const conditions: Array<CrustFilterCondition | CrustFilterGroup> = []

  // ── WHO THEY ARE ───────────────────────────────────────────────────────

  const fn = nz(ui.function_category)
  if (fn) {
    conditions.push({
      field: 'experience.employment_details.current.function_category',
      type: '=',
      value: fn,
    })
  }

  const seniority = multiSelectIn(
    'experience.employment_details.current.seniority_level',
    ui.seniority_levels,
  )
  if (seniority) conditions.push(seniority)

  conditions.push(...rangeConditions(
    'years_of_experience_raw',
    ui.years_experience_min,
    ui.years_experience_max,
  ))

  const title = nz(ui.title)
  if (title) {
    // Free-text title — comma-separated terms become a regex OR via Crust's
    // (.) operator with | separator: "embedded, firmware, RTOS"
    // → "embedded|firmware|RTOS" matches any of the three.
    // Single term passes through unchanged.
    const terms = title.split(',').map(t => t.trim()).filter(t => t.length > 0)
    const regex = terms.length > 1 ? terms.join('|') : terms[0]
    conditions.push({
      field: 'experience.employment_details.current.title',
      type: '(.)',
      value: regex,
    })
  }

  // ── WHERE THEY ARE ─────────────────────────────────────────────────────

  if (ui.geo_mode === 'country' && ui.countries.length > 0) {
    const c = multiSelectIn('basic_profile.location.country', ui.countries)
    if (c) conditions.push(c)
  } else if (ui.geo_mode === 'region' && ui.regions.length > 0) {
    const r = multiSelectIn('basic_profile.location.state', ui.regions)
    if (r) conditions.push(r)
  } else if (ui.geo_mode === 'radius') {
    const city = nz(ui.radius_city)
    if (city && ui.radius_miles > 0) {
      conditions.push({
        field: 'professional_network.location.raw',
        type: 'geo_distance',
        value: {
          location: city,
          distance: ui.radius_miles,
          unit: 'mi',
        },
      })
    }
  }

  // ── WHERE THEY WORK ────────────────────────────────────────────────────

  if (ui.companies.length > 0) {
    // Group companies by scope so each scope becomes one OR'd condition group.
    const currents = ui.companies.filter(c => c.scope === 'current').map(c => c.value)
    const pasts = ui.companies.filter(c => c.scope === 'past').map(c => c.value)
    const evers = ui.companies.filter(c => c.scope === 'ever').map(c => c.value)

    const groupConds: CrustFilterCondition[] = []
    const cur = multiSelectIn('experience.employment_details.current.name', currents)
    if (cur) groupConds.push(cur)
    const past = multiSelectIn('experience.employment_details.past.name', pasts)
    if (past) groupConds.push(past)
    if (evers.length > 0) {
      // ever = current OR past — emit two conditions and OR them
      const evCur = multiSelectIn('experience.employment_details.current.name', evers)
      const evPast = multiSelectIn('experience.employment_details.past.name', evers)
      if (evCur && evPast) {
        groupConds.push({ op: 'or', conditions: [evCur, evPast] } as CrustFilterGroup as never)
      } else if (evCur) {
        groupConds.push(evCur)
      } else if (evPast) {
        groupConds.push(evPast)
      }
    }

    if (groupConds.length === 1) {
      conditions.push(groupConds[0])
    } else if (groupConds.length > 1) {
      // Multiple scopes selected — OR them together (any scope match qualifies)
      conditions.push({ op: 'or', conditions: groupConds } as CrustFilterGroup)
    }
  }

  const industries = multiSelectIn(
    'experience.employment_details.current.company_industries',
    ui.industries,
  )
  if (industries) conditions.push(industries)

  const headcount = multiSelectIn(
    'experience.employment_details.current.company_headcount_range',
    ui.headcount_ranges,
  )
  if (headcount) conditions.push(headcount)

  conditions.push(...rangeConditions(
    'experience.employment_details.current.years_at_company_raw',
    ui.years_at_current_min,
    ui.years_at_current_max,
  ))

  // ── EDUCATION ──────────────────────────────────────────────────────────

  const school = multiSelectIn('education.schools.school', ui.schools)
  if (school) conditions.push(school)

  const degree = multiSelectIn('education.schools.degree', ui.degrees)
  if (degree) conditions.push(degree)

  const field = multiSelectIn('education.schools.field_of_study', ui.fields_of_study)
  if (field) conditions.push(field)

  // ── SKILLS ─────────────────────────────────────────────────────────────

  const skills = multiSelectIn('skills.professional_network_skills', ui.skills)
  if (skills) conditions.push(skills)

  // ── SIGNALS ────────────────────────────────────────────────────────────

  if (ui.recently_changed_jobs) {
    conditions.push({
      field: 'recently_changed_jobs',
      type: '=',
      value: true,
    })
  }

  if (conditions.length === 0) return null
  if (conditions.length === 1) return conditions[0]
  return { op: 'and', conditions }
}

/**
 * Human-readable summary of the filter state for the UI's top-of-page line.
 */
export function summarizeFilters(ui: UIFilterState): string {
  const parts: string[] = []

  if (ui.function_category) parts.push(ui.function_category)
  if (ui.seniority_levels.length > 0) parts.push(ui.seniority_levels.join(', '))

  const yMin = parseNum(ui.years_experience_min)
  const yMax = parseNum(ui.years_experience_max)
  if (yMin !== null && yMax !== null) parts.push(`${yMin}-${yMax}y exp`)
  else if (yMin !== null) parts.push(`${yMin}y+ exp`)
  else if (yMax !== null) parts.push(`<=${yMax}y exp`)

  if (ui.title) parts.push(`title "${ui.title}"`)

  if (ui.geo_mode === 'country' && ui.countries.length) parts.push(`in ${ui.countries.join(', ')}`)
  if (ui.geo_mode === 'region' && ui.regions.length) parts.push(`in ${ui.regions.join(', ')}`)
  if (ui.geo_mode === 'radius' && ui.radius_city) parts.push(`within ${ui.radius_miles}mi of ${ui.radius_city}`)

  if (ui.companies.length > 0) {
    const byScope: Record<string, string[]> = { current: [], past: [], ever: [] }
    for (const c of ui.companies) byScope[c.scope].push(c.value)
    if (byScope.current.length) parts.push(`at ${byScope.current.join('/')}`)
    if (byScope.past.length) parts.push(`prev at ${byScope.past.join('/')}`)
    if (byScope.ever.length) parts.push(`ever at ${byScope.ever.join('/')}`)
  }

  if (ui.industries.length) parts.push(ui.industries.join(', '))
  if (ui.headcount_ranges.length) parts.push(`size ${ui.headcount_ranges.join('/')}`)

  const ymin = parseNum(ui.years_at_current_min)
  const ymax = parseNum(ui.years_at_current_max)
  if (ymin !== null && ymax !== null) parts.push(`${ymin}-${ymax}y at current`)

  if (ui.schools.length) parts.push(`from ${ui.schools.join('/')}`)
  if (ui.degrees.length) parts.push(ui.degrees.join('/'))
  if (ui.fields_of_study.length) parts.push(ui.fields_of_study.join('/'))

  if (ui.skills.length) parts.push(`skills: ${ui.skills.join(', ')}`)

  if (ui.recently_changed_jobs) parts.push('recently changed jobs')

  return parts.length > 0 ? parts.join(' · ') : 'No filters set'
}
