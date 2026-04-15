// scripts/score-test-profiles.mjs
// Runs the Phase 2 (v2) scoring engine against the three seed profiles.
// Mirrors lib/scoring/score-candidate.ts logic (JS duplicate — Node can't
// run .ts directly without a build step).

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

// ─── Weights (must mirror lib/scoring/score-candidate.ts) ────────────────

const STAGE_WEIGHTS = {
  pre_career: {
    core:  { education: 30, degree_relevance: 30, internships: 40 },
    bonus: { hackathons: 10, clubs: 10, labs: 10, publications: 10, open_source: 10, fellowships: 25 },
  },
  early_career: {
    core:  { company_quality_recent: 40, education: 25, degree_relevance: 25, internships: 10 },
    bonus: { company_function_quality: 10, hackathons: 10, publications: 10, open_source: 10, labs: 5, fellowships: 25, biz_unit: 25 },
  },
  mid_career: {
    core:  { company_quality_recent: 60, company_quality_average: 10, education: 15, degree_relevance: 15 },
    bonus: { career_slope: 15, fellowships: 10, company_function_quality: 10, publications: 10, open_source: 5, biz_unit: 25 },
    penalty: { name: 'short_tenure', maxPoints: 20, thresholdMonths: 12 },
  },
  senior_career: {
    core:  { company_quality_recent: 60, company_quality_average: 30, education: 5, degree_relevance: 5 },
    bonus: { career_slope: 10, company_function_quality: 10, publications: 10, open_source: 5, biz_unit: 25 },
    penalty: { name: 'short_tenure', maxPoints: 30, thresholdMonths: 18 },
  },
};

const RECRUITING_OVERRIDE = {
  core:  { company_quality_recent: 70, education: 5, degree_relevance: 5 },
  bonus: { career_slope: 20 },
};

function determineStage(years) {
  if (years === null || years === undefined || years < 0.5) return 'pre_career';
  if (years < 2) return 'early_career';
  if (years < 5) return 'mid_career';
  return 'senior_career';
}

function assignBucket(stage, total) {
  if (stage === 'pre_career') {
    if (total >= 60) return 'vetted_talent';
    if (total >= 45) return 'high_potential';
    return 'non_vetted';
  }
  if (stage === 'early_career') {
    if (total >= 65) return 'vetted_talent';
    if (total >= 50) return 'high_potential';
    return 'non_vetted';
  }
  if (stage === 'mid_career') {
    if (total >= 65) return 'vetted_talent';
    if (total >= 50) return 'silver_medalist';
    return 'non_vetted';
  }
  if (total >= 70) return 'vetted_talent';
  if (total >= 55) return 'silver_medalist';
  return 'non_vetted';
}

function normalizeSchool(raw) {
  return raw.trim().replace(/[.,]+$/, '').replace(/\s+/g, ' ').toLowerCase();
}

function isInternship(exp) {
  const t = (exp.title_raw || '').toLowerCase();
  const e = (exp.employment_type_normalized || '').toLowerCase();
  return e === 'internship' || /\bintern\b|\binternship\b|\bco-?op\b/.test(t);
}

function expCompanyScore(exp, yearScores) {
  if (!exp.company_id || !exp.start_date) return null;
  const startYear = new Date(exp.start_date).getFullYear();
  const endYear = exp.is_current
    ? new Date().getFullYear()
    : (exp.end_date ? new Date(exp.end_date).getFullYear() : new Date().getFullYear());
  const matches = yearScores.filter(ys =>
    ys.company_id === exp.company_id && ys.year >= startYear && ys.year <= endYear);
  if (matches.length === 0) return null;
  return matches.reduce((s, ys) => s + ys.company_score, 0) / matches.length;
}

