// scripts/eval/freeze-fixture.ts
// Freeze the real candidate pool's experiences into an IMMUTABLE eval input set
// (read-only from PROD). The grader + label drafts work off this frozen snapshot so
// upstream mapper changes can't silently alter the test. Run: tsx scripts/eval/freeze-fixture.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const [k,...v]=l.split('=');return [k.trim(), v.join('=').trim()]}))
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) // PROD, read-only
  // Candidate pool only (record_kind candidate|both).
  const { data: people, error: pErr } = await sb.from('people').select('person_id, full_name, record_kind').in('record_kind', ['candidate','both']).order('created_at',{ascending:true})
  if (pErr) throw pErr
  const ids = (people??[]).map((p:any)=>p.person_id)
  const { data: exps, error: eErr } = await sb.from('person_experiences')
    .select('person_experience_id, person_id, title_raw, start_date, end_date, is_current, description_raw, companies:company_id ( company_name )')
    .in('person_id', ids)
  if (eErr) throw eErr
  const byPerson: Record<string, any[]> = {}
  for (const e of (exps??[]) as any[]) (byPerson[e.person_id] ??= []).push({
    person_experience_id: e.person_experience_id, company_name: e.companies?.company_name ?? null,
    title_raw: e.title_raw, start_date: e.start_date, end_date: e.end_date, is_current: e.is_current, description_raw: e.description_raw,
  })
  const fixture = {
    schema_version: 'eval-fixture-v1', frozen_at: new Date().toISOString(),
    candidates: (people??[]).map((p:any)=>({ person_id:p.person_id, full_name:p.full_name, record_kind:p.record_kind, experiences: (byPerson[p.person_id]??[]).sort((a,b)=>(b.start_date??'').localeCompare(a.start_date??'')) })),
  }
  const withExp = fixture.candidates.filter(c=>c.experiences.length>0)
  writeFileSync('reference/eval/fixture-inputs.json', JSON.stringify(fixture, null, 2))
  console.log(`Froze ${fixture.candidates.length} candidates (${withExp.length} with experiences, ${withExp.reduce((n,c)=>n+c.experiences.length,0)} experiences) -> reference/eval/fixture-inputs.json`)
}
main().catch(e=>{console.error('FREEZE ERROR:', e); process.exit(1)})
