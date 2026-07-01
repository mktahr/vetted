// scripts/eval/backfill-seniority-preview.ts
// Recompute seniority_normalized (per experience) + highest_seniority_reached (per person)
// for the preview candidates using the REAL resolver (resolveSeniorityWithDescription) —
// NOT the stale JS mirror in backfill-seniority.mjs. Fixes compound leadership titles like
// "Robotics Software Engineering Manager" that were falling to IC. Writes to prod.
// (Seniority display fields only; a full re-score happens at ship.)
// Run: tsx scripts/eval/backfill-seniority-preview.ts
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { loadSeniorityRules, resolveSeniorityWithDescription } from '../../lib/normalize/seniority.ts'

async function main(){
  const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const [k,...v]=l.split('=');return [k.trim(), v.join('=').trim()]}))
  const prod = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const rules = await loadSeniorityRules(prod)
  const { data: ranks } = await prod.from('seniority_dictionary').select('seniority_normalized, rank_order')
  const rank: Record<string,number> = {}; for (const r of (ranks??[])) rank[r.seniority_normalized]=r.rank_order

  const { data: people } = await prod.from('people').select('person_id, full_name').in('record_kind',['candidate','both'])
  const ids = (people??[]).map((p:any)=>p.person_id)
  const { data: exps } = await prod.from('person_experiences').select('person_experience_id, person_id, title_raw, description_raw, employment_type_normalized, start_date, seniority_normalized').in('person_id', ids)
  const { data: edu } = await prod.from('person_education').select('person_id, degree_level, end_year').in('person_id', ids)
  // graduation = earliest post-secondary end_year (for the pre-grad intern override).
  const gradBy: Record<string, Date|null> = {}
  const POST = new Set(['bachelor','master','mba','phd','jd','md','associate'])
  for (const e of (edu??[])) {
    if (!POST.has(e.degree_level) || !e.end_year) continue
    const d = new Date(e.end_year, 0, 1)
    if (!gradBy[e.person_id] || d < gradBy[e.person_id]!) gradBy[e.person_id] = d
  }

  const byPerson: Record<string, any[]> = {}
  for (const e of (exps??[])) (byPerson[e.person_id] ??= []).push(e)

  let changed=0
  for (const p of (people??[])){
    const rows = byPerson[p.person_id] ?? []
    let bestRank = -1, bestLevel = 'unknown'
    for (const e of rows){
      const res = resolveSeniorityWithDescription({ title:e.title_raw, employment_type:e.employment_type_normalized, role_start_date:e.start_date, person_graduation_date: gradBy[p.person_id] ?? null, description_raw:e.description_raw } as any, rules)
      if (res.level !== e.seniority_normalized){
        await prod.from('person_experiences').update({ seniority_normalized: res.level }).eq('person_experience_id', e.person_experience_id)
        changed++
      }
      const rk = rank[res.level] ?? -1
      if (rk > bestRank){ bestRank = rk; bestLevel = res.level }
    }
    if (rows.length){
      await prod.from('people').update({ highest_seniority_reached: bestLevel }).eq('person_id', p.person_id)
    }
    if (String(p.full_name).toLowerCase().includes('makai')) console.log(`  MAKAI -> highest=${bestLevel}; current-role levels: ${rows.map((e:any)=>e.title_raw+'='+resolveSeniorityWithDescription({title:e.title_raw,employment_type:e.employment_type_normalized,role_start_date:e.start_date,person_graduation_date:gradBy[p.person_id]??null,description_raw:e.description_raw} as any,rules).level).join(' | ')}`)
  }
  console.log(`\nUpdated ${changed} experience seniority values + recomputed highest_seniority_reached for ${people!.length} candidates.`)
}
main().catch(e=>{console.error('ERR',e); process.exit(1)})