function degreeRelevance(fn, combined) {
  fn = (fn || 'engineering').toLowerCase();
  const s = combined.toLowerCase();
  const hasMBA = /\bmba\b|master of business administration/.test(s);
  const hasCS = /computer science|\bcs\b|eecs|computer engineering|software engineering/.test(s);
  const hasEE = /electrical engineering|computer engineering|eecs|electrical & computer/.test(s);
  const hasME = /mechanical engineering/.test(s);
  const hasRobotics = /robotics/.test(s);
  const hasAero = /aerospace/.test(s);
  const hasMaterials = /materials science/.test(s);
  const hasPhysics = /physics/.test(s);
  const hasMath = /(applied )?mathematics?|\bmath\b/.test(s);
  const hasStats = /statistics/.test(s);
  const hasInfoSys = /information systems/.test(s);
  const hasCogSci = /cognitive science/.test(s);
  const hasPsych = /psychology/.test(s);
  const hasEcon = /economics/.test(s);
  const hasBusiness = /business|management/.test(s);
  const hasFinance = /finance/.test(s);
  const hasMarketing = /marketing/.test(s);
  const hasComm = /communications?/.test(s);
  const hasOpsResearch = /operations research/.test(s);
  const hasIndustrialEng = /industrial engineering/.test(s);
  const hasSystemsEng = /systems engineering/.test(s);
  const hasHCI = /hci|human.computer interaction/.test(s);
  const hasDesign = /product design|industrial design|interaction design|graphic design|ux design|fine arts|architecture/.test(s);
  const hasEngineering = /engineering/.test(s);
  const hasSTEM = hasCS || hasEngineering || hasPhysics || hasMath || hasStats ||
    /chemistry|biology|biochem|neuroscience|biomedical|genetics/.test(s);

  if (fn === 'engineering' || fn === 'software engineering') {
    if (hasCS) return 1.0;
    if (/electrical engineering/.test(s) || hasMath || hasStats || hasPhysics) return 0.75;
    if (hasME || hasInfoSys || hasCogSci) return 0.5;
    if (hasSTEM) return 0.25;
    return 0;
  }
  if (fn === 'hardware' || fn === 'electrical engineering') {
    if (hasEE) return 1.0;
    if (hasME || hasPhysics || hasMaterials || hasAero) return 0.75;
    if (hasCS || /applied mathematics/.test(s)) return 0.5;
    if (hasSTEM) return 0.25;
    return 0;
  }
  if (fn === 'mechanical' || fn === 'robotics') {
    if (hasME || hasRobotics || hasAero || hasSystemsEng) return 1.0;
    if (/electrical engineering/.test(s) || hasPhysics || hasMaterials) return 0.75;
    if (hasCS || /applied mathematics/.test(s)) return 0.5;
    if (hasSTEM) return 0.25;
    return 0;
  }
  if (fn === 'product') {
    if (hasMBA) return 1.0;
    if (hasCS || hasEngineering || hasEcon || hasHCI) return 1.0;
    if (hasBusiness || hasMath || hasCogSci || hasPsych) return 0.75;
    if (hasSTEM) return 0.5;
    return 0.1;
  }
  if (fn === 'design') {
    if (hasDesign || hasHCI) return 1.0;
    if (hasCogSci || hasPsych || hasCS || hasEngineering) return 0.75;
    return 0.25;
  }
  if (fn === 'operations') {
    if (hasBusiness || hasEcon || hasMBA || hasOpsResearch || hasIndustrialEng ||
        hasFinance || hasMath || hasStats || hasCS) return 1.0;
    if (hasSTEM) return 0.5;
    return 0.25;
  }
  if (fn === 'sales' || fn === 'marketing') {
    if (hasBusiness || hasEcon || hasMarketing || hasComm || hasCS || hasEngineering) return 1.0;
    return 0.25;
  }
  if (fn === 'recruiting') return 1.0;

  if (hasCS) return 1.0;
  if (/electrical engineering/.test(s) || hasMath || hasStats || hasPhysics) return 0.75;
  if (hasSTEM) return 0.25;
  return 0;
}

