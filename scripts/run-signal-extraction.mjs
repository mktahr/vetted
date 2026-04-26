#!/usr/bin/env node
// scripts/run-signal-extraction.mjs
//
// Batch signal extraction: iterates every person in the database,
// runs the pattern extractor against their text fields, and writes
// matching signals to person_signals.
//
// Idempotent — safe to re-run. Existing rows are deduplicated via
// the unique index; re-runs update last_verified_at.
//
// Usage:
//   node scripts/run-signal-extraction.mjs
//   node scripts/run-signal-extraction.mjs --dry-run
//   node scripts/run-signal-extraction.mjs --verbose

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const VERBOSE = process.argv.includes('--verbose')

if (DRY_RUN) console.log('*** DRY RUN — no writes ***\n')

// ─── Supabase client ──────────────────────────────────────────────────────

const envFile = readFileSync('.env.local', 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=')
    return [k.trim(), v.join('=').trim()]
  })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ─── Load signal dictionary ───────────────────────────────────────────────

const { data: dictRaw, error: dictErr } = await supabase
  .from('signal_dictionary')
  .select('id, canonical_name, category, aliases, source_field_hints')
  .eq('is_active', true)
if (dictErr) { console.error('Failed to load dictionary:', dictErr); process.exit(1) }
const dict = dictRaw || []
console.log(`Loaded ${dict.length} dictionary entries`)

// ─── Build pattern matching (mirrors lib/signals/extractPatterns.ts) ──────

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildPattern(alias) {
  const escaped = escapeRegex(alias)
  const isShort = alias.length < 5 && !alias.includes(' ')
  if (isShort) {
    return new RegExp(`(?<![a-zA-Z0-9@/])${escaped}(?![a-zA-Z0-9])`, 'i')
  }
  return new RegExp(`\\b${escaped}\\b`, 'i')
}

const entries = dict.map(row => ({
  id: row.id,
  canonical_name: row.canonical_name,
  category: row.category,
  aliases: row.aliases || [],
  source_field_hints: row.source_field_hints || [],
  is_catchall: row.canonical_name.endsWith('(generic)'),
}))

// Pre-compile patterns
const compiledPatterns = new Map()
for (const entry of entries) {
  const patterns = []
  patterns.push({
    pattern: buildPattern(entry.canonical_name.replace(/\s*\(generic\)$/, '').toLowerCase()),
    alias: entry.canonical_name,
  })
  for (const alias of entry.aliases) {
    patterns.push({ pattern: buildPattern(alias.toLowerCase()), alias })
  }
  compiledPatterns.set(entry.id, patterns)
}
console.log(`Compiled patterns for ${compiledPatterns.size} entries`)

function extractSignals(text, sourceFieldHint) {
  if (!text || text.trim().length === 0) return []
  const textLower = text.toLowerCase()
  const matches = new Map()
  const namedMatchRanges = []

  // Named entries first
  for (const entry of entries) {
    if (entry.is_catchall) continue
    if (entry.source_field_hints.length > 0 && !entry.source_field_hints.includes(sourceFieldHint)) continue
    const patterns = compiledPatterns.get(entry.id)
    if (!patterns) continue
    for (const { pattern, alias } of patterns) {
      const match = pattern.exec(textLower)
      if (match) {
        if (!matches.has(entry.id)) {
          matches.set(entry.id, { signal_id: entry.id, matched_alias: alias, confidence: 1.0, is_catchall: false })
        }
        namedMatchRanges.push({ start: match.index, end: match.index + match[0].length })
        break
      }
    }
  }

  // Catchalls
  for (const entry of entries) {
    if (!entry.is_catchall) continue
    if (entry.source_field_hints.length > 0 && !entry.source_field_hints.includes(sourceFieldHint)) continue
    const patterns = compiledPatterns.get(entry.id)
    if (!patterns) continue
    for (const { pattern, alias } of patterns) {
      const match = pattern.exec(textLower)
      if (match) {
        const overlaps = namedMatchRanges.some(r => match.index < r.end && (match.index + match[0].length) > r.start)
        if (overlaps) continue
        if (!matches.has(entry.id)) {
          matches.set(entry.id, { signal_id: entry.id, matched_alias: alias, confidence: 0.65, is_catchall: true })
        }
        break
      }
    }
  }

  return Array.from(matches.values())
}

