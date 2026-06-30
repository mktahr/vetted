// lib/candidates/classifier/validate.ts
//
// Strict server-side validation of classifier output. Out-of-vocab => reject
// (caller retries once, then fails). Enforces EXACT experience coverage (every
// supplied exp_id appears exactly once, no extras) so a truncated/partial result
// can never reach the commit. Off-hint tuples (function not in the specialty's
// parent_function) are NOT rejected — that's intended design (a metric, not a gate).

import type { ActiveVocab, ClassifierRawOutput, ValidationResult, ClassificationTuple } from './types';

export function validateClassification(
  raw: ClassifierRawOutput | null,
  expectedExpIds: string[],
  vocab: ActiveVocab,
): ValidationResult {
  const errors: string[] = [];
  if (!raw || !Array.isArray(raw.assignments)) {
    return { ok: false, errors: ['output missing or not a JSON object with assignments[]'], tuples: [] };
  }

  const fns = new Set(vocab.functions);
  const specs = new Set(vocab.specialties);
  const skills = new Set(vocab.skills);
  const expected = new Set(expectedExpIds);
  const seen = new Set<string>();
  const tuples: ClassificationTuple[] = [];

  for (const a of raw.assignments) {
    const id = typeof a?.exp_id === 'string' ? a.exp_id : '';
    if (!id) { errors.push('assignment missing exp_id'); continue; }
    if (!expected.has(id)) { errors.push(`unknown exp_id ${id}`); continue; }
    if (seen.has(id)) { errors.push(`duplicate exp_id ${id}`); continue; }
    seen.add(id);

    const fn = Array.isArray(a.function_inferred) ? a.function_inferred : [];
    const sp = Array.isArray(a.specialty_inferred) ? a.specialty_inferred : [];
    const sk = Array.isArray(a.skills_inferred) ? a.skills_inferred : [];
    const title = typeof a.title_normalized_inferred === 'string' ? a.title_normalized_inferred.trim() : '';

    if (fn.length === 0) errors.push(`${id}: function_inferred is empty (use ["unknown"] if undetermined)`);
    for (const v of fn) if (!fns.has(v)) errors.push(`${id}: function "${v}" not in active vocabulary`);
    for (const v of sp) if (!specs.has(v)) errors.push(`${id}: specialty "${v}" not in active vocabulary`);
    for (const v of sk) if (!skills.has(v)) errors.push(`${id}: skill "${v}" not in active vocabulary`);
    if (new Set(fn).size !== fn.length) errors.push(`${id}: duplicate function values`);
    if (new Set(sp).size !== sp.length) errors.push(`${id}: duplicate specialty values`);
    if (new Set(sk).size !== sk.length) errors.push(`${id}: duplicate skill values`);

    tuples.push({
      exp_id: id,
      function_inferred: fn,
      specialty_inferred: sp,
      skills_inferred: sk,
      title_normalized_inferred: title,
    });
  }

  // Exact coverage: every expected id must be present.
  for (const id of expectedExpIds) if (!seen.has(id)) errors.push(`missing assignment for exp_id ${id}`);

  return { ok: errors.length === 0, errors, tuples };
}
