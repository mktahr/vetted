// app/api/admin/import/route.ts
//
// Streaming bulk import from Crust Data Person Search API (v2).
//
// POST body:
//   { company_name?, location?, seniority_level?, function_category?,
//     total_count?: number (from preview — used as progress denominator) }
//
// Response: newline-delimited JSON (NDJSON) events for live progress.
//
// Before starting, queries existing linkedin_urls from `people` and passes
// them to Crust via post_processing.exclude_profiles so we don't re-import
// duplicates. Paginates via next_cursor at 100 per page until exhausted.

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mapPersonSearchToCanonical } from '@/lib/ingest/mappers/crust-v2'
import {
  buildPersonSearchBody,
  fetchPersonSearchPage,
  type PersonSearchInputs,
} from '@/lib/ingest/crust-person-search'
import { postIngest } from '@/lib/ingest/crust-api'

export const maxDuration = 300

const PAGE_SIZE = 100

export async function POST(req: NextRequest) {
  const apiKey = process.env.CRUSTDATA_API_KEY
  const ingestSecret = process.env.INGEST_SECRET
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!apiKey) return Response.json({ error: 'CRUSTDATA_API_KEY not set' }, { status: 500 })
  if (!ingestSecret) return Response.json({ error: 'INGEST_SECRET not set' }, { status: 500 })
  if (!supabaseUrl || !supabaseKey) return Response.json({ error: 'Missing SUPABASE env vars' }, { status: 500 })

  let inputs: PersonSearchInputs & { total_count?: number }
  try {
    inputs = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate filters
  try {
    buildPersonSearchBody(inputs, { limit: 1 })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Bad inputs' },
      { status: 400 },
    )
  }

  const host = req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const ingestUrl = `${proto}://${host}/api/ingest`

  // Fetch existing linkedin_urls for exclude_profiles dedup
  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: existingPeople } = await supabase
    .from('people')
    .select('linkedin_url')
    .not('linkedin_url', 'is', null)
  const excludeProfiles = (existingPeople || [])
    .map(p => p.linkedin_url as string)
    .filter(Boolean)

  const estimatedTotal = inputs.total_count ?? null
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      }

      send({
        type: 'start',
        estimated_total: estimatedTotal,
        excluded_count: excludeProfiles.length,
        filters: {
          company_name: inputs.company_name || null,
          location: inputs.location || null,
          seniority_level: inputs.seniority_level || null,
          function_category: inputs.function_category || null,
        },
      })

      let processed = 0
      let success = 0
      let failed = 0
      let skipped = 0
      const errors: Array<Record<string, unknown>> = []
      let cursor: string | null = null

      try {
        // Paginate until Crust runs out of results.
        while (true) {
          const body = buildPersonSearchBody(inputs, {
            limit: PAGE_SIZE,
            cursor: cursor ?? undefined,
            excludeProfiles,
          })

          const page = await fetchPersonSearchPage(apiKey, body)
          if (page.error) {
            send({ type: 'error', message: page.error })
            errors.push({ phase: 'crust_search', error: page.error })
            break
          }
          if (page.records.length === 0) {
            send({ type: 'info', message: 'No more results from Crust' })
            break
          }

          for (const record of page.records) {
            processed++

            const payload = mapPersonSearchToCanonical(record)
            if (!payload) {
              skipped++
              const rawName = record.basic_profile?.name ?? '(unknown)'
              send({
                type: 'progress',
                current: processed,
                total: estimatedTotal,
                name: rawName,
                status: 'skipped',
                error: 'missing linkedin_url or full_name',
              })
              if (errors.length < 50) {
                errors.push({ name: rawName, reason: 'missing linkedin_url or full_name' })
              }
              continue
            }

            const result = await postIngest(ingestUrl, ingestSecret, payload)
            if (result.ok && (result.body as { success?: boolean })?.success) {
              success++
              send({
                type: 'progress',
                current: processed,
                total: estimatedTotal,
                name: payload.full_name,
                linkedin_url: payload.linkedin_url,
                status: 'success',
                person_id: (result.body as { person_id?: string }).person_id,
              })
            } else {
              failed++
              const rb = result.body as { error?: string; message?: string }
              const msg = rb?.error || rb?.message || JSON.stringify(result.body).slice(0, 300)
              if (errors.length < 50) {
                errors.push({
                  name: payload.full_name,
                  linkedin_url: payload.linkedin_url,
                  status: result.status,
                  error: msg,
                })
              }
              send({
                type: 'progress',
                current: processed,
                total: estimatedTotal,
                name: payload.full_name,
                status: 'failed',
                error: msg,
              })
            }
          }

          cursor = page.cursor
          if (!cursor) break
        }

        send({
          type: 'complete',
          processed,
          success,
          failed,
          skipped,
          errors: errors.slice(0, 50),
        })
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
        send({ type: 'complete', processed, success, failed, skipped, errors })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
