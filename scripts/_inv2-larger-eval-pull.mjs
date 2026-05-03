#!/usr/bin/env node
//
// scripts/_inv2-larger-eval-pull.mjs
//
// Pull identify + enrich responses for the 70-company larger eval.
// Saves to docs/vetted-companies-v1/06-larger-eval-raw.json (gitignored).
//
// 140 Crust calls total (70 identify + 70 enrich), throttled to 4.5s/call =
// ~10 min wall clock minimum. Cost: ~70 enrich credits = ~$7 at $0.10/credit
// (some entries marked `?Crust` may not resolve and won't burn enrich credits).
//
// Coverage approach (see docs/vetted-companies-v1/06-larger-eval-list.md):
// - All 15 hardware + 13 non-hardware V1 industries get >=1 example
// - 31 hardware / 29 non-hardware / 10 edge cases
// - Deliberate retests of round-3 failure boundaries (Climate, Maritime, AI-feature)
// - 6 ?Crust-risky entries kept; expect some misses

import { writeFileSync } from 'fs'
import path from 'path'

const ROOT = '/Users/matt/Desktop/DEV/vetted-app'
const OUT = path.join(ROOT, 'docs/vetted-companies-v1/06-larger-eval-raw.json')

const KEY = process.env.CRUSTDATA_API_KEY
if (!KEY) { console.error('CRUSTDATA_API_KEY not set'); process.exit(1) }
const HDR = {
  'Authorization': `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  'x-api-version': '2025-11-01',
}
const RATE_DELAY_MS = 4500

// Seed list — 70 companies. See docs/vetted-companies-v1/06-larger-eval-list.md
// for the full coverage matrix and rationale per pick.
const SEEDS = [
  // ---- HARDWARE (31) ----

  // Automotive (2)
  { label: 'Lucid Motors', tier: 'well-known', sub: 'single', domain: 'lucidmotors.com',
    expected_industries: ['Automotive'],
    disambiguator_hint: 'Pure EV maker' },
  { label: 'Hyundai', tier: 'well-known', sub: 'multi-industry', domain: 'hyundai.com',
    expected_industries: ['Automotive'],
    disambiguator_hint: 'Hyundai Motor Co — owns Boston Dynamics; multi-industry test (Auto + potential Robotics)' },

  // Robotics (2)
  { label: 'Skydio', tier: 'mid-tier', sub: 'multi-industry', domain: 'skydio.com',
    expected_industries: ['Robotics'],
    disambiguator_hint: 'Autonomous drones — could land Defense (military USVs); industries=[Robotics, Defense]' },
  { label: 'Agility Robotics', tier: 'mid-tier', sub: 'single', domain: 'agilityrobotics.com',
    expected_industries: ['Robotics'],
    disambiguator_hint: 'Humanoid robotics (Digit)' },

  // Medical Devices (4 — NEW)
  { label: 'Intuitive Surgical', tier: 'well-known', sub: 'single', domain: 'intuitive.com',
    expected_industries: ['Medical Devices'],
    disambiguator_hint: 'da Vinci robotic surgery system' },
  { label: 'Stryker', tier: 'well-known', sub: 'single', domain: 'stryker.com',
    expected_industries: ['Medical Devices'],
    disambiguator_hint: 'Orthopedic/surgical/neurotech devices' },
  { label: 'Edwards Lifesciences', tier: 'well-known', sub: 'single', domain: 'edwards.com',
    expected_industries: ['Medical Devices'],
    disambiguator_hint: 'Heart valves and hemodynamic monitoring' },
  { label: 'iRhythm Technologies', tier: 'mid-tier', sub: 'single', domain: 'irhythmtech.com',
    expected_industries: ['Medical Devices'],
    disambiguator_hint: 'Wearable cardiac monitors — Medical Devices vs HealthTech boundary' },

  // Biotech / hardware (2 — NEW)
  { label: 'Illumina', tier: 'well-known', sub: 'single', domain: 'illumina.com',
    expected_industries: ['Biotech'],
    disambiguator_hint: 'Sequencing instruments — tests Biotech/hardware branch' },
  { label: '10x Genomics', tier: 'mid-tier', sub: 'single', domain: '10xgenomics.com',
    expected_industries: ['Biotech'],
    disambiguator_hint: 'Single-cell sequencing instruments — Biotech/hardware' },

  // Energy (2)
  { label: 'NextEra Energy', tier: 'well-known', sub: 'single', domain: 'nexteraenergy.com',
    expected_industries: ['Energy'],
    disambiguator_hint: 'Utility-scale renewable energy generation' },
  { label: 'Helion Energy', tier: 'early-stage', sub: 'single', domain: 'helionenergy.com',
    expected_industries: ['Energy'],
    disambiguator_hint: 'Fusion startup — domain_tag Nuclear test' },

  // Energy Storage (1)
  { label: 'Sila Nanotechnologies', tier: 'mid-tier', sub: 'single', domain: 'silanano.com',
    expected_industries: ['Energy Storage'],
    disambiguator_hint: 'Silicon anode materials for batteries — Energy Storage vs Materials boundary' },

  // Climate (2 — deliberate retest of Climeworks failure boundary)
  { label: 'Twelve', tier: 'early-stage', sub: 'single', domain: 'twelve.co',
    expected_industries: ['Climate'],
    disambiguator_hint: 'CO2-to-fuel conversion — should NOT land Energy (Climeworks failed this way in round-3)' },
  { label: 'Charm Industrial', tier: 'early-stage', sub: 'single', domain: 'charmindustrial.com',
    expected_industries: ['Climate'],
    disambiguator_hint: 'Bio-oil sequestration — carbon removal' },

  // Semiconductors (2)
  { label: 'AMD', tier: 'well-known', sub: 'single', domain: 'amd.com',
    expected_industries: ['Semiconductors'],
    disambiguator_hint: 'CPUs/GPUs — domain_tag AI test' },
  { label: 'Groq', tier: 'mid-tier', sub: 'single', domain: 'groq.com',
    expected_industries: ['Semiconductors'],
    disambiguator_hint: 'AI inference chips — Semiconductors primary, AI domain_tag' },

  // Consumer Electronics (2)
  { label: 'Sonos', tier: 'well-known', sub: 'single', domain: 'sonos.com',
    expected_industries: ['Consumer Electronics'],
    disambiguator_hint: 'Smart speakers' },
  { label: 'GoPro', tier: 'well-known', sub: 'single', domain: 'gopro.com',
    expected_industries: ['Consumer Electronics'],
    disambiguator_hint: 'Action cameras' },

  // Industrial Manufacturing (1)
  { label: 'Built Robotics', tier: 'early-stage', sub: 'multi-industry', domain: 'builtrobotics.com',
    expected_industries: ['Industrial Manufacturing'],
    disambiguator_hint: 'Autonomous construction equipment — Industrial Manufacturing vs Robotics edge' },

  // Materials (2 — NEW as primary)
  { label: 'Boston Metal', tier: 'early-stage', sub: 'single', domain: 'bostonmetal.com',
    expected_industries: ['Materials'],
    disambiguator_hint: 'Green steel via molten oxide electrolysis — Materials primary' },
  { label: 'Mosaic Materials', tier: 'early-stage', sub: 'single', domain: 'mosaicmaterials.com',
    expected_industries: ['Materials'],
    disambiguator_hint: 'DAC sorbent materials — Materials vs Climate boundary; ?Crust risk' },

  // Maritime (2 — deliberate retest of Saildrone failure boundary)
  { label: 'Saronic Technologies', tier: 'mid-tier', sub: 'multi-industry', domain: 'saronic.com',
    expected_industries: ['Maritime'],
    disambiguator_hint: 'Autonomous USVs for defense — should NOT land Defense (Saildrone failed this way); industries=[Maritime, Defense]' },
  { label: 'ThayerMahan', tier: 'early-stage', sub: 'single', domain: 'thayermahan.com',
    expected_industries: ['Maritime'],
    disambiguator_hint: 'Undersea sensing — Maritime primary; ?Crust risk' },

  // Defense / hardware (4)
  { label: 'Anduril Industries', tier: 'well-known', sub: 'multi-industry', domain: 'anduril.com',
    expected_industries: ['Defense'],
    disambiguator_hint: 'RE-INCLUDE — re-test Maritime industry firing on fresh pull; industries=[Defense, Aerospace, Maritime, Industrial Manufacturing]' },
  { label: 'Lockheed Martin', tier: 'well-known', sub: 'multi-industry', domain: 'lockheedmartin.com',
    expected_industries: ['Defense'],
    disambiguator_hint: 'Full defense conglomerate — industries=[Defense, Aerospace, Maritime]' },
  { label: 'Shield AI', tier: 'mid-tier', sub: 'multi-industry', domain: 'shield.ai',
    expected_industries: ['Defense'],
    disambiguator_hint: 'Defense + AI core — industries=[Defense, Aerospace], domain_tags=[AI, Drones]' },
  { label: 'Northrop Grumman', tier: 'well-known', sub: 'multi-industry', domain: 'northropgrumman.com',
    expected_industries: ['Defense'],
    disambiguator_hint: 'Defense conglomerate — industries=[Defense, Aerospace]' },

  // Aerospace / hardware (2)
  { label: 'Astranis Space Technologies', tier: 'mid-tier', sub: 'single', domain: 'astranis.com',
    expected_industries: ['Aerospace'],
    disambiguator_hint: 'Geo satellites — domain_tag Satellites' },
  { label: 'Vast Space', tier: 'early-stage', sub: 'single', domain: 'vastspace.com',
    expected_industries: ['Aerospace'],
    disambiguator_hint: 'Space stations — early-stage; ?Crust risk' },

  // Other Hardware (1 — NEW)
  { label: 'Carbon', tier: 'mid-tier', sub: 'single', domain: 'carbon3d.com',
    expected_industries: ['Other Hardware'],
    disambiguator_hint: 'Industrial 3D printing — could also be Industrial Manufacturing; ambiguous' },

  // ---- NON-HARDWARE (29) ----

  // SaaS (4)
  { label: 'Datadog', tier: 'well-known', sub: 'single', domain: 'datadoghq.com',
    expected_industries: ['SaaS'],
    disambiguator_hint: 'Observability — domain_tags=[Infrastructure, B2B, Enterprise Software, Analytics]' },
  { label: 'Snowflake', tier: 'well-known', sub: 'multi-industry', domain: 'snowflake.com',
    expected_industries: ['SaaS'],
    disambiguator_hint: 'Data cloud — multi-element output test' },
  { label: 'MongoDB', tier: 'well-known', sub: 'single', domain: 'mongodb.com',
    expected_industries: ['SaaS'],
    disambiguator_hint: 'NoSQL database SaaS' },
  { label: 'Cloudflare', tier: 'well-known', sub: 'multi-industry', domain: 'cloudflare.com',
    expected_industries: ['SaaS'],
    disambiguator_hint: 'Edge + Security + AI; primary=SaaS, domain_tags=[Infrastructure, Cybersecurity, AI]' },

  // AI (4)
  { label: 'Anthropic', tier: 'well-known', sub: 'single', domain: 'anthropic.com',
    expected_industries: ['AI'],
    disambiguator_hint: 'Foundation models — AI suppression test (no AI tag)' },
  { label: 'OpenAI', tier: 'well-known', sub: 'multi-industry', domain: 'openai.com',
    expected_industries: ['AI'],
    disambiguator_hint: 'Foundation models + ChatGPT consumer — industries=[AI] or [AI, Consumer Tech]' },
  { label: 'Mistral AI', tier: 'mid-tier', sub: 'single', domain: 'mistral.ai',
    expected_industries: ['AI'],
    disambiguator_hint: 'Open-weights foundation models' },
  { label: 'Perplexity', tier: 'mid-tier', sub: 'single', domain: 'perplexity.ai',
    expected_industries: ['AI'],
    disambiguator_hint: 'AI search' },

  // FinTech (3 — NEW)
  { label: 'Stripe', tier: 'well-known', sub: 'single', domain: 'stripe.com',
    expected_industries: ['FinTech'],
    disambiguator_hint: 'Payments — domain_tags=[Payments, Infrastructure]' },
  { label: 'Plaid', tier: 'well-known', sub: 'single', domain: 'plaid.com',
    expected_industries: ['FinTech'],
    disambiguator_hint: 'Bank account linking infrastructure' },
  { label: 'Mercury', tier: 'mid-tier', sub: 'single', domain: 'mercury.com',
    expected_industries: ['FinTech'],
    disambiguator_hint: 'Banking-as-a-service for startups' },

  // Investment Banking (1 — NEW)
  { label: 'Goldman Sachs', tier: 'well-known', sub: 'multi-industry', domain: 'goldmansachs.com',
    expected_industries: ['Investment Banking'],
    disambiguator_hint: 'IB + Asset Mgmt + Trading — industries=[Investment Banking, Quant/Trading]' },

  // Quant/Trading (2 — NEW)
  { label: 'Citadel', tier: 'well-known', sub: 'multi-industry', domain: 'citadel.com',
    expected_industries: ['Quant/Trading'],
    disambiguator_hint: 'Hedge fund + Citadel Securities sister co for market-making' },
  { label: 'Jane Street', tier: 'well-known', sub: 'single', domain: 'janestreet.com',
    expected_industries: ['Quant/Trading'],
    disambiguator_hint: 'Pure quant trading firm' },

  // Blockchain & Web3 (2 — NEW)
  { label: 'Coinbase', tier: 'well-known', sub: 'single', domain: 'coinbase.com',
    expected_industries: ['Blockchain & Web3'],
    disambiguator_hint: 'Crypto exchange — Blockchain & Web3 vs FinTech boundary' },
  { label: 'Chainalysis', tier: 'mid-tier', sub: 'single', domain: 'chainalysis.com',
    expected_industries: ['Blockchain & Web3'],
    disambiguator_hint: 'Blockchain compliance/analytics — vs FinTech / Defense boundary' },

  // Consumer Tech (3 — NEW)
  { label: 'Airbnb', tier: 'well-known', sub: 'single', domain: 'airbnb.com',
    expected_industries: ['Consumer Tech'],
    disambiguator_hint: 'Marketplace' },
  { label: 'Discord', tier: 'well-known', sub: 'single', domain: 'discord.com',
    expected_industries: ['Consumer Tech'],
    disambiguator_hint: 'Messaging/community platform' },
  { label: 'Roblox', tier: 'well-known', sub: 'multi-industry', domain: 'roblox.com',
    expected_industries: ['Consumer Tech'],
    disambiguator_hint: 'Gaming platform — primary=Consumer Tech, domain_tags=[Gaming]' },

  // HealthTech (2 — NEW)
  { label: 'Hims & Hers', tier: 'well-known', sub: 'single', domain: 'hims.com',
    expected_industries: ['HealthTech'],
    disambiguator_hint: 'Telehealth + DTC pharma' },
  { label: 'Oscar Health', tier: 'well-known', sub: 'single', domain: 'hioscar.com',
    expected_industries: ['HealthTech'],
    disambiguator_hint: 'Health insurance tech' },

  // Biotech / non-hardware (2 — NEW)
  { label: 'Recursion Pharmaceuticals', tier: 'mid-tier', sub: 'single', domain: 'recursion.com',
    expected_industries: ['Biotech'],
    disambiguator_hint: 'AI drug discovery / TechBio platform — non_hw Biotech branch' },
  { label: 'Tempus AI', tier: 'mid-tier', sub: 'multi-industry', domain: 'tempus.com',
    expected_industries: ['Biotech'],
    disambiguator_hint: 'AI clinical genomics — Biotech vs HealthTech vs AI boundary' },

  // Services (2 — NEW)
  { label: 'Accenture', tier: 'well-known', sub: 'single', domain: 'accenture.com',
    expected_industries: ['Services'],
    disambiguator_hint: 'Global consulting' },
  { label: 'McKinsey & Company', tier: 'well-known', sub: 'single', domain: 'mckinsey.com',
    expected_industries: ['Services'],
    disambiguator_hint: 'Strategy consulting; ?Crust risk' },

  // Legal (1 — NEW)
  { label: 'Harvey AI', tier: 'early-stage', sub: 'single', domain: 'harvey.ai',
    expected_industries: ['Legal'],
    disambiguator_hint: 'Legal AI — Legal vs AI boundary; expect Legal primary, AI domain_tag' },

  // Defense / non-hardware (1)
  { label: 'Govini', tier: 'mid-tier', sub: 'single', domain: 'govini.com',
    expected_industries: ['Defense'],
    disambiguator_hint: 'Defense analytics SaaS — non_hw/Defense; ?Crust risk' },

  // Aerospace / non-hardware (2 — NEW)
  { label: 'Slingshot Aerospace', tier: 'mid-tier', sub: 'single', domain: 'slingshotaerospace.com',
    expected_industries: ['Aerospace'],
    disambiguator_hint: 'Space domain awareness — non_hw/Aerospace branch' },
  { label: 'LeoLabs', tier: 'mid-tier', sub: 'single', domain: 'leolabs.space',
    expected_industries: ['Aerospace'],
    disambiguator_hint: 'Space situational awareness; ?Crust risk' },

  // ---- EDGE CASES (10) ----

  // AI-feature-not-core (3 — should NOT get AI domain_tag)
  { label: 'Asana', tier: 'well-known', sub: 'single', domain: 'asana.com',
    expected_industries: ['SaaS'],
    disambiguator_hint: 'Productivity SaaS w/ AI features — expect SaaS, domain_tags=[Productivity, B2B], NO AI tag' },
  { label: 'Zoom', tier: 'well-known', sub: 'single', domain: 'zoom.us',
    expected_industries: ['SaaS'],
    disambiguator_hint: 'Video + AI Companion — expect SaaS, domain_tags=[B2B, Productivity], NO AI tag' },
  { label: 'Salesforce', tier: 'well-known', sub: 'multi-industry', domain: 'salesforce.com',
    expected_industries: ['SaaS'],
    disambiguator_hint: 'CRM + Cloud + Agentforce — expect SaaS, domain_tags=[B2B, Enterprise Software], NO AI tag' },

  // Extreme multi-industry stress (3)
  { label: 'Amazon', tier: 'well-known', sub: 'multi-industry', domain: 'amazon.com',
    expected_industries: ['Consumer Tech'],
    disambiguator_hint: 'Marketplace + AWS + Devices + Streaming — extreme test; primary=Consumer Tech, industries=[Consumer Tech, SaaS]' },
  { label: 'Microsoft', tier: 'well-known', sub: 'multi-industry', domain: 'microsoft.com',
    expected_industries: ['SaaS'],
    disambiguator_hint: 'Cloud + Productivity + Gaming + Devices — primary=SaaS' },
  { label: 'Sony', tier: 'well-known', sub: 'multi-industry', domain: 'sony.com',
    expected_industries: ['Consumer Electronics'],
    disambiguator_hint: 'Devices + Gaming + Streaming + Music — primary=Consumer Electronics; domain_tags=[Gaming, Streaming]' },

  // Out-of-scope industries (3 — should fall to nearest V1 fit, NOT null)
  { label: 'Verizon', tier: 'well-known', sub: 'single', domain: 'verizon.com',
    expected_industries: ['Services'],
    disambiguator_hint: 'OUT-OF-SCOPE: Telecommunications gap — should fall to Services or null' },
  { label: 'Spotify', tier: 'well-known', sub: 'single', domain: 'spotify.com',
    expected_industries: ['Consumer Tech'],
    disambiguator_hint: 'OUT-OF-SCOPE: Streaming/Music as primary — should land Consumer Tech with domain_tags=[Streaming, Consumer]' },
  { label: 'WeWork', tier: 'well-known', sub: 'single', domain: 'wework.com',
    expected_industries: ['Services'],
    disambiguator_hint: 'OUT-OF-SCOPE: Real Estate gap — should fall to Services or null' },

  // Buffer / re-include (1)
  { label: 'Palantir', tier: 'well-known', sub: 'multi-industry', domain: 'palantir.com',
    expected_industries: ['Defense'],
    disambiguator_hint: 'RE-INCLUDE — confirms cross-listed Defense/non-hardware behavior is stable across runs' },
]

console.error(`Pulling ${SEEDS.length} companies...`)

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
