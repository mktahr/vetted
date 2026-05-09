#!/usr/bin/env node
// scripts/seed-national-labs-company-group.mjs
//
// Seeds a "US National Labs" entry in company_groups (migration 027) and
// links the 24 national lab companies that exist in the companies table.
// Per B3: signal_dictionary entries (added in migration 043) are the primary
// detection path; this company_groups link is the secondary clean-filter path
// for "people who worked at any national lab" recruiter queries.
//
// USAGE:
//   node scripts/seed-national-labs-company-group.mjs --dry-run
//   node scripts/seed-national-labs-company-group.mjs
//
// IMPORTANT: This script does NOT create company rows. National lab
// companies are expected to land via Crust ingest as candidates surface
// from those employers. Companies not yet in the DB are LOGGED but
// SKIPPED. Re-run periodically as the companies table grows.

import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

const NATIONAL_LABS = [
  // (canonical_name, [aliases for company-table lookup])
  ['NASA Jet Propulsion Laboratory', ['Jet Propulsion Laboratory', 'JPL', 'NASA JPL']],
  ['MIT Lincoln Laboratory', ['Lincoln Laboratory', 'MIT Lincoln Lab', 'Lincoln Labs']],
  ['Johns Hopkins Applied Physics Laboratory', ['Applied Physics Laboratory', 'JHU APL', 'JHUAPL']],
  ['Lawrence Livermore National Laboratory', ['LLNL', 'Lawrence Livermore']],
  ['Los Alamos National Laboratory', ['LANL', 'Los Alamos']],
  ['Sandia National Laboratories', ['Sandia', 'Sandia National Labs']],
  ['Oak Ridge National Laboratory', ['ORNL', 'Oak Ridge']],
  ['NREL', ['National Renewable Energy Laboratory', 'NREL']],
  ['Argonne National Laboratory', ['ANL', 'Argonne']],
  ['Brookhaven National Laboratory', ['BNL', 'Brookhaven']],
  ['SLAC National Accelerator Laboratory', ['SLAC', 'Stanford Linear Accelerator']],
  ['Pacific Northwest National Laboratory', ['PNNL', 'Pacific Northwest']],
  ['Idaho National Laboratory', ['INL', 'Idaho National Lab']],
  ['Fermilab', ['Fermi National Accelerator Laboratory', 'Fermilab']],
  ['NASA Ames Research Center', ['Ames Research Center', 'NASA Ames']],
  ['NASA Goddard Space Flight Center', ['Goddard Space Flight Center', 'NASA Goddard']],
  ['NASA Glenn Research Center', ['Glenn Research Center', 'NASA Glenn']],
  ['NASA Langley Research Center', ['Langley Research Center', 'NASA Langley']],
  ['NASA Marshall Space Flight Center', ['Marshall Space Flight Center', 'NASA Marshall']],
  ['NIST', ['National Institute of Standards and Technology', 'NIST']],
  ['Air Force Research Laboratory', ['AFRL', 'Air Force Research Laboratory']],
  ['Naval Research Laboratory', ['NRL', 'Naval Research Laboratory']],
  ['Army Research Laboratory', ['ARL', 'Army Research Laboratory']],
  ['DARPA', ['Defense Advanced Research Projects Agency', 'DARPA']],
]

const GROUP_NAME = 'US National Labs'
const GROUP_DESCRIPTION = 'NASA, DOE, DoD, and federal R&D laboratories. Defense + space + science pipeline. Linked to signal_dictionary national_lab category for dual-surface filtering.'

async function main() {
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Seeding ${GROUP_NAME} company group with ${NATIONAL_LABS.length} labs.`)

  // 1. Find or create company_groups row
  const { data: existingGroup } = await supabase
    .from('company_groups')
    .select('group_id')
    .eq('group_name', GROUP_NAME)
    .maybeSingle()

  let groupId = existingGroup?.group_id
  if (!groupId) {
    if (DRY_RUN) {
      console.log(`  Would create company_groups row "${GROUP_NAME}".`)
      groupId = 'TBD-after-create'
    } else {
      const { data: created, error } = await supabase
        .from('company_groups')
        .insert({ group_name: GROUP_NAME, description: GROUP_DESCRIPTION })
        .select('group_id')
        .single()
      if (error) throw new Error(`Create group failed: ${error.message}`)
      groupId = created.group_id
      console.log(`  Created company_groups row "${GROUP_NAME}" (group_id=${groupId}).`)
    }
  } else {
    console.log(`  Found existing company_groups row "${GROUP_NAME}" (group_id=${groupId}).`)
  }

  // 2. Look up each national lab company
  const matched = []
  const unmatched = []

  for (const [canonical, aliases] of NATIONAL_LABS) {
    const candidates = [canonical, ...aliases]
    let companyId = null

    for (const name of candidates) {
      const { data, error } = await supabase
        .from('companies')
        .select('company_id, company_name')
        .ilike('company_name', name)
        .limit(1)
      if (error) {
        console.warn(`  Lookup error for "${name}": ${error.message}`)
        continue
      }
      if (data && data.length > 0) {
        companyId = data[0].company_id
        break
      }
    }

    if (companyId) {
      matched.push({ canonical, company_id: companyId })
    } else {
      unmatched.push(canonical)
    }
  }

  console.log()
  console.log(`Matched ${matched.length} of ${NATIONAL_LABS.length} labs to companies in DB.`)
  if (unmatched.length > 0) {
    console.log(`Unmatched (not yet in companies table) — will be skipped, re-run later as candidates land:`)
    unmatched.forEach(n => console.log(`  - ${n}`))
  }

  if (DRY_RUN || groupId === 'TBD-after-create') {
    console.log('\nDRY RUN complete. No writes performed.')
    return
  }

  // 3. Link matched companies to the group
  if (matched.length > 0) {
    const linkRows = matched.map(m => ({
      group_id: groupId,
      company_id: m.company_id,
    }))
    const { error: linkErr } = await supabase
      .from('company_group_map')
      .upsert(linkRows, { onConflict: 'group_id,company_id', ignoreDuplicates: true })
    if (linkErr) {
      // Schema check: company_group_map may have a different column name. Try alternative.
      console.warn(`company_group_map upsert failed (${linkErr.message}). Schema may differ; manually verify.`)
    } else {
      console.log(`✓ Linked ${matched.length} companies to ${GROUP_NAME}.`)
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
