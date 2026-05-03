// Investigation 2 — round-2 evaluation.
//
// Runs the new Claude-primary, Option B (multi-industry) tagger on the
// 10 inv1 companies at THREE input levels:
//   (A) identify-only: name + industries[] + maybe description (+headcount/year/type)
//       — what Claude sees on unreviewed-tier auto-creates per Concern 3
//   (B) search-tier: identify + taxonomy.{pn_industry, categories} (no description)
//   (C) enrich-tier: full signals incl. description
//
// Plus runs the dictionary alongside (sanity check) and reports agreement.

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { tagCompany } from '../lib/companies/tagger/index'
import type { TaggerInput, CompositeTaggerOutput } from '../lib/companies/tagger/types'

interface RawCompanyRow {
  seed: { label: string; tier: string; expected_category: string; expected_industry?: string; domain: string }
  crustdata_company_id?: number
  identify_match_count?: number
  search?: any
  enrich?: any
  error?: string
}

interface ExpectedTags {
  category: 'hardware' | 'non_hardware' | null
  primary_industry: string | null
  industries: string[]
  domain_tags: string[]
}

const GROUND_TRUTH: Record<string, ExpectedTags> = {
  'Anduril Industries': { category: 'hardware', primary_industry: 'Defense',
    industries: ['Defense', 'Aerospace', 'Maritime', 'Industrial Manufacturing'],
    domain_tags: ['Drones', 'Autonomous Driving', 'AI'] },
  'Stripe': { category: 'non_hardware', primary_industry: 'FinTech',
    industries: ['FinTech'], domain_tags: ['Payments', 'B2B', 'Infrastructure'] },
  'OpenAI': { category: 'non_hardware', primary_industry: 'AI',
    industries: ['AI'], domain_tags: ['Infrastructure', 'DevTools'] },
  'Skydio': { category: 'hardware', primary_industry: 'Aerospace',
    industries: ['Aerospace'], domain_tags: ['Drones', 'Autonomous Driving', 'AI'] },
  'Shield AI': { category: 'hardware', primary_industry: 'Defense',
    industries: ['Defense'], domain_tags: ['Drones', 'Autonomous Driving', 'AI'] },
  'Illumina': { category: 'hardware', primary_industry: 'Medical Devices',
    industries: ['Medical Devices'], domain_tags: [] },
  'Recursion Pharmaceuticals': { category: 'non_hardware', primary_industry: 'Biotech',
    industries: ['Biotech'], domain_tags: ['Data', 'Infrastructure', 'AI'] },
  'Hugging Face': { category: 'non_hardware', primary_industry: 'AI',
    industries: ['AI'], domain_tags: ['DevTools', 'Infrastructure', 'B2B'] },
  'Inflection AI': { category: 'non_hardware', primary_industry: 'AI',
    industries: ['AI'], domain_tags: ['Consumer'] },
  'Astra Space': { category: 'hardware', primary_industry: 'Aerospace',
    industries: ['Aerospace'], domain_tags: ['Rockets', 'Satellites'] },
}

function buildIdentifyInput(r: RawCompanyRow): TaggerInput {
  const e = r.enrich || {}
  return {
    name: e.basic_info?.name || r.seed.label,
    professional_network_industry: null,
    industries: e.basic_info?.industries || [],
    categories: [],
    description: e.basic_info?.description || null,
    year_founded: e.basic_info?.year_founded || null,
    employee_count_range: e.basic_info?.employee_count_range || null,
    company_type: e.basic_info?.company_type || null,
  }
}

function buildSearchInput(r: RawCompanyRow): TaggerInput {
  const s = r.search || r.enrich || {}
  return {
    name: s.basic_info?.name || r.seed.label,
    professional_network_industry: s.taxonomy?.professional_network_industry || null,
    industries: s.basic_info?.industries || [],
    categories: s.taxonomy?.categories || [],
    description: null,
    year_founded: s.basic_info?.year_founded || null,
    employee_count_range: s.basic_info?.employee_count_range || null,
    company_type: s.basic_info?.company_type || null,
  }
}

