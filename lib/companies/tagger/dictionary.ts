// lib/companies/tagger/dictionary.ts
//
// Deterministic dictionary tagger. Round-2 architecture (2026-05-02):
// no longer tier-1 / primary — Claude is primary. Dictionary now serves as
// a SANITY CHECK that runs in parallel with Claude. The orchestrator
// (lib/companies/tagger/index.ts) compares both verdicts:
//   - agree → tagging_method='claude_dict_agree', high confidence
//   - disagree → tagging_method='claude_dict_disagree', flagged for triage
//   - dict can't decide (returns null category) → tagging_method='claude'
//
// Design philosophy: high precision. Better to return null (couldn't decide)
// than to wrongly agree/disagree with Claude. Dict's value is when it MATCHES
// Claude — that's the highest-confidence signal.

import type { CategoryOrUnclassified, Industry, DomainTag } from '../taxonomy'
import { dedupeDomainTagsAgainstIndustry } from '../taxonomy'
import type { TaggerInput, TaggerOutput } from './types'

// ---------- Category-leaning signals ----------
//
// "Lean" = points toward hardware OR non_hardware. Tally votes; whichever
// side wins decisively (margin >= 2) sets category. Ties → unreviewed.

const HARDWARE_PNI_VALUES = new Set([
  'Defense and Space Manufacturing',
  'Robotics Engineering',
  'Aviation and Aerospace Component Manufacturing',
  'Motor Vehicle Manufacturing',
  'Medical Equipment Manufacturing',
  'Semiconductor Manufacturing',
  'Industrial Automation',
  'Machinery Manufacturing',
  'Renewable Energy Semiconductor Manufacturing',
  'Renewable Energy Power Generation',
  'Oil and Gas',
  'Utilities',
  'Nuclear Electric Power Generation',
  'Battery Manufacturing',
  'Maritime Transportation',
  'Shipbuilding',
  'Mining',
  'Materials',
  'Consumer Electronics',
  'Manufacturing',  // broad — usually pairs with hardware-leaning categories
])

const NON_HARDWARE_PNI_VALUES = new Set([
  'Software Development',
  'Technology, Information and Internet',
  'Technology, Information and Media',
  'Financial Services',
  'Investment Banking',
  'Capital Markets',
  'Venture Capital',
  'Insurance',
  'Banking',
  'Information Technology & Services',
  'Computer Software',
  'Internet',
  'Hospital & Health Care',
  'Mental Health Care',
  'Telehealth',
  'Legal Services',
  'Law Practice',
  'Management Consulting',
  'Professional Services',  // weak — often pairs with hw OR sw
])

// "Indeterminate" PNI: needs other signals to resolve.
//   Biotechnology Research → could be hw (Illumina-style devices) OR sw (Recursion-style platform)
//   Research Services → could be either
//   Engineering Services → ambiguous

const HARDWARE_LEAN_CATEGORIES = new Set([
  'Aerospace', 'Space Travel', 'Satellite Communication', 'Drones', 'Drone Management',
  'Autonomous Vehicles', 'Robotics', 'National Security', 'Military', 'Law Enforcement',
  'Mechanical Engineering', 'Manufacturing', 'Industrial Automation', 'Heavy Machinery',
  'Medical', 'Health Diagnostics', 'Medical Device', 'Genetics', 'Biotechnology',
  'Renewable Energy', 'Energy Storage', 'Battery', 'Nuclear', 'Solar', 'Wind Energy',
  'Automotive', 'Electric Vehicles', 'Mining', 'Oil and Gas', 'Materials',
  'Semiconductor', 'Chips', 'Hardware',
])

