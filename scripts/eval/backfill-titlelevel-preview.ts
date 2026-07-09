// scripts/eval/backfill-titlelevel-preview.ts
// Re-extract title_level (per experience) with the fixed resolver (leadership fallback), then
// recompute the derived progression fields (title_level_slope / career_progression / slope_score)
// via the real computeAndWriteDerivedFields — for the preview candidates. Fixes "declining"
// progression for people promoted into manager titles that were previously unleveled.
// Run: tsx scripts/eval/backfill-titlelevel-preview.ts
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { loadTitleLevelRules, extractTitleLevel } from '../../lib/normalize/title-level.ts'
import { computeAndWriteDerivedFields } from '../../lib/scoring/compute-derived.ts'

async function main(){
  const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const [k,...v]=l.split('=');return [k.trim(), v.join('=').trim()]}))
  for (const [k,v] of Object.entries(env)) if(!process.env[k]) process.env[k]=v as string
  const prod = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const rules = await loadTitleLevelRules(prod)

  const { data: people } = await prod.from('people').select('person_id, full_name').in('record_kind',['candidate','both'])
  const ids = (people??[]).map((p:any)=>p.person_id)
  const { data: exps } = await prod.from('person_experiences').select('person_experience_id, person_id, title_raw, title_level').in('person_id', ids)

  let changed=0
  for (const e of (exps??[])){
    const lvl = extractTitleLevel(e.title_raw, rules)
    if (lvl !== e.title_level){
      await prod.from('person_experiences').update({ title_level: lvl }).eq('person_experience_id', e.person_experience_id)
      changed++
    }
  }
  console.log(`Re-leveled ${changed} experiences. Recomputing derived (slope) for ${people!.length} candidates...`)

  let n=0
  for (const p of (people??[])){
    try { await computeAndWriteDerivedFields(prod, p.person_id) } catch(err){ console.error(`  ${p.full_name}: ${(err as Error).message}`) }
    if(String(p.full_name).toLowerCase().includes('makai')){
      const { data: mp } = await prod.from('people').select('title_level_slope, career_progression, slope_score, highest_seniority_reached').eq('person_id', p.person_id).single()
      console.log(`  MAKAI now -> progression(title_level_slope)=${mp?.title_level_slope} career_progression=${mp?.career_progression} slope_score=${mp?.slope_score} highest=${mp?.highest_seniority_reached}`)
    }
    if(++n%25===0) console.log(`  ${n}/${people!.length} recomputed`)
  }
  console.log('Done.')
}
main().catch(e=>{console.error('ERR',e); process.exit(1)})