// ─── Main scoring function ────────────────────────────────────────────────

async function scoreCandidate(personId) {
  const { data: person } = await supabase
    .from('people')
    .select('person_id, full_name, years_experience_estimate, current_function_normalized, career_progression, highest_seniority_reached, has_early_stage_experience, early_stage_companies_count, has_hypergrowth_experience, hypergrowth_companies_count')
    .eq('person_id', personId)
    .single();
  if (!person) throw new Error(`Person ${personId} not found`);

  const years = person.years_experience_estimate;
  const stage = determineStage(years);
  const fn = person.current_function_normalized;

  const { data: experiences } = await supabase
    .from('person_experiences')
    .select('person_experience_id, company_id, title_raw, employment_type_normalized, start_date, end_date, is_current, duration_months')
    .eq('person_id', personId)
    .order('start_date', { ascending: false });

  const { data: education } = await supabase
    .from('person_education')
    .select('school_name_raw, degree_raw, field_of_study_raw')
    .eq('person_id', personId);

  const companyIds = [...new Set((experiences || []).map(e => e.company_id).filter(Boolean))];
  let yearScores = [];
  let companyNames = {};
  if (companyIds.length > 0) {
    const { data } = await supabase
      .from('company_year_scores')
      .select('company_id, year, company_score')
      .in('company_id', companyIds);
    yearScores = data || [];
    const { data: cd } = await supabase.from('companies').select('company_id, company_name').in('company_id', companyIds);
    for (const c of cd || []) companyNames[c.company_id] = c.company_name;
  }

  const { data: schools } = await supabase
    .from('schools')
    .select('school_id, school_name, school_score')
    .not('school_score', 'is', null);
  const { data: aliases } = await supabase.from('school_aliases').select('alias_name, school_id');

  const schoolById = new Map((schools || []).map(s => [s.school_id, s]));
  const schoolByNorm = new Map();
  for (const s of schools || []) {
    schoolByNorm.set(normalizeSchool(s.school_name), s.school_score);
  }
  for (const a of aliases || []) {
    const s = schoolById.get(a.school_id);
    if (s) schoolByNorm.set(normalizeSchool(a.alias_name), s.school_score);
  }

  const applyRecruiting = fn === 'recruiting';
  const weights = applyRecruiting ? RECRUITING_OVERRIDE : STAGE_WEIGHTS[stage];
  const components = [];

  const push = (name, category, weight, raw, points, note) => {
    components.push({ name, category, weight, raw, points, note });
  };

  // Core components
  if ('company_quality_recent' in weights.core) {
    const ft = (experiences || []).filter(e => !isInternship(e));
    const mostRecent = ft[0];
    let recent = 0, note = 'No full-time experience';
    if (mostRecent) {
      const s = expCompanyScore(mostRecent, yearScores);
      recent = s !== null ? s : 0;
      note = s === null ? 'Current company not scored' : `avg ${s.toFixed(2)}`;
    }
    push('company_quality_recent', 'core', weights.core.company_quality_recent,
      recent / 5, (recent / 5) * weights.core.company_quality_recent, note);
  }

  if ('company_quality_average' in weights.core) {
    const ft = (experiences || []).filter(e => !isInternship(e));
    const scored = ft.map(e => expCompanyScore(e, yearScores));
    const avg = scored.length > 0 ? scored.reduce((s, v) => s + (v ?? 0), 0) / scored.length : 0;
    push('company_quality_average', 'core', weights.core.company_quality_average,
      avg / 5, (avg / 5) * weights.core.company_quality_average,
      `avg ${avg.toFixed(2)} across ${ft.length} FT role(s)`);
  }

  if ('education' in weights.core) {
    let max = 0; const notes = [];
    for (const e of education || []) {
      const raw = (e.school_name_raw || '').trim();
      if (!raw) continue;
      const hit = schoolByNorm.get(normalizeSchool(raw));
      if (hit !== undefined) { if (hit > max) max = hit; notes.push(`${raw}→${hit}`); }
      else notes.push(`${raw}→no match`);
    }
    push('education', 'core', weights.core.education,
      max / 4, (max / 4) * weights.core.education, notes.join('; ') || 'none');
  }

  if ('degree_relevance' in weights.core) {
    let max = 0; const notes = [];
    for (const e of education || []) {
      const c = ((e.field_of_study_raw || '') + ' ' + (e.degree_raw || '')).trim();
      if (!c) continue;
      const r = degreeRelevance(fn, c);
      if (r > max) max = r;
      notes.push(`${c.slice(0, 40)}→${(r * 100).toFixed(0)}%`);
    }
    push('degree_relevance', 'core', weights.core.degree_relevance,
      max, max * weights.core.degree_relevance, notes.join('; ') || 'none');
  }

  if ('internships' in weights.core) {
    const interns = (experiences || []).filter(isInternship);
    const scores = interns.map(e => expCompanyScore(e, yearScores));
    const avg = scores.length > 0 ? scores.reduce((s, v) => s + (v ?? 0), 0) / scores.length : 0;
    push('internships', 'core', weights.core.internships,
      avg / 5, (avg / 5) * weights.core.internships,
      `${interns.length} intern(s), avg score ${avg.toFixed(2)}`);
  }

  // Bonus components
  if (weights.bonus?.career_slope !== undefined) {
    const up = person.career_progression === 'rising';
    push('career_slope', 'bonus', weights.bonus.career_slope,
      up ? 1 : 0, up ? weights.bonus.career_slope : 0,
      `progression=${person.career_progression ?? 'none'}`);
  }

  const unsourced = ['hackathons', 'clubs', 'labs', 'publications', 'open_source',
                     'fellowships', 'biz_unit', 'company_function_quality'];
  for (const name of unsourced) {
    if (weights.bonus?.[name] !== undefined) {
      push(name, 'bonus', weights.bonus[name], null, 0, 'no data source');
    }
  }

  // Penalty
  if (weights.penalty) {
    const ft = (experiences || []).filter(e => !isInternship(e) && e.duration_months);
    const avg = ft.length > 0 ? ft.reduce((s, e) => s + (e.duration_months || 0), 0) / ft.length : 0;
    const { maxPoints, thresholdMonths } = weights.penalty;
    const pen = avg >= thresholdMonths ? 0 : maxPoints * (1 - avg / thresholdMonths);
    push(weights.penalty.name, 'penalty', maxPoints,
      avg >= thresholdMonths ? 0 : (1 - avg / thresholdMonths), -pen,
      `avg tenure ${avg.toFixed(1)}mo (threshold ${thresholdMonths}mo)`);
  }

  const core = components.filter(c => c.category === 'core').reduce((s, c) => s + c.points, 0);
  const bonus = components.filter(c => c.category === 'bonus').reduce((s, c) => s + c.points, 0);
  const penalty = components.filter(c => c.category === 'penalty').reduce((s, c) => s + c.points, 0);
  const total = core + bonus + penalty;
  const bucket = assignBucket(stage, total);

  // Build diagnostic
  const expDiag = (experiences || []).map(e => {
    const cname = e.company_id ? (companyNames[e.company_id] || '?') : '—';
    const s = expCompanyScore(e, yearScores);
    const dates = `${e.start_date || '?'}→${e.is_current ? 'present' : (e.end_date || '?')}`;
    return `    ${e.title_raw} @ ${cname} (${dates}) — score: ${s !== null ? s.toFixed(2) : 'N/A'}`;
  });

  return {
    person, stage, fn, years, applyRecruiting,
    experiences: expDiag,
    components, core, bonus, penalty, total,
    bucket, reasoning: `${stage} core=${core.toFixed(1)} bonus=${bonus.toFixed(1)} penalty=${penalty.toFixed(1)} total=${total.toFixed(2)}`,
  };
}