const NON_HARDWARE_LEAN_CATEGORIES = new Set([
  'SaaS', 'Software', 'Information Technology', 'Developer Tools',
  'AI Infrastructure', 'Foundational AI', 'Generative AI', 'Machine Learning',
  'Artificial Intelligence', 'Artificial Intelligence (AI)', 'Natural Language Processing',
  'Chatbot', 'Agentic AI',
  'FinTech', 'Finance', 'Financial Services', 'Personal Finance', 'Mobile Payments',
  'InsurTech', 'Banking', 'Wealth Management',
  'Cybersecurity', 'Security', 'Identity Management',
  'Marketplace', 'E-Commerce', 'Consumer', 'Mobile', 'Gaming', 'Social Media',
  'Streaming', 'Content', 'Media',
  'Productivity', 'Collaboration', 'CRM', 'HR', 'Analytics', 'Data',
  'Open Source',
  'Pharmaceutical', 'Therapeutics', 'TechBio',
  'Cryptocurrency', 'Blockchain', 'Web3', 'NFT',
  'Investment Banking', 'Asset Management', 'Hedge Fund',
  'Legal Services', 'Law',
  'Hospital & Health Care', 'Telehealth', 'Mental Health',
])

// ---------- Industry-specific signals (after category is decided) ----------

const HARDWARE_INDUSTRY_RULES: Array<{
  industry: Industry
  any: string[]            // any of these signals (PNI / industries / categories) triggers
  reasoning: string
}> = [
  // Round-2 fixes E2.1 + E3 (2026-05-03): Defense BEFORE Aerospace; both rules
  // tightened. Strict signal-based ordering:
  //
  //   - Defense fires on Military / National Security / Government (real defense
  //     signals that distinguish defense contractors from generic aerospace).
  //     Excludes Law Enforcement (cops also buy drones from Skydio etc, not a
  //     defense signal alone) and the broad "Defense and Space Manufacturing"
  //     PNI (E3 — fires on commercial space cos like Astra).
  //
  //   - Aerospace fires on SPECIFIC aerospace signals only (Drones, Space,
  //     Satellites, Aviation Component, eVTOL). Does NOT include the bare
  //     "Aerospace" category string — that string appears on defense-with-aero
  //     cos like Anduril and would mis-route them.
  //
  // Test outcomes after this rule set:
  //   - Anduril (Military+NatSec+Gov): Defense fires → ✓
  //   - Astra Space (no defense, has Space Travel+Satellite): Aerospace fires → ✓
  //   - Skydio (only Law Enforcement; has Drones): Aerospace fires → ✓
  //   - Lockheed-style defense aerospace (Military+NatSec+Aviation): Defense fires → ✓
  //   - Pure-aerospace cos with bare "Aerospace" only (no specific signals):
  //     fall through to Other Hardware. Claude catches.
  { industry: 'Defense', any: ['Military', 'National Security', 'Government'],
    reasoning: 'Defense signal (E2.1+E3: Military/NatSec/Government required; Law Enforcement and "Defense and Space Manufacturing" PNI dropped)' },
  { industry: 'Aerospace', any: [
      'Aviation and Aerospace Component Manufacturing',
      'Space Travel', 'Satellite Communication', 'Satellites',
      'Drones', 'Drone Management', 'UAV', 'Unmanned Aerial', 'eVTOL',
    ],
    reasoning: 'Aerospace specific signal (E2.1: bare "Aerospace" string excluded — fires only on Drones/Space/Satellite/Aviation/eVTOL)' },
  { industry: 'Robotics', any: ['Robotics Engineering', 'Robotics'],
    reasoning: 'Robotics signal' },
  { industry: 'Medical Devices', any: ['Medical Equipment Manufacturing', 'Health Diagnostics', 'Medical Device', 'Genetics'],
    reasoning: 'Medical devices / diagnostics signal' },
  { industry: 'Semiconductors', any: ['Semiconductor Manufacturing', 'Semiconductor', 'Chips'],
    reasoning: 'Semiconductor signal' },
  { industry: 'Energy', any: ['Renewable Energy Power Generation', 'Renewable Energy', 'Solar', 'Wind Energy', 'Oil and Gas', 'Utilities', 'Nuclear Electric Power Generation', 'Nuclear'],
    reasoning: 'Energy generation signal' },
  { industry: 'Energy Storage', any: ['Battery Manufacturing', 'Battery', 'Energy Storage'],
    reasoning: 'Energy storage / battery signal' },
  { industry: 'Automotive', any: ['Motor Vehicle Manufacturing', 'Automotive', 'Electric Vehicles'],
    reasoning: 'Automotive signal' },
  { industry: 'Maritime', any: ['Maritime Transportation', 'Shipbuilding'],
    reasoning: 'Maritime signal' },
  { industry: 'Materials', any: ['Materials', 'Mining'],
    reasoning: 'Materials / mining signal' },
  { industry: 'Industrial Manufacturing', any: ['Industrial Automation', 'Machinery Manufacturing', 'Heavy Machinery'],
    reasoning: 'Industrial manufacturing signal' },
  { industry: 'Consumer Electronics', any: ['Consumer Electronics'],
    reasoning: 'Consumer electronics signal' },
  // Biotech (hardware) — when biotech signals AND device/diagnostic signals
  { industry: 'Biotech', any: ['Biotechnology Research', 'Biotechnology'],
    reasoning: 'Biotech signal (hardware-leaning context — devices/diagnostics)' },
  // Other Hardware — fallback for anything else marked hardware
]

