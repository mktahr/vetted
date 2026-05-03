#!/usr/bin/env node
//
// scripts/_inv2-expansion-pull.mjs
//
// Pull identify + enrich responses for the 28-company targeted expansion eval.
// Saves to docs/vetted-companies-v1/05-expansion-raw.json (gitignored).
//
// 56 Crust calls total (28 identify + 28 enrich), throttled to 4s/call =
// ~4 min wall clock minimum. Cost: 28 enrich credits ≈ $2.80 at $0.10/credit.
//
// Identify is free; we use it primarily for entity disambiguation (some names
// like "Apple" return many matches; we want crustdata_company_id of the right
// one before we burn an enrich credit on the wrong entity).

import { writeFileSync } from 'fs'
import path from 'path'

const ROOT = '/Users/matt/Desktop/DEV/vetted-app'
const OUT = path.join(ROOT, 'docs/vetted-companies-v1/05-expansion-raw.json')

const KEY = process.env.CRUSTDATA_API_KEY
if (!KEY) { console.error('CRUSTDATA_API_KEY not set'); process.exit(1) }
const HDR = {
  'Authorization': `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  'x-api-version': '2025-11-01',
}
const RATE_DELAY_MS = 4500

// Seed list — 28 companies. Domain-first lookup where possible (most reliable),
// linkedin URL as backup, name as last resort. Includes a `disambiguator_hint`
// field documenting which entity we're after when the name is ambiguous.
const SEEDS = [
  // Automotive (3)
  { label: 'Tesla', tier: 'well-known', sub: 'multi-industry', domain: 'tesla.com',
    expected_industries: ['Automotive', 'Energy', 'Industrial Manufacturing'],
    disambiguator_hint: 'Tesla, Inc. — EV/energy/AI co' },
  { label: 'Rivian', tier: 'well-known', sub: 'single', domain: 'rivian.com',
    expected_industries: ['Automotive'],
    disambiguator_hint: 'Rivian Automotive — EV truck/SUV' },
  { label: 'Slate Auto', tier: 'early-stage', sub: 'single', domain: 'slate.auto',
    expected_industries: ['Automotive'],
    disambiguator_hint: 'Slate Auto — early-stage EV co founded ~2023' },

  // Robotics (3)
  { label: 'Boston Dynamics', tier: 'well-known', sub: 'single', domain: 'bostondynamics.com',
    expected_industries: ['Robotics'],
    disambiguator_hint: 'Boston Dynamics — Spot/Atlas robots' },
  { label: 'Figure AI', tier: 'mid-tier', sub: 'multi-industry', domain: 'figure.ai',
    expected_industries: ['Robotics'],
    disambiguator_hint: 'Figure AI — humanoid robotics' },
  { label: '1X Technologies', tier: 'early-stage', sub: 'single', domain: '1x.tech',
    expected_industries: ['Robotics'],
    disambiguator_hint: '1X Technologies (formerly Halodi) — humanoid' },

  // Energy / Energy Storage (3)
  { label: 'Form Energy', tier: 'mid-tier', sub: 'single', domain: 'formenergy.com',
    expected_industries: ['Energy Storage'],
    disambiguator_hint: 'Form Energy — iron-air batteries for grid' },
  { label: 'Commonwealth Fusion Systems', tier: 'mid-tier', sub: 'single', domain: 'cfs.energy',
    expected_industries: ['Energy'],
    disambiguator_hint: 'Commonwealth Fusion Systems — fusion (tests Nuclear domain_tag)' },
  { label: 'Antora Energy', tier: 'early-stage', sub: 'single', domain: 'antoraenergy.com',
    expected_industries: ['Energy Storage'],
    disambiguator_hint: 'Antora Energy — thermal energy storage' },

  // Climate (2)
  { label: 'Climeworks', tier: 'mid-tier', sub: 'single', domain: 'climeworks.com',
    expected_industries: ['Climate'],
    disambiguator_hint: 'Climeworks — direct air capture (DAC) hardware' },
  { label: 'Heirloom Carbon', tier: 'early-stage', sub: 'single', domain: 'heirloomcarbon.com',
    expected_industries: ['Climate'],
    disambiguator_hint: 'Heirloom — direct air capture' },

  // Semiconductors (3)
  { label: 'NVIDIA', tier: 'well-known', sub: 'multi-industry', domain: 'nvidia.com',
    expected_industries: ['Semiconductors', 'AI'],
    disambiguator_hint: 'NVIDIA — chips + AI compute' },
  { label: 'Cerebras', tier: 'mid-tier', sub: 'single', domain: 'cerebras.net',
    expected_industries: ['Semiconductors'],
    disambiguator_hint: 'Cerebras Systems — AI chip startup' },
  { label: 'Tenstorrent', tier: 'early-stage', sub: 'single', domain: 'tenstorrent.com',
    expected_industries: ['Semiconductors'],
    disambiguator_hint: 'Tenstorrent — RISC-V AI chip startup' },

  // Consumer Electronics (2)
  { label: 'Apple', tier: 'well-known', sub: 'multi-industry', domain: 'apple.com',
    expected_industries: ['Consumer Electronics', 'Services'],
    disambiguator_hint: 'Apple, Inc. — extreme multi-industry test (devices + services + media)' },
  { label: 'Humane', tier: 'early-stage', sub: 'single', domain: 'humane.com',
    expected_industries: ['Consumer Electronics'],
    disambiguator_hint: 'Humane — failed AI Pin (interesting failed-product edge case)' },

  // Industrial Manufacturing (2 — dropped Caterpillar per push-back)
  { label: 'Hadrian', tier: 'early-stage', sub: 'single', domain: 'hadrian.co',
    expected_industries: ['Industrial Manufacturing'],
    disambiguator_hint: 'Hadrian — autonomous CNC machine shops for aerospace/defense' },
  { label: 'John Deere', tier: 'well-known', sub: 'multi-industry', domain: 'deere.com',
    expected_industries: ['Industrial Manufacturing'],
    disambiguator_hint: 'Deere & Company — agriculture machinery (FLAG: Agriculture out-of-scope, expect Industrial Manufacturing as primary)' },

  // Materials (1)
  { label: 'Boom Supersonic', tier: 'mid-tier', sub: 'multi-industry', domain: 'boomsupersonic.com',
    expected_industries: ['Aerospace', 'Materials'],
    disambiguator_hint: 'Boom Supersonic — supersonic aircraft + materials science (Symphony engine)' },

  // Maritime (1)
  { label: 'Saildrone', tier: 'mid-tier', sub: 'single', domain: 'saildrone.com',
    expected_industries: ['Maritime'],
    disambiguator_hint: 'Saildrone — autonomous unmanned surface vehicles' },

  // Aerospace (2)
  { label: 'SpaceX', tier: 'well-known', sub: 'multi-industry', domain: 'spacex.com',
    expected_industries: ['Aerospace', 'Industrial Manufacturing'],
    disambiguator_hint: 'SpaceX — rockets + Starlink (FLAG: Telecommunications out-of-scope, expect Aerospace primary)' },
  { label: 'Stoke Space', tier: 'early-stage', sub: 'single', domain: 'stokespace.com',
    expected_industries: ['Aerospace'],
    disambiguator_hint: 'Stoke Space — early-stage reusable rocket startup' },

  // Defense — non-hardware (2 — tests Decision #12 cross-listing)
  { label: 'Palantir', tier: 'well-known', sub: 'multi-industry', domain: 'palantir.com',
    expected_industries: ['Defense', 'AI'],
    disambiguator_hint: 'Palantir Technologies — Foundry/Gotham software for defense + commercial' },
  { label: 'Rebellion Defense', tier: 'mid-tier', sub: 'single', domain: 'rebelliondefense.com',
    expected_industries: ['Defense'],
    disambiguator_hint: 'Rebellion Defense — software/AI for DoD (non-hardware/Defense)' },

  // eVTOL (1 — added per push-back)
  { label: 'Joby Aviation', tier: 'mid-tier', sub: 'single', domain: 'jobyaviation.com',
    expected_industries: ['Aerospace'],
    disambiguator_hint: 'Joby Aviation — eVTOL air taxi (tests eVTOL domain_tag)' },

  // Cross-cutting / edge cases (3)
  { label: 'Mercor', tier: 'early-stage', sub: 'multi-industry', domain: 'mercor.com',
    expected_industries: ['AI'],
    disambiguator_hint: 'Mercor — AI recruiting startup (Thiel Fellows; tests AI primary + HR tag)' },
  { label: 'Notion', tier: 'well-known', sub: 'single', domain: 'notion.so',
    expected_industries: ['SaaS'],
    disambiguator_hint: 'Notion Labs — productivity SaaS (tests AI-suppression: AI features but core is productivity, NO AI tag expected)' },
  { label: 'Scale AI', tier: 'mid-tier', sub: 'multi-industry', domain: 'scale.com',
    expected_industries: ['AI'],
    disambiguator_hint: 'Scale AI — AI data labeling (tests AI primary; massive defense customer base — sanity check on AI vs Defense disambiguation)' },
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

async function enrich(crustId) {
  const data = await safeFetch('https://api.crustdata.com/company/enrich', {
    crustdata_company_ids: [crustId],
    fields: ['basic_info', 'revenue', 'headcount', 'funding', 'locations', 'taxonomy', 'social_profiles'],
  }, `enrich(${crustId})`)
  return data?.[0]?.matches?.[0]?.company_data ?? null
}

const results = []
for (let i = 0; i < SEEDS.length; i++) {
  const seed = SEEDS[i]
  log(`\n[${i+1}/${SEEDS.length}] ${seed.label} (${seed.tier}, ${seed.sub})`)
  log(`  identifying ${seed.domain}...`)
  const matches = await identify(seed.domain)
  if (matches.length === 0) {
    log(`  -> no match`)
    results.push({ seed, error: 'identify_no_match' })
    await sleep(RATE_DELAY_MS); continue
  }
  // Pick top match (Crust ranks canonical first per inv1 verification)
  const best = matches[0]
  const id = best.company_data?.crustdata_company_id
  log(`  -> id=${id} name="${best.company_data?.basic_info?.name}" (${matches.length} candidates)`)
  await sleep(RATE_DELAY_MS)
  log(`  enriching...`)
  const e = await enrich(id)
  if (!e) {
    log(`  -> enrich failed`)
    results.push({ seed, crustdata_company_id: id, identify_match_count: matches.length,
      identify_basic_info: best.company_data?.basic_info, error: 'enrich_failed' })
    await sleep(RATE_DELAY_MS); continue
  }
  results.push({ seed, crustdata_company_id: id, identify_match_count: matches.length,
    identify_basic_info: best.company_data?.basic_info, enrich: e })
  await sleep(RATE_DELAY_MS)
}

writeFileSync(OUT, JSON.stringify(results, null, 2))
log(`\nWrote ${results.length} records to ${OUT}`)
log(`Identify-failed: ${results.filter(r => r.error === 'identify_no_match').length}`)
log(`Enrich-failed:   ${results.filter(r => r.error === 'enrich_failed').length}`)
log(`OK:              ${results.filter(r => r.enrich).length}`)
