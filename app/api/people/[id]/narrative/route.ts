// app/api/people/[id]/narrative/route.ts
//
// GET  → returns the cached narrative (and generates one if missing).
// POST → forces a regeneration (used by the Regenerate button).
//
// Both responses: { narrative: string, generated_at: string }

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildNarrativeContext, generateNarrative } from '@/lib/ai/narrative'

export const maxDuration = 60

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function generateAndCache(personId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const context = await buildNarrativeContext(supabase, personId)
  const narrative = await generateNarrative(context)
  const generated_at = new Date().toISOString()
  const { error } = await supabase
    .from('people')
    .update({
      narrative_summary: narrative,
      narrative_summary_generated_at: generated_at,
    })
    .eq('person_id', personId)
  if (error) throw new Error(`Failed to cache narrative: ${error.message}`)
  return { narrative, generated_at }
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const personId = ctx.params.id
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return Response.json({ error: 'Missing SUPABASE env vars' }, { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data, error } = await supabase
    .from('people')
    .select('narrative_summary, narrative_summary_generated_at')
    .eq('person_id', personId)
    .single()

  if (error || !data) {
    return Response.json({ error: error?.message ?? 'not found' }, { status: 404 })
  }

  if (data.narrative_summary) {
    return Response.json({
      narrative: data.narrative_summary,
      generated_at: data.narrative_summary_generated_at,
    })
  }

  // Auto-generate on first read
  try {
    const result = await generateAndCache(personId)
    return Response.json(result)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 },
    )
  }
}

export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  const personId = ctx.params.id
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return Response.json({ error: 'Missing SUPABASE env vars' }, { status: 500 })
  }
  try {
    const result = await generateAndCache(personId)
    return Response.json(result)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 },
    )
  }
}
