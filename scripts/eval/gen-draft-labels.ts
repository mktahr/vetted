// scripts/eval/gen-draft-labels.ts
// Generate INDEPENDENT draft labels for blind adjudication. Two sources per
// experience: (A) Sonnet (stronger model, same prompt) and (B) deterministic
// dict-rules (resolveSpecialty). NEITHER is the Haiku classifier being graded.
// Emits a review CSV with YOUR_* columns pre-filled from Sonnet; rows where the two
// sources DISAGREE (the real ambiguity signal) + flagged cohorts sort to the TOP.
// Run: tsx scripts/eval/gen-draft-labels.ts   (spends ~69 Sonnet calls)
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { buildSystemPrompt, buildUserPrompt } from '../../lib/candidates/classifier/prompt.ts'
import { loadActiveVocab } from '../../lib/candidates/classifier/index.ts'
import { loadSpecialtyDictionary, resolveSpecialty } from '../../lib/normalize/specialty.ts'

const SONNET = 'claude-sonnet-4-6'
const snippet = (s:string|null)=> (s??'').replace(/\s+/g,' ').slice(0,140)
const csv = (v:any)=>{ const s=String(v??''); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s }
const arr = (a:any)=> Array.isArray(a)? a.join('; ') : ''

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
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) // PROD read-only
  const fixture = JSON.parse(readFileSync('reference/eval/fixture-inputs.json','utf8'))
  const vocab = await loadActiveVocab(sb)
  await loadSpecialtyDictionary(sb)
  // multi-parent specialty set
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
      const agree = !!sFn && !!rFn && sFn===rFn
      const flags:string[] = []
      if (!agree) flags.push('src_disagree')
      if (multiParent.has(sSpec) || multiParent.has(rSpec)) flags.push('multi_parent')
      if (/\b(manager|director|vp|chief|head|principal|lead)\b/i.test(e.title_raw??'')) flags.push('leadership')
      if ((e.description_raw??'').length < 40) flags.push('sparse')
      rows.push({
        priority: (!agree?0:0) + (flags.length?1:0), agree, flagsN: flags.length,
        candidate:c.full_name, role:idx+1, title:e.title_raw, company:e.company_name, desc:snippet(e.description_raw),
        sonnet_function:arr(s.function_inferred), sonnet_specialty:arr(s.specialty_inferred), sonnet_skills:arr(s.skills_inferred), sonnet_title:s.title_normalized_inferred??'',
        rules_function:rFn, rules_specialty:rSpec, sources_agree:agree?'Y':'N', cohort:flags.join('|')||'-',
        YOUR_function:arr(s.function_inferred), YOUR_specialty:arr(s.specialty_inferred), YOUR_skills:arr(s.skills_inferred), YOUR_title:s.title_normalized_inferred??'',
      })
    })
    if (n%10===0) console.log(`  ${n}/${cands.length} candidates drafted`)
  }
  // Sort: disagreements first, then flagged, then agreements.
  rows.sort((a,b)=> (a.sources_agree===b.sources_agree ? (b.flagsN-a.flagsN) : (a.sources_agree==='N'?-1:1)))
  const cols = ['candidate','role','title','company','desc','sonnet_function','sonnet_specialty','sonnet_skills','sonnet_title','rules_function','rules_specialty','sources_agree','cohort','YOUR_function','YOUR_specialty','YOUR_skills','YOUR_title']
  const out = [cols.join(',')].concat(rows.map(r=>cols.map(c=>csv(r[c])).join(','))).join('\n')
  writeFileSync('reference/eval/labels-draft.csv', out)
  const dis = rows.filter(r=>r.sources_agree==='N').length
  console.log(`Wrote ${rows.length} rows -> reference/eval/labels-draft.csv (${dis} source-disagreements at top, ${rows.length-dis} agreements)`)
}
main().catch(e=>{console.error('GEN ERROR:', e); process.exit(1)})
