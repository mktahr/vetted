# /person/search/autocomplete — Crust Person Autocomplete

> Source: https://docs.crustdata.com/person-docs/autocomplete/reference (verified 2026-05-01).
> Used by `app/api/admin/crust-import/autocomplete/route.ts` for filter pickers in the import UI.

**Cost:** Free.
**Rate limit:** 15 req/min default.

## Endpoint

`POST https://api.crustdata.com/person/search/autocomplete`

Headers: Bearer + `x-api-version: 2025-11-01`.

## Request body

```yaml
type: object
required: [field, query]
properties:
  field:
    type: string
    description: Autocomplete-enabled dataset field for suggestions
  query:
    type: string
    description: Partial text to match. Empty string returns top values by frequency.
  limit:
    type: integer
    minimum: 1
    maximum: 100
    default: 20
  filters:
    nullable: true
    description: Optional filter conditions to scope the autocomplete results
    oneOf:
      - AutocompleteFilterCondition: { field, type: operator, value }
      - AutocompleteFilterConditionGroup: { op: 'and'|'or', conditions[] }
```

## Autocomplete-enabled `field` values (verbatim from docs)

**Current employment:**
- `experience.employment_details.current.title`
- `experience.employment_details.current.name` (alias: `.company_name`)
- `experience.employment_details.current.seniority_level`
- `experience.employment_details.current.function_category`
- `experience.employment_details.current.company_industries`
- `experience.employment_details.current.company_type`
- `experience.employment_details.current.company_hq_location`
- `experience.employment_details.current.company_website_domain`

**Past employment:**
- `experience.employment_details.past.title`
- `experience.employment_details.past.name`

**Profile & location:**
- `basic_profile.name`, `.headline`, `.languages`
- `basic_profile.location.raw`, `.city`, `.state`, `.country`, `.continent`
- `professional_network.location.city`, `.state`, `.country`, `.continent`

**Education:**
- `education.schools.school`
- `education.schools.degree`
- `education.schools.field_of_study`

**Skills & credentials:**
- `skills.professional_network_skills`
- `certifications.name`
- `certifications.issuing_organization`
- `honors.title`

**Social:**
- `social_handles.twitter_identifier.slug`

⚠️ **The autocomplete field allowlist OVERLAPS but is NOT IDENTICAL to the search-filter allowlist.** A field accepted by `/person/search` may be rejected by `/person/search/autocomplete` and vice versa. `lib/crust/types.ts::AUTOCOMPLETE_FIELDS` maps our UI keys to autocomplete-side paths; `lib/crust/build-filter.ts` uses filter-side paths. Don't unify.

## Supported operators (in optional `filters`)

`=`, `!=`, `<`, `=<`, `>`, `=>`, `in`, `not_in`, `contains`

⚠️ **Use `=>` and `=<`** (not `>=` / `<=`).

## Response

```yaml
type: object
required: [suggestions]
properties:
  suggestions:
    type: array
    items:
      value: string
```

200 with `{ "suggestions": [] }` on no matches.

## Errors

| Status | Condition |
|---|---|
| 400 | unsupported field, missing required param, wrong value shape |
| 401 | invalid/missing API key |
| 500 | server error |

## Behaviors

- **Ranking:** suggestions ordered by internal frequency (not exposed in response).
- **Case sensitivity:** `"vp"` and `"VP"` return same suggestions but values are returned distinctly.
- **Multi-token queries:** may match single tokens.
- **Blank suggestions:** empty queries can return `""` if many records lack values for the field.

## Examples

```bash
# Industries autocomplete
{ "field": "experience.employment_details.current.company_industries", "query": "tech", "limit": 5 }

# Seniority levels
{ "field": "experience.employment_details.current.seniority_level", "query": "" }

# Schools typeahead
{ "field": "education.schools.school", "query": "stan" }
```

## Notes for our codebase

- All four sidebar pickers in `/admin/import` (function_category, seniority_level, industries, skills, schools, degrees, fields_of_study, country, region, city) hit this endpoint via `app/api/admin/crust-import/autocomplete/route.ts`.
- Free → use aggressively in UI without throttling concerns beyond the 15 req/min rate cap.
