#!/usr/bin/env node
// scripts/import-teams.mjs
//
// Seeds the teams + team_competition_map + signal_dictionary (engineering_team rows)
// + team_domain_tag_dictionary tables from supabase/seeds/vetted_teams.csv.
//
// USAGE:
//   node scripts/import-teams.mjs --dry-run   # No writes; print unmatched schools + plan
//   node scripts/import-teams.mjs             # Apply
//
// SLUG DERIVATION RULE (locked):
//   1. Lowercase team_name
//   2. Replace spaces and punctuation with hyphens
//   3. Drop article words (a, an, the, of, at, in)
//   4. Collapse multiple hyphens, strip leading/trailing
//   Examples:
//     "Cornell Racing"        → "cornell-racing"
//     "Cornell Racing EV"     → "cornell-racing-ev"
//     "RoboJackets RoboBoat"  → "robojackets-roboboat"
//     "MIT-PITT-RW"           → "mit-pitt-rw"
//     "UM::Autonomy"          → "um-autonomy"
//
// SCHOOL LOOKUP STRATEGY:
//   1. Exact match on schools.school_name
//   2. Case-insensitive match
//   3. school_aliases.alias_name match
//   4. If still unmatched, log to stdout and SKIP the team (no insert)
//
// CONSORTIA: teams with school field ending "(lead)" are flagged is_consortium=true,
// the lead school is parsed out, the rest goes into consortium_partners (free text).
//
// IDEMPOTENT: re-running with same CSV is safe. UPSERT semantics:
//   - signal_dictionary: ON CONFLICT (canonical_name, category) DO UPDATE
//   - teams: ON CONFLICT (school_id, team_slug) DO UPDATE
//   - team_competition_map: ON CONFLICT (team_id, competition_id) DO NOTHING

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ─── Config ──────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run')
const CSV_PATH = resolve(__dirname, '../supabase/seeds/vetted_teams.csv')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

// ─── Helpers ─────────────────────────────────────────────────────────

const ARTICLE_WORDS = new Set(['a', 'an', 'the', 'of', 'at', 'in'])

function deriveSlug(teamName) {
  return teamName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')                  // any non-alphanumeric → hyphen
    .split('-')
    .filter(w => w.length > 0 && !ARTICLE_WORDS.has(w))
    .join('-')
    .replace(/^-+|-+$/g, '')                       // strip leading/trailing
}

function parseConsortium(schoolField) {
  // "Massachusetts Institute of Technology (lead)" → { school: "MIT...", is_consortium: true }
  const m = schoolField.match(/^(.+?)\s*\(lead\)\s*$/i)
  if (m) return { school: m[1].trim(), is_consortium: true }
  return { school: schoolField.trim(), is_consortium: false }
}

function parseCSV(content) {
  // Minimal CSV parser handling quoted fields with semicolons inside.
  const lines = content.split(/\r?\n/).filter(l => l.length > 0)
  const headers = parseLine(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const fields = parseLine(lines[i])
    if (fields.length !== headers.length) {
      console.warn(`Line ${i + 1} field count mismatch (got ${fields.length}, expected ${headers.length}). Skipping.`)
      continue
    }
    const row = {}
    headers.forEach((h, j) => { row[h] = fields[j] })
    rows.push(row)
  }
  return rows
}

function parseLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else { inQuotes = !inQuotes }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current); current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields.map(f => f.trim())
}

function splitSemicolon(s) {
  if (!s) return []
  return s.split(';').map(x => x.trim()).filter(x => x.length > 0)
}

// ─── School lookup ───────────────────────────────────────────────────

async function buildSchoolLookup() {
  const { data: schools } = await supabase.from('schools').select('school_id, school_name')
  const { data: aliases } = await supabase.from('school_aliases').select('school_id, alias_name')

  const exact = new Map()
  const lower = new Map()
  for (const s of schools || []) {
    exact.set(s.school_name, s.school_id)
    lower.set(s.school_name.toLowerCase(), s.school_id)
  }
  for (const a of aliases || []) {
    if (!exact.has(a.alias_name)) exact.set(a.alias_name, a.school_id)
    lower.set(a.alias_name.toLowerCase(), a.school_id)
  }
  return { exact, lower }
}

