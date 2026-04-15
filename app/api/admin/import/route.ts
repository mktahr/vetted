// app/api/admin/import/route.ts
//
// Streaming bulk import from Crust Data.
//
// POST body (all fields optional — at least one filter required):
//   { company_name?, job_title?, location?, limit? (default 25, max 500) }
//
// Response: newline-delimited JSON (NDJSON) events for live progress.
// Event shapes:
//   { type: 'start',    target, filters }
//   { type: 'progress', current, total, name, status: 'success'|'failed'|'skipped', person_id?, error? }
//   { type: 'info',     message }
//   { type: 'error',    message }
//   { type: 'complete', processed, success, failed, skipped, errors[] }
//
// Uses the same Crust API call + mapper as the old scripts/bulk-ingest.mjs —
// just moved behind an HTTP endpoint and wrapped in a stream.

import { NextRequest } from 'next/server'
import { mapCrustToCanonical } from '@/lib/ingest/mappers/crust'
import { buildFilterBody, fetchCrustPage, postIngest } from '@/lib/ingest/crust-api'

// Vercel default is 10s (Hobby) / 60s (Pro). Set max 5 min to avoid timing
// out on 500-profile imports. Local dev has no timeout.
export const maxDuration = 300

const MAX_LIMIT = 500
const DEFAULT_LIMIT = 25
const PAGE_SIZE = 100  // Crust max 1000; 100 is a safe per-call cap

export async function POST(req: NextRequest) {
  const apiKey = process.env.CRUST_DATA_API_KEY
  const ingestSecret = process.env.INGEST_SECRET
  if (!apiKey) {
    return Response.json({ error: 'CRUST_DATA_API_KEY not set' }, { status: 500 })
  }
  if (!ingestSecret) {
    return Response.json({ error: 'INGEST_SECRET not set' }, { status: 500 })
  }

  let inputs: {
    company_name?: string
    job_title?: string
    location?: string
    limit?: number
  }
  try {
    inputs = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const target = Math.min(
    MAX_LIMIT,
    Math.max(1, Math.floor(inputs.limit ?? DEFAULT_LIMIT)),
  )

  // Validate + build filter body up-front so we fail fast on bad inputs.
  let initialBody
  try {
    initialBody = buildFilterBody({
      company_name: inputs.company_name,
      job_title: inputs.job_title,
      location: inputs.location,
      pageSize: Math.min(PAGE_SIZE, target),
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Bad inputs' },
      { status: 400 },
    )
  }

  // Build an absolute URL for the ingest endpoint based on the inbound
  // request's own host. Works locally (localhost:3001) and on Vercel.
  const host = req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const ingestUrl = `${proto}://${host}/api/ingest`

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      }

      send({
        type: 'start',
        target,
        filters: {
          company_name: inputs.company_name || null,
          job_title: inputs.job_title || null,
          location: inputs.location || null,
        },
      })

      let processed = 0
      let success = 0
      let failed = 0
      let skipped = 0
      const errors: Array<Record<string, unknown>> = []
      let cursor: string | null = null

      try {
        // Paginate through Crust until we have `target` profiles or run out.
        paging: while (processed < target) {
          const body = {
            ...initialBody,
            limit: Math.min(PAGE_SIZE, target - processed),
            ...(cursor ? { cursor } : {}),
          }

          const page = await fetchCrustPage(apiKey, body)
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
            if (processed >= target) break paging

            processed++
            const payload = mapCrustToCanonical(record as Parameters<typeof mapCrustToCanonical>[0])

            if (!payload) {
              skipped++
              const rawName = (record as { basic_profile?: { name?: string } })?.basic_profile?.name ?? '(unknown)'
              send({
                type: 'progress',
                current: processed,
                total: target,
                name: rawName,
                status: 'skipped',
                error: 'missing linkedin_url or full_name',
              })
              errors.push({ name: rawName, reason: 'missing linkedin_url or full_name' })
              continue
            }

            const result = await postIngest(ingestUrl, ingestSecret, payload)
            if (result.ok && (result.body as { success?: boolean })?.success) {
              success++
              send({
                type: 'progress',
                current: processed,
                total: target,
                name: payload.full_name,
                linkedin_url: payload.linkedin_url,
                status: 'success',
                person_id: (result.body as { person_id?: string }).person_id,
              })
            } else {
              failed++
              const rb = result.body as { error?: string; message?: string }
              const msg = rb?.error || rb?.message || JSON.stringify(result.body).slice(0, 300)
              errors.push({
                name: payload.full_name,
                linkedin_url: payload.linkedin_url,
                status: result.status,
                error: msg,
              })
              send({
                type: 'progress',
                current: processed,
                total: target,
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
          errors: errors.slice(0, 50), // cap payload
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
      'X-Accel-Buffering': 'no', // hint for proxies to not buffer
    },
  })
}
