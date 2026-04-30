// lib/tenure/data/oss-role-patterns.ts
//
// Pure data file. No imports. No top-level constructors. No function calls.
// Title patterns indicating an open-source contribution role rather than
// primary employment. Used to flag roles as soft-non-FT when paired with
// known OSS projects (or when company name lookup fails but title matches).

export const OSS_ROLE_PATTERNS: RegExp[] = [
  /\bcore developer\b/i,
  /\bcore contributor\b/i,
  /\bmaintainer\b/i,
  /\bcommitter\b/i,
  /\bopen[- ]?source\s+(developer|contributor|engineer)\b/i,
  /\bsteering committee\b/i,
  /\btechnical steering committee\b/i,
  /\btsc member\b/i,
  /\bproject lead\b(?!\s+at\b)/i,
]
