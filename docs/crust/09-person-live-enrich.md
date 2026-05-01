# /person/professional_network/enrich/live — Crust Person Live Enrich

> Source URL: https://docs.crustdata.com/person-docs/enrichment/live-enrich
> ⚠️ **Partial doc — Mintlify SPA rendering blocked WebFetch from scraping the full reference page on 2026-05-01.** What's captured here came from the openapi-specs introduction (which lists this endpoint) and the person enrichment introduction page (which references it). Re-pull this doc after Crust's docs site improves SSR, OR fetch it manually in browser.

## What we know

**Endpoint:** `POST https://api.crustdata.com/person/professional_network/enrich/live`

(NOT a parameter on `/person/enrich`. **Live is a SEPARATE endpoint** — confirmed by the openapi-specs introduction page on 2026-05-01.)

**Cost (per Matt's contract CSV):** **5 credits per record.**
> Pricing CSV row: "Live Person enrichment (pulled from source delivered to customer in seconds), 5"

**When to use** (paraphrasing the public introduction page):
> If the cached enrich response is missing a recent update or you need real-time retrieval from the web, use Person Live Enrich.

**Latency hint** (from CSV item description):
> "pulled from source delivered to customer in seconds"

→ Implies real-time scraping from LinkedIn / source platform. Slower than IN-DB but fresher.

**Rate limit:** 15 req/min default (assumed, same as other endpoints — verify).

## What we don't know

The narrative reference page (`/person-docs/enrichment/live-enrich`) wasn't reachable via the documentation scraper on 2026-05-01. Specifically unknown:

1. **Exact request body shape** — does it accept the same identifiers as `/person/enrich` (URLs, emails, IDs)? Or fewer (e.g. linkedin URL only)?
2. **Whether `force_fetch: true` or `enrich_realtime: true` on `/person/enrich` map to this endpoint** or to something else
3. **Response shape differences** — does Live return more sections than IN-DB? Different fields?
4. **Error codes for "source unreachable"** vs cache-miss
5. **Concurrency caps** — Live is presumably more expensive on Crust's side; lower rate limit possible
6. **Per-add-on cost** — does Live also have +2 personal email / +2 phone add-ons stacked on the 5-credit base? Or is 5 credits all-in?

## Sibling Live endpoint

Per the openapi-specs introduction:

`POST /person/professional_network/search/live` — "Search people in real time"

This is a Live variant of `/person/search`. Out of scope for our current Vetted Companies V1 build but worth noting.

## Open questions for Crust rep (added to `05-pricing-and-rate-limits.md`)

- Confirm the exact request shape for `/person/professional_network/enrich/live`.
- Are add-ons (personal email +2, phone +2, etc.) stackable on the 5-credit Live base, or does Live include them?
- What's the typical latency? (CSV says "delivered in seconds" — concrete bound?)
- What's the rate limit specifically for the `/professional_network/enrich/live` endpoint?

## Use cases for our build

Recruiting use case for Live Person Enrich is narrow:
- Resolving a stale candidate's current title/employer when they've recently changed jobs (and `metadata.updated_at` shows the IN-DB record is old)
- Ad-hoc "refresh from source" admin button on a single candidate's profile
- NOT for bulk imports — at 5 credits/record, a 100-candidate batch costs 500 credits which is 5–10× the IN-DB cost

For V1, we don't plan to wire Live into any path. Capturing the spec so it's documented for future use.
