// lib/companies/tagger/claude.ts
//
// Tier-2 tagger: Claude Haiku 4.5 inference for cases where the deterministic
// dictionary returned category='unreviewed' (signals ambiguous or absent).
//
// Pattern matches lib/ai/narrative.ts: direct fetch to Anthropic Messages API,
// no SDK dependency. Uses ANTHROPIC_API_KEY from env.
//
// The prompt is constructed with the FULL controlled vocabulary embedded so
// Claude returns valid enum values. We validate the JSON output against the
// taxonomy and fall back to category='unreviewed' on any validation failure.

import {
  HARDWARE_INDUSTRIES, NON_HARDWARE_INDUSTRIES,
  HARDWARE_DOMAIN_TAGS, NON_HARDWARE_DOMAIN_TAGS,
  isValidIndustry, isValidDomainTags,
} from '../taxonomy'
import type { Category, Industry, DomainTag } from '../taxonomy'
import type { TaggerInput, TaggerOutput } from './types'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5'

const SYSTEM_PROMPT = `You are a company classifier for the Vetted Recruiting Intelligence platform.

You map companies to a STRICT controlled taxonomy. Your output is consumed by a search system, so you MUST pick from the listed values only.

## Taxonomy

### Categories (pick exactly one)
- "hardware" — companies whose primary product is physical (defense, aerospace, robotics, medical devices, semiconductors, energy generation/storage, automotive, industrial manufacturing, materials, maritime, consumer electronics, or biotech with physical instrumentation)
- "non_hardware" — companies whose primary product is software, services, or financial (SaaS, AI software, FinTech, investment banking, quant trading, blockchain, consumer tech, healthtech software, biotech with software/AI focus, professional services, legal)
- "unreviewed" — only if you cannot confidently place the company in either category

### Hardware industries (if category="hardware", pick exactly one)
${HARDWARE_INDUSTRIES.map(s => `- ${s}`).join('\n')}

### Non-hardware industries (if category="non_hardware", pick exactly one)
${NON_HARDWARE_INDUSTRIES.map(s => `- ${s}`).join('\n')}

### Hardware domain tags (if category="hardware", pick zero or more)
${HARDWARE_DOMAIN_TAGS.map(s => `- ${s}`).join('\n')}

### Non-hardware domain tags (if category="non_hardware", pick zero or more)
${NON_HARDWARE_DOMAIN_TAGS.map(s => `- ${s}`).join('\n')}

## Disambiguation guidance

- "Biotech" appears in BOTH branches. Hardware-Biotech = physical instruments / wet-lab equipment / medical devices for genomics. Non-hardware-Biotech = software/AI for drug discovery, computational biology, therapeutics platform companies.
- A defense company that describes itself as "software" (e.g. Shield AI, Anduril) is still HARDWARE if it builds physical drones / autonomous systems / weapons. The product is the physical thing.
- A research lab that doesn't ship a product → likely non_hardware/Services or unreviewed.
- If unsure between two industries within the same category, pick the more specific one.
- If unsure about category itself → pick "unreviewed".

## Output format

Return STRICT JSON. No markdown, no preamble, no explanation outside the JSON.

{
  "category": "hardware" | "non_hardware" | "unreviewed",
  "industry": <one of the listed industries for the chosen category, or null if unreviewed>,
  "domain_tags": [<zero or more tags valid for the chosen category>],
  "confidence": <0.0 to 1.0>,
  "reasoning": "<one sentence explaining the call>"
}

If you set category="unreviewed", set industry=null and domain_tags=[].
If you can't confidently classify, USE "unreviewed" — don't guess.`

export async function tagWithClaude(input: TaggerInput): Promise<TaggerOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  // Build the user message — only include populated signals
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
      max_tokens: 400,
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

  // Parse JSON — strip ```json fences if present
  const cleanText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  let parsed: any
  try {
    parsed = JSON.parse(cleanText)
  } catch (e) {
    return {
      category: 'unreviewed',
      industry: null,
      domain_tags: [],
      confidence: 0,
      reasoning: `Claude returned invalid JSON: ${cleanText.slice(0, 200)}`,
      method: 'claude_inference',
    }
  }

  // Validate against the controlled vocabulary
  const cat = parsed.category as Category
  if (cat !== 'hardware' && cat !== 'non_hardware' && cat !== 'unreviewed') {
    return failure(`invalid category: ${cat}`)
  }

  if (cat === 'unreviewed') {
    return {
      category: 'unreviewed',
      industry: null,
      domain_tags: [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '(unreviewed)',
      method: 'claude_inference',
    }
  }

  const ind = parsed.industry as Industry | null
  if (!isValidIndustry(cat, ind)) {
    return failure(`invalid industry "${ind}" for category="${cat}"`)
  }

  const tags = Array.isArray(parsed.domain_tags) ? parsed.domain_tags as DomainTag[] : []
  if (!isValidDomainTags(cat, tags)) {
    return failure(`invalid domain_tags ${JSON.stringify(tags)} for category="${cat}"`)
  }

  return {
    category: cat,
    industry: ind,
    domain_tags: tags,
    confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.7,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '(no reasoning)',
    method: 'claude_inference',
  }

  function failure(why: string): TaggerOutput {
    return {
      category: 'unreviewed',
      industry: null,
      domain_tags: [],
      confidence: 0,
      reasoning: `Claude validation failed: ${why}`,
      method: 'claude_inference',
    }
  }
}
