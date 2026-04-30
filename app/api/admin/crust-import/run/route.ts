// app/api/admin/crust-import/run/route.ts
//
// Streaming full import. NDJSON response (one event per line).
// Loops Crust /person/search → mapPersonSearchToCanonical → POST /api/ingest
// until volume target reached or no more results. Writes to crust_import_log.
//
// Request body: {
//   filters: UIFilterState,
//   volume: number,            // hard cap 5000
// }
//
// NDJSON events:
//   { type: 'start', volume, excluded_count, filter_body }
//   { type: 'progress', current, total, name?, status: 'success'|'failed'|'skipped', error? }
//   { type: 'info', message }
//   { type: 'error', message }
//   { type: 'complete', processed, success, failed, skipped, errors[] }

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchAllRows } from '@/lib/supabase'
import { fetchPersonSearch } from '@/lib/crust/api'
import { buildCrustFilter } from '@/lib/crust/build-filter'
import { writeCrustLog, estimateCredits } from '@/lib/crust/log'
import { mapPersonSearchToCanonical } from '@/lib/ingest/mappers/crust-v2'
import { postIngest } from '@/lib/ingest/crust-api'
import type { PersonSearchResult } from '@/lib/ingest/crust-person-search'
import { HARD_VOLUME_CAP, type UIFilterState } from '@/lib/crust/types'

export const maxDuration = 300

const PAGE_SIZE = 100
const EXCLUDE_PROFILES_CAP = 50000

export async function POST(req: NextRequest) {
  const apiKey = process.env.CRUSTDATA_API_KEY
  const ingestSecret = process.env.INGEST_SECRET
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!apiKey) return Response.json({ error: 'CRUSTDATA_API_KEY not set' }, { status: 500 })
  if (!ingestSecret) return Response.json({ error: 'INGEST_SECRET not set' }, { status: 500 })
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: 'Missing SUPABASE env vars' }, { status: 500 })
  }

  let body: { filters?: UIFilterState; volume?: number }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.filters) return Response.json({ error: 'filters required' }, { status: 400 })
  if (!body.filters.function_category?.trim()) {
    return Response.json({ error: 'function_category is required' }, { status: 400 })
  }

  const volume = Math.min(
    Math.max(1, Math.floor(body.volume || 100)),
    HARD_VOLUME_CAP,
  )

  const supabase = createClient(supabaseUrl, supabaseKey)
  const filterBody = buildCrustFilter(body.filters)
  if (!filterBody) {
    return Response.json({ error: 'No filters resolved from UI state' }, { status: 400 })
  }

  const host = req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const ingestUrl = `${proto}://${host}/api/ingest`

  // Fetch existing linkedin_urls for exclude_profiles dedup
  let excludeProfiles: string[] = []
  try {
    const existing = await fetchAllRows<{ linkedin_url: string | null }>(
      'people',
      'linkedin_url',
      'linkedin_url',
    )
    excludeProfiles = existing
      .map(r => r.linkedin_url)
      .filter((u): u is string => !!u && u.trim().length > 0)
      .slice(0, EXCLUDE_PROFILES_CAP)
  } catch (err) {
    console.error('[crust-import/run] exclude_profiles fetch failed:', err)
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      }

      send({
        type: 'start',
        volume,
        excluded_count: excludeProfiles.length,
        filter_body: filterBody,
      })

      let processed = 0
      let success = 0
      let failed = 0
      let skipped = 0
      let totalCount: number | null = null
      const errors: Array<Record<string, unknown>> = []
      let cursor: string | null = null

      try {
        while (processed < volume) {
          const remaining = volume - processed
          const pageLimit = Math.min(PAGE_SIZE, remaining)

          const page = await fetchPersonSearch(apiKey, {
            filters: filterBody,
            limit: pageLimit,
            cursor: cursor ?? undefined,
            post_processing: excludeProfiles.length > 0 ? { exclude_profiles: excludeProfiles } : undefined,
          })

          if (page.error) {
            send({ type: 'error', message: page.error })
            errors.push({ phase: 'crust_search', error: page.error })
            break
          }

          if (totalCount === null && page.total_count !== null) {
            totalCount = page.total_count
            send({ type: 'info', message: `Crust reports ${totalCount} total matches` })
          }

          if (page.profiles.length === 0) {
            send({ type: 'info', message: 'No more results from Crust' })
            break
          }

          for (const record of page.profiles as PersonSearchResult[]) {
            processed++

            const payload = mapPersonSearchToCanonical(record)
            if (!payload) {
              skipped++
              const rawName = record.basic_profile?.name ?? '(unknown)'
              send({
                type: 'progress',
                current: processed,
                total: volume,
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
                total: volume,
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
                total: volume,
                name: payload.full_name,
                status: 'failed',
                error: msg,
              })
            }

            if (processed >= volume) break
          }

          cursor = page.next_cursor
          if (!cursor) break
        }

        // Log the run
        await writeCrustLog(supabase, {
          request_kind: 'run',
          filter_body: filterBody as unknown,
          results_count: processed,
          credits_used: estimateCredits(processed),
          error_message: errors.length > 0 ? errors[0].error as string : null,
        })

        send({
          type: 'complete',
          processed,
          success,
          failed,
          skipped,
          total_count: totalCount,
          errors: errors.slice(0, 50),
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        send({ type: 'error', message: msg })
        await writeCrustLog(supabase, {
          request_kind: 'run',
          filter_body: filterBody as unknown,
          results_count: processed,
          credits_used: estimateCredits(processed),
          error_message: msg,
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
