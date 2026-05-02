# Investigation 1 — Data Delta Report

*Generated: 2026-05-02T03:16:22.825Z*

*Tested 10 companies via /company/identify → /company/search → /company/enrich.*  
*Raw JSON: `docs/vetted-companies-v1/02-data-delta-raw.json`*


## Per-company comparison

### Anduril Industries
*well-known · crustdata_company_id: 639939 · expected category: hardware · identify returned 1 match*

| field | search | enrich |
|---|---|---|
| `basic_info.name` | "Anduril Industries" | "Anduril Industries" |
| `basic_info.primary_domain` | "anduril.com" | "anduril.com" |
| `basic_info.website` | "http://www.anduril.com" | "http://www.anduril.com" |
| `basic_info.professional_network_url` | "https://www.linkedin.com/..." | "https://www.linkedin.com/..." |
| `basic_info.professional_network_id` | "18293159" | "18293159" |
| `basic_info.company_type` | "Privately Held" | "Privately Held" |
| `basic_info.year_founded` | "2017" | "2017-01-01" |
| `basic_info.employee_count_range` | "1001-5000" | "1001-5000" |
| `basic_info.industries` | [3] | [3] |
| `basic_info.description` | MISSING | "Anduril is not a traditio..." |
| `headcount.total` | 7218 | 7218 |
| `headcount.timeseries` | MISSING | [169] |
| `taxonomy.professional_network_industry` | "Defense and Space Manufac..." | "Defense and Space Manufac..." |
| `taxonomy.categories` | [7] | [7] |
| `locations.country` | "USA" | MISSING |
| `locations.headquarters` | MISSING | "Orange, California, Unite..." |
| `locations.all_office_addresses` | MISSING | [6] |
| `funding.total_investment_usd` | 6375670000 | 6375670000 |
| `funding.last_round_type` | "grant" | "grant" |
| `funding.last_round_amount_usd` | 150000 | 150000 |
| `funding.last_fundraise_date` | "2026-01-29" | "2026-01-29" |
| `funding.investors` | [58] | [58] |
| `funding.milestones` | MISSING | [12] |
| `funding.acquisitions` | MISSING | [7] |
| `people.founders` | MISSING | EMPTY[] |
| `people.cxos` | MISSING | EMPTY[] |
| `people.decision_makers` | MISSING | [7] |
| `social_profiles.crunchbase.uuid` | "41d91de0-370f-41c9-84f9-0..." | "41d91de0-370f-41c9-84f9-0..." |
| `social_profiles.twitter_url` | "https://x.com/anduriltech" | "https://x.com/anduriltech" |
| `employee_reviews.overall_rating.rating` | MISSING | 3.9 |

### Stripe
*well-known · crustdata_company_id: 631394 · expected category: non_hardware · identify returned 18 matches*

| field | search | enrich |
|---|---|---|
| `basic_info.name` | "Stripe" | "Stripe" |
| `basic_info.primary_domain` | "stripe.com" | "stripe.com" |
| `basic_info.website` | "https://stripe.com" | "https://stripe.com" |
| `basic_info.professional_network_url` | "https://www.linkedin.com/..." | "https://www.linkedin.com/..." |
| `basic_info.professional_network_id` | "2135371" | "2135371" |
| `basic_info.company_type` | "Privately Held" | "Privately Held" |
| `basic_info.year_founded` | "2010" | "2010-01-01" |
| `basic_info.employee_count_range` | "5001-10000" | "5001-10000" |
| `basic_info.industries` | [2] | [2] |
| `basic_info.description` | MISSING | "Stripe builds programmabl..." |
| `headcount.total` | 14728 | 14728 |
| `headcount.timeseries` | MISSING | [218] |
| `taxonomy.professional_network_industry` | "Technology, Information a..." | "Technology, Information a..." |
| `taxonomy.categories` | [7] | [7] |
| `locations.country` | "USA" | MISSING |
| `locations.headquarters` | MISSING | "South San Francisco, Cali..." |
| `locations.all_office_addresses` | MISSING | [13] |
| `funding.total_investment_usd` | 9440247725 | 9440247725 |
| `funding.last_round_type` | "secondary_market" | "secondary_market" |
| `funding.last_round_amount_usd` | 694159778 | 694159778 |
| `funding.last_fundraise_date` | "2026-03-09" | "2026-03-09" |
| `funding.investors` | [35] | [35] |
| `funding.milestones` | MISSING | [11] |
| `funding.acquisitions` | MISSING | [18] |
| `people.founders` | MISSING | EMPTY[] |
| `people.cxos` | MISSING | [2] |
| `people.decision_makers` | MISSING | [9] |
| `social_profiles.crunchbase.uuid` | "6f83ddd7-d637-61f8-06b2-4..." | "6f83ddd7-d637-61f8-06b2-4..." |
| `social_profiles.twitter_url` | "https://x.com/stripe" | "https://x.com/stripe" |
| `employee_reviews.overall_rating.rating` | MISSING | 3.8 |

