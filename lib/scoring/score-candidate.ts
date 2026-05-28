// lib/scoring/score-candidate.ts
// V1 deterministic candidate scoring engine.
//
// Architecture (post-migrations 049-055):
//   • CORE weights are hardcoded per stage (and recruiting/executive overrides).
//     The user explicitly held core weights stable across the V1 refactor.
//   • BONUS signal weights are read from signal_scoring_weights (104 rows,
//     keyed by category + tier_group + career_stage).
//   • TEAM membership scoring is read from team_role_scoring_weights (48 rows,
//     keyed by team_tier × team_role_tier × career_stage). Applied per
//     person_signals row in category=engineering_team.
//   • Bucket thresholds are read from career_stage_bucket_thresholds (4 rows).
//
// Bucket assignment (V1 model — only 'vetted' or 'needs_review' ever auto-assigned):
//   • highest_seniority_reached='unknown'    → needs_review, flag=unknown_seniority
//   • score >= threshold AND no flags        → vetted
//   • score >= threshold AND flagged         → needs_review (with flags)
//   • score <  threshold                     → needs_review, flag=low_score
//   • 'flagged' is admin-manual only — the engine never assigns it.
//
// flagged_reasons array values written to candidate_bucket_assignments:
//   • low_score          (total < stage threshold)
//   • unknown_seniority  (highest_seniority_reached='unknown')
//   • contractor_only    (no FT roles, only contract/freelance employment)
//   • job_hopping        (short-tenure penalty fired AND avg tenure below floor)

import { SupabaseClient } from '@supabase/supabase-js';
import type { CandidateBucket, FlaggedReason } from '../../app/types';

// ─── Types ────────────────────────────────────────────────────────────────

export type ScoringStage = 'pre_career' | 'early_career' | 'mid_career' | 'senior_career';
export type CareerProgression = 'rising' | 'flat' | 'declining' | 'insufficient_data' | null;

export interface ScoreComponent {
  name: string;
  category: 'core' | 'bonus' | 'penalty';
  weight: number;
  raw: number | null;
  points: number;
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
  flagged_reasons: FlaggedReason[];
  career_progression: CareerProgression;
  highest_seniority_reached: string | null;
  has_early_stage_experience: boolean;
  has_hypergrowth_experience: boolean;
  is_current_founder: boolean;
  is_former_founder: boolean;
  reasoning: string;
}

// ─── Hardcoded CORE weights (unchanged per V1 scope decision) ─────────────

interface CoreWeights {
  core: Record<string, number>;
  penalty?: { name: string; maxPoints: number; thresholdMonths: number };
}

const STAGE_CORE_WEIGHTS: Record<ScoringStage, CoreWeights> = {
  pre_career:    { core: { education: 30, degree_relevance: 30, internships: 40 } },
  early_career:  { core: { company_quality_recent: 40, education: 25, degree_relevance: 25, internships: 10 } },
  mid_career:    { core: { company_quality_recent: 60, company_quality_average: 10, education: 15, degree_relevance: 15 },
                   penalty: { name: 'short_tenure', maxPoints: 20, thresholdMonths: 12 } },
  senior_career: { core: { company_quality_recent: 60, company_quality_average: 30, education: 5, degree_relevance: 5 },
                   penalty: { name: 'short_tenure', maxPoints: 30, thresholdMonths: 18 } },
};

const RECRUITING_OVERRIDE_CORE: CoreWeights = {
  core: { company_quality_recent: 70, education: 5, degree_relevance: 5 },
};

const EXECUTIVE_OVERRIDE_CORE: CoreWeights = {
  core: { company_quality_recent: 55, company_quality_average: 30, role_scope: 10, degree_relevance: 3, education: 2 },
};

// Post-migration 067 ranks: c_suite=1.0, vp=0.85, director=0.7, manager=0.7
// (manager unchanged). Founder stays at 0.7 — separate axis from seniority.
// Legacy 'executive' kept at 1.0 so any stored row still scores cleanly.
const ROLE_SCOPE_BY_SENIORITY: Record<string, number> = {
  c_suite: 1.0,
  vp: 0.85,
  director: 0.7,
  manager: 0.7,
  founder: 0.7,
  lead_ic: 0.5,
  lead: 0.5,
  senior_ic: 0.4,
  individual_contributor: 0.3,
  junior_ic: 0.2,
  entry: 0.2,           // legacy fallback (enum value renamed to junior_ic in 048)
  intern: 0.1,
  student: 0.1,
  executive: 1.0,       // deprecated post-067; kept for any legacy stored rows
};

