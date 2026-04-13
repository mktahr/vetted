// lib/normalize/employment.ts
// Employment type normalization — matches raw employment type strings
// against the employment_type_dictionary.
//
// Strategy:
//   1. Exact match on normalized pattern
//   2. Contains match — check if any dictionary pattern appears in the raw string
//   3. Falls back to 'unknown'

import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeForLookup } from './titles';

export type EmploymentTypeNorm =
  | 'full_time'
  | 'contract'
  | 'part_time'
  | 'internship'
  | 'freelance'
  | 'advisory'
  | 'board'
  | 'unknown';

export interface EmploymentTypeMatch {
  employment_type_normalized: EmploymentTypeNorm;
  match_method: 'exact' | 'contains' | 'fallback';
}

/**
 * Normalize a raw employment type string.
 */
export async function normalizeEmploymentType(
  supabase: SupabaseClient,
  rawType: string | null | undefined,
): Promise<EmploymentTypeMatch> {
  if (!rawType) return { employment_type_normalized: 'unknown', match_method: 'fallback' };

  const normalized = normalizeForLookup(rawType);
  if (!normalized) return { employment_type_normalized: 'unknown', match_method: 'fallback' };

  // 1. Exact match
  const { data: exact } = await supabase
    .from('employment_type_dictionary')
    .select('employment_type_normalized')
    .eq('employment_type_pattern', normalized)
    .single();

  if (exact) {
    return {
      employment_type_normalized: exact.employment_type_normalized as EmploymentTypeNorm,
      match_method: 'exact',
    };
  }

  // 2. Contains match
  const { data: patterns } = await supabase
    .from('employment_type_dictionary')
    .select('employment_type_pattern, employment_type_normalized');

  if (patterns) {
    const sorted = patterns.sort((a, b) => b.employment_type_pattern.length - a.employment_type_pattern.length);
    for (const row of sorted) {
      if (normalized.includes(row.employment_type_pattern)) {
        return {
          employment_type_normalized: row.employment_type_normalized as EmploymentTypeNorm,
          match_method: 'contains',
        };
      }
    }
  }

  return { employment_type_normalized: 'unknown', match_method: 'fallback' };
}