### OpenAI
*well-known · crustdata_company_id: 631466 · expected category: non_hardware · identify returned 16 matches*

| field | search | enrich |
|---|---|---|
| `basic_info.name` | "OpenAI" | "OpenAI" |
| `basic_info.primary_domain` | "openai.com" | "openai.com" |
| `basic_info.website` | "https://openai.com/" | "https://openai.com/" |
| `basic_info.professional_network_url` | "https://www.linkedin.com/..." | "https://www.linkedin.com/..." |
| `basic_info.professional_network_id` | "11130470" | "11130470" |
| `basic_info.company_type` | "Partnership" | "Partnership" |
| `basic_info.year_founded` | "2015" | "2015-01-01" |
| `basic_info.employee_count_range` | "1001-5000" | "1001-5000" |
| `basic_info.industries` | [2] | [2] |
| `basic_info.description` | MISSING | "OpenAI is an AI research ..." |
| `headcount.total` | 7829 | 7829 |
| `headcount.timeseries` | MISSING | [208] |
| `taxonomy.professional_network_industry` | "Research Services" | "Research Services" |
| `taxonomy.categories` | [10] | [10] |
| `locations.country` | "USA" | MISSING |
| `locations.headquarters` | MISSING | "San Francisco, California..." |
| `locations.all_office_addresses` | MISSING | EMPTY[] |
| `funding.total_investment_usd` | 201075120000 | 201075120000 |
| `funding.last_round_type` | "series_unknown" | "series_unknown" |
| `funding.last_round_amount_usd` | 75000000 | 75000000 |
| `funding.last_fundraise_date` | "2026-04-22" | "2026-04-22" |
| `funding.investors` | [57] | [58] |
| `funding.milestones` | MISSING | [14] |
| `funding.acquisitions` | MISSING | [13] |
| `people.founders` | MISSING | EMPTY[] |
| `people.cxos` | MISSING | [1] |
| `people.decision_makers` | MISSING | [8] |
| `social_profiles.crunchbase.uuid` | "cf2c678c-b81a-80c3-10d1-9..." | "cf2c678c-b81a-80c3-10d1-9..." |
| `social_profiles.twitter_url` | "https://x.com/OpenAI" | "https://x.com/OpenAI" |
| `employee_reviews.overall_rating.rating` | MISSING | 4.3 |

### Skydio
*mid-tier · crustdata_company_id: 628918 · expected category: hardware · identify returned 1 match*

| field | search | enrich |
|---|---|---|
| `basic_info.name` | "Skydio" | "Skydio" |
| `basic_info.primary_domain` | "skydio.com" | "skydio.com" |
| `basic_info.website` | "https://www.skydio.com" | "https://www.skydio.com" |
| `basic_info.professional_network_url` | "https://www.linkedin.com/..." | "https://www.linkedin.com/..." |
| `basic_info.professional_network_id` | "3959849" | "3959849" |
| `basic_info.company_type` | "Privately Held" | "Privately Held" |
| `basic_info.year_founded` | "2014" | "2014-01-01" |
| `basic_info.employee_count_range` | "501-1000" | "501-1000" |
| `basic_info.industries` | [3] | [3] |
| `basic_info.description` | MISSING | "Skydio’s mission is to ma..." |
| `headcount.total` | 902 | 902 |
| `headcount.timeseries` | MISSING | [222] |
| `taxonomy.professional_network_industry` | "Robotics Engineering" | "Robotics Engineering" |
| `taxonomy.categories` | [8] | [8] |
| `locations.country` | "USA" | MISSING |
| `locations.headquarters` | MISSING | "San Mateo, California, Un..." |
| `locations.all_office_addresses` | MISSING | EMPTY[] |
| `funding.total_investment_usd` | 740000000 | 740000000 |
| `funding.last_round_type` | "series_e" | "series_e" |
| `funding.last_round_amount_usd` | 170000000 | 170000000 |
| `funding.last_fundraise_date` | "2024-11-15" | "2024-11-15" |
| `funding.investors` | [22] | [22] |
| `funding.milestones` | MISSING | [8] |
| `funding.acquisitions` | MISSING | EMPTY[] |
| `people.founders` | MISSING | EMPTY[] |
| `people.cxos` | MISSING | EMPTY[] |
| `people.decision_makers` | MISSING | [5] |
| `social_profiles.crunchbase.uuid` | "c8bddc25-35e4-9d16-b00d-a..." | "c8bddc25-35e4-9d16-b00d-a..." |
| `social_profiles.twitter_url` | "https://x.com/SkydioHQ" | "https://x.com/SkydioHQ" |
| `employee_reviews.overall_rating.rating` | MISSING | 3.6 |

