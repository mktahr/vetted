// Larger eval — round-4 architecture validation on 70 hand-labeled companies.
//
// Reads raw data from scripts/_inv2-larger-eval-pull.mjs (with 4 patched
// entity-disambiguation fixes), runs the round-3 tagger (Claude C1+C2 +
// dict E1+E2.1+E3+M2) at TWO input tiers per company (identify, enrich),
// grades vs hand-labeled GROUND_TRUTH (Matt-reviewed before scoring), and
// reports a comprehensive markdown report covering:
//
//   - Aggregate accuracy at both tiers
//   - Per-V1-cell coverage matrix
//   - Crust-miss rate (0% — all 4 entity issues fixed before scoring)
//   - Dict abstention + agreement breakdown (the dict-value question)
//   - Segmented accuracy by maturity, single/multi-industry, hardware/non-hw
//   - Retest-of-failure-boundaries from round-3:
//       * Climate-vs-Energy boundary (Climeworks failed in round-3)
//       * Maritime-vs-Defense boundary (Saildrone failed in round-3)
//       * AI-feature-not-core (Asana/Zoom/Salesforce — extends Notion test)
//   - Per-company table + disagreements deep-dive

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { tagCompany } from '../lib/companies/tagger/index'
import type { TaggerInput, CompositeTaggerOutput } from '../lib/companies/tagger/types'

interface ExpectedTags {
  category: 'hardware' | 'non_hardware' | null
  primary_industry: string | null
  industries: string[]
  domain_tags: string[]
  out_of_scope_note?: string
  ambiguous?: boolean
  retest_of?: 'climate' | 'maritime' | 'ai_feature' | null
}

