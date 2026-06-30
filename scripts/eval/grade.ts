// scripts/eval/grade.ts
// Grade the Haiku classifier against the frozen, independently-adjudicated fixture.
// Runs the classifier's PURE path (prompt -> Haiku -> validate) over the frozen
// inputs (no DB lifecycle, no commit) and compares to the labels. Imports ONLY the
// vocab loader + prompt/validate — never the classifier's repair/normalization beyond
// what production uses. Metrics are defined here, before running.
// Run AFTER ingest-labels: tsx scripts/eval/grade.ts
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { buildSystemPrompt, buildUserPrompt } from '../../lib/candidates/classifier/prompt.ts'
import { callClassifier } from '../../lib/candidates/classifier/claude.ts'
import { validateClassification } from '../../lib/candidates/classifier/validate.ts'
import { loadActiveVocab } from '../../lib/candidates/classifier/index.ts'

const eq = (a:string[],b:string[])=> a.length===b.length && [...a].sort().join('|')===[...b].sort().join('|')
const overlap = (got:string[], want:string[])=> want.length===0?1:want.filter(w=>got.includes(w)).length/want.length

async function main(){
  const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const [k,...v]=l.split('=');return [k.trim(), v.join('=').trim()]}))
  for (const [k,v] of Object.entries(env)) if(!process.env[k]) process.env[k]=v as string
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const fixture = JSON.parse(readFileSync('reference/eval/fixture-inputs.json','utf8'))
  const labels = JSON.parse(readFileSync('reference/eval/fixture.json','utf8')).labels
  const vocab = await loadActiveVocab(sb)
  const system = buildSystemPrompt(vocab)

  type M = { n:number; fnPrimary:number; fnSet:number; specPrimary:number; specOverlap:number; titleExact:number; invalid:number }
  const blank = ():M => ({n:0,fnPrimary:0,fnSet:0,specPrimary:0,specOverlap:0,titleExact:0,invalid:0})
  const overall = blank(); const byCohort: Record<string,M> = {}
  const cands = fixture.candidates.filter((c:any)=>c.experiences.length>0 && c.experiences.some((e:any)=>labels[e.person_experience_id]))
  let n=0
  for (const c of cands){
    n++
    const ids = c.experiences.map((e:any)=>e.person_experience_id)
    const call = await callClassifier(system, buildUserPrompt(c.experiences))
    const valid = validateClassification(call.output, ids, vocab)
    const got: Record<string,any> = {}
    for (const t of valid.tuples) got[t.exp_id]=t
    for (const e of c.experiences){
      const lab = labels[e.person_experience_id]; if(!lab) continue
      const coh = lab.cohort || '-'
      const m = (byCohort[coh] ??= blank())
      const g = got[e.person_experience_id]
      for (const bucket of [overall, m]){ bucket.n++; if(!g||!valid.ok) bucket.invalid++ }
      if(!g) continue
      const fnP = (g.function_inferred[0]||'')===(lab.function[0]||'')
      const fnS = eq(g.function_inferred, lab.function)
      const spP = (lab.specialty.length===0) || ((g.specialty_inferred[0]||'')===(lab.specialty[0]||''))
      const spO = overlap(g.specialty_inferred, lab.specialty)
      const ti = (g.title_normalized_inferred||'').toLowerCase().trim()===(lab.title||'').toLowerCase().trim()
      for (const bucket of [overall, m]){ if(fnP)bucket.fnPrimary++; if(fnS)bucket.fnSet++; if(spP)bucket.specPrimary++; bucket.specOverlap+=spO; if(ti)bucket.titleExact++ }
    }
    if(n%10===0) console.log(`  graded ${n}/${cands.length}`)
  }
  const pct = (x:number,d:number)=> d?((100*x/d).toFixed(1)+'%'):'-'
  const fmt = (label:string,m:M)=> `${label.padEnd(16)} n=${String(m.n).padStart(4)}  fn_primary=${pct(m.fnPrimary,m.n)}  fn_set=${pct(m.fnSet,m.n)}  spec_primary=${pct(m.specPrimary,m.n)}  spec_overlap=${pct(m.specOverlap,m.n)}  title_exact=${pct(m.titleExact,m.n)}  invalid=${pct(m.invalid,m.n)}`
  const lines = ['', `=== classifier eval ${new Date().toISOString()} (model in config, prompt_version in config) ===`, fmt('OVERALL', overall), ...Object.entries(byCohort).sort().map(([k,m])=>fmt(k,m))]
  const report = lines.join('\n')
  console.log(report)
  appendFileSync('reference/eval/results.log', report+'\n')
  writeFileSync('reference/eval/results-latest.txt', report+'\n')
}
main().catch(e=>{console.error('GRADE ERROR:', e); process.exit(1)})
