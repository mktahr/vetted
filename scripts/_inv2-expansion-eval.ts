// Targeted expansion eval — round-3 architecture validation.
//
// Reads raw data from scripts/_inv2-expansion-pull.mjs, runs the new tagger
// at TWO input tiers per company (identify-tier, enrich-tier), grades vs
// hand-labeled ground truth, and reports:
//
//   - Per-tier accuracy (category, primary_industry, industries[] P/R, domain_tag P/R)
//   - Dict-null rate (% companies dict abstained vs committed)
//   - Of dict-committed: agree/disagree breakdown
//   - Segmented by (well-known/mid-tier/early-stage) and (single/multi-industry)
//   - Anduril Maritime industry firing (re-tagged from inv1 raw data)
//
// Search-tier intentionally skipped (inv2 round-2 confirmed search-tier is
// worse than identify-tier due to noisy categories[] without description).

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { tagCompany } from '../lib/companies/tagger/index'
import type { TaggerInput, CompositeTaggerOutput } from '../lib/companies/tagger/types'

interface ExpectedTags {
  category: 'hardware' | 'non_hardware' | null
  primary_industry: string | null
  industries: string[]            // includes primary first
  domain_tags: string[]
  out_of_scope_note?: string      // "Telecommunications gap" / "Agriculture gap" etc.
  ambiguous?: boolean             // genuinely ambiguous — surface "your call" instead of fail-grading
}

