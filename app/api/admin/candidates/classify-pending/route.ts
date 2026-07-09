// app/api/admin/candidates/classify-pending/route.ts
//
// Five-axis classify-pending batch (sub-PR 3). Decoupled from ingest; spend-capped.
// Classifies eligible candidates (pending | failed-retryable | expired-lease).
//
// Auth: Vercel cron injects `Authorization: Bearer <CRON_SECRET>`; manual/CLI uses
// `x-ingest-secret` (mirrors the company tag-pending cron).

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyPending } from '@/lib/candidates/classifier';

export const runtime = 'nodejs';
export const maxDuration = 300;

const DEFAULT_LIMIT = 50;

async function handle(req: NextRequest): Promise<Response> {
  const auth = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  const ingestSecret = process.env.INGEST_SECRET;
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
  const isIngest = !!ingestSecret && req.headers.get('x-ingest-secret') === ingestSecret;
  if (!isCron && !isIngest) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return Response.json({ error: 'supabase env missing' }, { status: 500 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 });

  const limit = Math.min(Number(new URL(req.url).searchParams.get('limit')) || DEFAULT_LIMIT, 500);
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const summary = await classifyPending(supabase, limit);
    return Response.json({ summary });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? 'classify-pending failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
