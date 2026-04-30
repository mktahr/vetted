// lib/education/data/incubator-patterns.ts
//
// Pure data file. No imports. No top-level constructors. No function calls.
// Schools matching these patterns are excluded from the education display
// (they belong in signals/accelerator categories instead).

export const INCUBATOR_PATTERNS: RegExp[] = [
  /singularity university/i,
  /\by\s*combinator\b|\byc\b/i,
  /\btechstars\b/i,
  /\b500\s*(startups|global)\b/i,
  /\bangelpad\b/i,
  /\bmasschallenge\b/i,
  /\bstartup chile\b/i,
]
