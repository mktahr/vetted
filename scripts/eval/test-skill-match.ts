// scripts/eval/test-skill-match.ts
//
// Fixture suite for the deterministic person-level skills matcher (Piece B).
// Run: npx tsx scripts/eval/test-skill-match.ts   (no LLM, no DB)
//
// Two jobs:
//   1. BEHAVIOR — the capture-biased matching rules do what the Codex-converged
//      design says (whole-tag only; exact → merged → blocklist → strip).
//   2. PARITY — lib/skills/match.ts and scripts/skill-match-lib.mjs (the .mjs
//      twin used by sync-reference + backfill) produce IDENTICAL output over
//      every fixture. Drift between the twins fails loud here.

import * as ts from '../../lib/skills/match';
// @ts-ignore — plain .mjs twin, no type declarations by design
import * as mjs from '../skill-match-lib.mjs';

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// Mini-dictionary mirroring the real /reference/skills/ rows these rules exist for.
const DICT: ts.SkillDictEntry[] = [
  { canonical_name: 'C', aliases: [] },
  { canonical_name: 'R', aliases: [] },
  { canonical_name: 'Go', aliases: ['golang'] },
  { canonical_name: 'C++', aliases: ['cpp', 'cplusplus'] },
  { canonical_name: 'C#', aliases: ['csharp'] },
  { canonical_name: '.NET', aliases: ['dotnet', 'aspnet'] },
  { canonical_name: 'Python', aliases: ['py'] },
  { canonical_name: 'SQL', aliases: [] },
  { canonical_name: 'Computer Vision', aliases: ['cv'] },
  { canonical_name: 'Machine Learning', aliases: ['ml'] },
  { canonical_name: 'CAN Bus', aliases: ['can', 'controller area network', 'canfd', 'can-fd'] },
  { canonical_name: 'React', aliases: [] },
  { canonical_name: 'React Native', aliases: [] },
  { canonical_name: 'Node.js', aliases: ['nodejs', 'node'] },
  { canonical_name: 'Kubernetes', aliases: ['k8s'] },
];

const lookupTs = ts.buildSkillLookup(DICT);
const lookupMjs = mjs.buildSkillLookup(DICT);

function match(tags: string[]) {
  return ts.matchSkillTags(tags, lookupTs);
}

console.log('— Whole-tag safety (short tokens never substring-match) —');
check('"C" matches C', match(['C']).matched.join() === 'C');
check('"r" matches R', match(['r']).matched.join() === 'R');
check('"Go" matches Go', match(['Go']).matched.join() === 'Go');
check('"golang" matches Go via alias', match(['golang']).matched.join() === 'Go');
check('"CV" matches Computer Vision (capture principle — alias kept)', match(['CV']).matched.join() === 'Computer Vision');
check('"CAN" matches CAN Bus', match(['CAN']).matched.join() === 'CAN Bus');
check('"Can do everything" is unmatched (no substring)', match(['Can do everything']).matched.length === 0);
check('"Going" is unmatched (no substring)', match(['Going']).matched.length === 0);
check('"R&D" is unmatched', match(['R&D']).matched.length === 0);

console.log('— Punctuation preserved —');
check('"C++" matches C++', match(['C++']).matched.join() === 'C++');
check('"  c++  " matches C++ (trim+case)', match(['  c++  ']).matched.join() === 'C++');
check('"C#" matches C#', match(['C#']).matched.join() === 'C#');
check('".NET" matches .NET', match(['.NET']).matched.join() === '.NET');

console.log('— Qualifier handling: exact → merged → blocklist → strip —');
check('"Go (Programming Language)" captured → Go', match(['Go (Programming Language)']).matched.join() === 'Go');
check('"R (Programming Language)" captured → R', match(['R (Programming Language)']).matched.join() === 'R');
check('"Python (Advanced)" captured — unknown qualifier strips (blocklist not allowlist)', match(['Python (Advanced)']).matched.join() === 'Python');
check('"SQL (PostgreSQL)" captured → SQL', match(['SQL (PostgreSQL)']).matched.join() === 'SQL');
check('"React (Native)" merge-tries → React Native, NOT React', match(['React (Native)']).matched.join() === 'React Native');
check('"Node (JS)" strips → Node.js', match(['Node (JS)']).matched.join() === 'Node.js');
check('"Go (Game)" BLOCKED', match(['Go (Game)']).matched.length === 0);
check('"Go (Board Game)" BLOCKED', match(['Go (Board Game)']).matched.length === 0);
check('"Go (Boardgame)" BLOCKED', match(['Go (Boardgame)']).matched.length === 0);
check('"Go (Video Game)" BLOCKED', match(['Go (Video Game)']).matched.length === 0);
check('"Go (Gaming)" BLOCKED', match(['Go (Gaming)']).matched.length === 0);
check('blocked tag lands in unmatched', match(['Go (Game)']).unmatched.join() === 'Go (Game)');
check('nested qualifiers strip through: "Go (Programming Language) (2020)"', match(['Go (Programming Language) (2020)']).matched.join() === 'Go');
check('bare parenthetical "(hobby)" is unmatched, no crash', match(['(hobby)']).matched.length === 0);

