// scripts/sync-reference.mjs
//
// Single sync script that loads /reference/ CSVs into their corresponding
// DB tables. CSV is the source of truth; the script computes a diff against
// the current DB state and applies it.
//
// Usage:
//   node scripts/sync-reference.mjs --dry-run          # diff only, no writes
//   node scripts/sync-reference.mjs                    # sync everything
//   node scripts/sync-reference.mjs --only=signals/athletics.csv
//   node scripts/sync-reference.mjs --only=signals/athletics.csv,investors/investor_tiers.csv
//   node scripts/sync-reference.mjs --table=signal_dictionary
//
// What this handles:
//   • signal_dictionary  (reference/signals/*.csv — one CSV per category)
//   • investor_tiers     (reference/investors/investor_tiers.csv)
//
// What this does NOT handle (yet):
//   • companies + company_year_scores  (use scripts/reseed-companies.mjs)
//   • teams + competitions + team_domain_tags  (use scripts/import-teams.mjs)
//   • schools + school_aliases          (use scripts/seed-universities.mjs + seed-school-aliases.mjs)
//   • search_intents/intent_signal_map.csv  (reference-only, not DB-loaded today)
//
// When you add a new sync target, add a handler in `handlers` below.

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, basename } from 'path'
import { createClient } from '@supabase/supabase-js'

// ─── Env ────────────────────────────────────────────────────────────────

const envFile = readFileSync('.env.local', 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=')
    return [k.trim(), v.join('=').trim()]
  })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const ONLY_ARG = argv.find(a => a.startsWith('--only='))
const ONLY_FILES = ONLY_ARG ? ONLY_ARG.slice('--only='.length).split(',').map(s => s.trim()) : null
const TABLE_ARG = argv.find(a => a.startsWith('--table='))
const ONLY_TABLE = TABLE_ARG ? TABLE_ARG.slice('--table='.length) : null

const REFERENCE_DIR = 'reference'

// ─── CSV parser (handles quoted fields with commas) ─────────────────────

function parseCsv(text) {
  const rows = []
  const lines = text.split(/\r?\n/).filter(l => l.length > 0)
  if (lines.length === 0) return { header: [], rows: [] }

  function splitLine(line) {
    const out = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (inQuote) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
        else if (c === '"') { inQuote = false }
        else { cur += c }
      } else {
        if (c === ',') { out.push(cur); cur = '' }
        else if (c === '"') { inQuote = true }
        else { cur += c }
      }
    }
    out.push(cur)
    return out
  }

  const header = splitLine(lines[0])
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i])
    const row = {}
    for (let j = 0; j < header.length; j++) row[header[j]] = cells[j] ?? ''
    rows.push(row)
  }
  return { header, rows }
}

// ─── Helpers ────────────────────────────────────────────────────────────

function semiArray(s) {
  return (s || '').split(';').map(x => x.trim()).filter(Boolean)
}

function csvBool(s) {
  const v = (s || '').toLowerCase().trim()
  return v === 'true' || v === 't' || v === '1'
}

function nullable(s) {
  const v = (s || '').trim()
  return v === '' ? null : v
}

function normalizeTierGroup(v) {
  // Older CSVs have tier_group as raw "3" / "2" / "1"; DB uses "tier_3"/"tier_2"/"tier_1".
  // Normalize on the way in.
  const t = (v || '').trim()
  if (t === '') return null
  if (/^\d+$/.test(t)) return `tier_${t}`
  return t
}

function normalizeSourceFieldHint(h) {
  // Older CSVs use column-name format (activities_raw, description_raw, etc.).
  // DB convention is logical-name format. Translate.
  const map = {
    activities_raw: 'activities_honors',
    description_raw: 'experience_description',
    honors_raw: 'activities_honors',
    summary_raw: 'about',
    headline_raw: 'headline',
    title_raw: 'title',
    company_name_raw: 'company_name',
  }
  return map[h] || h
}

function normalizeSourceFieldHints(s) {
  return semiArray(s).map(normalizeSourceFieldHint)
}

// ─── Handlers ───────────────────────────────────────────────────────────
//
// Each handler:
//   • path: CSV path relative to REFERENCE_DIR
//   • table: target DB table
//   • parseRow(rawRow): convert CSV row to DB row shape
//   • conflictKey: column(s) used for UPSERT
//   • diffKey?: column(s) used to compute "rows in DB not in CSV" for deletion (defaults to conflictKey)
//   • categoryFilter?: when set, the diff is scoped to rows matching this category (used so e.g.
//                      athletics.csv's diff only considers existing athletics rows, not the whole table)

