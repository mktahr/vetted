# /company/enrich — Crust Company API (2025-11-01)

> Get comprehensive company data including firmographics, headcount, funding,
> web traffic, employee reviews, people (founders, CXOs, decision makers), news, and more.

**Cost: 2 credits per record** (per /general/pricing).
**Rate limit: 15 req/min default.**

## Request

```yaml
CompanyEnrichRequest:
  properties:
    names: { type: array, items: string, nullable: true }
    domains: { type: array, items: string, nullable: true }
    crustdata_company_ids: { type: array, items: integer, nullable: true }
    professional_network_profile_urls: { type: array, items: string, nullable: true }
    fields:
      type: array
      description: |
        WHEN OMITTED: only crustdata_company_id + basic_info returned.
        Must list explicitly: basic_info, revenue, headcount, funding, hiring,
        web_traffic, seo, competitors, employee_reviews, people, locations,
        taxonomy, followers, news, software_reviews, social_profiles, status.
        Invalid: roles, skills (search-only).
    exact_match: { type: boolean, nullable: true }
```

Exactly one identifier type per request. Multiple identifiers of one type ARE supported in a single call.

## Response — top-level array, one entry per submitted identifier

```yaml
[
  {
    matched_on: <input value>,
    match_type: name|domain|crustdata_company_id|professional_network_profile_url,
    matches: [
      { confidence_score: 0..1, company_data: CompanyEnrich }
    ]
  }
]
```

## CompanyEnrich nested schema

```yaml
crustdata_company_id: integer
metadata: { growth_calculation_date: string|null }

basic_info:
  crustdata_company_id, name, primary_domain, all_domains[], website,
  professional_network_url, professional_network_id, profile_name,
  logo_permalink, description, company_type ("Privately Held"|"Public Company"|"Partnership"|...),
  year_founded (string), employee_count_range ("51-200"), markets[], industries[]

revenue:
  estimated: { lower_bound_usd, upper_bound_usd, timeseries[] }
  public_markets: { ipo_date, stock_symbols[], fiscal_year_end }
  acquisition_status: string|null

headcount:
  total: integer
  largest_headcount_country: string
  timeseries: [{ date, employee_count }]                    # ← timeseries available!
  growth_percent / growth_absolute (objects keyed by window: 1m,3m,6m,12m)
  by_role_absolute / by_role_percent / by_role_growth_6m_pct / by_role_growth_yoy_pct
  by_region_absolute / by_region_percent
  by_skill_absolute / by_skill_percent
  by_function_timeseries:
    CURRENT_FUNCTION: { "Engineering": [{date, employee_count}], "Sales": [...] }
    GEO_REGION:       { "United States": [{date, employee_count}], ... }

funding:
  total_investment_usd, last_round_amount_usd, last_fundraise_date, last_round_type
  milestones: [{                                            # ← round-by-round!
    date, funding_date, amount_usd, round, investors, lead_investors
  }]
  investors: [string]
  investors_detailed: [{ name, uuid, type, categories[] }]
  acquisitions: [{ name, crustdata_company_id, date, amount_usd }]
  acquired_by:  [{ name, crustdata_company_id, date, amount_usd }]

hiring:
  recent_titles_csv, openings_count
  openings_growth_percent, by_function_qoq_pct, by_function_6m_pct
  open_jobs_timeseries: [{ date, open_jobs }]
  recent_openings: [{ title, location, posted_date, job_url, function }]

web_traffic:
  domain_traffic: { "<domain>": {
    monthly_visitors, mom_pct, qoq_pct,
    source_search_pct, source_direct_pct, source_social_pct,
    source_paid_referral_pct, source_referral_pct,
    monthly_visitors_timeseries[], source_*_pct_timeseries[]
  }}

seo:
  total_organic_results, average_seo_organic_rank, monthly_google_ads_budget,
  monthly_paid_clicks, monthly_organic_clicks, monthly_organic_value,
  average_ad_rank, total_ads_purchased,
  lost_ranked_seo_keywords, gained_ranked_seo_keywords, newly_ranked_seo_keywords

competitors: { company_ids[], websites[], all_domains[], paid_seo[], organic_seo[] }

employee_reviews:                                           # ← Glassdoor-style
  overall_rating: { rating, total_count, rating_{1,2,3,4,5}_count }
  company_ceo: { name, title, ceo_rating, ceo_ratings_count, profile_picture_url, ... }
  primary_industry: { name, sector_name }
  review_count, salary_count, interview_count, benefit_count, photo_count, global_job_count
  active_status, approval_status, mission
  culture_and_values_rating, diversity_and_inclusion_rating, work_life_balance_rating,
  senior_management_rating, compensation_and_benefits_rating, career_opportunities_rating,
  recommend_to_friend_rating, business_outlook_rating
  office_locations: [{ city_name, state, country, address_line1, lat, lon, ... }]
  awards: [{ name, source, year }]

people:                                                     # ← founders + CXOs!
  decision_makers: [PersonProfile]
  founders: [PersonProfile]
  cxos: [PersonProfile]

locations:
  country, headquarters, street_address, state, city,
  all_office_addresses: [string]                            # ← multi-office!

taxonomy:
  professional_network_specialities: [string]
  professional_network_industry: string|null
  professional_network_industries: [string]                 # ← plural form too
  categories: [string]
  primary_naics_detail: object|null
  sic_detail_list: [object]

news:
  [{ source, article_url, article_title, article_publisher_name,
     article_publish_date, publisher_domain, confidence_score }]

social_profiles:
  crunchbase: { url, uuid }
  twitter_url: string|null

status: { state: enriching | not_found }                    # ← async-enrich state machine

followers:
  count, mom_percent, qoq_percent, six_months_growth_percent, yoy_percent
  timeseries: [{ date, follower_count }]
```

