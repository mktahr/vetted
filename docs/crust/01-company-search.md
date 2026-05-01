# /company/search — Crust Company API (2025-11-01)

> Search the Crustdata company database using filter conditions. Supports complex
AND/OR filter logic, cursor-based pagination, sorting, and field selection.
Only indexed fields are searchable; use /company/enrich for non-indexed fields
like news, people, or web_traffic.

Default rate-limit: **15 req/min** (contact gtm@crustdata.co for higher).

## OpenAPI

```yaml /openapi-specs/2025-11-01/company.yaml post /company/search
openapi: 3.0.3
info:
  title: Company API Uber Schema
  version: '2025-11-01'
  description: >
    The Crustdata Company API provides access to comprehensive company data
    including firmographics, headcount, funding, web traffic, employee reviews, and more.
    Use Search to find companies by filters, Identify to match a company from partial info,
    Enrich to get full company profiles, and Autocomplete to discover valid filter values.

    All requests require a valid API key passed via the Authorization header and an
    x-api-version header set to the API version (e.g., "2025-11-01").
servers:
  - url: https://api.crustdata.com
    description: Production API server
security:
  - bearerAuth: []
tags:
  - name: Company APIs
    description: Core company data endpoints for search, identification, and enrichment
  - name: Search APIs
    description: Endpoints for searching the company database
  - name: Identify APIs
    description: Endpoints for identifying companies from partial information
  - name: Enrich APIs
    description: Endpoints for enriching company data with comprehensive profiles
  - name: Autocomplete APIs
    description: Endpoints for autocompleting field values in search queries

paths:
  /company/search:
    post:
      tags: [Company APIs, Search APIs]
      summary: Search companies with indexed fields only
      operationId: searchCompanyDataset
      parameters:
        - $ref: '#/components/parameters/ApiVersion'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CompanySearchRequest'
            examples:
              search_by_domain:
                value:
                  filters: { field: basic_info.primary_domain, type: '=', value: hubspot.com }
                  fields: [basic_info, headcount, funding]
                  limit: 1
              recently_funded_us_companies:
                value:
                  filters:
                    op: and
                    conditions:
                      - { field: funding.last_fundraise_date, type: '>', value: '2024-01-01' }
                      - { field: funding.last_round_type, type: in, value: [series_a, series_b] }
                      - { field: locations.country, type: '=', value: USA }
                  fields: [basic_info.name, basic_info.primary_domain, funding]
                  limit: 2
                  sorts: [{ column: funding.last_round_amount_usd, order: desc }]
              mid_size_companies_with_growth:
                value:
                  filters:
                    op: and
                    conditions:
                      - { field: headcount.total, type: '>', value: 50 }
                      - { field: headcount.total, type: '<', value: 500 }
                      - { field: locations.country, type: '=', value: USA }
                  fields: [basic_info.name, basic_info.primary_domain, headcount.total, locations.country]
                  limit: 3
                  sorts: [{ column: headcount.total, order: desc }]
      responses:
        '200': # Companies matching the search criteria
        '400': # invalid_request — e.g. "Unsupported columns in conditions: ['invalid_field']"
        '401': # invalid API key
        '403': # search access not available
        '500': # internal_error

components:
  parameters:
    ApiVersion:
      name: x-api-version
      in: header
      required: true
      schema: { type: string, enum: ['2025-11-01'], default: '2025-11-01' }
  schemas:
    CompanySearchRequest:
      type: object
      additionalProperties: false
      properties:
        filters:
          oneOf:
            - $ref: '#/components/schemas/SearchCondition'
            - $ref: '#/components/schemas/SearchConditionGroup'
        cursor: { type: string, description: pagination cursor from previous response }
        limit: { type: integer, minimum: 1, maximum: 1000, default: 20 }
        sorts: { type: array, items: { $ref: '#/components/schemas/SearchSort' } }
        fields:
          type: array
          description: |
            Dot-notation fields. Valid top-level groups for SEARCH:
              basic_info, revenue, headcount, funding, hiring, seo, competitors,
              locations, taxonomy, followers, social_profiles, software_reviews,
              roles, skills, metadata, updated_at, indexed_at, crustdata_company_id.
            Fields not in the search index (news, people, web_traffic, employee_reviews)
            return empty for search — use enrich.
          items: { type: string }

    SearchCondition:
      type: object
      required: [field, type, value]
      properties:
        field:
          description: |
            Valid filter fields:
              crustdata_company_id, updated_at, indexed_at, metadata.growth_calculation_date,
              basic_info.{company_id, name, primary_domain, website, professional_network_url,
                          professional_network_id, company_type, year_founded, employee_count_range,
                          markets, industries},
              revenue.estimated.{lower_bound_usd, upper_bound_usd}, revenue.acquisition_status,
              funding.{total_investment_usd, last_round_amount_usd, last_fundraise_date,
                       last_round_type, investors, tracxn_investors},
              headcount.{total, largest_headcount_country},
              roles.distribution.* (per function), roles.growth_6m, roles.growth_yoy,
              locations.{country, state, city, headquarters},
              taxonomy.{professional_network_industry, categories},
              followers.{count, mom_percent, qoq_percent, six_months_growth_percent, yoy_percent},
              competitors.{company_ids, websites}
        type:
          enum: ['=', '!=', '<', '=<', '>', '=>', in, not_in, contains, not_contains,
                 is_null, is_not_null, '(.)', '[.]']
        value:
          oneOf: [string, number, integer, boolean, array]

    SearchConditionGroup:
      type: object
      required: [op, conditions]
      properties:
        op: { enum: [and, or] }
        conditions:
          type: array
          minItems: 1
          items:
            oneOf:
              - $ref: '#/components/schemas/SearchCondition'
              - $ref: '#/components/schemas/SearchConditionGroup'

    SearchSort:
      type: object
      required: [column, order]
      properties:
        column:
          description: |
            Valid sortable fields: crustdata_company_id, updated_at, indexed_at,
            metadata.growth_calculation_date, basic_info.{company_id, name, primary_domain,
            year_founded, employee_count_range}, revenue.estimated.{lower,upper}_bound_usd,
            funding.{total_investment_usd, last_round_amount_usd, last_fundraise_date},
            headcount.{total, largest_headcount_country}, followers.count, locations.country
        order: { enum: [asc, desc] }

    CompanySearch:
      type: object
      additionalProperties: false
      properties:
        crustdata_company_id: { type: integer }
        metadata:
          properties:
            growth_calculation_date: { type: string, nullable: true }
        basic_info:
          properties:
            crustdata_company_id: { type: integer, nullable: true }
            name: { type: string, nullable: true }
            primary_domain: { type: string, nullable: true }
            website: { type: string, nullable: true }
            professional_network_url: { type: string, nullable: true }
            professional_network_id: { type: string, nullable: true }
            company_type: { type: string, nullable: true }   # e.g. "Privately Held", "Public Company", "Partnership"
            year_founded: { type: string, nullable: true }    # NB: stringified
            employee_count_range: { type: string, nullable: true }  # e.g. "51-200"
            markets: { type: array, items: { type: string }, nullable: true }
            industries: { type: array, items: { type: string }, nullable: true }
        revenue:
          properties:
            estimated: { lower_bound_usd, upper_bound_usd }
            public_markets: { ipo_date, stock_symbols[], fiscal_year_end }
            acquisition_status: { type: string }
        headcount:
          properties:
            total: { type: integer }
            largest_headcount_country: { type: string, nullable: true }
        software_reviews:
          properties:
            review_count, average_rating,
            review_count_{mom,qoq,yoy}_pct
        funding:
          properties:
            total_investment_usd, last_round_amount_usd, last_fundraise_date,
            last_round_type, investors[]
        hiring:
          properties:
            openings_count,
            openings_growth_percent (object), by_function_qoq_pct (object),
            by_function_6m_pct (object)
        locations:
          properties: { country, state, city }
        social_profiles:
          properties:
            crunchbase: { url, uuid }, twitter_url
        taxonomy:
          properties:
            professional_network_specialities: [string],
            professional_network_industry: { type: string, nullable: true },
            categories: [string]
        followers:
          properties:
            count, mom_percent, qoq_percent, six_months_growth_percent, yoy_percent

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      description: API key passed as a Bearer token in the Authorization header.
```

