#!/usr/bin/env node
// scripts/backfill-seniority-descriptions.mjs
//
// Re-resolves seniority on all person_experiences using the description-aware
// resolver. Only changes experiences where the description scan would upgrade
// the seniority beyond what the title alone produced.

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

// ─── Load seniority rules ───────────────────────────────────────────────────

const { data: rulesRaw } = await supabase
  .from('seniority_rules')
  .select('rule_id, title_pattern, seniority_level, priority')
  .eq('active', true)
  .order('priority', { ascending: true })
  .order('rule_id', { ascending: true })
const rules = rulesRaw || []
const ruleMap = new Map()
for (const r of rules) {
  const key = r.title_pattern.toLowerCase().trim()
  if (!ruleMap.has(key)) ruleMap.set(key, r.seniority_level)
}
console.log(`Loaded ${rules.length} seniority rules (${ruleMap.size} patterns)`)

// ─── Description seniority scan (mirrors seniority.ts) ──────────────────────

const SIGNALS = [
  { re: /\bvice president\b/i, level: 'executive', rank: 8 },
  { re: /\bvp\b/i, level: 'executive', rank: 8 },
  { re: /\bmanaging director\b/i, level: 'executive', rank: 8 },
  { re: /\bdirector\b/i, level: 'manager', rank: 7 },
  { re: /\bengineering manager\b/i, level: 'manager', rank: 7 },
  { re: /\bmanager\b/i, level: 'manager', rank: 7 },
  { re: /\bfounder\b/i, level: 'founder', rank: 6 },
  { re: /\bco-founder\b/i, level: 'founder', rank: 6 },
  { re: /\bprincipal\b/i, level: 'lead_ic', rank: 5 },
  { re: /\bstaff\b/i, level: 'lead_ic', rank: 5 },
  { re: /\btech lead\b/i, level: 'lead_ic', rank: 5 },
  { re: /\btechnical lead\b/i, level: 'lead_ic', rank: 5 },
  { re: /\blead\b/i, level: 'lead_ic', rank: 5 },
  { re: /\bsenior\b/i, level: 'senior_ic', rank: 4 },
  { re: /\bsr\.\b/i, level: 'senior_ic', rank: 4 },
  { re: /\bjunior\b/i, level: 'entry', rank: 2 },
  { re: /\bjr\.\b/i, level: 'entry', rank: 2 },
  { re: /\bassociate\b/i, level: 'entry', rank: 2 },
  { re: /\bnew grad\b/i, level: 'entry', rank: 2 },
  { re: /\binternship\b/i, level: 'intern', rank: 1 },
  { re: /\bintern\b/i, level: 'intern', rank: 1 },
]

const TITLE_AUTHORITATIVE = new Set([
  'intern', 'entry', 'senior_ic', 'lead_ic', 'founder', 'manager', 'executive',
])

const NOISE_SUFFIX = [
  /\s*\(.*?\)\s*$/,
  /\s*-\s*(remote|contract|freelance|part[- ]time|intern|interim)$/i,
  /\s*[–—]\s*.+$/,
  /\s*@\s*.+$/,
  /\s*[|\/]\s*.+$/,
  /,\s*.+$/,
]

const SENIORITY_TO_TITLE_LEVEL = {
  intern: 1, entry: 2, individual_contributor: 3, senior_ic: 5,
  lead_ic: 6, founder: 6, manager: 9, executive: 10,
}

function scanDescription(desc) {
  if (!desc || desc.trim().length < 10) return null
  let bestLevel = null, bestRank = 0
  for (const { re, level, rank } of SIGNALS) {
    if (re.test(desc) && rank > bestRank) { bestLevel = level; bestRank = rank }
  }
  return bestLevel
}

function resolveTitleLevel(title) {
  if (!title) return null
  const normalized = title.toLowerCase().trim().replace(/\s+/g, ' ')
  let hit = ruleMap.get(normalized)
  if (!hit) {
    let stripped = normalized
    for (const p of NOISE_SUFFIX) stripped = stripped.replace(p, '').trim()
    if (stripped !== normalized && stripped.length > 0) hit = ruleMap.get(stripped)
  }
  return hit || null
}

// ─── Fetch and process ──────────────────────────────────────────────────────

const { data: exps, error: expErr } = await supabase
  .from('person_experiences')
  .select('person_experience_id, title_raw, description_raw, seniority_normalized, seniority_source, title_level, employment_type_normalized')
  .order('person_experience_id')
if (expErr) { console.error('Failed:', expErr); process.exit(1) }
console.log(`Processing ${exps.length} experiences...`)

let updated = 0, unchanged = 0
for (const exp of exps) {
  // Skip if employment_type override already handled it
  const emp = (exp.employment_type_normalized || '').toLowerCase()
  if (emp === 'internship') { unchanged++; continue }

  const titleLevel = resolveTitleLevel(exp.title_raw)

  // If title gave a specific (non-IC) answer, keep it — set source='title'
  if (titleLevel && TITLE_AUTHORITATIVE.has(titleLevel)) {
    if (exp.seniority_normalized !== titleLevel || exp.seniority_source !== 'title') {
      await supabase.from('person_experiences').update({
        seniority_normalized: titleLevel,
        seniority_source: 'title',
      }).eq('person_experience_id', exp.person_experience_id)
      updated++
    } else { unchanged++ }
    continue
  }

  // Title was IC or no match — try description
  const descLevel = scanDescription(exp.description_raw)
  if (descLevel) {
    const updates = {
      seniority_normalized: descLevel,
      seniority_source: 'description',
    }
    // Also upgrade title_level if description implies higher
    if (exp.title_level !== null) {
      const implied = SENIORITY_TO_TITLE_LEVEL[descLevel] ?? exp.title_level
      if (implied > exp.title_level) updates.title_level = implied
    }
    if (exp.seniority_normalized !== descLevel || exp.seniority_source !== 'description') {
      await supabase.from('person_experiences').update(updates)
        .eq('person_experience_id', exp.person_experience_id)
      updated++
    } else { unchanged++ }
    continue
  }

  // Title IC match or fallback — set source accordingly
  const source = titleLevel ? 'title' : 'fallback'
  const level = titleLevel || 'individual_contributor'
  if (exp.seniority_normalized !== level || exp.seniority_source !== source) {
    await supabase.from('person_experiences').update({
      seniority_normalized: level,
      seniority_source: source,
    }).eq('person_experience_id', exp.person_experience_id)
    updated++
  } else { unchanged++ }
}

console.log(`Done. ${updated} updated, ${unchanged} unchanged.`)
console.log('Run /api/admin/rescore-all to recompute derived fields.')