const NON_HARDWARE_INDUSTRY_RULES: Array<{
  industry: Industry
  any: string[]
  reasoning: string
}> = [
  // Round-2 fix E1 (2026-05-03): Biotech-specific signals (Pharmaceutical,
  // Therapeutics, TechBio) checked BEFORE AI. Recursion-style biotech-with-AI
  // cos previously got mis-tagged as AI because AI fired first.
  { industry: 'Biotech', any: ['Pharmaceutical', 'Therapeutics', 'TechBio'],
    reasoning: 'Biotech-specific signal (E1: ordered before AI). Pharmaceutical/Therapeutics/TechBio signal a biotech business even when AI signals are present.' },
  { industry: 'AI', any: ['Foundational AI', 'Generative AI', 'AI Infrastructure', 'Agentic AI', 'Artificial Intelligence', 'Artificial Intelligence (AI)', 'Machine Learning', 'Natural Language Processing'],
    reasoning: 'AI / ML signal' },
  { industry: 'FinTech', any: ['FinTech', 'Mobile Payments', 'Financial Services', 'Personal Finance', 'InsurTech', 'Banking'],
    reasoning: 'FinTech / financial-services signal' },
  { industry: 'Investment Banking', any: ['Investment Banking', 'Investment Management'],
    reasoning: 'Investment banking signal' },
  { industry: 'Quant/Trading', any: ['Capital Markets', 'Hedge Fund', 'Asset Management', 'Quantitative Trading'],
    reasoning: 'Capital markets / quant signal' },
  { industry: 'Blockchain & Web3', any: ['Cryptocurrency', 'Blockchain', 'Web3', 'NFT', 'Decentralized Finance'],
    reasoning: 'Blockchain / crypto signal' },
  { industry: 'HealthTech', any: ['Telehealth', 'Hospital & Health Care', 'Mental Health Care', 'Mental Health'],
    reasoning: 'HealthTech (software) signal' },
  // Biotech fallback for biotech cos that didn't hit the E1 specific-signal
  // gate above but DO have generic Biotechnology signals
  { industry: 'Biotech', any: ['Biotechnology Research', 'Biotechnology'],
    reasoning: 'Biotech (fallback after AI rule — only fires when no AI signals)' },
  { industry: 'Legal', any: ['Legal Services', 'Law Practice', 'Law'],
    reasoning: 'Legal signal' },
  { industry: 'Services', any: ['Management Consulting', 'Professional Services', 'Engineering Services'],
    reasoning: 'Services / consulting signal' },
  { industry: 'Consumer Tech', any: ['Mobile', 'Gaming', 'Social Media', 'Streaming', 'Marketplace', 'E-Commerce', 'Consumer'],
    reasoning: 'Consumer-facing tech signal' },
  // Round-2 decision #12: Defense and Aerospace cross-listed for software/services cos
  { industry: 'Defense', any: ['Defense Software', 'Government Software'],
    reasoning: 'Software-for-defense signal (sells software/services to defense customers, no physical product)' },
  { industry: 'Aerospace', any: ['Space Software', 'Space Domain Awareness', 'Aerospace Software'],
    reasoning: 'Software-for-aerospace signal (sells software/services to aerospace industry, no physical product)' },
  // SaaS — fallback for non-hardware software cos
  { industry: 'SaaS', any: ['SaaS', 'Software', 'Developer Tools', 'Information Technology', 'Productivity', 'Collaboration', 'CRM'],
    reasoning: 'SaaS / B2B software signal' },
]

