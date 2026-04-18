// lib/scoring/score-candidate.ts
// Phase 2 — deterministic candidate scoring engine (v2).
//
// Weights come from the Vetted scoring rubric CSV. See CLAUDE.md for the
// authoritative table. Summary:
//
//   Stage boundaries (by years_experience_estimate):
//     pre_career:    < 0.5 yrs
//     early_career:  0.5 – 1.99 yrs
//     mid_career:    2   – 4.99 yrs
//     senior_career: 5+ yrs
//
//   Structure per stage:
//     CORE    — always applied, sum to ~100 points
//     BONUS   — only added when data exists; NOT capped, stacks on top of core
//     PENALTY — applied only in mid/senior for short average tenure
//
// Key policies:
//   • Career slope is BONUS-only. Never subtracts.
//   • Internship scoring is quality-based (avg company_year_score).
//   • Degree relevance is a per-function dictionary.
//   • When current_function_normalized = 'recruiting', all weights are
//     replaced with the recruiting override set (regardless of career stage).
//   • Missing/unscored companies contribute 0 to their component.

import { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────

export type ScoringStage = 'pre_career' | 'early_career' | 'mid_career' | 'senior_career';
export type CandidateBucket =
  | 'vetted_talent'
  | 'high_potential'
  | 'silver_medalist'
  | 'non_vetted'
  | 'needs_review';

export type CareerProgression = 'rising' | 'flat' | 'declining' | 'insufficient_data' | null;

export interface ScoreComponent {
  name: string;
  category: 'core' | 'bonus' | 'penalty';
  weight: number;         // max possible points for this component
  raw: number | null;     // 0-1 normalized, or null if N/A (skipped)
  points: number;         // actual contribution to total
  note?: string;
}

export interface ScoreResult {
  person_id: string;
  full_name: string;
  scoring_stage: ScoringStage;
  years_experience: number | null;
  function_normalized: string | null;
  applied_recruiting_override: boolean;
  applied_executive_override: boolean;
  components: ScoreComponent[];
  core_score: number;
  bonus_score: number;
  penalty_score: number;
  total_score: number;
  bucket: CandidateBucket;
  career_progression: CareerProgression;
  highest_seniority_reached: string | null;
  has_early_stage_experience: boolean;
  has_hypergrowth_experience: boolean;
  reasoning: string;
}

// ─── Weights per stage ────────────────────────────────────────────────────

interface StageWeights {
  core: Record<string, number>;
  bonus: Record<string, number>;
  penalty?: { name: string; maxPoints: number; thresholdMonths: number };
}

const STAGE_WEIGHTS: Record<ScoringStage, StageWeights> = {
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

// Recruiting function override — applied regardless of career stage.
// Priority: recruiting > executive > stage. Recruiters are evaluated purely
// on where they've worked; education is near-zero-signal for this function.
const RECRUITING_OVERRIDE: StageWeights = {
  core:  { company_quality_recent: 70, education: 5, degree_relevance: 5 },
  bonus: { career_slope: 20 },
};

// Executive override — applied when highest_seniority_reached='executive'
// AND the recruiting override does not apply. Education is heavily
// deprioritized; role scope (how high they've climbed) and company quality
// dominate. 'role_scope' is an exec-only core component sourced from
// highest_seniority_reached: executive=1.0, manager=0.7, lead=0.5, IC=0.3.
const EXECUTIVE_OVERRIDE: StageWeights = {
  core:  { company_quality_recent: 55, company_quality_average: 30, role_scope: 10, degree_relevance: 3, education: 2 },
  bonus: { career_slope: 10, biz_unit: 25, publications: 10 },
};

// role_scope points by highest_seniority_reached
const ROLE_SCOPE_BY_SENIORITY: Record<string, number> = {
  executive: 1.0,
  manager: 0.7,
  founder: 0.7,
  lead_ic: 0.5,
  lead: 0.5,       // deprecated alias
  senior_ic: 0.4,
  individual_contributor: 0.3,
  entry: 0.2,
  intern: 0.1,
  student: 0.1,    // deprecated alias
};

// ─── Bucket thresholds ────────────────────────────────────────────────────

function assignBucket(stage: ScoringStage, total: number): CandidateBucket {
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
  // senior_career
  if (total >= 70) return 'vetted_talent';
  if (total >= 55) return 'silver_medalist';
  return 'non_vetted';
}

// ─── Stage determination ──────────────────────────────────────────────────

function determineStage(years: number | null): ScoringStage {
  if (years === null || years < 0.5) return 'pre_career';
  if (years < 2) return 'early_career';
  if (years < 5) return 'mid_career';
  return 'senior_career';
}

// ─── Degree relevance dictionary ──────────────────────────────────────────

/**
 * Returns 0-1 relevance for a given function + (field_of_study, degree) combo.
 * Unknown function defaults to software_engineering.
 */
export function degreeRelevance(
  functionName: string | null | undefined,
  fieldOrDegree: string,
): number {
  const fn = (functionName || 'engineering').toLowerCase();
  const s = fieldOrDegree.toLowerCase();

  const hasMBA = /\bmba\b|master of business administration/i.test(s);
  const hasCS = /computer science|\bcs\b|eecs|computer engineering|software engineering/i.test(s);
  const hasEE = /electrical engineering|computer engineering|eecs|electrical & computer/i.test(s);
  const hasME = /mechanical engineering/i.test(s);
  const hasRobotics = /robotics/i.test(s);
  const hasAero = /aerospace/i.test(s);
  const hasMaterials = /materials science/i.test(s);
  const hasPhysics = /physics/i.test(s);
  const hasMath = /(applied )?mathematics?|\bmath\b/i.test(s);
  const hasStats = /statistics/i.test(s);
  const hasInfoSys = /information systems/i.test(s);
  const hasCogSci = /cognitive science/i.test(s);
  const hasPsych = /psychology/i.test(s);
  const hasEcon = /economics/i.test(s);
  const hasBusiness = /business|management/i.test(s);
  const hasFinance = /finance/i.test(s);
  const hasMarketing = /marketing/i.test(s);
  const hasComm = /communications?/i.test(s);
  const hasOpsResearch = /operations research/i.test(s);
  const hasIndustrialEng = /industrial engineering/i.test(s);
  const hasSystemsEng = /systems engineering/i.test(s);
  const hasHCI = /hci|human.computer interaction/i.test(s);
  const hasDesign = /product design|industrial design|interaction design|graphic design|ux design|fine arts|architecture/i.test(s);
  const hasEngineering = /engineering/i.test(s);
  const hasSTEM = hasCS || hasEngineering || hasPhysics || hasMath || hasStats ||
    /chemistry|biology|biochem|neuroscience|biomedical|genetics/i.test(s);

  // Software Engineering (default for 'engineering' or unknown)
  if (fn === 'engineering' || fn === 'software engineering') {
    if (hasCS) return 1.0;
    if (/electrical engineering/i.test(s) || hasMath || hasStats || hasPhysics) return 0.75;
    if (hasME || hasInfoSys || hasCogSci) return 0.5;
    if (hasSTEM) return 0.25;
    return 0;
  }

  // Hardware / Electrical Engineering
  if (fn === 'hardware' || fn === 'electrical engineering' || fn === 'hardware engineering') {
    if (hasEE) return 1.0;
    if (hasME || hasPhysics || hasMaterials || hasAero) return 0.75;
    if (hasCS || /applied mathematics/i.test(s)) return 0.5;
    if (hasSTEM) return 0.25;
    return 0;
  }

  // Mechanical / Robotics
  if (fn === 'mechanical' || fn === 'robotics' || fn === 'mechanical engineering') {
    if (hasME || hasRobotics || hasAero || hasSystemsEng) return 1.0;
    if (/electrical engineering/i.test(s) || hasPhysics || hasMaterials) return 0.75;
    if (hasCS || /applied mathematics/i.test(s)) return 0.5;
    if (hasSTEM) return 0.25;
    return 0;
  }

  // Product Management
  if (fn === 'product') {
    if (hasMBA) return 1.0;
    if (hasCS || hasEngineering || hasEcon || hasHCI) return 1.0;
    if (hasBusiness || hasMath || hasCogSci || hasPsych) return 0.75;
    if (hasSTEM) return 0.5;
    return 0.1;
  }

  // Product Design / UX
  if (fn === 'design') {
    if (hasDesign || hasHCI) return 1.0;
    if (hasCogSci || hasPsych || hasCS || hasEngineering) return 0.75;
    return 0.25;
  }

  // Operations / BizOps
  if (fn === 'operations') {
    if (hasBusiness || hasEcon || hasMBA || hasOpsResearch || hasIndustrialEng ||
        hasFinance || hasMath || hasStats || hasCS) return 1.0;
    if (hasSTEM) return 0.5;
    return 0.25;
  }

  // Sales / GTM
  if (fn === 'sales' || fn === 'marketing') {
    if (hasBusiness || hasEcon || hasMarketing || hasComm || hasCS || hasEngineering) return 1.0;
    return 0.25;
  }

  // Recruiting — any degree counts fully (but recruiting override makes this low-weight anyway)
  if (fn === 'recruiting') return 1.0;

  // Default to software_engineering rules for anything else
  if (hasCS) return 1.0;
  if (/electrical engineering/i.test(s) || hasMath || hasStats || hasPhysics) return 0.75;
  if (hasSTEM) return 0.25;
  return 0;
}

// ─── Data shapes ──────────────────────────────────────────────────────────

interface ExperienceRow {
  person_experience_id: string;
  company_id: string | null;
  title_raw: string | null;
  employment_type_normalized: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  duration_months: number | null;
}

interface EducationRow {
  person_education_id: string;
  school_id: string | null;
  school_name_raw: string | null;
  degree_raw: string | null;
  field_of_study_raw: string | null;
}

interface CompanyYearScore {
  company_id: string;
  year: number;
  company_score: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function normalizeSchoolName(raw: string): string {
  return raw.trim().replace(/[.,]+$/, '').replace(/\s+/g, ' ').toLowerCase();
}

function isInternship(exp: ExperienceRow): boolean {
  const t = (exp.title_raw || '').toLowerCase();
  const e = (exp.employment_type_normalized || '').toLowerCase();
  return e === 'internship' || /\bintern\b|\binternship\b|\bco-?op\b/.test(t);
}

/** Compute per-experience avg company_year_score across years worked. */
function experienceCompanyScore(
  exp: ExperienceRow,
  allYearScores: CompanyYearScore[],
): number | null {
  if (!exp.company_id || !exp.start_date) return null;
  const startYear = new Date(exp.start_date).getFullYear();
  const endYear = exp.is_current
    ? new Date().getFullYear()
    : exp.end_date ? new Date(exp.end_date).getFullYear() : new Date().getFullYear();
  const matches = allYearScores.filter(ys =>
    ys.company_id === exp.company_id && ys.year >= startYear && ys.year <= endYear);
  if (matches.length === 0) return null;
  return matches.reduce((s, ys) => s + ys.company_score, 0) / matches.length;
}

// ─── Main scoring function ────────────────────────────────────────────────

export async function scoreCandidate(
  supabase: SupabaseClient,
  personId: string,
): Promise<ScoreResult> {
  // 1. Person (with derived fields populated by compute-derived-fields script)
  const { data: person, error: personErr } = await supabase
    .from('people')
    .select('person_id, full_name, years_experience_estimate, current_function_normalized, career_progression, highest_seniority_reached, has_early_stage_experience, has_hypergrowth_experience')
    .eq('person_id', personId)
    .single();

  if (personErr || !person) {
    throw new Error(`Person ${personId} not found: ${personErr?.message}`);
  }

  const years = person.years_experience_estimate;
  const stage = determineStage(years);
  const functionName = person.current_function_normalized;

  // 2. Experiences
  const { data: expRaw } = await supabase
    .from('person_experiences')
    .select('person_experience_id, company_id, title_raw, employment_type_normalized, start_date, end_date, is_current, duration_months')
    .eq('person_id', personId)
    .order('start_date', { ascending: false });
  const experiences: ExperienceRow[] = expRaw || [];

  // 3. Education
  const { data: eduRaw } = await supabase
    .from('person_education')
    .select('person_education_id, school_id, school_name_raw, degree_raw, field_of_study_raw')
    .eq('person_id', personId);
  const education: EducationRow[] = eduRaw || [];

  // 4. All company_year_scores for referenced companies
  const companyIds = Array.from(new Set(experiences.map(e => e.company_id).filter(Boolean))) as string[];
  let yearScores: CompanyYearScore[] = [];
  if (companyIds.length > 0) {
    const { data } = await supabase
      .from('company_year_scores')
      .select('company_id, year, company_score')
      .in('company_id', companyIds);
    yearScores = data || [];
  }

  // 5. All schools + aliases
  const { data: schoolsData } = await supabase
    .from('schools')
    .select('school_id, school_name, school_score')
    .not('school_score', 'is', null);
  const schools = schoolsData || [];

  const { data: aliasData } = await supabase
    .from('school_aliases')
    .select('alias_name, school_id');
  const aliases = aliasData || [];

  // Lookup: canonical-lowercased-name → school_score
  const schoolByNorm = new Map<string, number>();
  const schoolById = new Map<string, typeof schools[0]>();
  for (const s of schools) {
    schoolById.set(s.school_id, s);
    schoolByNorm.set(normalizeSchoolName(s.school_name), s.school_score as number);
  }
  for (const a of aliases) {
    const school = schoolById.get(a.school_id);
    if (school?.school_score !== null && school?.school_score !== undefined) {
      schoolByNorm.set(normalizeSchoolName(a.alias_name), school.school_score as number);
    }
  }

  // ── Determine which weight set to use ───────────────────────────────────
  // Priority: recruiting > executive > stage-default. At most one override
  // applies; recruiting wins if both would otherwise fire (a head of talent
  // with executive seniority is still scored as a recruiter).
  const applyRecruiting = functionName === 'recruiting';
  const applyExecutive = !applyRecruiting && person.highest_seniority_reached === 'executive';
  const weights: StageWeights = applyRecruiting
    ? RECRUITING_OVERRIDE
    : applyExecutive
      ? EXECUTIVE_OVERRIDE
      : STAGE_WEIGHTS[stage];

  const components: ScoreComponent[] = [];

  // ─────────────────────────────────────────────────────────────────────
  // CORE: company_quality_recent
  // ─────────────────────────────────────────────────────────────────────
  if ('company_quality_recent' in weights.core) {
    const fullTime = experiences.filter(e => !isInternship(e));
    const mostRecent = fullTime[0];
    let recent = 0;
    let note = 'No full-time experience';
    if (mostRecent) {
      const s = experienceCompanyScore(mostRecent, yearScores);
      recent = s !== null ? s : 0;
      note = s === null ? 'Current company not in scored set' : `Avg score ${s.toFixed(2)} over years worked`;
    }
    components.push({
      name: 'company_quality_recent',
      category: 'core',
      weight: weights.core.company_quality_recent,
      raw: recent / 5,
      points: (recent / 5) * weights.core.company_quality_recent,
      note,
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // CORE: company_quality_average (mid/senior)
  // ─────────────────────────────────────────────────────────────────────
  if ('company_quality_average' in weights.core) {
    const fullTime = experiences.filter(e => !isInternship(e));
    const scored = fullTime.map(e => experienceCompanyScore(e, yearScores));
    // Treat null as 0 per rubric rule "If company is not in system, score = 0"
    const avg = scored.length > 0
      ? scored.reduce<number>((s, v) => s + (v ?? 0), 0) / scored.length
      : 0;
    components.push({
      name: 'company_quality_average',
      category: 'core',
      weight: weights.core.company_quality_average,
      raw: avg / 5,
      points: (avg / 5) * weights.core.company_quality_average,
      note: `Avg ${avg.toFixed(2)} across ${fullTime.length} full-time role(s)`,
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // CORE: role_scope (executive override only) — reads highest_seniority_reached.
  // ─────────────────────────────────────────────────────────────────────
  if ('role_scope' in weights.core) {
    const seniority = person.highest_seniority_reached ?? '';
    const raw = ROLE_SCOPE_BY_SENIORITY[seniority] ?? 0;
    components.push({
      name: 'role_scope',
      category: 'core',
      weight: weights.core.role_scope,
      raw,
      points: raw * weights.core.role_scope,
      note: `highest_seniority=${seniority || 'none'}`,
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // CORE: education (max school_score across all education rows)
  // ─────────────────────────────────────────────────────────────────────
  if ('education' in weights.core) {
    let eduScore = 0;
    const eduNotes: string[] = [];
    for (const e of education) {
      const raw = (e.school_name_raw || '').trim();
      if (!raw) continue;
      const norm = normalizeSchoolName(raw);
      const hit = schoolByNorm.get(norm);
      if (hit !== undefined) {
        eduScore = Math.max(eduScore, hit);
        eduNotes.push(`${raw}→${hit}`);
      } else {
        eduNotes.push(`${raw}→no match`);
      }
    }
    components.push({
      name: 'education',
      category: 'core',
      weight: weights.core.education,
      raw: eduScore / 4,
      points: (eduScore / 4) * weights.core.education,
      note: eduNotes.join('; ') || 'No education data',
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // CORE: degree_relevance
  // ─────────────────────────────────────────────────────────────────────
  if ('degree_relevance' in weights.core) {
    let rel = 0;
    const relNotes: string[] = [];
    for (const e of education) {
      const combined = ((e.field_of_study_raw || '') + ' ' + (e.degree_raw || '')).trim();
      if (!combined) continue;
      const r = degreeRelevance(functionName, combined);
      if (r > rel) rel = r;
      relNotes.push(`${combined.slice(0, 40)}→${(r * 100).toFixed(0)}%`);
    }
    components.push({
      name: 'degree_relevance',
      category: 'core',
      weight: weights.core.degree_relevance,
      raw: rel,
      points: rel * weights.core.degree_relevance,
      note: relNotes.join('; ') || 'No education data',
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // CORE: internships (pre/early) — quality-based
  // ─────────────────────────────────────────────────────────────────────
  if ('internships' in weights.core) {
    const interns = experiences.filter(isInternship);
    const intScores = interns.map(e => experienceCompanyScore(e, yearScores));
    const avg = intScores.length > 0
      ? intScores.reduce<number>((s, v) => s + (v ?? 0), 0) / intScores.length
      : 0;
    components.push({
      name: 'internships',
      category: 'core',
      weight: weights.core.internships,
      raw: avg / 5,
      points: (avg / 5) * weights.core.internships,
      note: `${interns.length} internship(s), avg score ${avg.toFixed(2)}`,
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // BONUS: career_slope — only adds if progression = 'rising'
  // ─────────────────────────────────────────────────────────────────────
  if ('career_slope' in (weights.bonus || {})) {
    const isRising = person.career_progression === 'rising';
    components.push({
      name: 'career_slope',
      category: 'bonus',
      weight: weights.bonus!.career_slope,
      raw: isRising ? 1.0 : 0,
      points: isRising ? weights.bonus!.career_slope : 0,
      note: `progression=${person.career_progression ?? 'none'}`,
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // BONUS: remaining signals (not yet sourced in schema — skipped)
  // hackathons, clubs, labs, publications, open_source, fellowships,
  // biz_unit, company_function_quality
  // ─────────────────────────────────────────────────────────────────────
  const unsourcedBonus = ['hackathons', 'clubs', 'labs', 'publications', 'open_source',
                          'fellowships', 'biz_unit', 'company_function_quality'];
  for (const name of unsourcedBonus) {
    if (name in (weights.bonus || {})) {
      components.push({
        name,
        category: 'bonus',
        weight: weights.bonus![name],
        raw: null,
        points: 0,
        note: 'No data source yet',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // PENALTY: short average tenure (mid/senior only)
  // ─────────────────────────────────────────────────────────────────────
  if (weights.penalty) {
    const ft = experiences.filter(e => !isInternship(e) && e.duration_months);
    const avgMonths = ft.length > 0
      ? ft.reduce((s, e) => s + (e.duration_months || 0), 0) / ft.length
      : 0;
    const { maxPoints, thresholdMonths } = weights.penalty;
    // Scaled penalty: full maxPoints at 0 avg months, 0 at threshold, linear
    const penaltyPts = avgMonths >= thresholdMonths
      ? 0
      : maxPoints * (1 - avgMonths / thresholdMonths);
    components.push({
      name: weights.penalty.name,
      category: 'penalty',
      weight: maxPoints,
      raw: avgMonths >= thresholdMonths ? 0 : (1 - avgMonths / thresholdMonths),
      points: -penaltyPts,
      note: `Avg tenure ${avgMonths.toFixed(1)}mo (threshold ${thresholdMonths}mo)`,
    });
  }

  // ── Sums ──
  const coreScore = components.filter(c => c.category === 'core').reduce((s, c) => s + c.points, 0);
  const bonusScore = components.filter(c => c.category === 'bonus').reduce((s, c) => s + c.points, 0);
  const penaltyScore = components.filter(c => c.category === 'penalty').reduce((s, c) => s + c.points, 0);
  const total = coreScore + bonusScore + penaltyScore;

  // ── Bucket (recruiting override uses same stage-based thresholds) ──
  const bucket = assignBucket(stage, total);

  const overrideTag = applyRecruiting ? ' [recruiting override]' : applyExecutive ? ' [executive override]' : '';
  const reasoning = `${stage.replace('_', ' ')} (${years ?? '?'}y) core=${coreScore.toFixed(1)} bonus=${bonusScore.toFixed(1)} penalty=${penaltyScore.toFixed(1)} → ${Math.round(total * 100) / 100}/${bucket}${overrideTag}`;

  return {
    person_id: person.person_id,
    full_name: person.full_name,
    scoring_stage: stage,
    years_experience: years,
    function_normalized: functionName,
    applied_recruiting_override: applyRecruiting,
    applied_executive_override: applyExecutive,
    components,
    core_score: Math.round(coreScore * 100) / 100,
    bonus_score: Math.round(bonusScore * 100) / 100,
    penalty_score: Math.round(penaltyScore * 100) / 100,
    total_score: Math.round(total * 100) / 100,
    bucket,
    career_progression: (person.career_progression as CareerProgression) ?? null,
    highest_seniority_reached: person.highest_seniority_reached,
    has_early_stage_experience: person.has_early_stage_experience,
    has_hypergrowth_experience: person.has_hypergrowth_experience,
    reasoning,
  };
}

// ─── Write bucket assignment back to DB ───────────────────────────────────

/**
 * Shape persisted in candidate_bucket_assignments.score_breakdown.
 * Everything the expandable score-breakdown UI needs to render.
 */
export interface ScoreBreakdown {
  components: ScoreComponent[]
  core_score: number
  bonus_score: number
  penalty_score: number
  total_score: number
  scoring_stage: ScoringStage
  years_experience: number | null
  function_normalized: string | null
  applied_recruiting_override: boolean
  applied_executive_override: boolean
  career_progression: CareerProgression
  highest_seniority_reached: string | null
  has_early_stage_experience: boolean
  has_hypergrowth_experience: boolean
}

function buildBreakdown(result: ScoreResult): ScoreBreakdown {
  return {
    components: result.components,
    core_score: result.core_score,
    bonus_score: result.bonus_score,
    penalty_score: result.penalty_score,
    total_score: result.total_score,
    scoring_stage: result.scoring_stage,
    years_experience: result.years_experience,
    function_normalized: result.function_normalized,
    applied_recruiting_override: result.applied_recruiting_override,
    applied_executive_override: result.applied_executive_override,
    career_progression: result.career_progression,
    highest_seniority_reached: result.highest_seniority_reached,
    has_early_stage_experience: result.has_early_stage_experience,
    has_hypergrowth_experience: result.has_hypergrowth_experience,
  };
}

export async function writeBucketAssignment(
  supabase: SupabaseClient,
  result: ScoreResult,
): Promise<void> {
  const { error } = await supabase
    .from('candidate_bucket_assignments')
    .insert({
      person_id: result.person_id,
      candidate_bucket: result.bucket,
      assigned_by: 'system',
      assignment_reason: result.reasoning,
      score_breakdown: buildBreakdown(result),
    });
  if (error) throw new Error(`Failed to write bucket: ${error.message}`);
}
