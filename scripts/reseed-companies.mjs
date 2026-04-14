// scripts/reseed-companies.mjs
// Re-seeds companies + company_year_scores from the latest CSV.
// Clears existing year scores per company before inserting to avoid duplicates.

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

const CSV_PATH = '/Users/matt/Downloads/Vetted - Original Tech Startup Focus   - Company Scoring (4).csv';

const raw = readFileSync(CSV_PATH, 'utf-8');
const lines = raw.split('\n').filter(l => l.trim().length > 0);
const headers = lines[0].split(',').map(h => h.trim());
const yearColumns = headers.slice(2).map(h => parseInt(h, 10)).filter(y => !isNaN(y));

let companiesUpserted = 0;
let scoresInserted = 0;
let scoresDeleted = 0;
let errors = 0;

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(',');
  const companyName = (cols[0] || '').trim();
  const industryTag = (cols[1] || '').trim() || null;
  if (!companyName) continue;

  // Upsert company (case-insensitive find)
  const { data: existing } = await supabase
    .from('companies')
    .select('company_id')
    .ilike('company_name', companyName)
    .maybeSingle();

  let companyId;
  if (existing) {
    companyId = existing.company_id;
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
      console.error(`  FAILED to create "${companyName}":`, error.message);
      errors++;
      continue;
    }
    companyId = created.company_id;
  }
  companiesUpserted++;

  // Delete existing year scores for this company
  const { count: delCount, error: delErr } = await supabase
    .from('company_year_scores')
    .delete({ count: 'exact' })
    .eq('company_id', companyId);
  if (delErr) {
    console.error(`  FAILED delete scores for "${companyName}":`, delErr.message);
  } else if (delCount) {
    scoresDeleted += delCount;
  }

  // Insert fresh year scores
  const rows = [];
  for (let j = 0; j < yearColumns.length; j++) {
    const year = yearColumns[j];
    const scoreStr = (cols[j + 2] || '').trim();
    if (!scoreStr) continue;
    const score = parseInt(scoreStr, 10);
    if (isNaN(score) || score < 1 || score > 5) continue;
    rows.push({ company_id: companyId, year, company_score: score });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('company_year_scores').insert(rows);
    if (error) {
      console.error(`  FAILED insert scores for "${companyName}":`, error.message);
      errors++;
    } else {
      scoresInserted += rows.length;
    }
  }

  console.log(`  ${companyName.padEnd(22)} [${(industryTag || '—').padEnd(10)}] ${rows.length} year scores`);
}

console.log(`\n=== Done ===`);
console.log(`Companies upserted: ${companiesUpserted}`);
console.log(`Old year scores deleted: ${scoresDeleted}`);
console.log(`New year scores inserted: ${scoresInserted}`);
if (errors > 0) console.log(`Errors: ${errors}`);