function buildEnrichInput(r: RawCompanyRow): TaggerInput {
  const e = r.enrich || {}
  return {
    name: e.basic_info?.name || r.seed.label,
    professional_network_industry: e.taxonomy?.professional_network_industry || null,
    industries: e.basic_info?.industries || [],
    categories: e.taxonomy?.categories || [],
    description: e.basic_info?.description || null,
    year_founded: e.basic_info?.year_founded || null,
    employee_count_range: e.basic_info?.employee_count_range || null,
    company_type: e.basic_info?.company_type || null,
  }
}

function gradeOutput(output: CompositeTaggerOutput, expected: ExpectedTags) {
  const catCorrect = output.category === expected.category
  const indPrimaryCorrect = catCorrect && output.primary_industry === expected.primary_industry
  const indMatched = output.industries.filter(i => expected.industries.includes(i)).length
  const indPrec = output.industries.length === 0 ? (expected.industries.length === 0 ? 1 : 0) : indMatched / output.industries.length
  const indRec = expected.industries.length === 0 ? 1 : indMatched / expected.industries.length
  const tagMatched = output.domain_tags.filter(t => expected.domain_tags.includes(t)).length
  const tagPrec = output.domain_tags.length === 0 ? (expected.domain_tags.length === 0 ? 1 : 0) : tagMatched / output.domain_tags.length
  const tagRec = expected.domain_tags.length === 0 ? 1 : tagMatched / expected.domain_tags.length
  return { catCorrect, indPrimaryCorrect, indPrec, indRec, tagPrec, tagRec }
}

const RAW_PATH = '/Users/matt/Desktop/DEV/vetted-app/docs/vetted-companies-v1/02-data-delta-raw.json'
const RPT_PATH = '/Users/matt/Desktop/DEV/vetted-app/docs/vetted-companies-v1/03-tagger-eval.md'

