// app/api/ingest/route.ts
// Vetted Ingest API — Phase 1
//
// Receives LinkedIn scrape payloads from the Chrome extension.
// 1. Writes raw snapshot (existing behavior — PRESERVED)
// 2. Upserts normalized people + companies + experiences + education (NEW)
//
// Auth: x-ingest-secret header

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
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

const INGEST_SECRET = process.env.INGEST_SECRET!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ─── Types ───────────────────────────────────────────────────────────────────

const VALID_SOURCES = ['chrome_extension_voyager', 'crust_v1', 'crust_v2', 'manual_admin'] as const;
type IngestSource = typeof VALID_SOURCES[number];

interface IngestPayload {
  linkedin_url: string;
  full_name: string;
  canonical_json: CanonicalProfile;
  raw_json?: Record<string, unknown>;
  source?: string;
  source_version?: string;
  mapper_version?: string;
}

interface CanonicalProfile {
  full_name?: string;
  location_resolved?: string | null;
  headline_raw?: string | null;
  summary_raw?: string | null;
  current_company?: string | null;
  current_company_linkedin_url?: string | null;
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
  // Canonical company LinkedIn URL — populated by crust-v2 mapper (>=1.1.0).
  // When present, upsertCompany() uses it as the canonical match key,
  // backfilling companies.linkedin_url on existing rows that lack it.
  // Chrome extension + legacy v1 mapper leave this undefined.
  company_linkedin_url?: string;
  title?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  is_primary_current?: boolean;  // Crust v2 only: from is_default flag
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
  description?: string;
  activities?: string;
  grade?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface UpsertCompanyInput {
  name: string | null | undefined;
  linkedin_url?: string | null;
}

/**
 * Look up or create a company record.
 *
 * Match priority:
 *   1. companies.linkedin_url exact match (canonical identity, when available)
 *   2. companies.company_name case-insensitive ILIKE (legacy fallback)
 *
 * On match, this performs a *real* upsert: any null/empty columns we have new
 * data for get backfilled; non-null columns are NEVER overwritten so admin-
 * curated values win. Today the only enrichable field is linkedin_url; the
 * structure is forward-compatible with website_url / industry / founding_year
 * once the company-enrichment task lands.
 *
 * Auto-created rows always land as focus='unreviewed' / manual_review_status=
 * 'unreviewed' — preserving the existing tier-tagging convention so admin
 * triage queues still work.
 */
async function upsertCompany(
  supabase: SupabaseClient,
  input: UpsertCompanyInput,
): Promise<string | null> {
  const name = input.name?.trim();
  if (!name) return null;
  const linkedinUrl = input.linkedin_url?.trim() || null;

  // 1. Match by linkedin_url first when available — most reliable identity.
  if (linkedinUrl) {
    const { data: byUrl } = await supabase
      .from('companies')
      .select('company_id')
      .eq('linkedin_url', linkedinUrl)
      .maybeSingle();
    if (byUrl) return byUrl.company_id;
  }

  // 2. Fall back to case-insensitive name match.
  const { data: byName } = await supabase
    .from('companies')
    .select('company_id, linkedin_url')
    .ilike('company_name', name)
    .maybeSingle();

  if (byName) {
    // Backfill linkedin_url only if the existing row is missing it. The
    // .is('linkedin_url', null) guard makes the update atomic — if a
    // concurrent ingest just filled it, we don't overwrite.
    if (linkedinUrl && !byName.linkedin_url) {
      const { error: updateError } = await supabase
        .from('companies')
        .update({ linkedin_url: linkedinUrl, updated_at: new Date().toISOString() })
        .eq('company_id', byName.company_id)
        .is('linkedin_url', null);
      if (updateError) {
        console.error('[ingest] Failed to backfill linkedin_url:', name, updateError);
      }
    }
    return byName.company_id;
  }

  // 3. Insert new stub. focus='unreviewed' so admin triage picks it up.
  const { data: created, error } = await supabase
    .from('companies')
    .insert({
      company_name: name,
      linkedin_url: linkedinUrl,
      company_score_mode: 'manual',
      manual_review_status: 'unreviewed',
      current_status: 'active',
      focus: 'unreviewed',
    })
    .select('company_id')
    .single();

  if (error) {
    // Race: a concurrent ingest just inserted the same row, tripping the
    // linkedin_url UNIQUE constraint. Re-resolve by URL or name and return.
    if ((error as { code?: string }).code === '23505') {
      if (linkedinUrl) {
        const { data: rematched } = await supabase
          .from('companies')
          .select('company_id')
          .eq('linkedin_url', linkedinUrl)
          .maybeSingle();
        if (rematched) return rematched.company_id;
      }
      const { data: rematchedByName } = await supabase
        .from('companies')
        .select('company_id')
        .ilike('company_name', name)
        .maybeSingle();
      if (rematchedByName) return rematchedByName.company_id;
    }
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

  // 1. Direct match on school_name
  const { data: existing } = await supabase
    .from('schools')
    .select('school_id')
    .ilike('school_name', name)
    .single();

  if (existing) return existing.school_id;

  // 2. Check school_aliases before creating a new record
  // Prevents re-creating duplicates (e.g., "Harvard University" → canonical "Harvard")
  const { data: alias } = await supabase
    .from('school_aliases')
    .select('school_id')
    .ilike('alias_name', name)
    .single();

  if (alias) return alias.school_id;

  // 3. No match — create new school record
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
 * Uses the canonical scoring-engine boundaries (0.5/2/5) so the value
 * written at ingest matches what scoreCandidate() computes later.
 */
function inferCareerStage(yearsExperience: number | null | undefined): string | null {
  if (yearsExperience === null || yearsExperience === undefined) return null;

  if (yearsExperience < 0.5) return 'pre_career';
  if (yearsExperience < 2) return 'early_career';
  if (yearsExperience < 5) return 'mid_career';
  return 'senior_career';
}

/**
 * Parse a human-readable date string (e.g. "Jan 2020", "2020") into YYYY-MM-DD.
 * Returns null if unparseable — Postgres DATE columns reject free-form text.
 */
function toDateString(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const months: Record<string, string> = {
    jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
    jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
  };

  // "Jan 2020" or "January 2020"
  const monthYear = s.match(/^(\w+)\s+(\d{4})$/i);
  if (monthYear) {
    const m = months[monthYear[1].slice(0, 3).toLowerCase()];
    if (m) return `${monthYear[2]}-${m}-01`;
  }

  // Just "2020"
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;

  return null;
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

  if (!payload.source || !VALID_SOURCES.includes(payload.source as IngestSource)) {
    return NextResponse.json({
      error: `source is required and must be one of: ${VALID_SOURCES.join(', ')}`,
    }, { status: 400 });
  }
  const source = payload.source as IngestSource;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[ingest] Missing SUPABASE env vars');
    return NextResponse.json({
      success: false,
      message: 'Server misconfiguration: missing database credentials',
    }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const canonical = payload.canonical_json || {};

  console.log('[ingest] Processing:', payload.linkedin_url, `(source=${source})`);

  // ── Step 0: Archive raw payload ──────────────────────────────────────────
  // Non-negotiable: if this fails, abort the entire ingest.
  const rawPayload = payload.raw_json || payload.canonical_json || {};
  const payloadJson = JSON.stringify(rawPayload);
  const payloadHash = createHash('sha256').update(payloadJson).digest('hex');

  // Dedup: skip if same linkedin_url + same payload hash within 24h
  const { data: existingRaw } = await supabase
    .from('raw_ingest_events')
    .select('id')
    .eq('linkedin_url', payload.linkedin_url)
    .eq('payload_hash', payloadHash)
    .gte('fetched_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1)
    .maybeSingle();

  if (existingRaw) {
    console.log('[ingest] Duplicate payload, skipping:', payload.linkedin_url);
    return NextResponse.json({
      success: true,
      skipped: true,
      message: 'Duplicate payload within 24h window, skipped',
    });
  }

  const { data: rawEvent, error: rawError } = await supabase
    .from('raw_ingest_events')
    .insert({
      linkedin_url: payload.linkedin_url,
      source,
      source_version: payload.source_version || null,
      mapper_version: payload.mapper_version || null,
      payload: rawPayload,
      payload_hash: payloadHash,
      processing_status: 'pending',
    })
    .select('id')
    .single();

  if (rawError || !rawEvent) {
    console.error('[ingest] Raw archive write failed — aborting:', rawError);
    return NextResponse.json({
      success: false,
      message: 'Failed to archive raw payload',
    }, { status: 500 });
  }

  const rawEventId = rawEvent.id;
  const ingestTimestamp = new Date().toISOString();

  try {

  // ── Step 2: Normalize company ────────────────────────────────────────────
  const currentCompanyId = await upsertCompany(supabase, {
    name: canonical.current_company,
    linkedin_url: canonical.current_company_linkedin_url,
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
  // Load rules once per ingest to avoid N+1 queries across experiences.
  const seniorityRules = await loadSeniorityRules(supabase);
  const titleLevelRules = await loadTitleLevelRules(supabase);
  const specialtyEntries = await loadSpecialtyDictionary(supabase);
  const personGradDate = graduationDateFromEducation(canonical.education || []);
  // Safety-net dedup: remove duplicate experiences within the canonical payload
  // regardless of data source (Crust, extension, generic mapper).
  const rawExperiences = canonical.experiences || [];
  const seenExpKeys = new Set<string>();
  const experiences = rawExperiences.filter(exp => {
    const key = `${(exp.company_name || '').toLowerCase()}|${(exp.title || '').toLowerCase()}|${exp.start_date || ''}|${exp.end_date || ''}`;
    if (seenExpKeys.has(key)) return false;
    seenExpKeys.add(key);
    return true;
  });

  // Capture the current role's normalized values to return to the client
  // so the extension popup can pre-populate editable tags.
  let currentSpecialty: string | null = null;
  let currentSeniority: string | null = null;
  let currentTitleNormalized: string | null = null;

  for (const exp of experiences) {
    if (!exp.company_name && !exp.title) continue;

    const expCompanyId = await upsertCompany(supabase, {
      name: exp.company_name,
      linkedin_url: exp.company_linkedin_url,
    });
    const expTitleData = await normalizeTitle(supabase, exp.title);

    // Resolve employment type: title dictionary hint > raw type lookup > unknown
    const empFromTitle = expTitleData?.employment_hint;
    const empFromRaw = empFromTitle
      ? null
      : (await normalizeEmploymentType(supabase, exp.employment_type)).employment_type_normalized;
    const employmentType = empFromTitle || empFromRaw || 'unknown';

    // Resolve seniority: title first, then description scan if title is ambiguous.
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
    // When description upgrades seniority beyond what the title implied,
    // also upgrade title_level so slope calculations reflect the real level.
    if (seniorityResult.source === 'description' && titleLevel !== null) {
      const SENIORITY_TO_TITLE_LEVEL: Record<string, number> = {
        intern: 1, entry: 2, individual_contributor: 3, senior_ic: 5,
        lead_ic: 6, founder: 6, manager: 9, executive: 10,
      };
      const impliedLevel = SENIORITY_TO_TITLE_LEVEL[seniority] ?? titleLevel;
      if (impliedLevel > titleLevel) titleLevel = impliedLevel;
    }

    // Specialty: prefer specialty_dictionary (richer patterns) over title_dictionary
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

    // Capture current role's normalized tags for the API response
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
  // Don't trust canonical.current_company/current_title — derive from
  // the actual is_current=true experiences.
  //
  // Selection priority:
  //   1. is_primary_current=true (from Crust v2's is_default flag) — highest signal
  //   2. Non-student-titled role with latest start_date
  //   3. Any non-student-titled role
  //   4. Any role with a title
  //   5. First role
  //
  // Backlog: isStudentTitle below only checks the title regex. Stale
  // "current" internships from Crust may have non-student-style titles
  // and slip through this filter. Cross-check employment_type='internship'
  // when that signal becomes available in v2 responses.
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

      // 1. Crust v2's is_default flag wins outright if set
      // 2-5. Existing heuristic fallback
      const bestCurrent = currentExps.find(e => e.is_primary_current === true)
        ?? currentExps.find(e => e.title_raw && !isStudentTitle(e.title_raw))
        ?? currentExps.find(e => !isStudentTitle(e.title_raw))
        ?? currentExps.find(e => e.title_raw)
        ?? currentExps[0];

      // If derived experience has no title_raw, keep the existing title
      const derivedTitleRaw = bestCurrent.title_raw || canonical.current_title || null;
      const derivedTitleData = await normalizeTitle(supabase, derivedTitleRaw);

      await supabase.from('people').update({
        current_title_raw: derivedTitleRaw,
        current_title_normalized: derivedTitleData?.title_normalized || null,
        current_function_normalized: derivedTitleData?.function_normalized || null,
        current_company_id: bestCurrent.company_id || currentCompanyId || null,
      }).eq('person_id', personId);

      // Update response tags to match derived role
      if (bestCurrent.title_raw) {
        currentTitleNormalized = derivedTitleData?.title_normalized || currentTitleNormalized;
        const derivedSpec = resolveSpecialty(bestCurrent.title_raw, null, canonical.skills_tags, specialtyEntries);
        if (derivedSpec) currentSpecialty = derivedSpec.specialty_normalized;
      }
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

  // Safety-net dedup for education entries
  const seenEduKeys = new Set<string>();
  const dedupedEducation = educationEntries.filter(edu => {
    if (!edu.school_name) return true; // let the skip-if-no-name check handle it
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

    // Persist education text fields when present (Chrome extension Voyager scrape)
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
  // The extension's pre-computed value (canonical.years_experience) was
  // written at upsert time as a placeholder; now that experiences and
  // education are in the DB, recompute using the canonical algorithm so
  // the value here is consistent with what backfill-seniority would set.
  // Without this, every re-scrape regresses to the extension's rougher
  // calc until the next manual backfill.
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
  // Order matters: derived fields must be written BEFORE scoreCandidate()
  // because the scoring engine reads career_progression, highest_seniority,
  // etc. from the people row. Failures here are non-fatal — a person
  // record without a score is still a valid ingest, just shows as 'Unscored'.
  let bucket: string | null = null;
  let totalScore: number | null = null;
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

  // ── Step 9: Extract signals from text fields ────────────────────────────
  // Non-fatal — signal extraction failure should not fail the ingest.
  try {
    const signalResult = await processCandidateSignals(supabase, personId);
    if (signalResult.signals_written > 0) {
      console.log('[ingest] Signals extracted:', payload.linkedin_url, `→ ${signalResult.signals_written} new`);
    }
  } catch (signalErr) {
    console.error('[ingest] Signal extraction failed (non-fatal):', signalErr);
  }

  // ── Step 10: Create initial decision state (active) if new person ───────
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

  // ── Mark raw event as successfully mapped ─────────────────────────────
  await supabase.from('raw_ingest_events').update({
    processing_status: 'mapped',
    person_id: personId,
    mapped_at: new Date().toISOString(),
  }).eq('id', rawEventId);

  console.log('[ingest] Success:', payload.linkedin_url, '| person_id:', personId);

  return NextResponse.json({
    success: true,
    person_id: personId,
    bucket,
    total_score: totalScore,
    current_function: titleData?.function_normalized ?? null,
    current_specialty: currentSpecialty,
    current_seniority: currentSeniority,
    current_title_normalized: currentTitleNormalized ?? titleData?.title_normalized ?? null,
    message: 'Profile ingested and normalized successfully',
  });

  } catch (err) {
    // Mark raw event as failed — keep the raw row for replay
    await supabase.from('raw_ingest_events').update({
      processing_status: 'mapping_failed',
      mapping_error: err instanceof Error ? err.message : 'Unknown error',
    }).eq('id', rawEventId);

    console.error('[ingest] Unhandled error:', err);
    return NextResponse.json({
      success: false,
      message: err instanceof Error ? err.message : 'Internal server error',
    }, { status: 500 });
  }
}
