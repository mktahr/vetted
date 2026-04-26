// lib/signals/processCandidate.ts
//
// Per-candidate signal processor. Runs the pattern extractor against
// all text fields for a given person and upserts matches into person_signals.

import { SupabaseClient } from '@supabase/supabase-js'
import { loadSignalDictionary, extractSignalsFromText, PatternMatch } from './extractPatterns'
import { SourceFieldHint } from '@/types/signals'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProcessResult {
  experiences_processed: number
  signals_written: number
  signals_skipped_existing: number
}

// ─── Upsert helper ──────────────────────────────────────────────────────────

async function upsertSignal(
  supabase: SupabaseClient,
  personId: string,
  match: PatternMatch,
  sourceExperienceId: string | null,
  sourceEducationId: string | null,
): Promise<'written' | 'existing'> {
  // Direct insert — the COALESCE unique index (person_signals_unique_idx)
  // catches duplicates. On conflict we catch the 23505 error code.
  const { error: insertErr } = await supabase.from('person_signals').insert({
    person_id: personId,
    signal_id: match.signal_id,
    source: 'pattern_extractor',
    source_experience_id: sourceExperienceId,
    source_education_id: sourceEducationId,
    source_text: match.matched_alias.slice(0, 200),
    confidence: match.confidence,
  })

  if (insertErr) {
    if (insertErr.code === '23505') {
      // Unique violation — row already exists. The batch script is
      // idempotent; re-runs just skip existing rows.
      return 'existing'
    }
    console.error(`[signals] Insert failed for person=${personId} signal=${match.signal_id}:`, insertErr.message)
    return 'existing'
  }
  return 'written'
}

// ─── Main processor ─────────────────────────────────────────────────────────

export async function processCandidateSignals(
  supabase: SupabaseClient,
  personId: string,
): Promise<ProcessResult> {
  // Ensure dictionary is loaded
  await loadSignalDictionary(supabase)

  const result: ProcessResult = {
    experiences_processed: 0,
    signals_written: 0,
    signals_skipped_existing: 0,
  }

  // Fetch person record
  const { data: person } = await supabase
    .from('people')
    .select('headline_raw, summary_raw')
    .eq('person_id', personId)
    .single()

  // Fetch experiences with company name
  const { data: experiences } = await supabase
    .from('person_experiences')
    .select('person_experience_id, title_raw, description_raw, companies:company_id(company_name)')
    .eq('person_id', personId)

  // Collect all matches across all text fields
  const allMatches: Array<{ match: PatternMatch; expId: string | null }> = []

  // Process experience descriptions and titles
  for (const exp of experiences || []) {
    result.experiences_processed++

    if (exp.description_raw) {
      const descMatches = extractSignalsFromText(exp.description_raw, 'experience_description')
      for (const m of descMatches) {
        allMatches.push({ match: m, expId: exp.person_experience_id })
      }
    }

    if (exp.title_raw) {
      const titleMatches = extractSignalsFromText(exp.title_raw, 'title')
      for (const m of titleMatches) {
        allMatches.push({ match: m, expId: exp.person_experience_id })
      }
    }

    // Company name can contain signals (e.g., "Y Combinator")
    const companyName = (exp.companies as any)?.company_name
    if (companyName) {
      const companyMatches = extractSignalsFromText(companyName, 'company_name')
      for (const m of companyMatches) {
        allMatches.push({ match: m, expId: exp.person_experience_id })
      }
    }
  }

  // Process headline
  if (person?.headline_raw) {
    const headlineMatches = extractSignalsFromText(person.headline_raw, 'headline')
    for (const m of headlineMatches) {
      allMatches.push({ match: m, expId: null })
    }
  }

  // Process summary/about
  if (person?.summary_raw) {
    const summaryMatches = extractSignalsFromText(person.summary_raw, 'about')
    for (const m of summaryMatches) {
      allMatches.push({ match: m, expId: null })
    }
  }

  // Deduplicate: for the same (signal_id, expId) keep highest confidence.
  // Different experiences produce separate rows — the unique index includes
  // source_experience_id, so the same signal from two experiences = two rows.
  const deduped = new Map<string, { match: PatternMatch; expId: string | null }>()
  for (const item of allMatches) {
    const key = `${item.match.signal_id}|${item.expId ?? 'null'}`
    const existing = deduped.get(key)
    if (!existing || item.match.confidence > existing.match.confidence) {
      deduped.set(key, item)
    }
  }

  // Write to database
  const itemsToWrite: Array<{ match: PatternMatch; expId: string | null }> = []
  deduped.forEach((item) => { itemsToWrite.push(item) })

  for (const item of itemsToWrite) {
    const status = await upsertSignal(
      supabase,
      personId,
      item.match,
      item.expId,
      null, // source_education_id
    )
    if (status === 'written') {
      result.signals_written++
    } else {
      result.signals_skipped_existing++
    }
  }

  return result
}
