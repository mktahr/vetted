// scripts/eval/populate-preview.ts
// SAFE preview writer. Runs the frozen classifier (Haiku, PROMPT_VERSION, WITH candidate
// context + production validation-retry) over all candidates and writes ONLY the SEPARATE
// *_inferred_preview columns + provenance (classification_preview_version / _at) on prod
// person_experiences. NEVER touches classification_status / classifier_version / the real
// *_inferred columns / any lifecycle state — so the real classifier queue is untouched.
// Fails loud + halts on a sustained API error; checks every write; never marks a failed
// write as written; honest partial-run reporting. Reports actual cost.
// Run: tsx scripts/eval/populate-preview.ts
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { buildSystemPrompt, buildUserPrompt, buildRetryNote } from '../../lib/candidates/classifier/prompt.ts'
import { callClassifier } from '../../lib/candidates/classifier/claude.ts'
import { validateClassification } from '../../lib/candidates/classifier/validate.ts'
import { loadActiveVocab } from '../../lib/candidates/classifier/index.ts'
import { PROMPT_VERSION, CLASSIFIER_MODEL, MAX_VALIDATION_RETRIES } from '../../lib/candidates/classifier/config.ts'

const IN_PER_M = 1.0, OUT_PER_M = 5.0

async function callOrHalt(system:string, user:string){
  let last:any=null
  for (let a=0;a<2;a++){ const c=await callClassifier(system,user); if(!c.error) return c; last=c; if(a===0) console.error(`  (API error, one retry): ${c.error?.slice(0,100)}`) }
  throw new Error(`API error after 1 retry — HALTING (candidates already written remain; PARTIAL run): ${last?.error}`)
}

async function main(){
  const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const [k,...v]=l.split('=');return [k.trim(), v.join('=').trim()]}))
  for (const [k,v] of Object.entries(env)) if(!process.env[k]) process.env[k]=v as string
  const prod = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const dev  = createClient(env.NEXT_PUBLIC_SUPABASE_URL_DEV, env.SUPABASE_SERVICE_ROLE_KEY_DEV)
  const vocab = await loadActiveVocab(dev)
  const system = buildSystemPrompt(vocab)
  const stamp = new Date().toISOString()

  const { data: people, error: pErr } = await prod.from('people').select('person_id, full_name, headline_raw, summary_raw').in('record_kind',['candidate','both']).order('created_at')
  if (pErr) throw new Error(`people query failed: ${pErr.message}`)
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

  let n=0, wrote=0, valFail=0, inTok=0, outTok=0
  for (const p of (people??[])){
    n++
    const experiences = byPerson[p.person_id] ?? []
    if (!experiences.length) continue
    const expIds = experiences.map(e=>e.person_experience_id)
    const basePrompt = buildUserPrompt(experiences, { headline: p.headline_raw, summary: p.summary_raw })
    let valid:any=null, ok=false
    for (let attempt=0; attempt<=MAX_VALIDATION_RETRIES; attempt++){
      const prompt = attempt===0 ? basePrompt : `${basePrompt}\n\n${buildRetryNote(valid.errors)}`
      const call = await callOrHalt(system, prompt)
      inTok+=call.inputTokens||0; outTok+=call.outputTokens||0
      valid = validateClassification(call.output, expIds, vocab)
      if (valid.ok){ ok=true; break }
    }
    if (!ok){ valFail++; console.error(`  VAL-FAIL ${p.full_name} (left preview NULL): ${JSON.stringify(valid.errors).slice(0,120)}`); continue }
    const byId: Record<string,any> = {}
    for (const t of valid.tuples) byId[t.exp_id]=t
    for (const e of experiences){
      const t = byId[e.person_experience_id]; if(!t) continue
      const { error: upErr } = await prod.from('person_experiences').update({
        function_inferred_preview: t.function_inferred,
        specialty_inferred_preview: t.specialty_inferred,
        skills_inferred_preview: t.skills_inferred,
        title_normalized_inferred_preview: t.title_normalized_inferred,
        classification_preview_version: PROMPT_VERSION,
        classification_preview_at: stamp,
      }).eq('person_experience_id', e.person_experience_id)
      if (upErr){ console.error(`  WRITE FAIL ${p.full_name}/${e.person_experience_id}: ${upErr.message}`); continue }
      wrote++
    }
    if(n%15===0) console.log(`  ${n}/${people!.length} candidates (${wrote} roles written)`)
  }
  const cost = (inTok/1e6)*IN_PER_M + (outTok/1e6)*OUT_PER_M
  console.log(`\nDONE (${PROMPT_VERSION} / ${CLASSIFIER_MODEL}): ${wrote} roles written to *_inferred_preview across ${n} candidates; ${valFail} candidates left NULL (validation-failed after retry).`)
  console.log(`Tokens ${inTok} in / ${outTok} out.  Actual cost ≈ $${cost.toFixed(4)}.  (No lifecycle / _inferred columns touched.)`)
}
main().catch(e=>{console.error('\nHALTED:', e.message); process.exit(1)})
