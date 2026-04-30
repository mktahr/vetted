// lib/education/data/degree-allowlist.ts
//
// Pure data file. No imports. No top-level constructors. No function calls.
// Education entries are kept for display only if their degree_level matches
// one of these values OR their degree_raw matches one of DEGREE_ALLOWLIST_PATTERNS.

export const DEGREE_LEVEL_ALLOWLIST: string[] = [
  'bachelor',
  'master',
  'mba',
  'phd',
  'jd',
  'md',
  'associate',
  'high_school',
]

export const DEGREE_ALLOWLIST_PATTERNS: RegExp[] = [
  /\b(bachelor|b\.?s\.?|b\.?a\.?|b\.?eng|bsc|bba|bfa|ab)\b/i,
  /\b(master|m\.?s\.?|m\.?a\.?|m\.?eng|msc|mba|mfa|mpp|llm)\b/i,
  /\b(phd|ph\.?d|doctorate|dphil|scd|edd)\b/i,
  /\b(jd|md|dds|dvm|do)\b/i,
  /\b(associate)\b/i,
  /international baccalaureate|\bib\b|abitur|a-levels?/i,
]
