// lib/companies/tagger/index.ts
//
// Round-2 orchestrator. Claude is PRIMARY (always runs); dictionary runs in
// parallel as a sanity check.
//
// Logic:
//   1. Always run Claude (with whatever signals are available — Concern 3 says
//      run on every tier, even unreviewed-tier identify-only signals).
//   2. Always run dictionary in parallel.
//   3. If Claude returned category=null → write Claude's null verdict, method='claude'.
//   4. If dict returned category=null → write Claude's verdict, method='claude'.
//   5. If both returned non-null and agree on (category, primary_industry) →
//      method='claude_dict_agree', confidence boost.
//   6. If they disagree → method='claude_dict_disagree', write Claude's verdict
//      (Concern B: Claude wins), capture dict's verdict in tagging_notes,
//      lower confidence so triage queue surfaces it.

import { tagDeterministically } from './dictionary'
import { tagWithClaude } from './claude'
import type { TaggerInput, TaggerOutput, CompositeTaggerOutput } from './types'

const CONFIDENCE_BOOST_ON_AGREE = 0.05
const CONFIDENCE_PENALTY_ON_DISAGREE = 0.30

export async function tagCompany(input: TaggerInput): Promise<CompositeTaggerOutput> {
  // Run Claude and dict in parallel — independent
  const [claudeResult, dictResult] = await Promise.all([
    tagWithClaude(input),
    Promise.resolve(tagDeterministically(input)),
  ])

  const verdict = (r: TaggerOutput) => ({
    category: r.category,
    primary_industry: r.primary_industry,
  })

  // Case: Claude couldn't classify
  if (claudeResult.category === null) {
    return composite(claudeResult, dictResult, 'claude_only',
      `Claude returned null category: ${claudeResult.reasoning}`)
  }

  // Case: Dict couldn't classify → no comparison possible
  if (dictResult.category === null) {
    return composite(claudeResult, dictResult, 'claude_only',
      `Dict couldn't classify; Claude verdict used. Dict reason: ${dictResult.reasoning}`)
  }

  // Both have verdicts. Compare on (category, primary_industry).
  const agree =
    claudeResult.category === dictResult.category &&
    claudeResult.primary_industry === dictResult.primary_industry

  if (agree) {
    return composite(
      {
        ...claudeResult,
        confidence: Math.min(1.0, claudeResult.confidence + CONFIDENCE_BOOST_ON_AGREE),
      },
      dictResult,
      'agree',
      `Claude + dict agreed on (${claudeResult.category}/${claudeResult.primary_industry}).`,
    )
  }

  // Disagree. Write Claude's verdict; flag for admin triage via lowered confidence.
  return composite(
    {
      ...claudeResult,
      confidence: Math.max(0, claudeResult.confidence - CONFIDENCE_PENALTY_ON_DISAGREE),
    },
    dictResult,
    'disagree',
    `DISAGREEMENT — Claude: ${claudeResult.category}/${claudeResult.primary_industry}; Dict: ${dictResult.category}/${dictResult.primary_industry}. Wrote Claude's verdict; flagged for triage.`,
  )

  function composite(
    written: TaggerOutput,
    dict: TaggerOutput,
    agreement: CompositeTaggerOutput['agreement'],
    summary: string,
  ): CompositeTaggerOutput {
    let method: CompositeTaggerOutput['method']
    if (agreement === 'agree') method = 'claude_dict_agree'
    else if (agreement === 'disagree') method = 'claude_dict_disagree'
    else method = 'claude'

    return {
      category: written.category,
      primary_industry: written.primary_industry,
      industries: written.industries,
      domain_tags: written.domain_tags,
      confidence: written.confidence,
      reasoning: `${summary} | Claude: ${written.reasoning} | Dict: ${dict.reasoning}`,
      method,
      agreement,
      dict_verdict: verdict(dict),
      claude_verdict: verdict(claudeResult),
    }
  }
}

// Re-exports
export { tagDeterministically } from './dictionary'
export { tagWithClaude } from './claude'
export type { TaggerInput, TaggerOutput, CompositeTaggerOutput } from './types'
