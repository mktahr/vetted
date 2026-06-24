// app/api/network/enrich/route.ts
//
// POST → enrich connections via Crust (count-first; explicit admin action).
// Body: { org_id, scope: 'org'|'employee'|'connections', employee_id?,
//         connection_ids?, force?, mode?: 'estimate'|'run' }
//
//   mode='estimate' (default) → returns the cost picture, spends NOTHING.
//   mode='run'                → reuses cache/pool for free, Crust-enriches the
//                               rest, returns counts + credits spent.

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/network/client';
import { enrichConnections, EnrichScope } from '@/lib/network/enrich';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const orgId = body?.org_id;
  const scope = body?.scope as EnrichScope;
  if (!orgId || !['org', 'employee', 'connections'].includes(scope)) {
    return NextResponse.json({ error: "org_id and a valid scope ('org'|'employee'|'connections') are required" }, { status: 400 });
  }
  if (scope === 'employee' && !body?.employee_id) {
    return NextResponse.json({ error: 'employee_id required for scope=employee' }, { status: 400 });
  }
  if (scope === 'connections' && !Array.isArray(body?.connection_ids)) {
    return NextResponse.json({ error: 'connection_ids[] required for scope=connections' }, { status: 400 });
  }

  const supabase = getServiceClient();
  try {
    const summary = await enrichConnections({
      supabase,
      orgId,
      scope,
      employeeId: body?.employee_id ?? null,
      connectionIds: body?.connection_ids ?? null,
      force: body?.force === true,
      mode: body?.mode === 'run' ? 'run' : 'estimate',
    });
    return NextResponse.json({ summary });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'enrich failed' }, { status: 502 });
  }
}