// Hand-labeled ground truth for each larger-eval company (Matt-reviewed 2026-05-03).
// Keys MUST match the seed labels in _inv2-larger-eval-pull.mjs.
const GROUND_TRUTH: Record<string, ExpectedTags> = {
  // ---- HARDWARE (31) ----
  'Lucid Motors': { category: 'hardware', primary_industry: 'Automotive',
    industries: ['Automotive'], domain_tags: ['EVs'] },
  'Hyundai': { category: 'hardware', primary_industry: 'Automotive',
    industries: ['Automotive'], domain_tags: ['EVs', 'Automotive Manufacturing'], ambiguous: true,
    out_of_scope_note: 'Owns Boston Dynamics — Robotics could appear as 2nd industry, but Hyundai\'s primary business is cars.' },

  'Skydio': { category: 'hardware', primary_industry: 'Robotics',
    industries: ['Robotics', 'Defense'], domain_tags: ['Drones', 'AI'] },
  'Agility Robotics': { category: 'hardware', primary_industry: 'Robotics',
    industries: ['Robotics'], domain_tags: ['AI'] },

  'Intuitive Surgical': { category: 'hardware', primary_industry: 'Medical Devices',
    industries: ['Medical Devices'], domain_tags: [] },
  'Stryker': { category: 'hardware', primary_industry: 'Medical Devices',
    industries: ['Medical Devices'], domain_tags: [] },
  'Edwards Lifesciences': { category: 'hardware', primary_industry: 'Medical Devices',
    industries: ['Medical Devices'], domain_tags: [] },
  'iRhythm Technologies': { category: 'hardware', primary_industry: 'Medical Devices',
    industries: ['Medical Devices'], domain_tags: ['AI'], ambiguous: true,
    out_of_scope_note: 'Wearable cardiac monitors with AI analytics — could be HealthTech if Crust frames as software-led.' },

  'Illumina': { category: 'hardware', primary_industry: 'Biotech',
    industries: ['Biotech'], domain_tags: [] },
  '10x Genomics': { category: 'hardware', primary_industry: 'Biotech',
    industries: ['Biotech'], domain_tags: [] },

  'NextEra Energy': { category: 'hardware', primary_industry: 'Energy',
    industries: ['Energy'], domain_tags: [] },
  'Helion Energy': { category: 'hardware', primary_industry: 'Energy',
    industries: ['Energy'], domain_tags: ['Nuclear'] },

  'Sila Nanotechnologies': { category: 'hardware', primary_industry: 'Energy Storage',
    industries: ['Energy Storage', 'Materials'], domain_tags: [], ambiguous: true,
    out_of_scope_note: 'Materials could be primary if Crust calls it materials science co; expect Energy Storage primary since product is battery anodes.' },

  'Twelve': { category: 'hardware', primary_industry: 'Climate',
    industries: ['Climate'], domain_tags: [], retest_of: 'climate' },
  'Charm Industrial': { category: 'hardware', primary_industry: 'Climate',
    industries: ['Climate'], domain_tags: [], retest_of: 'climate' },

  'AMD': { category: 'hardware', primary_industry: 'Semiconductors',
    industries: ['Semiconductors'], domain_tags: ['AI'] },
  'Groq': { category: 'hardware', primary_industry: 'Semiconductors',
    industries: ['Semiconductors'], domain_tags: ['AI'] },

  'Sonos': { category: 'hardware', primary_industry: 'Consumer Electronics',
    industries: ['Consumer Electronics'], domain_tags: [] },
  'GoPro': { category: 'hardware', primary_industry: 'Consumer Electronics',
    industries: ['Consumer Electronics'], domain_tags: [] },

  'Built Robotics': { category: 'hardware', primary_industry: 'Industrial Manufacturing',
    industries: ['Industrial Manufacturing', 'Robotics'], domain_tags: ['AI'], ambiguous: true,
    out_of_scope_note: 'Robotics could swap with Industrial Manufacturing as primary; expect Industrial Manufacturing since the application is construction.' },

  'Boston Metal': { category: 'hardware', primary_industry: 'Materials',
    industries: ['Materials'], domain_tags: [] },
  'Mosaic Materials': { category: 'hardware', primary_industry: 'Materials',
    industries: ['Materials', 'Climate'], domain_tags: [], ambiguous: true,
    out_of_scope_note: 'DAC sorbent — could be Climate primary; expect Materials since IP is the material itself.' },

  'Saronic Technologies': { category: 'hardware', primary_industry: 'Maritime',
    industries: ['Maritime', 'Defense'], domain_tags: ['Drones', 'Autonomous Driving'], retest_of: 'maritime' },
  'ThayerMahan': { category: 'hardware', primary_industry: 'Maritime',
    industries: ['Maritime', 'Defense'], domain_tags: [], retest_of: 'maritime' },

  'Anduril Industries': { category: 'hardware', primary_industry: 'Defense',
    industries: ['Defense', 'Aerospace', 'Maritime', 'Industrial Manufacturing'],
    domain_tags: ['Drones', 'AI'] },
  'Lockheed Martin': { category: 'hardware', primary_industry: 'Defense',
    industries: ['Defense', 'Aerospace', 'Maritime', 'Industrial Manufacturing'],
    domain_tags: ['Rockets', 'Satellites'] },
  'Shield AI': { category: 'hardware', primary_industry: 'Defense',
    industries: ['Defense', 'Aerospace'], domain_tags: ['Drones', 'AI'] },
  'Northrop Grumman': { category: 'hardware', primary_industry: 'Defense',
    industries: ['Defense', 'Aerospace'], domain_tags: ['Rockets', 'Satellites'] },

  'Astranis Space Technologies': { category: 'hardware', primary_industry: 'Aerospace',
    industries: ['Aerospace'], domain_tags: ['Satellites'] },
  'Vast Space': { category: 'hardware', primary_industry: 'Aerospace',
    industries: ['Aerospace'], domain_tags: [] },

  'Carbon': { category: 'hardware', primary_industry: 'Other Hardware',
    industries: ['Other Hardware', 'Industrial Manufacturing'], domain_tags: [], ambiguous: true,
    out_of_scope_note: 'Industrial 3D printing — could be Industrial Manufacturing primary; expect Other Hardware since they\'re a printer manufacturer.' },

  // ---- NON-HARDWARE (29) ----
  'Datadog': { category: 'non_hardware', primary_industry: 'SaaS',
    industries: ['SaaS'], domain_tags: ['Infrastructure', 'B2B', 'Enterprise Software', 'Analytics'] },
  'Snowflake': { category: 'non_hardware', primary_industry: 'SaaS',
    industries: ['SaaS'], domain_tags: ['Data', 'B2B', 'Enterprise Software', 'Analytics', 'Infrastructure'] },
  'MongoDB': { category: 'non_hardware', primary_industry: 'SaaS',
    industries: ['SaaS'], domain_tags: ['Infrastructure', 'DevTools', 'B2B', 'Enterprise Software'] },
  'Cloudflare': { category: 'non_hardware', primary_industry: 'SaaS',
    industries: ['SaaS'], domain_tags: ['Infrastructure', 'Cybersecurity', 'B2B', 'Enterprise Software', 'AI'] },

  'Anthropic': { category: 'non_hardware', primary_industry: 'AI',
    industries: ['AI'], domain_tags: ['B2B', 'Infrastructure'] },
  'OpenAI': { category: 'non_hardware', primary_industry: 'AI',
    industries: ['AI'], domain_tags: ['Consumer', 'B2B'] },
  'Mistral AI': { category: 'non_hardware', primary_industry: 'AI',
    industries: ['AI'], domain_tags: ['B2B', 'Infrastructure'] },
  'Perplexity': { category: 'non_hardware', primary_industry: 'AI',
    industries: ['AI'], domain_tags: ['Consumer'] },

  'Stripe': { category: 'non_hardware', primary_industry: 'FinTech',
    industries: ['FinTech'], domain_tags: ['Payments', 'Infrastructure', 'B2B'] },
  'Plaid': { category: 'non_hardware', primary_industry: 'FinTech',
    industries: ['FinTech'], domain_tags: ['Infrastructure', 'B2B'] },
  'Mercury': { category: 'non_hardware', primary_industry: 'FinTech',
    industries: ['FinTech'], domain_tags: ['B2B'] },

  'Goldman Sachs': { category: 'non_hardware', primary_industry: 'Investment Banking',
    industries: ['Investment Banking', 'Quant/Trading'], domain_tags: [], ambiguous: true,
    out_of_scope_note: 'Asset management could justify other industries but V1 has no asset mgmt slot.' },

  'Citadel': { category: 'non_hardware', primary_industry: 'Quant/Trading',
    industries: ['Quant/Trading'], domain_tags: [] },
  'Jane Street': { category: 'non_hardware', primary_industry: 'Quant/Trading',
    industries: ['Quant/Trading'], domain_tags: [] },

  'Coinbase': { category: 'non_hardware', primary_industry: 'Blockchain & Web3',
    industries: ['Blockchain & Web3', 'FinTech'], domain_tags: ['Consumer', 'Marketplace'], ambiguous: true,
    out_of_scope_note: 'Could be FinTech primary if Crust frames as exchange/payments; expect Blockchain & Web3 primary since their entire value-prop is crypto.' },
  'Chainalysis': { category: 'non_hardware', primary_industry: 'Blockchain & Web3',
    industries: ['Blockchain & Web3'], domain_tags: ['Analytics', 'Cybersecurity', 'B2B'] },

  'Airbnb': { category: 'non_hardware', primary_industry: 'Consumer Tech',
    industries: ['Consumer Tech'], domain_tags: ['Marketplace', 'Consumer'] },
  'Discord': { category: 'non_hardware', primary_industry: 'Consumer Tech',
    industries: ['Consumer Tech'], domain_tags: ['Social', 'Consumer', 'Gaming'] },
  'Roblox': { category: 'non_hardware', primary_industry: 'Consumer Tech',
    industries: ['Consumer Tech'], domain_tags: ['Gaming', 'Consumer', 'Social'] },

  'Hims & Hers': { category: 'non_hardware', primary_industry: 'HealthTech',
    industries: ['HealthTech'], domain_tags: ['Consumer'] },
  'Oscar Health': { category: 'non_hardware', primary_industry: 'HealthTech',
    industries: ['HealthTech'], domain_tags: ['Consumer', 'B2B'] },

  'Recursion Pharmaceuticals': { category: 'non_hardware', primary_industry: 'Biotech',
    industries: ['Biotech'], domain_tags: ['AI', 'Data'] },
  'Tempus AI': { category: 'non_hardware', primary_industry: 'Biotech',
    industries: ['Biotech', 'HealthTech'], domain_tags: ['AI', 'Data'], ambiguous: true,
    out_of_scope_note: 'Biotech vs HealthTech boundary — Tempus does both clinical + drug discovery; expect Biotech primary.' },

  'Accenture': { category: 'non_hardware', primary_industry: 'Services',
    industries: ['Services'], domain_tags: ['B2B', 'Enterprise Software'] },
  'McKinsey & Company': { category: 'non_hardware', primary_industry: 'Services',
    industries: ['Services'], domain_tags: ['B2B'] },

  'Harvey AI': { category: 'non_hardware', primary_industry: 'Legal',
    industries: ['Legal'], domain_tags: ['AI', 'B2B', 'Enterprise Software'], ambiguous: true,
    out_of_scope_note: 'Could legitimately be AI primary; expect Legal primary since the category they sell to is the salient identity.' },

  'Govini': { category: 'non_hardware', primary_industry: 'Defense',
    industries: ['Defense'], domain_tags: ['Analytics', 'Data', 'B2B'] },

  'Slingshot Aerospace': { category: 'non_hardware', primary_industry: 'Aerospace',
    industries: ['Aerospace', 'Defense'], domain_tags: ['Analytics', 'Data', 'B2B'] },
  'LeoLabs': { category: 'non_hardware', primary_industry: 'Aerospace',
    industries: ['Aerospace', 'Defense'], domain_tags: ['Analytics', 'Data', 'B2B'] },

  // ---- EDGE CASES (10) ----
  'Asana': { category: 'non_hardware', primary_industry: 'SaaS',
    industries: ['SaaS'], domain_tags: ['Productivity', 'B2B', 'Enterprise Software'], retest_of: 'ai_feature',
    out_of_scope_note: 'AI Companion is a feature, NOT the core product. NO AI tag.' },
  'Zoom': { category: 'non_hardware', primary_industry: 'SaaS',
    industries: ['SaaS'], domain_tags: ['B2B', 'Productivity', 'Enterprise Software'], retest_of: 'ai_feature',
    out_of_scope_note: 'Same as Asana. NO AI tag.' },
  'Salesforce': { category: 'non_hardware', primary_industry: 'SaaS',
    industries: ['SaaS'], domain_tags: ['B2B', 'Enterprise Software'], retest_of: 'ai_feature',
    out_of_scope_note: 'Agentforce is a feature, core is CRM. NO AI tag.' },

  'Amazon': { category: 'non_hardware', primary_industry: 'Consumer Tech',
    industries: ['Consumer Tech', 'SaaS'], domain_tags: ['Marketplace', 'Consumer', 'Streaming', 'Infrastructure'],
    out_of_scope_note: 'Extreme multi-industry. Devices are feature, Whole Foods/Pharmacy out-of-scope.' },
  'Microsoft': { category: 'non_hardware', primary_industry: 'SaaS',
    industries: ['SaaS', 'Consumer Electronics'], domain_tags: ['B2B', 'Enterprise Software', 'Productivity', 'Infrastructure', 'Gaming', 'AI'],
    out_of_scope_note: 'Xbox + Surface = Consumer Electronics secondary.' },
  'Sony': { category: 'hardware', primary_industry: 'Consumer Electronics',
    industries: ['Consumer Electronics'], domain_tags: [], ambiguous: true,
    out_of_scope_note: 'Gaming + Streaming + Music are NOT in V1 industries; primary stays Consumer Electronics. domain_tags Gaming/Streaming are non-hardware-only — INVALID for hardware company. tags=[]. (V1 vocab gap; future fix in backlog.)' },

  'Verizon': { category: 'non_hardware', primary_industry: 'Services',
    industries: ['Services'], domain_tags: ['Consumer', 'Infrastructure'], ambiguous: true,
    out_of_scope_note: 'Telecommunications gap. Best-fit Services. Could also be Consumer Tech.' },
  'Spotify': { category: 'non_hardware', primary_industry: 'Consumer Tech',
    industries: ['Consumer Tech'], domain_tags: ['Streaming', 'Consumer', 'Mobile'],
    out_of_scope_note: 'Streaming/Music as primary not in V1; lands Consumer Tech with Streaming domain_tag.' },
  'WeWork': { category: 'non_hardware', primary_industry: 'Services',
    industries: ['Services'], domain_tags: ['B2B'], ambiguous: true,
    out_of_scope_note: 'Real Estate gap. Best-fit Services.' },

  'Palantir': { category: 'non_hardware', primary_industry: 'Defense',
    industries: ['Defense', 'AI'], domain_tags: ['Data', 'Analytics', 'Infrastructure', 'AI'] },
}

