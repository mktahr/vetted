# /person/enrich — Crust Person Enrich (cached / IN-DB)

> Source: https://docs.crustdata.com/person-docs/enrichment/reference + /introduction (verified 2026-05-01).

**This is the CACHED ("IN-DB") variant.** For real-time fresh-from-source data, see `09-person-live-enrich.md`.

## Cost

Public docs (`/person-docs/enrichment/introduction`):
> Base profile = **1 credit**. Add-ons stack:
> - +2 for personal email
> - +2 for phone
> - +1 for business email
> - +1 for developer platform data
> - **Maximum: 7 credits per profile**

Matt's contract CSV (`docs/crust/05-pricing-and-rate-limits.md`): **3 credits per record IN-DB.** ⚠️ Discrepancy — see open question in `05-pricing-and-rate-limits.md`.

## Endpoint

`POST https://api.crustdata.com/person/enrich`

Headers: same as search (Bearer + `x-api-version: 2025-11-01`).

## Request body

```yaml
type: object
properties:
  professional_network_profile_urls:
    type: array
    items: string
    maxItems: 25                    # at most 25 per call
  business_emails:
    type: array
    items: string
    maxItems: 25
  fields:
    type: array
    items: string
    description: |
      Specific dot-paths or section groups to include in person_data.
      Section groups: basic_profile, professional_network, social_handles,
      experience, education, skills, contact, dev_platform_profiles.
  min_similarity_score:
    type: number                    # 0-1, confidence threshold for email reverse lookup
  force_fetch:
    type: boolean
    default: false
    description: Request a fresh fetch when supported (interaction with Live unclear — see open question)
  enrich_realtime:
    type: boolean
    default: false
    description: Request realtime behavior when supported (interaction with Live unclear)
```

**Identifier rules:** provide exactly ONE of `professional_network_profile_urls` or `business_emails` per call. The endpoint also accepts `crustdata_person_ids` and `linkedin_profile_urls` (a more general parameter). Verify in dashboard which identifier types your plan accepts.

## Response

```yaml
type: array
items:
  matched_on: string                # the input identifier
  match_type: string                # 'professional_network_profile_url' | 'business_email'
  matches:
    type: array
    items:
      confidence_score: number      # 0-1
      person_data:
        # Sections, populated based on `fields` param:
        basic_profile: { name, headline, current_title, summary, location, languages, ... }
        professional_network: { profile_picture_permalink, connections, followers }
        social_handles: { professional_network_identifier, twitter_identifier, dev_platform_identifier, ... }
        experience:
          employment_details:
            current: [PersonProfileEmployer]
            past: [PersonProfileEmployer]
        education:
          schools: [PersonProfileSchool]
        skills:
          professional_network_skills: [string]
        contact:
          # ENRICH-ONLY (search returns booleans only):
          # personal_emails, business_emails, phones — but COSTS EXTRA per docs add-on table
        dev_platform_profiles: { ... }
```

## Errors

| Status | Condition |
|---|---|
| 400 | invalid request or missing identifier |
| 401 | invalid/missing API key |
| 403 | permission denied or insufficient credits |
| 500 | server error |

## Open questions

1. **Cost discrepancy:** docs say 1 credit base + add-ons; CSV says 3 credits IN-DB flat. Which is contractual?
2. **Add-on triggering:** does requesting `fields: [contact.personal_emails]` automatically incur the +2 add-on cost? Or is there a separate parameter?
3. **`force_fetch` vs `enrich_realtime` vs the separate `/professional_network/enrich/live` endpoint:** what's the difference? Are these all paths to "Live"? Or are they orthogonal cache-bypass mechanisms within IN-DB?

These need confirmation from Crust before we wire enrich into any Vetted code.

## Notes for our codebase

- Not currently used by application code. Person enrich would be a future enhancement to fill emails/phones when needed.
- For company-side enrichment (the active V1 build target), see `03-company-enrich.md`.
