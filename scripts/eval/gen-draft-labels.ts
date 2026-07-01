// scripts/eval/gen-draft-labels.ts
// Generate INDEPENDENT draft labels for blind adjudication. Two sources per
// experience: (A) Sonnet (stronger model, same prompt) and (B) deterministic
// dict-rules (resolveSpecialty). NEITHER is the Haiku classifier being graded.
// Writes a structured handoff (_draft-rows.json) for the Opus contested pass +
// a preliminary CSV. Sorted so genuine conflicts + flagged cohorts float to the top.
// Run: tsx scripts/eval/gen-draft-labels.ts   (spends ~1 Sonnet call per candidate)
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { buildSystemPrompt, buildUserPrompt } from '../../lib/candidates/classifier/prompt.ts'
import { loadActiveVocab } from '../../lib/candidates/classifier/index.ts'
import { loadSpecialtyDictionary, resolveSpecialty } from '../../lib/normalize/specialty.ts'
import { isFoundingEngineerTitle } from '../../lib/scoring/compute-derived.ts'
import { csvCell as csv, arrJoin as arr, stratify } from './_shared.ts'

const SONNET = 'claude-sonnet-4-6'
const snippet = (s:string|null)=> (s??'').replace(/\s+/g,' ').slice(0,140)

// Hard-tech disciplines = the coverage Matt just seeded; used for the landing report.
const HARD_TECH = new Set(['electrical_engineering','mechanical_engineering','hardware_engineering','materials_engineering','manufacturing_engineering','robotics_engineering','firmware_engineering','optics_engineering','aerospace_engineering','chip_engineering','controls_engineering','systems_engineering','test_engineering'])

