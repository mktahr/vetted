// scripts/seed-recruiting-titles.mjs
// Adds recruiting titles to title_dictionary with function_normalized = 'recruiting'.

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
  { title_pattern: 'recruiter',                       title_normalized: 'Recruiter',                       seniority_normalized: 'individual_contributor' },
  { title_pattern: 'technical recruiter',             title_normalized: 'Technical Recruiter',             seniority_normalized: 'individual_contributor' },
  { title_pattern: 'founding recruiter',              title_normalized: 'Founding Recruiter',              seniority_normalized: 'lead' },
  { title_pattern: 'founding technical recruiter',    title_normalized: 'Founding Technical Recruiter',    seniority_normalized: 'lead' },
  { title_pattern: 'head of talent',                  title_normalized: 'Head of Talent',                  seniority_normalized: 'director' },
  { title_pattern: 'head of recruiting',              title_normalized: 'Head of Recruiting',              seniority_normalized: 'director' },
  { title_pattern: 'head of talent acquisition',      title_normalized: 'Head of Talent Acquisition',      seniority_normalized: 'director' },
  { title_pattern: 'head of people',                  title_normalized: 'Head of People',                  seniority_normalized: 'director' },
  { title_pattern: 'head of talent and people',       title_normalized: 'Head of Talent and People',       seniority_normalized: 'director' },
  { title_pattern: 'talent partner',                  title_normalized: 'Talent Partner',                  seniority_normalized: 'senior_ic' },
  { title_pattern: 'talent lead',                     title_normalized: 'Talent Lead',                     seniority_normalized: 'senior_ic' },
  { title_pattern: 'recruiting lead',                 title_normalized: 'Recruiting Lead',                 seniority_normalized: 'senior_ic' },
  { title_pattern: 'talent acquisition lead',         title_normalized: 'Talent Acquisition Lead',         seniority_normalized: 'senior_ic' },
  { title_pattern: 'talent acquisition specialist',   title_normalized: 'Talent Acquisition Specialist',   seniority_normalized: 'individual_contributor' },
  { title_pattern: 'talent acquisition manager',      title_normalized: 'Talent Acquisition Manager',      seniority_normalized: 'manager' },
  { title_pattern: 'people operations',               title_normalized: 'People Operations',               seniority_normalized: 'individual_contributor' },
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
    console.log(`  ${t.title_pattern.padEnd(38)} → ${t.seniority_normalized}`);
    upserted++;
  }
}

console.log(`\n=== Done ===`);
console.log(`Recruiting titles upserted: ${upserted}`);
if (errors > 0) console.log(`Errors: ${errors}`);