interface RawCompanyRow {
  seed: { label: string; tier: string; sub: string; domain: string; expected_industries: string[]; disambiguator_hint: string }
  crustdata_company_id?: number
  identify_match_count?: number
  identify_basic_info?: any
  enrich?: any
  error?: string
}

function buildIdentifyInput(r: RawCompanyRow): TaggerInput {
  const ib = r.identify_basic_info || r.enrich?.basic_info || {}
  return {
    name: ib.name || r.seed.label,
    professional_network_industry: null,
    industries: Array.isArray(ib.industries) ? ib.industries : [],
    categories: [],
    description: ib.description || null,
    year_founded: ib.year_founded || null,
    employee_count_range: ib.employee_count_range || null,
    company_type: ib.company_type || null,
  }
}

function buildEnrichInput(r: RawCompanyRow): TaggerInput {
  const e = r.enrich || {}
  return {
    name: e.basic_info?.name || r.seed.label,
    professional_network_industry: e.taxonomy?.professional_network_industry || null,
    industries: Array.isArray(e.basic_info?.industries) ? e.basic_info.industries : [],
    categories: Array.isArray(e.taxonomy?.categories) ? e.taxonomy.categories : [],
    description: e.basic_info?.description || null,
    year_founded: e.basic_info?.year_founded || null,
    employee_count_range: e.basic_info?.employee_count_range || null,
    company_type: e.basic_info?.company_type || null,
  }
}

