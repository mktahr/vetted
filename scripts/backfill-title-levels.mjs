#!/usr/bin/env node
// scripts/backfill-title-levels.mjs
//
// Backfills title_level on all person_experiences using the
// title_level_dictionary, then recomputes title_level_slope on people.
//
// Usage: node scripts/backfill-title-levels.mjs
//
// Safe to run multiple times (idempotent overwrites).

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

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesRule(title, rule) {
  const t = title.toLowerCase().trim()
  const p = rule.pattern.toLowerCase()
  switch (rule.match_type) {
    case 'exact': return t === p
    case 'starts_with': return t.startsWith(p)
    case 'ends_with': return t.endsWith(p)
    case 'contains': return t.includes(p)
    case 'contains_word': {
      const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(p)}($|[^a-z0-9])`, 'i')
      return re.test(t)
    }
    case 'regex': {
      try { return new RegExp(rule.pattern, 'i').test(t) } catch { return false }
    }
    default: return false
  }
}

const NUMERIC_SUFFIX = [
  { re: /\b(?:i|1)$/i, level: 3 },
  { re: /\b(?:ii|2)$/i, level: 4 },
  { re: /\b(?:iii|3)$/i, level: 5 },
  { re: /\b(?:iv|4)$/i, level: 6 },
  { re: /\b(?:v|5)$/i, level: 7 },
]

function extractTitleLevel(title, rules) {
  if (!title || !title.trim()) return null
  const t = title.trim()
  for (const rule of rules) {
    if (matchesRule(t, rule)) return rule.title_level
  }
  for (const { re, level } of NUMERIC_SUFFIX) {
    if (re.test(t)) return level
  }
  return null
}

function isInternshipTitle(title) {
  if (!title) return false
  return /\bintern\b|\binternship\b|\bco-?op\b/i.test(title)
}

async function main() {
  // Load rules
  const { data: rules, error: rErr } = await supabase
    .from('title_level_dictionary')
    .select('title_level_rule_id, pattern, match_type, title_level, priority')
    .order('priority', { ascending: true })
    .order('title_level_rule_id', { ascending: true })
  if (rErr) { console.error('Failed to load rules:', rErr); process.exit(1) }
  console.log(`Loaded ${rules.length} title-level rules`)

  // Fetch all experiences
  const { data: exps, error: eErr } = await supabase
    .from('person_experiences')
    .select('person_experience_id, person_id, title_raw, title_level, employment_type_normalized, start_date, end_date, is_current')
    .order('person_id')
    .order('start_date', { ascending: true, nullsFirst: false })
  if (eErr) { console.error('Failed to load experiences:', eErr); process.exit(1) }
  console.log(`Processing ${exps.length} experiences across all people...`)

  let updated = 0
  let unchanged = 0

  for (const exp of exps) {
    const level = extractTitleLevel(exp.title_raw, rules)
    if (level !== exp.title_level) {
      const { error } = await supabase
        .from('person_experiences')
        .update({ title_level: level })
        .eq('person_experience_id', exp.person_experience_id)
      if (error) console.error(`  Failed to update ${exp.person_experience_id}:`, error.message)
      else updated++
    } else {
      unchanged++
    }
  }

  console.log(`Experiences: ${updated} updated, ${unchanged} unchanged`)

  // Now recompute title_level_slope for each person
  const { data: people, error: pErr } = await supabase
    .from('people')
    .select('person_id')
  if (pErr) { console.error('Failed to load people:', pErr); process.exit(1) }

  let slopeUpdated = 0
  for (const person of people) {
    // Fetch this person's FT experiences ordered oldest→newest
    const { data: personExps } = await supabase
      .from('person_experiences')
      .select('title_raw, title_level, employment_type_normalized, start_date')
      .eq('person_id', person.person_id)
      .order('start_date', { ascending: true, nullsFirst: false })

    const ftExps = (personExps || []).filter(e =>
      e.employment_type_normalized === 'full_time' ||
      (e.employment_type_normalized !== 'internship' && !isInternshipTitle(e.title_raw))
    )

    const leveled = ftExps.filter(e => e.title_level !== null)
    let slope = 'insufficient_data'
    if (leveled.length >= 2) {
      const newest = leveled[leveled.length - 1].title_level
      const baseline = leveled.length >= 3
        ? (leveled[leveled.length - 2].title_level + leveled[leveled.length - 3].title_level) / 2
        : leveled[leveled.length - 2].title_level
      const diff = newest - baseline
      if (diff >= 0.5) slope = 'rising'
      else if (diff <= -0.5) slope = 'declining'
      else slope = 'flat'
    }

    const { error } = await supabase
      .from('people')
      .update({ title_level_slope: slope })
      .eq('person_id', person.person_id)
    if (!error) slopeUpdated++
    else console.error(`  Failed to update slope for ${person.person_id}:`, error.message)
  }

  console.log(`People: ${slopeUpdated} title_level_slope values written`)
  console.log('Done.')
}

main()