const handlers = []

// One handler per signal CSV. Each CSV's category is in its filename / its rows.
// We register them dynamically by reading reference/signals/*.csv.

const SIGNAL_CSVS = (() => {
  const dir = join(REFERENCE_DIR, 'signals')
  if (!statSync(dir, { throwIfNoEntry: false })) return []
  return readdirSync(dir).filter(f => f.endsWith('.csv'))
})()

for (const filename of SIGNAL_CSVS) {
  const categoryName = filename.replace(/\.csv$/, '')
  handlers.push({
    path: `signals/${filename}`,
    table: 'signal_dictionary',
    conflictKey: ['canonical_name', 'category'],
    categoryFilter: categoryName,
    parseRow(raw) {
      return {
        canonical_name: raw.canonical_name.trim(),
        category: raw.category?.trim() || categoryName,  // fall back to filename-derived category
        subcategory: nullable(raw.subcategory),
        tier_group: normalizeTierGroup(raw.tier_group),
        aliases: semiArray(raw.aliases),
        source_field_hints: normalizeSourceFieldHints(raw.source_field_hints),
        canonical_url: nullable(raw.canonical_url),
        description: nullable(raw.description),
        is_positive: csvBool(raw.is_positive),
        is_active: csvBool(raw.is_active),
      }
    },
  })
}

// investor_tiers
handlers.push({
  path: 'investors/investor_tiers.csv',
  table: 'investor_tiers',
  conflictKey: ['investor_name'],
  parseRow(raw) {
    return {
      investor_name: raw.investor_name.trim(),
      tier: parseInt(raw.tier, 10),
      investor_type: raw.investor_type?.trim() || 'vc_firm',
      notes: nullable(raw.notes),
    }
  },
  // After upsert, also keep legacy `kind` column in sync with investor_type for any readers
  // still reading it. (Removed in a future cleanup migration.)
  postSyncSql: `UPDATE investor_tiers SET kind = CASE WHEN investor_type = 'angel' THEN 'angel' ELSE 'firm' END WHERE kind IS DISTINCT FROM CASE WHEN investor_type = 'angel' THEN 'angel' ELSE 'firm' END;`,
})

// ─── Sync engine ────────────────────────────────────────────────────────

