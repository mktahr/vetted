// lib/education/data/blocklist-patterns.ts
//
// Pure data file. No imports. No top-level constructors. No function calls.
// Education entries matching ANY of these patterns are filtered out of display.

export const SCHOOL_BLOCKLIST_PATTERNS: RegExp[] = [
  /\byoga\b|\byogi\b/i,
  /\bnols\b|national outdoor leadership/i,
  /\bwilderness\b.*\bprogram\b/i,
  /\bideo\b/i,
  /\bacumen\b/i,
]

export const DEGREE_BLOCKLIST_PATTERNS: RegExp[] = [
  /\bsummer\s+program\b/i,
  /\bbootcamp\b|\bboot\s+camp\b/i,
  /\bworkshop\b/i,
  /\bshort\s+film\b/i,
  /\boutdoor\b.*\beducation\b/i,
]