// Senior-leader override fires for these highest_seniority_reached values.
// (Renamed conceptually from "executive override" to "senior-leader override"
// in migration 067, but the field name `applied_executive_override` is kept
// for backward compat with stored breakdowns.)
const SENIOR_LEADER_OVERRIDE_SENIORITIES = new Set<string>([
  'director', 'vp', 'c_suite',
  'executive',  // legacy — any stored 'executive' rows still trigger the override
]);

// ─── Stage determination ──────────────────────────────────────────────────

function determineStage(years: number | null): ScoringStage {
  if (years === null || years < 0.5) return 'pre_career';
  if (years < 2) return 'early_career';
  if (years < 5) return 'mid_career';
  return 'senior_career';
}

// ─── Degree relevance dictionary ──────────────────────────────────────────

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

  if (fn === 'engineering' || fn === 'software engineering') {
    if (hasCS) return 1.0;
    if (/electrical engineering/i.test(s) || hasMath || hasStats || hasPhysics) return 0.75;
    if (hasME || hasInfoSys || hasCogSci) return 0.5;
    if (hasSTEM) return 0.25;
    return 0;
  }
  if (fn === 'hardware' || fn === 'electrical engineering' || fn === 'hardware engineering') {
    if (hasEE) return 1.0;
    if (hasME || hasPhysics || hasMaterials || hasAero) return 0.75;
    if (hasCS || /applied mathematics/i.test(s)) return 0.5;
    if (hasSTEM) return 0.25;
    return 0;
  }
  if (fn === 'mechanical' || fn === 'robotics' || fn === 'mechanical engineering') {
    if (hasME || hasRobotics || hasAero || hasSystemsEng) return 1.0;
    if (/electrical engineering/i.test(s) || hasPhysics || hasMaterials) return 0.75;
    if (hasCS || /applied mathematics/i.test(s)) return 0.5;
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

interface SignalRow {
  category: string;
  tier_group: string | null;
  team_id: string | null;
  team_tier: number | null;
  team_role_tier: number | null;
}

interface SignalWeightRow {
  category: string;
  tier_group: string | null;
  career_stage: ScoringStage;
  points: number;
}

interface TeamRoleWeightRow {
  team_tier: number;
  team_role_tier: number;
  career_stage: ScoringStage;
  points: number;
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

const CONTRACTOR_EMPLOYMENT_TYPES = new Set(['contract', 'freelance', 'advisory', 'board']);

function isContractorExperience(exp: ExperienceRow): boolean {
  const e = (exp.employment_type_normalized || '').toLowerCase();
  return CONTRACTOR_EMPLOYMENT_TYPES.has(e);
}

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

// ─── Config loaders (read once per scoreCandidate call) ───────────────────

async function loadSignalWeights(supabase: SupabaseClient): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('signal_scoring_weights')
    .select('category, tier_group, career_stage, points')
    .eq('is_active', true);
  if (error) throw new Error(`Failed to load signal_scoring_weights: ${error.message}`);
  const map = new Map<string, number>();
  for (const r of (data || []) as SignalWeightRow[]) {
    const tg = r.tier_group ?? '__flat__';
    map.set(`${r.category}|${tg}|${r.career_stage}`, r.points);
  }
  return map;
}

async function loadTeamRoleWeights(supabase: SupabaseClient): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('team_role_scoring_weights')
    .select('team_tier, team_role_tier, career_stage, points')
    .eq('is_active', true);
  if (error) throw new Error(`Failed to load team_role_scoring_weights: ${error.message}`);
  const map = new Map<string, number>();
  for (const r of (data || []) as TeamRoleWeightRow[]) {
    map.set(`${r.team_tier}|${r.team_role_tier}|${r.career_stage}`, r.points);
  }
  return map;
}

