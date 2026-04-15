// app/api/admin/rescore-all/route.ts
//
// Batch-rescore every person in the DB using the canonical TypeScript
// scoring engine. Each person gets:
//   1. computeAndWriteDerivedFields() — refreshes career_progression,
//      highest_seniority, early_stage, hypergrowth
//   2. scoreCandidate() — produces the ScoreResult
//   3. writeBucketAssignment() — inserts a new row into
//      candidate_bucket_assignments with the full score_breakdown jsonb
//
// Run this whenever scoring rules change. It inserts a new bucket row per
// person (preserving history); the UI reads the latest row per
// (person_id, effective_at DESC).
//
// Streams NDJSON progress:
//   { type: 'start',   total }
//   { type: 'progress', current, total, name, status: 'success'|'failed',
//                       bucket?, total_score?, error? }
//   { type: 'complete', processed, success, failed, skipped, errors[] }
//
// Auth: accepts either x-ingest-secret (for CLI/curl) OR no auth if run
// from the same origin (admin-only page). For production with auth, this
// should be upgraded.

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  scoreCandidate,
  writeBucketAssignment,
  computeAndWriteDerivedFields,
} from '@/lib/scoring'

// Rescoring the full DB can exceed Vercel's default 10/60s timeout. Cap at
// 300s (Vercel Pro max). For larger datasets consider chunking.
export const maxDuration = 300

const INGEST_SECRET = process.env.INGEST_SECRET!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  // Auth — require the ingest secret when called from curl. Same-origin
  // requests from the browser omit the header (acceptable for internal
  // admin; add real auth once we have a login system).
  const secret = req.headers.get('x-ingest-secret')
  const origin = req.headers.get('origin') || ''
  const host = req.headers.get('host') || ''
  const sameOrigin = origin.includes(host)
  if (!sameOrigin && secret !== INGEST_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return Response.json({ error: 'Missing SUPABASE env vars' }, { status: 500 })
  }

  // Optional body: { person_ids?: string[] } to restrict to a subset.
  let personIds: string[] | undefined
  try {
    const body = await req.json().catch(() => ({}))
    if (Array.isArray(body?.person_ids) && body.person_ids.length > 0) {
      personIds = body.person_ids.map(String)
    }
  } catch {
    // no body is fine — score everyone
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Fetch target list
  let peopleQuery = supabase.from('people').select('person_id, full_name')
  if (personIds) peopleQuery = peopleQuery.in('person_id', personIds)
  const { data: people, error: pErr } = await peopleQuery
  if (pErr) return Response.json({ error: pErr.message }, { status: 500 })

  const total = people?.length || 0

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      }

      send({ type: 'start', total })

      let success = 0
      let failed = 0
      let skipped = 0
      const errors: Array<Record<string, unknown>> = []
      let current = 0

      try {
        for (const p of people || []) {
          current++
          try {
            // 1. Refresh derived fields (career_progression, highest_seniority, etc.)
            await computeAndWriteDerivedFields(supabase, p.person_id)

            // 2. Score
            const result = await scoreCandidate(supabase, p.person_id)

            // 3. Persist (includes score_breakdown)
            await writeBucketAssignment(supabase, result)

            success++
            send({
              type: 'progress',
              current,
              total,
              name: p.full_name,
              status: 'success',
              bucket: result.bucket,
              total_score: result.total_score,
            })
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            // "No experience" people are an expected no-op, not a failure
            if (/no experience|no (person_)?experience/i.test(msg)) {
              skipped++
              send({
                type: 'progress',
                current,
                total,
                name: p.full_name,
                status: 'skipped',
                error: msg,
              })
            } else {
              failed++
              errors.push({ name: p.full_name, person_id: p.person_id, error: msg })
              send({
                type: 'progress',
                current,
                total,
                name: p.full_name,
                status: 'failed',
                error: msg,
              })
            }
          }
        }

        send({
          type: 'complete',
          processed: current,
          success,
          failed,
          skipped,
          errors: errors.slice(0, 100),
        })
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
        send({ type: 'complete', processed: current, success, failed, skipped, errors })
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
