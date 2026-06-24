// app/api/network/upload/route.ts
//
// POST → ingest an employee's LinkedIn Connections.csv.
// Body: { org_id, employee_id, filename?, csv }  (csv = raw file text)
// Returns the post-upload summary (counts + pre-enrichment cost estimate).
//
// No Crust calls here — enrichment is a separate, explicit, count-first action.

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/network/client';
import { ingestConnectionsCsv } from '@/lib/network/ingest';
import { HARD_ROW_CAP } from '@/lib/network/config';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const orgId = body?.org_id;
  const employeeId = body?.employee_id;
  const csv = body?.csv;
  if (!orgId || !employeeId || typeof csv !== 'string') {
    return NextResponse.json(
      { error: 'org_id, employee_id, and csv (string) are required' },
      { status: 400 },
    );
  }

  // Cheap guardrail before parsing a pathological file.
  const approxRows = csv.split('\n').length;
  if (approxRows > HARD_ROW_CAP) {
    return NextResponse.json(
      { error: `CSV exceeds the ${HARD_ROW_CAP}-row cap (${approxRows} lines)` },
      { status: 413 },
    );
  }

  const supabase = getServiceClient();

  // Validate the org/employee pair belongs together (defensive — single admin).
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('employee_id, org_id')
    .eq('employee_id', employeeId)
    .single();
  if (empErr || !emp) return NextResponse.json({ error: 'employee not found' }, { status: 404 });
  if ((emp as any).org_id !== orgId) {
    return NextResponse.json({ error: 'employee does not belong to org' }, { status: 400 });
  }

  try {
    const summary = await ingestConnectionsCsv({
      supabase,
      orgId,
      employeeId,
      filename: body?.filename ?? null,
      csvText: csv,
      scopeKey: body?.scope_key ?? 'engineering',
    });
    return NextResponse.json({ summary });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'ingest failed' }, { status: 500 });
  }
}
