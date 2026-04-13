// app/api/ingest/route.ts
// Vetted Ingest API — Phase 1
//
// Receives LinkedIn scrape payloads from the Chrome extension.
// 1. Writes raw snapshot (existing behavior — PRESERVED)
// 2. Upserts normalized people + companies + experiences + education (NEW)
//
// Auth: x-ingest-secret header

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeTitle,
  normalizeDegree,
  normalizeFieldOfStudy,
  normalizeEmploymentType,
} from '@/lib/normalize';

const INGEST_SECRET = process.env.INGEST_SECRET!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ─── Types ───────────────────────────────────────────────────────────────────

interface IngestPayload {
  linkedin_url: string;
  full_name: string;
  canonical_json: CanonicalProfile;
  raw_json?: Record<string, unknown>;
}

interface CanonicalProfile {
  full_name?: string;
  location_resolved?: string | null;
  current_company?: string | null;
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

interface RawExperience {
  company_name?: string;
  title?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  duration_months?: number;
  description?: string;
  employment_type?: string;
}

interface RawEducation {
  school_name?: string;
  degree?: string;
  field_of_study?: string;
  start_year?: number;
  end_year?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Look up or create a company record.
 * Returns company_id.
 */
async function upsertCompany(supabase: SupabaseClient, companyName: string | null | undefined): Promise<string | null> {
  if (!companyName) return null;

  const name = companyName.trim();

  // Try to find existing
  const { data: existing } = await supabase
    .from('companies')
    .select('company_id')
    .ilike('company_name', name)
    .single();

  if (existing) return existing.company_id;

  // Create new (minimal record — to be enriched later)
  const { data: created, error } = await supabase
    .from('companies')
    .insert({
      company_name: name,
      company_score_mode: 'manual',
      manual_review_status: 'unreviewed',
      current_status: 'active',
    })
    .select('company_id')
    .single();

  if (error) {
    console.error('[ingest] Failed to create company:', name, error);
    return null;
  }

  return created.company_id;
}

/**
 * Look up or create a school record.
 * Returns school_id.
 */
async function upsertSchool(supabase: SupabaseClient, schoolName: string | null | undefined): Promise<string | null> {
  if (!schoolName) return null;

  const name = schoolName.trim();

  const { data: existing } = await supabase
    .from('schools')
    .select('school_id')
    .ilike('school_name', name)
    .single();

  if (existing) return existing.school_id;

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
 * Infer career stage from years of full-time experience.
 */
function inferCareerStage(yearsExperience: number | null | undefined): string | null {
  if (yearsExperience === null || yearsExperience === undefined) return null;

  if (yearsExperience <= 0) return 'pre_career';
  if (yearsExperience < 4) return 'early_career';
  if (yearsExperience < 10) return 'mid_career';
  return 'senior_career';
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth check
  const secret = req.headers.get('x-ingest-secret');
  if (secret !== INGEST_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: IngestPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!payload.linkedin_url || !payload.full_name) {
    return NextResponse.json({ error: 'linkedin_url and full_name are required' }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const canonical = payload.canonical_json || {};

  console.log('[ingest] Processing:', payload.linkedin_url);

  // ── Step 1: Existing ingest path (PRESERVED) ────────────────────────────
  // This calls the existing upsert_profile_from_snapshot function.
  // Do NOT modify this behavior.

  const { error: legacyError } = await supabase.rpc('upsert_profile_from_snapshot', {
    p_linkedin_url: payload.linkedin_url,
    p_full_name: payload.full_name,
    p_canonical_json: canonical,
    p_raw_json: payload.raw_json || canonical,
  });

  if (legacyError) {
    console.error('[ingest] Legacy upsert failed:', legacyError);
    // Don't hard-fail — continue to normalized path
  }

  // ── Step 2: Normalize company ────────────────────────────────────────────
  const currentCompanyId = await upsertCompany(supabase, canonical.current_company);

  // ── Step 3: Normalize current title ─────────────────────────────────────
  const titleData = await normalizeTitle(supabase, canonical.current_title);

  // ── Step 4: Upsert person ────────────────────────────────────────────────
  const careerStage = inferCareerStage(canonical.years_experience);

  const personRecord = {
    full_name: payload.full_name,
    linkedin_url: payload.linkedin_url,
    location_name: canonical.location_resolved || null,
    current_company_id: currentCompanyId,
    current_title_raw: canonical.current_title || null,
    current_title_normalized: titleData?.title_normalized || null,
    current_function_normalized: titleData?.function_normalized || null,
    years_experience_estimate: canonical.years_experience || null,
    career_stage_assigned: careerStage,
    updated_at: new Date().toISOString(),
  };

  const { data: person, error: personError } = await supabase
    .from('people')
    .upsert(personRecord, { onConflict: 'linkedin_url' })
    .select('person_id')
    .single();

  if (personError || !person) {
    console.error('[ingest] Person upsert failed:', personError);
    return NextResponse.json({
      success: false,
      message: 'Failed to upsert person',
      legacy_ok: !legacyError,
    }, { status: 500 });
  }

  const personId = person.person_id;

  // ── Step 5: Clear old experiences + education before re-inserting ────────
  // Each scrape sends the full profile, so we replace rather than accumulate.
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
  const experiences = canonical.experiences || [];

  for (const exp of experiences) {
    if (!exp.company_name && !exp.title) continue;

    const expCompanyId = await upsertCompany(supabase, exp.company_name);
    const expTitleData = await normalizeTitle(supabase, exp.title);

    // Resolve employment type: title dictionary hint > raw type lookup > unknown
    const empFromTitle = expTitleData?.employment_hint;
    const empFromRaw = empFromTitle
      ? null
      : (await normalizeEmploymentType(supabase, exp.employment_type)).employment_type_normalized;
    const employmentType = empFromTitle || empFromRaw || 'unknown';

    const expRecord = {
      person_id: personId,
      company_id: expCompanyId,
      title_raw: exp.title || null,
      title_normalized: expTitleData?.title_normalized || null,
      function_normalized: expTitleData?.function_normalized || null,
      specialty_normalized: expTitleData?.specialty_normalized || null,
      seniority_normalized: expTitleData?.seniority_normalized || null,
      employment_type_normalized: employmentType,
      start_date: exp.start_date || null,
      end_date: exp.end_date || null,
      is_current: exp.is_current || false,
      duration_months: exp.duration_months || null,
      description_raw: exp.description || null,
      full_time_inference_reason: expTitleData
        ? `title_dictionary_${expTitleData.match_method}`
        : 'no_match',
      full_time_inference_confidence: expTitleData?.confidence || null,
      is_full_time_role: employmentType === 'full_time',
      updated_at: new Date().toISOString(),
    };

    const { error: expError } = await supabase
      .from('person_experiences')
      .insert(expRecord);

    if (expError) {
      console.error('[ingest] Experience insert failed:', expError);
    }
  }

  // ── Step 7: Insert education ────────────────────────────────────────────
  // Collect from both flat fields and structured education array
  const educationEntries: Array<{
    school_name?: string;
    degree?: string;
    degree_level?: string;
    field_of_study?: string;
    start_year?: number;
    end_year?: number;
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

  for (const edu of educationEntries) {
    if (!edu.school_name) continue;

    const schoolId = await upsertSchool(supabase, edu.school_name);
    const degreeData = await normalizeDegree(supabase, edu.degree);
    const fieldData = await normalizeFieldOfStudy(supabase, edu.field_of_study);

    const eduRecord = {
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
      updated_at: new Date().toISOString(),
    };

    const { error: eduError } = await supabase
      .from('person_education')
      .insert(eduRecord);

    if (eduError) {
      console.error('[ingest] Education insert failed:', eduError);
    }
  }

  // ── Step 8: Create initial decision state (active) if new person ────────
  const { data: existingDecision } = await supabase
    .from('candidate_decision_state')
    .select('decision_state_id')
    .eq('person_id', personId)
    .order('effective_at', { ascending: false })
    .limit(1)
    .single();

  if (!existingDecision) {
    await supabase.from('candidate_decision_state').insert({
      person_id: personId,
      decision_state: 'active',
      source: 'system',
      reason: 'initial_ingest',
    });
  }

  console.log('[ingest] Success:', payload.linkedin_url, '| person_id:', personId);

  return NextResponse.json({
    success: true,
    person_id: personId,
    legacy_ok: !legacyError,
    message: 'Profile ingested and normalized successfully',
  });
}