async function loadBucketThresholds(supabase: SupabaseClient): Promise<Map<ScoringStage, number>> {
  const { data, error } = await supabase
    .from('career_stage_bucket_thresholds')
    .select('career_stage, vetted_threshold')
    .eq('is_active', true);
  if (error) throw new Error(`Failed to load career_stage_bucket_thresholds: ${error.message}`);
  const map = new Map<ScoringStage, number>();
  for (const r of (data || []) as Array<{ career_stage: ScoringStage; vetted_threshold: number }>) {
    map.set(r.career_stage, r.vetted_threshold);
  }
  return map;
}

function lookupSignalPoints(
  weights: Map<string, number>,
  category: string,
  tierGroup: string | null,
  stage: ScoringStage,
): number | null {
  const tg = tierGroup ?? '__flat__';
  const key = `${category}|${tg}|${stage}`;
  return weights.has(key) ? weights.get(key)! : null;
}

function lookupTeamRolePoints(
  weights: Map<string, number>,
  teamTier: number | null,
  roleTier: number | null,
  stage: ScoringStage,
): number | null {
  if (teamTier == null) return null;
  const rt = roleTier ?? 1;  // NULL role_tier treated as 1 (Member) per spec
  const key = `${teamTier}|${rt}|${stage}`;
  return weights.has(key) ? weights.get(key)! : null;
}

// ─── Bucket assignment (NEW: 3-value model) ───────────────────────────────

function assignBucket(
  stage: ScoringStage,
  totalScore: number,
  highestSeniority: string | null,
  hasContractorOnlyHistory: boolean,
  shortTenureFired: boolean,
  thresholds: Map<ScoringStage, number>,
): { bucket: CandidateBucket; flagged_reasons: FlaggedReason[] } {
  const flags: FlaggedReason[] = [];

  if (!highestSeniority || highestSeniority === 'unknown') {
    flags.push('unknown_seniority');
  }
  if (hasContractorOnlyHistory) {
    flags.push('contractor_only');
  }
  if (shortTenureFired) {
    flags.push('job_hopping');
  }

  const threshold = thresholds.get(stage) ?? 100;  // missing → unreachable threshold
  if (totalScore < threshold) {
    flags.push('low_score');
  }

  if (flags.length === 0) {
    return { bucket: 'vetted', flagged_reasons: [] };
  }
  return { bucket: 'needs_review', flagged_reasons: flags };
}

// ─── Main scoring function ────────────────────────────────────────────────

