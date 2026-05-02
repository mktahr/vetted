// Investigation 2: tagger evaluation.
// Reads raw data from Investigation 1, runs each company through:
//   (a) deterministic dictionary at SEARCH-tier signals (no description)
//   (b) deterministic dictionary at ENRICH-tier signals (with description)
//   (c) full tagger (dict + Claude fallback) at ENRICH-tier
// Grades each output against expected ground truth.
// Writes Markdown report.

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { tagDeterministically, tagWithClaude } from '../lib/companies/tagger/index'
import type { TaggerInput, TaggerOutput } from '../lib/companies/tagger/types'

interface RawCompanyRow {
  seed: { label: string; tier: string; expected_category: string; expected_industry?: string; domain: string }
  crustdata_company_id?: number
  identify_match_count?: number
  search?: any
  enrich?: any
  error?: string
}

interface ExpectedTags {
  category: 'hardware' | 'non_hardware' | 'unreviewed'
  industry: string | null
  domain_tags: string[]
}

// Ground truth — based on knowing these 10 companies + the V1 taxonomy
const GROUND_TRUTH: Record<string, ExpectedTags> = {
  'Anduril Industries': { category: 'hardware', industry: 'Defense', domain_tags: ['Drones', 'Autonomous Driving'] },
  'Stripe':             { category: 'non_hardware', industry: 'FinTech', domain_tags: ['Payments', 'B2B', 'Infrastructure'] },
  'OpenAI':             { category: 'non_hardware', industry: 'AI', domain_tags: ['Infrastructure', 'DevTools'] },
  'Skydio':             { category: 'hardware', industry: 'Aerospace', domain_tags: ['Drones', 'Autonomous Driving'] },
  'Shield AI':          { category: 'hardware', industry: 'Defense', domain_tags: ['Drones', 'Autonomous Driving'] },
  'Illumina':           { category: 'hardware', industry: 'Medical Devices', domain_tags: [] },
  'Recursion Pharmaceuticals': { category: 'non_hardware', industry: 'Biotech', domain_tags: ['Data', 'Infrastructure'] },
  'Hugging Face':       { category: 'non_hardware', industry: 'AI', domain_tags: ['DevTools', 'Infrastructure', 'B2B'] },
  'Inflection AI':      { category: 'non_hardware', industry: 'AI', domain_tags: ['Consumer'] },
  'Astra Space':        { category: 'hardware', industry: 'Aerospace', domain_tags: ['Rockets', 'Satellites'] },
}

function buildSearchInput(r: RawCompanyRow): TaggerInput {
  // search-tier: same signals as enrich for taxonomy + industries (these come back identically),
  // but description is enrich-only — so search-tier has description=null.
  // Use the search response object for these fields when available; fall back to enrich.
  const s = r.search || {}
  const e = r.enrich || {}
  return {
    name: s.basic_info?.name || e.basic_info?.name || r.seed.label,
    professional_network_industry: s.taxonomy?.professional_network_industry || e.taxonomy?.professional_network_industry || null,
    industries: s.basic_info?.industries || e.basic_info?.industries || [],
    categories: s.taxonomy?.categories || e.taxonomy?.categories || [],
    description: null,                                              // SEARCH-TIER
    year_founded: s.basic_info?.year_founded || e.basic_info?.year_founded || null,
    employee_count_range: s.basic_info?.employee_count_range || e.basic_info?.employee_count_range || null,
    company_type: s.basic_info?.company_type || e.basic_info?.company_type || null,
  }
}

function buildEnrichInput(r: RawCompanyRow): TaggerInput {
  const e = r.enrich || {}
  return {
    name: e.basic_info?.name || r.seed.label,
    professional_network_industry: e.taxonomy?.professional_network_industry || null,
    industries: e.basic_info?.industries || [],
    categories: e.taxonomy?.categories || [],
    description: e.basic_info?.description || null,                  // ENRICH-TIER
    year_founded: e.basic_info?.year_founded || null,
    employee_count_range: e.basic_info?.employee_count_range || null,
    company_type: e.basic_info?.company_type || null,
  }
}