// ---------- Domain tag rules ----------

interface DomainTagRule {
  tag: DomainTag
  any: string[]
}

// Round-2 decision #11: AI is a domain_tag in BOTH branches now. Suppression
// rule (industry='AI' → strip AI from tags) lives in the orchestrator, not here.
const AI_SIGNALS = ['Foundational AI', 'Generative AI', 'AI Infrastructure', 'Agentic AI',
                    'Artificial Intelligence', 'Artificial Intelligence (AI)', 'Machine Learning',
                    'Natural Language Processing']

const HARDWARE_DOMAIN_TAG_RULES: DomainTagRule[] = [
  { tag: 'Drones', any: ['Drones', 'Drone Management', 'UAV', 'Unmanned Aerial'] },
  { tag: 'Rockets', any: ['Space Travel', 'Launch Vehicles', 'Rockets'] },
  { tag: 'Satellites', any: ['Satellite Communication', 'Satellites', 'Earth Observation'] },
  { tag: 'Autonomous Driving', any: ['Autonomous Vehicles', 'Self-Driving', 'Autonomous Driving'] },
  { tag: 'EVs', any: ['Electric Vehicles', 'EVs'] },
  { tag: 'Automotive Manufacturing', any: ['Motor Vehicle Manufacturing', 'Automotive Manufacturing'] },
  { tag: 'Nuclear', any: ['Nuclear', 'Nuclear Electric Power Generation', 'Nuclear Fusion', 'Fission'] },
  { tag: 'eVTOL', any: ['eVTOL', 'Vertical Takeoff', 'Air Taxi'] },
  { tag: 'AI', any: AI_SIGNALS },  // round-2 decision #11
]

const NON_HARDWARE_DOMAIN_TAG_RULES: DomainTagRule[] = [
  { tag: 'Cybersecurity', any: ['Cybersecurity', 'Security', 'Identity Management', 'Endpoint Security'] },
  { tag: 'DevTools', any: ['Developer Tools', 'AI Infrastructure', 'DevTools', 'API'] },
  { tag: 'Payments', any: ['Mobile Payments', 'Payments', 'Payment Processing'] },
  { tag: 'Mobile', any: ['Mobile', 'Mobile Apps'] },
  { tag: 'Gaming', any: ['Gaming', 'Mobile Gaming', 'Video Games'] },
  { tag: 'Social', any: ['Social Media', 'Social Network', 'Community'] },
  { tag: 'Streaming', any: ['Streaming', 'Video Streaming', 'Content Streaming'] },
  { tag: 'Marketplace', any: ['Marketplace', 'E-Commerce', 'Online Marketplace'] },
  { tag: 'Analytics', any: ['Analytics', 'Business Intelligence', 'Data Visualization'] },
  { tag: 'Data', any: ['Data', 'Big Data', 'Data Pipeline', 'Data Warehouse'] },
  { tag: 'Productivity', any: ['Productivity', 'Collaboration'] },
  { tag: 'HR', any: ['HR', 'Human Resources', 'Recruiting', 'Talent'] },
  { tag: 'Enterprise Software', any: ['Enterprise Software', 'CRM', 'ERP', 'Enterprise'] },
  { tag: 'Consumer', any: ['Consumer'] },
  { tag: 'B2B', any: ['B2B'] },
  { tag: 'Infrastructure', any: ['Infrastructure', 'Cloud Infrastructure', 'AI Infrastructure', 'Networking'] },
  { tag: 'AI', any: AI_SIGNALS },  // round-2 decision #11
]

