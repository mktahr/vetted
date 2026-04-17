// lib/ai/narrative.ts
//
// Generates a 2-4 sentence narrative summary of a candidate using Claude
// Haiku 4.5. The narrative is built ONLY from structured data we have in
// the database — no outside knowledge of companies, no inferences beyond
// what the rows say. The system prompt explicitly forbids speculation.
//
// Two functions:
//   buildNarrativeContext(supabase, personId) → strict JSON view of person
//   generateNarrative(context) → calls Claude, returns text

import { SupabaseClient } from '@supabase/supabase-js'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5'

// ─── Context shape passed to Claude ─────────────────────────────────────────
// All fields are optional/nullable so the model knows when data is missing.

export interface NarrativeContext {
  full_name: string
  years_experience: number | null
  career_stage: string | null
  career_progression: string | null            // company-tier movement: rising/flat/declining/insufficient_data
  title_level_slope: string | null             // title-level movement: rising/flat/declining/insufficient_data
  highest_seniority_reached: string | null     // executive/manager/lead/IC/student/unknown
  experiences: Array<{
    title: string | null
    company: string | null
    company_tier: number | null                // 1-5 from company_year_scores, only if known
    title_level: number | null                 // 1-10 extracted from title text
    seniority_normalized: string | null        // executive/manager/lead/individual_contributor/student/unknown
    start_date: string | null
    end_date: string | null
    is_current: boolean
    duration_months: number | null
  }>
  education: Array<{
    school: string | null
    degree: string | null
    field_of_study: string | null
    start_year: number | null
    end_year: number | null
  }>
  score: {
    bucket: string | null
    total_score: number | null
    core_score: number | null
    bonus_score: number | null
    penalty_score: number | null
  }
}

// ─── Build context from DB ──────────────────────────────────────────────────

export async function buildNarrativeContext(
  supabase: SupabaseClient,
  personId: string,
): Promise<NarrativeContext> {
  const { data: person, error: pErr } = await supabase
    .from('people')
    .select('full_name, years_experience_estimate, career_stage_assigned, career_progression, title_level_slope, highest_seniority_reached')
    .eq('person_id', personId)
    .single()
  if (pErr || !person) throw new Error(`Person ${personId} not found: ${pErr?.message ?? 'no row'}`)

  // Experiences — joined with company name, ordered most-recent first
  const { data: expRows } = await supabase
    .from('person_experiences')
    .select('title_raw, title_normalized, title_level, seniority_normalized, start_date, end_date, is_current, duration_months, company_id, companies:company_id ( company_name )')
    .eq('person_id', personId)
    .order('is_current', { ascending: false })
    .order('start_date', { ascending: false })

  // Pull company tier scores for the year of each experience (when available)
  const companyIds = Array.from(
    new Set((expRows || []).map(e => e.company_id).filter((x): x is string => !!x)),
  )
  let yearScores: Array<{ company_id: string; year: number; company_score: number }> = []
  if (companyIds.length > 0) {
    const { data: ys } = await supabase
      .from('company_year_scores')
      .select('company_id, year, company_score')
      .in('company_id', companyIds)
    yearScores = ys || []
  }
  // Average tier across the years the person worked there.
  const tierFor = (companyId: string | null, startISO: string | null, endISO: string | null, isCurrent: boolean): number | null => {
    if (!companyId || !startISO) return null
    const startYear = new Date(startISO).getFullYear()
    if (isNaN(startYear)) return null
    const endYear = isCurrent
      ? new Date().getFullYear()
      : (endISO ? new Date(endISO).getFullYear() : new Date().getFullYear())
    const matches = yearScores.filter(ys =>
      ys.company_id === companyId && ys.year >= startYear && ys.year <= endYear)
    if (matches.length === 0) return null
    return Math.round(matches.reduce((s, m) => s + m.company_score, 0) / matches.length)
  }

  // Supabase typings infer joined `companies`/`schools` as arrays even
  // when the FK is one-to-one; cast to access uniformly.
  const experiences: NarrativeContext['experiences'] = (expRows || []).map(raw => {
    const e = raw as unknown as {
      title_raw: string | null
      title_normalized: string | null
      title_level: number | null
      seniority_normalized: string | null
      start_date: string | null
      end_date: string | null
      is_current: boolean
      duration_months: number | null
      company_id: string | null
      companies?: { company_name?: string | null } | null
    }
    return {
      title: e.title_normalized || e.title_raw || null,
      company: e.companies?.company_name || null,
      company_tier: tierFor(e.company_id, e.start_date, e.end_date, e.is_current),
      title_level: e.title_level,
      seniority_normalized: e.seniority_normalized,
      start_date: e.start_date,
      end_date: e.end_date,
      is_current: e.is_current,
      duration_months: e.duration_months,
    }
  })

  // Education
  const { data: eduRows } = await supabase
    .from('person_education')
    .select('school_name_raw, degree_raw, degree_normalized, field_of_study_raw, field_of_study_normalized, start_year, end_year, schools:school_id ( school_name )')
    .eq('person_id', personId)
    .order('end_year', { ascending: false })

  const education: NarrativeContext['education'] = (eduRows || []).map(raw => {
    const e = raw as unknown as {
      school_name_raw: string | null
      degree_raw: string | null
      degree_normalized: string | null
      field_of_study_raw: string | null
      field_of_study_normalized: string | null
      start_year: number | null
      end_year: number | null
      schools?: { school_name?: string | null } | null
    }
    return {
      school: e.schools?.school_name || e.school_name_raw || null,
      degree: e.degree_normalized || e.degree_raw || null,
      field_of_study: e.field_of_study_normalized || e.field_of_study_raw || null,
      start_year: e.start_year,
      end_year: e.end_year,
    }
  })

  // Latest bucket assignment for score summary
  const { data: bucket } = await supabase
    .from('candidate_bucket_assignments')
    .select('candidate_bucket, score_breakdown')
    .eq('person_id', personId)
    .order('effective_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const breakdown = (bucket?.score_breakdown as {
    total_score?: number
    core_score?: number
    bonus_score?: number
    penalty_score?: number
    scoring_stage?: string
  } | null) ?? null

  // Prefer the canonical scoring_stage (from the scoring engine, cutoffs
  // 0.5/2/5) over career_stage_assigned (set at ingest with rougher 0/4/10
  // cutoffs — known to mislabel anyone with 5-9 yrs as "mid_career" when
  // they should be "senior_career").
  const careerStage = breakdown?.scoring_stage ?? person.career_stage_assigned

  return {
    full_name: person.full_name,
    years_experience: person.years_experience_estimate,
    career_stage: careerStage,
    title_level_slope: person.title_level_slope,
    career_progression: person.career_progression,
    highest_seniority_reached: person.highest_seniority_reached,
    experiences,
    education,
    score: {
      bucket: bucket?.candidate_bucket ?? null,
      total_score: breakdown?.total_score ?? null,
      core_score: breakdown?.core_score ?? null,
      bonus_score: breakdown?.bonus_score ?? null,
      penalty_score: breakdown?.penalty_score ?? null,
    },
  }
}

