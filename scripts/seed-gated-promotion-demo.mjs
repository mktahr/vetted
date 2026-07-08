// scripts/seed-gated-promotion-demo.mjs
//
// Self-contained TEST FIXTURE for Network Connections gated promotion (PR #15).
// Seeds a tagged demo (2 orgs) so the Pool column / Auto-promote / manual override
// / N:1 demote guard / cross-org view can all be exercised on the live preview.
//
// All rows are tagged under two ZZ_TEST orgs with fixed UUIDs; projected people are
// record_kind='network_connection' (NOT in the candidate pool until promoted).
//
//   node scripts/seed-gated-promotion-demo.mjs            # seed (idempotent upserts)
//   node scripts/seed-gated-promotion-demo.mjs --cleanup  # remove everything it created
//
// Targets the PROD Supabase (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf-8').split('\n').filter((l) => l.includes('=')).map((l) => {
    const [k, ...v] = l.split('=');
    return [k.trim(), v.join('=').trim()];
  }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ── Real prod companies (verified present) ──────────────────────────────────
const OPENAI = '00d564f1-d38e-45a1-aa74-7c08c7f96948';     // vetted, score 4
const ANDURIL = '351cd9fa-490e-4240-92a6-db0e4a7c2617';    // vetted, score 4
const ANTHROPIC = 'dfed7e16-aeea-43f1-a401-0df7c9f62447';  // unreviewed (NOT vetted), score 5
const YEAR = 2024;

// ── Fixed fixture UUIDs (so --cleanup is deterministic) ──────────────────────
const ORG_A = 'dd000000-0000-0000-0000-00000000a000';
const ORG_B = 'dd000000-0000-0000-0000-00000000b000';
const EMP_ALICE = 'dd000000-0000-0000-0000-00000000a001';
const EMP_BOB = 'dd000000-0000-0000-0000-00000000a002';
const EMP_CAROL = 'dd000000-0000-0000-0000-00000000b001';
const P_GRACE = 'dd000000-0000-0000-0000-00000000c001';
const P_ALAN = 'dd000000-0000-0000-0000-00000000c002';
const P_KATH = 'dd000000-0000-0000-0000-00000000c003';
const C1 = 'dd000000-0000-0000-0000-0000000c0001';
const C2 = 'dd000000-0000-0000-0000-0000000c0002';
const C3 = 'dd000000-0000-0000-0000-0000000c0003';
const C4 = 'dd000000-0000-0000-0000-0000000c0004';
const C5 = 'dd000000-0000-0000-0000-0000000c0005';

const ORG_IDS = [ORG_A, ORG_B];
const PERSON_IDS = [P_GRACE, P_ALAN, P_KATH];

const cleanup = process.argv.includes('--cleanup');

function die(label, error) {
  if (error) { console.error(`✗ ${label}:`, error.message); process.exit(1); }
}

async function doCleanup() {
  // Deleting the orgs cascades employees + connections + connection_owners.
  // Deleting the people cascades their experiences + bucket assignments.
  // (connections.person_id is ON DELETE SET NULL, but the connections are already
  //  gone via the org cascade.)
  const { error: e1 } = await supabase.from('organizations').delete().in('org_id', ORG_IDS);
  die('delete organizations', e1);
  const { error: e2 } = await supabase.from('people').delete().in('person_id', PERSON_IDS);
  die('delete people', e2);
  console.log('✓ Cleanup complete — fixture removed.');
}

