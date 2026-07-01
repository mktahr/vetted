// scripts/eval/finalize-sheet.ts
// Post-process the draft rows into two human-friendly files:
//   1. labels-review.csv  — ONLY the ~59 rows that need human judgment (contested),
//      grouped by candidate, WITH linkedin_url. This is the file to actually edit.
//   2. labels-full.csv     — all 996 rows (linkedin_url added), for reference/spot-check.
// The non-contested rows (independent sources agree) are auto-accepted as ground truth.
// Run: tsx scripts/eval/finalize-sheet.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { csvCell as csv, stratify } from './_shared.ts'

async function main() {
  const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const [k,...v]=l.split('=');return [k.trim(), v.join('=').trim()]}))
  const prod = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) // read-only
  const { rows } = JSON.parse(readFileSync('reference/eval/_draft-rows.json','utf8'))

  // linkedin_url per person_id (batch).
  const ids = [...new Set(rows.map((r:any)=>r.person_id))]
  const urlBy: Record<string,string> = {}
  for (let i=0;i<ids.length;i+=200) {
    const { data } = await prod.from('people').select('person_id, linkedin_url').in('person_id', ids.slice(i,i+200))
    for (const p of (data??[])) urlBy[p.person_id] = p.linkedin_url ?? ''
  }
  for (const r of rows) r.linkedin_url = urlBy[r.person_id] ?? ''

  // FULL reference sheet (linkedin added), contested-first.
  for (const r of rows) r.tier = r.contested ? 0 : (r.flagsN ? 1 : 2)
  const fullCols = ['candidate','linkedin_url','role','title','company','desc','discipline','seeded','founding_tag','sonnet_function','sonnet_specialty','opus_function','opus_specialty','rules_function','sources_agree','cohort','YOUR_function','YOUR_specialty','YOUR_skills','YOUR_title','exp_id']
  writeFileSync('reference/eval/labels-full.csv', [fullCols.join(',')].concat(stratify(rows).map((r:any)=>fullCols.map(c=>csv(r[c])).join(','))).join('\n'))

  // REVIEW sheet: contested rows only, grouped by candidate (so you look up each person once).
  const contested = rows.filter((r:any)=>r.contested).sort((a:any,b:any)=> a.candidate.localeCompare(b.candidate) || a.role-b.role)
  const revCols = ['candidate','linkedin_url','title','company','desc','sonnet_function','sonnet_specialty','opus_function','opus_specialty','rules_function','YOUR_function','YOUR_specialty','YOUR_skills','YOUR_title','exp_id']
  writeFileSync('reference/eval/labels-review.csv', [revCols.join(',')].concat(contested.map((r:any)=>revCols.map(c=>csv(r[c])).join(','))).join('\n'))

  console.log(`labels-review.csv  -> ${contested.length} contested rows across ${new Set(contested.map((r:any)=>r.person_id)).size} candidates (THIS is the file to edit)`)
  console.log(`labels-full.csv    -> ${rows.length} rows (reference / spot-check only)`)
  console.log(`linkedin_url filled on ${rows.filter((r:any)=>r.linkedin_url).length}/${rows.length} rows`)
}
main().catch(e=>{console.error('FINALIZE ERROR:', e); process.exit(1)})
