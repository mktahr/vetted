# /person/enrich — Crust Person Enrich (cached / IN-DB)

> Source: OpenAPI YAML spec from docs.crustdata.com (verified 2026-05-01).
> **The request body is SHARED with `/person/professional_network/enrich/live`** — see `09-person-live-enrich.md` for the live variant.

> ⚠️ **VERIFIED ACCOUNT BEHAVIOR (live probe 2026-06-28) — overrides the spec below in two places:**
> 1. **Omitting `fields` does NOT return all field groups on our account.** The default response is `basic_profile` + `social_handles` + `crustdata_person_id` ONLY — no experience / education / skills. To get the rich blob you MUST pass `fields` explicitly. Confirmed-working base-cost set: `['basic_profile','experience','education','skills']`. The OpenAPI "if omitted, all available fields are returned" claim is FALSE for our account.
> 2. **Our account is DENIED `certifications` and `honors`** — including either in `fields` returns `403 permission_error` and fails the ENTIRE call (not a partial result). Keep them out of the request.
> 3. Employer company name is under `name` (the embedded `company_name` field comes back `undefined`). Employer objects also carry `seniority_level`, `function_category`, `years_at_company`, `crustdata_company_id`, `company_professional_network_profile_url` — richer than the `/person/search` employer shape.
> 4. **This endpoint IS now called by application code** — `lib/network/enrich.ts` (network-connections enrichment) via `fetchPersonEnrich` in `lib/crust/api.ts`. (The "not currently called" note further down is obsolete.)

## Cost (3 sources — discrepancy)

| Source | Number |
|---|---|
| Public docs (`/person-docs/enrichment/introduction`) | **1 credit base** + add-ons (+2 personal email, +2 phone, +1 business email, +1 dev platform) → max **7 credits/profile** |
| OpenAPI YAML | `preview: true` → **0 credits** (basic profile fields only). No other cost disclosed in the spec. |
| Matt's contract CSV | **3 credits per record IN-DB** flat |

⚠️ See `05-pricing-and-rate-limits.md` Q1 — needs Crust rep confirmation.

**`preview: true` is free** — useful for high-volume "is this person in cache and what's their basic info" lookups without burning credits.

## Endpoint

`POST https://api.crustdata.com/person/enrich`

Headers: Bearer + `x-api-version: 2025-11-01`. Default rate limit: 15 req/min.

## OpenAPI spec (verbatim)

```yaml
paths:
  /person/enrich:
    post:
      tags: [Person APIs, Enrich APIs]
      summary: Enrich person profiles from cached dataset
      description: |
        Enrich person records using the Crustdata cached dataset. Provide either
        a profile URL or a business email to retrieve detailed person data
        including employment history, education, skills, contact information,
        and developer platform data when available.
        Exactly one identifier type must be provided per request.
        Supports batch enrichment of up to 25 profiles at once.
      operationId: enrichPersonDataset
      requestBody:
        required: true
        content:
          application/json:
            schema: $ref '#/components/schemas/PersonEnrichRequest'
            examples:
              enrich_by_profile_url:
                value:
                  professional_network_profile_urls:
                    - https://www.linkedin.com/in/abhilashchowdhary
              enrich_by_email:
                value:
                  business_emails:
                    - abhilash@crustdata.com
      responses:
        200: PersonEnrichResponse
        400: invalid_request (e.g. missing identifier)
        401: invalid API key
        403: permission denied or insufficient credits
        404: no data found
        500: internal_error

components:
  schemas:
    PersonEnrichRequest:
      properties:
        professional_network_profile_urls:
          type: array
          items: string
          maxItems: 25
        business_emails:
          type: array
          items: string
          format: email
        fields:
          type: array
          items: string
          description: |
            Valid field groups: basic_profile, professional_network, skills, contact,
            social_handles, experience, education, certifications, honors,
            dev_platform_profiles. Use dot-notation for nested fields.
            If omitted, all available fields are returned.
        min_similarity_score:
          type: number, minimum: 0, maximum: 1, nullable
          description: Minimum similarity score for email matching
        preview:
          type: boolean, default: false
          description: |
            Preview mode returns only basic profile fields and charges 0 credits.
            Cannot be combined with enrich_realtime.
      oneOf:
        - required: [professional_network_profile_urls]
        - required: [business_emails]
      additionalProperties: false
      description: |
        Request body for /person/enrich AND /person/professional_network/enrich/live.
        Submit exactly one identifier type per request.
```

⚠️ The OpenAPI YAML mentions `preview` cannot be combined with `enrich_realtime`, but `enrich_realtime` is NOT in the request schema. The earlier narrative-style reference page (since deprecated/missing) listed `enrich_realtime` and `force_fetch` parameters. **They appear to have been removed in favor of the dedicated `/person/professional_network/enrich/live` endpoint.** Treat any code that uses those params as legacy.

## Response shape

