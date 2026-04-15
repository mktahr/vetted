// scripts/seed-recruiting-titles.mjs
// Adds recruiting titles to title_dictionary with function_normalized = 'recruiting'.
//
// Note: seniority is no longer set here. As of migration 005, seniority
// comes exclusively from seniority_rules (see lib/normalize/seniority.ts).
// title_dictionary is responsible only for: title_normalized,
// function_normalized, specialty_normalized, confidence, active.

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=');
    return [k.trim(), v.join('=').trim()];
  })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const TITLES = [
  { title_pattern: 'recruiter',                     title_normalized: 'Recruiter' },
  { title_pattern: 'technical recruiter',           title_normalized: 'Technical Recruiter' },
  { title_pattern: 'founding recruiter',            title_normalized: 'Founding Recruiter' },
  { title_pattern: 'founding technical recruiter',  title_normalized: 'Founding Technical Recruiter' },
  { title_pattern: 'head of talent',                title_normalized: 'Head of Talent' },
  { title_pattern: 'head of recruiting',            title_normalized: 'Head of Recruiting' },
  { title_pattern: 'head of talent acquisition',    title_normalized: 'Head of Talent Acquisition' },
  { title_pattern: 'head of people',                title_normalized: 'Head of People' },
  { title_pattern: 'head of talent and people',     title_normalized: 'Head of Talent and People' },
  { title_pattern: 'talent partner',                title_normalized: 'Talent Partner' },
  { title_pattern: 'talent lead',                   title_normalized: 'Talent Lead' },
  { title_pattern: 'recruiting lead',               title_normalized: 'Recruiting Lead' },
  { title_pattern: 'talent acquisition lead',       title_normalized: 'Talent Acquisition Lead' },
  { title_pattern: 'talent acquisition specialist', title_normalized: 'Talent Acquisition Specialist' },
  { title_pattern: 'talent acquisition manager',    title_normalized: 'Talent Acquisition Manager' },
  { title_pattern: 'people operations',             title_normalized: 'People Operations' },
];

let upserted = 0;
let errors = 0;

for (const t of TITLES) {
  const { error } = await supabase
    .from('title_dictionary')
    .upsert({
      ...t,
      function_normalized: 'recruiting',
      confidence: 0.95,
      active: true,
    }, { onConflict: 'title_pattern' });

  if (error) {
    console.error(`  FAILED "${t.title_pattern}":`, error.message);
    errors++;
  } else {
    console.log(`  ${t.title_pattern.padEnd(38)} → recruiting`);
    upserted++;
  }
}

console.log(`\n=== Done ===`);
console.log(`Recruiting titles upserted: ${upserted}`);
if (errors > 0) console.log(`Errors: ${errors}`);