function gradeOutput(output: TaggerOutput, expected: ExpectedTags): {
  catCorrect: boolean
  indCorrect: boolean
  domainOverlap: { matched: number; expected: number; precision: number; recall: number }
} {
  const catCorrect = output.category === expected.category
  const indCorrect = catCorrect && output.industry === expected.industry
  const matched = output.domain_tags.filter(t => expected.domain_tags.includes(t)).length
  const expectedSet = expected.domain_tags.length
  const outputSet = output.domain_tags.length
  return {
    catCorrect,
    indCorrect,
    domainOverlap: {
      matched,
      expected: expectedSet,
      precision: outputSet === 0 ? (expectedSet === 0 ? 1 : 0) : matched / outputSet,
      recall: expectedSet === 0 ? 1 : matched / expectedSet,
    },
  }
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
  w(`# Investigation 2 — Tagger Evaluation Report\n`)
  w(`*Generated: ${new Date().toISOString()}*  `)
  w(`*Tested ${successful.length} companies via three tagger modes:*  `)
  w(`*(A) deterministic dictionary at search-tier (no description)*  `)
  w(`*(B) deterministic dictionary at enrich-tier (with description)*  `)
  w(`*(C) full tagger (dict→Claude fallback) at enrich-tier*\n`)

  const results: any[] = []

  for (const r of successful) {
    const expected = GROUND_TRUTH[r.seed.label]
    if (!expected) {
      console.error(`No ground truth for ${r.seed.label}`)
      continue
    }
    const searchInput = buildSearchInput(r)
    const enrichInput = buildEnrichInput(r)

    const dictSearch = tagDeterministically(searchInput)
    const dictEnrich = tagDeterministically(enrichInput)

    // For proper comparison: ALWAYS run Claude at enrich-tier (with description)
    // even when dict was confident, so we can compare dict's tag recall vs Claude's.
    let claudeEnrich: TaggerOutput
    console.error(`[${r.seed.label}] Calling Claude (enrich-tier with description)...`)
    try {
      claudeEnrich = await tagWithClaude(enrichInput)
    } catch (err: any) {
      console.error(`  Claude error: ${err.message}`)
      claudeEnrich = { category: 'unreviewed', industry: null, domain_tags: [], confidence: 0,
        reasoning: `Claude error: ${err.message}`, method: 'claude_inference' }
    }

    // Full tagger (orchestrator behavior): dict if confident, else Claude
    const fullResult = (dictEnrich.category !== 'unreviewed' && dictEnrich.confidence >= 0.7)
      ? dictEnrich
      : claudeEnrich

    const gradeSearch = gradeOutput(dictSearch, expected)
    const gradeEnrich = gradeOutput(dictEnrich, expected)
    const gradeClaude = gradeOutput(claudeEnrich, expected)
    const gradeFull = gradeOutput(fullResult, expected)

    results.push({ company: r.seed.label, expected, dictSearch, dictEnrich, claudeEnrich, fullResult, gradeSearch, gradeEnrich, gradeClaude, gradeFull })
  }

  // ----- Per-company section -----
  w(`## Per-company results\n`)
  for (const r of results) {
    w(`### ${r.company}`)
    w(`*Expected:* category=\`${r.expected.category}\`, industry=\`${r.expected.industry || 'null'}\`, domain_tags=\`${JSON.stringify(r.expected.domain_tags)}\`\n`)
    w(`| mode | category | industry | domain_tags | conf | cat? | ind? | dom-tags p/r | reasoning |`)
    w(`|---|---|---|---|---|---|---|---|---|`)
    for (const [mode, out, grade] of [
      ['(A) Dict @ search', r.dictSearch, r.gradeSearch],
      ['(B) Dict @ enrich', r.dictEnrich, r.gradeEnrich],
      ['(C) Claude @ enrich', r.claudeEnrich, r.gradeClaude],
      ['(D) Full (dict→claude)', r.fullResult, r.gradeFull],
    ] as const) {
      const tags = out.domain_tags.length === 0 ? '[]' : JSON.stringify(out.domain_tags)
      const reasoning = out.reasoning.length > 80 ? out.reasoning.slice(0, 77) + '...' : out.reasoning
      w(`| ${mode} | ${out.category} | ${out.industry ?? 'null'} | \`${tags}\` | ${out.confidence.toFixed(2)} | ${grade.catCorrect ? '✓' : '✗'} | ${grade.indCorrect ? '✓' : '✗'} | ${grade.domainOverlap.precision.toFixed(2)}/${grade.domainOverlap.recall.toFixed(2)} | ${reasoning} |`)
    }
    w(``)
  }

  // ----- Aggregate accuracy -----
  w(`## Aggregate accuracy (${results.length} companies)\n`)
  for (const [mode, key] of [
    ['(A) Dict @ search', 'gradeSearch'],
    ['(B) Dict @ enrich', 'gradeEnrich'],
    ['(C) Claude @ enrich', 'gradeClaude'],
    ['(D) Full (dict→claude)', 'gradeFull'],
  ] as const) {
    const cat = results.filter(r => r[key].catCorrect).length
    const ind = results.filter(r => r[key].indCorrect).length
    const tagPrec = results.reduce((s, r) => s + r[key].domainOverlap.precision, 0) / results.length
    const tagRec = results.reduce((s, r) => s + r[key].domainOverlap.recall, 0) / results.length
    w(`- **${mode}:** category=${cat}/${results.length} (${Math.round(cat/results.length*100)}%), industry=${ind}/${results.length} (${Math.round(ind/results.length*100)}%), domain-tag avg precision=${tagPrec.toFixed(2)}, avg recall=${tagRec.toFixed(2)}`)
  }

  // ----- Industries with 0% deterministic coverage -----
  w(`\n## V1 industries seen (in ground truth) and their dictionary coverage\n`)
  const indStats: Record<string, { total: number; dictHit: number }> = {}
  for (const r of results) {
    const ind = r.expected.industry
    if (!ind) continue
    indStats[ind] ??= { total: 0, dictHit: 0 }
    indStats[ind].total++
    if (r.gradeEnrich.indCorrect) indStats[ind].dictHit++
  }
  w(`| industry | tested | dict@enrich correct | coverage |`)
  w(`|---|---|---|---|`)
  for (const [ind, s] of Object.entries(indStats).sort()) {
    w(`| ${ind} | ${s.total} | ${s.dictHit} | ${Math.round(s.dictHit/s.total*100)}% |`)
  }

  // ----- Where Claude was needed -----
  w(`\n## Companies where dictionary needed Claude escalation (enrich-tier)\n`)
  const escalated = results.filter(r => r.dictEnrich.category === 'unreviewed' || r.dictEnrich.confidence < 0.7)
  if (escalated.length === 0) w(`(none — dictionary was confident on all 10 at enrich-tier)`)
  for (const r of escalated) {
    w(`- **${r.company}** — dict said \`${r.dictEnrich.category}/${r.dictEnrich.industry}\` (conf ${r.dictEnrich.confidence.toFixed(2)}); full tagger said \`${r.fullResult.category}/${r.fullResult.industry}\``)
  }

  writeFileSync(RPT_PATH, lines.join('\n'))
  console.error(`\nWrote report: ${RPT_PATH}`)
}

main().catch(e => { console.error(e); process.exit(99) })
