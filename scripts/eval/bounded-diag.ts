// scripts/eval/bounded-diag.ts
// TIGHTLY BOUNDED diagnostic: Haiku ONLY, <=30 experiences, no Sonnet/Opus, no DB writes,
// no auto-rerun. Halts loudly on any API error (after ONE retry). Prints results to eyeball
// against ground-truth. Candidate pool prioritized for Matt's reviewed cases + discipline spread.
// Run: tsx scripts/eval/bounded-diag.ts
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { buildSystemPrompt, buildUserPrompt } from '../../lib/candidates/classifier/prompt.ts'
import { callClassifier } from '../../lib/candidates/classifier/claude.ts'
import { validateClassification } from '../../lib/candidates/classifier/validate.ts'
import { loadActiveVocab } from '../../lib/candidates/classifier/index.ts'

const HARD_CAP = 30                 // max experiences, hard stop
const HAIKU_IN_PER_M = 1.0, HAIKU_OUT_PER_M = 5.0   // $/M tokens (Haiku 4.5, approx)
// Priority pool: Matt's 3 reviewed cases first (he has ground truth), then discipline spread.
const POOL = ['%mundra%','%pavlo%','%mcmath%','%hui son%','%makai%','%flores preciado%','%jacka%']

async function classifyWithOneRetry(system:string, user:string){
  let last:any = null
  for (let attempt=0; attempt<2; attempt++){
    const call = await callClassifier(system, user)
    if (!call.error) return call
    last = call
    if (attempt===0) console.error(`  (call error, one retry): ${call.error?.slice(0,120)}`)
  }
  throw new Error(`API error after 1 retry — HALTING (no partial writes, no loop): ${last?.error}`)
}

async function main(){
  const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const [k,...v]=l.split('=');return [k.trim(), v.join('=').trim()]}))
  for (const [k,v] of Object.entries(env)) if(!process.env[k]) process.env[k]=v as string
  const prod = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const dev  = createClient(env.NEXT_PUBLIC_SUPABASE_URL_DEV, env.SUPABASE_SERVICE_ROLE_KEY_DEV)
  const vocab = await loadActiveVocab(dev)
  const system = buildSystemPrompt(vocab)

  // Greedily select candidates from the pool until we'd exceed HARD_CAP experiences.
  const selected:any[] = []; let total=0
  for (const pat of POOL){
    if (total >= HARD_CAP) break
    const { data: person } = await prod.from('people').select('person_id, full_name').ilike('full_name', pat).limit(1).maybeSingle()
    if (!person) { console.error(`  (no match for ${pat})`); continue }
    const { data: exps } = await prod.from('person_experiences')
      .select('person_experience_id, title_raw, start_date, end_date, is_current, description_raw, companies:company_id ( company_name )')
      .eq('person_id', person.person_id).order('start_date',{ascending:false})
    const experiences = (exps??[]).map((e:any)=>({person_experience_id:e.person_experience_id,company_name:e.companies?.company_name??null,title_raw:e.title_raw,start_date:e.start_date,end_date:e.end_date,is_current:e.is_current,description_raw:e.description_raw}))
    if (total + experiences.length > HARD_CAP){ console.error(`  (skipping ${person.full_name}: ${experiences.length} exps would exceed cap ${HARD_CAP}, at ${total})`); continue }
    selected.push({ ...person, experiences }); total += experiences.length
  }
  console.log(`Selected ${selected.length} candidates / ${total} experiences (cap ${HARD_CAP}). Haiku only, no writes.\n`)

  let inTok=0, outTok=0
  for (const c of selected){
    const ids = c.experiences.map((e:any)=>e.person_experience_id)
    const call = await classifyWithOneRetry(system, buildUserPrompt(c.experiences))  // throws+halts on API error
    inTok+=call.inputTokens||0; outTok+=call.outputTokens||0
    const valid = validateClassification(call.output, ids, vocab)
    const byId:Record<string,any>={}; for (const t of (valid.tuples||[])) byId[t.exp_id]=t
    console.log(`\n══ ${c.full_name} ${valid.ok?'':'  [VALIDATION FAILED: '+JSON.stringify(valid.errors).slice(0,100)+']'}`)
    for (const e of c.experiences){
      const t = byId[e.person_experience_id]
      const desc=(e.description_raw||'').replace(/\s+/g,' ').slice(0,90)
      console.log(`  • ${e.title_raw} @ ${e.company_name}`)
      console.log(`      desc: ${desc||'(none)'}`)
      if (t) console.log(`      → fn: ${(t.function_inferred||[]).join(', ')}  |  spec: ${(t.specialty_inferred||[]).join(', ')||'—'}  |  skills: ${(t.skills_inferred||[]).join(', ')||'—'}  |  title: ${t.title_normalized_inferred||'—'}`)
      else console.log(`      → (no tuple returned)`)
    }
  }
  const cost = (inTok/1e6)*HAIKU_IN_PER_M + (outTok/1e6)*HAIKU_OUT_PER_M
  console.log(`\n──────\nTokens: ${inTok} in / ${outTok} out across ${selected.length} calls.  Actual cost ≈ $${cost.toFixed(4)}.`)
}
main().catch(e=>{console.error('\nHALTED:', e.message); process.exit(1)})
