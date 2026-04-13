// lib/normalize/titles.ts
// Title normalization — matches raw LinkedIn titles against the title_dictionary.
//
// Strategy:
//   1. Exact match on normalized pattern (lowercase, trimmed, collapsed whitespace)
//   2. Prefix-stripped match (remove "Senior ", "Lead ", etc. prefixes and re-check)
//   3. Suffix-stripped match (remove " - Contract", " (Remote)", etc.)
//   4. Returns null fields when no match — caller decides what to do

import { SupabaseClient } from '@supabase/supabase-js';

export interface TitleMatch {
  title_normalized: string;
  function_normalized: string | null;
  specialty_normalized: string | null;
  seniority_normalized: string | null;
  employment_hint: string | null;
  confidence: number;
  match_method: 'exact' | 'prefix_strip' | 'suffix_strip';
}

// Seniority prefixes to try stripping for a secondary lookup.
// Order matters: longest/most specific first.
const SENIORITY_PREFIXES = [
  { prefix: 'staff ', seniority: 'lead' },
  { prefix: 'principal ', seniority: 'senior_ic' },
  { prefix: 'senior ', seniority: 'senior_ic' },
  { prefix: 'lead ', seniority: 'lead' },
  { prefix: 'junior ', seniority: 'individual_contributor' },
  { prefix: 'associate ', seniority: 'individual_contributor' },
];

// Suffixes to strip before re-attempting match
const NOISE_SUFFIX_PATTERNS = [
  /\s*\(.*?\)\s*$/,          // (Remote), (Contract), (Part-Time)
  /\s*-\s*(remote|contract|freelance|part[- ]time|intern|interim)$/i,
  /\s*@\s*.+$/,              // @ Company Name
  /\s*[|\/]\s*.+$/,          // | Division or / Team
  /,\s*.+$/,                 // , Something
];

/**
 * Normalize a raw string for dictionary lookup.
 * Lowercases, trims, collapses whitespace.
 */
export function normalizeForLookup(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Look up a title against the title_dictionary in Supabase.
 * Tries exact match, then prefix-stripped, then suffix-stripped.
 */
export async function normalizeTitle(
  supabase: SupabaseClient,
  rawTitle: string | null | undefined,
): Promise<TitleMatch | null> {
  if (!rawTitle) return null;

  const normalized = normalizeForLookup(rawTitle);
  if (!normalized) return null;

  // 1. Exact match
  const exact = await queryTitleDict(supabase, normalized);
  if (exact) return { ...exact, match_method: 'exact' };

  // 2. Suffix-stripped match
  let stripped = normalized;
  for (const pattern of NOISE_SUFFIX_PATTERNS) {
    stripped = stripped.replace(pattern, '').trim();
  }
  if (stripped !== normalized && stripped.length > 0) {
    const suffixMatch = await queryTitleDict(supabase, stripped);
    if (suffixMatch) return { ...suffixMatch, match_method: 'suffix_strip' };
  }

  // 3. Prefix-stripped match — try removing seniority prefix
  for (const { prefix, seniority } of SENIORITY_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      const base = normalized.slice(prefix.length);
      const prefixMatch = await queryTitleDict(supabase, base);
      if (prefixMatch) {
        return {
          ...prefixMatch,
          // Override seniority with what we stripped, since the dictionary
          // entry is for the base title (e.g. "software engineer" → IC)
          seniority_normalized: seniority,
          confidence: prefixMatch.confidence * 0.9,
          match_method: 'prefix_strip',
        };
      }
    }
  }

  return null;
}

async function queryTitleDict(
  supabase: SupabaseClient,
  pattern: string,
): Promise<Omit<TitleMatch, 'match_method'> | null> {
  const { data } = await supabase
    .from('title_dictionary')
    .select('title_normalized, function_normalized, specialty_normalized, seniority_normalized, employment_hint, confidence')
    .eq('title_pattern', pattern)
    .eq('active', true)
    .single();

  if (!data) return null;

  return {
    title_normalized: data.title_normalized,
    function_normalized: data.function_normalized,
    specialty_normalized: data.specialty_normalized,
    seniority_normalized: data.seniority_normalized,
    employment_hint: data.employment_hint,
    confidence: data.confidence ?? 1.0,
  };
}
