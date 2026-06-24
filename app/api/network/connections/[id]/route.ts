// app/api/network/connections/[id]/route.ts
//
// POST → manual Keep/Drop on a connection (review-queue action).
// Body: { action: 'keep' | 'drop' }
//   keep → title_bucket='yes', status='active'
//   drop → title_bucket='no',  status='excluded'  (soft-hide, recoverable)
// Both stamp title_bucket_source='manual' so re-uploads never overwrite the
// human decision.

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/network/client';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== 'keep' && action !== 'drop') {
    return NextResponse.json({ error: "action must be 'keep' or 'drop'" }, { status: 400 });
  }

  const patch =
    action === 'keep'
      ? { title_bucket: 'yes', status: 'active', title_bucket_source: 'manual', updated_at: new Date().toISOString() }
      : { title_bucket: 'no', status: 'excluded', title_bucket_source: 'manual', updated_at: new Date().toISOString() };

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('connections')
    .update(patch)
    .eq('connection_id', params.id)
    .select('connection_id, title_bucket, status')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connection: data });
}
