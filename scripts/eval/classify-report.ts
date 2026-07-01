// scripts/eval/classify-report.ts
// Run the REAL classifier (Haiku, pure path — NO DB writes) over every candidate in
// the frozen fixture, and emit a human-readable per-person report. Flags roles where
// Haiku disagrees with the strong reference (Opus if available, else Sonnet) so the
// review focuses there. This is the "run it and let me eyeball it" path — no CSV.
// Run: tsx scripts/eval/classify-report.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { buildSystemPrompt, buildUserPrompt } from '../../lib/candidates/classifier/prompt.ts'
import { callClassifier } from '../../lib/candidates/classifier/claude.ts'
import { validateClassification } from '../../lib/candidates/classifier/validate.ts'
import { loadActiveVocab } from '../../lib/candidates/classifier/index.ts'

async function main(){
  const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const [k,...v]=l.split('=');return [k.trim(), v.join('=').trim()]}))
  for (const [k,v] of Object.entries(env)) if(!process.env[k]) process.env[k]=v as string
  // Vocab from DEV (final taxonomy 085-088). Inputs from the frozen fixture (real prod candidates).
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL_DEV, env.SUPABASE_SERVICE_ROLE_KEY_DEV)
  const fixture = JSON.parse(readFileSync('reference/eval/fixture-inputs.json','utf8'))
  const draft = JSON.parse(readFileSync('reference/eval/_draft-rows.json','utf8'))
  // reference opinions by exp_id (opus preferred, else sonnet) + linkedin per person.
  const ref: Record<string,{opus:string,sonnet:string}> = {}
  const urlBy: Record<string,string> = {}
  for (const r of draft.rows){ ref[r.exp_id]={opus:(r.opus_function||'').split(';')[0].trim(), sonnet:(r.sonnet_function||'').split(';')[0].trim()} }
  // linkedin (draft rows don't carry it if pre-finalize) — pull from prod cheaply.
  const prod = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const pids = fixture.candidates.map((c:any)=>c.person_id)
  for (let i=0;i<pids.length;i+=200){ const {data}=await prod.from('people').select('person_id, linkedin_url').in('person_id',pids.slice(i,i+200)); for(const p of (data??[])) urlBy[p.person_id]=p.linkedin_url||'' }

  const vocab = await loadActiveVocab(sb)
  const system = buildSystemPrompt(vocab)

  const cands = fixture.candidates.filter((c:any)=>c.experiences.length>0)
  const people:any[] = []
  let n=0, flaggedRoles=0, totalRoles=0
  for (const c of cands){
    n++
    const ids = c.experiences.map((e:any)=>e.person_experience_id)
    let got: Record<string,any> = {}
    try {
      const call = await callClassifier(system, buildUserPrompt(c.experiences))
      const valid = validateClassification(call.output, ids, vocab)
      for (const t of valid.tuples) got[t.exp_id]=t
    } catch { /* leave got empty -> rows show (classifier error) */ }
    const roles = c.experiences.map((e:any)=>{
      const g = got[e.person_experience_id]
      const haiku = g ? (g.function_inferred[0]||'unknown') : '(error)'
      const spec = g ? (g.specialty_inferred[0]||'') : ''
      const r = ref[e.person_experience_id] || {opus:'',sonnet:''}
      const cmp = r.opus || r.sonnet     // strong reference
      const src = r.opus ? 'Opus' : (r.sonnet?'Sonnet':'')
      const flag = cmp && haiku!=='(error)' && haiku!==cmp
      totalRoles++; if(flag) flaggedRoles++
      return { title:e.title_raw, company:e.company_name, haiku, spec, cmp, src, flag,
               desc:(e.description_raw||'').replace(/\s+/g,' ').slice(0,160) }
    })
    people.push({ name:c.full_name, url:urlBy[c.person_id]||'', roles, flags: roles.filter((r:any)=>r.flag).length })
    if(n%10===0) console.log(`  classified ${n}/${cands.length}`)
  }

  // Report: flagged people first (most divergences), then the rest.
  people.sort((a,b)=> b.flags-a.flags || a.name.localeCompare(b.name))
  const L:string[] = []
  L.push(`# Classifier review — Haiku over ${cands.length} candidates (${totalRoles} roles)`)
  L.push(``)
  L.push(`${flaggedRoles} roles differ from the strong reference (Opus/Sonnet) — those are marked ⚠ and sorted to the top. Everything else, Haiku agreed with the reference.`)
  L.push(``)
  L.push(`Tell me by voice: "<person>, the <role> should be <X>" for anything wrong. You don't need to touch this file.`)
  L.push(``)
  for (const p of people){
    const handle = p.url ? p.url.replace('https://www.linkedin.com/in/','').replace(/\/$/,'') : 'no-url'
    L.push(`## ${p.name}  ·  ${p.url||'(no linkedin)'}${p.flags?`   [${p.flags} to check]`:''}`)
    for (const r of p.roles){
      const mark = r.flag ? '⚠' : ' '
      const ref = r.flag ? `   (${r.src} said: ${r.cmp})` : ''
      L.push(`  ${mark} ${r.title} @ ${r.company}`)
      L.push(`      → ${r.haiku}${r.spec?` / ${r.spec}`:''}${ref}`)
    }
    L.push(``)
  }
  writeFileSync('reference/eval/classify-report.md', L.join('\n'))
  console.log(`\nWrote reference/eval/classify-report.md — ${flaggedRoles}/${totalRoles} roles flagged for review across ${people.filter(p=>p.flags).length} candidates.`)
}
main().catch(e=>{console.error('REPORT ERROR:', e); process.exit(1)})