```yaml
PersonEnrichResponse:
  type: array
  items: PersonEnrichResult

PersonEnrichResult:
  matched_on: string                      # the input value
  match_type: enum [professional_network_profile_url, business_email]
  matches: [PersonEnrichMatch]

PersonEnrichMatch:
  confidence_score: float                 # 0..1
  person_data: PersonEnrich

PersonEnrich:
  crustdata_person_id: integer
  basic_profile:
    name, headline, first_name, last_name, current_title, summary, languages[],
    last_updated, profile_picture_permalink,
    location: { city, state, country, continent, raw }
  professional_network:
    profile_picture_url, profile_picture_permalink, name, pronoun, headline,
    current_title, summary, location: {...},
    connections, followers, joined_date, verifications[], open_to_cards[],
    metadata: { last_scraped_source }
  skills:
    professional_network_skills: [string]
  contact:
    business_emails: [{ email, status: verified|unverified, last_updated, crustdata_company_id }]
    personal_emails: [{ email, status: verified|unverified, last_updated }]
    phone_numbers: [string]
    websites: [string]
  social_handles:
    professional_network_identifier: { profile_url }
    dev_platform_identifier: { profile_url }
    twitter_identifier: { slug }
  dev_platform_profiles: [PersonDevPlatformProfile]    # see below
  experience:
    employment_details:
      current: [PersonEmploymentDetails]
      past:    [PersonEmploymentDetails]
  certifications: [PersonCertification]
  education:
    schools: [PersonEducation]
  updated_at: string
```

### `PersonEmploymentDetails` (the embedded employer shape)

⚠️ **Different from the embedded employer shape in `/person/search` responses.** Includes more company-side metadata that's NOT in person search:

- `name`, `professional_network_id`, `title`, `description`, `location.raw`, `employment_type`, `start_date`, `end_date`, `is_default`
- `crustdata_company_id`, `company_website_domain`, `company_profile_picture_permalink`, `company_professional_network_profile_url`
- `seniority_level`, `function_category`, `years_at_company` (string), `years_at_company_raw` (number)
- **`company_headcount_latest` (integer)** — newer field
- **`company_headcount_range` (string)** — banded
- **`company_industries` (array of string)** — multi-industry
- **`company_professional_network_industry` (string)** — single-industry
- **`company_type`, `company_website`, `company_headquarters_country`, `company_hq_location`, `company_hq_location_address_components` (array)** — richer location/firmographic
- `position_id`, `business_email_verified`

**Why this matters for the Vetted build:** if we ever switch the candidate ingest path from `/person/search` to `/person/enrich` for richer per-experience company data, we'd unlock most of the company metadata we currently need a separate `/company/enrich` call for. Tradeoff: enrich is 1c/record min vs search 0.03/result. Worth a follow-up cost analysis.

### `PersonDevPlatformProfile` (e.g. GitHub)

`account_type`, `profile_url`, `name`, `email`, `location.raw`, `company_text`, `bio`, `website_url`, `profile_picture_url`, `is_hireable`, `is_site_admin`, `confidence_score`, `public_repo_count`, `followers`, `following`, `declared_handles[]`, `org_memberships[]`, `metadata: { created_at, last_scraped_source, last_updated }`

### `PersonCertification`

`name`, `issuing_organization`, `issue_date`, `expiration_date`, `credential_id`, `credential_url`, `source`

### `PersonEducation`

`school`, `degree`, `field_of_study`, `start_year`, `end_year`, `activities_and_societies`, `institute_logo_url`, `professional_network_id`

## Examples (verbatim from spec)

```bash
# By profile URL
curl -X POST https://api.crustdata.com/person/enrich \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "x-api-version: 2025-11-01" \
  -d '{"professional_network_profile_urls": ["https://www.linkedin.com/in/abhilashchowdhary"]}'

# By business email
curl -X POST https://api.crustdata.com/person/enrich \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "x-api-version: 2025-11-01" \
  -d '{"business_emails": ["abhilash@crustdata.com"]}'
```

Sample response:
```json
[{
  "matched_on": "https://www.linkedin.com/in/abhilashchowdhary",
  "match_type": "professional_network_profile_url",
  "matches": [{
    "confidence_score": 1,
    "person_data": {
      "basic_profile": {
        "current_title": "Co-Founder & CEO",
        "headline": "Co-founder at Crustdata (YC F24)",
        "name": "Abhilash Chowdhary",
        "location": { "raw": "San Francisco, California, United States" }
      }
    }
  }]
}]
```

## Notes for our codebase

- **Called by `lib/network/enrich.ts`** (network-connections module) via `fetchPersonEnrich` in `lib/crust/api.ts`, which now passes `fields: ['basic_profile','experience','education','skills']` (see the verified-account-behavior banner at the top). Was previously uncalled.
- For company-side enrichment (the active V1 build target), see `03-company-enrich.md`.
- **`preview: true` (FREE)** is interesting: could be used for "does this person exist in Crust's cache?" pre-checks before deciding whether to spend credits on full enrich.
- The `PersonEmploymentDetails` shape is richer than what `/person/search` returns per experience — note the new fields (company_headcount_latest, company_industries, company_hq_location, etc.) for any future ingest-mapper work.
