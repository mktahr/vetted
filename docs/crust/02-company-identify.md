# /company/identify — Crust Company API (2025-11-01)

> Match a company by name, website domain, profile URL, or Crustdata company ID.
> Returns one or more matches ranked by confidence score. This endpoint is useful
> for entity resolution before enrichment.

Current platform behavior returns a top-level array with one result per submitted
identifier. Each match currently includes `company_data.crustdata_company_id` and
`company_data.basic_info`.

**Exactly one identifier type must be provided per request.**

Default rate-limit: **15 req/min**.

## Request shape (shared with /company/enrich)

```yaml
CompanyEnrichRequest:
  type: object
  description: Raw request parameters from query string
  properties:
    names:                              { type: array, items: string, nullable: true }
    domains:                            { type: array, items: string, nullable: true }
    crustdata_company_ids:              { type: array, items: integer, nullable: true }
    professional_network_profile_urls:  { type: array, items: string, nullable: true }
    fields:
      type: array
      items: string
      description: |
        Field groups to include in `company_data`. Current platform behavior:
        when `fields` is omitted, only `crustdata_company_id` and `basic_info` are returned —
        sections such as `headcount`, `funding`, `people`, and `hiring` must be listed explicitly.

        Valid field groups for ENRICH:
          basic_info, revenue, headcount, funding, hiring, web_traffic, seo,
          competitors, employee_reviews, people, locations, taxonomy, followers,
          news, software_reviews, social_profiles, status

        Not valid for enrich: roles, skills (search-only).
    exact_match:
      type: boolean
      nullable: true
      description: Whether to use exact matching (null means auto-detect)
```

## Identify-specific behavior

- Exactly ONE of `names`, `domains`, `crustdata_company_ids`, `professional_network_profile_urls` per request.
- Optional `exact_match: true` for strict domain matching (still can return multiple records — see Cashfree example below).
- The `fields` parameter exists in the schema but **identify currently returns only `crustdata_company_id + basic_info` per match** regardless. To get richer data, follow with `/company/enrich`.

## Response shape

```yaml
CompanyIdentifyResponse:
  type: array
  description: Top-level array with one entry per submitted identifier
  items:
    IdentifyResult:
      properties:
        matched_on: { type: string, description: 'the specific input value (e.g. "google.com")' }
        match_type: { enum: [name, domain, crustdata_company_id, professional_network_profile_url] }
        matches:
          type: array
          items:
            IdentifyMatch:
              properties:
                confidence_score: { type: number, format: float, example: 0.95 }
                company_data:
                  CompanyIdentify:
                    properties:
                      crustdata_company_id: integer
                      basic_info:
                        properties:
                          crustdata_company_id, name, primary_domain, all_domains[],
                          website, professional_network_url, professional_network_id,
                          profile_name, logo_permalink, description, company_type,
                          year_founded, employee_count_range, markets, industries[]
```

## Examples

### Identify by domain (single match)
Request: `{ "domains": ["serverobotics.com"] }`

```json
[{
  "matched_on": "serverobotics.com",
  "match_type": "domain",
  "matches": [{
    "confidence_score": 1,
    "company_data": {
      "crustdata_company_id": 628895,
      "basic_info": {
        "crustdata_company_id": 628895,
        "name": "Serve Robotics",
        "primary_domain": "serverobotics.com",
        "all_domains": ["serverobotics.com"],
        "website": "https://www.serverobotics.com/",
        "professional_network_url": "https://www.linkedin.com/company/serverobotics",
        "professional_network_id": "72049930",
        "profile_name": "Serve Robotics",
        "logo_permalink": "https://crustdata-media.s3.us-east-2.amazonaws.com/.../...jpg",
        "description": null, "company_type": null, "year_founded": null,
        "employee_count_range": "51-200", "markets": null,
        "industries": ["Technology, Information and Internet", "Technology, Information and Media"]
      }
    }
  }]
}]
```

### Identify by name (multiple matches with confidence_score=1 each)
Request: `{ "names": ["Serve Robotics"] }`

Returns three companies (Serve Robotics / Site Serve Robotics / iServe Robotics) — all confidence_score=1. **Multi-match by name is the norm; calling code must disambiguate using domain, profile_url, or admin choice.**

### Identify by profile URL
Request: `{ "professional_network_profile_urls": ["https://www.linkedin.com/company/mintlify"] }`

Single match; `crustdata_company_id` returned for chaining to enrich.

### Identify with exact_match=true on a multi-tenant domain
Request: `{ "domains": ["cashfree.com"], "exact_match": true }`

Still returns 3 records (Cashfree Payments / Cashfree Tech / WTFraud) — same domain, distinct LinkedIn pages. `exact_match` tightens domain matching but does not collapse multi-tenant domains.

### No match
Request: `{ "domains": ["thisdomaindoesnotexist12345xyz.com"] }`
Response: `[{ "matched_on": "...", "match_type": "domain", "matches": [] }]`

## Error responses

- `400 invalid_request` — e.g. "Exactly one identifier must be provided: crustdata_company_ids, names, domains, or professional_network_profile_urls"
- `401` invalid API key
- `403` identify not allowed for this account
- `404` no data found
- `500` internal_error
