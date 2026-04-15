// scripts/seed-seniority-rules.mjs
// Seeds the seniority_rules table with the canonical rule set.
//
// Priority numbers (lower = evaluated first). Because the user's spec
// says "explicit IC titles override the manager catch-all", we store
// IC overrides at priority 1 so they fire before the Manager contains-
// matches at priority 5. Overall ordering:
//
//   1 = IC exact overrides (user's spec "Priority 4")
//   2 = Executive          (user's spec "Priority 1")
//   3 = Lead               (user's spec "Priority 3")
//   4 = Student            (user's spec "Priority 5")
//   5 = Manager catch-all  (user's spec "Priority 2")

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync('.env.local', 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=')
    return [k.trim(), v.join('=').trim()]
  })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const RULES = [
  // ─── Priority 1: Explicit IC overrides ───────────────────────────────
  // (These titles contain "manager" but aren't people-management roles)
  { pattern: 'product manager',         match_type: 'exact',    seniority: 'individual_contributor', priority: 1, notes: 'PM without people management' },
  { pattern: 'pm',                      match_type: 'exact',    seniority: 'individual_contributor', priority: 1, notes: 'PM abbreviation' },
  { pattern: 'senior product manager',  match_type: 'exact',    seniority: 'individual_contributor', priority: 1 },
  { pattern: 'senior pm',               match_type: 'exact',    seniority: 'individual_contributor', priority: 1 },
  { pattern: 'program manager',         match_type: 'exact',    seniority: 'individual_contributor', priority: 1 },
  { pattern: 'account manager',         match_type: 'exact',    seniority: 'individual_contributor', priority: 1 },
  { pattern: 'marketing manager',       match_type: 'exact',    seniority: 'individual_contributor', priority: 1 },
  { pattern: 'community manager',       match_type: 'exact',    seniority: 'individual_contributor', priority: 1 },
  { pattern: 'office manager',          match_type: 'exact',    seniority: 'individual_contributor', priority: 1 },

  // ─── Priority 2: Executive ───────────────────────────────────────────
  { pattern: 'chief',                   match_type: 'starts_with', seniority: 'executive', priority: 2, notes: 'Chief X Officer etc.' },
  { pattern: 'officer',                 match_type: 'ends_with',   seniority: 'executive', priority: 2, notes: 'Any C-level title ending in officer' },
  { pattern: 'ceo',                     match_type: 'exact',       seniority: 'executive', priority: 2 },
  { pattern: 'cto',                     match_type: 'exact',       seniority: 'executive', priority: 2 },
  { pattern: 'coo',                     match_type: 'exact',       seniority: 'executive', priority: 2 },
  { pattern: 'cfo',                     match_type: 'exact',       seniority: 'executive', priority: 2 },
  { pattern: 'cmo',                     match_type: 'exact',       seniority: 'executive', priority: 2 },
  { pattern: 'cpo',                     match_type: 'exact',       seniority: 'executive', priority: 2, notes: 'Chief Product/People Officer' },
  { pattern: 'cro',                     match_type: 'exact',       seniority: 'executive', priority: 2, notes: 'Chief Revenue Officer' },
  { pattern: 'cbo',                     match_type: 'exact',       seniority: 'executive', priority: 2 },
  { pattern: 'clo',                     match_type: 'exact',       seniority: 'executive', priority: 2 },
  { pattern: 'chro',                    match_type: 'exact',       seniority: 'executive', priority: 2 },
  { pattern: 'founder',                 match_type: 'contains',    seniority: 'executive', priority: 2 },
  { pattern: 'co-founder',              match_type: 'contains',    seniority: 'executive', priority: 2 },
  { pattern: 'cofounder',               match_type: 'exact',       seniority: 'executive', priority: 2 },
  { pattern: 'managing director',       match_type: 'contains',    seniority: 'executive', priority: 2 },
  { pattern: 'general partner',         match_type: 'contains',    seniority: 'executive', priority: 2 },
  { pattern: 'managing partner',        match_type: 'contains',    seniority: 'executive', priority: 2 },

  // ─── Priority 3: Lead ────────────────────────────────────────────────
  { pattern: 'senior staff',            match_type: 'contains',      seniority: 'lead', priority: 3 },
  { pattern: 'staff engineer',          match_type: 'contains',      seniority: 'lead', priority: 3 },
  { pattern: 'staff software',          match_type: 'contains',      seniority: 'lead', priority: 3 },
  { pattern: 'principal',               match_type: 'contains',      seniority: 'lead', priority: 3 },
  { pattern: 'architect',               match_type: 'contains',      seniority: 'lead', priority: 3 },
  { pattern: 'distinguished engineer',  match_type: 'contains',      seniority: 'lead', priority: 3 },
  { pattern: 'tech lead manager',       match_type: 'contains',      seniority: 'lead', priority: 3, notes: 'TLMs are tech leads, not managers' },
  { pattern: 'tech lead',               match_type: 'contains',      seniority: 'lead', priority: 3 },
  { pattern: 'technical lead',          match_type: 'contains',      seniority: 'lead', priority: 3 },
  { pattern: 'team lead',               match_type: 'contains',      seniority: 'lead', priority: 3 },
  { pattern: 'tlm',                     match_type: 'contains_word', seniority: 'lead', priority: 3 },
  { pattern: 'fellow',                  match_type: 'contains_word', seniority: 'lead', priority: 3, notes: 'Engineering fellow — word-boundary to avoid "fellows"' },

  // ─── Priority 4: Student ─────────────────────────────────────────────
  // (Title-based only; the employment_type=internship and grad-date
  //  overrides are applied in resolveSeniority before the rules run.)
  { pattern: 'intern',                  match_type: 'contains', seniority: 'student', priority: 4 },
  { pattern: 'internship',              match_type: 'contains', seniority: 'student', priority: 4 },
  { pattern: 'co-op',                   match_type: 'contains', seniority: 'student', priority: 4 },
  { pattern: 'coop',                    match_type: 'contains', seniority: 'student', priority: 4 },
  { pattern: 'student',                 match_type: 'contains', seniority: 'student', priority: 4 },
  { pattern: 'new grad',                match_type: 'contains', seniority: 'student', priority: 4 },
  { pattern: 'graduate student',        match_type: 'contains', seniority: 'student', priority: 4 },

  // ─── Priority 5: Manager catch-all ───────────────────────────────────
  { pattern: 'senior vice president',   match_type: 'contains',      seniority: 'manager', priority: 5 },
  { pattern: 'executive vice president', match_type: 'contains',     seniority: 'manager', priority: 5 },
  { pattern: 'vice president',          match_type: 'contains',      seniority: 'manager', priority: 5 },
  { pattern: 'svp',                     match_type: 'contains_word', seniority: 'manager', priority: 5 },
  { pattern: 'evp',                     match_type: 'contains_word', seniority: 'manager', priority: 5 },
  { pattern: 'vp',                      match_type: 'contains_word', seniority: 'manager', priority: 5, notes: 'Word-boundary to avoid "devops", "rsvp"' },
  { pattern: 'head of',                 match_type: 'contains',      seniority: 'manager', priority: 5 },
  { pattern: 'senior manager',          match_type: 'contains',      seniority: 'manager', priority: 5 },
  { pattern: 'director',                match_type: 'contains',      seniority: 'manager', priority: 5, notes: 'Covers director / senior director / group director' },
  { pattern: 'engineering manager',     match_type: 'contains',      seniority: 'manager', priority: 5 },
  { pattern: 'group manager',           match_type: 'contains',      seniority: 'manager', priority: 5 },
  { pattern: 'manager',                 match_type: 'exact',         seniority: 'manager', priority: 5 },
]

// Clear existing rules and re-seed (idempotent)
const { error: delErr } = await supabase.from('seniority_rules').delete().gte('rule_id', 0)
if (delErr) {
  console.error('Failed to clear seniority_rules:', delErr.message)
  process.exit(1)
}

const rows = RULES.map(r => ({
  pattern: r.pattern,
  match_type: r.match_type,
  seniority_normalized: r.seniority,
  priority: r.priority,
  notes: r.notes || null,
}))

const { error: insErr } = await supabase.from('seniority_rules').insert(rows)
if (insErr) {
  console.error('Failed to insert:', insErr.message)
  process.exit(1)
}

console.log(`\n=== Seeded seniority_rules ===`)
const byPriority = {}
for (const r of rows) {
  byPriority[r.priority] = (byPriority[r.priority] || 0) + 1
}
for (const [p, n] of Object.entries(byPriority).sort()) {
  console.log(`  Priority ${p}: ${n} rules`)
}
console.log(`  Total: ${rows.length} rules`)
