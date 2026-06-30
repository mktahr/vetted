// lib/ingest/write-canonical.ts
//
// Shared, transport-agnostic normalize-and-write core for a canonical profile —
// extracted verbatim from app/api/ingest/route.ts (PR 2b step 6a). It performs
// ingest STEPS 2–9:
//   2 company upsert → 3 current-title normalize → 4 person upsert →
//   5 clear experiences+education → 6 insert experiences (per-exp company/title/
//   seniority/specialty/employment-type/title-level) → 6b derive current role →
//   7 insert education → 7.5 recompute years/stage → 8 derived+score+bucket →
//   9 signal extraction.
//
// IT DOES NOT (these stay route/caller-owned, per the step-6 contract):
//   - construct any HTTP response
//   - touch raw_ingest_events (raw archive, dedup, status transitions)
//   - initialize candidate_decision_state
//   - perform auth / payload validation / source allowlisting
//
// FAILURE CONTRACT (preserved exactly from the route):
//   - Person upsert failure is the ONE fatal early-exit: returns { ok:false } so
//     the caller can 500 WITHOUT marking the raw event mapping_failed (the route's
//     original behavior — that early return never reached the outer catch).
//   - Experience/education insert+delete failures, years recompute, scoring, and
//     signal extraction are NON-FATAL: logged and swallowed, ingest continues.
//   - Any OTHER unexpected throw propagates to the caller (the route's outer catch
//     marks mapping_failed) — so this function intentionally does NOT wrap steps
//     2–9 in a catch-all.
//
// RETURN capture points are preserved EXACTLY (they are internally inconsistent by
// design — see step 6b — and must not be "fixed" during extraction):
//   - currentFunction  = the INITIAL current-title normalize (step 3), NOT the
//     derived role.
//   - currentSpecialty / currentTitleNormalized may be replaced by the derived role.
//   - currentSeniority is captured during the experience loop and not recomputed.
//   - currentTitleNormalized return folds the route's `?? titleData.title_normalized`
//     response fallback so callers pass it straight through.

import { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeTitle,
  normalizeDegree,
  normalizeFieldOfStudy,
  normalizeEmploymentType,
  loadSeniorityRules,
  resolveSeniorityWithDescription,
  graduationDateFromEducation,
  computeYearsExperienceEstimate,
  loadTitleLevelRules,
  extractTitleLevel,
  loadSpecialtyDictionary,
  resolveSpecialty,
} from '@/lib/normalize';
import {
  computeAndWriteDerivedFields,
  scoreCandidate,
  writeBucketAssignment,
} from '@/lib/scoring';
import { processCandidateSignals } from '@/lib/signals';

// ─── Shared ingest types (authoritative — re-exported by the route) ────────────

export const VALID_SOURCES = ['chrome_extension_voyager', 'crust_v1', 'crust_v2', 'manual_admin'] as const;
export type IngestSource = typeof VALID_SOURCES[number];

export interface IngestPayload {
  linkedin_url: string;
  full_name: string;
  canonical_json: CanonicalProfile;
  raw_json?: Record<string, unknown>;
  source?: string;
  source_version?: string;
  mapper_version?: string;
}

export interface CanonicalProfile {
  full_name?: string;
  location_resolved?: string | null;
  headline_raw?: string | null;
  summary_raw?: string | null;
  current_company?: string | null;
  current_company_linkedin_url?: string | null;
  current_company_crustdata_id?: number | null;
  current_company_professional_network_id?: string | null;
  current_title?: string | null;
  years_experience?: number | null;
  years_at_current_company?: number | null;
  undergrad_university?: string | null;
  secondary_university?: string | null;
  phd_university?: string | null;
  skills_tags?: string[] | null;
  experiences?: RawExperience[];
  education?: RawEducation[];
  [key: string]: unknown;
}

export interface RawExperience {
  company_name?: string;
  company_linkedin_url?: string;
  crustdata_company_id?: number;
  company_professional_network_id?: string;
  title?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  is_primary_current?: boolean;
  duration_months?: number;
  description?: string;
  employment_type?: string;
}

