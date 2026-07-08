// lib/classification/current-role.ts
// SINGLE shared derivation of a person-level "current role classification" from the
// per-experience five-axis inferred columns. Used by the candidate list, the drawer
// header, AND the scoring engine so they can never disagree (per Codex 2026-07-01).
// FLIPPED to the REAL `_inferred` columns (merge arc, 2026-07-08) — previously read
// the `_preview` twins; the preview columns are now vestigial review scaffolding.
// The primary-current role is chosen to MATCH ingest exactly
// (lib/ingest/write-canonical.ts): among is_current roles — is_primary_current,
// then non-student-titled, then any titled, then latest start.

export interface RoleForClassification {
  is_current: boolean
  is_primary_current?: boolean | null
  start_date: string | null
  end_date: string | null
  title_raw: string | null
  function_inferred?: string[] | null
  specialty_inferred?: string[] | null
  /** DETERMINISTIC career-fallback twin (code-computed, lower confidence — render muted). */
  specialty_inherited?: string[] | null
}

const isStudentTitle = (t: string | null | undefined) => /\b(student|intern|internship|co-?op|apprentice)\b/i.test(t || '');

// Display formatter for axis values: snake_case -> Title Case, with known acronyms uppercased.
// "software_engineering" -> "Software Engineering"; "ai_engineering" -> "AI Engineering";
// "ml_platform_engineering" -> "ML Platform Engineering".
const ACRONYMS = new Set(['ai','ml','api','sre','rf','gnc','fpga','asic','soc','hdl','cad','fea','dsp','pcb','ui','ux','qa','etl','llm','ros','slam','mbse','cnc','io','nlp','cv','hvac','iot','sql','gpu','cpu','vlsi','ip','os','ci','cd','ar','vr','pcba']);
export function formatAxisLabel(v: string | null | undefined): string {
  if (!v) return '';
  return v.split('_').map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

export function pickPrimaryCurrentRole<T extends RoleForClassification>(exps: T[]): T | null {
  const current = exps.filter((e) => e.is_current);
  if (current.length > 0) {
    return (
      current.find((e) => e.is_primary_current) ??
      current.find((e) => !isStudentTitle(e.title_raw)) ??
      current.find((e) => e.title_raw) ??
      current.slice().sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))[0] ??
      null
    );
  }
  // Fallback: NO role flagged is_current (e.g. every role has an end-date, ~3/113 candidates).
  // Use the MOST RECENT role (null/"present" end sorts newest, then latest end, then latest start)
  // so the summary is never blank for someone who clearly has a classification on every role.
  if (exps.length === 0) return null;
  return (
    exps
      .slice()
      .sort(
        (a, b) =>
          (b.end_date ?? '9999').localeCompare(a.end_date ?? '9999') ||
          (b.start_date ?? '').localeCompare(a.start_date ?? ''),
      )[0] ?? null
  );
}

const hasRealClassification = (e: RoleForClassification | null | undefined): boolean => {
  const f = e?.function_inferred?.[0];
  return (
    (!!f && f !== 'unknown') ||
    !!e?.specialty_inferred?.some((s) => s && s !== 'unknown') ||
    !!e?.specialty_inherited?.some((s) => s && s !== 'unknown')
  );
};

/** Current-role function + specialties from the inferred axes. `unknown`/abstentions are dropped.
 *  DEFAULT (display) mode: if the primary-current role itself is unknown/empty (e.g. a joke
 *  title like "Robot Whisperer", or an empty-description role), fall back to the MOST RECENT
 *  role that has a real classification — a person's DISPLAYED function/specialty should come
 *  from their career, not a novelty current title.
 *  STRICT mode ({ strictCurrent: true }) skips that fallback and reads ONLY the primary-current
 *  role. Scoring and the "currently"-scope filter predicates MUST use strict (Codex round-2
 *  catch, merge arc 2026-07-08): the display fallback would otherwise (a) override the scoring
 *  engine's legacy-function fallback — e.g. a current recruiter with an old classified SWE role
 *  would score as software instead of recruiting — and (b) make "currently X" match a past role
 *  while wrongly excluding it from "previously X". Sparse-but-real current roles still surface
 *  their career specialty in strict mode via specialty_inherited — the deterministic layer
 *  already encodes exactly when inheritance is justified.
 *  `specs` = EVIDENCED (LLM); `inheritedSpecs` = deterministic career-fallback (code) — render
 *  muted/outlined. NOTE: no aggressive fall-through when the picked role has a function but no
 *  specialty — an empty specialty on a genuinely-unclear role is CORRECT (conservative by design). */
export function currentRoleClassification(
  exps: RoleForClassification[],
  opts?: { strictCurrent?: boolean },
): { fn: string | null; specs: string[]; inheritedSpecs: string[] } {
  let pick = pickPrimaryCurrentRole(exps);
  if (!opts?.strictCurrent && !hasRealClassification(pick)) {
    const classified = exps
      .slice()
      .sort((a, b) => (b.end_date ?? '9999').localeCompare(a.end_date ?? '9999') || (b.start_date ?? '').localeCompare(a.start_date ?? ''))
      .find(hasRealClassification);
    if (classified) pick = classified;
  }
  if (!pick) return { fn: null, specs: [], inheritedSpecs: [] };
  const fnRaw = pick.function_inferred?.[0] ?? null;
  const fn = !fnRaw || fnRaw === 'unknown' ? null : fnRaw;
  const specs = (pick.specialty_inferred ?? []).filter((s) => s && s !== 'unknown');
  const inheritedSpecs = (pick.specialty_inherited ?? []).filter((s) => s && s !== 'unknown' && !specs.includes(s));
  return { fn, specs, inheritedSpecs };
}
