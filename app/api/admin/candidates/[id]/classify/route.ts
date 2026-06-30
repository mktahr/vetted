// app/api/admin/candidates/[id]/classify/route.ts
//
// On-demand five-axis classification of a single candidate ("Classify now").
// Re-queues the candidate (pending + failure_count reset) so a 'done'/exhausted
// candidate can be reclassified, then runs the lifecycle. Never disturbs an
// actively-leased in_progress candidate.
//
// Auth: same-origin (admin page) OR x-ingest-secret.

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyCandidate } from '@/lib/candidates/classifier';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ingestSecret = process.env.INGEST_SECRET;
  const secret = req.headers.get('x-ingest-secret');
  const origin = req.headers.get('origin') || '';
  const host = req.headers.get('host') || '';
  const sameOrigin = !!origin && origin.includes(host);
  if (!sameOrigin && !(ingestSecret && secret === ingestSecret)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return Response.json({ error: 'supabase env missing' }, { status: 500 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 });

  const personId = params.id;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Manual re-queue: make a done/failed candidate eligible again (clean retry).
  // Skips a candidate currently in_progress with a live lease (don't stomp).
  await supabase.from('people')
    .update({ classification_status: 'pending', classification_failure_count: 0, classification_lease_token: null, classification_lease_expires_at: null, updated_at: new Date().toISOString() })
    .eq('person_id', personId)
    .in('classification_status', ['done', 'failed']);

  try {
    const result = await classifyCandidate(supabase, personId);
    return Response.json({ result });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? 'classify failed' }, { status: 500 });
  }
}
