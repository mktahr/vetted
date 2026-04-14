// scripts/seed-founding-years.mjs
// Populates founding_year for our 20 scored companies.
// Without this, early-stage detection can't work.

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

const FOUNDING_YEARS = {
  'Uber': 2009,
  'Airbnb': 2008,
  'Stripe': 2010,
  'Robinhood': 2013,
  'Coinbase': 2012,
  'Chime': 2012,
  'Bolt': 2014,
  'DoorDash': 2013,
  'Linear': 2019,
  'OpenAI': 2015,
  'Decagon': 2023,
  'SpaceX': 2002,
  'Anduril': 2017,
  'Google': 1998,
  'Google Deepmind': 2010,
  'Amazon': 1994,
  'Apple': 1976,
  'Microsoft': 1975,
  'Figma': 2012,
  'Meta': 2004,
};

let updated = 0;
let notFound = 0;

for (const [name, year] of Object.entries(FOUNDING_YEARS)) {
  const { data, error } = await supabase
    .from('companies')
    .update({ founding_year: year })
    .ilike('company_name', name)
    .select('company_id, company_name');

  if (error) {
    console.error(`  FAILED "${name}":`, error.message);
    continue;
  }
  if (!data || data.length === 0) {
    console.log(`  NOT FOUND: ${name}`);
    notFound++;
    continue;
  }
  console.log(`  ${name.padEnd(22)} → founded ${year}`);
  updated++;
}

console.log(`\n=== Done ===`);
console.log(`Companies updated: ${updated}`);
if (notFound > 0) console.log(`Not found: ${notFound}`);
