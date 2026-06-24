// app/api/network/web-check/route.ts
//
// POST { connection_id } → on-demand single-person web check via Claude's web
// search tool. Explicit per-row action only (never batch). Returns a verdict +
// summary + sources; does NOT change the bucket — the admin decides.

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/network/client';
import { webCheckPerson } from '@/lib/network/web-check';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const connectionId = body?.connection_id;
  if (!connectionId) return NextResponse.json({ error: 'connection_id is required' }, { status: 400 });

  const supabase = getServiceClient();
  const { data: conn, error } = await supabase
    .from('connections')
    .select('full_name, current_company, raw_url, canonical_url')
    .eq('connection_id', connectionId)
    .single();
  if (error || !conn) return NextResponse.json({ error: 'connection not found' }, { status: 404 });

  try {
    const result = await webCheckPerson({
      name: (conn as any).full_name ?? '',
      company: (conn as any).current_company ?? null,
      linkedinUrl: (conn as any).raw_url ?? `https://${(conn as any).canonical_url}`,
    });
    return NextResponse.json({ result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'web-check failed' }, { status: 502 });
  }
}
