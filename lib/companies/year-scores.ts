// lib/companies/year-scores.ts
//
// Helper: ensure a company has year_score rows for every year from
// founding_year → current_year. Used by:
//   - import / re-enrich routes (auto-fill on first capture so admin doesn't
//     have to type 5+ years by hand)
//   - "Fill missing years" button on the detail page (post-hoc fill)
//
// Loose Supabase typing because this crosses route + client boundaries.

const DEFAULT_SCORE = 3  // "solid" on the 1-5 scale; admin can adjust later

export async function ensureYearScores(
  supabase: any,
  companyId: string,
  foundingYear: number | null,
  currentYear: number,
  defaultScore: number = DEFAULT_SCORE,
): Promise<{ inserted: number; existing: number }> {
  if (!foundingYear || foundingYear < 1800 || foundingYear > currentYear) {
    return { inserted: 0, existing: 0 }
  }
  // Look up which years already have rows; don't overwrite admin work.
  const { data: existingRows } = await supabase
    .from('company_year_scores')
    .select('year')
    .eq('company_id', companyId)
  const existingYears = new Set<number>((existingRows || []).map((r: any) => r.year))

  const missing: Array<{ company_id: string; year: number; company_score: number }> = []
  for (let y = foundingYear; y <= currentYear; y++) {
    if (!existingYears.has(y)) {
      missing.push({ company_id: companyId, year: y, company_score: defaultScore })
    }
  }
  if (missing.length === 0) {
    return { inserted: 0, existing: existingYears.size }
  }
  const { error } = await supabase
    .from('company_year_scores')
    .insert(missing)
  if (error) {
    console.error('[ensureYearScores] insert failed:', error.message)
    return { inserted: 0, existing: existingYears.size }
  }
  return { inserted: missing.length, existing: existingYears.size }
}
