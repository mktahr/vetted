// app/api/admin/companies/[id]/tag/route.ts
//
// On-demand tagger for a single company. Mirrors one iteration of the
// /tag-pending cron loop:
//   1. Identify by crustdata_company_id || linkedin_url || name
//   2. Build TaggerInput from basic_info
//   3. Run tagCompany()
//   4. Write category/primary_industry/industries/domain_tags/method/etc.
//
// Used by the "Tag now" button on /admin/companies/[id] when the row is
// awaiting auto-tagging (tagging_method=NULL).
//
// Increments the daily companies_tag_spend_log row. Returns 429 if the
// daily Anthropic cap is hit.

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { tagCompany } from '@/lib/companies/tagger'
import type { TaggerInput } from '@/lib/companies/tagger/types'

export const runtime = 'nodejs'
export const maxDuration = 30

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

  // Daily cap gate
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

  // Fetch the company
  const { data: co, error: coErr } = await supabase
    .from('companies')
    .select('company_id, company_name, linkedin_url, crustdata_company_id, founding_year, headcount_range, company_type')
    .eq('company_id', params.id)
    .single()
  if (coErr || !co) {
    return Response.json({ error: 'company not found' }, { status: 404 })
  }

  // Identify on Crust
  const idBody: Record<string, any> = co.crustdata_company_id
    ? { crustdata_company_ids: [co.crustdata_company_id] }
    : co.linkedin_url
    ? { professional_network_profile_urls: [co.linkedin_url] }
    : { names: [co.company_name] }

  const idResp = await fetch('https://api.crustdata.com/company/identify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'x-api-version': '2025-11-01',
    },
    body: JSON.stringify(idBody),
  })
  if (!idResp.ok) {
    const text = await idResp.text()
    return Response.json({ error: `Crust /company/identify HTTP ${idResp.status}: ${text.slice(0, 300)}` }, { status: 502 })
  }
  const idJson = await idResp.json().catch(() => null)
  const match = Array.isArray(idJson) && idJson[0]?.matches?.[0]
  if (!match) {
    return Response.json({ error: 'identify returned no match' }, { status: 404 })
  }
  const bi = match.company_data?.basic_info || {}

  const input: TaggerInput = {
    name: bi.name || co.company_name,
    professional_network_industry: null,
    industries: Array.isArray(bi.industries) ? bi.industries : [],
    categories: [],
    description: bi.description || null,
    year_founded: bi.year_founded || (co.founding_year ? String(co.founding_year) : null),
    employee_count_range: bi.employee_count_range || co.headcount_range || null,
    company_type: bi.company_type || co.company_type || null,
  }

  let tagger: Awaited<ReturnType<typeof tagCompany>>
  try {
    tagger = await tagCompany(input)
  } catch (err: any) {
    return Response.json({ error: `Tagger exception: ${err?.message || String(err)}` }, { status: 500 })
  }

  const updates: Record<string, any> = {
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
  if (!co.crustdata_company_id && match.company_data?.crustdata_company_id) {
    updates.crustdata_company_id = match.company_data.crustdata_company_id
  }

  const { error: writeErr } = await supabase
    .from('companies')
    .update(updates)
    .eq('company_id', params.id)
  if (writeErr) {
    return Response.json({ error: `Write failed: ${writeErr.message}` }, { status: 500 })
  }

  // Increment daily spend log
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
      reasoning: tagger.reasoning,
    },
  })
}
