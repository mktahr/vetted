#!/usr/bin/env node
// scripts/populate-company-urls.mjs
//
// Extracts company LinkedIn URLs from profile_snapshots raw_json
// (Crust v2 format) and populates companies.linkedin_url.
// Also uses guessDomain logic to populate website_url for scored companies.

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync('.env.local', 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=')
    return [k.trim(), v.join('=').trim()]
  })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ── Domain guesses for major companies ──────────────────────────────────────
const DOMAIN_OVERRIDES = {
  'google': 'google.com', 'google deepmind': 'deepmind.google', 'meta': 'meta.com',
  'amazon': 'amazon.com', 'amazon web services (aws)': 'aws.amazon.com',
  'apple': 'apple.com', 'microsoft': 'microsoft.com', 'netflix': 'netflix.com',
  'nvidia': 'nvidia.com', 'openai': 'openai.com', 'anthropic': 'anthropic.com',
  'stripe': 'stripe.com', 'spacex': 'spacex.com', 'tesla': 'tesla.com',
  'block': 'block.xyz', 'square': 'squareup.com', 'cash app': 'cash.app',
  'x corp': 'x.com', 'twitter': 'x.com', 'tiktok': 'tiktok.com',
  'bytedance': 'bytedance.com', 'instagram': 'instagram.com',
  'whatsapp': 'whatsapp.com', 'youtube': 'youtube.com', 'linkedin': 'linkedin.com',
  'github': 'github.com', 'figma': 'figma.com', 'slack': 'slack.com',
  'notion': 'notion.so', 'vercel': 'vercel.com', 'supabase': 'supabase.com',
  'shopify': 'shopify.com', 'airbnb': 'airbnb.com', 'uber': 'uber.com',
  'lyft': 'lyft.com', 'doordash': 'doordash.com', 'coinbase': 'coinbase.com',
  'robinhood': 'robinhood.com', 'plaid': 'plaid.com', 'ramp': 'ramp.com',
  'brex': 'brex.com', 'rippling': 'rippling.com', 'datadog': 'datadoghq.com',
  'snowflake': 'snowflake.com', 'databricks': 'databricks.com',
  'palantir technologies': 'palantir.com', 'anduril': 'anduril.com',
  'waymo': 'waymo.com', 'discord': 'discord.com', 'snap': 'snap.com',
  'pinterest': 'pinterest.com', 'reddit': 'reddit.com', 'spotify': 'spotify.com',
  'cloudflare': 'cloudflare.com', 'crowdstrike': 'crowdstrike.com',
  'scale ai': 'scale.com', 'hugging face': 'huggingface.co',
  'linear': 'linear.app', 'retool': 'retool.com', 'airtable': 'airtable.com',
  'mckinsey & company': 'mckinsey.com', 'boston consulting group (bcg)': 'bcg.com',
  'bain & company': 'bain.com', 'goldman sachs': 'goldmansachs.com',
  'jane street': 'janestreet.com', 'two sigma investments': 'twosigma.com',
  'citadel': 'citadel.com', 'd.e. shaw group': 'deshaw.com',
  'wiz': 'wiz.io', 'palo alto networks': 'paloaltonetworks.com',
}

function guessDomain(name) {
  const lower = name.toLowerCase().trim()
  if (DOMAIN_OVERRIDES[lower]) return DOMAIN_OVERRIDES[lower]
  const cleaned = lower.replace(/\s*(inc\.?|llc|ltd\.?|corp\.?|co\.?|technologies|labs|ai)\s*$/i, '').trim().replace(/[^a-z0-9]/g, '')
  return cleaned.length >= 3 ? `${cleaned}.com` : null
}

async function main() {
  // 1. Extract company LinkedIn URLs from all profile snapshots
  console.log('Fetching profile snapshots...')
  let allSnaps = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('profile_snapshots')
      .select('raw_json')
      .range(from, from + 999)
    if (error) { console.error(error); break }
    if (!data || data.length === 0) break
    allSnaps = allSnaps.concat(data)
    if (data.length < 1000) break
    from += 1000
  }
  console.log(`Processing ${allSnaps.length} snapshots...`)

  // Build company_name → linkedin_url map from Crust data
  const companyLinkedIn = {}
  for (const snap of allSnaps) {
    let raw = snap.raw_json
    if (typeof raw === 'string') try { raw = JSON.parse(raw) } catch { continue }
    if (!raw || typeof raw !== 'object') continue

    // Crust v2 format
    const exp = raw.experience?.employment_details
    if (exp) {
      const all = [...(exp.current || []), ...(exp.past || [])]
      for (const e of all) {
        const name = e.name?.trim()
        const url = e.company_professional_network_profile_url
        if (name && url && url.startsWith('http') && !companyLinkedIn[name.toLowerCase()]) {
          companyLinkedIn[name.toLowerCase()] = { name, url }
        }
      }
    }
  }
  console.log(`Found ${Object.keys(companyLinkedIn).length} unique company LinkedIn URLs from Crust data`)

  // 2. Fetch all companies
  let allCompanies = []
  from = 0
  while (true) {
    const { data } = await supabase.from('companies').select('company_id, company_name, linkedin_url, website_url').range(from, from + 999)
    if (!data || data.length === 0) break
    allCompanies = allCompanies.concat(data)
    if (data.length < 1000) break
    from += 1000
  }
  console.log(`Processing ${allCompanies.length} companies...`)

  let linkedinUpdated = 0
  let websiteUpdated = 0

  for (const co of allCompanies) {
    const updates = {}
    const lower = co.company_name.toLowerCase().trim()

    // LinkedIn URL
    if (!co.linkedin_url) {
      const match = companyLinkedIn[lower]
      if (match) {
        updates.linkedin_url = match.url
      }
    }

    // Website URL
    if (!co.website_url) {
      const domain = guessDomain(co.company_name)
      if (domain) {
        updates.website_url = `https://${domain}`
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('companies').update(updates).eq('company_id', co.company_id)
      if (!error) {
        if (updates.linkedin_url) linkedinUpdated++
        if (updates.website_url) websiteUpdated++
      }
    }
  }

  console.log(`\nDone.`)
  console.log(`  LinkedIn URLs populated: ${linkedinUpdated}`)
  console.log(`  Website URLs populated: ${websiteUpdated}`)
}

main()