### Shield AI
*mid-tier · crustdata_company_id: 634779 · expected category: hardware · identify returned 1 match*

| field | search | enrich |
|---|---|---|
| `basic_info.name` | "Shield AI" | "Shield AI" |
| `basic_info.primary_domain` | "shield.ai" | "shield.ai" |
| `basic_info.website` | "https://shield.ai/" | "https://shield.ai/" |
| `basic_info.professional_network_url` | "https://www.linkedin.com/..." | "https://www.linkedin.com/..." |
| `basic_info.professional_network_id` | "7952659" | "7952659" |
| `basic_info.company_type` | "Privately Held" | "Privately Held" |
| `basic_info.year_founded` | "2015" | "2015-01-01" |
| `basic_info.employee_count_range` | "1001-5000" | "1001-5000" |
| `basic_info.industries` | [3] | [3] |
| `basic_info.description` | MISSING | "Founded in 2015, Shield A..." |
| `headcount.total` | 1372 | 1372 |
| `headcount.timeseries` | MISSING | [217] |
| `taxonomy.professional_network_industry` | "Software Development" | "Software Development" |
| `taxonomy.categories` | [10] | [10] |
| `locations.country` | "USA" | MISSING |
| `locations.headquarters` | MISSING | "San Diego, California, Un..." |
| `locations.all_office_addresses` | MISSING | [7] |
| `funding.total_investment_usd` | 3583144999 | 3583144999 |
| `funding.last_round_type` | "series_g" | "series_g" |
| `funding.last_round_amount_usd` | 2000000000 | 250000000 |
| `funding.last_fundraise_date` | "2026-03-26" | "2026-03-26" |
| `funding.investors` | [31] | [31] |
| `funding.milestones` | MISSING | [13] |
| `funding.acquisitions` | MISSING | [4] |
| `people.founders` | MISSING | EMPTY[] |
| `people.cxos` | MISSING | EMPTY[] |
| `people.decision_makers` | MISSING | [3] |
| `social_profiles.crunchbase.uuid` | "c4396463-b910-f125-3f0b-6..." | "c4396463-b910-f125-3f0b-6..." |
| `social_profiles.twitter_url` | "https://x.com/shieldaitech" | "https://x.com/shieldaitech" |
| `employee_reviews.overall_rating.rating` | MISSING | 3.6 |

### Illumina
*biotech-hw-leaning · crustdata_company_id: 681285 · expected category: hardware / industry: Medical Devices · identify returned 4 matches*

