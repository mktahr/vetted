// lib/companies/funding.ts
//
// Helpers for capturing Crust's `funding` block into our schema:
//   - extractFundingScalars()  → company-level totals (total_funding_usd, etc.)
//   - writeFundingRounds()     → per-round rows in company_funding_rounds
//
// Crust's funding response shape (per docs/crust/03-company-enrich.md):
//   funding: {
//     total_investment_usd, last_round_amount_usd, last_fundraise_date,
//     last_round_type,
//     investors: string[],
//     investors_detailed: [{ name, uuid, type, categories[] }],
//     milestones: [{ date, amount_usd, round, investors, lead_investors }]
//   }

interface CrustMilestone {
  date?: string | null
  funding_date?: string | null
  amount_usd?: number | null
  round?: string | null
  investors?: string[] | null
  lead_investors?: string[] | null
}

interface CrustFunding {
  total_investment_usd?: number | null
  last_round_amount_usd?: number | null
  last_fundraise_date?: string | null
  last_round_type?: string | null
  investors?: string[] | null
  milestones?: CrustMilestone[] | null
}

export interface FundingScalars {
  total_funding_usd: number | null
  last_funding_amount_usd: number | null
  last_funding_date: string | null   // YYYY-MM-DD
  last_funding_round_type: string | null
}

export function extractFundingScalars(
  fn: CrustFunding | null | undefined,
): FundingScalars {
  const f = fn || {}
  return {
    total_funding_usd:
      typeof f.total_investment_usd === 'number' ? Math.round(f.total_investment_usd) : null,
    last_funding_amount_usd:
      typeof f.last_round_amount_usd === 'number' ? Math.round(f.last_round_amount_usd) : null,
    last_funding_date: f.last_fundraise_date || null,
    last_funding_round_type: f.last_round_type || null,
  }
}

/**
 * Write all rounds for a company. Idempotent — uses an upsert on the dedupe
 * UNIQUE constraint (company_id, round_type, round_date, amount_usd). Safe to
 * call repeatedly on re-enrich.
 *
 * Loose Supabase typing — this helper crosses route boundaries and the
 * generic SupabaseClient<...> signature is brittle.
 */
export async function writeFundingRounds(
  supabase: any,
  companyId: string,
  fn: CrustFunding | null | undefined,
): Promise<{ inserted: number; updated: number }> {
  const milestones = fn?.milestones || []
  if (milestones.length === 0) return { inserted: 0, updated: 0 }

  const rows = milestones
    .map(m => ({
      company_id: companyId,
      round_type: m.round || null,
      round_date: m.date || m.funding_date || null,
      amount_usd: typeof m.amount_usd === 'number' ? Math.round(m.amount_usd) : null,
      investors: Array.isArray(m.investors) ? m.investors.filter(Boolean) : [],
      lead_investors: Array.isArray(m.lead_investors) ? m.lead_investors.filter(Boolean) : [],
      source: 'crust',
      fetched_at: new Date().toISOString(),
    }))
    // Drop completely-empty rows (no round_type AND no date AND no amount)
    .filter(r => r.round_type || r.round_date || r.amount_usd)

  if (rows.length === 0) return { inserted: 0, updated: 0 }

  const { error } = await supabase
    .from('company_funding_rounds')
    .upsert(rows, {
      onConflict: 'company_id,round_type,round_date,amount_usd',
      ignoreDuplicates: false,
    })
  if (error) {
    console.error('[writeFundingRounds] upsert failed:', error.message)
    return { inserted: 0, updated: 0 }
  }
  return { inserted: rows.length, updated: 0 }
}

/**
 * Compact display formatter for funding amounts.
 * 6_375_670_000 → "$6.4B"
 * 402_000_000   → "$402M"
 * 5_360_000     → "$5.4M"
 * 50_000        → "$50K"
 * null/0        → "—"
 */
export function formatFundingAmount(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return '—'
  if (amount >= 1_000_000_000) {
    const v = amount / 1_000_000_000
    return `$${v >= 10 ? v.toFixed(0) : v.toFixed(1)}B`
  }
  if (amount >= 1_000_000) {
    const v = amount / 1_000_000
    return `$${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(0) : v.toFixed(1)}M`
  }
  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}K`
  }
  return `$${amount}`
}