export interface RawEducation {
  school_name?: string;
  degree?: string;
  field_of_study?: string;
  start_year?: number;
  end_year?: number;
  description?: string;
  activities?: string;
  grade?: string;
}

// Person-write identity mode (step 6b).
//   'candidate'       — today's exact upsert(onConflict:'linkedin_url') with NO
//                       record_kind written. Byte-identical to the pre-6b path.
//   'network_insert'  — INSERT a NEW person with record_kind='network_connection'.
//                       Used by the network-projection path ONLY when the caller has
//                       already confirmed no existing person matches (resolve-first).
//                       On a UNIQUE(linkedin_url) race (a concurrent candidate ingest
//                       won), returns { ok:false, reason:'person_exists', personId }
//                       so the caller can fall back to link+promote instead of
//                       overwriting the candidate's data.
export type PersonIdentity = { mode: 'candidate' } | { mode: 'network_insert' };

export interface WriteCanonicalOpts {
  // Run derived-fields + scoreCandidate + writeBucketAssignment (step 8). Default true.
  score?: boolean;
  // Person-write identity. Default { mode: 'candidate' } — unchanged ingest path.
  identity?: PersonIdentity;
}

export type WriteCanonicalResult =
  | { ok: false; reason: 'person_upsert_failed' }
  | { ok: false; reason: 'person_exists'; personId: string }
  | {
      ok: true;
      personId: string;
      bucket: string | null;
      totalScore: number | null;
      currentFunction: string | null;
      currentSpecialty: string | null;
      currentSeniority: string | null;
      currentTitleNormalized: string | null;
    };

// ─── Helpers (moved verbatim from the ingest route) ────────────────────────────

interface UpsertCompanyInput {
  name: string | null | undefined;
  linkedin_url?: string | null;
  crustdata_company_id?: number | null;
  professional_network_id?: string | null;
}

/**
 * Look up or create a company record. Match priority: crustdata_company_id →
 * linkedin_url → case-insensitive name. Backfills missing identity columns on a
 * match (never overwrites non-null). New rows land review_status='unreviewed' /
 * tagging_method=NULL for the cron to tag.
 */
export async function upsertCompany(
  supabase: SupabaseClient,
  input: UpsertCompanyInput,
): Promise<string | null> {
  const name = input.name?.trim();
  if (!name) return null;
  const linkedinUrl = input.linkedin_url?.trim() || null;
  const crustId = input.crustdata_company_id ?? null;
  const pnId = input.professional_network_id ?? null;

  // 1. Match by crustdata_company_id (canonical) when available.
  if (crustId !== null) {
    const { data: byCrust } = await supabase
      .from('companies')
      .select('company_id, linkedin_url, professional_network_id')
      .eq('crustdata_company_id', crustId)
      .maybeSingle();
    if (byCrust) {
      const updates: Record<string, unknown> = {};
      if (linkedinUrl && !byCrust.linkedin_url) updates.linkedin_url = linkedinUrl;
      if (pnId && !byCrust.professional_network_id) updates.professional_network_id = pnId;
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        await supabase.from('companies').update(updates).eq('company_id', byCrust.company_id);
      }
      return byCrust.company_id;
    }
  }

  // 2. Match by linkedin_url.
  if (linkedinUrl) {
    const { data: byUrl } = await supabase
      .from('companies')
      .select('company_id, crustdata_company_id, professional_network_id')
      .eq('linkedin_url', linkedinUrl)
      .maybeSingle();
    if (byUrl) {
      const updates: Record<string, unknown> = {};
      if (crustId !== null && !byUrl.crustdata_company_id) updates.crustdata_company_id = crustId;
      if (pnId && !byUrl.professional_network_id) updates.professional_network_id = pnId;
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        await supabase.from('companies').update(updates).eq('company_id', byUrl.company_id);
      }
      return byUrl.company_id;
    }
  }

  // 3. Fall back to case-insensitive name match.
  const { data: byName } = await supabase
    .from('companies')
    .select('company_id, linkedin_url, crustdata_company_id, professional_network_id')
    .ilike('company_name', name)
    .maybeSingle();

  if (byName) {
    const updates: Record<string, unknown> = {};
    if (linkedinUrl && !byName.linkedin_url) updates.linkedin_url = linkedinUrl;
    if (crustId !== null && !byName.crustdata_company_id) updates.crustdata_company_id = crustId;
    if (pnId && !byName.professional_network_id) updates.professional_network_id = pnId;
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      await supabase.from('companies').update(updates).eq('company_id', byName.company_id);
    }
    return byName.company_id;
  }

  // 4. Insert new stub.
  const { data: created, error } = await supabase
    .from('companies')
    .insert({
      company_name: name,
      linkedin_url: linkedinUrl,
      crustdata_company_id: crustId,
      professional_network_id: pnId,
      company_score_mode: 'manual',
      review_status: 'unreviewed',
      current_status: 'active',
    })
    .select('company_id')
    .single();

  if (error) {
    // Race: concurrent insert tripped a UNIQUE constraint. Re-resolve and return.
    if ((error as { code?: string }).code === '23505') {
      if (crustId !== null) {
        const { data } = await supabase
          .from('companies')
          .select('company_id')
          .eq('crustdata_company_id', crustId)
          .maybeSingle();
        if (data) return data.company_id;
      }
      if (linkedinUrl) {
        const { data } = await supabase
          .from('companies')
          .select('company_id')
          .eq('linkedin_url', linkedinUrl)
          .maybeSingle();
        if (data) return data.company_id;
      }
      const { data } = await supabase
        .from('companies')
        .select('company_id')
        .ilike('company_name', name)
        .maybeSingle();
      if (data) return data.company_id;
    }
    console.error('[ingest] Failed to create company:', name, error);
    return null;
  }

  return created.company_id;
}