async function writeBucket(r) {
  const { error } = await supabase
    .from('candidate_bucket_assignments')
    .insert({
      person_id: r.person.person_id,
      candidate_bucket: r.bucket,
      assigned_by: 'system',
      assignment_reason: r.reasoning,
    });
  if (error) throw new Error(`Write bucket failed: ${error.message}`);
}

// ─── Run against three test profiles ─────────────────────────────────────

const TEST_NAMES = ['Priya Nair', 'Marcus Webb', 'Jennifer Tran'];

console.log('\n' + '═'.repeat(90));
console.log('  Vetted Phase 2 Scorer v2 — Test Run');
console.log('═'.repeat(90));

for (const name of TEST_NAMES) {
  const { data: person } = await supabase.from('people').select('person_id').eq('full_name', name).single();
  if (!person) { console.log(`\n  SKIP: ${name} not found`); continue; }

  const r = await scoreCandidate(person.person_id);

  console.log('\n' + '─'.repeat(90));
  console.log(`  ${r.person.full_name}`);
  console.log('─'.repeat(90));
  console.log(`  Years experience:          ${r.years}`);
  console.log(`  Scoring stage:             ${r.stage}${r.applyRecruiting ? ' [RECRUITING OVERRIDE]' : ''}`);
  console.log(`  Function:                  ${r.fn || '—'}`);
  console.log(`  career_progression:        ${r.person.career_progression || '—'}`);
  console.log(`  highest_seniority_reached: ${r.person.highest_seniority_reached || '—'}`);
  console.log(`  has_early_stage:           ${r.person.has_early_stage_experience} (${r.person.early_stage_companies_count} companies)`);
  console.log(`  has_hypergrowth:           ${r.person.has_hypergrowth_experience} (${r.person.hypergrowth_companies_count} companies)`);
  console.log(`\n  Experiences:`);
  r.experiences.forEach(e => console.log(e));
  console.log(`\n  Core components:`);
  for (const c of r.components.filter(x => x.category === 'core')) {
    const rawStr = c.raw === null ? 'null' : c.raw.toFixed(3);
    console.log(`    ${c.name.padEnd(26)} weight=${String(c.weight).padStart(3)} raw=${rawStr.padStart(6)} pts=${c.points.toFixed(2).padStart(6)} (${c.note})`);
  }
  console.log(`\n  Bonus components:`);
  for (const c of r.components.filter(x => x.category === 'bonus')) {
    const rawStr = c.raw === null ? 'null' : c.raw.toFixed(3);
    console.log(`    ${c.name.padEnd(26)} weight=${String(c.weight).padStart(3)} raw=${rawStr.padStart(6)} pts=${c.points.toFixed(2).padStart(6)} (${c.note})`);
  }
  const penalties = r.components.filter(x => x.category === 'penalty');
  if (penalties.length > 0) {
    console.log(`\n  Penalty:`);
    for (const c of penalties) {
      console.log(`    ${c.name.padEnd(26)} max=${String(c.weight).padStart(3)} pts=${c.points.toFixed(2).padStart(6)} (${c.note})`);
    }
  }
  console.log(`\n  ${'─'.repeat(60)}`);
  console.log(`  Core score:       ${r.core.toFixed(2)}`);
  console.log(`  Bonus score:     +${r.bonus.toFixed(2)}`);
  console.log(`  Penalty score:    ${r.penalty.toFixed(2)}`);
  console.log(`  TOTAL SCORE:      ${r.total.toFixed(2)}`);
  console.log(`  BUCKET:           ${r.bucket.toUpperCase()}`);

  await writeBucket(r);
  console.log(`  (bucket written to candidate_bucket_assignments)`);
}

console.log('\n' + '═'.repeat(90));
console.log('  Done.');
console.log('═'.repeat(90) + '\n');
