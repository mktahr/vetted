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

---

## ⚠️ Open pricing questions for Crust rep

The public docs and Matt's contract CSV disagree on multiple endpoints. Confirm each before sizing any backfill or production import workflow.

### Q1 — Person enrich base cost

| Source | Number |
|---|---|
| Public docs (`/person-docs/enrichment/introduction`) | **1 credit base** + add-ons (+2 personal email, +2 phone, +1 business email, +1 dev platform) → max **7 credits/profile** |
| Matt's contract CSV | **3 credits per record IN-DB** flat |

**Is the contractual rate the 1-credit-with-add-ons model or the 3-credit-flat model?** And if 3 credits is flat, do add-ons (email, phone) further increase it, or are they bundled?

### Q2 — Person search per-record cost

| Source | Number |
|---|---|
| Public docs (`/person-docs/search/introduction`) | **0.03 credits per result returned** |
| Matt's contract CSV (single-record line) | **1 credit per record** |
| Matt's contract CSV (100-record IN-DB line) | **1 credit per 100 records (batch)** |

**Three-way conflict.** Which is contractual? If 1 credit/record is right, that's a 33× markup over the public docs. If 1 credit/100 records (batch) is right at scale, the math flips dramatically toward search-heavy approaches.

### Q3 — Company search per-record cost

Same shape as Q2:

| Source | Number |
|---|---|
| Public docs (`/general/pricing`) | **0.03 credits per result** |
| Matt's contract CSV ("Company search - 1 record") | **1 credit per record** |
| Matt's contract CSV ("Company search - 100 records (IN-DB)") | **1 credit per 100 records (batch)** ← ambiguous wording |

Same question: which is contractual? Reading 2 (1 credit per 100 records batched) would dramatically lower the cost of a search-then-enrich waterfall (see investigation report 2026-05-01).

### Q4 — Company enrich cost

| Source | Number |
|---|---|
| Public docs (`/general/pricing`) | **2 credits per record** flat |
| Matt's contract CSV | **1 credit per record IN-DB**, **5 credits Live** |

**Is the 1 IN-DB / 5 Live structure contractual?** And are there per-section add-ons (analogous to the person enrich +2 email +2 phone model) that we'd incur depending on which `fields[]` we request?

### Q5 — Live endpoints (separate URL or parameter)

The openapi-specs introduction lists Live as **separate endpoints**:
- `/person/professional_network/enrich/live`
- `/person/professional_network/search/live`

But `/person/enrich` accepts `force_fetch: true` and `enrich_realtime: true` parameters that may also trigger fresh-from-source behavior.

**Are `force_fetch=true`, `enrich_realtime=true` on `/person/enrich` equivalent to calling `/person/professional_network/enrich/live` (and so cost 5 credits per call when set)?** Or are those parameters orthogonal cache-bypass mechanisms within the IN-DB endpoint at 1-credit cost?

### Q6 — Add-on stacking on Live

Person enrich IN-DB explicitly has add-on costs (+2 personal email, etc.). Does Live (5 credits base) also stack add-ons, or is 5 credits all-inclusive?

### Q7 — Volume discount mechanics

CSV shows tier discounts at 250k / 500k / 1m / 3m / 6m / 10m credits/month. Are these:
- (a) Hard floors — you commit to a monthly minimum at a given tier
- (b) Effective rates — you pay what you use, and whatever month's volume puts you in determines that month's rate
- (c) Mixed — base commitment + overage pricing

The "12-month minimum term" line at the top of the CSV suggests (a) or (c). Affects whether sporadic 1,500-company backfills should be batched into one billing month or spread out.

---

## Resolution path

When Crust answers, update this file's "Per-call credit cost" table at the top with the contractual numbers, mark Q1–Q7 as RESOLVED with the answer, and update the cost projections in the Vetted Companies V1 investigation report. Until then, **all dollar estimates are assuming Reading 1 (per-record CSV) as the conservative case** — the real number could be 33× lower if Reading 2 (batched search) holds.
