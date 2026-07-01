// lib/candidates/classifier/index.ts
//
// Five-axis classify-pending lifecycle (sub-PR 3). DECOUPLED from ingest:
//   claim (app-layer expiring lease, captures generation) -> load experiences + vocab
//   -> over-context clean-fail -> [reserve spend -> Haiku -> validate] (per-attempt)
//   -> FENCED commit_classification() -> commit | discard | fail.
//
// Failure semantics: only a classifier-produced-unusable result (invalid after retry,
// or over-context) burns the failure budget. Spend cap, infra/network/DB errors, and
// commit contention DISCARD without burning budget — a rerun retries cleanly.

import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  LEASE_MINUTES, MAX_FAILURES, MAX_VALIDATION_RETRIES,
  EST_CENTS_PER_CALL, MAX_DAILY_CENTS, MAX_INPUT_CHARS,
  CLASSIFIER_MODEL, PROMPT_VERSION,
} from './config';
import { buildSystemPrompt, buildUserPrompt, buildRetryNote } from './prompt';
import { callClassifier } from './claude';
import { validateClassification } from './validate';
import type {
  ActiveVocab, ExperienceForClassification, ClassifyOutcome, ClassifyBatchSummary, ClassifyAction,
} from './types';

function hashVocab(parts: string[]): string {
  let h = 5381;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

/** Load the active controlled vocabulary. THROWS on any query error or an empty
 *  function set — an infra/schema fault must NOT silently become an empty vocab
 *  (which would fail every validation and burn the failure budget). */
export async function loadActiveVocab(supabase: SupabaseClient): Promise<ActiveVocab> {
  const [fnRes, spRes, skRes] = await Promise.all([
    supabase.from('function_dictionary').select('function_normalized').eq('active', true),
    supabase.from('specialty_dictionary').select('specialty_normalized').eq('active', true),
    supabase.from('skills_dictionary').select('canonical_name').eq('is_active', true),
  ]);
  if (fnRes.error) throw new Error(`loadActiveVocab function_dictionary: ${fnRes.error.message}`);
  if (spRes.error) throw new Error(`loadActiveVocab specialty_dictionary: ${spRes.error.message}`);
  if (skRes.error) throw new Error(`loadActiveVocab skills_dictionary: ${skRes.error.message}`);
  const functions = (fnRes.data ?? []).map((r: any) => r.function_normalized).filter(Boolean).sort();
  const specialties = (spRes.data ?? []).map((r: any) => r.specialty_normalized).filter(Boolean).sort();
  const skills = (skRes.data ?? []).map((r: any) => r.canonical_name).filter(Boolean).sort();
  if (functions.length === 0) throw new Error('loadActiveVocab: no active functions (vocab not seeded?)');
  const version = hashVocab([`f:${functions.join(',')}`, `s:${specialties.join(',')}`, `k:${skills.join(',')}`]);
  return { functions, specialties, skills, version };
}

const out = (personId: string, action: ClassifyAction, extra?: Partial<ClassifyOutcome>): ClassifyOutcome =>
  ({ personId, action, ...extra });

/** Conditionally release our lease back to pending (never stomps a newer lease). */
async function releaseToPending(supabase: SupabaseClient, personId: string, token: string) {
  await supabase.from('people')
    .update({ classification_status: 'pending', classification_lease_token: null, classification_lease_expires_at: null, updated_at: new Date().toISOString() })
    .eq('person_id', personId).eq('classification_status', 'in_progress').eq('classification_lease_token', token);
}

/** Mark a run terminal. */
async function closeRun(supabase: SupabaseClient, runId: string, status: 'failed' | 'discarded', error: string | null, tokens?: number, costCents?: number) {
  await supabase.from('candidate_classification_runs')
    .update({ status, error, completed_at: new Date().toISOString(), tokens: tokens ?? null, cost_cents: costCents ?? null })
    .eq('run_id', runId).eq('status', 'claimed');
}

/**
 * Classifier-unusable result -> fail (burns budget). The people update is fenced on
 * our token; if it affected 0 rows the lease was lost (ingest invalidated us), so the
 * run is provenance-correct as 'discarded' (and the failure counter is untouched).
 */
async function markFailed(supabase: SupabaseClient, personId: string, token: string, runId: string, priorFailures: number, error: string, tokens: number, costCents: number) {
  const { data } = await supabase.from('people')
    .update({ classification_status: 'failed', classification_lease_token: null, classification_lease_expires_at: null, classification_failure_count: priorFailures + 1, updated_at: new Date().toISOString() })
    .eq('person_id', personId).eq('classification_status', 'in_progress').eq('classification_lease_token', token)
    .select('person_id');
  const ownedFailure = !!data && data.length === 1;
  await closeRun(supabase, runId, ownedFailure ? 'failed' : 'discarded', error, tokens, costCents);
  return ownedFailure;
}

export async function classifyCandidate(supabase: SupabaseClient, personId: string, vocab?: ActiveVocab): Promise<ClassifyOutcome> {
  const v = vocab ?? await loadActiveVocab(supabase); // throws before any claim on infra fault
  const token = randomUUID();
  const nowIso = new Date().toISOString();
  const leaseExpires = new Date(Date.now() + LEASE_MINUTES * 60_000).toISOString();

  // ── CLAIM: eligible = pending | failed-retryable | expired-in_progress.
  const { data: claimedRows, error: claimErr } = await supabase.from('people')
    .update({ classification_status: 'in_progress', classification_lease_token: token, classification_lease_expires_at: leaseExpires, updated_at: nowIso })
    .eq('person_id', personId)
    .or(`classification_status.eq.pending,and(classification_status.eq.failed,classification_failure_count.lt.${MAX_FAILURES}),and(classification_status.eq.in_progress,classification_lease_expires_at.lt.${nowIso})`)
    .select('person_id, classification_generation, classification_failure_count');
  if (claimErr) return out(personId, 'skipped', { reason: `claim_error: ${claimErr.message}` });
  if (!claimedRows || claimedRows.length !== 1) return out(personId, 'skipped', { reason: 'not_eligible' });
  const generation = (claimedRows[0] as any).classification_generation as number;
  const priorFailures = (claimedRows[0] as any).classification_failure_count as number;

  // Everything after the claim is fenced by try/catch so an unexpected throw releases
  // the lease (rather than leaking it until expiry).
  let runId: string | null = null;
  try {
    // Supersede any stale 'claimed' run (crashed worker) before inserting ours.
    await supabase.from('candidate_classification_runs')
      .update({ status: 'discarded', error: 'superseded_by_reclaim', completed_at: nowIso })
      .eq('person_id', personId).eq('status', 'claimed');

    const { data: runRow, error: runErr } = await supabase.from('candidate_classification_runs')
      .insert({ person_id: personId, lease_token: token, claimed_generation: generation, model: CLASSIFIER_MODEL, prompt_version: PROMPT_VERSION, dictionary_version: v.version, status: 'claimed' })
      .select('run_id').single();
    if (runErr || !runRow) { await releaseToPending(supabase, personId, token); return out(personId, 'discarded', { reason: `run_insert_failed: ${runErr?.message}` }); }
    runId = (runRow as any).run_id as string;

    // ── Load experiences (current stored state) + company names.
    const { data: expRows, error: expErr } = await supabase.from('person_experiences')
      .select('person_experience_id, title_raw, start_date, end_date, is_current, description_raw, companies:company_id ( company_name )')
      .eq('person_id', personId);
    if (expErr) { await releaseToPending(supabase, personId, token); await closeRun(supabase, runId, 'discarded', `exp_load:${expErr.message}`); return out(personId, 'discarded', { runId, reason: expErr.message }); }
    const experiences: ExperienceForClassification[] = (expRows ?? []).map((r: any) => ({
      person_experience_id: r.person_experience_id,
      company_name: r.companies?.company_name ?? null,
      title_raw: r.title_raw, start_date: r.start_date, end_date: r.end_date,
      is_current: r.is_current, description_raw: r.description_raw,
    }));

    const classifierVersion = `${PROMPT_VERSION}/${CLASSIFIER_MODEL}/${v.version}`;

    // No experiences -> nothing to classify; publish empty (commit accepts empty set).
    if (experiences.length === 0) {
      const res = await supabase.rpc('commit_classification', { p_person_id: personId, p_lease_token: token, p_run_id: runId, p_classifier_version: classifierVersion, p_assignments: [] });
      if (res.data === 'committed') return out(personId, 'noop', { runId });
      await releaseToPending(supabase, personId, token); await closeRun(supabase, runId, 'discarded', `empty_commit:${res.data ?? res.error?.message}`);
      return out(personId, 'discarded', { runId, reason: `empty_commit:${res.data ?? res.error?.message}` });
    }

    // ── Candidate-level SUPPLEMENTARY context (headline + summary) — passed separately,
    //    scoped by the prompt's rule 7 (never overrides a role's own description).
    const { data: personCtx } = await supabase.from('people').select('headline_raw, summary_raw').eq('person_id', personId).maybeSingle();

    // ── Over-context guard: clean fail, never silently truncate.
    const systemPrompt = buildSystemPrompt(v);
    const userPrompt = buildUserPrompt(experiences, { headline: personCtx?.headline_raw, summary: personCtx?.summary_raw });
    if (systemPrompt.length + userPrompt.length > MAX_INPUT_CHARS) {
      await markFailed(supabase, personId, token, runId, priorFailures, 'over_context', 0, 0);
      return out(personId, 'failed', { runId, reason: 'over_context' });
    }

    // ── Classify: reserve spend BEFORE EACH call; one validation retry.
    const expectedIds = experiences.map((e) => e.person_experience_id);
    let tokensUsed = 0;
    let callCount = 0;
    let lastErrors: string[] = [];
    for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
      const { data: reserved, error: reserveErr } = await supabase.rpc('reserve_classification_spend', { p_cents: EST_CENTS_PER_CALL, p_cap: MAX_DAILY_CENTS });
      if (reserveErr) {
        // Infra error must SURFACE as a discard — never masquerade as spend_cap.
        await releaseToPending(supabase, personId, token); await closeRun(supabase, runId, 'discarded', `reserve_rpc_error:${reserveErr.message}`, tokensUsed, callCount * EST_CENTS_PER_CALL);
        return out(personId, 'discarded', { runId, reason: `reserve_rpc_error:${reserveErr.message}`, tokens: tokensUsed });
      }
      if (reserved !== true) {
        await releaseToPending(supabase, personId, token); await closeRun(supabase, runId, 'discarded', 'spend_cap', tokensUsed, callCount * EST_CENTS_PER_CALL);
        return out(personId, 'capped', { runId, reason: 'daily_spend_cap', tokens: tokensUsed });
      }
      const prompt = attempt === 0 ? userPrompt : `${userPrompt}\n\n${buildRetryNote(lastErrors)}`;
      const call = await callClassifier(systemPrompt, prompt);
      callCount++;
      tokensUsed += call.inputTokens + call.outputTokens;
      if (call.error) {
        await releaseToPending(supabase, personId, token); await closeRun(supabase, runId, 'discarded', `api_error:${call.error}`, tokensUsed, callCount * EST_CENTS_PER_CALL);
        return out(personId, 'discarded', { runId, reason: `api_error:${call.error}`, tokens: tokensUsed });
      }
      const valid = validateClassification(call.output, expectedIds, v);
      if (valid.ok) {
        const res = await supabase.rpc('commit_classification', { p_person_id: personId, p_lease_token: token, p_run_id: runId, p_classifier_version: classifierVersion, p_assignments: valid.tuples });
        if (res.error) { await releaseToPending(supabase, personId, token); await closeRun(supabase, runId, 'discarded', `commit_rpc_error:${res.error.message}`, tokensUsed, callCount * EST_CENTS_PER_CALL); return out(personId, 'discarded', { runId, reason: res.error.message, tokens: tokensUsed }); }
        if (res.data === 'committed') {
          await supabase.from('candidate_classification_runs').update({ tokens: tokensUsed, cost_cents: callCount * EST_CENTS_PER_CALL }).eq('run_id', runId);
          return out(personId, 'committed', { runId, tokens: tokensUsed });
        }
        await releaseToPending(supabase, personId, token); await closeRun(supabase, runId, 'discarded', `commit:${res.data}`, tokensUsed, callCount * EST_CENTS_PER_CALL);
        return out(personId, 'discarded', { runId, reason: String(res.data), tokens: tokensUsed });
      }
      lastErrors = valid.errors;
    }
    // Invalid after the retry budget -> classifier-unusable -> fail (burns budget).
    await markFailed(supabase, personId, token, runId, priorFailures, `invalid_output: ${lastErrors.slice(0, 5).join('; ')}`, tokensUsed, callCount * EST_CENTS_PER_CALL);
    return out(personId, 'failed', { runId, reason: 'invalid_after_retry', tokens: tokensUsed });
  } catch (e: any) {
    await releaseToPending(supabase, personId, token);
    if (runId) await closeRun(supabase, runId, 'discarded', `exception:${e?.message ?? e}`);
    return out(personId, 'discarded', { runId: runId ?? undefined, reason: `exception:${e?.message ?? e}` });
  }
}

