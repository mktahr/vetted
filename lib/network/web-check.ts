// lib/network/web-check.ts
//
// On-demand, per-row "deep-check this person" for the MAYBE review queue. Uses
// Claude's server-side web search tool (verified enabled on this API key) to
// search "[name] [company]" and judge whether the person is an engineer.
//
// EXPLICIT, single-person, on-demand ONLY — never a batch pass over the queue
// (cost + privacy). The admin still makes the final Keep/Drop call; this returns
// a verdict + summary + the sources the model consulted.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';

export type WebCheckVerdict = 'likely_engineer' | 'likely_not' | 'unclear';

export interface WebCheckResult {
  verdict: WebCheckVerdict;
  summary: string;
  sources: Array<{ title: string; url: string }>;
}

export async function webCheckPerson(input: {
  name: string;
  company: string | null;
  linkedinUrl: string | null;
}): Promise<WebCheckResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const who = [input.name, input.company ? `at ${input.company}` : ''].filter(Boolean).join(' ');
  const prompt = `Search the web to determine whether ${who} is a hands-on engineer (software/hardware/firmware/mechanical/electrical/robotics/ML/systems) or an engineering leader, versus a non-engineering role (recruiter, PM, designer, sales, marketing, HR, finance, ops).${input.linkedinUrl ? ` Their LinkedIn: ${input.linkedinUrl}.` : ''}

After searching, end your reply with EXACTLY one line of strict JSON (no fences):
{"verdict":"likely_engineer"|"likely_not"|"unclear","summary":"<one sentence>"}`;

  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Anthropic web-check HTTP ${resp.status}: ${text.slice(0, 300)}`);
  }

  const data = (await resp.json()) as {
    content?: Array<{
      type: string;
      text?: string;
      content?: Array<{ type: string; title?: string; url?: string }>;
    }>;
  };

  // Collect cited sources from web_search_tool_result blocks.
  const sources: Array<{ title: string; url: string }> = [];
  for (const block of data.content ?? []) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) {
        if (r.type === 'web_search_result' && r.url) {
          sources.push({ title: r.title ?? r.url, url: r.url });
        }
      }
    }
  }

  // The final text block carries the JSON verdict line.
  const text = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text || '').join('\n').trim();
  let verdict: WebCheckVerdict = 'unclear';
  let summary = text.slice(0, 400);
  const m = text.match(/\{[^{}]*"verdict"[^{}]*\}/);
  if (m) {
    try {
      const parsed = JSON.parse(m[0]) as { verdict?: string; summary?: string };
      if (parsed.verdict === 'likely_engineer' || parsed.verdict === 'likely_not' || parsed.verdict === 'unclear') {
        verdict = parsed.verdict;
      }
      if (parsed.summary) summary = parsed.summary;
    } catch {
      /* keep defaults */
    }
  }

  return { verdict, summary, sources: sources.slice(0, 5) };
}