// Hand-labeled ground truth for each expansion company.
// Keys MUST match the seed labels in _inv2-expansion-pull.mjs.
const GROUND_TRUTH: Record<string, ExpectedTags> = {
  // GT-fix: 'Robotics' is a HARDWARE INDUSTRY, not a domain_tag. Removed from domain_tags.
  // (Optimus is real but Tesla is already multi-industry; not adding Robotics to industries[]
  //  to avoid demanding 4-element list — keeping the original 3-industry expectation.)
  'Tesla': { category: 'hardware', primary_industry: 'Automotive',
    industries: ['Automotive', 'Energy', 'Industrial Manufacturing'],
    domain_tags: ['EVs', 'Autonomous Driving', 'AI'] },
  'Rivian': { category: 'hardware', primary_industry: 'Automotive',
    industries: ['Automotive'], domain_tags: ['EVs', 'Automotive Manufacturing'] },
  'Slate Auto': { category: 'hardware', primary_industry: 'Automotive',
    industries: ['Automotive'], domain_tags: ['EVs'], ambiguous: true },
  'Boston Dynamics': { category: 'hardware', primary_industry: 'Robotics',
    industries: ['Robotics'], domain_tags: ['AI'] },
  'Figure AI': { category: 'hardware', primary_industry: 'Robotics',
    industries: ['Robotics'], domain_tags: ['AI'] },
  '1X Technologies': { category: 'hardware', primary_industry: 'Robotics',
    industries: ['Robotics'], domain_tags: ['AI'], ambiguous: true },
  'Form Energy': { category: 'hardware', primary_industry: 'Energy Storage',
    industries: ['Energy Storage'], domain_tags: [] },
  'Commonwealth Fusion Systems': { category: 'hardware', primary_industry: 'Energy',
    industries: ['Energy'], domain_tags: ['Nuclear'] },
  'Antora Energy': { category: 'hardware', primary_industry: 'Energy Storage',
    industries: ['Energy Storage'], domain_tags: [] },
  'Climeworks': { category: 'hardware', primary_industry: 'Climate',
    industries: ['Climate'], domain_tags: [] },
  'Heirloom Carbon': { category: 'hardware', primary_industry: 'Climate',
    industries: ['Climate'], domain_tags: [] },
  // GT-fix: 'AI' is a NON-HARDWARE industry only — invalid for category=hardware.
  // NVIDIA's AI is core to product but primary_industry=Semiconductors → AI as domain_tag.
  'NVIDIA': { category: 'hardware', primary_industry: 'Semiconductors',
    industries: ['Semiconductors'], domain_tags: ['AI'] },
  'Cerebras': { category: 'hardware', primary_industry: 'Semiconductors',
    industries: ['Semiconductors'], domain_tags: ['AI'] },
  'Tenstorrent': { category: 'hardware', primary_industry: 'Semiconductors',
    industries: ['Semiconductors'], domain_tags: ['AI'] },
  // GT-fix: 'Mobile' is a NON-HARDWARE domain_tag only — invalid for category=hardware.
  // Apple's iPhone is mobile-centric, but Mobile is not allowed in HW domain_tags. Removed.
  'Apple': { category: 'hardware', primary_industry: 'Consumer Electronics',
    industries: ['Consumer Electronics'], domain_tags: ['AI'],
    ambiguous: true, out_of_scope_note: 'Extreme multi-industry. Apple has Services (App Store / iCloud), Streaming (Apple TV+), FinTech (Apple Pay) but they are FEATURES of the device platform, not separate businesses. Primary stays Consumer Electronics.' },
  'Humane': { category: 'hardware', primary_industry: 'Consumer Electronics',
    industries: ['Consumer Electronics'], domain_tags: ['AI'] },
  'Hadrian': { category: 'hardware', primary_industry: 'Industrial Manufacturing',
    industries: ['Industrial Manufacturing'], domain_tags: [], ambiguous: true,
    out_of_scope_note: 'Could also be Aerospace (serves aero/defense). Defaulting to Industrial Manufacturing as the core business.' },
  'John Deere': { category: 'hardware', primary_industry: 'Industrial Manufacturing',
    industries: ['Industrial Manufacturing'], domain_tags: [],
    out_of_scope_note: 'Agriculture is not in V1 industries. Falls to Industrial Manufacturing. Agriculture gap on backlog.' },
  'Boom Supersonic': { category: 'hardware', primary_industry: 'Aerospace',
    industries: ['Aerospace', 'Materials'], domain_tags: [] },
  'Saildrone': { category: 'hardware', primary_industry: 'Maritime',
    industries: ['Maritime'], domain_tags: ['Drones', 'Autonomous Driving'] },
  'SpaceX': { category: 'hardware', primary_industry: 'Aerospace',
    industries: ['Aerospace', 'Industrial Manufacturing'], domain_tags: ['Rockets', 'Satellites'],
    out_of_scope_note: 'Starlink is a Telecommunications business — not in V1 industries. Expect SpaceX to land at Aerospace primary. Telecommunications gap on backlog.' },
  'Stoke Space': { category: 'hardware', primary_industry: 'Aerospace',
    industries: ['Aerospace'], domain_tags: ['Rockets'], ambiguous: true },
  'Palantir': { category: 'non_hardware', primary_industry: 'Defense',
    industries: ['Defense', 'AI'], domain_tags: ['Data', 'Analytics', 'Infrastructure', 'AI'] },
  'Rebellion Defense': { category: 'non_hardware', primary_industry: 'Defense',
    industries: ['Defense'], domain_tags: ['AI', 'Data'] },
  'Joby Aviation': { category: 'hardware', primary_industry: 'Aerospace',
    industries: ['Aerospace'], domain_tags: ['eVTOL'] },
  'Mercor': { category: 'non_hardware', primary_industry: 'AI',
    industries: ['AI'], domain_tags: ['HR'], ambiguous: true,
    out_of_scope_note: 'AI-recruiting could also be HR-tech but V1 has no HRTech industry. AI primary with HR tag.' },
  'Notion': { category: 'non_hardware', primary_industry: 'SaaS',
    industries: ['SaaS'], domain_tags: ['Productivity'],
    out_of_scope_note: 'AI suppression test: Notion has AI features but core is productivity SaaS. Should NOT have AI tag.' },
  'Scale AI': { category: 'non_hardware', primary_industry: 'AI',
    industries: ['AI'], domain_tags: ['Data', 'Infrastructure', 'B2B'],
    out_of_scope_note: 'AI primary; AI tag should be SUPPRESSED per round-2 decision #5.' },
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
  tier: string                            // well-known / mid-tier / early-stage
  sub: string                             // single / multi-industry
  expected: ExpectedTags
  identify: CompositeTaggerOutput
  enrich: CompositeTaggerOutput
  gradeIdentify: Grade
  gradeEnrich: Grade
  isOutOfScope: boolean
  isAmbiguous: boolean
}