/** Look up or create a school record. Returns school_id. */
export async function upsertSchool(supabase: SupabaseClient, schoolName: string | null | undefined): Promise<string | null> {
  if (!schoolName) return null;

  const name = schoolName.trim();

  const { data: existing } = await supabase
    .from('schools')
    .select('school_id')
    .ilike('school_name', name)
    .single();

  if (existing) return existing.school_id;

  const { data: alias } = await supabase
    .from('school_aliases')
    .select('school_id')
    .ilike('alias_name', name)
    .single();

  if (alias) return alias.school_id;

  const { data: created, error } = await supabase
    .from('schools')
    .insert({ school_name: name })
    .select('school_id')
    .single();

  if (error) {
    console.error('[ingest] Failed to create school:', name, error);
    return null;
  }

  return created.school_id;
}

/**
 * Infer career stage from years of full-time experience. Canonical scoring-engine
 * boundaries (0.5/2/5) so the value here matches scoreCandidate() later.
 */
export function inferCareerStage(yearsExperience: number | null | undefined): string | null {
  if (yearsExperience === null || yearsExperience === undefined) return null;

  if (yearsExperience < 0.5) return 'pre_career';
  if (yearsExperience < 2) return 'early_career';
  if (yearsExperience < 5) return 'mid_career';
  return 'senior_career';
}

/** Parse "Jan 2020" / "2020" / "YYYY-MM-DD" into YYYY-MM-DD; null if unparseable. */
export function toDateString(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const months: Record<string, string> = {
    jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
    jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
  };

  const monthYear = s.match(/^(\w+)\s+(\d{4})$/i);
  if (monthYear) {
    const m = months[monthYear[1].slice(0, 3).toLowerCase()];
    if (m) return `${monthYear[2]}-${m}-01`;
  }

  if (/^\d{4}$/.test(s)) return `${s}-01-01`;

  return null;
}

// ─── The core: steps 2–9 ───────────────────────────────────────────────────────

