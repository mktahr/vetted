// scripts/eval/populate-inferred-prod.ts
// ⚠ SUPERSEDED / NOT for the tuning loop. Per Codex review (2026-07-01): writing classifier
// output to PROD for a preview is provenance-poor and this script's earlier version mutated
// the LIVE classification_status lifecycle column (which the real classifier queue reads).
// The tuning loop now works off frozen artifacts; the REAL classifier (classifyCandidate ->
// commit_classification, atomic + fenced + correct lifecycle) populates prod post-merge.
//
// If ever used: writes ONLY the display-only *_inferred columns + is_founding_engineer_role;
// NEVER touches classification_status / classifier_version / classified_at; per-experience
// (NOT atomic per candidate) so a mid-run halt leaves earlier candidates written — the run is
// PARTIAL, not transactional, and the report says so. Fails loud + halts on API error.
// Run: tsx scripts/eval/populate-inferred-prod.ts
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { buildSystemPrompt, buildUserPrompt } from '../../lib/candidates/classifier/prompt.ts'
import { callClassifier } from '../../lib/candidates/classifier/claude.ts'
import { validateClassification } from '../../lib/candidates/classifier/validate.ts'
import { loadActiveVocab } from '../../lib/candidates/classifier/index.ts'
import { isFoundingEngineerTitle } from '../../lib/scoring/compute-derived.ts'

async function main(){
  const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const [k,...v]=l.split('=');return [k.trim(), v.join('=').trim()]}))
  for (const [k,v] of Object.entries(env)) if(!process.env[k]) process.env[k]=v as string
  const prod = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)      // read + write
  const dev  = createClient(env.NEXT_PUBLIC_SUPABASE_URL_DEV, env.SUPABASE_SERVICE_ROLE_KEY_DEV) // final taxonomy
  const vocab = await loadActiveVocab(dev)
  const system = buildSystemPrompt(vocab)

  const { data: people, error: pErr } = await prod.from('people').select('person_id, full_name').in('record_kind',['candidate','both']).order('created_at')
  if (pErr) throw new Error(`people query failed (not proceeding on an empty set): ${pErr.message}`)
  const ids = (people??[]).map((p:any)=>p.person_id)
  const { data: exps, error: eErr } = await prod.from('person_experiences')
    .select('person_experience_id, person_id, title_raw, start_date, end_date, is_current, description_raw, companies:company_id ( company_name )')
    .in('person_id', ids)
  if (eErr) throw new Error(`experiences query failed: ${eErr.message}`)
  const byPerson: Record<string, any[]> = {}
  for (const e of (exps??[]) as any[]) (byPerson[e.person_id] ??= []).push({
    person_experience_id: e.person_experience_id, company_name: e.companies?.company_name ?? null,
    title_raw: e.title_raw, start_date: e.start_date, end_date: e.end_date, is_current: e.is_current, description_raw: e.description_raw,
  })

  let n=0, wrote=0, errs=0
  for (const p of (people??[])){
    n++
    const experiences = byPerson[p.person_id] ?? []
    if (!experiences.length) continue
    const expIds = experiences.map(e=>e.person_experience_id)
    const call = await callClassifier(system, buildUserPrompt(experiences))
    // FAIL LOUD + HALT on API error. Per-experience writes mean candidates processed BEFORE
    // this point are already committed — the run is PARTIAL, not atomic. Say so, don't lie.
    if (call.error) throw new Error(`classifier API error — HALTING; candidates already processed remain written (PARTIAL run, not transactional): ${call.error}`)
    const valid = validateClassification(call.output, expIds, vocab)
    if (!valid.ok || valid.tuples.length === 0){
      errs++; console.error(`  SKIP ${p.full_name}: validation failed (${JSON.stringify(valid.errors).slice(0,120)}) — leaving _inferred untouched`); continue
    }
    const byId: Record<string,any> = {}
    for (const t of valid.tuples) byId[t.exp_id]=t
    for (const e of experiences){
      const t = byId[e.person_experience_id]
      if (!t) continue   // never write unknown as a mask for a missing tuple
      const { error: upErr } = await prod.from('person_experiences').update({
        function_inferred: t.function_inferred,
        specialty_inferred: t.specialty_inferred,
        skills_inferred: t.skills_inferred,
        title_normalized_inferred: t.title_normalized_inferred,
        is_founding_engineer_role: isFoundingEngineerTitle(e.title_raw),
      }).eq('person_experience_id', e.person_experience_id)
      if (upErr){ errs++; console.error(`  WRITE FAIL ${p.full_name} / ${e.person_experience_id}: ${upErr.message}`); continue }  // never wrote++ on a failed write
      wrote++
    }
    // Intentionally does NOT touch classification_status / classifier_version / classified_at —
    // those are the LIVE classifier-queue lifecycle columns; a preview must never mutate them.
    if(n%10===0) console.log(`  ${n}/${people!.length} candidates classified (${wrote} roles written)`)
  }
  console.log(`\nDone: ${wrote} roles written to prod *_inferred across ${n} candidates (${errs} candidate errors).`)
}
main().catch(e=>{console.error('POPULATE ERROR:', e); process.exit(1)})
