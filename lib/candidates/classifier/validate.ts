// lib/candidates/classifier/validate.ts
//
// Strict server-side validation of classifier output. Out-of-vocab => reject
// (caller retries once, then fails). Enforces EXACT experience coverage (every
// supplied exp_id appears exactly once, no extras) so a truncated/partial result
// can never reach the commit.
//
// PARENT-FUNCTION GUARD (cls-2026-07-02a): a specialty whose parent_function
// excludes EVERY assigned function for that role is incoherent (e.g. the
// aerospace-parented mission_systems_engineering under software_engineering).
// Default (strict) mode REJECTS it — the retry lets the model decide which side
// was wrong (fix the specialty, or add the genuinely-practiced parent function).
// With repairParentMismatch (the caller's FINAL attempt) the offending specialty
// is STRIPPED and recorded in result.repairs instead, so one stray specialty can
// never fail the whole tuple / burn the candidate's failure budget.

import type { ActiveVocab, ClassifierRawOutput, ValidationResult, ClassificationTuple } from './types';

export interface ValidateOptions {
  /** FINAL attempt: strip parent-mismatched specialties instead of rejecting. */
  repairParentMismatch?: boolean;
  /** FINAL attempt: strip out-of-vocab skills instead of rejecting. With a large
   *  skills list the model occasionally invents plausible near-misses ("JavaFx",
   *  "Trigger.dev"); a stray garnish skill must not fail an entire candidate. */
  repairUnknownSkills?: boolean;
  /** FINAL attempt: strip out-of-vocab SPECIALTY names instead of rejecting. Same
   *  pattern as the other two guards — the gap that val-failed 2 candidates on the
   *  2026-07-06 populate run (invented "ml_engineering" / "mechanism_design" as
   *  specialties). The role stays searchable by function; the stray name is recorded
   *  in result.repairs as vocab-gap signal. */
  repairUnknownSpecialties?: boolean;
  /** FINAL attempt (hardening-before-merge, 2026-07-08): repair semantically
   *  contradictory tuples instead of rejecting — "unknown" mixed with real functions
   *  (drop the "unknown"), and specialties attached to an unknown-only function
   *  (strip the specialties). Strict-rejected on attempt 0 so the retry can fix. */
  repairContradictions?: boolean;
  /** FINAL attempt (hardening-before-merge, 2026-07-08): tolerate an empty
   *  title_normalized_inferred (commits NULL) instead of rejecting — recorded in
   *  repairs. Strict-rejected on attempt 0 (the field is documented REQUIRED). */
  repairEmptyTitle?: boolean;
}

export function validateClassification(
  raw: ClassifierRawOutput | null,
  expectedExpIds: string[],
  vocab: ActiveVocab,
  opts?: ValidateOptions,
): ValidationResult {
  const errors: string[] = [];
  const repairs: string[] = [];
  if (!raw || !Array.isArray(raw.assignments)) {
    return { ok: false, errors: ['output missing or not a JSON object with assignments[]'], tuples: [], repairs };
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

    let fn = Array.isArray(a.function_inferred) ? a.function_inferred : [];
    let sp = Array.isArray(a.specialty_inferred) ? a.specialty_inferred : [];
    const sk = Array.isArray(a.skills_inferred) ? a.skills_inferred : [];
    const title = typeof a.title_normalized_inferred === 'string' ? a.title_normalized_inferred.trim() : '';

    if (fn.length === 0) errors.push(`${id}: function_inferred is empty (use ["unknown"] if undetermined)`);
    for (const v of fn) if (!fns.has(v)) errors.push(`${id}: function "${v}" not in active vocabulary`);

    // Semantic contradictions (hardening 2026-07-08): "unknown" is an abstention, not
    // a discipline — it cannot coexist with real functions, and an unknown-only role
    // cannot carry specialties.
    if (fn.includes('unknown') && fn.length > 1) {
      if (opts?.repairContradictions) {
        repairs.push(`${id}: dropped "unknown" — mixed with real function(s) [${fn.filter((v) => v !== 'unknown').join(', ')}]`);
        fn = fn.filter((v) => v !== 'unknown');
      } else {
        errors.push(`${id}: "unknown" cannot be mixed with real functions [${fn.join(', ')}] — drop "unknown" or classify as unknown only`);
      }
    }
    if (fn.length > 0 && fn.every((v) => v === 'unknown') && sp.length > 0) {
      if (opts?.repairContradictions) {
        repairs.push(`${id}: stripped specialties [${sp.join(', ')}] — attached to an unknown-only function`);
        sp = [];
      } else {
        errors.push(`${id}: specialties [${sp.join(', ')}] attached to an unknown-only function — an abstained role carries no specialty`);
      }
    }
    // title_normalized_inferred is documented REQUIRED — reject empty (repair: tolerate as NULL).
    if (!title) {
      if (opts?.repairEmptyTitle) repairs.push(`${id}: empty title_normalized_inferred tolerated (commits NULL)`);
      else errors.push(`${id}: title_normalized_inferred is empty (REQUIRED — return the cleaned canonical title)`);
    }
    // Skills: vocab membership, with final-attempt repair (strip, don't fail).
    const keptSk: string[] = [];
    for (const v of sk) {
      if (!skills.has(v)) {
        if (opts?.repairUnknownSkills) { repairs.push(`${id}: stripped skill "${v}" — not in active vocabulary`); continue; }
        errors.push(`${id}: skill "${v}" not in active vocabulary`);
        continue;
      }
      keptSk.push(v);
    }
    if (new Set(fn).size !== fn.length) errors.push(`${id}: duplicate function values`);
    if (new Set(sp).size !== sp.length) errors.push(`${id}: duplicate specialty values`);
    if (new Set(sk).size !== sk.length) errors.push(`${id}: duplicate skill values`);

    // Specialties: vocab membership + parent-function guard.
    const fnSet = new Set(fn);
    const keptSp: string[] = [];
    for (const v of sp) {
      if (!specs.has(v)) {
        if (opts?.repairUnknownSpecialties) { repairs.push(`${id}: stripped specialty "${v}" — not in active vocabulary`); continue; }
        errors.push(`${id}: specialty "${v}" not in active vocabulary`);
        continue;
      }
      const parents = vocab.specialtyParents[v];
      // Defensive: missing/empty parent metadata => guard doesn't apply.
      const mismatched = parents && parents.length > 0 && !parents.some((p) => fnSet.has(p));
      if (mismatched) {
        if (opts?.repairParentMismatch) {
          repairs.push(`${id}: stripped specialty "${v}" — parent(s) [${parents.join(', ')}] exclude every assigned function [${fn.join(', ')}]`);
          continue; // stripped, not kept
        }
        errors.push(`${id}: specialty "${v}" belongs to [${parents.join(', ')}] but function_inferred is [${fn.join(', ')}] — drop the specialty (or move the term to skills), or add its parent function ONLY if the role genuinely practiced that discipline`);
      }
      keptSp.push(v);
    }

    tuples.push({
      exp_id: id,
      function_inferred: fn,
      specialty_inferred: keptSp,
      skills_inferred: keptSk,
      title_normalized_inferred: title,
    });
  }

  // Exact coverage: every expected id must be present.
  for (const id of expectedExpIds) if (!seen.has(id)) errors.push(`missing assignment for exp_id ${id}`);

  return { ok: errors.length === 0, errors, tuples, repairs };
}