async function sonnet(apiKey:string, system:string, user:string): Promise<any> {
  const r = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:SONNET,max_tokens:4096,temperature:0,system,messages:[{role:'user',content:user}]})})
  if(!r.ok){ console.error('sonnet',r.status, (await r.text()).slice(0,200)); return null }
  const d = await r.json(); const t = d?.content?.[0]?.text ?? ''
  const f = t.replace(/```(?:json)?/gi,'').trim()
  try { return JSON.parse(f) } catch {}
  const i=t.indexOf('{'), j=t.lastIndexOf('}'); try { return JSON.parse(t.slice(i,j+1)) } catch { return null }
}

async function main() {
  const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const [k,...v]=l.split('=');return [k.trim(), v.join('=').trim()]}))
  for (const [k,v] of Object.entries(env)) if(!process.env[k]) process.env[k]=v as string
  // Vocab + specialty dict from DEV (final taxonomy: 085/086/087/088 are dev-only until
  // merge). Candidate INPUTS are the frozen fixture (read from prod at freeze) — no prod read.
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL_DEV, env.SUPABASE_SERVICE_ROLE_KEY_DEV)
  const fixture = JSON.parse(readFileSync('reference/eval/fixture-inputs.json','utf8'))
  const seededIds = new Set<string>((JSON.parse(readFileSync('reference/eval/_seeded-ids.json','utf8')) ?? []) as string[])
  const vocab = await loadActiveVocab(sb)
  await loadSpecialtyDictionary(sb)
  const { data: specRows } = await sb.from('specialty_dictionary').select('specialty_normalized, parent_function').eq('active', true)
  const multiParent = new Set((specRows??[]).filter((r:any)=>Array.isArray(r.parent_function)&&r.parent_function.length>1).map((r:any)=>r.specialty_normalized))
  const system = buildSystemPrompt(vocab)

  const rows:any[] = []
  const cands = fixture.candidates.filter((c:any)=>c.experiences.length>0)
  let n=0
  for (const c of cands) {
    n++
    const out = await sonnet(env.ANTHROPIC_API_KEY, system, buildUserPrompt(c.experiences))
    const byId: Record<string, any> = {}
    for (const a of (out?.assignments ?? [])) byId[a.exp_id] = a
    c.experiences.forEach((e:any, idx:number)=>{
      const s = byId[e.person_experience_id] ?? {}
      const sFn = Array.isArray(s.function_inferred)? s.function_inferred[0] : ''
      const sSpec = Array.isArray(s.specialty_inferred)? s.specialty_inferred[0] : ''
      const rule = resolveSpecialty(e.title_raw, e.description_raw, null, [] as any)
      const rFn = rule?.function_normalized ?? ''
      const rSpec = rule?.specialty_normalized ?? ''
      const bothFired = !!sFn && !!rFn
      const agree = bothFired && sFn===rFn
      const genuineConflict = bothFired && sFn!==rFn
      // engineer-titled but Sonnet abstained -> a CONTESTED row for the Opus pass.
      const engTitledUnknown = (!sFn || sFn==='unknown') && /engineer|developer|swe|sde|architect|scientist/i.test(e.title_raw??'') && !/intern|manager|recruit|sales|analyst|support|audio|curriculum|content/i.test(e.title_raw??'')
      const flags:string[] = []
      if (genuineConflict) flags.push('genuine_conflict')
      if (multiParent.has(sSpec) || multiParent.has(rSpec)) flags.push('multi_parent')
      if (/\b(manager|director|vp|chief|head|principal|lead)\b/i.test(e.title_raw??'')) flags.push('leadership')
      if ((e.description_raw??'').length < 40) flags.push('sparse')
      const discipline = sFn || rFn || 'unknown'
      const tier = genuineConflict ? 0 : (flags.length ? 1 : 2)
      rows.push({
        tier, discipline, flagsN: flags.length, contested: (genuineConflict || engTitledUnknown),
        exp_id: e.person_experience_id, person_id: c.person_id, seeded: seededIds.has(c.person_id)?'Y':'',
        candidate:c.full_name, role:idx+1, title:e.title_raw, company:e.company_name, desc:snippet(e.description_raw),
        sonnet_function:arr(s.function_inferred), sonnet_specialty:arr(s.specialty_inferred), sonnet_skills:arr(s.skills_inferred), sonnet_title:s.title_normalized_inferred??'',
        rules_function:rFn, rules_specialty:rSpec,
        opus_function:'', opus_specialty:'', opus_skills:'', opus_title:'',
        founding_tag: isFoundingEngineerTitle(e.title_raw)?'Y':'',
        sources_agree: agree?'Y':(genuineConflict?'N':'-'), cohort:flags.join('|')||'-',
        YOUR_function:arr(s.function_inferred), YOUR_specialty:arr(s.specialty_inferred), YOUR_skills:arr(s.skills_inferred), YOUR_title:s.title_normalized_inferred??'',
      })
    })
    if (n%10===0) console.log(`  ${n}/${cands.length} candidates drafted`)
  }

  // Structured handoff for the Opus contested pass (no CSV re-parse).
  writeFileSync('reference/eval/_draft-rows.json', JSON.stringify({ rows }))
  writePrelimCsv(rows)

  const conflicts = rows.filter(r=>r.tier===0).length
  const contestedN = rows.filter(r=>r.contested).length
  console.log(`\nWrote ${rows.length} rows -> _draft-rows.json + preliminary labels-draft.csv`)
  console.log(`Tiers: ${conflicts} genuine-conflict, ${rows.filter(r=>r.tier===1).length} flagged, ${rows.filter(r=>r.tier===2).length} clean.`)
  console.log(`Contested rows for Opus (genuine-conflict + engineer-titled-unknown): ${contestedN} across ${new Set(rows.filter(r=>r.contested).map(r=>r.person_id)).size} candidates.`)

  console.log(`\nCoverage (discipline: total | conflict / multi_parent / leadership / sparse):`)
  for (const d of [...new Set(rows.map(r=>r.discipline))].sort()) {
    const rs = rows.filter(r=>r.discipline===d)
    console.log(`  ${d.padEnd(26)} ${String(rs.length).padStart(3)} | ${rs.filter(r=>r.tier===0).length} / ${rs.filter(r=>r.cohort.includes('multi_parent')).length} / ${rs.filter(r=>r.cohort.includes('leadership')).length} / ${rs.filter(r=>r.cohort.includes('sparse')).length}`)
  }

  // SEEDED hard-tech landing: did Matt's new profiles classify sensibly?
  const seededRows = rows.filter(r=>r.seeded==='Y')
  const seededHT = seededRows.filter(r=>HARD_TECH.has(r.discipline))
  console.log(`\nSEEDED profiles: ${new Set(seededRows.map(r=>r.person_id)).size} candidates / ${seededRows.length} roles; ${seededHT.length} roles landed in a hard-tech discipline.`)
  const byCand = new Map<string, any[]>()
  for (const r of seededRows) { if(!byCand.has(r.candidate)) byCand.set(r.candidate,[]); byCand.get(r.candidate)!.push(r) }
  for (const [cand, rs] of byCand) {
    const disc = [...new Set(rs.map(r=>r.discipline))].filter(d=>d!=='unknown')
    if (disc.some(d=>HARD_TECH.has(d))) console.log(`  [HT] ${cand}: ${disc.join(', ')}`)
  }
}

function writePrelimCsv(rows:any[]) {
  const stratified = stratify(rows)
  const cols = ['candidate','role','title','company','desc','discipline','seeded','founding_tag','sonnet_function','sonnet_specialty','sonnet_skills','sonnet_title','rules_function','rules_specialty','sources_agree','cohort','YOUR_function','YOUR_specialty','YOUR_skills','YOUR_title','exp_id']
  writeFileSync('reference/eval/labels-draft.csv', [cols.join(',')].concat(stratified.map(r=>cols.map(c=>csv(r[c])).join(','))).join('\n'))
}

main().catch(e=>{console.error('GEN ERROR:', e); process.exit(1)})
