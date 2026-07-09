// lib/skills/match.ts
//
// Deterministic person-level skills matcher (taxonomy sub-PR 4, Piece B).
// Matches scraped LinkedIn skills_tags against skills_dictionary
// (canonical_name + aliases). Pure code, zero LLM.
//
// GOVERNING PRINCIPLE (Matt, 2026-07-08; Codex-concurred): bias toward CAPTURE.
// False negatives (missing a real skill) cost more than false positives —
// person-level skills are badged as the weakest provenance tier, never feed
// the classifier, and are not scoring inputs. When in doubt, capture.
//
// MATCHING RULE: whole-tag equality ONLY — LinkedIn skills are discrete
// claimed-competency tags, never free text. NO substring, NO fuzzy. This is
// what makes bare short tokens ("C", "R", "Go", "CV", "ML") safe: a tag
// matches "C" only if the ENTIRE tag normalizes to "c".
//
// Per-tag match order (Codex round-2 ordering — blocklist BEFORE strip so a
// contradicting qualifier can never sneak through the strip path):
//   1. exact lookup of the full normalized tag
//   2. if a trailing parenthetical exists, try the qualifier-MERGED form
//      ("react (native)" → "react native" → React Native, NOT React)
//   3. if the qualifier CONTRADICTS the skill (blocklist), stop → unmatched
//   4. strip the qualifier and retry from step 1 (handles nesting)
// Unknown qualifier → capture (blocklist, not allowlist).
//
// IMPORTANT: scripts/skill-match-lib.mjs is a byte-for-byte behavioral twin of
// this module for .mjs scripts (sync-reference gate + backfill). Any change
// here MUST be mirrored there; scripts/eval/test-skill-match.ts asserts parity
// over a fixture corpus and fails loud on drift.

export interface SkillDictEntry {
  canonical_name: string;
  aliases: string[] | null;
}

export interface SkillLookup {
  /** normalized token → canonical_name */
  map: Map<string, string>;
  /** tokens claimed by 2+ rows — removed from the map (fail-safe no-match) */
  collisions: string[];
}

export interface SkillMatchResult {
  /** canonical_name values, deduped, stable order */
  matched: string[];
  /** raw input tags that matched nothing, deduped, stable order */
  unmatched: string[];
}

/** Qualifiers that CONTRADICT an engineering skill — tiny, contradiction-only.
 *  Depth/context qualifiers ("advanced", "embedded", "postgresql") are NOT
 *  blocked: unknown qualifier → capture. */
export const QUALIFIER_BLOCKLIST = [
  'game',
  'board game',
  'boardgame',
  'card game',
  'video game',
  'gaming',
  'sport',
  'sports',
];

/** NFKC → lowercase → collapse whitespace → trim. Preserves ALL punctuation
 *  ("c++", "c#", ".net" stay intact). */
export function normalizeSkillToken(raw: string): string {
  return raw.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Split a single trailing parenthetical qualifier off an already-normalized
 *  token. "go (programming language)" → { base: "go", qualifier: "programming
 *  language" }. Returns null when there is no trailing parenthetical or no base
 *  would remain (a tag that IS a parenthetical is not split). */
export function splitTrailingQualifier(
  token: string,
): { base: string; qualifier: string } | null {
  const m = token.match(/^(.*\S)\s*\(([^()]*)\)$/);
  if (!m) return null;
  const base = m[1].trim();
  const qualifier = m[2].trim();
  if (!base) return null;
  return { base, qualifier };
}

/** Build the normalized-token → canonical lookup from ACTIVE dictionary rows.
 *  Same-row duplicates dedupe silently; cross-row duplicates are collisions:
 *  logged by the caller, token removed (fail-safe no-match, never a guess).
 *  The authoritative collision gate lives in scripts/sync-reference.mjs — this
 *  is the runtime defense against direct-DB drift. */
export function buildSkillLookup(rows: SkillDictEntry[]): SkillLookup {
  const map = new Map<string, string>();
  const owner = new Map<string, string>();
  const collided = new Set<string>();

  for (const row of rows) {
    const canonical = row.canonical_name;
    if (!canonical) continue;
    const tokens = [canonical, ...(row.aliases ?? [])]
      .map(normalizeSkillToken)
      .filter(Boolean);
    for (const token of tokens) {
      const existing = owner.get(token);
      if (existing === undefined) {
        owner.set(token, canonical);
        map.set(token, canonical);
      } else if (existing !== canonical) {
        collided.add(token);
        map.delete(token);
      }
      // existing === canonical → same-row (or same-skill) dupe → silently fine
    }
  }

  return { map, collisions: Array.from(collided).sort() };
}

/** Match discrete skill tags against the lookup. Whole-tag equality only. */
export function matchSkillTags(
  tags: string[],
  lookup: SkillLookup,
): SkillMatchResult {
  const matched: string[] = [];
  const matchedSeen = new Set<string>();
  const unmatched: string[] = [];
  const unmatchedSeen = new Set<string>();

  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    let token = normalizeSkillToken(raw);
    if (!token) continue;

    let hit: string | undefined;
    // Bounded loop: each iteration strips one trailing parenthetical.
    for (let depth = 0; depth < 4; depth++) {
      hit = lookup.map.get(token); // step 1: exact
      if (hit) break;
      const split = splitTrailingQualifier(token);
      if (!split) break;
      hit = lookup.map.get(`${split.base} ${split.qualifier}`); // step 2: merged
      if (hit) break;
      if (QUALIFIER_BLOCKLIST.includes(split.qualifier)) break; // step 3: contradiction
      token = split.base; // step 4: strip and retry
    }

    if (hit) {
      if (!matchedSeen.has(hit)) {
        matchedSeen.add(hit);
        matched.push(hit);
      }
    } else {
      const key = normalizeSkillToken(raw);
      if (!unmatchedSeen.has(key)) {
        unmatchedSeen.add(key);
        unmatched.push(raw.trim());
      }
    }
  }

  return { matched, unmatched };
}
