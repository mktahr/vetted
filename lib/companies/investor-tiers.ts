// lib/companies/investor-tiers.ts
//
// Tier lookup + helpers for the Notable Investors UI and the tier filter.
// Loaded once from the investor_tiers table on page mount.

export type InvestorTier = 1 | 2 | 3 | 4

export interface TierEntry {
  investor_name: string
  tier: InvestorTier
  kind: 'firm' | 'angel' | null
}

/**
 * Look up an investor's tier (case-sensitive exact match against Crust's
 * canonical names). Returns null when not in the curated list.
 */
export function tierFor(map: Map<string, InvestorTier>, name: string): InvestorTier | null {
  return map.get(name) ?? null
}

/**
 * Compute the highest tier any of a company's investors achieves. Used to
 * filter the companies list ("show me companies with tier-1 investors").
 *
 * @param tierMap   investor name → tier
 * @param investors flat list of all investor names across all rounds for
 *                  the company (deduped)
 * @returns 1 | 2 | 3 | 4 | null (null = no curated investors)
 */
export function highestTier(
  tierMap: Map<string, InvestorTier>,
  investors: readonly string[],
): InvestorTier | null {
  let best: InvestorTier | null = null
  for (const name of investors) {
    const t = tierMap.get(name)
    if (t == null) continue
    if (best === null || t < best) best = t
  }
  return best
}

/**
 * From a list of all investors (across rounds), return the names that are
 * in the curated tier list, sorted by tier asc then alphabetically.
 * Used for the Notable Investors callout.
 */
export function pickNotableInvestors(
  tierMap: Map<string, InvestorTier>,
  investors: readonly string[],
  options?: { maxTier?: InvestorTier },
): Array<{ name: string; tier: InvestorTier }> {
  const max = options?.maxTier ?? 2
  const seen = new Set<string>()
  const result: Array<{ name: string; tier: InvestorTier }> = []
  for (const name of investors) {
    if (seen.has(name)) continue
    seen.add(name)
    const t = tierMap.get(name)
    if (t != null && t <= max) result.push({ name, tier: t })
  }
  result.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
  return result
}

/**
 * Aggregate all investor names from a company's funding rounds into a flat,
 * deduped array. Skips empty / non-string entries defensively.
 */
export function flattenInvestors(
  rounds: Array<{ investors?: string[] | null; lead_investors?: string[] | null }>,
): string[] {
  const set = new Set<string>()
  for (const r of rounds) {
    for (const i of (r.investors || [])) if (typeof i === 'string' && i.trim()) set.add(i.trim())
    for (const i of (r.lead_investors || [])) if (typeof i === 'string' && i.trim()) set.add(i.trim())
  }
  return Array.from(set)
}
