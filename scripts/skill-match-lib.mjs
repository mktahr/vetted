// scripts/skill-match-lib.mjs
//
// Behavioral TWIN of lib/skills/match.ts for .mjs scripts (the sync-reference
// collision gate + backfill-person-skills). Duplicated rather than imported
// because Next's TS module can't be cleanly consumed from standalone node .mjs
// scripts; scripts/eval/test-skill-match.ts asserts parity over a fixture
// corpus and fails loud on drift. ANY change to the matcher must land in BOTH
// files.

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

export function normalizeSkillToken(raw) {
  return raw.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function splitTrailingQualifier(token) {
  const m = token.match(/^(.*\S)\s*\(([^()]*)\)$/);
  if (!m) return null;
  const base = m[1].trim();
  const qualifier = m[2].trim();
  if (!base) return null;
  return { base, qualifier };
}

export function buildSkillLookup(rows) {
  const map = new Map();
  const owner = new Map();
  const collided = new Set();

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
    }
  }

  return { map, collisions: Array.from(collided).sort() };
}

export function matchSkillTags(tags, lookup) {
  const matched = [];
  const matchedSeen = new Set();
  const unmatched = [];
  const unmatchedSeen = new Set();

  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    let token = normalizeSkillToken(raw);
    if (!token) continue;

    let hit;
    for (let depth = 0; depth < 4; depth++) {
      hit = lookup.map.get(token);
      if (hit) break;
      const split = splitTrailingQualifier(token);
      if (!split) break;
      hit = lookup.map.get(`${split.base} ${split.qualifier}`);
      if (hit) break;
      if (QUALIFIER_BLOCKLIST.includes(split.qualifier)) break;
      token = split.base;
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
