// lib/companies/tagger/claude.ts
//
// Claude Haiku 4.5 tagger. Round-2 architecture: Claude is PRIMARY (always
// runs); the dictionary runs in parallel as a sanity check.
//
// - Option B output: primary_industry + industries[] (multi-industry support)
// - temperature=0 for reproducibility (cache outputs; don't re-tag on refresh)
// - Disambiguation rules baked into the system prompt:
//   * Hardware/Defense vs Non-hardware/Defense (physical product vs software-for-defense)
//   * Hardware/Aerospace vs Non-hardware/Aerospace (physical product vs software-for-aerospace)
//   * Biotech in both branches (medical devices vs drug-discovery software)
//   * AI domain_tag suppression when industry='AI'
//   * AI tag fires only when AI is core to the product, not when it's a feature
//
// C1 (round-3): tightened prompt with explicit list-membership rules +
//                "common confusions" callouts (industries vs domain_tags
//                cross-listed names like AI, Robotics, Mobile).
// C2 (round-3): forgiving validator. Hard failures (invalid JSON, invalid
//                category enum, primary_industry missing or invalid for
//                category) still null the whole output. Soft failures
//                (some industries[] or domain_tags[] values not in the
//                allowed set) strip the invalid values and keep the partial
//                valid output, logging the stripped values into reasoning
//                for review. Recovers ~80% of previously-nulled cases.
//
// Pattern matches lib/ai/narrative.ts: direct fetch to Anthropic, no SDK.

import {
  HARDWARE_INDUSTRIES, NON_HARDWARE_INDUSTRIES,
  HARDWARE_DOMAIN_TAGS, NON_HARDWARE_DOMAIN_TAGS,
  industriesFor, domainTagsFor,
  isValidIndustry, dedupeDomainTagsAgainstIndustry,
} from '../taxonomy'
import type { CategoryOrUnclassified, Industry, DomainTag } from '../taxonomy'
import type { TaggerInput, TaggerOutput } from './types'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5'