function lookupSchool(name, lookup) {
  if (lookup.exact.has(name)) return lookup.exact.get(name)
  if (lookup.lower.has(name.toLowerCase())) return lookup.lower.get(name.toLowerCase())
  return null
}

// ─── Competition lookup (slug → signal_id) ───────────────────────────

async function buildCompetitionLookup() {
  const { data: comps, error } = await supabase
    .from('competitions')
    .select('signal_id, competition_slug')
  if (error) throw new Error(`Failed to load competitions: ${error.message}`)
  const map = new Map()
  for (const c of comps) map.set(c.competition_slug, c.signal_id)
  return map
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Reading ${CSV_PATH}`)
  const content = readFileSync(CSV_PATH, 'utf-8')
  const rows = parseCSV(content)
  console.log(`Loaded ${rows.length} team rows from CSV.`)

  const schoolLookup = await buildSchoolLookup()
  const compLookup = await buildCompetitionLookup()
  console.log(`Loaded ${schoolLookup.exact.size} schools (incl. aliases) and ${compLookup.size} competitions.`)

  // Group rows by (school, team_slug) to dedup multi-competition entries
  const teamsBySlug = new Map()  // key: "schoolKey|slug" → { team data + competitions[] }
  const unmatchedSchools = new Set()
  const unmatchedCompetitions = new Set()
  const allDomainTags = new Set()

  for (const row of rows) {
    const consortium = parseConsortium(row.school)
    const schoolId = lookupSchool(consortium.school, schoolLookup)
    if (!schoolId) {
      unmatchedSchools.add(`${consortium.school}  (team: ${row.team_name})`)
      continue
    }

    const compSignalId = compLookup.get(row.competition_id)
    if (!compSignalId) {
      unmatchedCompetitions.add(`${row.competition_id}  (team: ${row.team_name})`)
      continue
    }

    const teamSlug = deriveSlug(row.team_name)
    const dedupKey = `${schoolId}|${teamSlug}`

    if (!teamsBySlug.has(dedupKey)) {
      const aliases = splitSemicolon(row.team_aliases)
      const domainTags = splitSemicolon(row.domain_tags)
      domainTags.forEach(t => allDomainTags.add(t))

      teamsBySlug.set(dedupKey, {
        team_name: row.team_name,
        team_slug: teamSlug,
        school_id: schoolId,
        tier_int: parseInt(row.team_tier, 10),
        domain_tags: domainTags,
        grad_skew: row.grad_skew || null,
        website: row.website || null,
        notes: row.notes || null,
        is_consortium: consortium.is_consortium,
        consortium_partners: consortium.is_consortium ? row.notes || null : null,  // notes often holds partners
        aliases: aliases,
        competitions: [compSignalId],
      })
    } else {
      teamsBySlug.get(dedupKey).competitions.push(compSignalId)
    }
  }

  console.log()
  console.log(`Plan: insert ${teamsBySlug.size} unique teams, ${[...teamsBySlug.values()].reduce((n, t) => n + t.competitions.length, 0)} team_competition_map rows, ${allDomainTags.size} domain tags.`)
  console.log()

  if (unmatchedSchools.size > 0) {
    console.log(`⚠ UNMATCHED SCHOOLS (${unmatchedSchools.size}) — these teams will be SKIPPED:`)
    // Note: Array.from() not [...spread] — a line starting with [ after a no-semicolon
    // statement is parsed as property access on the previous expression. Real ASI bug.
    Array.from(unmatchedSchools).sort().forEach(s => console.log(`  - ${s}`))
    console.log()
    console.log('Resolution options:')
    console.log('  1. Add the school to schools table (ingest a candidate from there OR manual INSERT)')
    console.log('  2. Add the school name as a school_aliases row pointing to an existing canonical school')
    console.log('  3. Edit vetted_teams.csv to use the canonical school_name')
    console.log()
  }

  if (unmatchedCompetitions.size > 0) {
    console.log(`⚠ UNMATCHED COMPETITION SLUGS (${unmatchedCompetitions.size}) — these teams will be SKIPPED:`)
    Array.from(unmatchedCompetitions).sort().forEach(s => console.log(`  - ${s}`))
    console.log()
    console.log('This usually means migration 045 has not been run yet.')
    console.log()
  }

  if (DRY_RUN) {
    console.log('DRY RUN complete. No writes performed.')
    console.log('Re-run without --dry-run to apply.')
    return
  }

  // ─── Write phase ───────────────────────────────────────────────────
  console.log('Applying writes...')

  // 1. team_domain_tag_dictionary
  console.log(`  - Seeding ${allDomainTags.size} domain tags...`)
  const domainTagRows = [...allDomainTags].map(t => ({ tag_name: t }))
  const { error: tagErr } = await supabase
    .from('team_domain_tag_dictionary')
    .upsert(domainTagRows, { onConflict: 'tag_name', ignoreDuplicates: true })
  if (tagErr) throw new Error(`team_domain_tag_dictionary insert failed: ${tagErr.message}`)

  // 2. signal_dictionary rows for each team (one per team, category='engineering_team')
  console.log(`  - Inserting ${teamsBySlug.size} signal_dictionary rows (category='engineering_team')...`)
  const sdRows = [...teamsBySlug.values()].map(t => ({
    canonical_name: t.team_name,
    category: 'engineering_team',
    subcategory: null,
    tier_group: null,
    aliases: [t.team_name.toLowerCase(), ...t.aliases.map(a => a.toLowerCase())],
    source_field_hints: ['activities_honors', 'education_description', 'experience_description', 'company_name', 'title'],
    canonical_url: t.website ? (t.website.startsWith('http') ? t.website : `https://${t.website}`) : null,
    description: t.notes || null,
    is_positive: true,
    is_active: true,
  }))

  const { data: insertedSd, error: sdErr } = await supabase
    .from('signal_dictionary')
    .upsert(sdRows, { onConflict: 'canonical_name,category' })
    .select('id, canonical_name')
  if (sdErr) throw new Error(`signal_dictionary insert failed: ${sdErr.message}`)

  const sdByName = new Map(insertedSd.map(r => [r.canonical_name, r.id]))

  // 3. teams rows
  console.log(`  - Inserting ${teamsBySlug.size} teams rows...`)
  const teamRows = [...teamsBySlug.values()].map(t => ({
    signal_id: sdByName.get(t.team_name),
    school_id: t.school_id,
    team_name: t.team_name,
    team_slug: t.team_slug,
    tier_int: t.tier_int,
    domain_tags: t.domain_tags,
    grad_skew: t.grad_skew,
    website: t.website,
    notes: t.notes,
    is_consortium: t.is_consortium,
    consortium_partners: t.consortium_partners,
  }))
  const { data: insertedTeams, error: teamErr } = await supabase
    .from('teams')
    .upsert(teamRows, { onConflict: 'school_id,team_slug' })
    .select('team_id, signal_id')
  if (teamErr) throw new Error(`teams insert failed: ${teamErr.message}`)

  const teamIdBySignal = new Map(insertedTeams.map(r => [r.signal_id, r.team_id]))

  // 4. team_competition_map
  const mapRows = []
  for (const t of teamsBySlug.values()) {
    const teamId = teamIdBySignal.get(sdByName.get(t.team_name))
    for (let i = 0; i < t.competitions.length; i++) {
      mapRows.push({
        team_id: teamId,
        competition_id: t.competitions[i],
        is_primary: i === 0,
      })
    }
  }
  console.log(`  - Inserting ${mapRows.length} team_competition_map rows...`)
  const { error: mapErr } = await supabase
    .from('team_competition_map')
    .upsert(mapRows, { onConflict: 'team_id,competition_id', ignoreDuplicates: true })
  if (mapErr) throw new Error(`team_competition_map insert failed: ${mapErr.message}`)

  console.log()
  console.log(`✓ Imported ${teamsBySlug.size} teams, ${mapRows.length} team-competition links, ${allDomainTags.size} domain tags.`)
  if (unmatchedSchools.size > 0 || unmatchedCompetitions.size > 0) {
    console.log(`⚠ ${unmatchedSchools.size} unmatched schools and ${unmatchedCompetitions.size} unmatched competitions were SKIPPED. Resolve and re-run.`)
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