const RAW = '/Users/matt/Desktop/DEV/vetted-app/docs/vetted-companies-v1/05-expansion-raw.json'
const INV1_RAW = '/Users/matt/Desktop/DEV/vetted-app/docs/vetted-companies-v1/02-data-delta-raw.json'
const RPT = '/Users/matt/Desktop/DEV/vetted-app/docs/vetted-companies-v1/05-expansion-eval.md'

async function main() {
  if (!existsSync(RAW)) { console.error(`Missing ${RAW}; run _inv2-expansion-pull.mjs first.`); process.exit(1) }
  const raw = JSON.parse(readFileSync(RAW, 'utf-8')) as RawCompanyRow[]
  const successful = raw.filter(r => !r.error && r.enrich)
  const failed = raw.filter(r => r.error)
  console.error(`Loaded ${raw.length} (successful: ${successful.length}, failed: ${failed.length})`)

  // Throttle: Anthropic Haiku 4.5 = 50k input tokens/min (per-org).
  // Each tagger call ~= 2k input tokens; 2 calls per company = ~4k tokens.
  // 4s between calls gives ~15 calls/min = ~30k tokens/min, safe under cap.
  const CALL_DELAY_MS = 4000
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

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
    })
  }

  // Anduril Maritime check — re-tag from inv1 raw data
  let anduril: { ident: CompositeTaggerOutput; enrich: CompositeTaggerOutput } | null = null
  if (existsSync(INV1_RAW)) {
    const inv1 = JSON.parse(readFileSync(INV1_RAW, 'utf-8')) as RawCompanyRow[]
    const anduRow = inv1.find(r => r.seed?.label === 'Anduril Industries' && !r.error)
    if (anduRow) {
      console.error(`\n[Anduril Maritime check] re-tag from inv1 raw...`)
      const ident = await tagCompany(buildIdentifyInput(anduRow))
      const enr = await tagCompany(buildEnrichInput(anduRow))
      anduril = { ident, enrich: enr }
    }
  }

  // ---- report ----
  const lines: string[] = []
  const w = (...a: string[]) => lines.push(a.join(''))

  w(`# Targeted Expansion Eval (28 companies + Anduril Maritime check)\n`)
  w(`*Generated: ${new Date().toISOString()}*  `)
  w(`*Architecture: Claude-primary + dict sanity check, Option B multi-industry, dict fixes E1+E2.1+E3+M2.*  `)
  w(`*Tiers tested: identify-only, enrich-tier. Search-tier skipped (inv2 round-2 showed it's worse than identify due to noisy categories).*\n`)

  if (failed.length > 0) {
    w(`## Pull failures\n`)
    for (const f of failed) w(`- **${f.seed.label}** (${f.seed.tier}): ${f.error}`)
    w(``)
  }

  // ---- aggregate ----
  w(`## Aggregate accuracy (${results.length} companies)\n`)
  for (const [tier, key] of [['(A) identify', 'identify'], ['(B) enrich', 'enrich']] as const) {
    const gradeKey = key === 'identify' ? 'gradeIdentify' : 'gradeEnrich'
    const cat = results.filter(r => r[gradeKey].catCorrect).length
    const prim = results.filter(r => r[gradeKey].primaryCorrect).length
    const indP = results.reduce((s, r) => s + r[gradeKey].industriesPrec, 0) / results.length
    const indR = results.reduce((s, r) => s + r[gradeKey].industriesRec, 0) / results.length
    const tagP = results.reduce((s, r) => s + r[gradeKey].tagPrec, 0) / results.length
    const tagR = results.reduce((s, r) => s + r[gradeKey].tagRec, 0) / results.length
    w(`- **${tier}:** category=${cat}/${results.length} (${Math.round(cat/results.length*100)}%), primary_industry=${prim}/${results.length} (${Math.round(prim/results.length*100)}%), industries[] P/R=${indP.toFixed(2)}/${indR.toFixed(2)}, domain_tag P/R=${tagP.toFixed(2)}/${tagR.toFixed(2)}`)
  }

  // ---- Dict-null and agreement breakdown ----
  w(`\n## Dict abstention + agreement (the question on dict's value)\n`)
  for (const [tier, key] of [['identify', 'identify'], ['enrich', 'enrich']] as const) {
    const all = results.length
    const dictNull = results.filter(r => r[key].dict_verdict?.category == null).length
    const dictNonNull = all - dictNull
    const agree = results.filter(r => r[key].agreement === 'agree').length
    const disagree = results.filter(r => r[key].agreement === 'disagree').length
    const claudeOnly = results.filter(r => r[key].agreement === 'claude_only').length
    w(`- **${tier}-tier:**`)
    w(`  - Dict abstained (null): ${dictNull}/${all} (${Math.round(dictNull/all*100)}%)`)
    w(`  - Dict committed: ${dictNonNull}/${all}`)
    w(`    - agree with Claude: ${agree}/${dictNonNull} (${dictNonNull ? Math.round(agree/dictNonNull*100) : 0}%)`)
    w(`    - disagree with Claude: ${disagree}/${dictNonNull} (${dictNonNull ? Math.round(disagree/dictNonNull*100) : 0}%)`)
    w(`    - Note: agreement values include 'claude_only' when dict null. claude_only count: ${claudeOnly}.`)
  }

  // ---- Segmented accuracy ----
  w(`\n## Accuracy by company maturity (enrich-tier only)\n`)
  for (const t of ['well-known', 'mid-tier', 'early-stage']) {
    const subset = results.filter(r => r.tier === t)
    if (subset.length === 0) continue
    const cat = subset.filter(r => r.gradeEnrich.catCorrect).length
    const prim = subset.filter(r => r.gradeEnrich.primaryCorrect).length
    const tagP = subset.reduce((s, r) => s + r.gradeEnrich.tagPrec, 0) / subset.length
    const tagR = subset.reduce((s, r) => s + r.gradeEnrich.tagRec, 0) / subset.length
    w(`- **${t}** (${subset.length} cos): cat=${cat}/${subset.length} (${Math.round(cat/subset.length*100)}%), primary=${prim}/${subset.length} (${Math.round(prim/subset.length*100)}%), tag P/R=${tagP.toFixed(2)}/${tagR.toFixed(2)}`)
  }

  w(`\n## Accuracy by single vs multi-industry (enrich-tier)\n`)
  for (const s of ['single', 'multi-industry']) {
    const subset = results.filter(r => r.sub === s)
    if (subset.length === 0) continue
    const cat = subset.filter(r => r.gradeEnrich.catCorrect).length
    const prim = subset.filter(r => r.gradeEnrich.primaryCorrect).length
    const indP = subset.reduce((s2, r) => s2 + r.gradeEnrich.industriesPrec, 0) / subset.length
    const indR = subset.reduce((s2, r) => s2 + r.gradeEnrich.industriesRec, 0) / subset.length
    w(`- **${s}** (${subset.length} cos): cat=${cat}/${subset.length} (${Math.round(cat/subset.length*100)}%), primary=${prim}/${subset.length} (${Math.round(prim/subset.length*100)}%), industries[] P/R=${indP.toFixed(2)}/${indR.toFixed(2)}`)
  }

  // ---- Anduril Maritime check ----
  w(`\n## Anduril Industries — Maritime industry firing check (re-tag from inv1 raw)\n`)
  if (anduril) {
    w(`*Confirms E2.1 dict refinement didn't break Anduril's defense classification, AND that Maritime appears as a secondary industry under Option B (multi-industry).*\n`)
    for (const [tier, r] of [['identify', anduril.ident], ['enrich', anduril.enrich]] as const) {
      const hasMari = r.industries.includes('Maritime')
      w(`- **${tier}-tier:** category=${r.category}, primary=${r.primary_industry}, industries=\`${JSON.stringify(r.industries)}\`, domain_tags=\`${JSON.stringify(r.domain_tags)}\``)
      w(`  - Maritime in industries: ${hasMari ? '✓ YES' : '✗ NO'}`)
      w(`  - method: ${r.method}, agreement: ${r.agreement}`)
    }
  } else {
    w(`(inv1 raw not found — re-run inv1 pull to enable this check)`)
  }

  // ---- Per-company table ----
  w(`\n## Per-company results (enrich-tier)\n`)
  w(`| Company | Tier | Sub | Expected primary | Got primary | Cat? | Pri? | dict_verdict | agreement | Notes |`)
  w(`|---|---|---|---|---|---|---|---|---|---|`)
  for (const r of results) {
    const got = r.enrich
    const dictV = got.dict_verdict ? `${got.dict_verdict.category}/${got.dict_verdict.primary_industry}` : 'null'
    const note = r.isOutOfScope ? '⚠ OOS' : (r.isAmbiguous ? '? amb' : '')
    w(`| ${r.company} | ${r.tier} | ${r.sub} | ${r.expected.primary_industry ?? '∅'} | ${got.primary_industry ?? '∅'} | ${r.gradeEnrich.catCorrect ? '✓' : '✗'} | ${r.gradeEnrich.primaryCorrect ? '✓' : '✗'} | \`${dictV}\` | ${got.agreement} | ${note} |`)
  }

  // ---- Out-of-scope and ambiguous flagged ----
  const oos = results.filter(r => r.isOutOfScope || r.isAmbiguous)
  if (oos.length > 0) {
    w(`\n## Flagged for "your call" (out-of-scope or ambiguous — not fail-graded)\n`)
    for (const r of oos) {
      const tag = r.isOutOfScope ? 'OUT-OF-SCOPE' : 'AMBIGUOUS'
      w(`### ${r.company} [${tag}]`)
      if (r.expected.out_of_scope_note) w(`*${r.expected.out_of_scope_note}*\n`)
      w(`- Expected (best-fit): category=${r.expected.category}, primary=${r.expected.primary_industry}, industries=${JSON.stringify(r.expected.industries)}`)
      w(`- Got (enrich): category=${r.enrich.category}, primary=${r.enrich.primary_industry}, industries=${JSON.stringify(r.enrich.industries)}, domain_tags=${JSON.stringify(r.enrich.domain_tags)}`)
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
      w(`- Expected (ground truth): ${r.expected.category}/${r.expected.primary_industry}`)
      w(`- Verdict written (Claude wins): ${r.enrich.category}/${r.enrich.primary_industry}`)
      const claudeRight = r.enrich.claude_verdict?.primary_industry === r.expected.primary_industry
      const dictRight = r.enrich.dict_verdict?.primary_industry === r.expected.primary_industry
      if (claudeRight && !dictRight) w(`- ✓ Claude was right, dict wrong → Claude wins, correct outcome`)
      else if (!claudeRight && dictRight) w(`- ✗ Dict was right, Claude wrong → wrong outcome (Claude won, but dict had the right answer)`)
      else if (claudeRight && dictRight) w(`- (both right, somehow flagged disagree — shouldn't happen)`)
      else w(`- ✗ Both wrong (or expected ambiguous)`)
      w('')
    }
  }

  writeFileSync(RPT, lines.join('\n'))
  console.error(`\nWrote ${RPT}`)
}

main().catch(e => { console.error(e); process.exit(99) })
