// scripts/eval/pool-run.ts
// Full-corpus POOL run over the remaining eval-fixture candidates (sets.pool — the 67
// candidates in neither tuning nor holdout). Same harness as tuning/holdout (honest
// buckets, production validation-retry, both deterministic guards); fixture-based
// report only, NO DB writes. Runs against the frozen prompt+vocab post-holdout.
// Run: tsx scripts/eval/pool-run.ts
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { buildSystemPrompt, buildUserPrompt, buildRetryNote } from '../../lib/candidates/classifier/prompt.ts'
import { callClassifier } from '../../lib/candidates/classifier/claude.ts'
import { validateClassification } from '../../lib/candidates/classifier/validate.ts'
import { loadActiveVocab } from '../../lib/candidates/classifier/index.ts'
import { enforceRoboticsCarveOutGuard } from '../../lib/candidates/classifier/carve-out-guard.ts'
import { computeCareerFallback } from '../../lib/classification/career-fallback.ts'
import { PROMPT_VERSION, MAX_VALIDATION_RETRIES } from '../../lib/candidates/classifier/config.ts'

const IN_PER_M = 1.0, OUT_PER_M = 5.0

async function callOrHalt(system:string, user:string){
  let last:any=null
  for (let a=0;a<2;a++){ const c=await callClassifier(system,user); if(!c.error) return c; last=c; if(a===0) console.error(`  (API error, one retry): ${c.error?.slice(0,100)}`) }
  throw new Error(`API error after 1 retry — HALTING (no report from failed calls): ${last?.error}`)
}

