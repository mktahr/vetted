// scripts/seed-school-aliases.mjs
// Maps alias names to canonical schools already in the schools table.

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

// canonical school name (as stored in schools.school_name) -> list of aliases
const ALIASES = {
  'MIT': ['Massachusetts Institute of Technology', 'MIT Sloan', 'MIT CSAIL'],
  'Stanford': ['Stanford University', 'Stanford GSB'],
  'Harvard': ['Harvard University', 'Harvard Business School', 'HBS', 'Harvard College'],
  'Berkeley': ['UC Berkeley', 'University of California Berkeley', 'University of California, Berkeley', 'Haas School of Business'],
  'Carnegie Mellon': ['Carnegie Mellon University', 'CMU', 'CMU SCS'],
  'Penn': ['University of Pennsylvania', 'UPenn', 'Wharton', 'The Wharton School', 'Wharton School', 'Penn Engineering'],
  'Columbia': ['Columbia University', 'Columbia Engineering', 'Columbia Business School', 'CBS'],
  'Cornell': ['Cornell University', 'Cornell Tech', 'Cornell Johnson', 'Johnson Graduate School of Management', 'Cornell Dyson'],
  'Princeton': ['Princeton University'],
  'Yale': ['Yale University', 'Yale SOM', 'Yale School of Management'],
  'UCLA': ['University of California Los Angeles', 'University of California, Los Angeles', 'UCLA Anderson', 'Anderson School of Management'],
  'Duke': ['Duke University', 'Duke Fuqua', 'Fuqua School of Business'],
  'Michigan': ['University of Michigan', 'U Michigan', 'UMich', 'Ross School of Business', 'Michigan Ross'],
  'CalTech': ['California Institute of Technology', 'Caltech'],
  'UIUC': ['University of Illinois Urbana-Champaign', 'University of Illinois', 'U of I'],
  'Georgia Tech': ['Georgia Institute of Technology'],
  'USC': ['University of Southern California'],
  'Brown': ['Brown University'],
  'NYU': ['New York University', 'NYU Stern', 'Stern School of Business'],
  'UT Austin': ['University of Texas Austin', 'University of Texas at Austin', 'UT McCombs', 'McCombs School of Business'],
  'Northwestern': ['Northwestern University', 'Kellogg School of Management', 'Kellogg'],
  'Johns Hopkins': ['Johns Hopkins University'],
  'Purdue': ['Purdue University'],
  'UC San Diego': ['University of California San Diego', 'University of California, San Diego', 'UCSD'],
  'Dartmouth': ['Dartmouth College', 'Tuck School of Business', 'Dartmouth Tuck'],
  'Waterloo': ['University of Waterloo'],
  'U Washington': ['University of Washington', 'UW Seattle', 'Foster School of Business'],
  'U Toronto': ['University of Toronto'],
  'Oxford': ['University of Oxford', 'Oxford University', 'Oxford Saïd', 'Said Business School'],
  'Cambridge': ['University of Cambridge', 'Cambridge University', 'Judge Business School'],
  'ETH Zurich': ['Swiss Federal Institute of Technology', 'ETH Zürich'],
  'IIT': ['Indian Institute of Technology', 'IIT Bombay', 'IIT Delhi', 'IIT Madras', 'IIT Kanpur', 'IIT Kharagpur'],
};

let inserted = 0;
let skipped = 0;
let errors = 0;

for (const [canonical, aliases] of Object.entries(ALIASES)) {
  // Find the canonical school (case-insensitive, tolerating trailing whitespace stored in DB)
  const { data: school } = await supabase
    .from('schools')
    .select('school_id, school_name')
    .ilike('school_name', canonical)
    .maybeSingle();

  if (!school) {
    console.error(`  NOT FOUND in schools: "${canonical}"`);
    errors++;
    continue;
  }

  for (const alias of aliases) {
    const { error } = await supabase
      .from('school_aliases')
      .upsert({ alias_name: alias.trim(), school_id: school.school_id }, { onConflict: 'alias_name' });

    if (error) {
      console.error(`  FAILED alias "${alias}" → "${canonical}":`, error.message);
      errors++;
    } else {
      inserted++;
    }
  }

  console.log(`  ${canonical.padEnd(22)} → ${aliases.length} aliases`);
}

console.log(`\n=== Done ===`);
console.log(`Aliases upserted: ${inserted}`);
if (skipped > 0) console.log(`Skipped: ${skipped}`);
if (errors > 0) console.log(`Errors: ${errors}`);