async function main() {
  if (!existsSync(RAW_PATH)) {
    console.error(`Raw data not found at ${RAW_PATH}. Run scripts/_inv1-data-delta.mjs first.`)
    process.exit(1)
  }
  const raw = JSON.parse(readFileSync(RAW_PATH, 'utf-8')) as RawCompanyRow[]
  const successful = raw.filter(r => !r.error && r.search && r.enrich)

  const lines: string[] = []
  const w = (...parts: string[]) => lines.push(parts.join(''))
  w(`# Investigation 2 — Tagger Evaluation Report (Round 2, post-decisions)\n`)
  w(`*Generated: ${new Date().toISOString()}*  `)
  w(`*Architecture: Claude-primary, dict sanity-check, Option B multi-industry, temp=0.*  `)
  w(`*Tested ${successful.length} companies at three input levels:*\n`)
  w(`- **(A) identify-only** — what Claude sees for unreviewed-tier auto-creates per Concern 3 resolution`)
  w(`- **(B) search-tier** — identify + taxonomy.{pn_industry, categories} (no description)`)
  w(`- **(C) enrich-tier** — full signals incl. description\n`)
  w(`*Key question: how does Claude degrade as signals get thinner?*\n`)

  const results: any[] = []
  for (const r of successful) {
    const expected = GROUND_TRUTH[r.seed.label]
    if (!expected) { console.error(`No ground truth for ${r.seed.label}`); continue }
    console.error(`\n[${r.seed.label}]`)
    console.error(`  identify-only...`)
    const compIdentify = await tagCompany(buildIdentifyInput(r))
    console.error(`  search-tier...`)
    const compSearch = await tagCompany(buildSearchInput(r))
    console.error(`  enrich-tier...`)
    const compEnrich = await tagCompany(buildEnrichInput(r))

    const gIdentify = gradeOutput(compIdentify, expected)
    const gSearch = gradeOutput(compSearch, expected)
    const gEnrich = gradeOutput(compEnrich, expected)

    results.push({ company: r.seed.label, expected, compIdentify, compSearch, compEnrich, gIdentify, gSearch, gEnrich })
  }

  w(`## Per-company results\n`)
  for (const r of results) {
    w(`### ${r.company}`)
    w(`*Expected:* category=\`${r.expected.category}\`, primary=\`${r.expected.primary_industry}\`, industries=\`${JSON.stringify(r.expected.industries)}\`, domain_tags=\`${JSON.stringify(r.expected.domain_tags)}\`\n`)
    w(`| tier | category | primary | industries | domain_tags | conf | method | cat? | prim? | tag p/r |`)
    w(`|---|---|---|---|---|---|---|---|---|---|`)
    for (const [tier, comp, g] of [
      ['(A) identify', r.compIdentify, r.gIdentify],
      ['(B) search', r.compSearch, r.gSearch],
      ['(C) enrich', r.compEnrich, r.gEnrich],
    ] as const) {
      w(`| ${tier} | ${comp.category ?? 'null'} | ${comp.primary_industry ?? 'null'} | \`${JSON.stringify(comp.industries)}\` | \`${JSON.stringify(comp.domain_tags)}\` | ${comp.confidence.toFixed(2)} | ${comp.method} | ${g.catCorrect ? '✓' : '✗'} | ${g.indPrimaryCorrect ? '✓' : '✗'} | ${g.tagPrec.toFixed(2)}/${g.tagRec.toFixed(2)} |`)
    }
    for (const [tier, comp] of [['identify', r.compIdentify], ['search', r.compSearch], ['enrich', r.compEnrich]] as const) {
      if (comp.agreement === 'disagree') {
        w(`*${tier} disagreement: claude=${comp.claude_verdict?.category}/${comp.claude_verdict?.primary_industry}, dict=${comp.dict_verdict?.category}/${comp.dict_verdict?.primary_industry}*`)
      }
    }
    w('')
  }

  w(`## Aggregate accuracy (${results.length} companies)\n`)
  for (const [tier, key] of [['(A) identify', 'gIdentify'], ['(B) search', 'gSearch'], ['(C) enrich', 'gEnrich']] as const) {
    const cat = results.filter(r => r[key].catCorrect).length
    const prim = results.filter(r => r[key].indPrimaryCorrect).length
    const tagP = results.reduce((s, r) => s + r[key].tagPrec, 0) / results.length
    const tagR = results.reduce((s, r) => s + r[key].tagRec, 0) / results.length
    w(`- **${tier}:** category=${cat}/${results.length} (${Math.round(cat/results.length*100)}%), primary_industry=${prim}/${results.length} (${Math.round(prim/results.length*100)}%), tag P/R=${tagP.toFixed(2)}/${tagR.toFixed(2)}`)
  }

  w(`\n## Claude vs dict agreement\n`)
  for (const [tier, key] of [['identify', 'compIdentify'], ['search', 'compSearch'], ['enrich', 'compEnrich']] as const) {
    const agree = results.filter(r => r[key].agreement === 'agree').length
    const disagree = results.filter(r => r[key].agreement === 'disagree').length
    const claudeOnly = results.filter(r => r[key].agreement === 'claude_only').length
    w(`- **${tier}**: agree=${agree}, disagree=${disagree}, claude-only (dict null)=${claudeOnly}`)
  }

  w(`\n## Multi-industry detection (Option B)\n`)
  const trueMulti = results.filter(r => r.expected.industries.length > 1)
  if (trueMulti.length === 0) w(`(no multi-industry companies in ground truth — Anduril is the only one and that's it in this 10-co sample)\n`)
  for (const r of trueMulti) {
    w(`- **${r.company}** (expected industries=${JSON.stringify(r.expected.industries)})`)
    for (const [tier, comp] of [['identify', r.compIdentify], ['search', r.compSearch], ['enrich', r.compEnrich]] as const) {
      w(`  - ${tier}: ${JSON.stringify(comp.industries)}`)
    }
  }

  writeFileSync(RPT_PATH, lines.join('\n'))
  console.error(`\nWrote report: ${RPT_PATH}`)
}

main().catch(e => { console.error(e); process.exit(99) })
