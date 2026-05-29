// scripts/_backfill-slope-once.mjs
//
// One-off backfill for slope_score after migration 068.
//
// Inlines the compute logic in pure JS (mirrors lib/scoring/slope.ts) since
// the existing scripts/compute-derived-fields.mjs is also a JS duplicate of
// lib/scoring/compute-derived.ts that doesn't know about slope_score, and the
// TS function isn't directly runnable from Node without a compile step.
//
// This script computes ONLY slope_score and writes it. It does NOT touch any
// other derived fields — those stay as last computed.
//
// Run once after migration 068:
//   node scripts/_backfill-slope-once.mjs
//
// After this one-shot, future rescores via /api/admin/rescore-all will use
// the TS computeAndWriteDerivedFields() which properly writes slope_score
// alongside all other derived fields.

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

// ─── Mirror of lib/scoring/slope.ts (pure logic; no DB) ────────────────────

const SLOPE_WEIGHTS = {
  senior: 1.0, lead: 1.5, manager: 1.5, director: 2.0, vp: 2.0, c_suite: 2.5,
};

const SENIORITY_TO_SLOPE_BUCKET = {
  intern: null, junior_ic: null, individual_contributor: null,
  senior_ic: 'senior', lead_ic: 'lead', manager: 'manager',
  director: 'director', vp: 'vp', c_suite: 'c_suite',
  founder: null,
  lead: 'lead', executive: 'c_suite',
  student: null, entry: null, unknown: null,
};

const IC_EQUIVALENT = new Set(['junior_ic', 'individual_contributor', 'senior_ic', 'lead_ic', 'entry', 'lead']);
const MANAGER_PLUS = new Set(['manager', 'director', 'vp', 'c_suite', 'executive']);
const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

const BENCHMARKS = {
  senior:   [[4,100],[5,80],[6,75],[7,55],[8,45],[9,35],[10,25],[11,15],[Infinity,10]],
  lead:     [[7,100],[9,80],[10,75],[11,55],[13,45],[14,35],[15,25],[16,15],[Infinity,10]],
  manager:  [[8,100],[9,80],[10,75],[11,55],[13,45],[14,35],[15,25],[16,15],[Infinity,10]],
  director: [[10,100],[12,80],[13,75],[14,55],[16,45],[17,35],[18,25],[19,15],[Infinity,10]],
  vp:       [[12,100],[14,80],[15,75],[16,55],[18,45],[19,35],[20,25],[21,15],[Infinity,10]],
  c_suite:  [[15,100],[18,80],[19,75],[20,55],[22,45],[23,35],[24,25],[25,15],[Infinity,10]],
};

function lookupBenchmark(bucket, yearsToReach) {
  for (const [upTo, score] of BENCHMARKS[bucket]) {
    if (yearsToReach <= upTo) return score;
  }
  return 10;
}

// ─── Mirror of FT filter (subset of lib/tenure/helpers.ts::getFtExperiences) ──
// Conservative filter: exclude intern/student/co-op patterns + pre-graduation roles.
// This is a simplified version — the real helper has many more rules (consulting
// firm overrides, self-employed names, OSS roles). For the one-shot backfill
// we use this conservative set; the next /api/admin/rescore-all run will use
// the full TS helper and re-derive precisely.

function isInternshipTitle(title) {
  if (!title) return false;
  return /\bintern\b|\binternship\b|\bco-?op\b/i.test(title);
}

function gradYearFromEducation(education) {
  const POSTSECONDARY = new Set(['bachelor', 'master', 'mba', 'phd', 'jd', 'md', 'associate']);
  const nowY = new Date().getFullYear();
  let earliest = null;
  for (const edu of education) {
    if (!edu.end_year || edu.end_year > nowY) continue;
    const lvl = (edu.degree_level || '').toLowerCase();
    if (!POSTSECONDARY.has(lvl)) continue;
    if (earliest === null || edu.end_year < earliest) earliest = edu.end_year;
  }
  return earliest;
}

function isQualifyingFt(exp, gradYear) {
  if (!exp.title_raw || !exp.start_date) return false;
  if (exp.employment_type_normalized === 'internship') return false;
  if (isInternshipTitle(exp.title_raw)) return false;
  if (exp.seniority_normalized === 'student' || exp.seniority_normalized === 'intern') return false;
  if (gradYear !== null) {
    const startY = new Date(exp.start_date).getFullYear();
    if (!isNaN(startY) && startY < gradYear) return false;
  }
  return true;
}

