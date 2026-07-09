// scripts/eval/opus-contested.ts
// THIRD independent source (Opus) scoped to the genuinely-contested rows only
// (genuine Sonnet-vs-rules conflicts + engineer-titled rows Sonnet abstained on).
// Opus runs per-candidate (full context) for candidates that have >=1 contested row,
// fills opus_* for those candidates' rows, and re-prefills YOUR_* from Opus on the
// contested rows (strongest source there). Then writes the FINAL labels-draft.csv,
// sorted contested-first. Reads the structured handoff from gen-draft (no Sonnet re-spend).
// Run: tsx scripts/eval/opus-contested.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { buildSystemPrompt, buildUserPrompt } from '../../lib/candidates/classifier/prompt.ts'
import { loadActiveVocab } from '../../lib/candidates/classifier/index.ts'
import { csvCell as csv, arrJoin as arr, stratify } from './_shared.ts'

const OPUS = 'claude-opus-4-8'
const HARD_TECH = new Set(['electrical_engineering','mechanical_engineering','hardware_engineering','materials_engineering','manufacturing_engineering','robotics_engineering','firmware_engineering','optics_engineering','aerospace_engineering','chip_engineering','controls_engineering','systems_engineering','test_engineering'])

async function opus(apiKey:string, system:string, user:string): Promise<any> {
  // NB: Opus 4.8 deprecates `temperature` (400s if sent) — omit it.
  const r = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:OPUS,max_tokens:4096,system,messages:[{role:'user',content:user}]})})
  if(!r.ok){ console.error('opus',r.status,(await r.text()).slice(0,200)); return null }
  const d = await r.json(); const t = d?.content?.[0]?.text ?? ''
  const f = t.replace(/```(?:json)?/gi,'').trim()
  try { return JSON.parse(f) } catch {}
  const i=t.indexOf('{'), j=t.lastIndexOf('}'); try { return JSON.parse(t.slice(i,j+1)) } catch { return null }
}

async function main() {
  const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const [k,...v]=l.split('=');return [k.trim(), v.join('=').trim()]}))
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL_DEV, env.SUPABASE_SERVICE_ROLE_KEY_DEV)
  const { rows } = JSON.parse(readFileSync('reference/eval/_draft-rows.json','utf8'))
  const fixture = JSON.parse(readFileSync('reference/eval/fixture-inputs.json','utf8'))
  const expByPerson: Record<string, any[]> = {}
  for (const c of fixture.candidates) expByPerson[c.person_id] = c.experiences
  const system = buildSystemPrompt(await loadActiveVocab(sb))

  // Candidates with >=1 contested row.
  const contestedPeople = [...new Set(rows.filter((r:any)=>r.contested).map((r:any)=>r.person_id))]
  console.log(`Opus on ${contestedPeople.length} contested candidates (of ${new Set(rows.map((r:any)=>r.person_id)).size} total)...`)

  let done=0
  for (const pid of contestedPeople) {
    const exps = expByPerson[pid as string] ?? []
    if (!exps.length) continue
    const out = await opus(env.ANTHROPIC_API_KEY, system, buildUserPrompt(exps))
    const byId: Record<string, any> = {}
    for (const a of (out?.assignments ?? [])) byId[a.exp_id] = a
    for (const r of rows.filter((r:any)=>r.person_id===pid)) {
      const a = byId[r.exp_id]
      if (!a) continue
      r.opus_function = arr(a.function_inferred); r.opus_specialty = arr(a.specialty_inferred)
      r.opus_skills = arr(a.skills_inferred); r.opus_title = a.title_normalized_inferred ?? ''
      // Strongest-source prefill: on the CONTESTED rows, YOUR_* = Opus (else keep Sonnet).
      if (r.contested && (r.opus_function || r.opus_specialty)) {
        r.YOUR_function = r.opus_function; r.YOUR_specialty = r.opus_specialty
        r.YOUR_skills = r.opus_skills; r.YOUR_title = r.opus_title
      }
    }
    if (++done % 5 === 0) console.log(`  ${done}/${contestedPeople.length} contested candidates opus'd`)
  }

  // Persist opus back to the handoff so downstream steps (finalize-sheet) see it.
  writeFileSync('reference/eval/_draft-rows.json', JSON.stringify({ rows }))

  // FINAL sort: contested first, then remaining flagged, then clean; round-robin disciplines.
  for (const r of rows) r.tier = r.contested ? 0 : (r.flagsN ? 1 : 2)
  const stratified = stratify(rows)
  const cols = ['candidate','role','title','company','desc','discipline','seeded','founding_tag','sonnet_function','sonnet_specialty','sonnet_skills','sonnet_title','rules_function','rules_specialty','opus_function','opus_specialty','opus_skills','opus_title','sources_agree','cohort','YOUR_function','YOUR_specialty','YOUR_skills','YOUR_title','exp_id']
  writeFileSync('reference/eval/labels-draft.csv', [cols.join(',')].concat(stratified.map((r:any)=>cols.map(c=>csv(r[c])).join(','))).join('\n'))

  const opusRows = rows.filter((r:any)=>r.opus_function).length
  console.log(`\nWrote FINAL reference/eval/labels-draft.csv (${rows.length} rows; ${rows.filter((r:any)=>r.contested).length} contested at top, opus filled on ${opusRows} rows).`)

  // SEEDED hard-tech landing report (where Matt's new profiles sit + how they classified).
  const seeded = rows.filter((r:any)=>r.seeded==='Y')
  const seededHT = seeded.filter((r:any)=>HARD_TECH.has(r.discipline))
  console.log(`\nSEEDED landing: ${new Set(seeded.map((r:any)=>r.person_id)).size} candidates / ${seeded.length} roles; ${seededHT.length} roles in a hard-tech discipline.`)
  const byCand = new Map<string, Set<string>>()
  for (const r of seeded) { if(!byCand.has(r.candidate)) byCand.set(r.candidate,new Set()); if(r.discipline!=='unknown') byCand.get(r.candidate)!.add(r.discipline) }
  for (const [cand, ds] of byCand) {
    const disc=[...ds]
    if (disc.some(d=>HARD_TECH.has(d))) console.log(`  [HT] ${cand}: ${disc.join(', ')}`)
  }
  // Find seeded rows' positions in the final sheet (so Matt can jump to them).
  const pos = stratified.map((r:any,i:number)=>({i,r})).filter((x:any)=>x.r.seeded==='Y' && HARD_TECH.has(x.r.discipline)).slice(0,40)
  console.log(`\nHard-tech seeded rows by sheet position (row# after header): ${pos.map((x:any)=>`#${x.i+2} ${x.r.candidate}/${x.r.discipline}`).join('  |  ')}`)
}
main().catch(e=>{console.error('OPUS ERROR:', e); process.exit(1)})
