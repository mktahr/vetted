# /company/search/autocomplete — Crust Company API (2025-11-01)

**Endpoint:** `POST https://api.crustdata.com/company/search/autocomplete`
**Cost: FREE** (per /general/pricing — "Useful for search UX and filter pickers.")
**Rate limit: 15 req/min default.**
**Headers:** `Authorization: Bearer <key>`, `x-api-version: 2025-11-01`

## Request

```yaml
type: object
required: [field, query]
properties:
  field:
    type: string
    description: Dataset field name to autocomplete
    valid_values:
      - basic_info.name
      - basic_info.primary_domain
      - basic_info.website
      - basic_info.professional_network_url
      - basic_info.professional_network_id
      - basic_info.company_type
      - basic_info.year_founded
      - basic_info.employee_count_range
      - basic_info.markets
      - basic_info.industries
      - revenue.estimated.lower_bound_usd
      - revenue.estimated.upper_bound_usd
      - revenue.acquisition_status
      - funding.total_investment_usd
      - funding.last_round_type
      - funding.last_fundraise_date
      - funding.investors
      - headcount.latest_count
      - headcount.largest_headcount_country
      - locations.country
      - locations.state
      - locations.city
      - taxonomy.professional_network_industry
      - taxonomy.professional_network_specialities
      - taxonomy.categories
      - followers.latest_count
      - social_profiles.crunchbase.url
      - social_profiles.twitter_url
  query:
    type: string
    description: Search text. Empty string returns top values by frequency.
  limit:
    type: integer
    minimum: 1
    maximum: 100
    default: 20
  filters:
    nullable: true
    description: Optional filter conditions (single SearchCondition or grouped)
```

## Response

```yaml
type: object
required: [suggestions]
properties:
  suggestions:
    type: array
    items:
      type: object
      properties:
        value: { type: string }
```

## Examples

```bash
# Industries autocomplete
{ "field": "basic_info.industries", "query": "tech", "limit": 5 }
→ ["Technology, Information and Media", "Information Technology & Services", "Biotechnology Research", ...]

# All HQ countries (top 10 by frequency)
{ "field": "locations.country", "query": "", "limit": 10 }

# Company name typeahead
{ "field": "basic_info.name", "query": "hub" }
```

## Errors

- 400: invalid field — error body lists `available_fields` in metadata
- 401: invalid/missing API key
- 500: internal_error

## Note on field-name differences vs filter API

The autocomplete `field` allowlist OVERLAPS with but is NOT IDENTICAL to the search-filter `field` allowlist. For example, `headcount.latest_count` is autocomplete-only; the filter API uses `headcount.total`. Always test against this list when picking a path.
