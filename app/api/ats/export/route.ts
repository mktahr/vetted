// POST /api/ats/export — "Send to ATS": serialize selected candidates to the
// canonical payload and POST them to the ATS importer.
//
// Body: { person_ids: string[], ats_job_id: string }
// Response: { sent, summary (the ATS's ImportSummary), skipped[] }
//
// The ATS dedupes by LinkedIn URL and guards UNIQUE(person, job), so
// re-sending someone is a harmless no-op (reported back as "existing").
// No sent-marker is written on the Vetted side — consciously deferred
// (vetted-ats BACKLOG.md "Vetted integration", 2026-08-01).
//
// Env: ATS_IMPORT_URL + ATS_INGEST_SECRET (server-side only).

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { postIngest } from '@/lib/ingest/crust-api'
import { buildAtsCandidates } from '@/lib/ats/canonical-from-person'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// The ATS caps candidates per request at 500; stay under it per call.
const MAX_PER_REQUEST = 500

export async function POST(req: NextRequest) {
  const base = process.env.ATS_IMPORT_URL
  const secret = process.env.ATS_INGEST_SECRET
  if (!base || !secret) {
    return Response.json(
      { error: 'ATS integration not configured (ATS_IMPORT_URL / ATS_INGEST_SECRET)' },
      { status: 500 },
    )
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return Response.json({ error: 'Missing SUPABASE env vars' }, { status: 500 })
  }

  let body: { person_ids?: unknown; ats_job_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const personIds = Array.isArray(body.person_ids)
    ? body.person_ids.filter((id): id is string => typeof id === 'string')
    : []
  const atsJobId = typeof body.ats_job_id === 'string' ? body.ats_job_id : ''
  if (personIds.length === 0) return Response.json({ error: 'person_ids is required' }, { status: 400 })
  if (!atsJobId) return Response.json({ error: 'ats_job_id is required' }, { status: 400 })
  if (personIds.length > MAX_PER_REQUEST) {
    return Response.json({ error: `Max ${MAX_PER_REQUEST} candidates per send` }, { status: 400 })
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  let built
  try {
    built = await buildAtsCandidates(db, personIds)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to serialize candidates' },
      { status: 500 },
    )
  }
  if (built.candidates.length === 0) {
    return Response.json(
      { error: 'No sendable candidates in selection', skipped: built.skipped },
      { status: 400 },
    )
  }

  const endpoint = `${base.replace(/\/+$/, '')}/api/import`
  const result = await postIngest(endpoint, secret, {
    job_id: atsJobId,
    candidates: built.candidates,
    source_kind: 'vetted_search',
  })
  if (!result.ok) {
    return Response.json(
      { error: `ATS import failed (${result.status}): ${result.body?.error ?? 'unknown error'}`, skipped: built.skipped },
      { status: 502 },
    )
  }

  // The ATS returns HTTP 200 with per-candidate failures in summary.errors —
  // surface that as a partial failure rather than success (codex finding).
  const atsErrors = Array.isArray(result.body?.errors) ? (result.body.errors as string[]) : []
  return Response.json({
    sent: built.candidates.length,
    partial: atsErrors.length > 0,
    summary: result.body,
    skipped: built.skipped,
  })
}
