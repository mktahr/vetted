// scripts/eval/test-career-fallback.ts
// Fixture tests for the deterministic career-fallback inheritance layer.
// Run: tsx scripts/eval/test-career-fallback.ts  (exits nonzero on any failure)
import { computeCareerFallback, type RoleForFallback } from '../../lib/classification/career-fallback.ts'

const PARENTS: Record<string, string[]> = {
  fullstack_engineering: ['software_engineering'],
  backend_engineering: ['software_engineering'],
  devops_engineering: ['software_engineering'],
  distributed_systems_engineering: ['software_engineering'],
  autonomy_engineering: ['robotics_engineering'],
  motor_control_engineering: ['electrical_engineering', 'controls_engineering'],
  embedded_engineering: ['firmware_engineering'],
}

const role = (o: Partial<RoleForFallback> & { exp_id: string }): RoleForFallback => ({
  title_raw: 'Software Engineer', company_name: null, start_date: '2020-01-01', end_date: null,
  is_current: false, function_inferred: ['software_engineering'], specialty_inferred: [], ...o,
})

let fails = 0
const expect = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g !== w) { console.error(`FAIL ${name}: got ${g}, want ${w}`); fails++ }
}

// 1. Michael: sparse current role inherits [fullstack, backend] — fullstack first via primary-position tiebreak.
{
  const r = computeCareerFallback([
    role({ exp_id: 'cur', title_raw: 'Member of Technical Staff', start_date: '2022-01-01', is_current: true }),
    role({ exp_id: 'a', start_date: '2020-01-01', end_date: '2021-12-31', specialty_inferred: ['fullstack_engineering', 'backend_engineering'] }),
    role({ exp_id: 'b', start_date: '2018-01-01', end_date: '2019-12-31', specialty_inferred: ['fullstack_engineering', 'backend_engineering', 'devops_engineering'] }),
  ], PARENTS)
  expect('michael inherits fullstack-first', r['cur'], ['fullstack_engineering', 'backend_engineering'])
}

// 2. Forward-only: the EARLIEST sparse role must NOT inherit from later roles.
{
  const r = computeCareerFallback([
    role({ exp_id: 'first-job', start_date: '2012-01-01', end_date: '2014-01-01' }),
    role({ exp_id: 'later1', start_date: '2016-01-01', end_date: '2019-01-01', specialty_inferred: ['backend_engineering', 'distributed_systems_engineering'] }),
    role({ exp_id: 'later2', start_date: '2019-02-01', end_date: '2022-01-01', specialty_inferred: ['backend_engineering', 'distributed_systems_engineering'] }),
    role({ exp_id: 'recent-sparse', start_date: '2022-02-01', is_current: true }),
  ], PARENTS)
  expect('earliest role inherits nothing', r['first-job'], undefined)
  expect('recent sparse role inherits from earlier career', r['recent-sparse'], ['backend_engineering', 'distributed_systems_engineering'])
}

// 3. Parent-consistency: a software target never inherits an EE/robotics specialty (career pivot).
{
  const r = computeCareerFallback([
    role({ exp_id: 'sw', start_date: '2022-01-01', is_current: true }),
    role({ exp_id: 'ee1', title_raw: 'Electrical Engineer', start_date: '2016-01-01', end_date: '2018-01-01', function_inferred: ['electrical_engineering'], specialty_inferred: ['motor_control_engineering'] }),
    role({ exp_id: 'ee2', title_raw: 'Electrical Engineer', start_date: '2018-02-01', end_date: '2021-12-31', function_inferred: ['electrical_engineering'], specialty_inferred: ['motor_control_engineering'] }),
  ], PARENTS)
  expect('pivot: no cross-discipline inheritance', r['sw'], undefined)
}

// 4. Internship sources are excluded (Aadhya: autonomy internship must not feed her current SWE role).
{
  const r = computeCareerFallback([
    role({ exp_id: 'cur', title_raw: 'Mission Software Engineer', start_date: '2024-01-01', is_current: true }),
    role({ exp_id: 'intern', title_raw: 'Autonomy Engineer Intern', start_date: '2023-01-01', end_date: '2023-08-01', function_inferred: ['robotics_engineering'], specialty_inferred: ['autonomy_engineering'] }),
  ], PARENTS)
  expect('internship never a source', r['cur'], undefined)
}

// 5. Internship/student TARGETS never inherit.
{
  const r = computeCareerFallback([
    role({ exp_id: 'int', title_raw: 'Software Engineer Intern', start_date: '2021-06-01', end_date: '2021-09-01' }),
    role({ exp_id: 'a', start_date: '2019-01-01', end_date: '2021-05-01', specialty_inferred: ['backend_engineering'] }),
    role({ exp_id: 'b', start_date: '2017-01-01', end_date: '2018-12-31', specialty_inferred: ['backend_engineering'] }),
  ], PARENTS)
  expect('intern target inherits nothing', r['int'], undefined)
}

