// lib/classification/current-role.ts
// SINGLE shared derivation of a person-level "current role classification" from the
// per-experience five-axis preview columns. Used by BOTH the candidate list and the
// drawer header so they can never disagree (per Codex 2026-07-01). The primary-current
// role is chosen to MATCH ingest exactly (lib/ingest/write-canonical.ts): among is_current
// roles — is_primary_current, then non-student-titled, then any titled, then latest start.

export interface RoleForClassification {
  is_current: boolean
  is_primary_current?: boolean | null
  start_date: string | null
  title_raw: string | null
  function_inferred_preview?: string[] | null
  specialty_inferred_preview?: string[] | null
}

const isStudentTitle = (t: string | null | undefined) => /\b(student|intern|internship|co-?op|apprentice)\b/i.test(t || '');

export function pickPrimaryCurrentRole<T extends RoleForClassification>(exps: T[]): T | null {
  const current = exps.filter((e) => e.is_current);
  if (current.length === 0) return null;
  return (
    current.find((e) => e.is_primary_current) ??
    current.find((e) => !isStudentTitle(e.title_raw)) ??
    current.find((e) => e.title_raw) ??
    current.slice().sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))[0] ??
    null
  );
}

/** Current-role function + specialties from the preview. `unknown`/abstentions are dropped
 *  (they are not useful recruiter metadata) so callers can render "—" when both are empty. */
export function currentRoleClassification(exps: RoleForClassification[]): { fn: string | null; specs: string[] } {
  const pick = pickPrimaryCurrentRole(exps);
  if (!pick) return { fn: null, specs: [] };
  const fnRaw = pick.function_inferred_preview?.[0] ?? null;
  const fn = !fnRaw || fnRaw === 'unknown' ? null : fnRaw;
  const specs = (pick.specialty_inferred_preview ?? []).filter((s) => s && s !== 'unknown');
  return { fn, specs };
}
