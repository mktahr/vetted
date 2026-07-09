// scripts/eval/test-carve-out-guard.ts
// Fixture tests for the deterministic robotics carve-out guard.
// Run: tsx scripts/eval/test-carve-out-guard.ts  (exits nonzero on any failure)
import { enforceRoboticsCarveOutGuard } from '../../lib/candidates/classifier/carve-out-guard.ts'

let fails = 0
const expect = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g !== w) { console.error(`FAIL ${name}: got ${g}, want ${w}`); fails++ }
}

const tuple = (o: any) => ({ exp_id: o.exp_id, function_inferred: o.fn, specialty_inferred: o.sp, skills_inferred: [], title_normalized_inferred: 'x', ...{} })

// 1. Employer-name leak: bare "Software Engineer", empty description -> rerouted to software.
{
  const { tuples, repairs } = enforceRoboticsCarveOutGuard(
    [tuple({ exp_id: 'a', fn: ['robotics_engineering'], sp: ['robotics_software_engineering'] })],
    [{ person_experience_id: 'a', title_raw: 'Software Engineer', description_raw: '' }])
  expect('leak: fn rerouted', tuples[0].function_inferred, ['software_engineering'])
  expect('leak: specialty stripped', tuples[0].specialty_inferred, [])
  expect('leak: repair logged', repairs.length, 1)
}

// 2. Titled robotics role (Joanne) -> untouched.
{
  const { tuples, repairs } = enforceRoboticsCarveOutGuard(
    [tuple({ exp_id: 'a', fn: ['robotics_engineering'], sp: ['robotics_software_engineering'] })],
    [{ person_experience_id: 'a', title_raw: 'Lead Robotics Software Engineer', description_raw: '' }])
  expect('titled: untouched', tuples[0].function_inferred, ['robotics_engineering'])
  expect('titled: no repairs', repairs.length, 0)
}

// 3. Described robot work with a plain title -> untouched (LLM judged the work).
{
  const { tuples } = enforceRoboticsCarveOutGuard(
    [tuple({ exp_id: 'a', fn: ['robotics_engineering'], sp: ['robotics_software_engineering'] })],
    [{ person_experience_id: 'a', title_raw: 'Software Engineer', description_raw: 'Built motion planning stack for 6-DOF arms' }])
  expect('described: untouched', tuples[0].function_inferred, ['robotics_engineering'])
}

// 4. Sharper robotics specialty (autonomy) never touched, even sparse.
{
  const { tuples, repairs } = enforceRoboticsCarveOutGuard(
    [tuple({ exp_id: 'a', fn: ['robotics_engineering'], sp: ['autonomy_engineering'] })],
    [{ person_experience_id: 'a', title_raw: 'Autonomy Engineer', description_raw: '' }])
  expect('sharper specialty: untouched', tuples[0].specialty_inferred, ['autonomy_engineering'])
  expect('sharper specialty: no repairs', repairs.length, 0)
}

// 5. Dedupe when software already present as secondary.
{
  const { tuples } = enforceRoboticsCarveOutGuard(
    [tuple({ exp_id: 'a', fn: ['robotics_engineering', 'software_engineering'], sp: ['robotics_software_engineering'] })],
    [{ person_experience_id: 'a', title_raw: 'Software Engineer', description_raw: null }])
  expect('dedupe: single software fn', tuples[0].function_inferred, ['software_engineering'])
}

// 6. (Codex regression) Mixed-evidence tuple — robotics_software alongside a sharper
//    robotics specialty — is NEVER rerouted (would orphan the sibling into parent-inconsistency).
{
  const { tuples, repairs } = enforceRoboticsCarveOutGuard(
    [tuple({ exp_id: 'a', fn: ['robotics_engineering'], sp: ['robotics_software_engineering', 'autonomy_engineering'] })],
    [{ person_experience_id: 'a', title_raw: 'Software Engineer', description_raw: '' }])
  expect('mixed evidence: untouched fn', tuples[0].function_inferred, ['robotics_engineering'])
  expect('mixed evidence: untouched specs', tuples[0].specialty_inferred, ['robotics_software_engineering', 'autonomy_engineering'])
  expect('mixed evidence: no repairs', repairs.length, 0)
}

if (fails) { console.error(`\n${fails} failing case(s).`); process.exit(1) }
console.log('carve-out-guard: all cases pass.')
