// lib/companies/tagger/types.ts
//
// Shared types for the deterministic dictionary + Claude tier-2 tagger.

import type { Category, Industry, DomainTag, TaggingMethod } from '../taxonomy'

/**
 * Crust signal inputs the tagger reads. Either-or: provide what's available.
 *
 * - search-tier signals: name, professional_network_industry, industries, categories
 * - enrich-tier signals: same plus description (the strongest disambiguator)
 *
 * Reference-tier rows from candidate ingest only have name + linkedin_url —
 * those don't make it to the tagger; they stay at category='unreviewed'.
 */
export interface TaggerInput {
  name: string
  professional_network_industry: string | null  // taxonomy.professional_network_industry
  industries: string[]                            // basic_info.industries[]
  categories: string[]                            // taxonomy.categories[]
  description: string | null                      // basic_info.description (enrich-only)
  // Optional context — not used by deterministic dictionary, fed to Claude
  year_founded?: string | null
  employee_count_range?: string | null
  company_type?: string | null
}

export interface TaggerOutput {
  category: Category
  industry: Industry | null   // NULL only when category=unreviewed
  domain_tags: DomainTag[]    // empty array when category=unreviewed
  confidence: number          // 0..1
  reasoning: string           // human-readable why
  method: TaggingMethod       // 'crust_dictionary' | 'claude_inference'
}
