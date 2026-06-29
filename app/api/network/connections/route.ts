// app/api/network/connections/route.ts
//
// GET ?org_id=…&bucket=…&employee_id=…&enriched=…&scored=…
// Lists an org's connections with their connecting employee(s) ("via Sarah,
// Mike"), applying admin-table filters. Connections with NO active owner
// (fully soft-disconnected) are dropped from view.

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/network/client';
import { loadVettedCompanyIds } from '@/lib/network/promote';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const orgId = sp.get('org_id');
  if (!orgId) return NextResponse.json({ error: 'org_id is required' }, { status: 400 });

  const bucket = sp.get('bucket');          // yes | maybe | no | all
  const employeeId = sp.get('employee_id'); // restrict to this employee's connections
  const enriched = sp.get('enriched');      // true | false | all
  const scored = sp.get('scored');          // true → has company_score

  const supabase = getServiceClient();

  let q = supabase
    .from('connections')
    .select('connection_id, full_name, current_company, current_title, title_bucket, title_bucket_source, status, specialty_normalized, company_id, company_score, company_score_year, enriched, last_enriched_at, llm_triage_guess, llm_triage_reason, connected_on, canonical_url, raw_url, person_id, pool_override')
    .eq('org_id', orgId)
    .order('company_score', { ascending: false, nullsFirst: false })
    .order('full_name', { ascending: true });

  if (bucket && bucket !== 'all') q = q.eq('title_bucket', bucket);
  if (enriched === 'true') q = q.eq('enriched', true);
  if (enriched === 'false') q = q.eq('enriched', false);
  if (scored === 'true') q = q.not('company_score', 'is', null);

  const { data: conns, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Active owners → employee names per connection.
  const { data: owners, error: oErr } = await supabase
    .from('connection_owners')
    .select('connection_id, employee_id, is_active, employees(full_name)')
    .eq('org_id', orgId)
    .eq('is_active', true);
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

  const ownersByConn = new Map<string, Array<{ employee_id: string; full_name: string }>>();
  for (const o of owners ?? []) {
    const oo = o as any;
    const arr = ownersByConn.get(oo.connection_id) ?? [];
    arr.push({ employee_id: oo.employee_id, full_name: oo.employees?.full_name ?? '(unknown)' });
    ownersByConn.set(oo.connection_id, arr);
  }

  // Pool state per connection (gated promotion): eligible = at a vetted company;
  // in_pool = linked person is record_kind='both'. Two small batch lookups.
  const vetted = await loadVettedCompanyIds(supabase);
  const personIds = Array.from(new Set((conns ?? []).map((c) => (c as any).person_id).filter(Boolean)));
  const kindByPerson = new Map<string, string>();
  if (personIds.length > 0) {
    const { data: people } = await supabase
      .from('people')
      .select('person_id, record_kind')
      .in('person_id', personIds);
    for (const p of people ?? []) kindByPerson.set((p as any).person_id, (p as any).record_kind);
  }

  const rows = (conns ?? [])
    .map((c) => {
      const cc = c as any;
      const owners = ownersByConn.get(cc.connection_id) ?? [];
      const eligible = !!cc.company_id && vetted.has(cc.company_id);
      const in_pool = !!cc.person_id && kindByPerson.get(cc.person_id) === 'both';
      const { person_id, pool_override, ...rest } = cc;
      return { ...rest, owners, pool: { override: pool_override ?? null, eligible, in_pool } };
    })
    // Drop fully soft-disconnected (no active owner).
    .filter((c) => c.owners.length > 0)
    // Employee filter: only connections this employee actively owns.
    .filter((c) => !employeeId || c.owners.some((o: { employee_id: string; full_name: string }) => o.employee_id === employeeId));

  return NextResponse.json({ connections: rows, total: rows.length });
}