console.log('— Dedup + ordering + junk —');
{
  const r = match(['go', 'golang', 'Go (Programming Language)']);
  check('three Go forms dedupe to one match', r.matched.join() === 'Go');
}
{
  const r = match(['Python', 'Rust', 'rust', 'Python']);
  check('unmatched dedupes by normalized form', r.unmatched.length === 1 && r.unmatched[0].toLowerCase() === 'rust');
}
check('empty / whitespace tags skipped', match(['', '   ']).matched.length === 0 && match(['', '   ']).unmatched.length === 0);
{
  const r = match(['PyTorch', 'C', 'CV']);
  check('stable order: matched follows input order', r.matched.join(',') === 'C,Computer Vision' && r.unmatched.join() === 'PyTorch');
}

console.log('— Collision fail-safe (runtime defense) —');
{
  const collDict: ts.SkillDictEntry[] = [
    { canonical_name: 'Verilog', aliases: ['hdl'] },
    { canonical_name: 'VHDL', aliases: ['hdl'] },
    { canonical_name: 'Python', aliases: [] },
  ];
  const l = ts.buildSkillLookup(collDict);
  check('cross-row alias collision reported', l.collisions.join() === 'hdl');
  check('collided token dropped → unmatched (never a guess)', ts.matchSkillTags(['HDL'], l).matched.length === 0);
  check('non-collided tokens unaffected', ts.matchSkillTags(['python'], l).matched.join() === 'Python');
  check('same-row duplicate is NOT a collision', ts.buildSkillLookup([{ canonical_name: 'Go', aliases: ['go', 'golang'] }]).collisions.length === 0);
}

console.log('— TS ↔ MJS twin parity —');
{
  const corpus = [
    'C', 'r', 'Go', 'golang', 'CV', 'CAN', 'Can do everything', 'Going', 'R&D',
    'C++', '  c++  ', 'C#', '.NET', 'Go (Programming Language)', 'Python (Advanced)',
    'SQL (PostgreSQL)', 'React (Native)', 'Node (JS)', 'Go (Game)', 'Go (Board Game)',
    'Go (Boardgame)', 'Go (Video Game)', 'Go (Gaming)', 'Go (Programming Language) (2020)',
    '(hobby)', '', '   ', 'PyTorch', 'K8S', 'k8s', 'MACHINE   learning', 'Ｇｏ', // NFKC fullwidth
  ];
  const a = ts.matchSkillTags(corpus, lookupTs);
  const b = mjs.matchSkillTags(corpus, lookupMjs);
  check('matched identical', JSON.stringify(a.matched) === JSON.stringify(b.matched),
    `ts=${JSON.stringify(a.matched)} mjs=${JSON.stringify(b.matched)}`);
  check('unmatched identical', JSON.stringify(a.unmatched) === JSON.stringify(b.unmatched),
    `ts=${JSON.stringify(a.unmatched)} mjs=${JSON.stringify(b.unmatched)}`);
  check('collisions identical', JSON.stringify(lookupTs.collisions) === JSON.stringify(lookupMjs.collisions));
  check('blocklists identical', JSON.stringify(ts.QUALIFIER_BLOCKLIST) === JSON.stringify(mjs.QUALIFIER_BLOCKLIST));
  check('NFKC fullwidth "Ｇｏ" captured by both', a.matched.includes('Go'));
}

console.log('');
if (failures > 0) {
  console.error(`${failures} FAILURE(S)`);
  process.exit(1);
}
console.log('All skill-match fixtures passed.');
