'use client'

import { useState } from 'react'

interface CompanyLogoProps {
  domain: string | null | undefined
  companyName: string | null | undefined
  size?: number
  className?: string
}

/**
 * Renders a company logo from logo.dev, falling back to a generic
 * initial-letter placeholder when no domain is available or the
 * image fails to load.
 */
export default function CompanyLogo({ domain, companyName, size = 24, className = '' }: CompanyLogoProps) {
  const [failed, setFailed] = useState(false)
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_API_KEY

  const initial = (companyName || '?')[0].toUpperCase()

  // If we have a domain and the key, try logo.dev
  if (domain && token && !failed) {
    // Strip protocol and trailing slashes if present
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
    const src = `https://img.logo.dev/${cleanDomain}?token=${token}&size=${size * 2}`

    return (
      <img
        src={src}
        alt={companyName || ''}
        width={size}
        height={size}
        className={`rounded flex-shrink-0 ${className}`}
        onError={() => setFailed(true)}
        loading="lazy"
      />
    )
  }

  // Placeholder: colored initial letter
  return (
    <div
      className={`flex items-center justify-center rounded bg-muted text-tertiary font-semibold flex-shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      title={companyName || undefined}
    >
      {initial}
    </div>
  )
}

/**
 * Derive a plausible domain from a company name when website_url is null.
 * This is a best-effort heuristic — not guaranteed to be correct.
 */
export function guessDomain(companyName: string | null | undefined): string | null {
  if (!companyName) return null
  // Well-known overrides for companies whose domain doesn't match their name
  const OVERRIDES: Record<string, string> = {
    'google': 'google.com',
    'google deepmind': 'deepmind.google',
    'meta': 'meta.com',
    'amazon': 'amazon.com',
    'amazon web services (aws)': 'aws.amazon.com',
    'apple': 'apple.com',
    'microsoft': 'microsoft.com',
    'netflix': 'netflix.com',
    'nvidia': 'nvidia.com',
    'openai': 'openai.com',
    'anthropic': 'anthropic.com',
    'stripe': 'stripe.com',
    'spacex': 'spacex.com',
    'tesla': 'tesla.com',
    'block': 'block.xyz',
    'square': 'squareup.com',
    'cash app': 'cash.app',
    'x corp': 'x.com',
    'twitter': 'x.com',
    'tiktok': 'tiktok.com',
    'bytedance': 'bytedance.com',
    'instagram': 'instagram.com',
    'whatsapp': 'whatsapp.com',
    'youtube': 'youtube.com',
    'linkedin': 'linkedin.com',
    'github': 'github.com',
    'figma': 'figma.com',
    'slack': 'slack.com',
    'notion': 'notion.so',
    'vercel': 'vercel.com',
    'supabase': 'supabase.com',
    'shopify': 'shopify.com',
    'airbnb': 'airbnb.com',
    'uber': 'uber.com',
    'lyft': 'lyft.com',
    'doordash': 'doordash.com',
    'coinbase': 'coinbase.com',
    'robinhood': 'robinhood.com',
    'plaid': 'plaid.com',
    'ramp': 'ramp.com',
    'brex': 'brex.com',
    'rippling': 'rippling.com',
    'datadog': 'datadoghq.com',
    'snowflake': 'snowflake.com',
    'databricks': 'databricks.com',
    'palantir technologies': 'palantir.com',
    'anduril': 'anduril.com',
    'waymo': 'waymo.com',
    'cruise': 'getcruise.com',
    'discord': 'discord.com',
    'snap': 'snap.com',
    'pinterest': 'pinterest.com',
    'reddit': 'reddit.com',
    'spotify': 'spotify.com',
    'cloudflare': 'cloudflare.com',
    'crowdstrike': 'crowdstrike.com',
    'palo alto networks': 'paloaltonetworks.com',
    'wiz': 'wiz.io',
    'scale ai': 'scale.com',
    'hugging face': 'huggingface.co',
    'linear': 'linear.app',
    'retool': 'retool.com',
    'airtable': 'airtable.com',
    'mckinsey & company': 'mckinsey.com',
    'boston consulting group (bcg)': 'bcg.com',
    'bain & company': 'bain.com',
    'goldman sachs': 'goldmansachs.com',
    'morgan stanley': 'morganstanley.com',
    'jpmorgan chase': 'jpmorgan.com',
    'jane street': 'janestreet.com',
    'two sigma investments': 'twosigma.com',
    'citadel': 'citadel.com',
    'citadel securities': 'citadelsecurities.com',
    'd.e. shaw group': 'deshaw.com',
    'susquehanna international group (sig)': 'sig.com',
  }

  const lower = companyName.toLowerCase().trim()
  if (OVERRIDES[lower]) return OVERRIDES[lower]

  // Generic fallback: strip common suffixes, convert to .com
  const cleaned = lower
    .replace(/\s*(inc\.?|llc|ltd\.?|corp\.?|co\.?|technologies|labs|ai)\s*$/i, '')
    .trim()
    .replace(/[^a-z0-9]/g, '')
  if (cleaned.length >= 2) return `${cleaned}.com`
  return null
}

/**
 * Derive a plausible .edu domain from a school name for logo lookup.
 */
export function guessSchoolDomain(schoolName: string | null | undefined): string | null {
  if (!schoolName) return null
  const lower = schoolName.toLowerCase().trim()

  const OVERRIDES: Record<string, string> = {
    'mit': 'mit.edu',
    'massachusetts institute of technology': 'mit.edu',
    'stanford': 'stanford.edu',
    'stanford university': 'stanford.edu',
    'harvard': 'harvard.edu',
    'harvard university': 'harvard.edu',
    'berkeley': 'berkeley.edu',
    'university of california, berkeley': 'berkeley.edu',
    'uc berkeley': 'berkeley.edu',
    'caltech': 'caltech.edu',
    'ucla': 'ucla.edu',
    'university of california, los angeles': 'ucla.edu',
    'uc san diego': 'ucsd.edu',
    'university of california, san diego': 'ucsd.edu',
    'nyu': 'nyu.edu',
    'penn': 'upenn.edu',
    'the wharton school': 'wharton.upenn.edu',
    'columbia': 'columbia.edu',
    'cornell university': 'cornell.edu',
    'princeton university': 'princeton.edu',
    'dartmouth': 'dartmouth.edu',
    'yale': 'yale.edu',
    'northwestern': 'northwestern.edu',
    'northwestern university': 'northwestern.edu',
    'university of chicago': 'uchicago.edu',
    'university of washington': 'uw.edu',
    'university of michigan': 'umich.edu',
    'university of texas at austin': 'utexas.edu',
    'the university of texas at austin': 'utexas.edu',
    'university of southern california': 'usc.edu',
    'university of oxford': 'ox.ac.uk',
    'university of cambridge': 'cam.ac.uk',
    'georgia institute of technology': 'gatech.edu',
    'carnegie mellon university': 'cmu.edu',
    'university of waterloo': 'uwaterloo.ca',
    'university of toronto': 'utoronto.ca',
    'the university of british columbia': 'ubc.ca',
    'university of colorado boulder': 'colorado.edu',
    'university of wisconsin-madison': 'wisc.edu',
    'university of minnesota-twin cities': 'umn.edu',
    'university of arizona': 'arizona.edu',
    'university of melbourne': 'unimelb.edu.au',
    'peking university': 'pku.edu.cn',
    'technion - israel institute of technology': 'technion.ac.il',
    'the hebrew university of jerusalem': 'huji.ac.il',
    'indian institute of technology, kharagpur': 'iitkgp.ac.in',
    'loyola marymount university': 'lmu.edu',
    'loyola marymount university, college of business administration': 'lmu.edu',
    'pasadena city college': 'pasadena.edu',
    'arizona state university': 'asu.edu',
    'clemson university': 'clemson.edu',
    'san francisco state university': 'sfsu.edu',
    'indiana university bloomington': 'iu.edu',
    'kent state university': 'kent.edu',
    'brandeis university': 'brandeis.edu',
    'middlebury college': 'middlebury.edu',
    'roger williams university': 'rwu.edu',
    'queensland university of technology': 'qut.edu.au',
    'griffith university': 'griffith.edu.au',
    'penn state college of information sciences and technology': 'psu.edu',
    'united states military academy': 'westpoint.edu',
    'united states naval academy': 'usna.edu',
    'united states air force academy': 'usafa.edu',
    'national defense university': 'ndu.edu',
    'the george washington university law school': 'law.gwu.edu',
    'hust': 'hust.edu.cn',
    'sun yat-sen university': 'sysu.edu.cn',
  }

  if (OVERRIDES[lower]) return OVERRIDES[lower]

  // Generic: strip "University of", "The", common suffixes, then .edu
  const cleaned = lower
    .replace(/^the\s+/, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/,.*$/, '')
    .replace(/[^a-z0-9]/g, '')
  if (cleaned.length >= 2) return `${cleaned}.edu`
  return null
}
