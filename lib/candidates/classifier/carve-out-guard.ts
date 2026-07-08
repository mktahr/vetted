// lib/candidates/classifier/carve-out-guard.ts
//
// DETERMINISTIC enforcement of the robotics carve-out's evidence requirement
// (cls-2026-07-08a). The carve-out routes "<Robotics> Software Engineer"-shaped
// roles to function=robotics_engineering — but it keys on the TITLE or the role's
// own described work, NEVER the employer. Haiku demonstrably leaks on sparse roles
// at robotics-NAMED employers (tuning evidence 2026-07-07: bare "Software Engineer"
// @ "Rapid Robotics, inc" → robotics_engineering[robotics_software_engineering]),
// and prompt iteration didn't reliably fix it — the same class of sometimes-fires
// failure the deterministic career-fallback layer exists for. So the rule is
// enforced HERE: if a tuple claims the carve-out (robotics fn + the generalist
// robotics_software_engineering specialty) but the title contains no robot term
// AND the description is empty, NO qualifying evidence can exist — reroute to
// software_engineering and drop the specialty. Sharper robotics specialties
// (perception/autonomy/slam/...) are NOT touched: they require positive evidence
// the validator's parent guard + evidence bar already police, and stripping them
// on a sparse title would fight legitimate description-based calls.

import type { ClassificationTuple, ExperienceForClassification } from './types';

const ROBOT_TERM = /robot/i; // robotics, robotic, robot — any form counts as a title build-target

export interface CarveOutRepair {
  exp_id: string;
  note: string;
}

/** Mutates nothing; returns corrected tuples + a repair log (same reporting shape
 *  as the validator's REJECT-then-REPAIR guards). */
export function enforceRoboticsCarveOutGuard(
  tuples: ClassificationTuple[],
  experiences: Pick<ExperienceForClassification, 'person_experience_id' | 'title_raw' | 'description_raw'>[],
): { tuples: ClassificationTuple[]; repairs: CarveOutRepair[] } {
  const byId = new Map(experiences.map((e) => [e.person_experience_id, e]));
  const repairs: CarveOutRepair[] = [];
  const out = tuples.map((t) => {
    if (!t.function_inferred.includes('robotics_engineering')) return t;
    // PURE leak signature only (Codex 2026-07-07): robotics_software_engineering must be
    // the tuple's ONLY specialty. Any other specialty = mixed evidence — rerouting the
    // function could orphan a robotics-parented sibling (e.g. autonomy) into a
    // parent-inconsistent pair. Leave mixed tuples to the validator's parent guard.
    if (t.specialty_inferred.length !== 1 || t.specialty_inferred[0] !== 'robotics_software_engineering') return t;
    const e = byId.get(t.exp_id);
    if (!e) return t;
    const titleHasRobot = ROBOT_TERM.test(e.title_raw ?? '');
    const hasDescription = !!(e.description_raw && e.description_raw.trim().length > 0);
    // Title names a robot build-target, or a description exists (the LLM judged the
    // work) -> carve-out stands.
    if (titleHasRobot || hasDescription) return t;
    // No possible qualifying evidence: employer-name leak. Reroute to software.
    const fns = t.function_inferred.map((f) => (f === 'robotics_engineering' ? 'software_engineering' : f));
    const function_inferred = fns.filter((f, i) => fns.indexOf(f) === i); // dedupe if software already present
    const specialty_inferred = t.specialty_inferred.filter((s) => s !== 'robotics_software_engineering');
    repairs.push({
      exp_id: t.exp_id,
      note: `${t.exp_id}: robotics carve-out rerouted to software_engineering — title has no robot term and description is empty (employer-name leak; carve-out keys on title/work, never employer)`,
    });
    return { ...t, function_inferred, specialty_inferred };
  });
  return { tuples: out, repairs };
}
