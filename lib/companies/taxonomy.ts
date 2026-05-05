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

// Friendly UI labels — DB stores the snake_case enum values above; the UI
// renders these. Keep both in sync.
export const TAGGING_METHOD_LABELS: Record<TaggingMethod, string> = {
  claude: 'AI only',
  claude_dict_agree: 'AI + rules agree',
  claude_dict_disagree: 'AI + rules disagree',
  manual: 'Admin edited',
}
export function taggingMethodLabel(method: string | null | undefined): string {
  if (!method) return 'Waiting for tagger'
  if (method in TAGGING_METHOD_LABELS) return TAGGING_METHOD_LABELS[method as TaggingMethod]
  return method
}

// Round-2 decision #7: 3-state admin workflow status. Replaces
// `manual_review_status` (which had unreviewed/reviewed/locked). Migration
// maps reviewed→vetted, locked→vetted (silent, no preservation note),
// unreviewed→unreviewed.
export const REVIEW_STATUSES = ['vetted', 'unreviewed', 'excluded'] as const
export type ReviewStatus = typeof REVIEW_STATUSES[number]

// V1 priced equity rounds only (resolved issue #4). Skip-list for non-stage
// events: Grant, Secondary Market, Corporate Round, Venture Round, Post-IPO
// Equity, Debt, Convertible Note, Unknown. Public/Acquired status lives on
// `current_status`, NOT here.
export const FUNDING_STAGES = [
  'pre_seed', 'seed',
  'series_a', 'series_b', 'series_c', 'series_d', 'series_e',
  'series_f', 'series_g', 'series_h', 'series_i', 'series_j', 'series_k',
] as const
export type FundingStage = typeof FUNDING_STAGES[number]

// Display labels (snake_case storage → human-readable UI label)
export const FUNDING_STAGE_LABELS: Record<FundingStage, string> = {
  pre_seed: 'Pre-Seed',
  seed: 'Seed',
  series_a: 'Series A', series_b: 'Series B', series_c: 'Series C',
  series_d: 'Series D', series_e: 'Series E', series_f: 'Series F',
  series_g: 'Series G', series_h: 'Series H', series_i: 'Series I',
  series_j: 'Series J', series_k: 'Series K',
}

// V1 banded headcount per Crust's basic_info.employee_count_range. Used for
// time-stable filtering. Pair with `headcount_latest` (precise integer from
// enrich) for sortable display.
export const HEADCOUNT_RANGES = [
  '1-10', '11-50', '51-200', '201-500',
  '501-1000', '1001-5000', '5001-10000', '10000+',
] as const
export type HeadcountRange = typeof HEADCOUNT_RANGES[number]

// V1 starter set per resolved issue #1. Migration adds the column without a
// CHECK constraint; the final enum is added in a follow-up migration after
// Investigation 2 enumerates the full Crust value set (likely additions:
// `partnership` already observed for OpenAI; `nonprofit`, `government`,
// `educational` likely).
export const COMPANY_TYPES = ['private', 'public', 'subsidiary'] as const
export type CompanyType = typeof COMPANY_TYPES[number]
export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  private: 'Private',
  public: 'Public',
  subsidiary: 'Subsidiary',
}

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

/**
 * Compute the headcount range bucket from a precise integer total. Used to
 * derive a fresh range from Crust's `headcount.total` (which is more current
 * than Crust's banded `employee_count_range`).
 */
export function headcountRangeFromTotal(
  total: number | null | undefined,
): HeadcountRange | null {
  if (typeof total !== 'number' || !Number.isFinite(total) || total < 1) return null
  if (total <= 10) return '1-10'
  if (total <= 50) return '11-50'
  if (total <= 200) return '51-200'
  if (total <= 500) return '201-500'
  if (total <= 1000) return '501-1000'
  if (total <= 5000) return '1001-5000'
  if (total <= 10000) return '5001-10000'
  return '10000+'
}

/**
 * Normalize Crust's banded `employee_count_range` to our enum. Crust uses
 * `'10001+'` for the top bucket; ours is `'10000+'`. Same semantic, off-by-one
 * label difference — translate in code rather than churning the schema.
 * Returns null on unrecognized values (safer than letting the CHECK fail).
 */
export function normalizeCrustHeadcountRange(
  value: string | null | undefined,
): HeadcountRange | null {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed === '10001+') return '10000+'
  if ((HEADCOUNT_RANGES as readonly string[]).includes(trimmed)) {
    return trimmed as HeadcountRange
  }
  return null
}

/**
 * Map Crust's `funding.last_round_type` strings (e.g. "Series A", "Pre-Seed")
 * to our snake_case `funding_stage` enum. Returns null for non-equity round
 * types per V1 design (Grant / Convertible Note / Debt / Secondary / etc.).
 */
export function normalizeCrustFundingStage(
  value: string | null | undefined,
): FundingStage | null {
  if (!value) return null
  // Lowercase + collapse whitespace/dashes to underscores
  const candidate = value
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
  if ((FUNDING_STAGES as readonly string[]).includes(candidate)) {
    return candidate as FundingStage
  }
  return null
}

/**
 * Map Crust's `basic_info.company_type` strings to our snake_case enum. Crust
 * returns values like "Privately Held", "Public Company", "Subsidiary". Returns
 * null for types we haven't yet enumerated (Partnership, Nonprofit, Educational,
 * Government...) — those fill in once Investigation 2 hardens the enum.
 */
export function normalizeCrustCompanyType(
  value: string | null | undefined,
): CompanyType | null {
  if (!value) return null
  const lower = value.toLowerCase().trim()
  if (lower.startsWith('private')) return 'private'      // "Privately Held"
  if (lower.startsWith('public'))  return 'public'       // "Public Company"
  if (lower.startsWith('subsidiary')) return 'subsidiary'
  return null
}
