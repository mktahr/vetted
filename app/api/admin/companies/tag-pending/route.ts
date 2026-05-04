// app/api/admin/companies/tag-pending/route.ts
//
// Vercel Cron handler — runs every 2 minutes (per /vercel.json) to drain the
// queue of companies awaiting auto-tagging.
//
// Workflow per pending company:
//   1. Call /company/identify (free) by crustdata_company_id → linkedin_url → name
//      to fetch fresh basic_info (industries[], description, year_founded, type, etc.)
//   2. Build TaggerInput from identify response
//   3. Run tagCompany() — Claude (primary) + dict (sanity check) in parallel
//   4. Write category/primary_industry/industries/domain_tags/tagging_method/etc.
//      back to the companies row
//
// Auth: Vercel auto-injects `Authorization: Bearer <CRON_SECRET>` for cron
// invocations. Manual/CLI invocation can use `x-ingest-secret` instead.
//
// REQUIRES Phase 1 schema migration (the V1 columns category, primary_industry,
// industries, domain_tags, tagging_method, tagging_confidence, tagging_notes,
// crustdata_company_id, company_type). If the migration hasn't run yet, the
// UPDATE fails and the row stays at tagging_method=NULL — picked up next cron.
//
// Rate limit budget: Crust default is 15 req/min. We process 10 companies per
// cron with a 4s gap between identify calls = ~40s identify + ~10s Claude
// (parallel-ish) = well within Vercel's serverless function limits.

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { tagCompany } from '@/lib/companies/tagger'
import type { TaggerInput } from '@/lib/companies/tagger/types'

export const maxDuration = 60  // seconds — fits within Vercel Pro 5-min cap with margin

const BATCH_SIZE = 10
const CRUST_THROTTLE_MS = 4000  // 15 req/min = 1 every 4s

// Daily Anthropic spend cap. One Haiku 4.5 tagCompany() call ≈ $0.005.
// EST_CENTS_PER_TAG=1 (round up). MAX_DAILY_ANTHROPIC_CENTS=1000 → ~$10/day cap.
// Override either via env var; values must be positive integers.
const MAX_DAILY_ANTHROPIC_CENTS = parseInt(process.env.MAX_DAILY_ANTHROPIC_CENTS || '1000', 10)
const EST_CENTS_PER_TAG = parseInt(process.env.EST_CENTS_PER_TAG || '1', 10)

interface PendingCompany {
  company_id: string
  company_name: string
  linkedin_url: string | null
  crustdata_company_id: number | null
  founding_year: number | null
  headcount_range: string | null
  company_type: string | null
}

export async function GET(req: NextRequest) { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }

async function handle(req: NextRequest): Promise<Response> {
  // Auth
  const auth = req.headers.get('authorization') || ''
  const cronSecret = process.env.CRON_SECRET
  const ingestSecret = process.env.INGEST_SECRET
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`
  const isIngest = !!ingestSecret && req.headers.get('x-ingest-secret') === ingestSecret
  if (!isCron && !isIngest) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const crustKey = process.env.CRUSTDATA_API_KEY
  if (!supabaseUrl || !supabaseKey) return Response.json({ error: 'supabase env missing' }, { status: 500 })
  if (!crustKey) return Response.json({ error: 'CRUSTDATA_API_KEY missing' }, { status: 500 })

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Daily spend cap check. Read today's spend log row first; abort if at cap.
  const today = new Date().toISOString().slice(0, 10)  // YYYY-MM-DD UTC
  const { data: spendRow } = await supabase
    .from('companies_tag_spend_log')
    .select('estimated_anthropic_cents, total_companies_tagged')
    .eq('log_date', today)
    .maybeSingle()
  const spentToday = spendRow?.estimated_anthropic_cents ?? 0
  if (spentToday >= MAX_DAILY_ANTHROPIC_CENTS) {
    return Response.json({
      ok: false,
      throttled: true,
      reason: 'daily_anthropic_cap_reached',
      cap_cents: MAX_DAILY_ANTHROPIC_CENTS,
      spent_cents: spentToday,
      tagged_today: spendRow?.total_companies_tagged ?? 0,
    }, { status: 429 })
  }
  // How many tags can still fit under the cap this run?
  const remainingBudgetCents = MAX_DAILY_ANTHROPIC_CENTS - spentToday
  const maxTagsByBudget = Math.max(1, Math.floor(remainingBudgetCents / EST_CENTS_PER_TAG))
  const effectiveBatchSize = Math.min(BATCH_SIZE, maxTagsByBudget)

  // Find companies needing tagging.
  // NOTE: tagging_method column lands in the V1 schema migration. Until then
  // this query will error and the route returns the SQL error — that's correct
  // behavior pre-migration (route is wired but not yet activated).
  const { data: pending, error: queryError } = await supabase
    .from('companies')
    .select('company_id, company_name, linkedin_url, crustdata_company_id, founding_year, headcount_range, company_type')
    .is('tagging_method', null)
    .order('created_at', { ascending: true })
    .limit(effectiveBatchSize)

  if (queryError) {
    return Response.json({ error: `query failed (V1 schema migration may not be applied): ${queryError.message}` }, { status: 500 })
  }

  const counts = { processed: 0, succeeded: 0, identify_failed: 0, tagger_failed: 0, write_failed: 0 }
  const errors: Array<{ company_id: string; reason: string }> = []

  for (const co of (pending || []) as PendingCompany[]) {
    counts.processed++
    try {
      const identifyResult = await identify(crustKey, co)
      if (!identifyResult) {
        counts.identify_failed++
        errors.push({ company_id: co.company_id, reason: 'identify returned no match' })
        await sleep(CRUST_THROTTLE_MS)
        continue
      }
      const { match, basic_info } = identifyResult

      const input: TaggerInput = {
        name: basic_info.name || co.company_name,
        professional_network_industry: null,                              // identify doesn't return this
        industries: Array.isArray(basic_info.industries) ? basic_info.industries : [],
        categories: [],                                                    // identify doesn't return categories[]
        description: basic_info.description || null,
        year_founded: basic_info.year_founded || (co.founding_year ? String(co.founding_year) : null),
        employee_count_range: basic_info.employee_count_range || co.headcount_range || null,
        company_type: basic_info.company_type || co.company_type || null,
      }

      const result = await tagCompany(input)

      const updates: Record<string, any> = {
        category: result.category,
        primary_industry: result.primary_industry,
        industries: result.industries,
        domain_tags: result.domain_tags,
        tagging_method: result.method,
        tagging_confidence: result.confidence,
        tagging_notes: JSON.stringify({
          summary: result.reasoning.slice(0, 500),
          dict_verdict: result.dict_verdict,
          claude_verdict: result.claude_verdict,
          agreement: result.agreement,
        }),
        updated_at: new Date().toISOString(),
      }
      // Backfill crustdata_company_id when we discovered it via identify
      if (!co.crustdata_company_id && match.company_data?.crustdata_company_id) {
        updates.crustdata_company_id = match.company_data.crustdata_company_id
      }

      const { error: writeError } = await supabase
        .from('companies')
        .update(updates)
        .eq('company_id', co.company_id)

      if (writeError) {
        counts.write_failed++
        errors.push({ company_id: co.company_id, reason: `write: ${writeError.message}` })
      } else {
        counts.succeeded++
        // Bump spend log. Fire-and-forget — never blocks. UPSERT pattern handles
        // the create-on-first-tag-of-day case.
        await incrementSpendLog(supabase, today, EST_CENTS_PER_TAG)
      }

      await sleep(CRUST_THROTTLE_MS)
    } catch (err: any) {
      counts.tagger_failed++
      errors.push({ company_id: co.company_id, reason: `exception: ${err?.message ?? String(err)}` })
      console.error(`[tag-pending] exception for ${co.company_id}:`, err)
    }
  }

  return Response.json({
    ok: true,
    batch_size: effectiveBatchSize,
    invoked_by: isCron ? 'cron' : 'ingest_secret',
    daily_cap_cents: MAX_DAILY_ANTHROPIC_CENTS,
    spent_before_run_cents: spentToday,
    estimated_run_cost_cents: counts.succeeded * EST_CENTS_PER_TAG,
    ...counts,
    errors: errors.slice(0, 10),
  })
}

async function incrementSpendLog(
  // Loose typing — supabase-js generic surface is brittle when it crosses
  // module boundaries; this helper just runs writes against a known table.
  supabase: any,
  today: string,
  cents: number,
): Promise<void> {
  // Upsert pattern: try update; if no row, insert. Atomic-enough for a
  // 2-min cron — race between two parallel requests is negligible.
  const { data: existing } = await supabase
    .from('companies_tag_spend_log')
    .select('estimated_anthropic_cents, total_companies_tagged')
    .eq('log_date', today)
    .maybeSingle()
  if (existing) {
    await supabase
      .from('companies_tag_spend_log')
      .update({
        estimated_anthropic_cents: (existing.estimated_anthropic_cents ?? 0) + cents,
        total_companies_tagged: (existing.total_companies_tagged ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('log_date', today)
  } else {
    await supabase
      .from('companies_tag_spend_log')
      .insert({
        log_date: today,
        estimated_anthropic_cents: cents,
        total_companies_tagged: 1,
      })
  }
}

// ---------- helpers ----------

async function identify(crustKey: string, co: PendingCompany): Promise<{
  match: any
  basic_info: any
} | null> {
  const HDR = {
    'Authorization': `Bearer ${crustKey}`,
    'Content-Type': 'application/json',
    'x-api-version': '2025-11-01',
  }

  // Priority: crustdata_company_id → linkedin_url → name
  const body: Record<string, any> = co.crustdata_company_id
    ? { crustdata_company_ids: [co.crustdata_company_id] }
    : co.linkedin_url
    ? { professional_network_profile_urls: [co.linkedin_url] }
    : { names: [co.company_name] }

  const resp = await fetch('https://api.crustdata.com/company/identify', {
    method: 'POST',
    headers: HDR,
    body: JSON.stringify(body),
  })
  if (!resp.ok) return null
  const data = await resp.json()
  const match = data?.[0]?.matches?.[0]
  if (!match) return null
  return { match, basic_info: match.company_data?.basic_info || {} }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