// ---------- Main ----------

/**
 * Run the deterministic dictionary on one company's Crust signals.
 *
 * Round-2: returns category=null (NOT 'unreviewed') when signals can't decide.
 * The dictionary is a SANITY CHECK alongside Claude (which always runs);
 * the orchestrator decides what to write. Dict's role is highest-precision
 * agreement with Claude — null is honest "I can't tell."
 *
 * Option B output: returns single-element `industries: [primary]` array.
 * Dict doesn't do multi-industry — Claude is the one that lists secondaries.
 */
export function tagDeterministically(input: TaggerInput): TaggerOutput {
  const { professional_network_industry: pni, industries: srcIndustries, categories } = input

  const allSignals = new Set<string>([
    ...(pni ? [pni] : []),
    ...srcIndustries,
    ...categories,
  ])

  let hardwareScore = 0
  let nonHardwareScore = 0
  const reasoningParts: string[] = []

  if (pni && HARDWARE_PNI_VALUES.has(pni)) {
    hardwareScore += 3
    reasoningParts.push(`PNI="${pni}" → hardware (+3)`)
  } else if (pni && NON_HARDWARE_PNI_VALUES.has(pni)) {
    nonHardwareScore += 3
    reasoningParts.push(`PNI="${pni}" → non_hardware (+3)`)
  }

  for (const sig of Array.from(allSignals)) {
    if (HARDWARE_LEAN_CATEGORIES.has(sig)) hardwareScore += 1
    else if (NON_HARDWARE_LEAN_CATEGORIES.has(sig)) nonHardwareScore += 1
  }
  reasoningParts.push(`votes: hw=${hardwareScore}, non_hw=${nonHardwareScore}`)

  const margin = Math.abs(hardwareScore - nonHardwareScore)
  const totalVotes = hardwareScore + nonHardwareScore
  let category: CategoryOrUnclassified
  let categoryConfidence: number

  // Round-2 fix M2 (2026-05-03): cross-signal check.
  // When PNI says one category but the cumulative category-lean votes (from
  // categories[] + industries[]) say the other, dict abstains (returns null).
  // This handles cases like Shield AI: PNI="Software Development" (non_hw +3)
  // but categories include Drones / National Security / Mechanical Engineering
  // (hw-leaning). Previously dict picked the PNI-side and was confidently
  // wrong; now it returns null and lets Claude (with description) decide.
  const pniIsHw = !!(pni && HARDWARE_PNI_VALUES.has(pni))
  const pniIsNonHw = !!(pni && NON_HARDWARE_PNI_VALUES.has(pni))
  const categoryVotesOnly = {
    hw: hardwareScore - (pniIsHw ? 3 : 0),
    non_hw: nonHardwareScore - (pniIsNonHw ? 3 : 0),
  }
  // M2 (round-2 fix): PNI says one category, but cumulative non-PNI votes
  // (categories[] + industries[]) say the other AT 5+ ABSOLUTE STRENGTH.
  // Loosened to ABSOLUTE threshold (>=5) rather than relative-to-other-side
  // — handles tied cases like Shield AI where PNI=Software but categories
  // include Drones+National Security+Mechanical Engineering+Robotics+
  // Autonomous Vehicles (5 hw signals against PNI's non_hw).
  const pniVsCategoriesContradict =
    (pniIsHw && categoryVotesOnly.non_hw >= 5) ||
    (pniIsNonHw && categoryVotesOnly.hw >= 5)

  if (totalVotes === 0) {
    // Round-2: NULL category instead of 'unreviewed' string
    reasoningParts.push(`no recognized signals → null`)
    return {
      category: null, primary_industry: null, industries: [], domain_tags: [],
      confidence: 0, reasoning: reasoningParts.join('; '), method: 'crust_dictionary',
    }
  } else if (pniVsCategoriesContradict) {
    // M2: PNI says one thing, categories strongly say the other → null
    reasoningParts.push(`M2: PNI=${pniIsHw ? 'hw' : 'non_hw'} but categories favor ${pniIsHw ? 'non_hw' : 'hw'} (cat-only votes hw=${categoryVotesOnly.hw}/non_hw=${categoryVotesOnly.non_hw}) → null`)
    return {
      category: null, primary_industry: null, industries: [], domain_tags: [],
      confidence: 0.3, reasoning: reasoningParts.join('; '), method: 'crust_dictionary',
    }
  } else if (margin < 2) {
    reasoningParts.push(`signals split (margin ${margin}) → null`)
    return {
      category: null, primary_industry: null, industries: [], domain_tags: [],
      confidence: 0.4, reasoning: reasoningParts.join('; '), method: 'crust_dictionary',
    }
  } else {
    category = hardwareScore > nonHardwareScore ? 'hardware' : 'non_hardware'
    const pniBonus = (pni && (HARDWARE_PNI_VALUES.has(pni) || NON_HARDWARE_PNI_VALUES.has(pni))) ? 0.15 : 0
    categoryConfidence = Math.min(1.0, 0.6 + Math.min(margin / 10, 0.3) + pniBonus)
    reasoningParts.push(`category=${category} (margin ${margin}, conf ${categoryConfidence.toFixed(2)})`)
  }

  // Pick industry within the chosen category.
  let primary: Industry | null = null
  const rules = category === 'hardware' ? HARDWARE_INDUSTRY_RULES : NON_HARDWARE_INDUSTRY_RULES
  for (const rule of rules) {
    if (rule.any.some(s => allSignals.has(s))) {
      primary = rule.industry
      reasoningParts.push(`industry=${primary} (rule: ${rule.reasoning})`)
      break
    }
  }
  if (!primary) {
    primary = category === 'hardware' ? 'Other Hardware' : 'SaaS'
    reasoningParts.push(`industry=${primary} (fallback for ${category})`)
    categoryConfidence = Math.min(categoryConfidence, 0.65)
  }

  // Domain tags.
  const domainTags: DomainTag[] = []
  const tagRules = category === 'hardware' ? HARDWARE_DOMAIN_TAG_RULES : NON_HARDWARE_DOMAIN_TAG_RULES
  for (const rule of tagRules) {
    if (rule.any.some(s => allSignals.has(s))) {
      domainTags.push(rule.tag)
    }
  }

  // Round-2 decision #5: strip a domain_tag that duplicates the primary
  // industry (currently affects only AI: industry='AI' → drop AI tag).
  const dedupedTags = dedupeDomainTagsAgainstIndustry(primary, domainTags) as DomainTag[]
  if (dedupedTags.length !== domainTags.length) {
    reasoningParts.push(`stripped duplicate-of-industry tag from domain_tags`)
  }
  if (dedupedTags.length > 0) reasoningParts.push(`domain_tags=${JSON.stringify(dedupedTags)}`)

  return {
    category,
    primary_industry: primary,
    industries: [primary],   // Option B: dict is single-industry; Claude does multi
    domain_tags: dedupedTags,
    confidence: categoryConfidence,
    reasoning: reasoningParts.join('; '),
    method: 'crust_dictionary',
  }
}
