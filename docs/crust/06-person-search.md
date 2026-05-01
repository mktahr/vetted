# /person/search — Crust Person Search API (2025-11-01)

> Source: https://docs.crustdata.com/person-docs/search/reference (verified 2026-05-01).
> Used by the live admin import flow at `/admin/import` (the Crust Import V1 filter-builder).

**Cost (per public docs):** 0.03 credits per result returned.
**Cost (per Matt's contract CSV):** 1 credit per record (single-record search) — see `05-pricing-and-rate-limits.md` for the open reconciliation question.
**Rate limit:** 15 req/min default.

## Endpoint

`POST https://api.crustdata.com/person/search`

Headers:
- `Authorization: Bearer <CRUSTDATA_API_KEY>`
- `Content-Type: application/json`
- `x-api-version: 2025-11-01`

## Request body

```yaml
type: object
required: [filters]
properties:
  filters:                 # SearchCondition or SearchConditionGroup
    oneOf:
      - { field: string, type: operator, value: any }
      - { op: 'and'|'or', conditions: [SearchCondition|Group, ...] }
  fields:
    type: array            # dot-paths to limit response to specific sections
    items: string
  sorts:
    type: array
    items: { column: string, order: 'asc'|'desc' }
  limit:    { type: integer, minimum: 1, maximum: 1000, default: 20 }
  count:    { type: integer }                  # alias for limit
  cursor:   { type: string }                   # pagination
  post_processing:
    properties:
      exclude_profiles: { type: array, items: string }   # linkedin URLs to skip
  preview:  { type: boolean, default: false }  # premium feature, account-gated
  return_query: { type: boolean }              # debug; behavior inconsistent
```

## Filter operators (7)

| Operator | Meaning |
|---|---|
| `=` | exact match |
| `!=` | not equal |
| `>` / `<` | numeric/date comparison |
| `in` | membership in list (value MUST be array) |
| `not_in` | not in list (value MUST be array) |
| `(.)` | regex / contains substring match |
| `geo_distance` | location radius search |

⚠️ **NOT `>=` or `<=`** — those don't exist. Use `>` / `<` for strict, or for inclusive bounds use the autocomplete operators `=>` / `=<` if filter accepts them (verify per field).

## Searchable filter fields (sample — full list ~60 fields)

**Basic profile:** `basic_profile.name`, `.first_name`, `.last_name`, `.headline`, `.location.{raw, city, state, country, continent, full_location}`

**Experience:** `experience.employment_details.current.title`, `.company_name`, `.seniority_level`, `.function_category`, `.employment_type`, `.start_date`, `.end_date`, `.years_at_company_raw`, `.company_industries`, `.company_headcount_range`, `.company_hq_location`, `.company_website_domain`, `.company_type`. Also `.past.*` parallel fields.

**Education:** `education.schools.school`, `.degree`, `.field_of_study`

**Skills:** `skills.professional_network_skills`

**Certifications:** `certifications.name`, `.issuing_organization`, `.issue_date`

**Honors:** `honors.title`

**Network:** `professional_network.connections`, `.open_to_cards`

**Contact:** `business_email_verified` (across roles)

⚠️ **`seniority_level` and `function_category` are filter-only** — they are NOT returned in responses. The preview table in the import UI shows `—` for those columns.

## Response shape

```json
{
  "profiles": [PersonProfile, ...],
  "next_cursor": "<base64>",   // null when exhausted
  "total_count": 12345
}
```

### Profile sections (returned based on `fields` parameter)

- **basic_profile** — name, headline, current_title, location, summary
- **experience** — employment_details.current[], employment_details.past[]
  - Each employer: name, title, location, start_date, end_date, employment_type, is_default, professional_network_id, crustdata_company_id, company_profile_picture_permalink, company_professional_network_profile_url
- **education** — schools[] with `{ school, degree, start_year, end_year, professional_network_id }`
- **skills** — professional_network_skills[]
- **contact** — has_business_email, has_personal_email, has_phone_number (booleans only — search doesn't return the actual emails/phones)
- **social_handles** — professional_network_identifier.profile_url, dev_platform_identifier.profile_url, twitter_identifier.slug
- **professional_network** — connections, profile_picture_permalink

## Sortable fields

`crustdata_person_id`, `metadata.updated_at`, `basic_profile.name`, `basic_profile.location.*`, `professional_network.connections`, plus dates and company IDs.

## Errors

| Status | Condition |
|---|---|
| 400 | unsupported field, wrong operator, malformed filters, preview unavailable |
| 401 | invalid/missing API key |
| 403 | permission denied or insufficient credits |
| 500 | server error — retry with exponential backoff |

**No results:** 200 with `{"profiles": [], "total_count": 0}`.

## Preview mode

Premium feature, account-gated. `preview: true` returns lightweight results faster. **Our current plan returns "PersonDB preview feature is not available for your account"** — falls back to a normal limit=50 fetch (still a sample, just uses credits per result). Re-enable when account is upgraded.

## Example request

```bash
curl -X POST https://api.crustdata.com/person/search \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "x-api-version: 2025-11-01" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "field": "experience.employment_details.current.title",
      "type": "(.)",
      "value": "Founder"
    },
    "preview": true,
    "limit": 2
  }'
```

## Notes for our codebase

- Live import path: `app/api/admin/crust-import/run/route.ts` (streaming NDJSON) and `preview/route.ts` (JSON sample).
- Filter builder: `lib/crust/build-filter.ts` translates `UIFilterState` → request body.
- Filter-side field paths (qualified, e.g. `basic_profile.location.country`) DIFFER from autocomplete-side paths (top-level shorthand). Don't unify — Crust will reject otherwise-valid fields when applied to the wrong API.
- Person v2 mapper: `lib/ingest/mappers/crust-v2.ts` — handles the embedded `experience.employment_details.{current,past}[]` shape.
