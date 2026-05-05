// app/api/admin/companies/[id]/re-enrich/route.ts
//
// Refresh a company from Crust enrich. Pulls basic_info + taxonomy +
// headcount, re-runs the tagger, updates the row.
//
// Cost: 2 Crust credits + ~$0.005 Anthropic. Confirm dialog on the UI side
// before firing.
//
// Restricted to companies with a known crustdata_company_id (the only safe
// way to identify the canonical entity for enrich without a fresh
// disambiguation step).

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { tagCompany } from '@/lib/companies/tagger'
import type { TaggerInput } from '@/lib/companies/tagger/types'
import {
  headcountRangeFromTotal,
  normalizeCrustHeadcountRange,
  normalizeCrustFundingStage,
  normalizeCrustCompanyType,
} from '@/lib/companies/taxonomy'
import { extractFundingScalars, writeFundingRounds } from '@/lib/companies/funding'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_DAILY_ANTHROPIC_CENTS = parseInt(process.env.MAX_DAILY_ANTHROPIC_CENTS || '1000', 10)
const EST_CENTS_PER_TAG = parseInt(process.env.EST_CENTS_PER_TAG || '1', 10)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const apiKey = process.env.CRUSTDATA_API_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!apiKey) return Response.json({ error: 'CRUSTDATA_API_KEY missing' }, { status: 500 })
  if (!supabaseUrl || !supabaseKey) return Response.json({ error: 'supabase env missing' }, { status: 500 })

  const supabase = createClient(supabaseUrl, supabaseKey)
  const today = new Date().toISOString().slice(0, 10)

  const { data: spendRow } = await supabase
    .from('companies_tag_spend_log')
    .select('estimated_anthropic_cents, total_companies_tagged')
    .eq('log_date', today)
    .maybeSingle()
  const spentToday = spendRow?.estimated_anthropic_cents ?? 0
  if (spentToday >= MAX_DAILY_ANTHROPIC_CENTS) {
    return Response.json({
      error: 'daily_anthropic_cap_reached',
      cap_cents: MAX_DAILY_ANTHROPIC_CENTS,
      spent_cents: spentToday,
    }, { status: 429 })
  }

  const { data: co, error: coErr } = await supabase
    .from('companies')
    .select('company_id, crustdata_company_id, tagging_method')
    .eq('company_id', params.id)
    .single()
  if (coErr || !co) return Response.json({ error: 'company not found' }, { status: 404 })
  if (!co.crustdata_company_id) {
    return Response.json({ error: 'crustdata_company_id required for re-enrich (run "Tag now" first to discover it)' }, { status: 400 })
  }
  // Don't overwrite manual rows.
  if (co.tagging_method === 'manual') {
    return Response.json({ error: 'row was manually edited; re-enrich would overwrite (delete tagging_method=manual first to allow)' }, { status: 409 })
  }

  // Enrich
  const enrichResp = await fetch('https://api.crustdata.com/company/enrich', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'x-api-version': '2025-11-01',
    },
    body: JSON.stringify({
      crustdata_company_ids: [co.crustdata_company_id],
      fields: ['basic_info', 'taxonomy', 'headcount', 'funding'],
    }),
  })
  if (!enrichResp.ok) {
    const text = await enrichResp.text()
    return Response.json({ error: `Crust /company/enrich HTTP ${enrichResp.status}: ${text.slice(0, 300)}` }, { status: 502 })
  }
  const enrichJson = await enrichResp.json().catch(() => null)
  const match = Array.isArray(enrichJson) && enrichJson[0]?.matches?.[0]
  if (!match) return Response.json({ error: 'enrich returned no match' }, { status: 404 })

  const cd = match.company_data || {}
  const bi = cd.basic_info || {}
  const tx = cd.taxonomy || {}
  const hc = cd.headcount || {}
  const fn = cd.funding || {}

  const input: TaggerInput = {
    name: bi.name || '',
    professional_network_industry: tx.professional_network_industry || null,
    industries: Array.isArray(bi.industries) ? bi.industries : [],
    categories: Array.isArray(tx.categories) ? tx.categories : [],
    description: bi.description || null,
    year_founded: bi.year_founded || null,
    employee_count_range: bi.employee_count_range || null,
    company_type: bi.company_type || null,
  }

  let tagger: Awaited<ReturnType<typeof tagCompany>>
  try {
    tagger = await tagCompany(input)
  } catch (err: any) {
    return Response.json({ error: `Tagger exception: ${err?.message || String(err)}` }, { status: 500 })
  }

  const headcountTotal = typeof hc.total === 'number' ? hc.total : null
  const headcountRange =
    headcountRangeFromTotal(headcountTotal) ??
    normalizeCrustHeadcountRange(bi.employee_count_range)
  const fundingScalars = extractFundingScalars(fn)

  const updates: Record<string, any> = {
    company_name: bi.name || undefined,
    professional_network_id: bi.professional_network_id || null,
    linkedin_url: bi.professional_network_url || null,
    website_url: bi.website || null,
    company_type: normalizeCrustCompanyType(bi.company_type),
    founding_year: bi.year_founded ? parseInt(bi.year_founded, 10) || null : null,
    headcount_range: headcountRange,
    headcount_latest: headcountTotal,
    headcount_latest_at: headcountTotal != null ? new Date().toISOString() : null,
    funding_stage: normalizeCrustFundingStage(fn.last_round_type),
    ...fundingScalars,
    category: tagger.category,
    primary_industry: tagger.primary_industry,
    industries: tagger.industries,
    domain_tags: tagger.domain_tags,
    tagging_method: tagger.method,
    tagging_confidence: tagger.confidence,
    tagging_notes: JSON.stringify({
      summary: tagger.reasoning.slice(0, 500),
      dict_verdict: tagger.dict_verdict,
      claude_verdict: tagger.claude_verdict,
      agreement: tagger.agreement,
    }),
    updated_at: new Date().toISOString(),
  }
  // Drop undefined company_name (don't blank it on missing enrich data)
  if (updates.company_name === undefined) delete updates.company_name

  const { error: writeErr } = await supabase
    .from('companies')
    .update(updates)
    .eq('company_id', params.id)
  if (writeErr) return Response.json({ error: `Write failed: ${writeErr.message}` }, { status: 500 })

  // Refresh funding rounds from the latest enrich data
  await writeFundingRounds(supabase, params.id, fn)

  if (spendRow) {
    await supabase
      .from('companies_tag_spend_log')
      .update({
        estimated_anthropic_cents: (spendRow.estimated_anthropic_cents ?? 0) + EST_CENTS_PER_TAG,
        total_companies_tagged: (spendRow.total_companies_tagged ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('log_date', today)
  } else {
    await supabase
      .from('companies_tag_spend_log')
      .insert({
        log_date: today,
        estimated_anthropic_cents: EST_CENTS_PER_TAG,
        total_companies_tagged: 1,
      })
  }

  return Response.json({
    ok: true,
    tagger: {
      category: tagger.category,
      primary_industry: tagger.primary_industry,
      industries: tagger.industries,
      domain_tags: tagger.domain_tags,
      confidence: tagger.confidence,
      method: tagger.method,
      agreement: tagger.agreement,
    },
    headcount_latest: typeof hc.total === 'number' ? hc.total : null,
  })
}
