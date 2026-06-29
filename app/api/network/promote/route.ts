// app/api/network/promote/route.ts
//
// NETWORK CONNECTIONS PR 2 — GATED PROMOTION.
//
// POST → reconcile connections' general-pool membership. Promotion is a flag flip
// (people.record_kind network_connection -> both) on top of PR 2b projection — no
// re-pay / re-enrich / re-score.
//
// Body:
//   { org_id, mode: 'auto',  scope?: 'org'|'connections', connection_ids? }
//     Run the vetted-company auto-rule. scope='org' (default) reconciles all of the
//     org's active connections; scope='connections' reconciles exactly the given ids.
//     Honors any saved pool_override. Promotes vetted-company connections, demotes
//     ineligible/'out' ones (safely — never a native candidate).
//
//   { org_id, mode: 'set', override: 'in'|'out'|'clear', connection_ids }
//     The admin's final say: persist pool_override on the given connections, then
//     reconcile them. 'in' force-promotes, 'out' force-removes, 'clear' reverts to
//     the auto-rule.

import { NextResponse } from 'next/server';
import { getServiceClient, fetchAllServer } from '@/lib/network/client';
import { loadVettedCompanyIds, reconcileConnections, setPoolOverride } from '@/lib/network/promote';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const orgId = body?.org_id;
  const mode = body?.mode;
  if (!orgId || !['auto', 'set'].includes(mode)) {
    return NextResponse.json({ error: "org_id and a valid mode ('auto'|'set') are required" }, { status: 400 });
  }

  const supabase = getServiceClient();
  try {
    const vetted = await loadVettedCompanyIds(supabase);

    if (mode === 'set') {
      const override = body?.override;
      if (!['in', 'out', 'clear'].includes(override)) {
        return NextResponse.json({ error: "override must be 'in'|'out'|'clear' for mode=set" }, { status: 400 });
      }
      if (!Array.isArray(body?.connection_ids) || body.connection_ids.length === 0) {
        return NextResponse.json({ error: 'connection_ids[] required for mode=set' }, { status: 400 });
      }
      // Scope the ids to this org (operator-safety: never touch another org's rows).
      const { data: scoped, error: sErr } = await supabase
        .from('connections')
        .select('connection_id')
        .eq('org_id', orgId)
        .in('connection_id', body.connection_ids);
      if (sErr) return NextResponse.json({ error: sErr.message }, { status: 502 });
      const ids = (scoped ?? []).map((r) => (r as any).connection_id);
      if (ids.length === 0) return NextResponse.json({ error: 'no matching connections in this org' }, { status: 404 });

      const set = await setPoolOverride(supabase, orgId, ids, override === 'clear' ? null : override);
      if (!set.ok) return NextResponse.json({ error: set.reason }, { status: 502 });

      const summary = await reconcileConnections(supabase, ids, vetted);
      return NextResponse.json({ summary });
    }

    // mode === 'auto'
    const scope = body?.scope === 'connections' ? 'connections' : 'org';
    let ids: string[];
    if (scope === 'connections') {
      if (!Array.isArray(body?.connection_ids)) {
        return NextResponse.json({ error: 'connection_ids[] required for scope=connections' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('connections')
        .select('connection_id')
        .eq('org_id', orgId)
        .in('connection_id', body.connection_ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 502 });
      ids = (data ?? []).map((r) => (r as any).connection_id);
    } else {
      // Whole org: every active connection (reconcile is cheap + idempotent for the
      // ones that don't change). Projection inside reconcile handles enrichment gating.
      const rows = await fetchAllServer<{ connection_id: string }>(
        supabase,
        'connections',
        'connection_id',
        (q) => q.eq('org_id', orgId).eq('status', 'active'),
      );
      ids = rows.map((r) => r.connection_id);
    }

    const summary = await reconcileConnections(supabase, ids, vetted);
    return NextResponse.json({ summary });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'promotion failed' }, { status: 502 });
  }
}