| field | search | enrich |
|---|---|---|
| `basic_info.name` | "Illumina" | "Illumina" |
| `basic_info.primary_domain` | "illumina.com" | "illumina.com" |
| `basic_info.website` | "http://www.illumina.com" | "http://www.illumina.com" |
| `basic_info.professional_network_url` | "https://www.linkedin.com/..." | "https://www.linkedin.com/..." |
| `basic_info.professional_network_id` | "7513" | "7513" |
| `basic_info.company_type` | "Public Company" | "Public Company" |
| `basic_info.year_founded` | "1998" | "1998-01-01" |
| `basic_info.employee_count_range` | "5001-10000" | "5001-10000" |
| `basic_info.industries` | [3] | [3] |
| `basic_info.description` | MISSING | "At Illumina, our goal is ..." |
| `headcount.total` | 9537 | 9537 |
| `headcount.timeseries` | MISSING | [247] |
| `taxonomy.professional_network_industry` | "Biotechnology Research" | "Biotechnology Research" |
| `taxonomy.categories` | [6] | [6] |
| `locations.country` | "USA" | MISSING |
| `locations.headquarters` | MISSING | "San Diego, California, Un..." |
| `locations.all_office_addresses` | MISSING | [9] |
| `funding.total_investment_usd` | 1278000000 | 1278000000 |
| `funding.last_round_type` | "post_ipo_debt" | "post_ipo_debt" |
| `funding.last_round_amount_usd` | 500000000 | 500000000 |
| `funding.last_fundraise_date` | "2024-09-06" | "2024-09-06" |
| `funding.investors` | [10] | [10] |
| `funding.milestones` | MISSING | [3] |
| `funding.acquisitions` | MISSING | [16] |
| `people.founders` | MISSING | EMPTY[] |
| `people.cxos` | MISSING | [1] |
| `people.decision_makers` | MISSING | [1] |
| `social_profiles.crunchbase.uuid` | "d1b0e72f-2d10-2f9a-2c54-c..." | "d1b0e72f-2d10-2f9a-2c54-c..." |
| `social_profiles.twitter_url` | "https://x.com/illumina" | "https://x.com/illumina" |
| `employee_reviews.overall_rating.rating` | MISSING | 3.4 |

### Recursion Pharmaceuticals
*biotech-sw-leaning · crustdata_company_id: 640404 · expected category: non_hardware / industry: Biotech · identify returned 3 matches*

| field | search | enrich |
|---|---|---|
| `basic_info.name` | "Recursion" | "Recursion" |
| `basic_info.primary_domain` | "recursion.com" | "recursion.com" |
| `basic_info.website` | "http://www.recursion.com" | "http://www.recursion.com" |
| `basic_info.professional_network_url` | "https://www.linkedin.com/..." | "https://www.linkedin.com/..." |
| `basic_info.professional_network_id` | "4990022" | "4990022" |
| `basic_info.company_type` | "Public Company" | "Public Company" |
| `basic_info.year_founded` | "2013" | "2013-01-01" |
| `basic_info.employee_count_range` | "501-1000" | "501-1000" |
| `basic_info.industries` | [3] | [3] |
| `basic_info.description` | MISSING | "Recursion (NASDAQ: RXRX) ..." |
| `headcount.total` | 758 | 758 |
| `headcount.timeseries` | MISSING | [246] |
| `taxonomy.professional_network_industry` | "Biotechnology Research" | "Biotechnology Research" |
| `taxonomy.categories` | [7] | [7] |
| `locations.country` | "USA" | MISSING |
| `locations.headquarters` | MISSING | "Salt Lake City, Utah, Uni..." |
| `locations.all_office_addresses` | MISSING | [6] |
| `funding.total_investment_usd` | 865376000 | 865376000 |
| `funding.last_round_type` | "post_ipo_equity" | "post_ipo_equity" |
| `funding.last_round_amount_usd` | 200000000 | 200000000 |
| `funding.last_fundraise_date` | "2024-06-26" | "2024-06-26" |
| `funding.investors` | [35] | [35] |
| `funding.milestones` | MISSING | [10] |
| `funding.acquisitions` | MISSING | [4] |
| `people.founders` | MISSING | EMPTY[] |
| `people.cxos` | MISSING | [8] |
| `people.decision_makers` | MISSING | [12] |
| `social_profiles.crunchbase.uuid` | "0bc57a74-cd37-e643-9d5c-2..." | "0bc57a74-cd37-e643-9d5c-2..." |
| `social_profiles.twitter_url` | "https://x.com/@RecursionP..." | "https://x.com/@RecursionP..." |
| `employee_reviews.overall_rating.rating` | MISSING | 3.5 |

### Hugging Face
*ambiguous · crustdata_company_id: 631620 · expected category: non_hardware · identify returned 22 matches*

