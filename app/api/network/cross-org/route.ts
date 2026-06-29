// app/api/network/cross-org/route.ts
//
// NETWORK CONNECTIONS PR 2 — ADMIN CROSS-ORG VIEW.
//
// GET ?person_id=… → every org + individual (employee) connected to this candidate,
// across ALL orgs. Answers "who can warm-intro this person?" platform-wide.
//
// Match is by BOTH the projected person_id link AND canonical_url, so connections
// that point at this person but haven't been projected/linked yet still show up.
// Only ACTIVE owners count (a soft-disconnected link is not a live warm path).

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/network/client';
import { canonicalizeLinkedInUrl } from '@/lib/network/canonicalize-url';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const personId = new URL(req.url).searchParams.get('person_id');
  if (!personId) return NextResponse.json({ error: 'person_id is required' }, { status: 400 });

  const supabase = getServiceClient();

  // Resolve the candidate's canonical URL (for the not-yet-linked match path).
  const { data: person } = await supabase
    .from('people')
    .select('person_id, linkedin_url')
    .eq('person_id', personId)
    .maybeSingle<{ person_id: string; linkedin_url: string | null }>();
  if (!person) return NextResponse.json({ error: 'person not found' }, { status: 404 });
  const canon = person.linkedin_url ? canonicalizeLinkedInUrl(person.linkedin_url) : null;

  // Connections that resolve to this person: linked by person_id OR same canonical_url.
  const ors = [`person_id.eq.${personId}`];
  if (canon) ors.push(`canonical_url.eq.${canon}`);
  const { data: conns, error } = await supabase
    .from('connections')
    .select('connection_id, org_id')
    .or(ors.join(','));
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  const connIds = (conns ?? []).map((c) => (c as any).connection_id);
  if (connIds.length === 0) {
    return NextResponse.json({ total_orgs: 0, total_employees: 0, orgs: [] });
  }

  // Active owners (the individuals) + their org names.
  const { data: owners, error: oErr } = await supabase
    .from('connection_owners')
    .select('connection_id, org_id, is_active, employees(employee_id, full_name), organizations(name)')
    .in('connection_id', connIds)
    .eq('is_active', true);
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 502 });

  // Group by org → distinct employees.
  const byOrg = new Map<string, { org_id: string; org_name: string; employees: Map<string, string> }>();
  for (const o of owners ?? []) {
    const oo = o as any;
    const orgId = oo.org_id as string;
    let g = byOrg.get(orgId);
    if (!g) {
      g = { org_id: orgId, org_name: oo.organizations?.name ?? '(unknown org)', employees: new Map() };
      byOrg.set(orgId, g);
    }
    const empId = oo.employees?.employee_id;
    if (empId) g.employees.set(empId, oo.employees?.full_name ?? '(unknown)');
  }

  const orgs = Array.from(byOrg.values())
    .map((g) => ({ org_id: g.org_id, org_name: g.org_name, employees: Array.from(g.employees.values()).sort() }))
    .sort((a, b) => b.employees.length - a.employees.length);
  const total_employees = orgs.reduce((n, g) => n + g.employees.length, 0);

  return NextResponse.json({ total_orgs: orgs.length, total_employees, orgs });
}