const SYSTEM_PROMPT = `You are a company classifier for the Vetted Recruiting Intelligence platform.

You map companies to a STRICT controlled taxonomy. Output is consumed by a search system; pick from the listed values only.

## Categories (pick exactly one, OR null if you can't classify)
- "hardware" — primary product is physical (defense systems, aerospace vehicles, robots, medical devices, semiconductors, energy generation/storage hardware, automotive, industrial machinery, materials, maritime vessels, consumer electronics, biotech instruments / wet-lab equipment).
- "non_hardware" — primary product is software, services, or financial (SaaS, AI software, FinTech, investment banking, quant trading, blockchain, consumer tech, healthtech software, biotech via software/AI, professional services, legal, defense software, aerospace software).
- null — only if you genuinely cannot place the company.

## Industries

### Hardware industries (use ONE as primary if category="hardware"; list 1-4 in industries[])
${HARDWARE_INDUSTRIES.map(s => `- ${s}`).join('\n')}

### Non-hardware industries (use ONE as primary if category="non_hardware"; list 1-4 in industries[])
${NON_HARDWARE_INDUSTRIES.map(s => `- ${s}`).join('\n')}

## Domain tags

### Hardware domain tags (zero or more if category="hardware")
${HARDWARE_DOMAIN_TAGS.map(s => `- ${s}`).join('\n')}

### Non-hardware domain tags (zero or more if category="non_hardware")
${NON_HARDWARE_DOMAIN_TAGS.map(s => `- ${s}`).join('\n')}

## STRICT list-membership rules — read carefully

The four lists above (hardware industries, non-hardware industries, hardware domain tags, non-hardware domain tags) are CLOSED VOCABULARIES. Every value you emit MUST appear verbatim in the matching list. Values that share a name across lists (like "AI") are NOT interchangeable — see "Common confusions" below.

### Where each output field draws from
- \`primary_industry\` and every entry in \`industries[]\` → ONLY from the industries list for the chosen category.
- Every entry in \`domain_tags[]\` → ONLY from the domain tags list for the chosen category.
- NEVER put a domain-tag value into \`industries[]\` (e.g. "Mobile" is a domain tag, never an industry).
- NEVER put an industry value into \`domain_tags[]\` (e.g. "Robotics" is a hardware industry, never a domain tag).

### Common confusions (these tripped up earlier outputs — get them right)

**"AI" is BOTH a non-hardware industry AND a domain tag in both branches.** Pick the right one:
- If the company's PRIMARY business is AI software/research (OpenAI, Anthropic, Cohere, Mistral, Mercor, Scale AI) → category=non_hardware, primary_industry=AI, industries=[AI]. Do NOT also list AI in domain_tags (suppressed when industry=AI).
- If AI is core to the product but the primary business is something else (chips, robots, drones, biotech, productivity) → put the industry in industries[] and "AI" in domain_tags[]. Examples:
  - Cerebras / Tenstorrent / NVIDIA → category=hardware, primary_industry=Semiconductors, industries=[Semiconductors], domain_tags=[AI].
  - Boston Dynamics / Figure AI / 1X → category=hardware, primary_industry=Robotics, industries=[Robotics], domain_tags=[AI].
  - Recursion / Tempus → category=non_hardware, primary_industry=Biotech, industries=[Biotech], domain_tags=[AI, Data].

**"Robotics" is a HARDWARE INDUSTRY, never a domain tag.** Tesla's Optimus → add Robotics to industries[], not domain_tags[].

**"Mobile" is a NON-HARDWARE DOMAIN TAG only.** Apple makes physical devices → category=hardware, primary_industry=Consumer Electronics, industries=[Consumer Electronics]. "Mobile" is not allowed in either field for hardware companies. (If you want to flag mobile-software focus on a non-hardware co, then domain_tags=[Mobile] is fine.)

**"Analytics" / "Data" / "Infrastructure" are NON-HARDWARE DOMAIN TAGS only.** Palantir → category=non_hardware, primary_industry=Defense, industries=[Defense, AI], domain_tags=[Data, Analytics, Infrastructure, AI].

**"Hardware industry, non-hardware tag" or vice versa is INVALID.** A hardware company never gets non-hardware domain tags (Productivity, Mobile, B2B, Data, etc.) and vice versa. Pick the category first, then ONLY draw from that category's two lists.

### Self-check before output
Before you emit JSON, mentally verify:
1. Is every \`industries[]\` value in the industries list for my chosen category? (Not the domain-tags list, not the OTHER category's industries list.)
2. Is every \`domain_tags[]\` value in the domain-tags list for my chosen category?
3. If I used "AI": is it in the right field per the rules above?

## Disambiguation rules

### Defense and Aerospace can be EITHER category
- **Hardware/Defense** — primary product is a physical defense system (drone, vehicle, weapon, sensor, military hardware). E.g. Anduril Industries (autonomous defense systems), Lockheed Martin.
- **Non-hardware/Defense** — primary product is software/services SOLD TO defense customers, no physical product. E.g. Palantir (data/analytics platforms), Rebellion Defense (software for DoD).
- **Hardware/Aerospace** — builds physical aerospace products (rockets, satellites, aircraft, eVTOL). E.g. SpaceX, Astra Space.
- **Non-hardware/Aerospace** — software/services for the aerospace industry (e.g. space domain awareness platforms, flight planning SaaS). E.g. Slingshot Aerospace.

### Biotech in BOTH branches
- **Hardware/Biotech** — physical instruments, wet-lab equipment, medical devices for genomics. E.g. Illumina (sequencing instruments).
- **Non-hardware/Biotech** — software/AI for drug discovery, computational biology, therapeutics platform. E.g. Recursion (TechBio platform), Tempus Labs.

### Multi-industry companies (Option B)
Most companies have ONE primary industry — for these, return industries=[primary]. Only list multiple when the company genuinely runs multiple full businesses, not just adjacent capabilities. Examples:
- Anduril → primary_industry: Defense, industries: [Defense, Aerospace, Maritime, Industrial Manufacturing] — operates four distinct hardware businesses
- Tesla → primary_industry: Automotive, industries: [Automotive, Energy, Industrial Manufacturing] — cars + Powerwall/solar + Gigafactories
- SpaceX → primary_industry: Aerospace, industries: [Aerospace] — rockets are primary; Starlink could justify a 2nd entry but evaluate
- Stripe → primary_industry: FinTech, industries: [FinTech] — single industry, NOT multi
- Notion → primary_industry: SaaS, industries: [SaaS] — single industry

The primary_industry is the company's TAGLINE business (what they're known for, what their description leads with). Secondary industries are full separate businesses, not features or capabilities.

### Domain tag suppression rule
If you set primary_industry='AI', do NOT include 'AI' in domain_tags — the industry already says it. The AI domain_tag fires only when AI is core to the product but the primary industry is something else. Examples:
- OpenAI → industry=AI, domain_tags=[] (no AI tag — redundant with industry)
- Anduril → industry=Defense, domain_tags=[Drones, AI] (AI is core to Hivemind, but industry=Defense)
- Tesla → industry=Automotive, domain_tags=[EVs, Autonomous Driving, AI, Robotics] (AI core to FSD)
- Recursion → industry=Biotech, domain_tags=[AI, Data] (AI core to drug discovery)
- Notion → industry=SaaS, domain_tags=[Productivity] (NO AI tag — Notion has AI features but core business is productivity SaaS)

### "Core to product" vs "feature"
Use the AI tag only when AI is core. If a company describes AI as a feature/add-on alongside their main product, do NOT tag AI.

## Output format

STRICT JSON, no markdown fences:

{
  "category": "hardware" | "non_hardware" | null,
  "primary_industry": <one industry from the chosen category's list, or null if category is null>,
  "industries": [<1-4 industries from the chosen category's list — must include primary_industry first>],
  "domain_tags": [<zero or more tags from the chosen category's list>],
  "confidence": <0.0 to 1.0>,
  "reasoning": "<one sentence explaining the call>"
}

If category is null: primary_industry=null, industries=[], domain_tags=[].
If unsure: prefer category=null over guessing.`

