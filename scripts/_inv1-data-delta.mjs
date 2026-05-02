#!/usr/bin/env node
// Investigation 1: data delta — search vs enrich, 10 companies covering variance.
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const ROOT = '/Users/matt/Desktop/DEV/vetted-app'
const OUT_DIR = path.join(ROOT, 'docs/vetted-companies-v1')
const RAW_PATH = path.join(OUT_DIR, '02-data-delta-raw.json')
const RPT_PATH = path.join(OUT_DIR, '02-data-delta.md')

const KEY = process.env.CRUSTDATA_API_KEY
const HDR = { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json', 'x-api-version': '2025-11-01' }
const RATE_DELAY_MS = 4500

const SEEDS = [
  { label: 'Anduril Industries', tier: 'well-known', expected_category: 'hardware', domain: 'anduril.com' },
  { label: 'Stripe', tier: 'well-known', expected_category: 'non_hardware', domain: 'stripe.com' },
  { label: 'OpenAI', tier: 'well-known', expected_category: 'non_hardware', domain: 'openai.com' },
  { label: 'Skydio', tier: 'mid-tier', expected_category: 'hardware', domain: 'skydio.com' },
  { label: 'Shield AI', tier: 'mid-tier', expected_category: 'hardware', domain: 'shield.ai' },
  { label: 'Illumina', tier: 'biotech-hw-leaning', expected_category: 'hardware', expected_industry: 'Medical Devices', domain: 'illumina.com' },
  { label: 'Recursion Pharmaceuticals', tier: 'biotech-sw-leaning', expected_category: 'non_hardware', expected_industry: 'Biotech', domain: 'recursion.com' },
  { label: 'Hugging Face', tier: 'ambiguous', expected_category: 'non_hardware', domain: 'huggingface.co' },
  { label: 'Inflection AI', tier: 'obscure-mid', expected_category: 'non_hardware', domain: 'inflection.ai' },
  { label: 'Astra Space', tier: 'obscure-hw', expected_category: 'hardware', domain: 'astra.com' },
]

const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (...a) => process.stderr.write(a.join(' ') + '\n')

async function safeFetch(url, body, label) {
  try {
    const r = await fetch(url, { method: 'POST', headers: HDR, body: JSON.stringify(body) })
    const data = await r.json()
    if (!r.ok || data?.error) {
      log(`  ${label} HTTP ${r.status} ${data?.error?.message || ''}`)
    }
    return data
  } catch (err) {
    log(`  ${label} EXCEPTION: ${err.message}`)
    return null
  }
}

async function identify(domain) {
  const data = await safeFetch('https://api.crustdata.com/company/identify',
    { domains: [domain], exact_match: true }, `identify(${domain})`)
  return data?.[0]?.matches ?? []
}

async function search(crustId) {
  const data = await safeFetch('https://api.crustdata.com/company/search', {
    filters: { field: 'crustdata_company_id', type: '=', value: crustId },
    limit: 1,
    fields: ['basic_info','revenue','headcount','funding','hiring','locations','taxonomy','followers','social_profiles','software_reviews','metadata'],
  }, `search(${crustId})`)
  return data?.companies?.[0] ?? null
}

async function enrich(crustId) {
  const data = await safeFetch('https://api.crustdata.com/company/enrich', {
    crustdata_company_ids: [crustId],
    fields: ['basic_info','revenue','headcount','funding','hiring','web_traffic','seo','competitors','employee_reviews','people','locations','taxonomy','followers','news','software_reviews','social_profiles','status'],
  }, `enrich(${crustId})`)
  return data?.[0]?.matches?.[0]?.company_data ?? null
}

mkdirSync(OUT_DIR, { recursive: true })

const results = []
for (let i = 0; i < SEEDS.length; i++) {
  const seed = SEEDS[i]
  log(`\n[${i+1}/${SEEDS.length}] ${seed.label} (${seed.tier})`)
  log(`  identifying ${seed.domain}...`)
  const matches = await identify(seed.domain)
  if (matches.length === 0) {
    log(`  -> no match`)
    results.push({ seed, error: 'identify_no_match' })
    await sleep(RATE_DELAY_MS); continue
  }
  // Pick the highest-confidence match where the LinkedIn URL or domain looks canonical
  const best = matches[0]
  const id = best.company_data?.crustdata_company_id
  log(`  -> id=${id} name="${best.company_data?.basic_info?.name}" (${matches.length} candidates total)`)
  if (matches.length > 1) {
    log(`     ⚠️  ${matches.length} matches for domain — top match selected. Other names: ${matches.slice(1,4).map(m=>m.company_data?.basic_info?.name).join(', ')}`)
  }
  await sleep(RATE_DELAY_MS)
  log(`  fetching search...`)
  const s = await search(id)
  await sleep(RATE_DELAY_MS)
  log(`  fetching enrich...`)
  const e = await enrich(id)
  results.push({ seed, crustdata_company_id: id, identify_match_count: matches.length, search: s, enrich: e })
  await sleep(RATE_DELAY_MS)
}

log(`\nWriting raw JSON to ${RAW_PATH}...`)
writeFileSync(RAW_PATH, JSON.stringify(results, null, 2))
log(`Wrote ${results.length} company records.`)

// ---- Build the report ----
const report = []
const w = (...a) => report.push(a.join(''))

w(`# Investigation 1 — Data Delta Report\n`)
w(`*Generated: ${new Date().toISOString()}*\n`)
w(`*Tested ${results.length} companies via /company/identify → /company/search → /company/enrich.*  `)
w(`*Raw JSON: \`docs/vetted-companies-v1/02-data-delta-raw.json\`*\n`)

const KEY_FIELDS = [
  ['basic_info.name', 'identity'],
  ['basic_info.primary_domain', 'identity'],
  ['basic_info.website', 'identity'],
  ['basic_info.professional_network_url', 'identity'],
  ['basic_info.professional_network_id', 'identity'],
  ['basic_info.company_type', 'firmographic'],
  ['basic_info.year_founded', 'firmographic'],
  ['basic_info.employee_count_range', 'firmographic'],
  ['basic_info.industries', 'taxonomy'],
  ['basic_info.description', 'firmographic-enrich-only'],
  ['headcount.total', 'firmographic'],
  ['headcount.timeseries', 'firmographic-enrich-only'],
  ['taxonomy.professional_network_industry', 'taxonomy'],
  ['taxonomy.categories', 'taxonomy'],
  ['locations.country', 'location'],
  ['locations.headquarters', 'location-enrich-only'],
  ['locations.all_office_addresses', 'location-enrich-only'],
  ['funding.total_investment_usd', 'funding'],
  ['funding.last_round_type', 'funding'],
  ['funding.last_round_amount_usd', 'funding'],
  ['funding.last_fundraise_date', 'funding'],
  ['funding.investors', 'funding'],
  ['funding.milestones', 'funding-enrich-only'],
  ['funding.acquisitions', 'funding-enrich-only'],
  ['people.founders', 'people-enrich-only'],
  ['people.cxos', 'people-enrich-only'],
  ['people.decision_makers', 'people-enrich-only'],
  ['social_profiles.crunchbase.uuid', 'social'],
  ['social_profiles.twitter_url', 'social'],
  ['employee_reviews.overall_rating.rating', 'reviews-enrich-only'],
]

function classify(obj, p) {
  if (!obj) return 'NORESP'
  let v = obj
  for (const k of p.split('.')) {
    if (v == null) return 'MISSING'
    v = v[k]
  }
  if (v === undefined) return 'MISSING'
  if (v === null) return 'NULL'
  if (Array.isArray(v)) return v.length === 0 ? 'EMPTY[]' : `[${v.length}]`
  if (typeof v === 'string') return v.trim() === '' ? 'EMPTY""' : (v.length > 28 ? `"${v.slice(0,25)}..."` : `"${v}"`)
  if (typeof v === 'object') return Object.keys(v).length === 0 ? 'EMPTY{}' : `{${Object.keys(v).length}}`
  return String(v)
}

w(`\n## Per-company comparison\n`)
for (const r of results) {
  if (r.error) { w(`### ${r.seed.label} — ERROR: ${r.error}\n`); continue }
  w(`### ${r.seed.label}`)
  w(`*${r.seed.tier} · crustdata_company_id: ${r.crustdata_company_id} · expected category: ${r.seed.expected_category}${r.seed.expected_industry ? ` / industry: ${r.seed.expected_industry}` : ''} · identify returned ${r.identify_match_count} match${r.identify_match_count===1?'':'es'}*\n`)
  w(`| field | search | enrich |`)
  w(`|---|---|---|`)
  for (const [p] of KEY_FIELDS) {
    w(`| \`${p}\` | ${classify(r.search, p)} | ${classify(r.enrich, p)} |`)
  }
  w('')
}

const totals = {}
for (const [p] of KEY_FIELDS) totals[p] = { s: 0, e: 0 }
const successful = results.filter(r => !r.error)
for (const r of successful) {
  for (const [p] of KEY_FIELDS) {
    const isSet = v => !v.startsWith('NORESP') && !v.startsWith('MISSING') && !v.startsWith('NULL') && !v.startsWith('EMPTY')
    if (isSet(classify(r.search, p))) totals[p].s++
    if (isSet(classify(r.enrich, p))) totals[p].e++
  }
}
const n = successful.length
w(`\n## Cross-company fill rate\n`)
w(`*${n} successful companies*\n`)
w(`| field | category | search | enrich | enrich-only delta |`)
w(`|---|---|---|---|---|`)
for (const [p, cat] of KEY_FIELDS) {
  const t = totals[p]
  const delta = t.e - t.s
  w(`| \`${p}\` | ${cat} | ${t.s}/${n} (${Math.round(t.s/n*100)}%) | ${t.e}/${n} (${Math.round(t.e/n*100)}%) | ${delta > 0 ? '+'+delta : delta} |`)
}

const ctSet = new Set()
for (const r of successful) {
  const ct = r.search?.basic_info?.company_type ?? r.enrich?.basic_info?.company_type
  if (ct) ctSet.add(ct)
}
w(`\n## company_type values observed (informs issue #1 enum)\n`)
for (const v of [...ctSet].sort()) w(`- \`"${v}"\``)

const lrtSet = new Set()
for (const r of successful) {
  const lrt = r.enrich?.funding?.last_round_type ?? r.search?.funding?.last_round_type
  if (lrt) lrtSet.add(lrt)
}
w(`\n## funding.last_round_type values observed (the noisy field)\n`)
for (const v of [...lrtSet].sort()) w(`- \`"${v}"\``)

const roundSet = new Set()
for (const r of successful) {
  for (const m of (r.enrich?.funding?.milestones || [])) {
    if (m.round) roundSet.add(m.round.split(' - ')[0])
  }
}
w(`\n## All milestones[].round prefixes observed (informs derived funding_stage logic)\n`)
for (const v of [...roundSet].sort()) w(`- \`"${v}"\``)

writeFileSync(RPT_PATH, report.join('\n'))
log(`\nReport written to ${RPT_PATH}`)
log('Done.')
