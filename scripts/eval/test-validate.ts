// scripts/eval/test-validate.ts
// Fixture tests for the validator's hardening checks (2026-07-08): empty title,
// unknown-mixed-with-real-functions, specialties-on-unknown — strict on attempt 0,
// REJECT-then-REPAIR on the final attempt. Also regression-covers the prior guards.
// Run: tsx scripts/eval/test-validate.ts  (exits nonzero on any failure)
import { validateClassification } from '../../lib/candidates/classifier/validate.ts'
import type { ActiveVocab } from '../../lib/candidates/classifier/types.ts'

const VOCAB: ActiveVocab = {
  functions: ['software_engineering', 'robotics_engineering', 'unknown'],
  specialties: ['backend_engineering', 'autonomy_engineering'],
  skills: ['Python'],
  specialtyParents: { backend_engineering: ['software_engineering'], autonomy_engineering: ['robotics_engineering'] },
  version: 'test',
}
const REPAIR_ALL = { repairParentMismatch: true, repairUnknownSkills: true, repairUnknownSpecialties: true, repairContradictions: true, repairEmptyTitle: true }
const t = (o: any) => ({ exp_id: 'e1', function_inferred: ['software_engineering'], specialty_inferred: [], skills_inferred: [], title_normalized_inferred: 'Software Engineer', ...o })
const run = (tuple: any, opts?: any) => validateClassification({ assignments: [tuple] }, ['e1'], VOCAB, opts)

let fails = 0
const expect = (name: string, cond: boolean) => { if (!cond) { console.error(`FAIL ${name}`); fails++ } }

// Empty title: strict-rejected on attempt 0, tolerated (repair note) on final.
expect('empty title rejected strict', !run(t({ title_normalized_inferred: '' })).ok)
{ const r = run(t({ title_normalized_inferred: '' }), REPAIR_ALL); expect('empty title repaired final', r.ok && r.repairs.length === 1) }

// unknown mixed with real fn: rejected strict; repaired final by dropping unknown.
expect('unknown-mix rejected strict', !run(t({ function_inferred: ['unknown', 'software_engineering'] })).ok)
{ const r = run(t({ function_inferred: ['unknown', 'software_engineering'] }), REPAIR_ALL)
  expect('unknown-mix repaired final', r.ok && JSON.stringify(r.tuples[0].function_inferred) === '["software_engineering"]') }

// specialties on unknown-only fn: rejected strict; repaired final by stripping specs.
expect('spec-on-unknown rejected strict', !run(t({ function_inferred: ['unknown'], specialty_inferred: ['backend_engineering'] })).ok)
{ const r = run(t({ function_inferred: ['unknown'], specialty_inferred: ['backend_engineering'] }), REPAIR_ALL)
  expect('spec-on-unknown repaired final', r.ok && r.tuples[0].specialty_inferred.length === 0) }

// Prior guards still behave: parent mismatch + unknown skill + unknown specialty.
expect('parent mismatch rejected strict', !run(t({ specialty_inferred: ['autonomy_engineering'] })).ok)
{ const r = run(t({ specialty_inferred: ['autonomy_engineering'] }), REPAIR_ALL); expect('parent mismatch stripped final', r.ok && r.tuples[0].specialty_inferred.length === 0) }
expect('unknown skill rejected strict', !run(t({ skills_inferred: ['NotASkill'] })).ok)
{ const r = run(t({ skills_inferred: ['NotASkill'] }), REPAIR_ALL); expect('unknown skill stripped final', r.ok && r.tuples[0].skills_inferred.length === 0) }
expect('unknown specialty rejected strict', !run(t({ specialty_inferred: ['made_up_engineering'] })).ok)
{ const r = run(t({ specialty_inferred: ['made_up_engineering'] }), REPAIR_ALL); expect('unknown specialty stripped final', r.ok && r.tuples[0].specialty_inferred.length === 0) }

// Clean tuple passes both modes; unknown-only with no specs is valid.
expect('clean passes strict', run(t({})).ok)
expect('unknown-only passes strict', run(t({ function_inferred: ['unknown'] })).ok)
// Coverage still enforced under repair mode.
expect('missing exp_id still fails', !validateClassification({ assignments: [] }, ['e1'], VOCAB, REPAIR_ALL).ok)

if (fails) { console.error(`\n${fails} failing case(s).`); process.exit(1) }
console.log('validate: all cases pass.')