function computeSlopeScore(experiences, education) {
  const gradYear = gradYearFromEducation(education);
  const qualifying = experiences.filter(e => isQualifyingFt(e, gradYear));

  let ftStart = null;
  for (const e of qualifying) {
    const t = new Date(e.start_date).getTime();
    if (isNaN(t)) continue;
    if (ftStart === null || t < ftStart) ftStart = t;
  }
  if (ftStart === null) return null;

  // Atypical-entry guard
  const hasIc = qualifying.some(e => e.seniority_normalized && IC_EQUIVALENT.has(e.seniority_normalized));
  if (!hasIc) {
    const mgrStarts = qualifying
      .filter(e => e.seniority_normalized && MANAGER_PLUS.has(e.seniority_normalized))
      .map(e => new Date(e.start_date).getTime())
      .filter(t => !isNaN(t))
      .sort((a, b) => a - b);
    if (mgrStarts.length > 0) {
      const yrsBefore = (mgrStarts[0] - ftStart) / MS_PER_YEAR;
      if (yrsBefore < 2) return null;
    }
  }

  // First-reached date per bucket
  const firstReached = new Map();
  for (const e of qualifying) {
    const bucket = SENIORITY_TO_SLOPE_BUCKET[e.seniority_normalized] ?? null;
    if (!bucket) continue;
    const t = new Date(e.start_date).getTime();
    if (isNaN(t)) continue;
    const existing = firstReached.get(bucket);
    if (!existing || t < existing) firstReached.set(bucket, t);
  }

  if (firstReached.size === 0) return null;

  let weightedSum = 0, totalWeight = 0;
  for (const [bucket, firstT] of firstReached) {
    const yrsToReach = Math.max(0, (firstT - ftStart) / MS_PER_YEAR);
    const raw = lookupBenchmark(bucket, yrsToReach);
    const w = SLOPE_WEIGHTS[bucket];
    weightedSum += raw * w;
    totalWeight += w;
  }
  return Math.round(weightedSum / totalWeight);
}

// ─── Main ─────────────────────────────────────────────────────────────────

const { data: people, error: peopleErr } = await supabase.from('people').select('person_id, full_name');
if (peopleErr) { console.error('Failed to load people:', peopleErr); process.exit(1); }
console.log(`Backfilling slope_score for ${people.length} candidates...`);

let nonNull = 0, nullCount = 0, errors = 0;
const dist = { '100': 0, '80-99': 0, '60-79': 0, '40-59': 0, '20-39': 0, '10-19': 0 };

for (const p of people) {
  try {
    const [expRes, eduRes] = await Promise.all([
      supabase.from('person_experiences')
        .select('title_raw, start_date, end_date, is_current, seniority_normalized, employment_type_normalized')
        .eq('person_id', p.person_id),
      supabase.from('person_education')
        .select('start_year, end_year, degree_raw, degree_level')
        .eq('person_id', p.person_id),
    ]);
    const slope = computeSlopeScore(expRes.data || [], eduRes.data || []);
    const { error: upErr } = await supabase.from('people').update({ slope_score: slope }).eq('person_id', p.person_id);
    if (upErr) { console.error(`Update failed for ${p.full_name}:`, upErr.message); errors++; continue; }
    if (slope === null) {
      nullCount++;
    } else {
      nonNull++;
      if (slope === 100) dist['100']++;
      else if (slope >= 80) dist['80-99']++;
      else if (slope >= 60) dist['60-79']++;
      else if (slope >= 40) dist['40-59']++;
      else if (slope >= 20) dist['20-39']++;
      else dist['10-19']++;
    }
  } catch (e) {
    console.error(`Error processing ${p.full_name}:`, e.message);
    errors++;
  }
}

console.log('');
console.log(`=== Distribution ===`);
console.log(`Total candidates: ${people.length}`);
console.log(`Non-null slope_score: ${nonNull}`);
console.log(`Null slope_score:     ${nullCount}`);
console.log(`Errors:               ${errors}`);
console.log('');
console.log('Score band (non-null only):');
for (const [band, count] of Object.entries(dist)) {
  console.log(`  ${band.padEnd(8)} ${count}`);
}