| field | search | enrich |
|---|---|---|
| `basic_info.name` | "Hugging Face" | "Hugging Face" |
| `basic_info.primary_domain` | "huggingface.co" | "huggingface.co" |
| `basic_info.website` | "https://huggingface.co" | "https://huggingface.co" |
| `basic_info.professional_network_url` | "https://www.linkedin.com/..." | "https://www.linkedin.com/..." |
| `basic_info.professional_network_id` | "11193683" | "11193683" |
| `basic_info.company_type` | "Privately Held" | "Privately Held" |
| `basic_info.year_founded` | "2016" | "2016-01-01" |
| `basic_info.employee_count_range` | "51-200" | "51-200" |
| `basic_info.industries` | [3] | [3] |
| `basic_info.description` | MISSING | "The AI community building..." |
| `headcount.total` | 683 | 683 |
| `headcount.timeseries` | MISSING | [186] |
| `taxonomy.professional_network_industry` | "Software Development" | "Software Development" |
| `taxonomy.categories` | [10] | [10] |
| `locations.country` | "USA" | MISSING |
| `locations.headquarters` | MISSING | "United States" |
| `locations.all_office_addresses` | MISSING | [1] |
| `funding.total_investment_usd` | 395200000 | 395200000 |
| `funding.last_round_type` | "series_unknown" | "series_unknown" |
| `funding.last_round_amount_usd` | 235000000 | 235000000 |
| `funding.last_fundraise_date` | "2024-08-01" | "2024-08-01" |
| `funding.investors` | [41] | [41] |
| `funding.milestones` | MISSING | [8] |
| `funding.acquisitions` | MISSING | [5] |
| `people.founders` | MISSING | EMPTY[] |
| `people.cxos` | MISSING | EMPTY[] |
| `people.decision_makers` | MISSING | [3] |
| `social_profiles.crunchbase.uuid` | "b7947f18-b199-45ac-b7da-6..." | "b7947f18-b199-45ac-b7da-6..." |
| `social_profiles.twitter_url` | "https://x.com/huggingface" | "https://x.com/huggingface" |
| `employee_reviews.overall_rating.rating` | MISSING | 4.3 |

### Inflection AI
*obscure-mid · crustdata_company_id: 662966 · expected category: non_hardware · identify returned 1 match*

| field | search | enrich |
|---|---|---|
| `basic_info.name` | "Inflection AI" | "Inflection AI" |
| `basic_info.primary_domain` | "inflection.ai" | "inflection.ai" |
| `basic_info.website` | "https://inflection.ai" | "https://inflection.ai" |
| `basic_info.professional_network_url` | "https://www.linkedin.com/..." | "https://www.linkedin.com/..." |
| `basic_info.professional_network_id` | "79994924" | "79994924" |
| `basic_info.company_type` | "Privately Held" | "Privately Held" |
| `basic_info.year_founded` | "2022" | "2022-01-01" |
| `basic_info.employee_count_range` | "51-200" | "51-200" |
| `basic_info.industries` | [2] | [2] |
| `basic_info.description` | MISSING | "At Inflection, our public..." |
| `headcount.total` | 69 | 69 |
| `headcount.timeseries` | MISSING | [190] |
| `taxonomy.professional_network_industry` | "Technology, Information a..." | "Technology, Information a..." |
| `taxonomy.categories` | [6] | [6] |
| `locations.country` | "USA" | MISSING |
| `locations.headquarters` | MISSING | "Palo Alto, California, Un..." |
| `locations.all_office_addresses` | MISSING | EMPTY[] |
| `funding.total_investment_usd` | 1525000000 | 1525000000 |
| `funding.last_round_type` | "series_unknown" | "series_unknown" |
| `funding.last_round_amount_usd` | 1300000000 | 1300000000 |
| `funding.last_fundraise_date` | "2023-06-29" | "2023-06-29" |
| `funding.investors` | [8] | [8] |
| `funding.milestones` | MISSING | [2] |
| `funding.acquisitions` | MISSING | [2] |
| `people.founders` | MISSING | [1] |
| `people.cxos` | MISSING | EMPTY[] |
| `people.decision_makers` | MISSING | [1] |
| `social_profiles.crunchbase.uuid` | "7bccb75e-26c8-4e43-a58c-3..." | "7bccb75e-26c8-4e43-a58c-3..." |
| `social_profiles.twitter_url` | "https://x.com/inflectionai" | "https://x.com/inflectionai" |
| `employee_reviews.overall_rating.rating` | MISSING | 5 |

### Astra Space
*obscure-hw · crustdata_company_id: 632243 · expected category: hardware · identify returned 2 matches*

