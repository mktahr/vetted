// lib/candidates/classifier/claude.ts
//
// Haiku 4.5 call for five-axis classification. Direct fetch to Anthropic (no SDK),
// matching lib/ai/narrative.ts + lib/companies/tagger/claude.ts. temperature=0 for
// reproducibility. Returns parsed output + token usage; never throws (errors are
// returned so the lifecycle can discard without burning the retry budget).

import { CLASSIFIER_MODEL } from './config';
import type { ClaudeCallResult, ClassifierRawOutput } from './types';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

/** Pull the first balanced JSON object out of the model text. */
function extractJson(text: string): ClassifierRawOutput | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(text.slice(start, i + 1));
          if (parsed && Array.isArray(parsed.assignments)) return parsed as ClassifierRawOutput;
          return null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export async function callClassifier(
  systemPrompt: string,
  userPrompt: string,
): Promise<ClaudeCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { output: null, rawText: '', inputTokens: 0, outputTokens: 0, error: 'ANTHROPIC_API_KEY not set' };
  }

  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLASSIFIER_MODEL,
        max_tokens: 4096,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return { output: null, rawText: '', inputTokens: 0, outputTokens: 0, error: `anthropic ${resp.status}: ${body.slice(0, 300)}` };
    }

    const data = await resp.json();
    const rawText: string = data?.content?.[0]?.text ?? '';
    const inputTokens: number = data?.usage?.input_tokens ?? 0;
    const outputTokens: number = data?.usage?.output_tokens ?? 0;
    return { output: extractJson(rawText), rawText, inputTokens, outputTokens };
  } catch (e: any) {
    return { output: null, rawText: '', inputTokens: 0, outputTokens: 0, error: e?.message ?? 'fetch failed' };
  }
}
