// app/api/ingest/route.ts
// Vetted Ingest API — Phase 1
//
// Receives LinkedIn scrape payloads from the Chrome extension + the Crust admin
// import. Thin transport wrapper around the shared normalize-and-write core:
//   - Route owns: auth, payload validation, source allowlisting, the raw_ingest_events
//     archive + 24h dedup + status transitions, candidate_decision_state init, and
//     the HTTP response.
//   - writeCanonicalProfile (lib/ingest/write-canonical.ts) owns steps 2–9:
//     company/title/person/experiences/education/derived/score/signals.
//
// Auth: x-ingest-secret header

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  writeCanonicalProfile,
  VALID_SOURCES,
  type IngestSource,
  type IngestPayload,
} from '@/lib/ingest/write-canonical';

const INGEST_SECRET = process.env.INGEST_SECRET!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  // Auth check
  const secret = req.headers.get('x-ingest-secret');
  if (secret !== INGEST_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: IngestPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!payload.linkedin_url || !payload.full_name) {
    return NextResponse.json({ error: 'linkedin_url and full_name are required' }, { status: 400 });
  }

  if (!payload.source || !VALID_SOURCES.includes(payload.source as IngestSource)) {
    return NextResponse.json({
      error: `source is required and must be one of: ${VALID_SOURCES.join(', ')}`,
    }, { status: 400 });
  }
  const source = payload.source as IngestSource;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[ingest] Missing SUPABASE env vars');
    return NextResponse.json({
      success: false,
      message: 'Server misconfiguration: missing database credentials',
    }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('[ingest] Processing:', payload.linkedin_url, `(source=${source})`);

  // ── Step 0: Archive raw payload ──────────────────────────────────────────
  // Non-negotiable: if this fails, abort the entire ingest.
  const rawPayload = payload.raw_json || payload.canonical_json || {};
  const payloadJson = JSON.stringify(rawPayload);
  const payloadHash = createHash('sha256').update(payloadJson).digest('hex');

  // Dedup: skip if same linkedin_url + same payload hash within 24h
  const { data: existingRaw } = await supabase
    .from('raw_ingest_events')
    .select('id')
    .eq('linkedin_url', payload.linkedin_url)
    .eq('payload_hash', payloadHash)
    .gte('fetched_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1)
    .maybeSingle();

  if (existingRaw) {
    console.log('[ingest] Duplicate payload, skipping:', payload.linkedin_url);
    return NextResponse.json({
      success: true,
      skipped: true,
      message: 'Duplicate payload within 24h window, skipped',
    });
  }

  const { data: rawEvent, error: rawError } = await supabase
    .from('raw_ingest_events')
    .insert({
      linkedin_url: payload.linkedin_url,
      source,
      source_version: payload.source_version || null,
      mapper_version: payload.mapper_version || null,
      payload: rawPayload,
      payload_hash: payloadHash,
      processing_status: 'pending',
    })
    .select('id')
    .single();

  if (rawError || !rawEvent) {
    console.error('[ingest] Raw archive write failed — aborting:', rawError);
    return NextResponse.json({
      success: false,
      message: 'Failed to archive raw payload',
    }, { status: 500 });
  }

  const rawEventId = rawEvent.id;

  try {
    // ── Steps 2–9: shared normalize-and-write core (candidate path) ──────────
    const result = await writeCanonicalProfile(supabase, payload, { score: true });

    // Person upsert is the one fatal early-exit. Matches the original behavior:
    // return 500 WITHOUT marking the raw event mapping_failed (this path never
    // reached the outer catch in the pre-extraction route).
    if (!result.ok) {
      return NextResponse.json({
        success: false,
        message: 'Failed to upsert person',
      }, { status: 500 });
    }

    const personId = result.personId;

    // ── Step 10: Create initial decision state (active) if new person ───────
    const { data: existingDecision } = await supabase
      .from('candidate_decision_state')
      .select('decision_state_id')
      .eq('person_id', personId)
      .order('effective_at', { ascending: false })
      .limit(1)
      .single();

    if (!existingDecision) {
      await supabase.from('candidate_decision_state').insert({
        person_id: personId,
        decision_state: 'active',
        source: 'system',
        reason: 'initial_ingest',
      });
    }

    // ── Mark raw event as successfully mapped ─────────────────────────────
    await supabase.from('raw_ingest_events').update({
      processing_status: 'mapped',
      person_id: personId,
      mapped_at: new Date().toISOString(),
    }).eq('id', rawEventId);

    console.log('[ingest] Success:', payload.linkedin_url, '| person_id:', personId);

    return NextResponse.json({
      success: true,
      person_id: personId,
      bucket: result.bucket,
      total_score: result.totalScore,
      current_function: result.currentFunction,
      current_specialty: result.currentSpecialty,
      current_seniority: result.currentSeniority,
      current_title_normalized: result.currentTitleNormalized,
      message: 'Profile ingested and normalized successfully',
    });

  } catch (err) {
    // Mark raw event as failed — keep the raw row for replay
    await supabase.from('raw_ingest_events').update({
      processing_status: 'mapping_failed',
      mapping_error: err instanceof Error ? err.message : 'Unknown error',
    }).eq('id', rawEventId);

    console.error('[ingest] Unhandled error:', err);
    return NextResponse.json({
      success: false,
      message: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
