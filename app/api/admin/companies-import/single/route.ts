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
import {
  headcountRangeFromTotal,
  normalizeCrustHeadcountRange,
  normalizeCrustFundingStage,
  normalizeCrustCompanyType,
} from '@/lib/companies/taxonomy'
import { extractFundingScalars, writeFundingRounds } from '@/lib/companies/funding'
import {
  extractLocations,
  extractFounders,
  extractHeadcountGrowth,
  extractHeadcountTimeseries,
} from '@/lib/companies/firmographics'
import { ensureYearScores } from '@/lib/companies/year-scores'

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
      fields: ['basic_info', 'taxonomy', 'headcount', 'funding', 'locations', 'people'],
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
  const fn = cd.funding || {}
  const loc = cd.locations || {}
  const pp = cd.people || {}

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

  // Compute headcount_range: prefer deriving from precise total (more current
  // than Crust's banded value); fall back to normalized banded value.
  const headcountTotal = typeof hc.total === 'number' ? hc.total : null
  const headcountRange =
    headcountRangeFromTotal(headcountTotal) ??
    normalizeCrustHeadcountRange(bi.employee_count_range)
  const fundingScalars = extractFundingScalars(fn)
  const locations = extractLocations(loc)
  const founders = extractFounders(pp)
  const growth = extractHeadcountGrowth(hc)
  const timeseries = extractHeadcountTimeseries(hc)

  // Common field shape from the enrich response — used for both UPDATE-merge
  // and fresh-INSERT paths.
  const enrichFields = {
    crustdata_company_id: body.crustdata_company_id,
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
    // V2: firmographics + locations + founders + growth
    description: bi.description || null,
    logo_permalink: bi.logo_permalink || null,
    hq_location_name: locations.headquarters,
    locations,
    founders,
    headcount_growth_3m_pct: growth.growth_3m_pct,
    headcount_growth_6m_pct: growth.growth_6m_pct,
    headcount_growth_12m_pct: growth.growth_12m_pct,
    headcount_timeseries: timeseries,
  }
  const taggerFields = {
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
  }

  // BEFORE INSERT: check for an existing row matching by linkedin_url.
  // Common case: a hand-curated company predating the V1 schema, or an
  // auto-created stub from a candidate ingest. Either way we MERGE INTO that
  // row rather than failing on the linkedin_url UNIQUE constraint.
  if (enrichFields.linkedin_url) {
    const { data: byUrl } = await supabase
      .from('companies')
      .select('company_id, company_name, review_status, tagging_method, linkedin_url, crustdata_company_id')
      .eq('linkedin_url', enrichFields.linkedin_url)
      .limit(1)
      .maybeSingle()
    if (byUrl) {
      // Build update. Always backfill identity. Tagger fields preserved if manual.
      const existingIsManual = byUrl.tagging_method === 'manual'
      const update: Record<string, any> = {
        ...enrichFields,
        // Don't change the linkedin_url itself (we matched on it)
        linkedin_url: undefined,
        updated_at: new Date().toISOString(),
      }
      delete update.linkedin_url
      // Backfill company_name only if existing is missing/empty
      if (!byUrl.company_name) update.company_name = taggerInput.name
      // Tagger fields — overwrite only if existing was never manually edited
      if (!existingIsManual) Object.assign(update, taggerFields)

      const { error: updateErr } = await supabase
        .from('companies')
        .update(update)
        .eq('company_id', byUrl.company_id)
      if (updateErr) {
        return Response.json({ error: `Merge update failed: ${updateErr.message}` }, { status: 500 })
      }
      // Write/refresh funding rounds — fire-and-forget; failures don't block the response
      await writeFundingRounds(supabase, byUrl.company_id, fn)
      // Auto-fill year scores from founding_year → current_year if missing
      const fy = enrichFields.founding_year
      if (fy) {
        await ensureYearScores(supabase, byUrl.company_id, fy, new Date().getUTCFullYear())
      }
      return Response.json({
        company_id: byUrl.company_id,
        created: false,
        merged_into_existing: true,
        preserved_manual_taxonomy: existingIsManual,
        existing_name: byUrl.company_name,
        tagger: existingIsManual ? null : {
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
  }

  // No conflict — INSERT a new row.
  const insertRow: Record<string, any> = {
    company_name: taggerInput.name,
    ...enrichFields,
    ...taggerFields,
    review_status: targetReviewStatus,
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('companies')
    .insert(insertRow)
    .select('company_id')
    .single()

  if (insertErr) {
    // 23505 = unique violation. Race with a concurrent import (or existing
    // row matched a different unique key — name? — that we missed above).
    if (insertErr.code === '23505') {
      const { data: existing2 } = await supabase
        .from('companies')
        .select('company_id, review_status')
        .eq('crustdata_company_id', body.crustdata_company_id)
        .limit(1)
        .maybeSingle()
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

  // Write rounds for the freshly-inserted company
  await writeFundingRounds(supabase, inserted!.company_id, fn)
  // Auto-fill year scores from founding_year → current_year
  if (enrichFields.founding_year) {
    await ensureYearScores(supabase, inserted!.company_id, enrichFields.founding_year, new Date().getUTCFullYear())
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