// ─── System prompt (strict, no-speculation) ─────────────────────────────────

const SYSTEM_PROMPT = `You write 2-4 sentence narrative summaries of recruiting candidates from structured data.

STRICT RULES:
1. Use ONLY the data provided in the user message. Do NOT use any outside knowledge about companies, schools, products, or industries.
2. Do NOT speculate about a person's skills, ambitions, motivations, or personality.
3. Do NOT invent details that aren't in the data (no inferred salaries, locations, technologies, etc.).
4. When referring to companies, describe their tier numerically when given (e.g. "tier 1 company", "tier 4 company"). Never describe a company by its actual reputation or industry beyond what the data provides.
5. If important data is missing (no experience, no education, no score), say so directly.
6. Keep it factual and concise. 2-4 sentences total. No marketing language. No superlatives.
7. End EXACTLY with this sentence on its own line: "Based on available structured data only."

CAREER STAGE vs SENIORITY (do NOT confuse):
- career_stage describes years of experience: pre_career (<0.5), early_career (0.5–2), mid_career (2–5), senior_career (5+). Use the exact value provided.
- seniority_normalized describes the role's title leveling: individual_contributor / lead / manager / executive / student / unknown. A senior_career engineer can still be an individual_contributor; the two are independent dimensions.

CAREER PROGRESSION (career_progression field):
- Measures movement in COMPANY TIER across roles, not title leveling. Use the verbatim value (rising/flat/declining/insufficient_data) if you mention it. Never paraphrase as "company progression" — call it "career progression" because that's what the field is named.

TITLE LEVEL + TITLE LEVEL SLOPE:
- Each experience may have a title_level (1-10 integer) extracted from the title text. Scale: 1=intern, 2=junior, 3=mid-IC, 4=IC-II, 5=senior, 6=staff/lead, 7=principal, 8=distinguished, 9=VP/director, 10=C-suite.
- title_level_slope (on the person) is the deterministic trajectory of title_level across recent full-time roles: rising/flat/declining/insufficient_data.
- When title_level_slope is "flat" and the person has many years of experience, that's a meaningful signal — say so clearly (e.g. "title leveling has remained flat across 7 years of experience"). When it's "rising", note the progression. When "insufficient_data", say title data doesn't carry enough leveling indicators.
- The title_level and title_level_slope are INDEPENDENT from career_progression (which measures company-tier movement). Both can be mentioned.

SENIORITY (seniority_normalized per experience):
- seniority_normalized is a coarser band (IC/lead/manager/executive) — useful for noting whether someone crossed from IC to management. Use it to complement title_level, not replace it. Don't mention seniority_normalized if title_level already tells the story.

Output the summary as plain prose. No headings, no bullet points, no JSON.`

// ─── Call Claude ────────────────────────────────────────────────────────────

export async function generateNarrative(context: NarrativeContext): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const userMessage = `Candidate data:\n\n${JSON.stringify(context, null, 2)}`

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
    throw new Error(`Anthropic API HTTP ${resp.status}: ${text.slice(0, 500)}`)
  }

  const data = await resp.json() as {
    content?: Array<{ type: string; text?: string }>
  }
  const text = data.content
    ?.filter(c => c.type === 'text')
    .map(c => c.text || '')
    .join('')
    .trim()

  if (!text) throw new Error('Anthropic returned empty content')
  return text
}