| field | search | enrich |
|---|---|---|
| `basic_info.name` | "Astra" | "Astra" |
| `basic_info.primary_domain` | "astra.com" | "astra.com" |
| `basic_info.website` | "http://www.astra.com" | "http://www.astra.com" |
| `basic_info.professional_network_url` | "https://www.linkedin.com/..." | "https://www.linkedin.com/..." |
| `basic_info.professional_network_id` | "11046103" | "11046103" |
| `basic_info.company_type` | "Privately Held" | "Privately Held" |
| `basic_info.year_founded` | "2016" | "2016-01-01" |
| `basic_info.employee_count_range` | "51-200" | "51-200" |
| `basic_info.industries` | [3] | [3] |
| `basic_info.description` | MISSING | "We are on a mission to im..." |
| `headcount.total` | 496 | 496 |
| `headcount.timeseries` | MISSING | [221] |
| `taxonomy.professional_network_industry` | "Defense and Space Manufac..." | "Defense and Space Manufac..." |
| `taxonomy.categories` | [8] | [8] |
| `locations.country` | "USA" | MISSING |
| `locations.headquarters` | MISSING | "Alameda, California, Unit..." |
| `locations.all_office_addresses` | MISSING | EMPTY[] |
| `funding.total_investment_usd` | 390900000 | 390900000 |
| `funding.last_round_type` | "post_ipo_debt" | "post_ipo_debt" |
| `funding.last_round_amount_usd` | 13400000 | 13400000 |
| `funding.last_fundraise_date` | "2023-11-06" | "2023-11-06" |
| `funding.investors` | [18] | [18] |
| `funding.milestones` | MISSING | [9] |
| `funding.acquisitions` | MISSING | [1] |
| `people.founders` | MISSING | EMPTY[] |
| `people.cxos` | MISSING | EMPTY[] |
| `people.decision_makers` | MISSING | [2] |
| `social_profiles.crunchbase.uuid` | "abdbbadd-c863-4ce5-9955-a..." | "abdbbadd-c863-4ce5-9955-a..." |
| `social_profiles.twitter_url` | "https://x.com/astra" | "https://x.com/astra" |
| `employee_reviews.overall_rating.rating` | MISSING | 3.3 |


## Cross-company fill rate

*10 successful companies*

| field | category | search | enrich | enrich-only delta |
|---|---|---|---|---|
| `basic_info.name` | identity | 10/10 (100%) | 10/10 (100%) | 0 |
| `basic_info.primary_domain` | identity | 10/10 (100%) | 10/10 (100%) | 0 |
| `basic_info.website` | identity | 10/10 (100%) | 10/10 (100%) | 0 |
| `basic_info.professional_network_url` | identity | 10/10 (100%) | 10/10 (100%) | 0 |
| `basic_info.professional_network_id` | identity | 10/10 (100%) | 10/10 (100%) | 0 |
| `basic_info.company_type` | firmographic | 10/10 (100%) | 10/10 (100%) | 0 |
| `basic_info.year_founded` | firmographic | 10/10 (100%) | 10/10 (100%) | 0 |
| `basic_info.employee_count_range` | firmographic | 10/10 (100%) | 10/10 (100%) | 0 |
| `basic_info.industries` | taxonomy | 10/10 (100%) | 10/10 (100%) | 0 |
| `basic_info.description` | firmographic-enrich-only | 0/10 (0%) | 10/10 (100%) | +10 |
| `headcount.total` | firmographic | 10/10 (100%) | 10/10 (100%) | 0 |
| `headcount.timeseries` | firmographic-enrich-only | 0/10 (0%) | 10/10 (100%) | +10 |
| `taxonomy.professional_network_industry` | taxonomy | 10/10 (100%) | 10/10 (100%) | 0 |
| `taxonomy.categories` | taxonomy | 10/10 (100%) | 10/10 (100%) | 0 |
| `locations.country` | location | 10/10 (100%) | 0/10 (0%) | -10 |
| `locations.headquarters` | location-enrich-only | 0/10 (0%) | 10/10 (100%) | +10 |
| `locations.all_office_addresses` | location-enrich-only | 0/10 (0%) | 6/10 (60%) | +6 |
| `funding.total_investment_usd` | funding | 10/10 (100%) | 10/10 (100%) | 0 |
| `funding.last_round_type` | funding | 10/10 (100%) | 10/10 (100%) | 0 |
| `funding.last_round_amount_usd` | funding | 10/10 (100%) | 10/10 (100%) | 0 |
| `funding.last_fundraise_date` | funding | 10/10 (100%) | 10/10 (100%) | 0 |
| `funding.investors` | funding | 10/10 (100%) | 10/10 (100%) | 0 |
| `funding.milestones` | funding-enrich-only | 0/10 (0%) | 10/10 (100%) | +10 |
| `funding.acquisitions` | funding-enrich-only | 0/10 (0%) | 9/10 (90%) | +9 |
| `people.founders` | people-enrich-only | 0/10 (0%) | 1/10 (10%) | +1 |
| `people.cxos` | people-enrich-only | 0/10 (0%) | 4/10 (40%) | +4 |
| `people.decision_makers` | people-enrich-only | 0/10 (0%) | 10/10 (100%) | +10 |
| `social_profiles.crunchbase.uuid` | social | 10/10 (100%) | 10/10 (100%) | 0 |
| `social_profiles.twitter_url` | social | 10/10 (100%) | 10/10 (100%) | 0 |
| `employee_reviews.overall_rating.rating` | reviews-enrich-only | 0/10 (0%) | 10/10 (100%) | +10 |

