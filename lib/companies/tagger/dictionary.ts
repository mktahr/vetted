// lib/companies/tagger/dictionary.ts
//
// Deterministic Tier-1 tagger. Maps Crust signals → V1 (category, industry, domain_tags).
// Returns category='unreviewed' (NOT a high-confidence guess) when signals are
// ambiguous — the orchestrator (lib/companies/tagger/index.ts) escalates those
// to Claude tier-2.
//
// Design philosophy: high precision over high recall at this layer. Better to
// abstain (return unreviewed) than mis-tag a candidate's company.

import type { Category, Industry, DomainTag } from '../taxonomy'
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
  { industry: 'Defense', any: ['Defense and Space Manufacturing', 'Military', 'National Security', 'Law Enforcement'],
    reasoning: 'Defense / Military / National Security signal' },
  { industry: 'Aerospace', any: ['Aviation and Aerospace Component Manufacturing', 'Aerospace', 'Space Travel', 'Satellite Communication'],
    reasoning: 'Aerospace / Space signal' },
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
  // Biotech (non-hardware) — software/AI for biotech, drug discovery
  { industry: 'Biotech', any: ['Pharmaceutical', 'Therapeutics', 'TechBio', 'Biotechnology Research', 'Biotechnology'],
    reasoning: 'Biotech signal (non-hardware-leaning context — software/AI/therapeutics)' },
  { industry: 'Legal', any: ['Legal Services', 'Law Practice', 'Law'],
    reasoning: 'Legal signal' },
  { industry: 'Services', any: ['Management Consulting', 'Professional Services', 'Engineering Services'],
    reasoning: 'Services / consulting signal' },
  { industry: 'Consumer Tech', any: ['Mobile', 'Gaming', 'Social Media', 'Streaming', 'Marketplace', 'E-Commerce', 'Consumer'],
    reasoning: 'Consumer-facing tech signal' },
  // SaaS — fallback for non-hardware software cos
  { industry: 'SaaS', any: ['SaaS', 'Software', 'Developer Tools', 'Information Technology', 'Productivity', 'Collaboration', 'CRM'],
    reasoning: 'SaaS / B2B software signal' },
]

// ---------- Domain tag rules ----------

interface DomainTagRule {
  tag: DomainTag
  any: string[]
}

const HARDWARE_DOMAIN_TAG_RULES: DomainTagRule[] = [
  { tag: 'Drones', any: ['Drones', 'Drone Management', 'UAV', 'Unmanned Aerial'] },
  { tag: 'Rockets', any: ['Space Travel', 'Launch Vehicles', 'Rockets'] },
  { tag: 'Satellites', any: ['Satellite Communication', 'Satellites', 'Earth Observation'] },
  { tag: 'Autonomous Driving', any: ['Autonomous Vehicles', 'Self-Driving', 'Autonomous Driving'] },
  { tag: 'EVs', any: ['Electric Vehicles', 'EVs'] },
  { tag: 'Automotive Manufacturing', any: ['Motor Vehicle Manufacturing', 'Automotive Manufacturing'] },
  { tag: 'Nuclear', any: ['Nuclear', 'Nuclear Electric Power Generation', 'Nuclear Fusion', 'Fission'] },
  { tag: 'eVTOL', any: ['eVTOL', 'Vertical Takeoff', 'Air Taxi'] },
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
]

// ---------- Main ----------

/**
 * Run the deterministic dictionary on a single company's Crust signals.
 * Returns category='unreviewed' when signals can't decide — caller
 * (orchestrator) escalates those to Claude tier-2.
 */
export function tagDeterministically(input: TaggerInput): TaggerOutput {
  const { professional_network_industry: pni, industries, categories } = input

  // 1) Build the union of all category-relevant signals from PNI + industries + categories.
  const allSignals = new Set<string>([
    ...(pni ? [pni] : []),
    ...industries,
    ...categories,
  ])

  // 2) Vote on category.
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
    if (HARDWARE_LEAN_CATEGORIES.has(sig)) {
      hardwareScore += 1
    } else if (NON_HARDWARE_LEAN_CATEGORIES.has(sig)) {
      nonHardwareScore += 1
    }
  }
  reasoningParts.push(`category votes: hardware=${hardwareScore}, non_hardware=${nonHardwareScore}`)

  // 3) Decide category.
  const margin = Math.abs(hardwareScore - nonHardwareScore)
  const totalVotes = hardwareScore + nonHardwareScore
  let category: Category
  let categoryConfidence: number

  if (totalVotes === 0) {
    category = 'unreviewed'
    categoryConfidence = 0
    reasoningParts.push(`no recognized signals → unreviewed`)
  } else if (margin < 2) {
    category = 'unreviewed'
    categoryConfidence = 0.4
    reasoningParts.push(`signals split (margin ${margin}) → unreviewed for Claude`)
  } else {
    category = hardwareScore > nonHardwareScore ? 'hardware' : 'non_hardware'
    // Confidence: stronger margin + stronger PNI signal → higher confidence
    const pniBonus = (pni && (HARDWARE_PNI_VALUES.has(pni) || NON_HARDWARE_PNI_VALUES.has(pni))) ? 0.15 : 0
    categoryConfidence = Math.min(1.0, 0.6 + Math.min(margin / 10, 0.3) + pniBonus)
    reasoningParts.push(`category=${category} (margin ${margin}, conf ${categoryConfidence.toFixed(2)})`)
  }

  // 4) Pick industry within the chosen category.
  let industry: Industry | null = null
  if (category !== 'unreviewed') {
    const rules = category === 'hardware' ? HARDWARE_INDUSTRY_RULES : NON_HARDWARE_INDUSTRY_RULES
    for (const rule of rules) {
      if (rule.any.some(s => allSignals.has(s))) {
        industry = rule.industry
        reasoningParts.push(`industry=${industry} (rule: ${rule.reasoning})`)
        break
      }
    }
    if (!industry) {
      // Fallback for hardware: 'Other Hardware'; for non_hardware: 'SaaS'
      industry = category === 'hardware' ? 'Other Hardware' : 'SaaS'
      reasoningParts.push(`industry=${industry} (fallback for ${category})`)
      categoryConfidence = Math.min(categoryConfidence, 0.65)
    }
  }

  // 5) Domain tags.
  const domainTags: DomainTag[] = []
  if (category !== 'unreviewed') {
    const tagRules = category === 'hardware' ? HARDWARE_DOMAIN_TAG_RULES : NON_HARDWARE_DOMAIN_TAG_RULES
    for (const rule of tagRules) {
      if (rule.any.some(s => allSignals.has(s))) {
        domainTags.push(rule.tag)
      }
    }
    if (domainTags.length > 0) reasoningParts.push(`domain_tags=${JSON.stringify(domainTags)}`)
  }

  return {
    category,
    industry: category === 'unreviewed' ? null : industry,
    domain_tags: category === 'unreviewed' ? [] : domainTags,
    confidence: categoryConfidence,
    reasoning: reasoningParts.join('; '),
    method: 'crust_dictionary',
  }
}