## PersonProfile (referenced by `people.{decision_makers,founders,cxos}`)

```yaml
crustdata_person_id: integer|null
basic_profile:
  name, headline, current_title, summary
  languages: [string]
  last_updated, profile_picture_permalink
  location: { raw }
professional_network:
  profile_picture_url, profile_picture_permalink, name, headline, current_title,
  summary, location: { raw }, connections: integer
skills: { professional_network_skills: [string] }
social_handles:
  professional_network_identifier: { profile_url }
  twitter_identifier: { slug }
experience:
  employment_details:
    current: [PersonProfileEmployer]
    past:    [PersonProfileEmployer]
education:
  schools: [PersonProfileSchool]
updated_at: string|null

# PersonProfileEmployer — note these are LEGACY-shape keys, not the search-API keys
employer_name, employer_linkedin_id, employer_logo_url, employer_linkedin_description,
employer_company_id: [string], employer_website: [string],
employee_position_id, employee_title, employee_description, employee_location,
employee_start_date, employee_end_date

# PersonProfileSchool
school, degree, field_of_study, activities, notes
```

## Platform behaviors / quirks

1. **Default response without `fields` is sparse** — basic_info only. Always pass `fields` explicitly.
2. **Multi-identifier in one call:** submit several IDs of the same type in one request, get one result per ID in the top-level array.
3. **No-match returns 200 with empty `matches: []`** — not a 404.
4. **Exact domain match still returns multiple companies** when a single domain hosts multiple LinkedIn pages (e.g. `cashfree.com` returns Cashfree Payments, Cashfree Tech, WTFraud all at confidence_score=15/4/2 respectively).
5. **Async enrich:** `status.state = 'enriching'` indicates Crust is still hydrating data; may need re-poll.

## Errors

- 400 `invalid_request` — invalid field name (response includes `available_fields[]` in metadata)
- 401 unauthorized
- 403 enrich not allowed for account
- 404 no data
- 500 internal_error