## company_type values observed (informs issue #1 enum)

- `"Partnership"`
- `"Privately Held"`
- `"Public Company"`

## funding.last_round_type values observed (the noisy field)

- `"grant"`
- `"post_ipo_debt"`
- `"post_ipo_equity"`
- `"secondary_market"`
- `"series_e"`
- `"series_g"`
- `"series_unknown"`

## All milestones[].round prefixes observed (informs derived funding_stage logic)

- `"Angel Round"`
- `"Convertible Note"`
- `"Corporate Round"`
- `"Debt Financing"`
- `"Grant"`
- `"Post-IPO Debt"`
- `"Post-IPO Equity"`
- `"Secondary Market"`
- `"Seed Round"`
- `"Series A"`
- `"Series B"`
- `"Series C"`
- `"Series D"`
- `"Series E"`
- `"Series F"`
- `"Series G"`
- `"Series H"`
- `"Series I"`
- `"Venture Round"`
---

## Headlines

### 1. Enrich's marginal value over search is real and consistent

Across 10 companies of varying size and obscurity, every enrich-only field that V1 wants is **populated 60-100% of the time**:

- `basic_info.description` — **10/10** (100%) ← strongest disambiguator for Claude tier-2
- `headcount.timeseries` — 10/10 (100%)
- `funding.milestones` — 10/10 (100%) ← validates the funding_stage derived approach
- `funding.acquisitions` — 9/10 (90%)
- `locations.headquarters` — 10/10 (100%) ← replaces search's spotty country-only data
- `employee_reviews.overall_rating.rating` — 10/10 (100%)
- `people.decision_makers` — 10/10 (100%)
- `locations.all_office_addresses` — 6/10 (60%) ← weaker but useful when present

**No obscure-company degradation observed:** even Astra Space (small, struggling SPAC) and Inflection AI (acquired/wound down) returned full enrich data including milestones and description.

### 2. people.founders is poorly populated — design implication

`people.founders` returned 1/10 (10%); `people.cxos` returned 4/10 (40%). The Crust enrich `people` block reliably surfaces only `decision_makers` (10/10).

**Implication for V1:** if we want founder names on the company profile page, we cannot rely on Crust's `people.founders[]`. Either (a) accept that founder data is mostly empty, (b) derive founders by querying `person_experiences WHERE company_id = X AND is_founder_role = true` (already in our schema), or (c) add a manual admin field. **Recommend (b)** — we already have founder data in our person table from candidate ingest. No new fetching required.

### 3. company_type observed values (for issue #1 enum finalization)

In this 10-company sample we saw:

- `"Privately Held"` → `private`
- `"Public Company"` → `public`
- `"Partnership"` → `partnership` (OpenAI)

**Subsidiary** wasn't seen. Likely additions when broader sample tested: `"Subsidiary"`, `"Nonprofit"`, `"Government Agency"`, `"Educational"`, `"Self-Employed"`. **Recommend final enum after Investigation 2** broadens the sample, OR add liberally now (private, public, subsidiary, partnership, nonprofit, government, educational, other).

### 4. funding_stage derived logic — milestones[] data confirms approach

`funding.milestones[]` returned 100% across all 10 companies, with these round-prefix values seen across the sample:

**KEEP (priced equity rounds):** `Series A` through `Series I`, `Seed Round`, `Angel Round` ← **add Angel Round to the keep list** (maps to `pre_seed`), I missed this in the original spec.

**SKIP (not stage-changing):** Grant, Convertible Note, Corporate Round, Debt Financing, Post-IPO Debt, Post-IPO Equity, Secondary Market, Venture Round.

**Round-name parsing:** Crust returns `"Series G - Anduril Industries"` style. Strip the `" - <company>"` suffix, lowercase, replace space with underscore. Add explicit handlers for `"Seed Round"` → `seed`, `"Angel Round"` → `pre_seed`. The `funding_stage` enum in the inventory already covers all priced rounds seen (Series A-K covers up to Series I observed).

### 5. Identify ambiguity is severe — issue #8 fully validated

`identify` with `exact_match: true` on the canonical domain still returns multiple matches per domain:

| Company | Domain | Matches | Top match correct? |
|---|---|---|---|
| Anduril Industries | anduril.com | 1 | yes |
| Stripe | stripe.com | **18** | yes (top is canonical Stripe) |
| OpenAI | openai.com | **16** | yes |
| Skydio | skydio.com | 1 | yes |
| Shield AI | shield.ai | 1 | yes |
| Illumina | illumina.com | 4 | yes |
| Recursion Pharmaceuticals | recursion.com | 3 | yes |
| Hugging Face | huggingface.co | **22** | yes |
| Inflection AI | inflection.ai | 1 | yes |
| Astra Space | astra.com | 2 | yes |

**Crust's ranking puts the canonical entity at #1 in all 10 cases.** That's better than expected. But the multi-match counts (18, 16, 22) confirm we cannot SILENTLY auto-pick — admin must see the alternatives in case the ranking is wrong (which it sometimes will be, e.g. for less-canonical brand names). Validates issue #8 decision: import UI shows ranked options with disambiguators (domain + LinkedIn URL + headcount), admin picks.

### 6. Search + enrich data quality is consistent across tiers

The well-known/mid-tier/biotech-leaning/ambiguous/obscure spread did NOT reveal field-fill degradation. Crust's IN-DB cache appears comprehensive for all 10 of these test companies. **No need to special-case obscure companies** in the V1 build — the same fetch-and-parse logic works for all tiers.

### 7. `locations.country` vs `locations.headquarters` — schema impact

Search returns `locations.country` (e.g. `"USA"`). Enrich does NOT return `locations.country` — it returns `locations.headquarters` (e.g. `"Costa Mesa, CA, US"`). They're parallel fields, not the same field at different fidelity.

**Implication for `hq_location_name`:** the priority order in the inventory is correct — prefer enrich's `locations.headquarters` (richer string), fall back to search's `locations.country` for reference-tier rows that didn't get enriched. The mapper for vetted-tier writes the enrich value; the mapper for reference-tier (free identify only) gets country-only via search response.

**Wait** — identify only returns basic_info, not locations. Reference-tier rows get NO location data from the free identify call. They'd need a search call for country, or stay NULL until promoted to vetted. Recommend: reference-tier `hq_location_name` stays NULL, populated only when admin promotes the row to vetted and enrich runs. **This was not explicitly stated in the inventory** — needs to be added under the `hq_location_name` section.

---

## Implications for Investigation 2 (tagger quality test)

1. **Tagger input granularity:** investigation 2 should run the dictionary at TWO levels per company: (a) search-only signals, (b) enrich signals (search + description). Drop the person-subobject level per pushback #1.

2. **Biotech disambiguation test:** Illumina (biotech-hw-leaning) and Recursion (biotech-sw-leaning) are the test cases. The dictionary needs to route Illumina → `category=hardware, industry=Medical Devices` and Recursion → `category=non_hardware, industry=Biotech`. Crust's `taxonomy.categories[]` and `basic_info.description` are the disambiguators.

3. **Use the cached raw JSON.** `02-data-delta-raw.json` has all 10 companies' search + enrich responses. Investigation 2 reads from disk, no Crust API calls needed.

4. **No-Crust-call-required design:** the entire tagger evaluation is offline — dictionary lookups + Claude calls only. Crust calls already done.

5. **Add `Angel Round` to the funding_stage keep-list and update `lib/companies/derive-funding-stage.ts` spec accordingly** when phase 1 builds.