async function seed() {
  // 1. Orgs
  die('orgs', (await supabase.from('organizations').upsert([
    { org_id: ORG_A, name: 'ZZ_TEST — Gated Promo (Org A)' },
    { org_id: ORG_B, name: 'ZZ_TEST — Gated Promo (Org B)' },
  ], { onConflict: 'org_id' })).error);

  // 2. Employees
  die('employees', (await supabase.from('employees').upsert([
    { employee_id: EMP_ALICE, org_id: ORG_A, full_name: 'Alice Admin (test)' },
    { employee_id: EMP_BOB, org_id: ORG_A, full_name: 'Bob Builder (test)' },
    { employee_id: EMP_CAROL, org_id: ORG_B, full_name: 'Carol Connector (test)' },
  ], { onConflict: 'employee_id' })).error);

  // 3. Projected people (record_kind='network_connection' → NOT in the pool yet)
  die('people', (await supabase.from('people').upsert([
    { person_id: P_GRACE, full_name: 'Grace Hopper (test)', linkedin_url: 'https://www.linkedin.com/in/zz-test-grace-hopper', record_kind: 'network_connection', promoted_from_connection: false, current_company_id: OPENAI, current_title_raw: 'Staff Software Engineer', years_experience_estimate: 8, career_stage_assigned: 'senior_career' },
    { person_id: P_ALAN, full_name: 'Alan Turing (test)', linkedin_url: 'https://www.linkedin.com/in/zz-test-alan-turing', record_kind: 'network_connection', promoted_from_connection: false, current_company_id: ANDURIL, current_title_raw: 'Senior Embedded Engineer', years_experience_estimate: 6, career_stage_assigned: 'senior_career' },
    { person_id: P_KATH, full_name: 'Katherine Johnson (test)', linkedin_url: 'https://www.linkedin.com/in/zz-test-katherine-johnson', record_kind: 'network_connection', promoted_from_connection: false, current_company_id: ANTHROPIC, current_title_raw: 'Research Engineer', years_experience_estimate: 7, career_stage_assigned: 'senior_career' },
  ], { onConflict: 'person_id' })).error);

  // 4. One current experience each (so they render as real candidates once promoted)
  await supabase.from('person_experiences').delete().in('person_id', PERSON_IDS);
  die('experiences', (await supabase.from('person_experiences').insert([
    { person_id: P_GRACE, company_id: OPENAI, title_raw: 'Staff Software Engineer', is_current: true, start_date: '2020-01-01' },
    { person_id: P_ALAN, company_id: ANDURIL, title_raw: 'Senior Embedded Engineer', is_current: true, start_date: '2021-03-01' },
    { person_id: P_KATH, company_id: ANTHROPIC, title_raw: 'Research Engineer', is_current: true, start_date: '2022-06-01' },
  ])).error);

  // 5. Bucket assignments (so the profile/list render cleanly post-promotion)
  await supabase.from('candidate_bucket_assignments').delete().in('person_id', PERSON_IDS);
  die('buckets', (await supabase.from('candidate_bucket_assignments').insert([
    { person_id: P_GRACE, candidate_bucket: 'vetted', assigned_by: 'admin', assignment_reason: 'gated-promo test seed' },
    { person_id: P_ALAN, candidate_bucket: 'vetted', assigned_by: 'admin', assignment_reason: 'gated-promo test seed' },
    { person_id: P_KATH, candidate_bucket: 'needs_review', assigned_by: 'admin', assignment_reason: 'gated-promo test seed' },
  ])).error);

  // 6. Connections (company_id/score = what the overlay would have matched)
  die('connections', (await supabase.from('connections').upsert([
    // Org A
    { connection_id: C1, org_id: ORG_A, canonical_url: 'linkedin.com/in/zz-test-grace-hopper', raw_url: 'https://www.linkedin.com/in/zz-test-grace-hopper', full_name: 'Grace Hopper', current_company: 'OpenAI', current_title: 'Staff Software Engineer', title_bucket: 'yes', status: 'active', company_id: OPENAI, company_score: 4, company_score_year: YEAR, enriched: true, person_id: P_GRACE },
    { connection_id: C2, org_id: ORG_A, canonical_url: 'linkedin.com/in/zz-test-alan-turing', raw_url: 'https://www.linkedin.com/in/zz-test-alan-turing', full_name: 'Alan Turing', current_company: 'Anduril', current_title: 'Senior Embedded Engineer', title_bucket: 'yes', status: 'active', company_id: ANDURIL, company_score: 4, company_score_year: YEAR, enriched: true, person_id: P_ALAN },
    { connection_id: C3, org_id: ORG_A, canonical_url: 'linkedin.com/in/zz-test-ada-lovelace', raw_url: 'https://www.linkedin.com/in/zz-test-ada-lovelace', full_name: 'Ada Lovelace', current_company: 'OpenAI', current_title: 'Software Engineer', title_bucket: 'yes', status: 'active', company_id: OPENAI, company_score: 4, company_score_year: YEAR, enriched: false, person_id: null },
    { connection_id: C4, org_id: ORG_A, canonical_url: 'linkedin.com/in/zz-test-katherine-johnson', raw_url: 'https://www.linkedin.com/in/zz-test-katherine-johnson', full_name: 'Katherine Johnson', current_company: 'Anthropic', current_title: 'Research Engineer', title_bucket: 'yes', status: 'active', company_id: ANTHROPIC, company_score: 5, company_score_year: YEAR, enriched: true, person_id: P_KATH },
    // Org B — same Grace Hopper (cross-org link), owned by Carol
    { connection_id: C5, org_id: ORG_B, canonical_url: 'linkedin.com/in/zz-test-grace-hopper', raw_url: 'https://www.linkedin.com/in/zz-test-grace-hopper', full_name: 'Grace Hopper', current_company: 'OpenAI', current_title: 'Staff Software Engineer', title_bucket: 'yes', status: 'active', company_id: OPENAI, company_score: 4, company_score_year: YEAR, enriched: true, person_id: P_GRACE },
  ], { onConflict: 'connection_id' })).error);

  // 7. Owners (the "via …" links). C2 has two owners; Grace is owned in both orgs.
  die('owners', (await supabase.from('connection_owners').upsert([
    { connection_id: C1, employee_id: EMP_ALICE, org_id: ORG_A, is_active: true },
    { connection_id: C2, employee_id: EMP_ALICE, org_id: ORG_A, is_active: true },
    { connection_id: C2, employee_id: EMP_BOB, org_id: ORG_A, is_active: true },
    { connection_id: C3, employee_id: EMP_BOB, org_id: ORG_A, is_active: true },
    { connection_id: C4, employee_id: EMP_ALICE, org_id: ORG_A, is_active: true },
    { connection_id: C5, employee_id: EMP_CAROL, org_id: ORG_B, is_active: true },
  ], { onConflict: 'connection_id,employee_id' })).error);

  console.log('✓ Seed complete.');
  console.log(`  Org A: ${ORG_A}`);
  console.log(`  Org B: ${ORG_B}`);
  console.log('  Connections page (Org A): /network/connections?org_id=' + ORG_A);
}

await (cleanup ? doCleanup() : seed());
