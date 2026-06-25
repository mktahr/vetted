// lib/network/llm-triage.ts
//
// Tier 2 of the tiered classifier: cheap Claude-Haiku triage of the MAYBE pile
// ONLY. Uses title + COMPANY context to pre-sort ambiguous connections into
// probably_yes / probably_no / unclear so the admin's review queue is ranked.
// The admin still makes the final Keep/Drop call — this is a suggestion.
//
// Direct fetch to Anthropic (no SDK), mirroring lib/companies/tagger/claude.ts
// and lib/ai/narrative.ts. Batched: many connections per call.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';
const BATCH_SIZE = 40;

export interface TriageInput {
  connection_id: string;
  title: string | null;
  company: string | null;
}

export type TriageGuess = 'probably_yes' | 'probably_no' | 'unclear';

export interface TriageResult {
  connection_id: string;
  guess: TriageGuess;
  reason: string;
}

const SYSTEM_PROMPT = `You triage ambiguous LinkedIn job titles for a hard-tech engineering recruiting tool.

For each person you get a TITLE and their CURRENT COMPANY. Decide whether this person is most likely a hands-on ENGINEER — software, hardware, firmware, mechanical, electrical, robotics, ML, systems, etc. — OR an engineering leader (eng manager / director of eng / VP eng / CTO). Recruiters, PMs, designers, sales, marketing, HR, finance, and operations are NOT engineers.

Use the COMPANY as strong context. Obfuscated or cute titles ("wizard", "ninja", "magician", "member of technical staff", "hacker", even "banker") at a known engineering-heavy company (defense, aerospace, robotics, chips, AI labs, deep tech) are very likely engineers. The same cute title at a bank or agency is likely not.

Return one of:
- "probably_yes" — likely an engineer / eng leader
- "probably_no" — likely NOT an engineer
- "unclear" — genuinely cannot tell from title + company

Output STRICT JSON, no markdown fences, an array with one object per input in the SAME ORDER:
[{"i": <index>, "guess": "probably_yes"|"probably_no"|"unclear", "reason": "<≤12 words>"}]`;

async function triageOneBatch(items: TriageInput[], offset: number): Promise<TriageResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const userMessage = items
    .map((it, idx) => `${idx}. title="${it.title ?? '(blank)'}" company="${it.company ?? '(unknown)'}"`)
    .join('\n');

  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Anthropic HTTP ${resp.status}: ${text.slice(0, 300)}`);
  }

  const data = (await resp.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.filter((c) => c.type === 'text').map((c) => c.text || '').join('').trim() ?? '';
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed: Array<{ i: number; guess: string; reason?: string }>;
  try {
    parsed = JSON.parse(clean);
  } catch {
    // On unparseable output, mark the whole batch unclear rather than failing.
    return items.map((it) => ({ connection_id: it.connection_id, guess: 'unclear' as const, reason: 'triage parse error' }));
  }

  const byIndex = new Map<number, { guess: string; reason?: string }>();
  for (const p of parsed) if (typeof p.i === 'number') byIndex.set(p.i, p);

  return items.map((it, idx) => {
    const p = byIndex.get(idx);
    const g = p?.guess;
    const guess: TriageGuess = g === 'probably_yes' || g === 'probably_no' ? g : 'unclear';
    return { connection_id: it.connection_id, guess, reason: (p?.reason ?? '').slice(0, 200) };
  });
}

/** Triage a list of MAYBE connections in batches. Order preserved. */
export async function triageMaybeConnections(items: TriageInput[]): Promise<TriageResult[]> {
  const out: TriageResult[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    out.push(...(await triageOneBatch(batch, i)));
  }
  return out;
}
