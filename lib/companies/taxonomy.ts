// lib/companies/taxonomy.ts
//
// V1 controlled vocabulary — the source of truth for UI dropdowns and
// tagger output validation. Must agree with the CHECK constraints in the
// (forthcoming) phase 1 schema migration. To extend: write a migration
// that updates BOTH the CHECK constraint AND this file.
//
// Locked 2026-05-01, updated 2026-05-02 with round-2 decisions:
//   - Drop 'unreviewed' from category (use NULL when tagger can't classify)
//   - Add Defense + Aerospace to NON_HARDWARE_INDUSTRIES
//   - Add AI to BOTH HARDWARE_DOMAIN_TAGS and NON_HARDWARE_DOMAIN_TAGS
//   - tagging_method enum updated for Claude-primary architecture
//   - review_status enum added (separate from category)
//
// See docs/vetted-companies-v1/01-field-inventory.md.

// Concrete category values are 'hardware' or 'non_hardware'. NULL category
// means "tagger could not confidently classify"; the row needs admin attention
// (review_status='unreviewed' covers the workflow side).
export const CATEGORIES = ['hardware', 'non_hardware'] as const
export type Category = typeof CATEGORIES[number]
export type CategoryOrUnclassified = Category | null

export const HARDWARE_INDUSTRIES = [
  'Defense', 'Aerospace', 'Automotive', 'Robotics', 'Medical Devices',
  'Biotech', 'Energy', 'Energy Storage', 'Climate', 'Semiconductors',
  'Consumer Electronics', 'Industrial Manufacturing', 'Materials',
  'Maritime', 'Other Hardware',
] as const
export type HardwareIndustry = typeof HARDWARE_INDUSTRIES[number]

// Round-2 decision #12: Defense and Aerospace cross-listed for software/services
// companies (Palantir = non_hardware/Defense, Slingshot = non_hardware/Aerospace).
export const NON_HARDWARE_INDUSTRIES = [
  'SaaS', 'AI', 'FinTech', 'Investment Banking', 'Quant/Trading',
  'Blockchain & Web3', 'Consumer Tech', 'HealthTech', 'Biotech',
  'Services', 'Legal', 'Defense', 'Aerospace',
] as const
export type NonHardwareIndustry = typeof NON_HARDWARE_INDUSTRIES[number]

export type Industry = HardwareIndustry | NonHardwareIndustry

// Round-2 decision #11: AI added to BOTH branches as a domain_tag.
// Suppression rule: when industry='AI', do NOT also add the AI domain_tag
// (industry already says it). Tag fires only when AI is core to the product
// but the primary industry is something else.
export const HARDWARE_DOMAIN_TAGS = [
  'Rockets', 'Satellites', 'Drones', 'eVTOL', 'Autonomous Driving',
  'Automotive Manufacturing', 'EVs', 'Nuclear', 'AI',
] as const
export type HardwareDomainTag = typeof HARDWARE_DOMAIN_TAGS[number]

export const NON_HARDWARE_DOMAIN_TAGS = [
  'Consumer', 'Infrastructure', 'Mobile', 'Cybersecurity', 'DevTools',
  'B2B', 'Data', 'Payments', 'Productivity', 'HR', 'Gaming', 'Social',
  'Streaming', 'Marketplace', 'Analytics', 'Enterprise Software', 'AI',
] as const
export type NonHardwareDomainTag = typeof NON_HARDWARE_DOMAIN_TAGS[number]

export type DomainTag = HardwareDomainTag | NonHardwareDomainTag

// Round-2 decision #1 + #3: tagging_method values reflect Claude-primary
// architecture. Dictionary always runs as sanity check; Claude always runs
// (even on unreviewed-tier with thinner identify-only signals).
//
//   'claude'                — Claude verdict, no dict comparison (e.g. dict
//                              returned NULL category — couldn't classify)
//   'claude_dict_agree'     — Both ran; agreed on category + primary_industry
//   'claude_dict_disagree'  — Both ran; disagreed. Claude's verdict is written;
//                              dict's verdict captured in tagging_notes for
//                              admin triage. Confidence lowered.
//   'manual'                — Admin override. Frozen — auto-tagger will not
//                              overwrite.
//
// Rows that have not yet been tagged have tagging_method=NULL.
export const TAGGING_METHODS = [
  'claude', 'claude_dict_agree', 'claude_dict_disagree', 'manual',
] as const
export type TaggingMethod = typeof TAGGING_METHODS[number]

// Round-2 decision #7: 3-state admin workflow status. Replaces
// `manual_review_status` (which had unreviewed/reviewed/locked). Migration
// maps reviewed→vetted, locked→vetted (silent, no preservation note),
// unreviewed→unreviewed.
export const REVIEW_STATUSES = ['vetted', 'unreviewed', 'excluded'] as const
export type ReviewStatus = typeof REVIEW_STATUSES[number]

// ---------- Helpers ----------

export function industriesFor(category: CategoryOrUnclassified): readonly string[] {
  switch (category) {
    case 'hardware': return HARDWARE_INDUSTRIES
    case 'non_hardware': return NON_HARDWARE_INDUSTRIES
    case null: return []
  }
}

export function domainTagsFor(category: CategoryOrUnclassified): readonly string[] {
  switch (category) {
    case 'hardware': return HARDWARE_DOMAIN_TAGS
    case 'non_hardware': return NON_HARDWARE_DOMAIN_TAGS
    case null: return []
  }
}

/**
 * Validates that an industry value is allowed for the given category.
 * NULL category requires NULL industry. Non-null category requires a value
 * in the corresponding industries set.
 */
export function isValidIndustry(category: CategoryOrUnclassified, industry: string | null): boolean {
  if (category === null) return industry === null
  if (industry === null) return false
  return (industriesFor(category) as readonly string[]).includes(industry)
}

/**
 * Validates an industries[] array (Option B). Every element must be valid
 * for the category, and primary_industry must be one of them.
 */
export function isValidIndustries(
  category: CategoryOrUnclassified,
  industries: readonly string[],
  primary_industry: string | null,
): boolean {
  if (category === null) {
    return industries.length === 0 && primary_industry === null
  }
  const allowed = industriesFor(category) as readonly string[]
  if (!industries.every(i => allowed.includes(i))) return false
  if (primary_industry === null) return industries.length === 0
  if (!industries.includes(primary_industry)) return false
  return true
}

/**
 * Validates domain_tags. NULL category → must be empty. Non-null → all tags
 * must be in the category's allowed set.
 *
 * Round-2 decision #5: when industry='AI', the AI domain_tag is suppressed
 * — the industry already says it. This validator does NOT enforce that
 * (it's a tagger output rule, not a schema constraint), but the orchestrator
 * strips AI from domain_tags when industry='AI' before write.
 */
export function isValidDomainTags(category: CategoryOrUnclassified, tags: readonly string[]): boolean {
  if (category === null) return tags.length === 0
  const valid = domainTagsFor(category) as readonly string[]
  return tags.every(t => valid.includes(t))
}

/**
 * Round-2 decision #5: strip a domain_tag if it duplicates the primary
 * industry. Currently only AI is cross-listed (industry name + domain_tag
 * name match). Generalized so future cross-listings work automatically.
 */
export function dedupeDomainTagsAgainstIndustry(
  primary_industry: string | null,
  tags: readonly string[],
): string[] {
  if (primary_industry === null) return [...tags]
  return tags.filter(t => t !== primary_industry)
}
