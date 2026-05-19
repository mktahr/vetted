// app/api/admin/bucket/[person_id]/route.ts
//
// Admin bucket override. POST inserts a new candidate_bucket_assignments
// row with assigned_by='admin', which becomes the candidate's latest
// bucket (reads order by effective_at DESC, take 1).
//
// Body:
//   {
//     bucket: 'vetted' | 'needs_review' | 'flagged',
//     flagged_reasons?: string[],   // ignored when bucket='vetted' (forced to [])
//     reason?: string,              // free-text; empty allowed
//   }
//
// Behavior:
//   • bucket='vetted'           → flagged_reasons forced to []
//   • bucket='needs_review'     → flagged_reasons saved as provided (may be empty)
//   • bucket='flagged'       → flagged_reasons saved as provided (may be empty)
//   • assignment_reason         → "[admin override] {reason or empty}"
//   • assigned_by='admin'
//
// No min-length on reason — "Job hopper, hide" type text expected.
// No score_breakdown — admin overrides don't carry a system score; the
// candidate's prior system assignment row still has the original breakdown.

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const VALID_BUCKETS = new Set(['vetted', 'needs_review', 'flagged'])

export async function POST(req: NextRequest, { params }: { params: { person_id: string } }) {
  const personId = params.person_id
  if (!personId) return Response.json({ error: 'Missing person_id' }, { status: 400 })

  let body: { bucket?: string; flagged_reasons?: string[]; reason?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const bucket = body.bucket
  if (!bucket || !VALID_BUCKETS.has(bucket)) {
    return Response.json({ error: `bucket must be one of: ${Array.from(VALID_BUCKETS).join(', ')}` }, { status: 400 })
  }

  const flagged_reasons = bucket === 'vetted'
    ? []
    : Array.isArray(body.flagged_reasons)
      ? body.flagged_reasons.map(s => String(s).trim().toLowerCase()).filter(Boolean)
      : []

  const reasonText = (body.reason || '').trim()
  const assignment_reason = reasonText ? `[admin override] ${reasonText}` : '[admin override]'

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('candidate_bucket_assignments')
    .insert({
      person_id: personId,
      candidate_bucket: bucket,
      flagged_reasons,
      assigned_by: 'admin',
      assignment_reason,
    })
    .select('bucket_assignment_id, candidate_bucket, flagged_reasons, assignment_reason, effective_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true, assignment: data })
}
