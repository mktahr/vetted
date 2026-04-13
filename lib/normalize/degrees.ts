// lib/normalize/degrees.ts
// Degree normalization — matches raw LinkedIn degree strings against degree_dictionary.
//
// Strategy:
//   1. Exact match on normalized pattern
//   2. Substring/contains match — check if any dictionary pattern appears in the raw string
//   3. Field of study normalization via field_of_study_dictionary

import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeForLookup } from './titles';

export interface DegreeMatch {
  degree_normalized: string;
  degree_level: string | null;
  is_real_degree: boolean;
  is_certificate: boolean;
  is_coursework: boolean;
  match_method: 'exact' | 'contains';
}

export interface FieldOfStudyMatch {
  field_of_study_normalized: string;
  domain_group: string | null;
}

/**
 * Normalize a raw degree string against the degree_dictionary.
 */
export async function normalizeDegree(
  supabase: SupabaseClient,
  rawDegree: string | null | undefined,
): Promise<DegreeMatch | null> {
  if (!rawDegree) return null;

  const normalized = normalizeForLookup(rawDegree);
  if (!normalized) return null;

  // 1. Exact match
  const exact = await queryDegreeDict(supabase, normalized);
  if (exact) return { ...exact, match_method: 'exact' };

  // 2. Contains match — fetch all patterns and check if any is a substring
  const { data: patterns } = await supabase
    .from('degree_dictionary')
    .select('degree_pattern, degree_normalized, degree_level, is_real_degree, is_certificate, is_coursework')
    .order('degree_pattern', { ascending: false }); // longer patterns first (reverse alpha approximation)

  if (patterns) {
    // Sort by pattern length descending so we match the most specific pattern
    const sorted = patterns.sort((a, b) => b.degree_pattern.length - a.degree_pattern.length);
    for (const row of sorted) {
      if (normalized.includes(row.degree_pattern)) {
        return {
          degree_normalized: row.degree_normalized,
          degree_level: row.degree_level,
          is_real_degree: row.is_real_degree,
          is_certificate: row.is_certificate,
          is_coursework: row.is_coursework,
          match_method: 'contains',
        };
      }
    }
  }

  return null;
}

/**
 * Normalize a raw field of study string against the field_of_study_dictionary.
 */
export async function normalizeFieldOfStudy(
  supabase: SupabaseClient,
  rawField: string | null | undefined,
): Promise<FieldOfStudyMatch | null> {
  if (!rawField) return null;

  const normalized = normalizeForLookup(rawField);
  if (!normalized) return null;

  // Exact match
  const { data: exact } = await supabase
    .from('field_of_study_dictionary')
    .select('field_of_study_normalized, domain_group')
    .eq('field_pattern', normalized)
    .single();

  if (exact) {
    return {
      field_of_study_normalized: exact.field_of_study_normalized,
      domain_group: exact.domain_group,
    };
  }

  // Contains match
  const { data: patterns } = await supabase
    .from('field_of_study_dictionary')
    .select('field_pattern, field_of_study_normalized, domain_group');

  if (patterns) {
    const sorted = patterns.sort((a, b) => b.field_pattern.length - a.field_pattern.length);
    for (const row of sorted) {
      if (normalized.includes(row.field_pattern)) {
        return {
          field_of_study_normalized: row.field_of_study_normalized,
          domain_group: row.domain_group,
        };
      }
    }
  }

  return null;
}

async function queryDegreeDict(
  supabase: SupabaseClient,
  pattern: string,
): Promise<Omit<DegreeMatch, 'match_method'> | null> {
  const { data } = await supabase
    .from('degree_dictionary')
    .select('degree_normalized, degree_level, is_real_degree, is_certificate, is_coursework')
    .eq('degree_pattern', pattern)
    .single();

  if (!data) return null;

  return {
    degree_normalized: data.degree_normalized,
    degree_level: data.degree_level,
    is_real_degree: data.is_real_degree,
    is_certificate: data.is_certificate,
    is_coursework: data.is_coursework,
  };
}
