// scripts/compute-derived-fields.mjs
// Computes Phase 2 derived signals for every person and writes them back:
//   - career_progression (upward / lateral / unclear)
//   - highest_seniority_reached (max rank across all experiences)
//   - has_early_stage_experience + early_stage_companies_count
//   - has_hypergrowth_experience + hypergrowth_companies_count

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=');
    return [k.trim(), v.join('=').trim()];
  })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ─── Pre-fetch reference data ────────────────────────────────────────────

const { data: yearScoresAll } = await supabase
  .from('company_year_scores')
  .select('company_id, year, company_score');

const { data: companies } = await supabase
  .from('companies')
  .select('company_id, company_name, founding_year');

const { data: seniorityDict } = await supabase
  .from('seniority_dictionary')
  .select('seniority_normalized, rank_order');

const { data: metrics } = await supabase
  .from('company_metrics_by_year')
  .select('company_id, year, headcount_estimate');

const companyById = Object.fromEntries(companies.map(c => [c.company_id, c]));
const seniorityRank = Object.fromEntries(seniorityDict.map(s => [s.seniority_normalized, s.rank_order]));
const rankToSeniority = Object.fromEntries(seniorityDict.map(s => [s.rank_order, s.seniority_normalized]));

// Build hypergrowth-year set: Map<company_id, Set<year>>
const hypergrowthYears = {};
for (const m of metrics || []) {
  if (!m.headcount_estimate) continue;
  const prior = metrics.find(p => p.company_id === m.company_id && p.year === m.year - 1);
  if (prior?.headcount_estimate && m.headcount_estimate >= 2 * prior.headcount_estimate) {
    if (!hypergrowthYears[m.company_id]) hypergrowthYears[m.company_id] = new Set();
    hypergrowthYears[m.company_id].add(m.year);
  }
}

// Helper: compute per-experience avg company score across years worked
function expCompanyScore(exp) {
  if (!exp.company_id || !exp.start_date) return null;
  const startYear = new Date(exp.start_date).getFullYear();
  const endYear = exp.is_current
    ? new Date().getFullYear()
    : (exp.end_date ? new Date(exp.end_date).getFullYear() : new Date().getFullYear());
  const matches = yearScoresAll.filter(ys =>
    ys.company_id === exp.company_id && ys.year >= startYear && ys.year <= endYear);
  if (matches.length === 0) return null;
  return matches.reduce((s, ys) => s + ys.company_score, 0) / matches.length;
}

// ─── Fetch all people + experiences ──────────────────────────────────────

const { data: people } = await supabase
  .from('people')
  .select('person_id, full_name');

console.log(`\nProcessing ${people.length} people...\n`);

let processed = 0;
for (const person of people) {
  const { data: expRaw } = await supabase
    .from('person_experiences')
    .select('person_experience_id, company_id, title_raw, seniority_normalized, employment_type_normalized, start_date, end_date, is_current, duration_months')
    .eq('person_id', person.person_id)
    .order('start_date', { ascending: true, nullsFirst: false });

  const experiences = expRaw || [];
  const fullTimeExps = experiences.filter(e =>
    e.employment_type_normalized === 'full_time' ||
    (e.employment_type_normalized !== 'internship' && !/\bintern\b|\binternship\b|\bco-?op\b/i.test(e.title_raw || ''))
  );

  // ── career_progression ──
  // Compare first scored FT experience to most-recent scored FT experience
  const scoredFT = fullTimeExps
    .map(e => ({ e, score: expCompanyScore(e) }))
    .filter(x => x.score !== null);

  let careerProgression = null;
  if (scoredFT.length >= 2) {
    const first = scoredFT[0].score;
    const last = scoredFT[scoredFT.length - 1].score;
    if (last > first) careerProgression = 'upward';
    else if (last === first) careerProgression = 'lateral';
    else careerProgression = 'unclear';
  } else if (scoredFT.length === 1) {
    careerProgression = 'lateral';
  }
  // else null — insufficient data

  // ── highest_seniority_reached ──
  let maxRank = 0;
  let highestSeniority = null;
  for (const e of experiences) {
    const rank = seniorityRank[e.seniority_normalized];
    if (rank && rank > maxRank) {
      maxRank = rank;
      highestSeniority = e.seniority_normalized;
    }
  }

  // ── early_stage experience ──
  const earlyStageCompanyIds = new Set();
  for (const e of experiences) {
    const company = companyById[e.company_id];
    if (!company?.founding_year || !e.start_date) continue;
    const startYear = new Date(e.start_date).getFullYear();
    if (startYear - company.founding_year <= 4) {
      earlyStageCompanyIds.add(e.company_id);
    }
  }

  // ── hypergrowth experience ──
  const hyperCompanyIds = new Set();
  for (const e of experiences) {
    if (!e.company_id || !e.start_date) continue;
    const years = hypergrowthYears[e.company_id];
    if (!years) continue;
    const startYear = new Date(e.start_date).getFullYear();
    const endYear = e.is_current
      ? new Date().getFullYear()
      : (e.end_date ? new Date(e.end_date).getFullYear() : startYear);
    for (let y = startYear; y <= endYear; y++) {
      if (years.has(y)) {
        hyperCompanyIds.add(e.company_id);
        break;
      }
    }
  }

  // ── Write back ──
  const update = {
    career_progression: careerProgression,
    highest_seniority_reached: highestSeniority,
    has_early_stage_experience: earlyStageCompanyIds.size > 0,
    early_stage_companies_count: earlyStageCompanyIds.size,
    has_hypergrowth_experience: hyperCompanyIds.size > 0,
    hypergrowth_companies_count: hyperCompanyIds.size,
  };

  const { error } = await supabase
    .from('people')
    .update(update)
    .eq('person_id', person.person_id);

  if (error) {
    console.error(`  FAILED "${person.full_name}":`, error.message);
    continue;
  }

  console.log(`  ${person.full_name.padEnd(26)} | progression=${(careerProgression || '—').padEnd(8)} | top_seniority=${(highestSeniority || '—').padEnd(22)} | early_stage=${update.early_stage_companies_count} | hypergrowth=${update.hypergrowth_companies_count}`);
  processed++;
}

console.log(`\n=== Done ===`);
console.log(`People processed: ${processed}`);