/** Batch over eligible candidates (sequential — LLM not parallel-safe here). */
export async function classifyPending(supabase: SupabaseClient, limit = 50): Promise<ClassifyBatchSummary> {
  const nowIso = new Date().toISOString();
  const { data: eligible, error: selErr } = await supabase.from('people')
    .select('person_id')
    .or(`classification_status.eq.pending,and(classification_status.eq.failed,classification_failure_count.lt.${MAX_FAILURES}),and(classification_status.eq.in_progress,classification_lease_expires_at.lt.${nowIso})`)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (selErr) throw new Error(`classifyPending select: ${selErr.message}`);

  const summary: ClassifyBatchSummary = { attempted: 0, committed: 0, capped: 0, failed: 0, discarded: 0, skipped: 0, noop: 0, results: [] };
  if (!eligible || eligible.length === 0) return summary;
  const vocab = await loadActiveVocab(supabase);

  let consecutiveInfraErrors = 0;
  for (const row of eligible) {
    const r = await classifyCandidate(supabase, (row as any).person_id, vocab);
    summary.attempted++;
    summary.results.push(r);
    summary[r.action] = (summary[r.action] as number) + 1;
    if (r.action === 'capped') break; // every subsequent reserve will also fail today
    // HALT on a sustained infra/API outage instead of firing one failing call per candidate
    // (the class of bug the credit outage exposed — don't let it silently repeat 129x).
    const infra = r.action === 'discarded' && (String(r.reason).startsWith('api_error:') || String(r.reason).startsWith('reserve_rpc_error:'));
    if (infra) {
      if (++consecutiveInfraErrors >= 3) { summary.haltedReason = `sustained infra/API failure (${consecutiveInfraErrors} consecutive discards): ${r.reason}`; break; }
    } else consecutiveInfraErrors = 0;
  }
  return summary;
}
