// app/api/network/employees/route.ts
//
// GET  ?org_id=… → list employees in an org (with connection counts).
// POST → create an employee { org_id, full_name, email?, linkedin_url? }.

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/network/client';
import { canonicalizeLinkedInUrl } from '@/lib/network/canonicalize-url';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const orgId = new URL(req.url).searchParams.get('org_id');
  if (!orgId) return NextResponse.json({ error: 'org_id is required' }, { status: 400 });

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('employees')
    .select('employee_id, org_id, full_name, email, linkedin_url, created_at')
    .eq('org_id', orgId)
    .order('full_name', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Active owner-link counts per employee.
  const { data: owners } = await supabase
    .from('connection_owners')
    .select('employee_id, is_active')
    .eq('org_id', orgId);
  const counts = new Map<string, number>();
  for (const o of owners ?? []) {
    if (!(o as any).is_active) continue;
    counts.set((o as any).employee_id, (counts.get((o as any).employee_id) ?? 0) + 1);
  }

  return NextResponse.json({
    employees: (data ?? []).map((e) => ({
      ...e,
      connection_count: counts.get((e as any).employee_id) ?? 0,
    })),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const orgId = body?.org_id;
  const fullName = body?.full_name?.trim();
  if (!orgId || !fullName) {
    return NextResponse.json({ error: 'org_id and full_name are required' }, { status: 400 });
  }

  const linkedinRaw = body?.linkedin_url?.trim() || null;
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('employees')
    .insert({
      org_id: orgId,
      full_name: fullName,
      email: body?.email?.trim() || null,
      linkedin_url: linkedinRaw,
      canonical_linkedin_url: canonicalizeLinkedInUrl(linkedinRaw),
    })
    .select('employee_id, org_id, full_name, email, linkedin_url, created_at')
    .single();
  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ employee: data });
}
