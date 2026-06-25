// app/api/network/triage/route.ts
//
// POST { org_id, only_untriaged? } → run Claude-Haiku triage over the org's
// MAYBE pile and write llm_triage_guess / _reason / _at. Pre-sorts the review
// queue; does NOT change title_bucket (the admin's Keep/Drop is the final call).

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/network/client';
import { triageMaybeConnections } from '@/lib/network/llm-triage';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const orgId = body?.org_id;
  if (!orgId) return NextResponse.json({ error: 'org_id is required' }, { status: 400 });
  const onlyUntriaged = body?.only_untriaged !== false; // default: skip already-triaged

  const supabase = getServiceClient();
  let q = supabase
    .from('connections')
    .select('connection_id, current_title, current_company, llm_triaged_at')
    .eq('org_id', orgId)
    .eq('title_bucket', 'maybe')
    .eq('status', 'active');
  if (onlyUntriaged) q = q.is('llm_triaged_at', null);

  const { data: maybes, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!maybes || maybes.length === 0) return NextResponse.json({ triaged: 0 });

  let results;
  try {
    results = await triageMaybeConnections(
      maybes.map((m) => ({
        connection_id: (m as any).connection_id,
        title: (m as any).current_title,
        company: (m as any).current_company,
      })),
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'triage failed' }, { status: 502 });
  }

  const now = new Date().toISOString();
  for (const r of results) {
    await supabase
      .from('connections')
      .update({ llm_triage_guess: r.guess, llm_triage_reason: r.reason, llm_triaged_at: now })
      .eq('connection_id', r.connection_id);
  }

  const counts = results.reduce(
    (acc, r) => { acc[r.guess]++; return acc; },
    { probably_yes: 0, probably_no: 0, unclear: 0 } as Record<string, number>,
  );
  return NextResponse.json({ triaged: results.length, counts });
}
