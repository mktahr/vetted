// lib/network/canonicalize-url.ts
//
// LinkedIn URL canonicalizer for the network-connections module.
//
// LOAD-BEARING. This is how uploaded connection URLs (a) dedupe within an org,
// (b) reuse cross-silo enrichment, and (c) match the global `people` pool.
// people.linkedin_url is stored raw/un-normalized, so BOTH sides must be run
// through this function at compare time — never compare a raw URL to a
// canonical one.
//
// Canonical form: `linkedin.com/in/<slug>` — protocol, www/locale subdomain,
// query string, fragment, and trailing slash all stripped; slug lowercased.
// Returns null for anything that is not a resolvable /in/<slug> profile URL
// (blank, email, company page, malformed, etc.).

const LINKEDIN_HOST_RE = /(^|\.)linkedin\.com$/i;

/**
 * Normalize a LinkedIn profile URL to `linkedin.com/in/<slug>`.
 * Returns null when no /in/<slug> identity can be extracted.
 */
export function canonicalizeLinkedInUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;

  // Strip surrounding quotes a CSV export sometimes leaves behind.
  s = s.replace(/^["']+|["']+$/g, '').trim();
  if (!s) return null;

  // Reject obvious non-URLs early (emails land in the URL column occasionally).
  if (/^mailto:/i.test(s) || (s.includes('@') && !s.includes('/'))) return null;

  // Ensure a protocol so the URL parser can read the host. Strip any leading
  // slashes first so "//linkedin.com/in/x" and "/in/x" don't confuse it.
  if (!/^https?:\/\//i.test(s)) {
    s = 'https://' + s.replace(/^\/+/, '');
  }

  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }

  const host = u.hostname.toLowerCase();
  if (!LINKEDIN_HOST_RE.test(host)) return null;

  // Extract the slug immediately following /in/ (any trailing path segments,
  // query, or fragment are ignored by the URL parser / this regex).
  const m = u.pathname.match(/\/in\/([^/?#]+)/i);
  if (!m) return null;

  let slug = decodeURIComponent(m[1] || '').toLowerCase().trim();
  slug = slug.replace(/\/+$/, '').trim();
  if (!slug) return null;

  return `linkedin.com/in/${slug}`;
}

/**
 * Convenience: true when two URLs resolve to the same canonical identity.
 * Both sides are canonicalized; null/unparseable never matches.
 */
export function sameLinkedInProfile(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ca = canonicalizeLinkedInUrl(a);
  const cb = canonicalizeLinkedInUrl(b);
  return ca !== null && ca === cb;
}
