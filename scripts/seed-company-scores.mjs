// scripts/seed-company-scores.mjs
// Reads company scoring CSV and upserts into companies + company_year_scores tables.

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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE env vars in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CSV_PATH = '/Users/matt/Downloads/Vetted - Original Tech Startup Focus   - Company Scoring (1).csv';

// ─── Parse CSV ────────────────────────────────────────────────────────────

const raw = readFileSync(CSV_PATH, 'utf-8');
const lines = raw.split('\n').filter(l => l.trim().length > 0);
const headerLine = lines[0];
const headers = headerLine.split(',').map(h => h.trim());

// Year columns start at index 2
const yearColumns = headers.slice(2).map(h => parseInt(h, 10)).filter(y => !isNaN(y));

let companiesUpserted = 0;
let scoresInserted = 0;
let errors = 0;

for (let i = 1; i < lines.length; i++) {
  // Simple CSV parse (no quoted fields in this data)
  const cols = lines[i].split(',');
  const companyName = (cols[0] || '').trim();
  const industryTag = (cols[1] || '').trim() || null;

  if (!companyName) continue;

  // Upsert company
  // Check if exists first (case-insensitive)
  const { data: existing } = await supabase
    .from('companies')
    .select('company_id')
    .ilike('company_name', companyName)
    .single();

  let companyId;

  if (existing) {
    companyId = existing.company_id;
    // Update industry tag if not set
    if (industryTag) {
      await supabase
        .from('companies')
        .update({ primary_industry_tag: industryTag })
        .eq('company_id', companyId);
    }
  } else {
    const { data: created, error } = await supabase
      .from('companies')
      .insert({
        company_name: companyName,
        primary_industry_tag: industryTag,
        company_score_mode: 'manual',
        manual_review_status: 'reviewed',
        current_status: 'active',
      })
      .select('company_id')
      .single();

    if (error) {
      console.error(`  FAILED to create company "${companyName}":`, error.message);
      errors++;
      continue;
    }
    companyId = created.company_id;
  }

  companiesUpserted++;

  // Insert year scores
  let companyScores = 0;
  for (let j = 0; j < yearColumns.length; j++) {
    const year = yearColumns[j];
    const scoreStr = (cols[j + 2] || '').trim();
    if (!scoreStr) continue;

    const score = parseInt(scoreStr, 10);
    if (isNaN(score) || score < 1 || score > 5) continue;

    const { error } = await supabase
      .from('company_year_scores')
      .upsert(
        { company_id: companyId, year, company_score: score },
        { onConflict: 'company_id,year' }
      );

    if (error) {
      console.error(`  FAILED score for "${companyName}" year ${year}:`, error.message);
      errors++;
    } else {
      scoresInserted++;
      companyScores++;
    }
  }

  console.log(`  ${companyName} — ${companyScores} year scores`);
}

console.log('\n=== Done ===');
console.log(`Companies upserted: ${companiesUpserted}`);
console.log(`Year scores inserted: ${scoresInserted}`);
if (errors > 0) console.log(`Errors: ${errors}`);