async function fetchExisting(table, categoryFilter) {
  let q = supabase.from(table).select('*')
  if (categoryFilter && table === 'signal_dictionary') {
    q = q.eq('category', categoryFilter)
  }
  const { data, error } = await q
  if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`)
  return data || []
}

function rowKey(row, conflictCols) {
  return conflictCols.map(c => row[c]).join('||')
}

function deepEqual(a, b) {
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((v, i) => deepEqual(v, b[i]))
  }
  return false
}

function diffRow(csvRow, dbRow) {
  // Returns list of changed columns (excluding always-present cols like id/created_at)
  const changed = []
  for (const k of Object.keys(csvRow)) {
    const c = csvRow[k]
    const d = dbRow[k]
    // Coerce arrays for comparison (Postgres returns arrays as JS arrays already)
    const equal = Array.isArray(c) ? deepEqual(c, d) : c === d || (c == null && d == null)
    if (!equal) changed.push(k)
  }
  return changed
}

async function syncHandler(h) {
  if (ONLY_FILES && !ONLY_FILES.some(f => h.path === f || h.path.endsWith(`/${f}`) || h.path === `signals/${f}` || h.path === `investors/${f}`)) {
    return { skipped: true }
  }
  if (ONLY_TABLE && h.table !== ONLY_TABLE) {
    return { skipped: true }
  }

  const fullPath = join(REFERENCE_DIR, h.path)
  if (!statSync(fullPath, { throwIfNoEntry: false })) {
    return { error: `CSV not found: ${fullPath}` }
  }

  const text = readFileSync(fullPath, 'utf-8')
  const { rows: rawRows } = parseCsv(text)
  const csvRows = rawRows.map(r => h.parseRow(r))

  const dbRows = await fetchExisting(h.table, h.categoryFilter)

  const csvByKey = new Map()
  for (const r of csvRows) csvByKey.set(rowKey(r, h.conflictKey), r)
  const dbByKey = new Map()
  for (const r of dbRows) dbByKey.set(rowKey(r, h.conflictKey), r)

  const toInsert = []
  const toUpdate = []
  const toDelete = []

  for (const [k, csvRow] of csvByKey) {
    if (!dbByKey.has(k)) {
      toInsert.push(csvRow)
    } else {
      const changed = diffRow(csvRow, dbByKey.get(k))
      if (changed.length > 0) toUpdate.push({ row: csvRow, changed })
    }
  }
  for (const [k, dbRow] of dbByKey) {
    if (!csvByKey.has(k)) toDelete.push(dbRow)
  }

  const summary = {
    path: h.path,
    table: h.table,
    csv_rows: csvRows.length,
    db_rows: dbRows.length,
    inserts: toInsert.length,
    updates: toUpdate.length,
    deletes: toDelete.length,
  }

  if (DRY_RUN) {
    return { summary, toInsert, toUpdate, toDelete, dryRun: true }
  }

  // Apply: deletes → updates → inserts (so we don't leak FK violations during cascade)
  if (toDelete.length > 0) {
    for (const row of toDelete) {
      const q = supabase.from(h.table).delete()
      for (const c of h.conflictKey) q.eq(c, row[c])
      const { error } = await q
      if (error) throw new Error(`Delete failed in ${h.table} for ${rowKey(row, h.conflictKey)}: ${error.message}`)
    }
  }
  if (toUpdate.length > 0) {
    for (const { row } of toUpdate) {
      const q = supabase.from(h.table).update(row)
      for (const c of h.conflictKey) q.eq(c, row[c])
      const { error } = await q
      if (error) throw new Error(`Update failed in ${h.table} for ${rowKey(row, h.conflictKey)}: ${error.message}`)
    }
  }
  if (toInsert.length > 0) {
    const { error } = await supabase.from(h.table).insert(toInsert)
    if (error) throw new Error(`Insert failed in ${h.table}: ${error.message}`)
  }

  if (h.postSyncSql) {
    // Supabase JS client doesn't expose arbitrary SQL — use a placeholder note for the user.
    summary.post_sync_note = `Run this SQL after sync: ${h.postSyncSql}`
  }

  return { summary, dryRun: false }
}

async function main() {
  const results = []
  for (const h of handlers) {
    try {
      const r = await syncHandler(h)
      results.push({ ...r, path: h.path })
    } catch (err) {
      results.push({ path: h.path, error: err.message })
    }
  }

  // Report
  console.log(`\n${DRY_RUN ? 'DRY RUN — ' : ''}Reference sync — ${results.filter(r => !r.skipped).length} CSVs processed`)
  console.log('─'.repeat(80))
  for (const r of results) {
    if (r.skipped) continue
    if (r.error) {
      console.log(`✗ ${r.path} — ERROR: ${r.error}`)
      continue
    }
    const s = r.summary
    const ops = []
    if (s.inserts) ops.push(`+${s.inserts} inserts`)
    if (s.updates) ops.push(`~${s.updates} updates`)
    if (s.deletes) ops.push(`-${s.deletes} deletes`)
    if (ops.length === 0) ops.push('no changes')
    console.log(`${DRY_RUN ? '·' : '✓'} ${s.path} (${s.table}) — CSV=${s.csv_rows} / DB=${s.db_rows} → ${ops.join(', ')}`)

    if (DRY_RUN) {
      for (const ins of r.toInsert.slice(0, 5)) {
        console.log(`    + ${ins[Object.keys(ins)[0]]}`)
      }
      if (r.toInsert.length > 5) console.log(`    + … and ${r.toInsert.length - 5} more`)
      for (const upd of r.toUpdate.slice(0, 5)) {
        console.log(`    ~ ${upd.row[Object.keys(upd.row)[0]]} (changed: ${upd.changed.join(', ')})`)
      }
      if (r.toUpdate.length > 5) console.log(`    ~ … and ${r.toUpdate.length - 5} more`)
      for (const del of r.toDelete.slice(0, 5)) {
        console.log(`    - ${del[Object.keys(del)[0]]}`)
      }
      if (r.toDelete.length > 5) console.log(`    - … and ${r.toDelete.length - 5} more`)
    }

    if (s.post_sync_note) console.log(`    ! ${s.post_sync_note}`)
  }
  console.log('')
}

main().catch(err => {
  console.error('Sync failed:', err)
  process.exit(1)
})
