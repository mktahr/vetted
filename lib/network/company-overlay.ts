// lib/network/company-overlay.ts
//
// FREE company-score overlay (pre-enrichment). The CSV gives only a company
// NAME string; scored companies key on id/url. So this is a best-effort NAME
// match against the existing `companies` table — looser than URL matching, will
// hit most and miss some. That is fine: it is a prioritization signal.
//
// "Present in scored companies" IS the signal — we only score companies that
// clear a high bar, so a match with a non-null company_score is meaningful and
// an absence/no-match means "not rated". There is NO separate target-company
// concept (per product decision): the score itself is the whole signal.
//
// Score shown = the LATEST-year company_year_scores.company_score (1-5).

import { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllServer } from './client';

export interface CompanyScoreHit {
  company_id: string;
  company_name: string;
  company_score: number; // latest-year, 1-5
  company_score_year: number;
}

export interface CompanyScoreResolver {
  resolve: (rawCompanyName: string | null | undefined) => CompanyScoreHit | null;
  scoredCount: number;
}

// Normalize a company name for matching: lowercase, drop punctuation and common
// corporate suffixes, collapse whitespace.
const SUFFIX_RE = /\b(inc|incorporated|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|plc|gmbh|sa|ag|holdings|group|technologies|technology|labs|inc\.)\b/g;

export function normalizeCompanyName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = raw
    .toLowerCase()
    .replace(/[.,&]/g, ' ')
    .replace(SUFFIX_RE, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return n || null;
}

/**
 * Build an in-memory resolver from the companies + company_year_scores tables.
 * Only companies that HAVE a year score are indexed (unscored = not rated =
 * no chip). Latest year's score wins.
 */
export async function buildCompanyScoreResolver(
  supabase: SupabaseClient,
): Promise<CompanyScoreResolver> {
  const [companies, yearScores] = await Promise.all([
    fetchAllServer<{ company_id: string; company_name: string }>(
      supabase,
      'companies',
      'company_id, company_name',
    ),
    fetchAllServer<{ company_id: string; year: number; company_score: number }>(
      supabase,
      'company_year_scores',
      'company_id, year, company_score',
    ),
  ]);

  // company_id → latest-year { score, year }
  const latestById = new Map<string, { score: number; year: number }>();
  for (const ys of yearScores) {
    const cur = latestById.get(ys.company_id);
    if (!cur || ys.year > cur.year) {
      latestById.set(ys.company_id, { score: ys.company_score, year: ys.year });
    }
  }

  // normalized name → CompanyScoreHit (first scored company wins on collision)
  const byName = new Map<string, CompanyScoreHit>();
  for (const c of companies) {
    const scored = latestById.get(c.company_id);
    if (!scored) continue; // only index scored companies
    const norm = normalizeCompanyName(c.company_name);
    if (!norm) continue;
    if (!byName.has(norm)) {
      byName.set(norm, {
        company_id: c.company_id,
        company_name: c.company_name,
        company_score: scored.score,
        company_score_year: scored.year,
      });
    }
  }

  return {
    scoredCount: byName.size,
    resolve(rawCompanyName) {
      const norm = normalizeCompanyName(rawCompanyName);
      if (!norm) return null;
      return byName.get(norm) ?? null;
    },
  };
}
