// lib/companies/tagger/index.ts
//
// Two-tier tagger orchestrator. Try the deterministic dictionary first; if
// it returns category='unreviewed' (signals ambiguous), escalate to Claude.
//
// Confidence threshold for keeping the dictionary verdict: 0.7.
// Below that, Claude takes over even if dictionary returned a non-unreviewed value.

import { tagDeterministically } from './dictionary'
import { tagWithClaude } from './claude'
import type { TaggerInput, TaggerOutput } from './types'

const ESCALATE_BELOW_CONFIDENCE = 0.7

export async function tagCompany(input: TaggerInput): Promise<TaggerOutput> {
  const dictResult = tagDeterministically(input)
  if (dictResult.category !== 'unreviewed' && dictResult.confidence >= ESCALATE_BELOW_CONFIDENCE) {
    return dictResult
  }
  // Escalate to Claude
  const claudeResult = await tagWithClaude(input)
  // Wrap reasoning to indicate the path
  return {
    ...claudeResult,
    reasoning: `[Dict→Claude] dict: ${dictResult.reasoning} | claude: ${claudeResult.reasoning}`,
  }
}

// Re-exports for callers
export { tagDeterministically } from './dictionary'
export { tagWithClaude } from './claude'
export type { TaggerInput, TaggerOutput } from './types'
