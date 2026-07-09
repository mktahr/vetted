// scripts/eval/build-eval-sets.ts
// STEP 2 (Codex-recommended): partition the frozen candidates into a TUNING set, a LOCKED
// HOLDOUT set, and a POOL (rest, for the final full-corpus run) — split by CANDIDATE, never
// by experience, so career context can't leak across train/test. Stratified across cohorts
// (founder / founding-eng / leadership / career-pivot / hard-tech / ml / data / non-eng /
// software) via a deterministic priority stratum per candidate, then a cyclic T,H,P,P,P,P
// assignment within stratum order so each set covers every cohort proportionally.
// Deterministic + no LLM/DB spend. Writes reference/eval/eval-sets.json.
// Run: tsx scripts/eval/build-eval-sets.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { isFoundingEngineerTitle } from '../../lib/scoring/compute-derived.ts'

const RX = {
  founder:     /\b(co-?)?founder\b|\bceo\b|\bcto\b(?!.*engineer)/i,
  leadership:  /\b(vp|vice president|head of|director|chief|manager|tech lead|tlm|em)\b/i,
  ml:          /\b(machine learning|ml |mlops|ml infra|deep learning|nlp|computer vision|applied scientist|research scientist|\bml\b|\bai\b|model(ing)?|llm|generative)\b/i,
  data:        /\b(data engineer|data platform|data pipeline|\betl\b|analytics|analyst|spark|bigquery|airflow|warehouse)\b/i,
  hard_tech:   /\b(aerospace|propulsion|structures?|mechanical|electrical|hardware|firmware|embedded|robotics?|optic(s|al)|photonics|\brf\b|antenna|chip|asic|fpga|materials|manufactur|controls|avionics|gnc|thermal|mechatronic|sensor|lidar|semiconductor)\b/i,
  software:    /\b(software|swe|sde|back[- ]?end|front[- ]?end|full[- ]?stack|infrastructure|platform|\bsre\b|devops|security|distributed|api|mobile|ios|android)\b/i,
  non_eng:     /\b(recruit|sales|marketing|product manager|program manager|\btpm\b|designer|\bux\b|operations|finance|advisor|consultant|curriculum|content|community)\b/i,
}
const DISCIPLINES = ['ml','data','hard_tech','software'] as const

function tagCandidate(c:any){
  const tags = new Set<string>()
  const disc = new Set<string>()
  let emptyDesc = 0
  for (const e of c.experiences){
    const txt = `${e.title_raw||''} ${e.description_raw||''}`
    if ((e.description_raw||'').trim().length < 40) emptyDesc++
    if (isFoundingEngineerTitle(e.title_raw)) tags.add('founding_eng')
    for (const [k,rx] of Object.entries(RX)) if (rx.test(txt)) tags.add(k)
    for (const d of DISCIPLINES) if ((RX as any)[d].test(txt)) disc.add(d)
  }
  const sparse = c.experiences.length>0 && emptyDesc/c.experiences.length >= 0.6
  const pivot = disc.size >= 2
  // primary stratum — rarest/most-important first so those cohorts are always captured.
  const primary =
    tags.has('founder')       ? 'founder' :
    tags.has('founding_eng')  ? 'founding_eng' :
    tags.has('leadership')    ? 'leadership' :
    pivot                     ? 'career_pivot' :
    tags.has('hard_tech')     ? 'hard_tech' :
    tags.has('ml')            ? 'ml' :
    tags.has('data')          ? 'data' :
    (tags.has('non_eng') && !tags.has('software')) ? 'non_eng' :
    tags.has('software')      ? 'software' : 'other'
  return { primary, sparse, pivot, tags:[...tags], nExp:c.experiences.length }
}

const STRATA_ORDER = ['founder','founding_eng','leadership','career_pivot','hard_tech','ml','data','non_eng','software','other']

function main(){
  const fixture = JSON.parse(readFileSync('reference/eval/fixture-inputs.json','utf8'))
  const cands = fixture.candidates.filter((c:any)=>c.experiences.length>0)
  const meta = cands.map((c:any)=>({ person_id:c.person_id, name:c.full_name, ...tagCandidate(c) }))
  // order by stratum, then assign cyclically: 1 tuning, 1 holdout, 4 pool per 6.
  meta.sort((a:any,b:any)=> STRATA_ORDER.indexOf(a.primary)-STRATA_ORDER.indexOf(b.primary) || a.name.localeCompare(b.name))
  const set:Record<string,string> = {}   // person_id -> T|H|P
  const cycle = ['T','H','P','P','P','P']
  // PER-STRATUM cycling (reset per stratum) so even small cohorts feed BOTH tuning + holdout,
  // instead of small strata falling entirely on POOL positions of a global cycle.
  const counter:Record<string,number> = {}
  for (const m of meta as any[]){ const idx = (counter[m.primary] = (counter[m.primary]||0)+1) - 1; set[m.person_id] = cycle[idx % cycle.length] }
  const pick=(s:string)=> meta.filter((m:any)=>set[m.person_id]===s)
  const tuning=pick('T'), holdout=pick('H'), pool=pick('P')

  const sumExp=(g:any[])=>g.reduce((n,m)=>n+m.nExp,0)
  writeFileSync('reference/eval/eval-sets.json', JSON.stringify({
    built_note:'candidate-split, stratified. Holdout is LOCKED — do not inspect while tuning.',
    tuning: tuning.map((m:any)=>m.person_id),
    holdout: holdout.map((m:any)=>m.person_id),
    pool: pool.map((m:any)=>m.person_id),
    meta: Object.fromEntries(meta.map((m:any)=>[m.person_id,{name:m.name,primary:m.primary,sparse:m.sparse,pivot:m.pivot,nExp:m.nExp}])),
  }, null, 2))

  const comp=(g:any[])=>{
    const by:Record<string,number>={}; for(const m of g) by[m.primary]=(by[m.primary]||0)+1
    return STRATA_ORDER.filter(s=>by[s]).map(s=>`${s}:${by[s]}`).join(' ')
  }
  console.log(`TUNING  ${tuning.length} candidates / ${sumExp(tuning)} experiences  (${tuning.filter((m:any)=>m.sparse).length} sparse)`)
  console.log(`  ${comp(tuning)}`)
  console.log(`HOLDOUT ${holdout.length} candidates / ${sumExp(holdout)} experiences  (${holdout.filter((m:any)=>m.sparse).length} sparse)  [LOCKED]`)
  console.log(`  ${comp(holdout)}`)
  console.log(`POOL    ${pool.length} candidates / ${sumExp(pool)} experiences  (final full-corpus run only)`)
  console.log(`  ${comp(pool)}`)
  console.log(`\nWrote reference/eval/eval-sets.json`)
}
main()