## Response example (HubSpot, search by domain)

```json
{
  "companies": [{
    "basic_info": {
      "name": "HubSpot", "primary_domain": "hubspot.com", "website": "https://hubspot.com",
      "professional_network_url": "https://www.linkedin.com/company/hubspot",
      "professional_network_id": "68529", "company_type": "Public Company",
      "year_founded": "2006", "employee_count_range": "5001-10000",
      "markets": ["NYSE"], "industries": ["Software Development", "Technology, Information and Internet"]
    },
    "headcount": { "total": 11965 },
    "funding": {
      "total_investment_usd": 130000000, "last_round_amount_usd": 100000000,
      "last_fundraise_date": "2021-10-13", "last_round_type": "", "investors": []
    }
  }],
  "next_cursor": "H4sIAJj5zGkC_xXMMQ7CMAxA0...",
  "total_count": 264
}
```

## Recently-funded example

```json
{
  "companies": [
    { "basic_info": { "name": "Reflection AI", "primary_domain": "reflection.ai" },
      "funding": { "total_investment_usd": 2130000000, "last_round_amount_usd": 2000000000,
                   "last_fundraise_date": "2025-10-09", "last_round_type": "series_b",
                   "investors": ["Sequoia Capital", "NVIDIA", "Lightspeed Venture Partners"] }},
    { "basic_info": { "name": "Xaira Therapeutics", "primary_domain": "xaira.com" },
      "funding": { "total_investment_usd": 1000000000, "last_round_amount_usd": 1000000000,
                   "last_fundraise_date": "2024-04-23", "last_round_type": "series_a",
                   "investors": ["ARCH Venture Partners", "Sequoia Capital", "Lux Capital"] }}
  ],
  "next_cursor": "...", "total_count": 2819
}
```