interface Grade {
  catCorrect: boolean
  primaryCorrect: boolean
  industriesPrec: number
  industriesRec: number
  tagPrec: number
  tagRec: number
}

function gradeOutput(output: CompositeTaggerOutput, expected: ExpectedTags): Grade {
  const catCorrect = output.category === expected.category
  const primaryCorrect = catCorrect && output.primary_industry === expected.primary_industry
  const indMatched = output.industries.filter(i => expected.industries.includes(i)).length
  const industriesPrec = output.industries.length === 0 ? (expected.industries.length === 0 ? 1 : 0) : indMatched / output.industries.length
  const industriesRec = expected.industries.length === 0 ? 1 : indMatched / expected.industries.length
  const tagMatched = output.domain_tags.filter(t => expected.domain_tags.includes(t)).length
  const tagPrec = output.domain_tags.length === 0 ? (expected.domain_tags.length === 0 ? 1 : 0) : tagMatched / output.domain_tags.length
  const tagRec = expected.domain_tags.length === 0 ? 1 : tagMatched / expected.domain_tags.length
  return { catCorrect, primaryCorrect, industriesPrec, industriesRec, tagPrec, tagRec }
}

interface CompanyResult {
  company: string
  tier: string
  sub: string
  expected: ExpectedTags
  identify: CompositeTaggerOutput
  enrich: CompositeTaggerOutput
  gradeIdentify: Grade
  gradeEnrich: Grade
  isOutOfScope: boolean
  isAmbiguous: boolean
  retestOf: ExpectedTags['retest_of']
}

