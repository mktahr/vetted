// app/api/network/project/route.ts
//
// POST → project enriched connections into `people` (record_kind='network_connection'),
// making them searchable by the existing machinery WITHOUT entering the default pool.
// Re-runnable: already-linked connections are no-ops.
//
// Body: { org_id, scope: 'org'|'employee'|'connections', employee_id?, connection_ids? }
//   - scope='org'         → all active+enriched connections in the org
//   - scope='employee'    → active+enriched connections owned (is_active) by the employee
//   - scope='connections' → exactly the given connection_ids (admin-chosen; projected
//                           even if not flagged enriched, projectConnection decides)

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/network/client';
import { projectConnections } from '@/lib/network/project-connection';

export const runtime = 'nodejs';
export const maxDuration = 300;

type Scope = 'org' | 'employee' | 'connections';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const orgId = body?.org_id;
  const scope = body?.scope as Scope;
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
    // Resolve the target connection ids.
    let ids: string[];
    if (scope === 'connections') {
      // Scope the explicit IDs to org_id — a request must not project another org's
      // connections while claiming this org (API-contract/operator-safety guard).
      const requested = body.connection_ids as string[];
      const { data, error } = await supabase
        .from('connections')
        .select('connection_id')
        .eq('org_id', orgId)
        .in('connection_id', requested);
      if (error) return NextResponse.json({ error: error.message }, { status: 502 });
      ids = (data ?? []).map((r) => (r as any).connection_id);
    } else {
      let restrictIds: string[] | null = null;
      if (scope === 'employee') {
        const { data: owners } = await supabase
          .from('connection_owners')
          .select('connection_id')
          .eq('employee_id', body.employee_id)
          .eq('is_active', true);
        restrictIds = (owners ?? []).map((o) => (o as any).connection_id);
        if (restrictIds.length === 0) {
          return NextResponse.json({ summary: { total: 0, projected: 0, merged: 0, alreadyLinked: 0, failed: 0, results: [] } });
        }
      }
      // org/employee scope: only active + enriched connections are worth projecting
      // (enriched=true covers both Crust-enriched and global-pool-reuse rows).
      let q = supabase
        .from('connections')
        .select('connection_id')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .eq('enriched', true);
      if (restrictIds) q = q.in('connection_id', restrictIds);
      const { data, error } = await q;
      if (error) return NextResponse.json({ error: error.message }, { status: 502 });
      ids = (data ?? []).map((r) => (r as any).connection_id);
    }

    const summary = await projectConnections(supabase, ids);
    return NextResponse.json({ summary });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'projection failed' }, { status: 502 });
  }
}