export async function tagWithClaude(input: TaggerInput): Promise<TaggerOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const userParts: string[] = [`Company: ${input.name}`]
  if (input.professional_network_industry) userParts.push(`LinkedIn industry: ${input.professional_network_industry}`)
  if (input.industries.length > 0) userParts.push(`Industries (LinkedIn): ${input.industries.join(', ')}`)
  if (input.categories.length > 0) userParts.push(`Categories (Crust): ${input.categories.join(', ')}`)
  if (input.description) userParts.push(`Description: ${input.description.slice(0, 600)}`)
  if (input.year_founded) userParts.push(`Founded: ${input.year_founded}`)
  if (input.employee_count_range) userParts.push(`Headcount: ${input.employee_count_range}`)
  if (input.company_type) userParts.push(`Company type: ${input.company_type}`)
  const userMessage = userParts.join('\n')

  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      temperature: 0,                  // round-2: deterministic
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Anthropic HTTP ${resp.status}: ${text.slice(0, 300)}`)
  }

  const data = await resp.json() as { content?: Array<{ type: string; text?: string }> }
  const text = data.content?.filter(c => c.type === 'text').map(c => c.text || '').join('').trim()
  if (!text) throw new Error('Claude returned empty content')

  const cleanText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  let parsed: any
  try { parsed = JSON.parse(cleanText) }
  catch {
    return failure(`invalid JSON: ${cleanText.slice(0, 200)}`)
  }

  // Validate category
  const cat = parsed.category as CategoryOrUnclassified
  if (cat !== 'hardware' && cat !== 'non_hardware' && cat !== null) {
    return failure(`invalid category: ${JSON.stringify(cat)}`)
  }

  if (cat === null) {
    return {
      category: null,
      primary_industry: null,
      industries: [],
      domain_tags: [],
      confidence: typeof parsed.confidence === 'number' ? clamp01(parsed.confidence) : 0,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '(unclassified)',
      method: 'claude',
    }
  }

  // Validate primary_industry — STRICT (can't recover; nulls whole output if invalid)
  const primary = parsed.primary_industry as Industry | null
  if (primary === null || typeof primary !== 'string') {
    return failure(`primary_industry required when category=${cat}`)
  }
  if (!isValidIndustry(cat, primary)) {
    return failure(`primary_industry "${primary}" invalid for category="${cat}"`)
  }

  // C2: Forgiving validation for industries[] and domain_tags[].
  // Strip invalid values, keep valid ones, log strips into reasoning for triage.
  const allowedInds = industriesFor(cat) as readonly string[]
  const rawInds = Array.isArray(parsed.industries) ? (parsed.industries as string[]) : [primary]
  const validInds: Industry[] = []
  const invalidInds: string[] = []
  for (const i of rawInds) {
    if (typeof i === 'string' && allowedInds.includes(i)) validInds.push(i as Industry)
    else if (typeof i === 'string') invalidInds.push(i)
  }
  // Always ensure primary is first and present in industries[] (we know primary is valid here)
  const inds: Industry[] = [primary, ...validInds.filter(i => i !== primary)]

  const allowedTags = domainTagsFor(cat) as readonly string[]
  const rawTags = Array.isArray(parsed.domain_tags) ? (parsed.domain_tags as string[]) : []
  const validTags: DomainTag[] = []
  const invalidTags: string[] = []
  for (const t of rawTags) {
    if (typeof t === 'string' && allowedTags.includes(t)) validTags.push(t as DomainTag)
    else if (typeof t === 'string') invalidTags.push(t)
  }

  // Round-2 decision #5: strip AI tag if primary_industry='AI' (or any future cross-listing)
  const dedupedTags = dedupeDomainTagsAgainstIndustry(primary, validTags) as DomainTag[]

  // Build reasoning, appending strip-log if anything was dropped (so it lands in tagging_notes)
  let reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '(no reasoning)'
  const stripped: string[] = []
  if (invalidInds.length > 0) stripped.push(`industries=${JSON.stringify(invalidInds)}`)
  if (invalidTags.length > 0) stripped.push(`domain_tags=${JSON.stringify(invalidTags)}`)
  if (stripped.length > 0) {
    reasoning = `${reasoning} [C2 strip: ${stripped.join('; ')}]`
  }

  return {
    category: cat,
    primary_industry: primary,
    industries: inds,
    domain_tags: dedupedTags,
    confidence: typeof parsed.confidence === 'number' ? clamp01(parsed.confidence) : 0.7,
    reasoning,
    method: 'claude',
  }

  function failure(why: string): TaggerOutput {
    return {
      category: null,
      primary_industry: null,
      industries: [],
      domain_tags: [],
      confidence: 0,
      reasoning: `Claude validation failed: ${why}`,
      method: 'claude',
    }
  }
}

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)) }
