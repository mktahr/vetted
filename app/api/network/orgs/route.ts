// app/api/network/orgs/route.ts
//
// GET  → list organizations (with employee + connection counts).
// POST → create an organization { name }.
//
// Network module is admin-only and single-tenant-admin today (no auth). org_id
// is the tenancy boundary for a future auth layer.

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/network/client';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = getServiceClient();
  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('org_id, name, created_at')
    .order('name', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Lightweight counts per org (employees + active connections).
  const [{ data: emps }, { data: conns }] = await Promise.all([
    supabase.from('employees').select('org_id'),
    supabase.from('connections').select('org_id, status'),
  ]);
  const empCount = new Map<string, number>();
  for (const e of emps ?? []) empCount.set((e as any).org_id, (empCount.get((e as any).org_id) ?? 0) + 1);
  const connCount = new Map<string, number>();
  for (const c of conns ?? []) {
    if ((c as any).status !== 'active') continue;
    connCount.set((c as any).org_id, (connCount.get((c as any).org_id) ?? 0) + 1);
  }

  return NextResponse.json({
    orgs: (orgs ?? []).map((o) => ({
      ...o,
      employee_count: empCount.get((o as any).org_id) ?? 0,
      connection_count: connCount.get((o as any).org_id) ?? 0,
    })),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = body?.name?.trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('organizations')
    .insert({ name })
    .select('org_id, name, created_at')
    .single();
  if (error) {
    const status = error.code === '23505' ? 409 : 500; // unique-name violation
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ org: data });
}
