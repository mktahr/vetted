// lib/companies/taxonomy.ts
//
// V1 controlled vocabulary — the source of truth for UI dropdowns and
// tagger output validation. Must agree with the CHECK constraints in the
// (forthcoming) phase 1 schema migration. To extend: write a migration
// that updates BOTH the CHECK constraint AND this file.
//
// Locked 2026-05-01. See docs/vetted-companies-v1/01-field-inventory.md.

export const CATEGORIES = ['hardware', 'non_hardware', 'unreviewed'] as const
export type Category = typeof CATEGORIES[number]

export const HARDWARE_INDUSTRIES = [
  'Defense', 'Aerospace', 'Automotive', 'Robotics', 'Medical Devices',
  'Biotech', 'Energy', 'Energy Storage', 'Climate', 'Semiconductors',
  'Consumer Electronics', 'Industrial Manufacturing', 'Materials',
  'Maritime', 'Other Hardware',
] as const
export type HardwareIndustry = typeof HARDWARE_INDUSTRIES[number]

export const NON_HARDWARE_INDUSTRIES = [
  'SaaS', 'AI', 'FinTech', 'Investment Banking', 'Quant/Trading',
  'Blockchain & Web3', 'Consumer Tech', 'HealthTech', 'Biotech',
  'Services', 'Legal',
] as const
export type NonHardwareIndustry = typeof NON_HARDWARE_INDUSTRIES[number]

export type Industry = HardwareIndustry | NonHardwareIndustry

export const HARDWARE_DOMAIN_TAGS = [
  'Rockets', 'Satellites', 'Drones', 'eVTOL', 'Autonomous Driving',
  'Automotive Manufacturing', 'EVs', 'Nuclear',
] as const
export type HardwareDomainTag = typeof HARDWARE_DOMAIN_TAGS[number]

export const NON_HARDWARE_DOMAIN_TAGS = [
  'Consumer', 'Infrastructure', 'Mobile', 'Cybersecurity', 'DevTools',
  'B2B', 'Data', 'Payments', 'Productivity', 'HR', 'Gaming', 'Social',
  'Streaming', 'Marketplace', 'Analytics', 'Enterprise Software',
] as const
export type NonHardwareDomainTag = typeof NON_HARDWARE_DOMAIN_TAGS[number]

export type DomainTag = HardwareDomainTag | NonHardwareDomainTag

export const TAGGING_METHODS = ['crust_dictionary', 'claude_inference', 'admin_manual'] as const
export type TaggingMethod = typeof TAGGING_METHODS[number]

export function industriesFor(category: Category): readonly string[] {
  switch (category) {
    case 'hardware': return HARDWARE_INDUSTRIES
    case 'non_hardware': return NON_HARDWARE_INDUSTRIES
    case 'unreviewed': return []
  }
}

export function domainTagsFor(category: Category): readonly string[] {
  switch (category) {
    case 'hardware': return HARDWARE_DOMAIN_TAGS
    case 'non_hardware': return NON_HARDWARE_DOMAIN_TAGS
    case 'unreviewed': return []
  }
}

// Helpers for tagger validation.
export function isValidIndustry(category: Category, industry: string | null): boolean {
  if (category === 'unreviewed') return industry === null
  if (industry === null) return false
  return (industriesFor(category) as readonly string[]).includes(industry)
}

export function isValidDomainTags(category: Category, tags: readonly string[]): boolean {
  if (category === 'unreviewed') return tags.length === 0
  const valid = domainTagsFor(category) as readonly string[]
  return tags.every(t => valid.includes(t))
}
