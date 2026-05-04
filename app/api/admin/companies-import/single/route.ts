// app/api/admin/companies-import/single/route.ts
//
// Synchronous single-company import. Admin has already disambiguated via
// /identify; we receive the canonical crustdata_company_id and write the
// company end-to-end:
//
//   1. If the company already exists (by crustdata_company_id), return it.
//   2. Call /company/enrich with fields=[basic_info, taxonomy, headcount]
//      → comprehensive identity + signals for the tagger.
//   3. Build TaggerInput and run tagCompany() (Claude primary + dict).
//   4. INSERT into companies. crustdata_company_id UNIQUE handles concurrent
//      races via 23505 → re-fetch.
//
// Cost: 2 Crust credits (enrich). Tagger costs ~$0.005 in Anthropic spend.
//
// Returns: { company_id, created, tagger: CompositeTaggerOutput, basic_info }

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { tagCompany } from '@/lib/companies/tagger'
import type { TaggerInput } from '@/lib/companies/tagger/types'

export const runtime = 'nodejs'
export const maxDuration = 60

interface SingleImportBody {
  crustdata_company_id: number
  target_review_status?: 'vetted' | 'unreviewed'
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.CRUSTDATA_API_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!apiKey) return Response.json({ error: 'CRUSTDATA_API_KEY missing' }, { status: 500 })
  if (!supabaseUrl || !supabaseKey) return Response.json({ error: 'supabase env missing' }, { status: 500 })

  let body: SingleImportBody
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (typeof body.crustdata_company_id !== 'number') {
    return Response.json({ error: 'crustdata_company_id (number) is required' }, { status: 400 })
  }
  const targetReviewStatus = body.target_review_status === 'vetted' ? 'vetted' : 'unreviewed'

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Idempotency: skip if already imported
  const { data: existingRows } = await supabase
    .from('companies')
    .select('company_id, company_name, review_status, tagging_method, category, primary_industry, industries, domain_tags, tagging_confidence')
    .eq('crustdata_company_id', body.crustdata_company_id)
    .limit(1)
  if (existingRows && existingRows.length > 0) {
    return Response.json({
      company_id: existingRows[0].company_id,
      created: false,
      already_imported: true,
      existing: existingRows[0],
    })
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
      crustdata_company_ids: [body.crustdata_company_id],
      fields: ['basic_info', 'taxonomy', 'headcount'],
    }),
  })
  if (!enrichResp.ok) {
    const text = await enrichResp.text()
    return Response.json({ error: `Crust /company/enrich HTTP ${enrichResp.status}: ${text.slice(0, 300)}` }, { status: 502 })
  }
  const enrichJson = await enrichResp.json().catch(() => null)
  const match = Array.isArray(enrichJson) && enrichJson[0]?.matches?.[0]
  if (!match) {
    return Response.json({ error: 'Enrich returned no match for that crustdata_company_id' }, { status: 404 })
  }
  const cd = match.company_data || {}
  const bi = cd.basic_info || {}
  const tx = cd.taxonomy || {}
  const hc = cd.headcount || {}

  // Build TaggerInput
  const taggerInput: TaggerInput = {
    name: bi.name || '',
    professional_network_industry: tx.professional_network_industry || null,
    industries: Array.isArray(bi.industries) ? bi.industries : [],
    categories: Array.isArray(tx.categories) ? tx.categories : [],
    description: bi.description || null,
    year_founded: bi.year_founded || null,
    employee_count_range: bi.employee_count_range || null,
    company_type: bi.company_type || null,
  }
  if (!taggerInput.name) {
    return Response.json({ error: 'Crust enrich response missing basic_info.name' }, { status: 502 })
  }

  // Tag
  let tagger: Awaited<ReturnType<typeof tagCompany>>
  try {
    tagger = await tagCompany(taggerInput)
  } catch (err: any) {
    return Response.json({ error: `Tagger exception: ${err?.message || String(err)}` }, { status: 500 })
  }

  // Build INSERT row
  const insertRow: Record<string, any> = {
    company_name: taggerInput.name,
    crustdata_company_id: body.crustdata_company_id,
    professional_network_id: bi.professional_network_id || null,
    linkedin_url: bi.professional_network_url || null,
    website_url: bi.website || null,
    company_type: bi.company_type ? String(bi.company_type).toLowerCase().split(' ')[0] : null,
    founding_year: bi.year_founded ? parseInt(bi.year_founded, 10) || null : null,
    headcount_range: bi.employee_count_range || null,
    headcount_latest: typeof hc.total === 'number' ? hc.total : null,
    headcount_latest_at: typeof hc.total === 'number' ? new Date().toISOString() : null,
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
    review_status: targetReviewStatus,
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('companies')
    .insert(insertRow)
    .select('company_id')
    .single()

  if (insertErr) {
    // 23505 = unique violation. Race with another concurrent import; re-fetch.
    if (insertErr.code === '23505') {
      const { data: existing2 } = await supabase
        .from('companies')
        .select('company_id, review_status')
        .eq('crustdata_company_id', body.crustdata_company_id)
        .limit(1)
        .single()
      if (existing2) {
        return Response.json({
          company_id: existing2.company_id,
          created: false,
          already_imported: true,
          race_resolved: true,
        })
      }
    }
    return Response.json({ error: `Insert failed: ${insertErr.message}` }, { status: 500 })
  }

  return Response.json({
    company_id: inserted!.company_id,
    created: true,
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
    basic_info: {
      name: bi.name,
      primary_domain: bi.primary_domain,
      professional_network_url: bi.professional_network_url,
      employee_count_range: bi.employee_count_range,
      headcount_total: hc.total,
    },
  })
}