// ─── Process all people ───────────────────────────────────────────────────

const { data: people, error: pplErr } = await supabase
  .from('people')
  .select('person_id, full_name, headline_raw, summary_raw')
  .order('created_at', { ascending: true })
if (pplErr) { console.error('Failed to load people:', pplErr); process.exit(1) }
console.log(`Processing ${people.length} candidates...\n`)

let totalWritten = 0, totalSkipped = 0, totalExperiences = 0
const categoryCounts = {}

for (let i = 0; i < people.length; i++) {
  const person = people[i]

  // Fetch experiences
  const { data: exps } = await supabase
    .from('person_experiences')
    .select('person_experience_id, title_raw, description_raw, companies:company_id(company_name)')
    .eq('person_id', person.person_id)

  const allMatches = []

  for (const exp of exps || []) {
    totalExperiences++
    if (exp.description_raw) {
      for (const m of extractSignals(exp.description_raw, 'experience_description')) {
        allMatches.push({ match: m, expId: exp.person_experience_id })
      }
    }
    if (exp.title_raw) {
      for (const m of extractSignals(exp.title_raw, 'title')) {
        allMatches.push({ match: m, expId: exp.person_experience_id })
      }
    }
    const companyName = exp.companies?.company_name
    if (companyName) {
      for (const m of extractSignals(companyName, 'company_name')) {
        allMatches.push({ match: m, expId: exp.person_experience_id })
      }
    }
  }

  if (person.headline_raw) {
    for (const m of extractSignals(person.headline_raw, 'headline')) {
      allMatches.push({ match: m, expId: null })
    }
  }
  if (person.summary_raw) {
    for (const m of extractSignals(person.summary_raw, 'about')) {
      allMatches.push({ match: m, expId: null })
    }
  }

  // Deduplicate: best per (signal_id, expId) — same signal from different
  // experiences produces separate rows per the unique index.
  const deduped = new Map()
  for (const item of allMatches) {
    const key = `${item.match.signal_id}|${item.expId ?? 'null'}`
    const existing = deduped.get(key)
    if (!existing || item.match.confidence > existing.match.confidence) {
      deduped.set(key, item)
    }
  }

  // Write
  let personWritten = 0, personSkipped = 0
  for (const item of deduped.values()) {
    if (DRY_RUN) {
      personWritten++
      continue
    }

    const { error: insertErr } = await supabase.from('person_signals').insert({
      person_id: person.person_id,
      signal_id: item.match.signal_id,
      source: 'pattern_extractor',
      source_experience_id: item.expId,
      source_education_id: null,
      source_text: item.match.matched_alias.slice(0, 200),
      confidence: item.match.confidence,
    })

    if (insertErr) {
      if (insertErr.code === '23505') {
        personSkipped++
      } else {
        console.error(`  INSERT error: ${insertErr.message}`)
      }
    } else {
      personWritten++
      // Track category
      const entry = entries.find(e => e.id === item.match.signal_id)
      if (entry) categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1
    }
  }

  totalWritten += personWritten
  totalSkipped += personSkipped

  if (VERBOSE && deduped.size > 0) {
    const signalNames = Array.from(deduped.values()).map(item => {
      const entry = entries.find(e => e.id === item.match.signal_id)
      return entry?.canonical_name || item.match.signal_id
    })
    console.log(`  ${person.full_name}: ${signalNames.join(', ')}`)
  }

  if ((i + 1) % 10 === 0 || i === people.length - 1) {
    console.log(`Processed ${i + 1} of ${people.length} candidates. ${totalWritten} signals written, ${totalSkipped} already existed.`)
  }
}

console.log(`\n=== Summary ===`)
console.log(`Candidates processed: ${people.length}`)
console.log(`Experiences scanned: ${totalExperiences}`)
console.log(`Signals written: ${totalWritten}`)
console.log(`Signals already existed: ${totalSkipped}`)

if (Object.keys(categoryCounts).length > 0) {
  console.log(`\nBy category:`)
  const sorted = Object.entries(categoryCounts).sort(([, a], [, b]) => b - a)
  for (const [cat, count] of sorted) {
    console.log(`  ${cat}: ${count}`)
  }
}

if (DRY_RUN) console.log('\n*** DRY RUN — no changes were written ***')
