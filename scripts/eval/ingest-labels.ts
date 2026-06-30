// scripts/eval/ingest-labels.ts
// Turn Matt's adjudicated review CSV (reference/eval/labels-final.csv) into the frozen
// fixture labels (reference/eval/fixture.json). Maps each row back to its experience
// via (full_name, role#) against the frozen fixture-inputs.json (same stable order).
// Each label is a COUPLED allowed-tuple: {function-primary, specialty-set, skills, title}.
// Run AFTER adjudication: tsx scripts/eval/ingest-labels.ts
import { readFileSync, writeFileSync } from 'node:fs'

function parseCsv(text:string):string[][]{ const rows:string[][]=[]; let f='',row:string[]=[],q=false
  for(let i=0;i<text.length;i++){const c=text[i]
    if(q){ if(c==='"'&&text[i+1]==='"'){f+='"';i++} else if(c==='"'){q=false} else f+=c }
    else { if(c===','){row.push(f);f=''} else if(c==='"'){q=true} else if(c==='\n'){row.push(f);rows.push(row);f='';row=[]} else if(c!=='\r')f+=c } }
  if(f.length||row.length){row.push(f);rows.push(row)} return rows }

const fixture = JSON.parse(readFileSync('reference/eval/fixture-inputs.json','utf8'))
const byName: Record<string, any> = {}
for (const c of fixture.candidates) byName[c.full_name] = c
const rows = parseCsv(readFileSync('reference/eval/labels-final.csv','utf8'))
const hdr = rows[0]; const col = (n:string)=>hdr.indexOf(n)
const list = (s:string)=> (s??'').split(';').map(x=>x.trim()).filter(Boolean)
const labels: Record<string, any> = {}
let mapped=0, missed=0
for (let i=1;i<rows.length;i++){ const r=rows[i]; if(!r[col('candidate')]) continue
  const cand = byName[r[col('candidate')]]; const role = parseInt(r[col('role')],10)
  const exp = cand?.experiences?.[role-1]
  if(!exp){ missed++; continue }
  labels[exp.person_experience_id] = {
    function: list(r[col('YOUR_function')]), specialty: list(r[col('YOUR_specialty')]),
    skills: list(r[col('YOUR_skills')]), title: (r[col('YOUR_title')]??'').trim(),
    cohort: (r[col('cohort')]??'-'),
  }
  mapped++
}
writeFileSync('reference/eval/fixture.json', JSON.stringify({ schema_version:'eval-fixture-v1', frozen_at: fixture.frozen_at, labels }, null, 2))
console.log(`Ingested ${mapped} labels (${missed} unmapped) -> reference/eval/fixture.json`)
