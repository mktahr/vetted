// lib/classification/career-fallback.ts
//
// DETERMINISTIC career-fallback inheritance (2026-07-07 architecture decision,
// Claude+Codex joint review). The LLM classifier labels ONLY what each role's own
// evidence supports (prompt cls-2026-07-08a removed the career-fallback prompt
// rule); THIS pure function computes the inheritance in code — same input, same
// output, fires every time. Output goes to person_experiences.specialty_inherited
// (real pipeline, atomically via commit_classification) / specialty_inherited_preview
// (preview populate) — NEVER into specialty_inferred, which stays evidenced-only.
//
// THE RULE (V1 — binary evidenced/inherited; confidence scoring comes later):
//   TARGET (a role that inherits): engineering function (not unknown/founder),
//     EMPTY evidenced specialty, a real non-student/non-intern title.
//   SOURCES: OTHER roles with a non-empty EVIDENCED specialty (never inherited —
//     no chains), excluding internships / student / advisory / board / contract /
//     freelance side roles, deduped by (title|company|start|end) so the known
//     duplicate-experience ingest bug can't double-count.
//   FORWARD-ONLY: a role inherits only from roles that started before or overlap
//     it — people grow INTO specialties; backfilling someone's first job from
//     their staff-level years manufactures history.
//   PARENT-CONSISTENCY: an inherited specialty's parent_function must include one
//     of the target's assigned functions (same semantics as the validator guard) —
//     kills cross-discipline bleed on career pivots.
//   DOMINANCE: a specialty must appear in >=2 eligible source roles (or the single
//     source role when only one exists). Ordered by count desc, primary-position
//     count desc, recency desc. Cap 2.
//   LEADERSHIP targets (manager/director/VP/head/chief/CTO titles): conservative —
//     inherit at most 1, and only the PRIMARY specialty of the most recent eligible
//     source (per the joint review: weaker than the IC fallback).

export interface RoleForFallback {
  exp_id: string;
  title_raw: string | null;
  company_name?: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  /** EVIDENCED axes from the LLM (position 0 = primary). Never pass inherited values in. */
  function_inferred: string[];
  specialty_inferred: string[];
}

// Titles that never act as inheritance SOURCES (side gigs / pre-career).
const NON_SOURCE_TITLE = /\b(intern(ship)?|co-?op|student|advisor|advisory|board\s+(member|director|observer)|contractor|freelancer?|consultant)\b/i;
// Titles that never inherit (TARGET exclusions — pre-career roles stay evidenced-only).
const NON_TARGET_TITLE = /\b(intern(ship)?|co-?op|student)\b/i;
// Leadership targets get the conservative single-value recent-primary path.
const LEADERSHIP_TITLE = /\b(manager|director|vp|vice\s+president|head\s+of|chief|cto)\b/i;
// Functions that never inherit a specialty.
const NON_ENGINEERING_FN = new Set(['unknown', 'founder']);

const sourceKey = (r: RoleForFallback) =>
  [r.title_raw ?? '', r.company_name ?? '', r.start_date ?? '', r.end_date ?? ''].join('|').toLowerCase();

/** exp_id -> inherited specialties (only for roles that inherit anything). */
export function computeCareerFallback(
  roles: RoleForFallback[],
  specialtyParents: Record<string, string[]>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  // Eligible sources: evidenced specialty + real FT-shaped title + a start date
  // (forward-only needs ordering — an undatable source can't prove it came first).
  const seenKeys = new Set<string>();
  const sources = roles.filter((r) => {
    if (!r.specialty_inferred?.length) return false;
    if (!r.title_raw || NON_SOURCE_TITLE.test(r.title_raw)) return false;
    if (!r.start_date) return false;
    const k = sourceKey(r);
    if (seenKeys.has(k)) return false; // duplicate-ingest defense
    seenKeys.add(k);
    return true;
  });
  if (sources.length === 0) return result;

  for (const target of roles) {
    const fns = target.function_inferred ?? [];
    if (fns.length === 0 || NON_ENGINEERING_FN.has(fns[0])) continue;
    if (target.specialty_inferred?.length) continue;         // already evidenced
    if (!target.title_raw || NON_TARGET_TITLE.test(target.title_raw)) continue;

    // Forward-only: source started before-or-during the target's span. The target
    // must have KNOWN chronology (Codex 2026-07-07): an undated non-current role could
    // predate every source, and defaulting it to open-ended would manufacture history.
    // is_current is chronology enough — an ongoing role is "now", after every dated source.
    let targetEnd: string;
    if (target.is_current) targetEnd = '9999-12-31';
    else if (target.end_date) targetEnd = target.end_date;
    else if (target.start_date) targetEnd = target.start_date; // open span, unknown end: only sources that began before it started
    else continue; // no dates, not current -> chronology unknown -> never inherit
    const eligible = sources.filter((s) => s.exp_id !== target.exp_id && (s.start_date as string) <= targetEnd);
    if (eligible.length === 0) continue;

    const fnSet = new Set(fns);
    // Per-specialty stats across eligible sources (parent-consistent only).
    const stats = new Map<string, { count: number; primary: number; lastUsed: string }>();
    for (const s of eligible) {
      s.specialty_inferred.forEach((sp, idx) => {
        const parents = specialtyParents[sp];
        // Same defensive semantics as the validator: missing parent metadata => guard doesn't apply.
        if (parents && parents.length > 0 && !parents.some((p) => fnSet.has(p))) return;
        const st = stats.get(sp) ?? { count: 0, primary: 0, lastUsed: '' };
        st.count++;
        if (idx === 0) st.primary++;
        if ((s.start_date as string) > st.lastUsed) st.lastUsed = s.start_date as string;
        stats.set(sp, st);
      });
    }
    if (stats.size === 0) continue;

    // Dominance: >=2 sources, or the lone source when only one exists ("stable,
    // consistent" — two sources with disjoint specialties inherit nothing).
    const minCount = eligible.length === 1 ? 1 : 2;
    const ranked = Array.from(stats.entries())
      .filter(([, st]) => st.count >= minCount)
      .sort(([aName, a], [bName, b]) =>
        b.count - a.count || b.primary - a.primary || b.lastUsed.localeCompare(a.lastUsed) || aName.localeCompare(bName));
    if (ranked.length === 0) continue;

    if (LEADERSHIP_TITLE.test(target.title_raw)) {
      // Conservative leadership path: the most recent eligible source's PRIMARY only.
      const recent = eligible.slice().sort((a, b) => (b.start_date as string).localeCompare(a.start_date as string))[0];
      const primary = recent.specialty_inferred[0];
      if (primary && ranked.some(([name]) => name === primary)) result[target.exp_id] = [primary];
      continue;
    }

    result[target.exp_id] = ranked.slice(0, 2).map(([name]) => name);
  }

  return result;
}