export async function writeCanonicalProfile(
  supabase: SupabaseClient,
  payload: IngestPayload,
  opts: WriteCanonicalOpts = {},
): Promise<WriteCanonicalResult> {
  const { score = true } = opts;
  const identity = opts.identity ?? { mode: 'candidate' };
  const canonical = payload.canonical_json || {};
  const source = payload.source ?? null;
  const ingestTimestamp = new Date().toISOString();

  // ── Step 2: Normalize company ────────────────────────────────────────────
  const currentCompanyId = await upsertCompany(supabase, {
    name: canonical.current_company,
    linkedin_url: canonical.current_company_linkedin_url,
    crustdata_company_id: canonical.current_company_crustdata_id,
    professional_network_id: canonical.current_company_professional_network_id,
  });

  // ── Step 3: Normalize current title ─────────────────────────────────────
  const titleData = await normalizeTitle(supabase, canonical.current_title);

  // ── Step 4: Upsert person ────────────────────────────────────────────────
  const careerStage = inferCareerStage(canonical.years_experience);

  const personRecord = {
    full_name: payload.full_name,
    linkedin_url: payload.linkedin_url,
    location_name: canonical.location_resolved || null,
    headline_raw: canonical.headline_raw || null,
    summary_raw: canonical.summary_raw || null,
    current_company_id: currentCompanyId,
    current_title_raw: canonical.current_title || null,
    current_title_normalized: titleData?.title_normalized || null,
    current_function_normalized: titleData?.function_normalized || null,
    years_experience_estimate: canonical.years_experience || null,
    career_stage_assigned: careerStage,
    last_ingest_source: source,
    last_ingest_at: ingestTimestamp,
    last_mapper_version: payload.mapper_version || null,
    updated_at: ingestTimestamp,
  };

  let personId: string;
  if (identity.mode === 'network_insert') {
    // NEW network-connection person. INSERT (not upsert) with record_kind set —
    // the caller (projectConnection) has already confirmed no existing match.
    const { data: inserted, error: insertError } = await supabase
      .from('people')
      .insert({ ...personRecord, record_kind: 'network_connection' })
      .select('person_id')
      .single();

    if (insertError || !inserted) {
      // UNIQUE(linkedin_url) race: a concurrent candidate ingest created this person
      // mid-flight. Re-resolve and signal the caller to link+promote rather than
      // overwrite the candidate's data.
      if ((insertError as { code?: string } | null)?.code === '23505') {
        const { data: existing } = await supabase
          .from('people')
          .select('person_id')
          .eq('linkedin_url', payload.linkedin_url)
          .maybeSingle();
        if (existing) return { ok: false, reason: 'person_exists', personId: existing.person_id };
      }
      console.error('[network-project] Person insert failed:', insertError);
      return { ok: false, reason: 'person_upsert_failed' };
    }
    personId = inserted.person_id;
  } else {
    // Candidate path — upsert by linkedin_url, no record_kind (deliberate: writing
    // it would demote a promoted/linked connection on re-ingest). BUT establish
    // NATIVE provenance by clearing promoted_from_connection: a candidate ingest of
    // a person who was previously a promoted connection ('both', flag=true) makes
    // them a real candidate, so a later force-out must NOT demote them. Without this
    // the flag lingers and the demote guard would treat them as connection-origin
    // (Codex critical finding — the deferred candidate-ingest→both edge).
    const { data: person, error: personError } = await supabase
      .from('people')
      .upsert({ ...personRecord, promoted_from_connection: false }, { onConflict: 'linkedin_url' })
      .select('person_id')
      .single();

    if (personError || !person) {
      console.error('[ingest] Person upsert failed:', personError);
      return { ok: false, reason: 'person_upsert_failed' };
    }
    personId = person.person_id;
  }

  // ── Step 5: Clear old experiences + education before re-inserting ────────
  const { error: delExpError } = await supabase
    .from('person_experiences')
    .delete()
    .eq('person_id', personId);

  if (delExpError) {
    console.error('[ingest] Failed to clear old experiences:', delExpError);
  }

  const { error: delEduError } = await supabase
    .from('person_education')
    .delete()
    .eq('person_id', personId);

  if (delEduError) {
    console.error('[ingest] Failed to clear old education:', delEduError);
  }

  // ── Step 6: Insert experiences ──────────────────────────────────────────
  const seniorityRules = await loadSeniorityRules(supabase);
  const titleLevelRules = await loadTitleLevelRules(supabase);
  const specialtyEntries = await loadSpecialtyDictionary(supabase);
  const personGradDate = graduationDateFromEducation(canonical.education || []);
  const rawExperiences = canonical.experiences || [];
  const seenExpKeys = new Set<string>();
  const experiences = rawExperiences.filter(exp => {
    const key = `${(exp.company_name || '').toLowerCase()}|${(exp.title || '').toLowerCase()}|${exp.start_date || ''}|${exp.end_date || ''}`;
    if (seenExpKeys.has(key)) return false;
    seenExpKeys.add(key);
    return true;
  });

  let currentSpecialty: string | null = null;
  let currentSeniority: string | null = null;
  let currentTitleNormalized: string | null = null;

  for (const exp of experiences) {
    if (!exp.company_name && !exp.title) continue;

    const expCompanyId = await upsertCompany(supabase, {
      name: exp.company_name,
      linkedin_url: exp.company_linkedin_url,
      crustdata_company_id: exp.crustdata_company_id,
      professional_network_id: exp.company_professional_network_id,
    });
    const expTitleData = await normalizeTitle(supabase, exp.title);

    const empFromTitle = expTitleData?.employment_hint;
    const empFromRaw = empFromTitle
      ? null
      : (await normalizeEmploymentType(supabase, exp.employment_type)).employment_type_normalized;
    const employmentType = empFromTitle || empFromRaw || 'unknown';

    const roleStartDate = toDateString(exp.start_date);
    const seniorityResult = resolveSeniorityWithDescription(
      {
        title: exp.title,
        employment_type: employmentType,
        role_start_date: roleStartDate,
        person_graduation_date: personGradDate,
        description_raw: exp.description,
      },
      seniorityRules,
    );
    const seniority = seniorityResult.level;

    let titleLevel = extractTitleLevel(exp.title, titleLevelRules);
    if (seniorityResult.source === 'description' && titleLevel !== null) {
      const SENIORITY_TO_TITLE_LEVEL: Record<string, number> = {
        intern: 1, junior_ic: 2, individual_contributor: 3, senior_ic: 5,
        lead_ic: 6, founder: 6, manager: 9, executive: 10,
      };
      const impliedLevel = SENIORITY_TO_TITLE_LEVEL[seniority] ?? titleLevel;
      if (impliedLevel > titleLevel) titleLevel = impliedLevel;
    }

    const specialtyMatch = resolveSpecialty(
      exp.title,
      exp.description,
      canonical.skills_tags,
      specialtyEntries,
    );
    const resolvedSpecialty = specialtyMatch?.specialty_normalized
      ?? expTitleData?.specialty_normalized
      ?? null;

    const expRecord = {
      person_id: personId,
      company_id: expCompanyId,
      title_raw: exp.title || null,
      title_normalized: expTitleData?.title_normalized || null,
      function_normalized: specialtyMatch?.function_normalized || expTitleData?.function_normalized || null,
      specialty_normalized: resolvedSpecialty,
      seniority_normalized: seniority,
      seniority_source: seniorityResult.source,
      employment_type_normalized: employmentType,
      title_level: titleLevel,
      start_date: roleStartDate,
      end_date: toDateString(exp.end_date),
      is_current: exp.is_current || false,
      is_primary_current: exp.is_primary_current || false,
      duration_months: exp.duration_months || null,
      description_raw: exp.description || null,
      full_time_inference_reason: expTitleData
        ? `title_dictionary_${expTitleData.match_method}`
        : 'no_match',
      full_time_inference_confidence: expTitleData?.confidence || null,
      is_full_time_role: employmentType === 'full_time',
      last_ingest_source: source,
      last_ingest_at: ingestTimestamp,
      updated_at: ingestTimestamp,
    };

    const { error: expError } = await supabase
      .from('person_experiences')
      .insert(expRecord);

    if (expError) {
      console.error('[ingest] Experience insert failed:', expError);
    }

    if (exp.is_current && !currentSpecialty && !currentSeniority) {
      currentSpecialty = resolvedSpecialty;
      currentSeniority = seniority;
      currentTitleNormalized = expTitleData?.title_normalized || null;
    }
  }

  // If no explicit is_current was found, fall back to the first experience
  if (!currentSpecialty && !currentSeniority && experiences.length > 0) {
    const first = experiences[0];
    if (first.company_name || first.title) {
      const firstTitleData = await normalizeTitle(supabase, first.title);
      const firstSpec = resolveSpecialty(first.title, first.description, canonical.skills_tags, specialtyEntries);
      currentSpecialty = firstSpec?.specialty_normalized ?? firstTitleData?.specialty_normalized ?? null;
      currentTitleNormalized = firstTitleData?.title_normalized || null;
    }
  }

  // ── Step 6b: Derive current role from inserted experiences ─────────────
  {
    const { data: currentExps } = await supabase
      .from('person_experiences')
      .select('title_raw, company_id, start_date, is_primary_current')
      .eq('person_id', personId)
      .eq('is_current', true)
      .order('start_date', { ascending: false });

    if (currentExps && currentExps.length > 0) {
      const isStudentTitle = (t: string | null) =>
        !!t && /\bintern\b|\binternship\b|\bco-?op\b|\bstudent\b/i.test(t);

      const bestCurrent = currentExps.find(e => e.is_primary_current === true)
        ?? currentExps.find(e => e.title_raw && !isStudentTitle(e.title_raw))
        ?? currentExps.find(e => !isStudentTitle(e.title_raw))
        ?? currentExps.find(e => e.title_raw)
        ?? currentExps[0];

      const derivedTitleRaw = bestCurrent.title_raw || canonical.current_title || null;
      const derivedTitleData = await normalizeTitle(supabase, derivedTitleRaw);

      await supabase.from('people').update({
        current_title_raw: derivedTitleRaw,
        current_title_normalized: derivedTitleData?.title_normalized || null,
        current_function_normalized: derivedTitleData?.function_normalized || null,
        current_company_id: bestCurrent.company_id || currentCompanyId || null,
      }).eq('person_id', personId);

      if (bestCurrent.title_raw) {
        currentTitleNormalized = derivedTitleData?.title_normalized || currentTitleNormalized;
        const derivedSpec = resolveSpecialty(bestCurrent.title_raw, null, canonical.skills_tags, specialtyEntries);
        if (derivedSpec) currentSpecialty = derivedSpec.specialty_normalized;
      }
    }
  }

  // ── Step 7: Insert education ────────────────────────────────────────────
  const educationEntries: Array<{
    school_name?: string;
    degree?: string;
    degree_level?: string;
    field_of_study?: string;
    start_year?: number;
    end_year?: number;
    description?: string;
    activities?: string;
    grade?: string;
  }> = [];

  if (canonical.undergrad_university) {
    educationEntries.push({
      school_name: canonical.undergrad_university,
      degree: 'Bachelor',
      degree_level: 'bachelor',
    });
  }
  if (canonical.secondary_university) {
    educationEntries.push({
      school_name: canonical.secondary_university,
      degree: "Master's",
      degree_level: 'master',
    });
  }
  if (canonical.phd_university) {
    educationEntries.push({
      school_name: canonical.phd_university,
      degree: 'PhD',
      degree_level: 'phd',
    });
  }

  const structuredEdu = canonical.education || [];
  for (const edu of structuredEdu) {
    educationEntries.push(edu);
  }

  const seenEduKeys = new Set<string>();
  const dedupedEducation = educationEntries.filter(edu => {
    if (!edu.school_name) return true;
    const key = `${edu.school_name.toLowerCase()}|${(edu.degree || '').toLowerCase()}|${edu.start_year ?? ''}|${edu.end_year ?? ''}`;
    if (seenEduKeys.has(key)) return false;
    seenEduKeys.add(key);
    return true;
  });

  for (const edu of dedupedEducation) {
    if (!edu.school_name) continue;

    const schoolId = await upsertSchool(supabase, edu.school_name);
    const degreeData = await normalizeDegree(supabase, edu.degree);
    const fieldData = await normalizeFieldOfStudy(supabase, edu.field_of_study);

    const eduRecord: Record<string, unknown> = {
      person_id: personId,
      school_id: schoolId,
      school_name_raw: edu.school_name,
      degree_raw: edu.degree || null,
      degree_normalized: degreeData?.degree_normalized || null,
      degree_level: degreeData?.degree_level || edu.degree_level || null,
      field_of_study_raw: edu.field_of_study || null,
      field_of_study_normalized: fieldData?.field_of_study_normalized || null,
      start_year: edu.start_year || null,
      end_year: edu.end_year || null,
      is_verified_degree: false,
      is_coursework_only: degreeData?.is_coursework || false,
      is_certificate_only: degreeData?.is_certificate || false,
      last_ingest_source: source,
      last_ingest_at: ingestTimestamp,
      updated_at: ingestTimestamp,
    };

    if (edu.description && edu.description.trim()) eduRecord.description_raw = edu.description.trim();
    if (edu.activities && edu.activities.trim()) eduRecord.activities_raw = edu.activities.trim();
    if (edu.grade && edu.grade.trim()) eduRecord.grade_raw = edu.grade.trim();

    const { error: eduError } = await supabase
      .from('person_education')
      .insert(eduRecord);

    if (eduError) {
      console.error('[ingest] Education insert failed:', eduError);
    }
  }

  // ── Step 7.5: Recompute years_experience_estimate server-side ──────────
  try {
    const { data: refreshedExps } = await supabase
      .from('person_experiences')
      .select('title_raw, start_date, end_date, is_current, seniority_normalized, employment_type_normalized')
      .eq('person_id', personId);
    const { data: refreshedEdus } = await supabase
      .from('person_education')
      .select('start_year, end_year, degree_raw, degree_normalized, degree_level')
      .eq('person_id', personId);
    const recomputedYears = computeYearsExperienceEstimate(refreshedExps || [], refreshedEdus || []);
    const recomputedStage = inferCareerStage(recomputedYears);
    const { error: yearsErr } = await supabase
      .from('people')
      .update({
        years_experience_estimate: recomputedYears,
        career_stage_assigned: recomputedStage,
      })
      .eq('person_id', personId);
    if (yearsErr) console.error('[ingest] Years recompute update failed:', yearsErr);
  } catch (yrsErr) {
    console.error('[ingest] Years recompute failed (non-fatal):', yrsErr);
  }

  // ── Step 8: Score candidate + assign bucket ────────────────────────────
  let bucket: string | null = null;
  let totalScore: number | null = null;
  if (score) {
    try {
      await computeAndWriteDerivedFields(supabase, personId);
      const scoreResult = await scoreCandidate(supabase, personId);
      await writeBucketAssignment(supabase, scoreResult);
      bucket = scoreResult.bucket;
      totalScore = scoreResult.total_score;
      console.log('[ingest] Scored:', payload.linkedin_url, `→ ${bucket} (${totalScore})`);
    } catch (scoreErr) {
      console.error('[ingest] Scoring failed (non-fatal):', scoreErr);
    }
  }

  // ── Step 9: Extract signals from text fields ────────────────────────────
  try {
    const signalResult = await processCandidateSignals(supabase, personId);
    if (signalResult.signals_written > 0) {
      console.log('[ingest] Signals extracted:', payload.linkedin_url, `→ ${signalResult.signals_written} new`);
    }
  } catch (signalErr) {
    console.error('[ingest] Signal extraction failed (non-fatal):', signalErr);
  }

  return {
    ok: true,
    personId,
    bucket,
    totalScore,
    currentFunction: titleData?.function_normalized ?? null,
    currentSpecialty,
    currentSeniority,
    currentTitleNormalized: currentTitleNormalized ?? titleData?.title_normalized ?? null,
  };
}
