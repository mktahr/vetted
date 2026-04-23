// app/api/people/[id]/route.ts
//
// DELETE /api/people/[id] — removes a person and all associated records.
// All child tables use ON DELETE CASCADE so a single delete suffices.

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

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