// 6. Disjoint specialties across 2+ sources (no stable pattern) inherit nothing; single source inherits.
{
  const r = computeCareerFallback([
    role({ exp_id: 'cur', start_date: '2023-01-01', is_current: true }),
    role({ exp_id: 'a', start_date: '2020-01-01', end_date: '2021-01-01', specialty_inferred: ['fullstack_engineering'] }),
    role({ exp_id: 'b', start_date: '2021-02-01', end_date: '2022-12-31', specialty_inferred: ['devops_engineering'] }),
  ], PARENTS)
  expect('disjoint sources: nothing stable to inherit', r['cur'], undefined)
  const r2 = computeCareerFallback([
    role({ exp_id: 'cur', start_date: '2023-01-01', is_current: true }),
    role({ exp_id: 'a', start_date: '2020-01-01', end_date: '2022-12-31', specialty_inferred: ['backend_engineering'] }),
  ], PARENTS)
  expect('lone source inherits', r2['cur'], ['backend_engineering'])
}

// 7. Leadership target: conservative — recent source's PRIMARY only, single value.
{
  const r = computeCareerFallback([
    role({ exp_id: 'mgr', title_raw: 'Engineering Manager', start_date: '2023-01-01', is_current: true }),
    role({ exp_id: 'a', start_date: '2018-01-01', end_date: '2020-01-01', specialty_inferred: ['backend_engineering', 'devops_engineering'] }),
    role({ exp_id: 'b', start_date: '2020-02-01', end_date: '2022-12-31', specialty_inferred: ['backend_engineering', 'distributed_systems_engineering'] }),
  ], PARENTS)
  expect('leadership: recent primary only', r['mgr'], ['backend_engineering'])
}

// 8. Duplicate-ingest defense: the same source row twice counts ONCE (no fake >=2 dominance).
{
  const dup = { exp_id: 'a', title_raw: 'Software Engineer', company_name: 'Acme', start_date: '2020-01-01', end_date: '2021-01-01' }
  const r = computeCareerFallback([
    role({ exp_id: 'cur', start_date: '2023-01-01', is_current: true }),
    role({ ...dup, specialty_inferred: ['fullstack_engineering'] }),
    role({ ...dup, exp_id: 'a2', specialty_inferred: ['fullstack_engineering'] }),
  ], PARENTS)
  // Deduped to ONE source -> lone-source rule applies -> still inherits, but via count 1, not fake 2.
  expect('dup rows dedupe to one source', r['cur'], ['fullstack_engineering'])
}

// 9. Evidenced target never inherits; unknown-function target never inherits.
{
  const r = computeCareerFallback([
    role({ exp_id: 'ev', start_date: '2022-01-01', specialty_inferred: ['devops_engineering'] }),
    role({ exp_id: 'unk', title_raw: 'Technical Researcher', start_date: '2022-01-01', function_inferred: ['unknown'] }),
    role({ exp_id: 'a', start_date: '2019-01-01', end_date: '2020-01-01', specialty_inferred: ['backend_engineering'] }),
    role({ exp_id: 'b', start_date: '2020-02-01', end_date: '2021-12-31', specialty_inferred: ['backend_engineering'] }),
  ], PARENTS)
  expect('evidenced target untouched', r['ev'], undefined)
  expect('unknown-function target untouched', r['unk'], undefined)
}

// 10. (Codex regression) Undated non-current target NEVER inherits — chronology unknown;
//     undated CURRENT target still inherits ("now" is after every dated source).
{
  const r = computeCareerFallback([
    role({ exp_id: 'undated', start_date: null, end_date: null, is_current: false }),
    role({ exp_id: 'undated-cur', start_date: null, end_date: null, is_current: true }),
    role({ exp_id: 'a', start_date: '2019-01-01', end_date: '2020-01-01', specialty_inferred: ['backend_engineering'] }),
    role({ exp_id: 'b', start_date: '2020-02-01', end_date: '2021-12-31', specialty_inferred: ['backend_engineering'] }),
  ], PARENTS)
  expect('undated non-current: never inherits', r['undated'], undefined)
  expect('undated current: inherits', r['undated-cur'], ['backend_engineering'])
}

// 11. (Codex regression) Start-only target: inherits only from sources that began before it started.
{
  const r = computeCareerFallback([
    role({ exp_id: 'startonly', start_date: '2019-06-01', end_date: null, is_current: false }),
    role({ exp_id: 'early', start_date: '2017-01-01', end_date: '2019-01-01', specialty_inferred: ['backend_engineering'] }),
    role({ exp_id: 'late', start_date: '2021-01-01', end_date: '2022-01-01', specialty_inferred: ['devops_engineering'] }),
  ], PARENTS)
  expect('start-only target: earlier source only', r['startonly'], ['backend_engineering'])
}

if (fails) { console.error(`\n${fails} failing case(s).`); process.exit(1) }
console.log('career-fallback: all cases pass.')
