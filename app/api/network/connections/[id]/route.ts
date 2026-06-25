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

// GET → full connection detail for the drawer: the connection row + its cached
// enriched profile (joined by canonical_url from the global cache) + all owning
// employees (warm paths). Read-only; no cross-org leakage (scoped to this
// connection's own org via the connection_id).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = getServiceClient();

  const { data: connection, error } = await supabase
    .from('connections')
    .select('*')
    .eq('connection_id', params.id)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 });
  }

  const [{ data: enriched }, { data: ownerRows }] = await Promise.all([
    supabase
      .from('network_enriched_profiles')
      .select('*')
      .eq('canonical_url', connection.canonical_url)
      .maybeSingle(),
    supabase
      .from('connection_owners')
      .select('employee_id, is_active, connected_on, employees ( full_name )')
      .eq('connection_id', params.id),
  ]);

  const owners = (ownerRows ?? []).map((o: any) => ({
    employee_id: o.employee_id,
    full_name: o.employees?.full_name ?? null,
    is_active: o.is_active,
    connected_on: o.connected_on,
  }));

  return NextResponse.json({ connection, enriched: enriched ?? null, owners });
}

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
