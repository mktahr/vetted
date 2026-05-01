# Crust Company API — Pricing & Rate Limits (verified 2026-05-01)

## Per-call credit cost

| Endpoint | Cost | Note |
|---|---|---|
| `POST /company/search` | **0.03 credits per result** | "Lightweight company discovery." Same rate as person search per existing `lib/crust/log.ts` |
| `POST /company/identify` | **FREE** | "Resolve a company from a domain or other supported identifier." |
| `POST /company/search/autocomplete` | **FREE** | "Useful for search UX and filter pickers." |
| `POST /company/enrich` | **2 credits per record** | "Flat-rate company enrichment." Per-call cost is per matched record returned, regardless of how many `fields` are requested. |

> "Pricing can change by plan, entitlement, and endpoint version. Confirm the current credit cost in your dashboard or with the Crustdata team before you plan production usage."

Credits expire 6 months after purchase.
No tiered/volume discounts documented for company endpoints.
No published USD↔credits conversion — varies by plan.

## Rate limits

- **Default: 15 requests per minute** for every documented endpoint.
- "Exact per-endpoint limits can change by plan and endpoint version" — verify in dashboard.
- 429 response on rate-limit breach.
- Retry-After header behavior + 429 body shape NOT documented.

## Crust's recommended client behavior

> "Spread traffic across the full minute instead of burst-sending"
> "Implement retry logic with exponential backoff and jitter"
> "Keep request queues bounded"
> "Deploy circuit breakers around non-critical enrichment flows"
> "Centralize throttling in one shared HTTP client"

## Implications for our build

**Backfill cost ceiling (1,500 companies, full enrich-all-fields):**
- Identify: free
- Enrich: 1,500 × 2 = **3,000 credits**

**Per-import-batch ongoing cost (Vetted Companies UI, e.g. 50-company batch):**
- Search (preview): 50 × 0.03 = 1.5 credits
- Search (full pull): up to 1,000 × 0.03 = 30 credits per page
- Identify (dedupe lookups): free
- Enrich on each new import: 50 × 2 = 100 credits per 50-company batch

**Wall-clock floor at 15 req/min:**
- 1,500 enrich calls = 100 minutes minimum (~1.7 hr)
- Same for any 1,500-call batch. Concurrency above 15/min returns 429.

**Strategy implications:**
- Identify-before-enrich is cheap (free identify) and improves match quality.
- Autocomplete is free → use aggressively in UI for filter pickers.
- Enrich is the cost driver. Reserve it for vetted-tier companies. Reference-tier (auto-created from candidate ingest) gets only what comes free in the person sub-object.
- Centralize ALL Crust calls behind a single throttled client (token bucket at 15/min), shared across `/api/admin/crust-import/*` routes.
