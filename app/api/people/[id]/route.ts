// app/api/people/[id]/route.ts
//
// DELETE /api/people/[id] — removes a person and all associated records.
//   All child tables use ON DELETE CASCADE so a single delete suffices.
//
// PATCH /api/people/[id] — update a person's current normalized tags:
//   current_function_normalized, current_title_normalized on people
//   specialty_normalized, seniority_normalized, function_normalized on the
//   most recent person_experiences row. Triggers a full re-score so the
//   bucket reflects the corrected tags.
//
// Auth: x-ingest-secret header (same secret as /api/ingest)

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  computeAndWriteDerivedFields,
  scoreCandidate,
  writeBucketAssignment,
} from '@/lib/scoring'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const INGEST_SECRET = process.env.INGEST_SECRET!

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const personId = ctx.params.id
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return Response.json({ error: 'Missing SUPABASE env vars' }, { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Verify the person exists
  const { data: person, error: fetchErr } = await supabase
    .from('people')
    .select('person_id, full_name')
    .eq('person_id', personId)
    .single()

  if (fetchErr || !person) {
    return Response.json({ error: 'Person not found' }, { status: 404 })
  }

  // Delete — cascades to person_experiences, person_education,
  // candidate_bucket_assignments, candidate_decision_state,
  // candidate_review_flags, and all other FK-linked rows.
  const { error: deleteErr } = await supabase
    .from('people')
    .delete()
    .eq('person_id', personId)

  if (deleteErr) {
    return Response.json({ error: deleteErr.message }, { status: 500 })
  }

  return Response.json({ success: true, deleted: person.full_name })
}

interface PatchBody {
  current_function_normalized?: string | null
  current_title_normalized?: string | null
  current_specialty_normalized?: string | null
  current_seniority_normalized?: string | null
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  // Auth — same shared secret as /api/ingest
  const secret = req.headers.get('x-ingest-secret')
  if (secret !== INGEST_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const personId = ctx.params.id
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return Response.json({ error: 'Missing SUPABASE env vars' }, { status: 500 })
  }

  let body: PatchBody
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Verify the person exists
  const { data: person, error: fetchErr } = await supabase
    .from('people')
    .select('person_id, full_name')
    .eq('person_id', personId)
    .single()
  if (fetchErr || !person) {
    return Response.json({ error: 'Person not found' }, { status: 404 })
  }

  // ── Update people row ────────────────────────────────────────────────
  const peopleUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.current_function_normalized !== undefined) {
    peopleUpdates.current_function_normalized = body.current_function_normalized
  }
  if (body.current_title_normalized !== undefined) {
    peopleUpdates.current_title_normalized = body.current_title_normalized
  }

  if (Object.keys(peopleUpdates).length > 1) {
    const { error: updateErr } = await supabase
      .from('people')
      .update(peopleUpdates)
      .eq('person_id', personId)
    if (updateErr) {
      console.error('[people PATCH] people update failed:', updateErr)
      return Response.json({ error: updateErr.message }, { status: 500 })
    }
  }

  // ── Update the most recent person_experiences row ────────────────────
  // specialty_normalized and seniority_normalized live per-experience, so we
  // update the most recent is_current row (or the latest by start_date).
  const expUpdates: Record<string, unknown> = {}
  if (body.current_function_normalized !== undefined) {
    expUpdates.function_normalized = body.current_function_normalized
  }
  if (body.current_specialty_normalized !== undefined) {
    expUpdates.specialty_normalized = body.current_specialty_normalized
  }
  if (body.current_seniority_normalized !== undefined) {
    expUpdates.seniority_normalized = body.current_seniority_normalized
    // Don't touch seniority_source — its CHECK constraint doesn't allow 'manual',
    // so we leave the original inference source. The value itself is now overridden.
  }

  if (Object.keys(expUpdates).length > 0) {
    expUpdates.updated_at = new Date().toISOString()

    // Find the current role — prefer is_current=true, else most recent by start_date
    const { data: currentRow } = await supabase
      .from('person_experiences')
      .select('person_experience_id')
      .eq('person_id', personId)
      .eq('is_current', true)
      .order('start_date', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    let targetRowId = currentRow?.person_experience_id
    if (!targetRowId) {
      const { data: latestRow } = await supabase
        .from('person_experiences')
        .select('person_experience_id')
        .eq('person_id', personId)
        .order('start_date', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
      targetRowId = latestRow?.person_experience_id
    }

    if (targetRowId) {
      const { error: expErr } = await supabase
        .from('person_experiences')
        .update(expUpdates)
        .eq('person_experience_id', targetRowId)
      if (expErr) {
        console.error('[people PATCH] experience update failed:', expErr)
        return Response.json({ error: expErr.message }, { status: 500 })
      }
    }
  }

  // ── Re-score: derived fields → score → bucket ────────────────────────
  let bucket: string | null = null
  let totalScore: number | null = null
  try {
    await computeAndWriteDerivedFields(supabase, personId)
    const scoreResult = await scoreCandidate(supabase, personId)
    await writeBucketAssignment(supabase, scoreResult)
    bucket = scoreResult.bucket
    totalScore = scoreResult.total_score
  } catch (scoreErr) {
    console.error('[people PATCH] re-score failed (non-fatal):', scoreErr)
  }

  return Response.json({
    success: true,
    person_id: personId,
    bucket,
    total_score: totalScore,
    message: 'Person updated and re-scored',
  })
}
