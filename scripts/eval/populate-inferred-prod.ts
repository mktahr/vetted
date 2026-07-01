// scripts/eval/populate-inferred-prod.ts
// Run the real classifier (Haiku) over every PROD candidate and write the results into
// the INERT *_inferred columns on prod person_experiences (+ is_founding_engineer_role).
// Nothing live reads these columns — this only populates them so the profile-page
// preview panel can display the classification for Matt's review. Vocab from DEV (final
// taxonomy 085-088); prod's own dictionary/columns are untouched, so current search is safe.
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

  const { data: people } = await prod.from('people').select('person_id, full_name').in('record_kind',['candidate','both']).order('created_at')
  const ids = (people??[]).map((p:any)=>p.person_id)
  const { data: exps } = await prod.from('person_experiences')
    .select('person_experience_id, person_id, title_raw, start_date, end_date, is_current, description_raw, companies:company_id ( company_name )')
    .in('person_id', ids)
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
    try {
      const call = await callClassifier(system, buildUserPrompt(experiences))
      const valid = validateClassification(call.output, expIds, vocab)
      const byId: Record<string,any> = {}
      for (const t of valid.tuples) byId[t.exp_id]=t
      for (const e of experiences){
        const t = byId[e.person_experience_id]
        await prod.from('person_experiences').update({
          function_inferred: t ? t.function_inferred : ['unknown'],
          specialty_inferred: t ? t.specialty_inferred : [],
          skills_inferred: t ? t.skills_inferred : [],
          title_normalized_inferred: t ? t.title_normalized_inferred : null,
          is_founding_engineer_role: isFoundingEngineerTitle(e.title_raw),
        }).eq('person_experience_id', e.person_experience_id)
        wrote++
      }
      await prod.from('people').update({ classification_status:'done', classified_at:new Date().toISOString(), classifier_version:'review-preview' }).eq('person_id', p.person_id)
    } catch(err){ errs++; console.error(`  ${p.full_name}: ${(err as Error).message}`) }
    if(n%10===0) console.log(`  ${n}/${people!.length} candidates classified (${wrote} roles written)`)
  }
  console.log(`\nDone: ${wrote} roles written to prod *_inferred across ${n} candidates (${errs} candidate errors).`)
}
main().catch(e=>{console.error('POPULATE ERROR:', e); process.exit(1)})
