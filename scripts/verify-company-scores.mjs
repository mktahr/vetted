// scripts/verify-company-scores.mjs
// Confirms company scores look reasonable.

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

// Fetch all company_year_scores joined with company names
const { data: scores } = await supabase
  .from('company_year_scores')
  .select('year, company_score, companies ( company_name, primary_industry_tag )')
  .order('year', { ascending: false });

if (!scores) {
  console.log('No data.');
  process.exit(0);
}

// Group by company
const byCompany = {};
for (const row of scores) {
  const name = row.companies?.company_name || 'UNKNOWN';
  if (!byCompany[name]) byCompany[name] = { industry: row.companies?.primary_industry_tag, years: [] };
  byCompany[name].years.push({ year: row.year, score: row.company_score });
}

console.log(`\nTotal company_year_scores rows: ${scores.length}`);
console.log(`Total companies with scores: ${Object.keys(byCompany).length}\n`);

console.log('Per-company breakdown:\n');
for (const [name, info] of Object.entries(byCompany)) {
  const years = info.years.sort((a, b) => a.year - b.year);
  const firstYear = years[0].year;
  const lastYear = years[years.length - 1].year;
  const minScore = Math.min(...years.map(y => y.score));
  const maxScore = Math.max(...years.map(y => y.score));
  const avgScore = (years.reduce((s, y) => s + y.score, 0) / years.length).toFixed(2);
  console.log(`  ${name.padEnd(28)} [${info.industry || '—'.padEnd(12)}] ${firstYear}-${lastYear} (${years.length} yrs), score ${minScore}-${maxScore}, avg ${avgScore}`);
}

// Check score distribution
const scoreCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
for (const row of scores) scoreCounts[row.company_score]++;
console.log('\nScore distribution (1=weak ... 5=elite):');
for (const [s, c] of Object.entries(scoreCounts)) {
  console.log(`  ${s}: ${c} (${((c / scores.length) * 100).toFixed(1)}%)`);
}
