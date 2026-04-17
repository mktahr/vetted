#!/usr/bin/env node
// scripts/seed-title-levels.mjs
//
// Seeds title_level_dictionary with patterns for extracting numeric
// title levels (1-10) from raw job titles.
//
// Idempotent: deletes all existing rows and re-inserts.
//
// Level scale:
//   1  = intern / student / new grad / apprentice
//   2  = junior / associate / entry / analyst (entry-level FT)
//   3  = mid-level IC (no qualifier — "Software Engineer", "PM", "Designer")
//   4  = IC-II (explicit level 2: "SDE II", "Engineer 2", "PM 2")
//   5  = Senior / IC-III (explicit level 3: "Senior Engineer", "SDE III")
//   6  = Staff / IC-IV / Lead (technical: "Staff Engineer", "Tech Lead")
//   7  = Principal / Senior Staff / IC-V
//   8  = Distinguished / Fellow
//   9  = VP / SVP / EVP (executive-track)
//   10 = C-suite / Chief (CTO, CEO, Chief Architect)
//
// Usage: node scripts/seed-title-levels.mjs

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

// ── Pattern definitions ─────────────────────────────────────────────────────
// [pattern, match_type, title_level, priority, notes]

const RULES = [
  // ── Priority 1: Exact overrides that must fire before broad patterns ─────
  // Bare "manager" titles that are actually IC (product manager, program manager, etc.)
  // These don't get the manager level bump — they stay at whatever the qualifier says.
  // NOTE: seniority_rules already handles this for seniority; here we just
  // prevent "product manager" from getting level 9 (VP/manager band).

  // ── Priority 2: Student / Intern (level 1) ──────────────────────────────
  ['intern', 'contains', 1, 2, 'Any title containing intern'],
  ['internship', 'contains', 1, 2, null],
  ['co-op', 'contains', 1, 2, null],
  ['coop', 'contains', 1, 2, null],
  ['apprentice', 'contains', 1, 2, null],
  ['new grad', 'contains', 1, 2, null],
  ['graduate student', 'contains', 1, 2, null],
  ['student', 'exact', 1, 2, 'Only exact "Student"'],
  ['research assistant', 'exact', 1, 2, null],
  ['teaching assistant', 'exact', 1, 2, null],

  // ── Priority 3: Junior / Associate / Entry (level 2) ────────────────────
  ['junior', 'contains_word', 2, 3, 'Junior qualifier'],
  ['associate engineer', 'contains', 2, 3, null],
  ['associate developer', 'contains', 2, 3, null],
  ['associate product manager', 'exact', 2, 3, 'APM programs'],
  ['rotational', 'contains_word', 2, 3, 'Rotational programs'],
  ['entry level', 'contains', 2, 3, null],

  // ── Priority 4: Explicit level numbers — II/2 (level 4) ─────────────────
  // Must fire BEFORE the senior/staff patterns so "SDE II" → 4 not 5.
  ['software development engineer ii', 'contains', 4, 4, 'Amazon SDE II'],
  ['software development engineer 2', 'contains', 4, 4, 'Amazon SDE 2'],
  ['software engineer ii', 'contains', 4, 4, null],
  ['software engineer 2', 'contains', 4, 4, null],
  ['sde ii', 'contains_word', 4, 4, null],
  ['sde 2', 'contains_word', 4, 4, null],
  ['swe ii', 'contains_word', 4, 4, null],
  ['swe 2', 'contains_word', 4, 4, null],
  ['engineer ii', 'contains', 4, 4, null],
  ['engineer 2', 'contains', 4, 4, null],
  ['developer ii', 'contains', 4, 4, null],
  ['developer 2', 'contains', 4, 4, null],
  ['designer ii', 'contains', 4, 4, null],
  ['designer 2', 'contains', 4, 4, null],
  ['analyst ii', 'contains', 4, 4, null],
  ['analyst 2', 'contains', 4, 4, null],
  ['product manager ii', 'contains', 4, 4, null],
  ['product manager 2', 'contains', 4, 4, null],

  // ── Priority 5: Explicit level I/1 (level 3 — bare IC with number) ──────
  ['software development engineer i', 'regex', 3, 5, 'Amazon SDE I (not II)'],
  ['software engineer i$', 'regex', 3, 5, 'SWE I at end'],
  ['sde i$', 'regex', 3, 5, null],
  ['swe i$', 'regex', 3, 5, null],
  ['engineer i$', 'regex', 3, 5, null],
  ['developer i$', 'regex', 3, 5, null],

  // ── Priority 6: Explicit level III/3 = Senior IC (level 5) ──────────────
  ['software development engineer iii', 'contains', 5, 6, 'Amazon SDE III → Senior'],
  ['software development engineer 3', 'contains', 5, 6, null],
  ['sde iii', 'contains_word', 5, 6, null],
  ['sde 3', 'contains_word', 5, 6, null],
  ['engineer iii', 'contains', 5, 6, null],
  ['engineer 3', 'contains', 5, 6, null],

  // ── Priority 7: Senior qualifier (level 5) ──────────────────────────────
  ['senior', 'contains_word', 5, 7, 'Any senior-prefixed title'],

  // ── Priority 8: Staff / Tech Lead (level 6) ────────────────────────────
  ['staff', 'contains_word', 6, 8, null],
  ['tech lead', 'contains', 6, 8, null],
  ['technical lead', 'contains', 6, 8, null],
  ['team lead', 'contains', 6, 8, null],
  ['founding engineer', 'contains', 6, 8, 'Founding eng = staff-level scope'],
  ['architect', 'contains_word', 6, 8, null],
  ['engineering lead', 'contains', 6, 8, null],

  // ── Priority 9: Principal / Senior Staff (level 7) ─────────────────────
  ['principal', 'contains_word', 7, 9, null],
  ['senior staff', 'contains', 7, 9, null],

  // ── Priority 10: Distinguished / Fellow (level 8) ──────────────────────
  ['distinguished', 'contains_word', 8, 10, null],
  ['fellow', 'contains_word', 8, 10, 'Technical fellow'],

  // ── Priority 11: Director / VP (level 9) ───────────────────────────────
  ['vice president', 'contains', 9, 11, null],
  ['vp', 'contains_word', 9, 11, null],
  ['svp', 'contains_word', 9, 11, null],
  ['evp', 'contains_word', 9, 11, null],
  ['director', 'contains_word', 9, 11, null],
  ['head of', 'starts_with', 9, 11, null],
  ['general manager', 'contains', 9, 11, null],

  // ── Priority 12: C-suite (level 10) ────────────────────────────────────
  ['chief', 'contains_word', 10, 12, null],
  ['ceo', 'exact', 10, 12, null],
  ['cto', 'exact', 10, 12, null],
  ['coo', 'exact', 10, 12, null],
  ['cfo', 'exact', 10, 12, null],
  ['cmo', 'exact', 10, 12, null],
  ['cpo', 'exact', 10, 12, null],
  ['cro', 'exact', 10, 12, null],
  ['managing director', 'contains', 10, 12, null],
  ['general partner', 'contains', 10, 12, null],
  ['managing partner', 'contains', 10, 12, null],
]

async function main() {
  console.log('Clearing existing title_level_dictionary...')
  const { error: delErr } = await supabase.from('title_level_dictionary').delete().gte('title_level_rule_id', 0)
  if (delErr) { console.error('Delete failed:', delErr); process.exit(1) }

  console.log(`Inserting ${RULES.length} rules...`)
  const rows = RULES.map(([pattern, match_type, title_level, priority, notes]) => ({
    pattern,
    match_type,
    title_level,
    priority,
    notes,
  }))

  const { error: insErr } = await supabase.from('title_level_dictionary').insert(rows)
  if (insErr) { console.error('Insert failed:', insErr); process.exit(1) }

  console.log(`Done. Seeded ${RULES.length} title-level rules.`)
}

main()
