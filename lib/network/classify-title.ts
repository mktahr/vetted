// lib/network/classify-title.ts
//
// Step 1 of the tiered, cost-proportional classifier: the FREE taxonomy pass.
// Sorts a raw LinkedIn Position string into YES (engineer) / NO (clearly not) /
// MAYBE (ambiguous) for a given ClassificationScope.
//
//   YES   — matches a scope include pattern.
//   NO    — matches a scope exclude pattern (checked FIRST, overrides includes).
//   MAYBE — neither: bare "engineer"/"founder", obfuscated/cute titles,
//           blank titles. These flow to the LLM-triage pass + review queue.
//
// This is a pre-enrichment prioritization signal only. Specialty normalization
// (resolveSpecialty against the DB dictionary) happens separately in ingest —
// the dictionary is tuned for enriched data and is less accurate on terse CSV
// titles, so it is intentionally NOT the bucket gate.

import { getScope } from './scopes';

export type TitleBucket = 'yes' | 'maybe' | 'no';

export interface TitleClassification {
  bucket: TitleBucket;
  source: 'taxonomy';
  reason: string; // short, for debugging / review-queue display
}

/**
 * Classify a raw Position string within a scope. Exclusions win over includes.
 * Blank / unmatched titles return 'maybe'.
 */
export function classifyTitle(
  rawTitle: string | null | undefined,
  scopeKey: string | null | undefined = 'engineering',
): TitleClassification {
  const scope = getScope(scopeKey);
  const t = (rawTitle ?? '').toLowerCase().trim().replace(/\s+/g, ' ');

  if (!t) {
    return { bucket: 'maybe', source: 'taxonomy', reason: 'blank_title' };
  }

  // Exclusions first — "technical recruiter" → NO despite "technical".
  for (const ex of scope.excludePatterns) {
    if (ex.test(t)) {
      return { bucket: 'no', source: 'taxonomy', reason: `exclude:${ex.source}` };
    }
  }

  for (const inc of scope.includePatterns) {
    if (inc.test(t)) {
      return { bucket: 'yes', source: 'taxonomy', reason: `include:${inc.source}` };
    }
  }

  // Bare "engineer"/"engineering" with no discipline qualifier, "founder",
  // cute/obfuscated titles, and anything else unrecognized → ambiguous.
  return { bucket: 'maybe', source: 'taxonomy', reason: 'no_match' };
}