export async function scoreCandidate(
  supabase: SupabaseClient,
  personId: string,
): Promise<ScoreResult> {
  // Person (with derived fields)
  const { data: person, error: personErr } = await supabase
    .from('people')
    .select('person_id, full_name, years_experience_estimate, current_function_normalized, career_progression, title_level_slope, highest_seniority_reached, has_early_stage_experience, has_hypergrowth_experience, is_current_founder, is_former_founder')
    .eq('person_id', personId)
    .single();

  if (personErr || !person) {
    throw new Error(`Person ${personId} not found: ${personErr?.message}`);
  }

  const years = person.years_experience_estimate;
  const stage = determineStage(years);
  const functionName = person.current_function_normalized;

  // Experiences
  const { data: expRaw } = await supabase
    .from('person_experiences')
    .select('person_experience_id, company_id, title_raw, employment_type_normalized, start_date, end_date, is_current, duration_months')
    .eq('person_id', personId)
    .order('start_date', { ascending: false });
  const experiences: ExperienceRow[] = expRaw || [];

  // Education
  const { data: eduRaw } = await supabase
    .from('person_education')
    .select('person_education_id, school_id, school_name_raw, degree_raw, field_of_study_raw')
    .eq('person_id', personId);
  const education: EducationRow[] = eduRaw || [];

  // Company year scores + function scores
  const companyIds = Array.from(new Set(experiences.map(e => e.company_id).filter(Boolean))) as string[];
  let yearScores: CompanyYearScore[] = [];
  let functionScores: Array<{ company_id: string; function_normalized: string; function_score: number }> = [];
  if (companyIds.length > 0) {
    const [ysRes, fsRes] = await Promise.all([
      supabase.from('company_year_scores').select('company_id, year, company_score').in('company_id', companyIds),
      supabase.from('company_function_scores').select('company_id, function_normalized, function_score').in('company_id', companyIds),
    ]);
    functionScores = fsRes.data || [];
    yearScores = ysRes.data || [];
  }

  // Schools + aliases for education lookup
  const { data: schoolsData } = await supabase
    .from('schools')
    .select('school_id, school_name, school_score')
    .not('school_score', 'is', null);
  const schools = schoolsData || [];

  const { data: aliasData } = await supabase
    .from('school_aliases')
    .select('alias_name, school_id');
  const aliases = aliasData || [];

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

  // Person signals (for bonus scoring)
  const { data: signalsRaw } = await supabase
    .from('person_signals_active')
    .select('category, tier_group, team_id, team_tier, team_role_tier')
    .eq('person_id', personId);
  const signals: SignalRow[] = signalsRaw || [];

  // Config tables (signal weights, team role weights, bucket thresholds)
  const [signalWeights, teamRoleWeights, thresholds] = await Promise.all([
    loadSignalWeights(supabase),
    loadTeamRoleWeights(supabase),
    loadBucketThresholds(supabase),
  ]);

  // Decide weight set (recruiting > senior-leader > stage-default).
  // Senior-leader override fires for director / vp / c_suite (post-migration 067).
  // Field name applied_executive_override kept for backward compat (semantic intact).
  const applyRecruiting = functionName === 'recruiting';
  const applyExecutive = !applyRecruiting
    && SENIOR_LEADER_OVERRIDE_SENIORITIES.has(person.highest_seniority_reached ?? '');
  const coreWeights: CoreWeights = applyRecruiting
    ? RECRUITING_OVERRIDE_CORE
    : applyExecutive
      ? EXECUTIVE_OVERRIDE_CORE
      : STAGE_CORE_WEIGHTS[stage];

  const components: ScoreComponent[] = [];

  // ─── CORE: company_quality_recent ───
  if ('company_quality_recent' in coreWeights.core) {
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
      name: 'company_quality_recent', category: 'core',
      weight: coreWeights.core.company_quality_recent,
      raw: recent / 5,
      points: (recent / 5) * coreWeights.core.company_quality_recent,
      note,
    });
  }

  // ─── CORE: company_quality_average (mid/senior + executive) ───
  if ('company_quality_average' in coreWeights.core) {
    const fullTime = experiences.filter(e => !isInternship(e));
    const scored = fullTime.map(e => experienceCompanyScore(e, yearScores));
    const avg = scored.length > 0
      ? scored.reduce<number>((s, v) => s + (v ?? 0), 0) / scored.length
      : 0;
    components.push({
      name: 'company_quality_average', category: 'core',
      weight: coreWeights.core.company_quality_average,
      raw: avg / 5,
      points: (avg / 5) * coreWeights.core.company_quality_average,
      note: `Avg ${avg.toFixed(2)} across ${fullTime.length} full-time role(s)`,
    });
  }

  // ─── CORE: role_scope (executive override only) ───
  if ('role_scope' in coreWeights.core) {
    const seniority = person.highest_seniority_reached ?? '';
    const raw = ROLE_SCOPE_BY_SENIORITY[seniority] ?? 0;
    components.push({
      name: 'role_scope', category: 'core',
      weight: coreWeights.core.role_scope,
      raw,
      points: raw * coreWeights.core.role_scope,
      note: `highest_seniority=${seniority || 'none'}`,
    });
  }

  // ─── CORE: education ───
  if ('education' in coreWeights.core) {
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
      name: 'education', category: 'core',
      weight: coreWeights.core.education,
      raw: eduScore / 4,
      points: (eduScore / 4) * coreWeights.core.education,
      note: eduNotes.join('; ') || 'No education data',
    });
  }

  // ─── CORE: degree_relevance ───
  if ('degree_relevance' in coreWeights.core) {
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
      name: 'degree_relevance', category: 'core',
      weight: coreWeights.core.degree_relevance,
      raw: rel,
      points: rel * coreWeights.core.degree_relevance,
      note: relNotes.join('; ') || 'No education data',
    });
  }

  // ─── CORE: internships ───
  if ('internships' in coreWeights.core) {
    const interns = experiences.filter(isInternship);
    const intScores = interns.map(e => experienceCompanyScore(e, yearScores));
    const avg = intScores.length > 0
      ? intScores.reduce<number>((s, v) => s + (v ?? 0), 0) / intScores.length
      : 0;
    components.push({
      name: 'internships', category: 'core',
      weight: coreWeights.core.internships,
      raw: avg / 5,
      points: (avg / 5) * coreWeights.core.internships,
      note: `${interns.length} internship(s), avg score ${avg.toFixed(2)}`,
    });
  }

  // ─── BONUS: signal-driven (signal_scoring_weights + team_role_scoring_weights) ───
  // Walk every person_signals_active row. Engineering-team signals look up the
  // 3-dim (team_tier × role_tier × stage) table. Everything else looks up the
  // (category × tier_group × stage) table.
  const signalCategoryTotals = new Map<string, { points: number; count: number }>();
  for (const sig of signals) {
    let pts: number | null = null;
    let bucketName = sig.category;

    if (sig.category === 'engineering_team') {
      pts = lookupTeamRolePoints(teamRoleWeights, sig.team_tier, sig.team_role_tier, stage);
      bucketName = 'engineering_team';
    } else {
      pts = lookupSignalPoints(signalWeights, sig.category, sig.tier_group, stage);
    }

    if (pts !== null && pts > 0) {
      const existing = signalCategoryTotals.get(bucketName) ?? { points: 0, count: 0 };
      existing.points += pts;
      existing.count += 1;
      signalCategoryTotals.set(bucketName, existing);
    }
  }

  for (const [cat, totals] of Array.from(signalCategoryTotals.entries())) {
    components.push({
      name: cat, category: 'bonus',
      weight: totals.points,
      raw: 1,
      points: totals.points,
      note: `${totals.count} signal(s)`,
    });
  }

  // ─── BONUS: career_slope (synthetic — reads people.title_level_slope) ───
  {
    const careerSlopeMax = signalWeights.get(`career_slope|__flat__|${stage}`) ?? 0;
    if (careerSlopeMax > 0) {
      const isRising = person.title_level_slope === 'rising';
      components.push({
        name: 'career_slope', category: 'bonus',
        weight: careerSlopeMax,
        raw: isRising ? 1.0 : 0,
        points: isRising ? careerSlopeMax : 0,
        note: `title_level_slope=${person.title_level_slope ?? 'none'}`,
      });
    }
  }

  // ─── BONUS: former_founder (synthetic — reads people.is_former_founder) ───
  {
    const formerFounderMax = signalWeights.get(`former_founder|__flat__|${stage}`) ?? 0;
    if (formerFounderMax > 0) {
      const isFormer = !!person.is_former_founder;
      components.push({
        name: 'former_founder', category: 'bonus',
        weight: formerFounderMax,
        raw: isFormer ? 1.0 : 0,
        points: isFormer ? formerFounderMax : 0,
        note: isFormer ? 'is_former_founder=true' : 'not a former founder',
      });
    }
  }

  // ─── BONUS: company_function_quality (synthetic — reads company_function_scores) ───
  {
    const cfqMax = signalWeights.get(`company_function_quality|__flat__|${stage}`) ?? 0;
    if (cfqMax > 0) {
      const fullTime = experiences.filter(e => !isInternship(e));
      const mostRecent = fullTime[0];
      let fqScore = 0;
      let fqNote = 'No function score data';

      if (mostRecent?.company_id && functionName) {
        const FUNCTION_MAP: Record<string, string> = {
          engineering: 'engineering', product: 'product', design: 'design',
          sales: 'go_to_market', marketing: 'go_to_market',
          operations: 'operations', finance: 'operations',
          customer_success: 'customer_success',
          recruiting: 'operations', people_hr: 'operations',
        };
        const mappedFn = FUNCTION_MAP[functionName] || functionName;
        const fnMatch = functionScores.find(fs =>
          fs.company_id === mostRecent.company_id && fs.function_normalized === mappedFn);

        if (fnMatch) {
          fqScore = fnMatch.function_score;
          fqNote = `${mappedFn} function score: ${fqScore}/5`;
        } else {
          const overallScore = experienceCompanyScore(mostRecent, yearScores);
          if (overallScore !== null) {
            fqScore = overallScore;
            fqNote = `No function score — fallback to overall: ${overallScore.toFixed(1)}/5`;
          }
        }
      }

      components.push({
        name: 'company_function_quality', category: 'bonus',
        weight: cfqMax,
        raw: fqScore / 5,
        points: (fqScore / 5) * cfqMax,
        note: fqNote,
      });
    }
  }

  // ─── PENALTY: short average tenure (mid/senior only) ───
  let shortTenureFired = false;
  if (coreWeights.penalty) {
    const ft = experiences.filter(e => !isInternship(e) && e.duration_months);
    const avgMonths = ft.length > 0
      ? ft.reduce((s, e) => s + (e.duration_months || 0), 0) / ft.length
      : 0;
    const { maxPoints, thresholdMonths, name } = coreWeights.penalty;
    const penaltyPts = avgMonths >= thresholdMonths
      ? 0
      : maxPoints * (1 - avgMonths / thresholdMonths);
    if (penaltyPts > 0 && avgMonths < thresholdMonths / 2) {
      shortTenureFired = true;  // flag job_hopping only when half-threshold or worse
    }
    components.push({
      name, category: 'penalty',
      weight: maxPoints,
      raw: avgMonths >= thresholdMonths ? 0 : (1 - avgMonths / thresholdMonths),
      points: -penaltyPts,
      note: `Avg tenure ${avgMonths.toFixed(1)}mo (threshold ${thresholdMonths}mo)`,
    });
  }

  // ─── Sums ───
  const coreScore = components.filter(c => c.category === 'core').reduce((s, c) => s + c.points, 0);
  const bonusScore = components.filter(c => c.category === 'bonus').reduce((s, c) => s + c.points, 0);
  const penaltyScore = components.filter(c => c.category === 'penalty').reduce((s, c) => s + c.points, 0);
  const total = coreScore + bonusScore + penaltyScore;

  // ─── Contractor-only detection (feeds flagged_reasons) ───
  const ftAndContractorExp = experiences.filter(e => !isInternship(e));
  const hasContractorOnlyHistory =
    ftAndContractorExp.length > 0 &&
    ftAndContractorExp.every(isContractorExperience);

  // ─── Bucket + flagged_reasons (new V1 model) ───
  const { bucket, flagged_reasons } = assignBucket(
    stage,
    total,
    person.highest_seniority_reached,
    hasContractorOnlyHistory,
    shortTenureFired,
    thresholds,
  );

  const overrideTag = applyRecruiting ? ' [recruiting]' : applyExecutive ? ' [executive]' : '';
  const flagSummary = flagged_reasons.length > 0 ? ` flags=[${flagged_reasons.join(',')}]` : '';
  const reasoning = `${stage.replace('_', ' ')} (${years ?? '?'}y) core=${coreScore.toFixed(1)} bonus=${bonusScore.toFixed(1)} penalty=${penaltyScore.toFixed(1)} → ${Math.round(total * 100) / 100}/${bucket}${overrideTag}${flagSummary}`;

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
    flagged_reasons,
    career_progression: (person.career_progression as CareerProgression) ?? null,
    highest_seniority_reached: person.highest_seniority_reached,
    has_early_stage_experience: person.has_early_stage_experience,
    has_hypergrowth_experience: person.has_hypergrowth_experience,
    is_current_founder: !!person.is_current_founder,
    is_former_founder: !!person.is_former_founder,
    reasoning,
  };
}

// ─── Write bucket assignment back to DB ───────────────────────────────────

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
  is_current_founder: boolean
  is_former_founder: boolean
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
    is_current_founder: result.is_current_founder,
    is_former_founder: result.is_former_founder,
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
      flagged_reasons: result.flagged_reasons,
      assigned_by: 'system',
      assignment_reason: result.reasoning,
      score_breakdown: buildBreakdown(result),
    });
  if (error) throw new Error(`Failed to write bucket: ${error.message}`);
}
