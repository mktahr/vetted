// Dict-only failure analysis. Runs the deterministic dictionary on the
// inv1 raw data and surfaces patterns: which rules over-fire, which Crust
// values trigger which mistakes, which industries dict can/can't reach.
//
// No API calls — pure offline analysis. Output: docs/vetted-companies-v1/04-dict-failure-analysis.md.

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { tagDeterministically } from '../lib/companies/tagger/dictionary'
import type { TaggerInput } from '../lib/companies/tagger/types'

interface RawCompanyRow {
  seed: { label: string; tier: string; expected_category: string; expected_industry?: string; domain: string }
  crustdata_company_id?: number
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

const RAW = '/Users/matt/Desktop/DEV/vetted-app/docs/vetted-companies-v1/02-data-delta-raw.json'
const RPT = '/Users/matt/Desktop/DEV/vetted-app/docs/vetted-companies-v1/04-dict-failure-analysis.md'

if (!existsSync(RAW)) { console.error(`Missing ${RAW}`); process.exit(1) }
const raw = JSON.parse(readFileSync(RAW, 'utf-8')) as RawCompanyRow[]
const successful = raw.filter(r => !r.error && r.enrich)

interface PerCompany {
  company: string
  expected: ExpectedTags
  inputs: TaggerInput
  dictOutput: ReturnType<typeof tagDeterministically>
  catCorrect: boolean
  primaryCorrect: boolean
  failureType: string
  signalsThatFiredWrongRule: string[]
  signalsMissingForCorrectRule: string[]
}

const results: PerCompany[] = []

for (const r of successful) {
  const expected = GROUND_TRUTH[r.seed.label]
  if (!expected) continue
  const inputs = buildEnrichInput(r)
  const out = tagDeterministically(inputs)
  const catCorrect = out.category === expected.category
  const primaryCorrect = catCorrect && out.primary_industry === expected.primary_industry

  let failureType = ''
  let signalsThatFiredWrongRule: string[] = []
  let signalsMissingForCorrectRule: string[] = []

  if (!catCorrect) {
    failureType = `category mismatch (dict=${out.category}, expected=${expected.category})`
  } else if (!primaryCorrect) {
    failureType = `primary mismatch (dict=${out.primary_industry}, expected=${expected.primary_industry})`
  } else {
    failureType = 'OK'
  }

  results.push({
    company: r.seed.label,
    expected,
    inputs,
    dictOutput: out,
    catCorrect,
    primaryCorrect,
    failureType,
    signalsThatFiredWrongRule,
    signalsMissingForCorrectRule,
  })
}

// ---- pattern detection ----

const failures = results.filter(r => !r.primaryCorrect)
const catFailures = results.filter(r => !r.catCorrect)
const primaryOnlyFailures = results.filter(r => r.catCorrect && !r.primaryCorrect)

// Per-rule: how often it fires correctly vs wrongly
const ruleFires: Record<string, { correct: number; wrong: number; companies: string[] }> = {}
for (const r of results) {
  if (!r.dictOutput.primary_industry) continue
  const fired = r.dictOutput.primary_industry
  ruleFires[fired] ??= { correct: 0, wrong: 0, companies: [] }
  if (r.expected.primary_industry === fired) ruleFires[fired].correct++
  else { ruleFires[fired].wrong++; ruleFires[fired].companies.push(`${r.company} (expected ${r.expected.primary_industry})`) }
}

// Per-expected-industry: how often dict reached it vs missed
const expectedHits: Record<string, { hit: number; missed: number; companies: string[] }> = {}
for (const r of results) {
  if (!r.expected.primary_industry) continue
  const exp = r.expected.primary_industry
  expectedHits[exp] ??= { hit: 0, missed: 0, companies: [] }
  if (r.dictOutput.primary_industry === exp) expectedHits[exp].hit++
  else { expectedHits[exp].missed++; expectedHits[exp].companies.push(`${r.company} (got ${r.dictOutput.primary_industry})`) }
}

// Domain tag analysis — which expected tags dict missed
let totalExpectedTags = 0
let totalDictTags = 0
let totalMatched = 0
const tagMissReasons: Record<string, string[]> = {}
for (const r of results) {
  totalExpectedTags += r.expected.domain_tags.length
  totalDictTags += r.dictOutput.domain_tags.length
  const dictTags = r.dictOutput.domain_tags as readonly string[]
  totalMatched += r.expected.domain_tags.filter(t => dictTags.includes(t)).length
  const missed = r.expected.domain_tags.filter(t => !dictTags.includes(t))
  for (const t of missed) {
    tagMissReasons[t] ??= []
    const cats = r.inputs.categories.join(', ')
    tagMissReasons[t].push(`${r.company} — Crust categories=[${cats.slice(0, 80)}${cats.length > 80 ? '...' : ''}]`)
  }
}

// ---- report ----
const lines: string[] = []
const w = (...a: string[]) => lines.push(a.join(''))

w(`# Dictionary Failure Pattern Analysis\n`)
w(`*Generated: ${new Date().toISOString()}*  `)
w(`*Sample: ${results.length} companies (Inv1 dataset; enrich-tier signals).*  `)
w(`*Pure offline analysis — no API calls.*\n`)

// ---- aggregate ----
w(`## Aggregate accuracy\n`)
const catCorrectN = results.filter(r => r.catCorrect).length
const primaryCorrectN = results.filter(r => r.primaryCorrect).length
const tagPrec = totalDictTags === 0 ? 1 : totalMatched / totalDictTags
const tagRec = totalExpectedTags === 0 ? 1 : totalMatched / totalExpectedTags
w(`- Category: ${catCorrectN}/${results.length} (${Math.round(catCorrectN/results.length*100)}%)`)
w(`- Primary industry: ${primaryCorrectN}/${results.length} (${Math.round(primaryCorrectN/results.length*100)}%)`)
w(`- Domain tags: precision=${tagPrec.toFixed(2)}, recall=${tagRec.toFixed(2)} (${totalMatched}/${totalExpectedTags} expected hit)\n`)

// ---- per-company ----
w(`## Per-company dict output vs ground truth\n`)
w(`| Company | Expected primary | Dict primary | Cat? | Pri? | Reasoning excerpt |`)
w(`|---|---|---|---|---|---|`)
for (const r of results) {
  const reason = (r.dictOutput.reasoning || '').slice(0, 80)
  w(`| ${r.company} | ${r.expected.primary_industry ?? '∅'} | ${r.dictOutput.primary_industry ?? '∅'} | ${r.catCorrect ? '✓' : '✗'} | ${r.primaryCorrect ? '✓' : '✗'} | ${reason}... |`)
}
w(``)

// ---- per-rule overfire/correct ----
w(`## Industry rule fire rates (which dict-rules over-fire)\n`)
w(`| Industry rule | Times fired | Correct | Wrong | Wrong cases |`)
w(`|---|---|---|---|---|`)
for (const [ind, s] of Object.entries(ruleFires).sort()) {
  const total = s.correct + s.wrong
  w(`| ${ind} | ${total} | ${s.correct} | ${s.wrong} | ${s.companies.join('; ') || '—'} |`)
}
w(``)

// ---- per-expected ----
w(`## Industry coverage (how often dict reaches the right industry)\n`)
w(`| Expected industry | Sampled | Dict hit | Dict missed | Missed cases |`)
w(`|---|---|---|---|---|`)
for (const [ind, s] of Object.entries(expectedHits).sort()) {
  const total = s.hit + s.missed
  w(`| ${ind} | ${total} | ${s.hit} | ${s.missed} | ${s.companies.join('; ') || '—'} |`)
}
w(``)

// ---- domain tag misses ----
w(`## Domain tag misses (expected tag not in dict output)\n`)
for (const [tag, cases] of Object.entries(tagMissReasons).sort()) {
  w(`### \`${tag}\` missed (${cases.length} times)`)
  for (const c of cases) w(`- ${c}`)
  w(``)
}

// ---- per-failure deep dive ----
w(`## Failure deep-dive (per company that got primary wrong)\n`)
for (const r of failures) {
  w(`### ${r.company}`)
  w(`- Expected: \`${r.expected.primary_industry}\``)
  w(`- Dict said: \`${r.dictOutput.primary_industry}\``)
  w(`- Crust signals dict had to work with:`)
  w(`  - PNI: \`"${r.inputs.professional_network_industry}"\``)
  w(`  - industries[]: \`${JSON.stringify(r.inputs.industries)}\``)
  w(`  - categories[] (first 12): \`${JSON.stringify(r.inputs.categories.slice(0, 12))}\``)
  w(`- Dict reasoning: \`${r.dictOutput.reasoning}\`\n`)
}

// ---- structural limitations ----
w(`## Structural patterns observed\n`)
w(`### Domain tag recall is low (${(tagRec * 100).toFixed(0)}%) primarily because Crust's categories[] field doesn't surface the right strings`)
w(`Examples:`)
w(`- Anduril makes drones; Crust categories does not include "Drones" → dict can't add the tag`)
w(`- Stripe has B2B and Infrastructure as part of its product; Crust categories doesn't include those words → dict can't add the tags`)
w(`- This is a STRUCTURAL limitation. Dict reads only Crust signals; if Crust doesn't say it, dict can't surface it. Claude reads description + can infer.`)
w(``)
w(`### Specific rule-order bugs:`)
w(`- Defense rule fires too eagerly on broad signals (PNI="Defense and Space Manufacturing", categories including "Law Enforcement"). Drone/space cos that aren't actually defense get tagged Defense.`)
w(`- AI rule fires before Biotech rule for biotech-with-AI cos (Recursion Pharmaceuticals).`)
w(`- Aerospace rule doesn't trigger on "Drones"/"Drone Management" categories — drone makers fall through to Defense (Skydio).`)

writeFileSync(RPT, lines.join('\n'))
console.error(`Wrote ${RPT}`)