async function main(){
  const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const [k,...v]=l.split('=');return [k.trim(), v.join('=').trim()]}))
  for (const [k,v] of Object.entries(env)) if(!process.env[k]) process.env[k]=v as string
  const prod = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const dev  = createClient(env.NEXT_PUBLIC_SUPABASE_URL_DEV, env.SUPABASE_SERVICE_ROLE_KEY_DEV)
  const sets = JSON.parse(readFileSync('reference/eval/eval-sets.json','utf8'))
  const tuningIds = new Set<string>(sets.pool)
  const fixture = JSON.parse(readFileSync('reference/eval/fixture-inputs.json','utf8'))
  const draft = JSON.parse(readFileSync('reference/eval/_draft-rows.json','utf8'))
  const ref: Record<string,string> = {}
  for (const r of draft.rows) ref[r.exp_id] = (r.opus_function||r.sonnet_function||'').split(';')[0].trim()
  // candidate context (headline/summary) from prod, keyed by person_id.
  const ctxBy: Record<string,{headline:string|null,summary:string|null}> = {}
  const ids = [...tuningIds]
  for (let i=0;i<ids.length;i+=100){ const {data}=await prod.from('people').select('person_id, headline_raw, summary_raw').in('person_id', ids.slice(i,i+100)); for(const p of (data??[])) ctxBy[p.person_id]={headline:p.headline_raw,summary:p.summary_raw} }

  const vocab = await loadActiveVocab(dev)
  const system = buildSystemPrompt(vocab)
  const cands = fixture.candidates.filter((c:any)=>tuningIds.has(c.person_id) && c.experiences.length>0)
  const counts = { agree:0, disagree:0, both_unknown:0, error:0, no_ref:0 }
  let inTok=0, outTok=0
  const people:any[] = []
  // Out-of-vocab SKILL aggregate (vocab-gap signal): both attempt-0 rejections
  // (model often self-corrects on retry) and final-attempt guard strips.
  const skillGaps = new Map<string, {rejected:number, stripped:number, cands:Set<string>}>()
  const recordGap = (skill:string, kind:'rejected'|'stripped', cand:string) => {
    const g = skillGaps.get(skill) ?? {rejected:0, stripped:0, cands:new Set<string>()}
    g[kind]++; g.cands.add(cand); skillGaps.set(skill, g)
  }
  let n=0
  for (const c of cands){
    n++
    const ctx = ctxBy[c.person_id] || {headline:null,summary:null}
    const ids2 = c.experiences.map((e:any)=>e.person_experience_id)
    // Mirror PRODUCTION: one validation-retry (feed the errors back) before failing.
    const basePrompt = buildUserPrompt(c.experiences, ctx)
    let valid:any = null, valFailed = true
    for (let attempt=0; attempt<=MAX_VALIDATION_RETRIES; attempt++){
      const prompt = attempt===0 ? basePrompt : `${basePrompt}\n\n${buildRetryNote(valid.errors)}`
      const call = await callOrHalt(system, prompt)   // halts on sustained API error
      inTok+=call.inputTokens||0; outTok+=call.outputTokens||0
      valid = validateClassification(call.output, ids2, vocab, { repairParentMismatch: attempt === MAX_VALIDATION_RETRIES, repairUnknownSkills: attempt === MAX_VALIDATION_RETRIES, repairUnknownSpecialties: attempt === MAX_VALIDATION_RETRIES })
      for (const m of (valid.errors as string[])) { const mm = m.match(/: skill "([^"]+)" not in active vocabulary/); if (mm) recordGap(mm[1], 'rejected', c.full_name) }
      if (valid.ok){ valFailed=false; break }
    }
    for (const m of ((valid.repairs ?? []) as string[])) { const mm = m.match(/stripped skill "([^"]+)"/); if (mm) recordGap(mm[1], 'stripped', c.full_name) }
    if (!valFailed && valid.repairs?.length) console.log(`  REPAIRED ${c.full_name}: ${valid.repairs.join(' | ').slice(0, 300)}`)
    // DETERMINISTIC robotics carve-out guard (before inheritance, mirroring the real engine).
    if (!valFailed){
      const guarded = enforceRoboticsCarveOutGuard(valid.tuples, c.experiences.map((e:any)=>({person_experience_id:e.person_experience_id,title_raw:e.title_raw,description_raw:e.description_raw})))
      valid.tuples = guarded.tuples
      for (const r of guarded.repairs) console.log(`  CARVE-OUT-GUARD ${c.full_name}: ${r.note}`)
    }
    const byId: Record<string,any> = {}
    if (!valFailed) for (const t of valid.tuples) byId[t.exp_id]=t
    // DETERMINISTIC career-fallback (code, not LLM) — shown in the report so inheritance
    // behavior is reviewable in the cheap tuning run before a full populate.
    const inherited: Record<string,string[]> = valFailed ? {} : computeCareerFallback(
      valid.tuples.map((t:any)=>{ const e = c.experiences.find((x:any)=>x.person_experience_id===t.exp_id)!; return {
        exp_id: t.exp_id, title_raw: e.title_raw, company_name: e.company_name,
        start_date: e.start_date, end_date: e.end_date, is_current: e.is_current,
        function_inferred: t.function_inferred, specialty_inferred: t.specialty_inferred,
      }}), vocab.specialtyParents)
    const roles = c.experiences.map((e:any)=>{
      const g = byId[e.person_experience_id]
      const haiku = valFailed ? '(validation-failed)' : (g ? (g.function_inferred[0]||'unknown') : '(missing)')
      const spec = g ? (g.specialty_inferred||[]).join(', ') : ''
      const inh = (inherited[e.person_experience_id] ?? []).join(', ')
      const skills = g ? (g.skills_inferred||[]).join(', ') : ''
      const cmp = ref[e.person_experience_id] || ''
      let status:string
      if (haiku.startsWith('(')) status='error'
      else if (!cmp) status='no_ref'
      else if (haiku==='unknown' && cmp==='unknown') status='both_unknown'
      else if (haiku===cmp) status='agree'
      else status='disagree'
      ;(counts as any)[status]++
      return { title:e.title_raw, company:e.company_name, desc:(e.description_raw||'').replace(/\s+/g,' ').slice(0,150), haiku, spec, inh, skills, cmp, status, flag: status==='disagree'||status==='error' }
    })
    people.push({ name:c.full_name, ctx, roles, flags: roles.filter((r:any)=>r.flag).length, repairs: (!valFailed && valid.repairs?.length) ? valid.repairs : [] })
    if(valFailed) console.error(`  VAL-FAIL ${c.full_name}: ${JSON.stringify(valid.errors).slice(0,140)}`)
  }

  const comparable = counts.agree+counts.disagree
  people.sort((a,b)=> b.flags-a.flags || a.name.localeCompare(b.name))
  const L:string[]=[]
  L.push(`# POOL full-corpus run — Haiku (${sets.pool.length} candidates) · prompt ${PROMPT_VERSION}`)
  L.push(``)
  L.push(`Honest tallies (errors + both-unknown NOT counted as agreement):`)
  L.push(`  agree ${counts.agree} · disagree ${counts.disagree} · both-unknown ${counts.both_unknown} · classifier-error ${counts.error} · no-reference ${counts.no_ref}`)
  L.push(`  agreement over COMPARABLE roles (both gave a real label, n=${comparable}): ${comparable?((100*counts.agree/comparable).toFixed(1)+'%'):'n/a'}`)
  L.push(`  ⚠ = disagreement-vs-Opus or classifier-error, sorted to the top. Review these by voice.`)
  L.push(``)
  if (skillGaps.size){
    L.push(`## Out-of-vocab skills encountered (vocab-gap signal — review: real skill to ADD vs junk to keep stripping)`)
    for (const [k, g] of [...skillGaps.entries()].sort((a,b)=> b[1].cands.size - a[1].cands.size || (b[1].rejected+b[1].stripped) - (a[1].rejected+a[1].stripped))){
      L.push(`  - "${k}" — stripped ×${g.stripped} (final attempt) / rejected ×${g.rejected} (attempt 0) — ${g.cands.size} candidate(s): ${[...g.cands].join(', ')}${g.cands.size>1?'   ⚠ MULTI-CANDIDATE':''}`)
    }
    L.push(``)
  }
  for (const p of people){
    L.push(`## ${p.name}${p.flags?`   [${p.flags} to check]`:''}`)
    if (p.ctx.headline) L.push(`   headline: ${String(p.ctx.headline).slice(0,160)}`)
    for (const rep of p.repairs) L.push(`   ⚠ GUARD-REPAIRED: ${rep}`)
    for (const r of p.roles){
      const mark = r.flag ? '⚠' : ' '
      const note = r.status==='disagree' ? `   (ref: ${r.cmp})` : ''
      L.push(`  ${mark} ${r.title} @ ${r.company}`)
      if (r.desc) L.push(`      desc: ${r.desc}`)
      L.push(`      → fn: ${r.haiku}${r.spec?`  spec: ${r.spec}`:''}${r.inh?`  inherited(code): ${r.inh}`:''}${r.skills?`  skills: ${r.skills}`:''}${note}`)
    }
    L.push(``)
  }
  writeFileSync('reference/eval/pool-report.md', L.join('\n'))
  const cost = (inTok/1e6)*IN_PER_M + (outTok/1e6)*OUT_PER_M
  const pctStr = comparable?(100*counts.agree/comparable).toFixed(1):'n/a'
  console.log(`\nWrote reference/eval/pool-report.md — agree ${counts.agree} / disagree ${counts.disagree} / both-unknown ${counts.both_unknown} / error ${counts.error} / no-ref ${counts.no_ref}`)
  console.log(`Comparable agreement: ${pctStr}% (n=${comparable}).  Tokens ${inTok} in / ${outTok} out.  Actual cost ≈ $${cost.toFixed(4)}.`)
  // Trend log — one line per run (multiple runs accumulate so we read range/trend, not a single decimal).
  appendFileSync('reference/eval/pool-run.log', `${new Date().toISOString()} ${PROMPT_VERSION}  comparable=${pctStr}% (n=${comparable})  agree=${counts.agree} disagree=${counts.disagree} both_unknown=${counts.both_unknown} error=${counts.error}  cost=$${cost.toFixed(4)}\n`)
}
main().catch(e=>{console.error('\nHALTED:', e.message); process.exit(1)})
