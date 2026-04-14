// scripts/seed-universities.mjs
// Reads university CSV and upserts into the schools table.

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Parse .env.local manually (no dotenv dependency)
const envFile = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=');
    return [k.trim(), v.join('=').trim()];
  })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const CSV_PATH = '/Users/matt/Downloads/Vetted - Original Tech Startup Focus   - Uni (2).csv';

// ─── Parse CSV ────────────────────────────────────────────────────────────

const raw = readFileSync(CSV_PATH, 'utf-8');
const lines = raw.split('\n').filter(l => l.trim().length > 0);

// Skip header, parse each row
let upserted = 0;
let errors = 0;

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(',');
  const schoolName = (cols[0] || '').trim();
  const rankingStr = (cols[1] || '').trim();
  const foreignStr = (cols[2] || '').trim().toUpperCase();

  if (!schoolName) continue;

  const schoolScore = parseInt(rankingStr, 10);
  if (isNaN(schoolScore) || schoolScore < 0 || schoolScore > 4) {
    console.error(`  SKIP "${schoolName}" — invalid ranking: ${rankingStr}`);
    errors++;
    continue;
  }

  const isForeign = foreignStr === 'TRUE';

  // Check if school exists (case-insensitive)
  const { data: existing } = await supabase
    .from('schools')
    .select('school_id')
    .ilike('school_name', schoolName)
    .maybeSingle();

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from('schools')
      .update({ school_score: schoolScore, is_foreign: isForeign })
      .eq('school_id', existing.school_id);
    if (error) {
      console.error(`  FAILED update "${schoolName}":`, error.message);
      errors++;
      continue;
    }
    console.log(`  Updated: ${schoolName} (score ${schoolScore}, foreign=${isForeign})`);
  } else {
    // Insert new
    const { error } = await supabase
      .from('schools')
      .insert({
        school_name: schoolName,
        school_score: schoolScore,
        is_foreign: isForeign,
        school_type: 'university',
      });
    if (error) {
      console.error(`  FAILED insert "${schoolName}":`, error.message);
      errors++;
      continue;
    }
    console.log(`  Inserted: ${schoolName} (score ${schoolScore}, foreign=${isForeign})`);
  }

  upserted++;
}

console.log('\n=== Done ===');
console.log(`Schools upserted: ${upserted}`);
if (errors > 0) console.log(`Errors: ${errors}`);
