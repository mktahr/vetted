// lib/companies/tagger/types.ts
//
// Shared types for the dictionary + Claude tagger pipeline.
// Round-2 architecture (2026-05-02):
//   - Claude is primary; dictionary is sanity check
//   - Option B multi-industry: primary_industry + industries[]
//   - category may be NULL when classifier can't decide
//   - tagging_method enum reflects agree/disagree path

import type { CategoryOrUnclassified, Industry, DomainTag, TaggingMethod } from '../taxonomy'

/**
 * Crust signal inputs the tagger reads. Provide what's available.
 *
 * - identify-tier signals (unreviewed-tier auto-creates): name, industries,
 *   maybe description (Crust returns it null often). NO categories[] (only
 *   in enrich response).
 * - search-tier signals: name, professional_network_industry, industries,
 *   categories. No description.
 * - enrich-tier signals: all of the above plus description (the strongest
 *   disambiguator).
 *
 * The dictionary degrades gracefully on thinner inputs (returns null
 * category when signals are too weak). Claude is run on every input level
 * per round-2 decision #3 — even unreviewed-tier auto-creates.
 */
export interface TaggerInput {
  name: string
  professional_network_industry: string | null  // taxonomy.professional_network_industry (enrich/search; not in identify)
  industries: string[]                            // basic_info.industries[] (all tiers)
  categories: string[]                            // taxonomy.categories[] (enrich/search; not in identify)
  description: string | null                      // basic_info.description (enrich; sometimes in identify)
  year_founded?: string | null
  employee_count_range?: string | null
  company_type?: string | null
}

/**
 * Single-call tagger output. The orchestrator may combine outputs from
 * dictionary + Claude into a final write — see CompositeTaggerOutput below.
 */
export interface TaggerOutput {
  category: CategoryOrUnclassified
  primary_industry: Industry | null            // NULL when category is NULL
  industries: Industry[]                       // includes primary_industry; empty when category is NULL
  domain_tags: DomainTag[]                     // empty when category is NULL
  confidence: number                           // 0..1
  reasoning: string
  method: TaggingMethod | 'crust_dictionary'   // 'crust_dictionary' is internal — orchestrator translates to enum
}

/**
 * Output from the orchestrator (full pipeline: dict + Claude + agreement check).
 * This is what gets written to the companies table.
 */
export interface CompositeTaggerOutput {
  category: CategoryOrUnclassified
  primary_industry: Industry | null
  industries: Industry[]
  domain_tags: DomainTag[]
  confidence: number
  reasoning: string
  method: TaggingMethod                        // always one of the locked enum values
  // Diagnostic fields written to tagging_notes for admin review
  agreement: 'agree' | 'disagree' | 'claude_only' | 'dict_only_unused'
  dict_verdict: { category: CategoryOrUnclassified; primary_industry: Industry | null } | null
  claude_verdict: { category: CategoryOrUnclassified; primary_industry: Industry | null } | null
}