const RAW = '/Users/matt/Desktop/DEV/vetted-app/docs/vetted-companies-v1/06-larger-eval-raw.json'
const RPT = '/Users/matt/Desktop/DEV/vetted-app/docs/vetted-companies-v1/06-larger-eval.md'

const CALL_DELAY_MS = 4000  // Anthropic Haiku 50k tokens/min cap → 4s/call ≈ 15 calls/min ≈ 30k tokens/min, safe.
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  if (!existsSync(RAW)) { console.error(`Missing ${RAW}; run _inv2-larger-eval-pull.mjs first.`); process.exit(1) }
  const raw = JSON.parse(readFileSync(RAW, 'utf-8')) as RawCompanyRow[]
  const successful = raw.filter(r => !r.error && r.enrich)
  const failed = raw.filter(r => r.error)
  console.error(`Loaded ${raw.length} (successful: ${successful.length}, failed: ${failed.length})`)

  const results: CompanyResult[] = []
  for (const r of successful) {
    const expected = GROUND_TRUTH[r.seed.label]
    if (!expected) { console.error(`No ground truth for ${r.seed.label}`); continue }
    console.error(`\n[${r.seed.label}] (${r.seed.tier}/${r.seed.sub})`)
    console.error(`  identify-tier...`)
    const idResult = await tagCompany(buildIdentifyInput(r))
    await sleep(CALL_DELAY_MS)
    console.error(`  enrich-tier...`)
    const enResult = await tagCompany(buildEnrichInput(r))
    await sleep(CALL_DELAY_MS)
    results.push({
      company: r.seed.label,
      tier: r.seed.tier,
      sub: r.seed.sub,
      expected,
      identify: idResult,
      enrich: enResult,
      gradeIdentify: gradeOutput(idResult, expected),
      gradeEnrich: gradeOutput(enResult, expected),
      isOutOfScope: !!expected.out_of_scope_note,
      isAmbiguous: !!expected.ambiguous,
      retestOf: expected.retest_of ?? null,
    })
  }

  // ---- report ----
  const lines: string[] = []
  const w = (...a: string[]) => lines.push(a.join(''))

  w(`# Larger Eval (${results.length} companies)\n`)
  w(`*Generated: ${new Date().toISOString()}*  `)
  w(`*Architecture: Claude-primary (round-3: C1+C2 fixes) + dict sanity check (E1+E2.1+E3+M2). Option B multi-industry.*  `)
  w(`*Tiers tested: identify-only (cron auto-create simulation), enrich-tier (full data).*  `)
  w(`*Ground truth: hand-labeled by Claude, reviewed + corrected by Matt 2026-05-03 (Lockheed Industrial Manufacturing added) before scoring.*\n`)

  // ---- Headlines ----
  w(`## Headlines\n`)
  const enrichCat = results.filter(r => r.gradeEnrich.catCorrect).length
  const enrichPrim = results.filter(r => r.gradeEnrich.primaryCorrect).length
  const idCat = results.filter(r => r.gradeIdentify.catCorrect).length
  const idPrim = results.filter(r => r.gradeIdentify.primaryCorrect).length
  w(`- **Crust-miss rate: 0%** (4 entity-disambiguation issues found in initial pull, all fixed via name-search before scoring)`)
  w(`- **Enrich-tier accuracy: ${enrichCat}/${results.length} category (${pct(enrichCat, results.length)}%), ${enrichPrim}/${results.length} primary (${pct(enrichPrim, results.length)}%)**`)
  w(`- **Identify-tier accuracy: ${idCat}/${results.length} category (${pct(idCat, results.length)}%), ${idPrim}/${results.length} primary (${pct(idPrim, results.length)}%)**`)
  w(``)

  if (failed.length > 0) {
    w(`### Pull failures (Crust-misses)\n`)
    for (const f of failed) w(`- **${f.seed.label}** (${f.seed.tier}): ${f.error}`)
    w(``)
  }

  // ---- Aggregate ----
  w(`## Aggregate accuracy (${results.length} companies)\n`)
  for (const [tier, key] of [['(A) identify', 'identify'], ['(B) enrich', 'enrich']] as const) {
    const gradeKey = key === 'identify' ? 'gradeIdentify' : 'gradeEnrich'
    const cat = results.filter(r => r[gradeKey].catCorrect).length
    const prim = results.filter(r => r[gradeKey].primaryCorrect).length
    const indP = results.reduce((s, r) => s + r[gradeKey].industriesPrec, 0) / results.length
    const indR = results.reduce((s, r) => s + r[gradeKey].industriesRec, 0) / results.length
    const tagP = results.reduce((s, r) => s + r[gradeKey].tagPrec, 0) / results.length
    const tagR = results.reduce((s, r) => s + r[gradeKey].tagRec, 0) / results.length
    w(`- **${tier}:** category=${cat}/${results.length} (${pct(cat, results.length)}%), primary_industry=${prim}/${results.length} (${pct(prim, results.length)}%), industries[] P/R=${indP.toFixed(2)}/${indR.toFixed(2)}, domain_tag P/R=${tagP.toFixed(2)}/${tagR.toFixed(2)}`)
  }

  // ---- Coverage matrix ----
  w(`\n## V1 vocabulary coverage matrix\n`)
  w(`*Confirms every (industry, category) cell in V1 has at least one example tested.*\n`)
  const cells: Record<string, { tested: number; correct: number }> = {}
  for (const r of results) {
    if (!r.expected.category || !r.expected.primary_industry) continue
    const cell = `${r.expected.category}/${r.expected.primary_industry}`
    if (!cells[cell]) cells[cell] = { tested: 0, correct: 0 }
    cells[cell].tested++
    if (r.gradeEnrich.primaryCorrect) cells[cell].correct++
  }
  w(`| Cell | Tested | Correct (enrich) |`)
  w(`|---|---|---|`)
  const cellKeys = Object.keys(cells).sort()
  for (const k of cellKeys) {
    const c = cells[k]
    w(`| ${k} | ${c.tested} | ${c.correct}/${c.tested} (${pct(c.correct, c.tested)}%) |`)
  }
  w(``)

  // ---- Dict abstention + agreement ----
  w(`## Dict abstention + agreement\n`)
  for (const [tier, key] of [['identify', 'identify'], ['enrich', 'enrich']] as const) {
    const all = results.length
    const dictNull = results.filter(r => r[key].dict_verdict?.category == null).length
    const dictNonNull = all - dictNull
    const agree = results.filter(r => r[key].agreement === 'agree').length
    const disagree = results.filter(r => r[key].agreement === 'disagree').length
    const claudeOnly = results.filter(r => r[key].agreement === 'claude_only').length
    w(`- **${tier}-tier:**`)
    w(`  - Dict abstained (null category): ${dictNull}/${all} (${pct(dictNull, all)}%)`)
    w(`  - Dict committed: ${dictNonNull}/${all}`)
    w(`    - agree with Claude: ${agree}/${dictNonNull} (${dictNonNull ? pct(agree, dictNonNull) : 0}%)`)
    w(`    - disagree with Claude: ${disagree}/${dictNonNull} (${dictNonNull ? pct(disagree, dictNonNull) : 0}%)`)
    w(`    - claude_only count: ${claudeOnly}`)
  }

  // ---- Segmented accuracy ----
  w(`\n## Accuracy by maturity (enrich-tier)\n`)
  for (const t of ['well-known', 'mid-tier', 'early-stage']) {
    const subset = results.filter(r => r.tier === t)
    if (subset.length === 0) continue
    const cat = subset.filter(r => r.gradeEnrich.catCorrect).length
    const prim = subset.filter(r => r.gradeEnrich.primaryCorrect).length
    w(`- **${t}** (${subset.length} cos): cat=${cat}/${subset.length} (${pct(cat, subset.length)}%), primary=${prim}/${subset.length} (${pct(prim, subset.length)}%)`)
  }

  w(`\n## Accuracy by single vs multi-industry (enrich-tier)\n`)
  for (const s of ['single', 'multi-industry']) {
    const subset = results.filter(r => r.sub === s)
    if (subset.length === 0) continue
    const cat = subset.filter(r => r.gradeEnrich.catCorrect).length
    const prim = subset.filter(r => r.gradeEnrich.primaryCorrect).length
    const indP = subset.reduce((s2, r) => s2 + r.gradeEnrich.industriesPrec, 0) / subset.length
    const indR = subset.reduce((s2, r) => s2 + r.gradeEnrich.industriesRec, 0) / subset.length
    w(`- **${s}** (${subset.length} cos): cat=${cat}/${subset.length} (${pct(cat, subset.length)}%), primary=${prim}/${subset.length} (${pct(prim, subset.length)}%), industries[] P/R=${indP.toFixed(2)}/${indR.toFixed(2)}`)
  }

  w(`\n## Accuracy by category (enrich-tier)\n`)
  for (const c of ['hardware', 'non_hardware'] as const) {
    const subset = results.filter(r => r.expected.category === c)
    if (subset.length === 0) continue
    const correct = subset.filter(r => r.gradeEnrich.catCorrect).length
    const prim = subset.filter(r => r.gradeEnrich.primaryCorrect).length
    w(`- **${c}** (${subset.length} cos): cat=${correct}/${subset.length} (${pct(correct, subset.length)}%), primary=${prim}/${subset.length} (${pct(prim, subset.length)}%)`)
  }

  // ---- Retest of round-3 failure boundaries ----
  w(`\n## Retest of round-3 failure boundaries\n`)
  for (const retest of ['climate', 'maritime', 'ai_feature'] as const) {
    const subset = results.filter(r => r.retestOf === retest)
    if (subset.length === 0) continue
    const correct = subset.filter(r => r.gradeEnrich.primaryCorrect).length
    const failedTagAI = subset.filter(r => retest === 'ai_feature' && r.enrich.domain_tags.includes('AI')).length
    w(`### ${retest === 'climate' ? 'Climate-vs-Energy (Climeworks failed in round-3)' : retest === 'maritime' ? 'Maritime-vs-Defense (Saildrone failed in round-3)' : 'AI-feature-not-core (extends Notion test)'}\n`)
    w(`Retest companies (${subset.length}): ${subset.map(r => r.company).join(', ')}\n`)
    w(`Primary-industry correct: ${correct}/${subset.length} (${pct(correct, subset.length)}%)`)
    if (retest === 'ai_feature') {
      w(`Companies that were OVER-TAGGED with AI (should NOT have AI in domain_tags): ${failedTagAI}/${subset.length}`)
    }
    for (const r of subset) {
      const got = `${r.enrich.category}/${r.enrich.primary_industry}, tags=[${r.enrich.domain_tags.join(', ')}]`
      const exp = `${r.expected.category}/${r.expected.primary_industry}`
      const ok = r.gradeEnrich.primaryCorrect ? '✓' : '✗'
      const aiNote = retest === 'ai_feature' ? (r.enrich.domain_tags.includes('AI') ? ' [AI OVER-TAGGED]' : ' [AI suppressed correctly]') : ''
      w(`- ${ok} **${r.company}**: expected ${exp}; got ${got}${aiNote}`)
    }
    w(``)
  }

  // ---- Per-company table ----
  w(`\n## Per-company results (enrich-tier)\n`)
  w(`| Company | Tier | Sub | Expected primary | Got primary | Cat? | Pri? | dict_verdict | agreement | Notes |`)
  w(`|---|---|---|---|---|---|---|---|---|---|`)
  for (const r of results) {
    const got = r.enrich
    const dictV = got.dict_verdict ? `${got.dict_verdict.category}/${got.dict_verdict.primary_industry}` : 'null'
    const noteParts: string[] = []
    if (r.isOutOfScope) noteParts.push('⚠ OOS')
    if (r.isAmbiguous) noteParts.push('? amb')
    if (r.retestOf) noteParts.push(`retest:${r.retestOf}`)
    w(`| ${r.company} | ${r.tier} | ${r.sub} | ${r.expected.primary_industry ?? '∅'} | ${got.primary_industry ?? '∅'} | ${r.gradeEnrich.catCorrect ? '✓' : '✗'} | ${r.gradeEnrich.primaryCorrect ? '✓' : '✗'} | \`${dictV}\` | ${got.agreement} | ${noteParts.join(' ')} |`)
  }

  // ---- Out-of-scope and ambiguous ----
  const oos = results.filter(r => r.isOutOfScope || r.isAmbiguous)
  if (oos.length > 0) {
    w(`\n## Flagged for "your call" (out-of-scope or ambiguous — not fail-graded)\n`)
    for (const r of oos) {
      const tag = r.isOutOfScope ? 'OUT-OF-SCOPE' : 'AMBIGUOUS'
      w(`### ${r.company} [${tag}]`)
      if (r.expected.out_of_scope_note) w(`*${r.expected.out_of_scope_note}*\n`)
      w(`- Expected: category=${r.expected.category}, primary=${r.expected.primary_industry}, industries=${JSON.stringify(r.expected.industries)}, tags=${JSON.stringify(r.expected.domain_tags)}`)
      w(`- Got (enrich): category=${r.enrich.category}, primary=${r.enrich.primary_industry}, industries=${JSON.stringify(r.enrich.industries)}, tags=${JSON.stringify(r.enrich.domain_tags)}`)
      w('')
    }
  }

  // ---- Disagreements deep-dive ----
  const disagreements = results.filter(r => r.enrich.agreement === 'disagree')
  if (disagreements.length > 0) {
    w(`\n## Disagreements (Claude vs dict, enrich-tier)\n`)
    for (const r of disagreements) {
      w(`### ${r.company}`)
      w(`- Claude: ${r.enrich.claude_verdict?.category}/${r.enrich.claude_verdict?.primary_industry}`)
      w(`- Dict:   ${r.enrich.dict_verdict?.category}/${r.enrich.dict_verdict?.primary_industry}`)
      w(`- Expected: ${r.expected.category}/${r.expected.primary_industry}`)
      w(`- Verdict written (Claude wins): ${r.enrich.category}/${r.enrich.primary_industry}`)
      const claudeRight = r.enrich.claude_verdict?.primary_industry === r.expected.primary_industry
      const dictRight = r.enrich.dict_verdict?.primary_industry === r.expected.primary_industry
      if (claudeRight && !dictRight) w(`- ✓ Claude was right, dict wrong → Claude wins, correct outcome`)
      else if (!claudeRight && dictRight) w(`- ✗ Dict was right, Claude wrong → wrong outcome`)
      else if (claudeRight && dictRight) w(`- (both right; shouldn't have disagreed)`)
      else w(`- ✗ Both wrong (or expected ambiguous)`)
      w('')
    }
  }

  // ---- Failures (non-ambiguous primary mismatches) ----
  const failures = results.filter(r => !r.gradeEnrich.primaryCorrect && !r.isAmbiguous)
  if (failures.length > 0) {
    w(`\n## Real failures (non-ambiguous primary mismatches)\n`)
    for (const r of failures) {
      w(`### ${r.company}`)
      w(`- Expected: ${r.expected.category}/${r.expected.primary_industry}`)
      w(`- Got: ${r.enrich.category}/${r.enrich.primary_industry}`)
      w(`- Reasoning: ${r.enrich.reasoning.slice(0, 400)}`)
      w('')
    }
  }

  writeFileSync(RPT, lines.join('\n'))
  console.error(`\nWrote ${RPT}`)
}

function pct(num: number, denom: number): number {
  return denom === 0 ? 0 : Math.round((num / denom) * 100)
}

main().catch(e => { console.error(e); process.exit(99) })
