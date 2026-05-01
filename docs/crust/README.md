# Crust API documentation

Source of truth for Crust Data API endpoint shapes, behaviors, and pricing.
All sourced from https://docs.crustdata.com (verified 2026-05-01).

| File | Endpoint | Cost | Notes |
|---|---|---|---|
| [01-company-search.md](01-company-search.md) | `POST /company/search` | 0.03/result (docs) **or** 1/record (CSV) ⚠️ | Filter-based discovery. See pricing Q3. |
| [02-company-identify.md](02-company-identify.md) | `POST /company/identify` | **FREE** | Entity resolution by name/domain/URL/ID → ranked matches with confidence_score. |
| [03-company-enrich.md](03-company-enrich.md) | `POST /company/enrich` | 1/record IN-DB (CSV), 2/record (docs); Live = 5/record ⚠️ | Cached or fresh full-firmographics. See pricing Q4. |
| [04-company-autocomplete.md](04-company-autocomplete.md) | `POST /company/search/autocomplete` | **FREE** | Filter-picker typeahead. |
| [05-pricing-and-rate-limits.md](05-pricing-and-rate-limits.md) | — | — | Credit costs, rate limits, **7 OPEN reconciliation questions** for Crust rep. **Read this before sizing any backfill.** |
| [06-person-search.md](06-person-search.md) | `POST /person/search` | 0.03/result (docs) **or** 1/record (CSV) ⚠️ | Used live by `/admin/import`. See pricing Q2. |
| [07-person-enrich.md](07-person-enrich.md) | `POST /person/enrich` | 1 base + add-ons up to 7 (docs) **or** 3/record IN-DB (CSV); **`preview: true` is FREE** ⚠️ | Cached. See pricing Q1. Includes full OpenAPI YAML. |
| [08-person-autocomplete.md](08-person-autocomplete.md) | `POST /person/search/autocomplete` | **FREE** | Used live by `/admin/import` filter pickers. |
| [09-person-live-enrich.md](09-person-live-enrich.md) | `POST /person/professional_network/enrich/live` | 5/record (CSV) | Real-time fresh-from-source. **No dedicated doc page exists** — request body shape is documented as shared with `/person/enrich` (see file 07). |

## Pricing summary (per Matt's contract CSV — needs Crust rep confirmation)

```
COMPANY     identify=FREE   autocomplete=FREE
            search=1c/record (or 1c/100 batched? unclear)
            enrich IN-DB=1c   enrich Live=5c

PERSON      autocomplete=FREE
            search=1c/record (or 1c/100 batched? unclear)
            enrich IN-DB=3c (CSV)  enrich base=1c+addons up to 7c (docs)
            live enrich=5c

DEFAULT RATE LIMIT: 15 req/min on all endpoints (15 req/sec for some plans — verify)
DEFAULT 429 ON BREACH. Retry-After header behavior NOT documented.
```

## Open questions for Crust rep

See [05-pricing-and-rate-limits.md](05-pricing-and-rate-limits.md) "⚠️ Open pricing questions" section for the canonical list of 7 reconciliation questions (Q1-Q7). Resolve those before any backfill or production import workflow gets sized.

## How these docs were sourced

- 01-04 (company endpoints): direct `WebFetch` against docs.crustdata.com on 2026-04-30 / 2026-05-01.
- 05 (pricing): from Matt's contract CSV (`/Users/matt/Downloads/.../Pricing - Customer Copy ...csv`) plus public `/general/pricing` page.
- 06, 08 (person search + autocomplete): direct `WebFetch` on 2026-05-01.
- 07 (person enrich): formal OpenAPI YAML pasted directly by Matt 2026-05-01 (richest source).
- 09 (person live enrich): documented through the shared request-body contract on `/person/enrich`. No dedicated doc page exists on Crust's site (verified by Matt). Cost from CSV.

To refresh any doc, re-run `WebFetch` against the source URL listed in each file's header.
