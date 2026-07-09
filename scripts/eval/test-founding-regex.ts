// scripts/eval/test-founding-regex.ts
// Positive + negative fixture tests for the founding/early-engineer title tag.
// Run: tsx scripts/eval/test-founding-regex.ts  (exits nonzero on any failure)
import { isFoundingEngineerTitle } from '../../lib/scoring/compute-derived.ts'

const SHOULD_MATCH = [
  'Founding Engineer', 'Founding Software Engineer', 'Founding ML Engineer',
  'Founding Backend Engineer', 'First Engineer', 'First Software Engineer',
  'Early Engineer', 'Early Software Engineer', 'Engineer #3', 'Software Engineer #2',
  'Founding Full Stack Engineer', 'First Backend Engineer',
]
const SHOULD_NOT = [
  'Software Engineer', 'Senior Engineer', 'Staff Engineer', 'Founder', 'Co-Founder',
  'Founding Designer', 'Founding Product Manager', 'Engineering Manager',
  'Early Career Engineer', 'VP of Engineering', 'First Round Capital Analyst',
  'First Quality Engineer', 'First Reliability Engineer', 'First Responder',
]

let fails = 0
for (const t of SHOULD_MATCH) if (!isFoundingEngineerTitle(t)) { console.error(`FAIL (should match): ${t}`); fails++ }
for (const t of SHOULD_NOT) if (isFoundingEngineerTitle(t)) { console.error(`FAIL (should NOT match): ${t}`); fails++ }
if (fails) { console.error(`\n${fails} failing case(s).`); process.exit(1) }
console.log(`founding-regex: all ${SHOULD_MATCH.length + SHOULD_NOT.length} cases pass.`)
