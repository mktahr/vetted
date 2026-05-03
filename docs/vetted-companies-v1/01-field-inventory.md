# Vetted Companies V1 — Field-to-UI Mapping Inventory

**Status:** **LOCKED with Round-2 amendments 2026-05-02.** This is the contract for phase 1 build.
**Author:** Claude Code
**Date:** 2026-05-01 (drafted, locked round 1) → 2026-05-02 (round-2 amendments after Inv2 evaluation)

This document is the **contract** between:
- The schema migration (what columns exist, what constraints they have)
- The auto-tagging system (what values it produces, what input data it reads)
- The UI build (what surfaces display each field, what control type)

If any of these three diverge from this document during implementation, this document is wrong and gets updated; we don't ship code that disagrees with the inventory.

---

## ROUND-2 AMENDMENTS (2026-05-02) — authoritative; supersedes round-1 details below

The original round-1 inventory (rest of this document) was locked on 2026-05-01.
Inv2's tagger evaluation surfaced architectural and taxonomy adjustments. Round-2
decisions, listed here, **override** the round-1 sections where they conflict.

### Architecture pivot — Claude is PRIMARY (round-2 decision #1)

Original (round-1): tier-1 dictionary primary, tier-2 Claude fallback for ambiguous cases.
**New: Claude primary; dictionary runs in parallel as a sanity check.**

`tagging_method` enum (replaces round-1 values `crust_dictionary | claude_inference | admin_manual`):
- `claude` — Claude verdict written; dict couldn't classify (returned NULL category) so no comparison
- `claude_dict_agree` — both ran; agreed on (category, primary_industry); confidence boosted
- `claude_dict_disagree` — both ran; disagreed; **Claude's verdict is written** (Concern B); dict's verdict captured in `tagging_notes` for admin triage; confidence lowered
- `manual` — admin override; auto-tagger never overwrites

Rows that have not yet been tagged have `tagging_method=NULL`.

### Category enum: drop 'unreviewed' (Concern 1)

Original: `category IN ('hardware', 'non_hardware', 'unreviewed')`.
**New: `category IN ('hardware', 'non_hardware')` OR NULL.** When the tagger can't classify, set `category=NULL`. The "unreviewed" workflow state lives entirely on `review_status` (see below).

CHECK constraint becomes: `category IS NULL OR category IN ('hardware', 'non_hardware')`. NULL category requires NULL `primary_industry`, empty `industries[]`, empty `domain_tags`.

### Replace `manual_review_status` with `review_status` (Concern 2 + decision #7)

Round-1 kept the existing `manual_review_status` (`unreviewed | reviewed | locked`). **Replace with `review_status`** (`vetted | unreviewed | excluded`).

Migration plan:
```sql
ALTER TABLE companies ADD COLUMN review_status TEXT;
UPDATE companies SET review_status =
  CASE manual_review_status
    WHEN 'reviewed' THEN 'vetted'
    WHEN 'locked'   THEN 'vetted'   -- silent collapse; reviewed/locked distinction not preserved
    ELSE 'unreviewed'
  END;
ALTER TABLE companies ALTER COLUMN review_status SET NOT NULL;
ALTER TABLE companies ALTER COLUMN review_status SET DEFAULT 'unreviewed';
ALTER TABLE companies ADD CONSTRAINT companies_review_status_check
  CHECK (review_status IN ('vetted', 'unreviewed', 'excluded'));
ALTER TABLE companies DROP COLUMN manual_review_status;
DROP TYPE manual_review_status_type;  -- if no other references
```

`review_status='excluded'` semantics (decisions #9, #10):
- Filter recruiter visibility (ProfileTable + search-builder hide candidates whose primary current company is excluded)
- Do NOT block candidate ingestion (the candidate is scored on own merits regardless)
- Visual treatment: company name in muted text (~60% opacity gray, neutral — NOT red/orange) on candidate displays. Hover (~500ms delay) shows tooltip "Company excluded from talent pool." Click navigates to detail page.

### Multi-industry — Option B (single + array)

Original: single `industry TEXT` column.
**New: `primary_industry TEXT` + `industries TEXT[] NOT NULL DEFAULT '{}'`.**

```sql
ALTER TABLE companies ADD COLUMN primary_industry TEXT;
ALTER TABLE companies ADD COLUMN industries TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE companies ADD CONSTRAINT companies_primary_industry_in_industries_check
  CHECK (
    primary_industry IS NULL OR primary_industry = ANY(industries)
  );

ALTER TABLE companies ADD CONSTRAINT companies_industries_subset_check
  CHECK (
    CASE category
      WHEN 'hardware' THEN industries <@ ARRAY['Defense','Aerospace','Automotive','Robotics','Medical Devices','Biotech','Energy','Energy Storage','Climate','Semiconductors','Consumer Electronics','Industrial Manufacturing','Materials','Maritime','Other Hardware']::text[]
      WHEN 'non_hardware' THEN industries <@ ARRAY['SaaS','AI','FinTech','Investment Banking','Quant/Trading','Blockchain & Web3','Consumer Tech','HealthTech','Biotech','Services','Legal','Defense','Aerospace']::text[]
      ELSE industries = ARRAY[]::text[]
    END
  );

CREATE INDEX idx_companies_industries ON companies USING GIN (industries);
```

Tagger output (Claude prompt instructs):
- Most companies: `industries=[primary_industry]` — single-element
- Multi-industry companies (Anduril, Tesla, SpaceX, conglomerates): list 2-4
- Primary first

**Search filter:** returns ANY company with the value in `industries[]` (uses GIN array containment). Display sorted by `primary_industry`.

**UI:** primary shown prominently in tables; "+N more" badge with hover tooltip showing the full list. Detail drawer shows all industries with primary visually marked. **The +N badge is V1 SCOPE for industry display only — do not generalize the pattern across the product yet.**

### Taxonomy additions

**Defense and Aerospace cross-listed** (decision #12). Both industries appear in BOTH branches:
- `hardware/Defense`: Anduril (physical defense systems)
- `non_hardware/Defense`: Palantir, Rebellion Defense (software/services SOLD to defense)
- `hardware/Aerospace`: SpaceX, Astra Space (physical rockets/satellites/aircraft)
- `non_hardware/Aerospace`: Slingshot Aerospace (software for aerospace industry)

Disambiguation rules locked in the Claude prompt (Concern 6):
- Hardware/Defense = primary product is a physical defense system
- Non-hardware/Defense = primary product is software/services SOLD TO defense customers
- Hardware/Aerospace = builds physical aerospace products
- Non-hardware/Aerospace = software/services for the aerospace industry

**AI added as a domain_tag in BOTH branches** (decision #11). Hardware tags: `[..., AI]`; non-hardware tags: `[..., AI]`.

**Suppression rule (Concern 5):** when `primary_industry='AI'`, the AI domain_tag is stripped from `domain_tags` (the industry already says it). Generalized: any future cross-listing where industry name == domain_tag name gets the same suppression.

Examples:
- OpenAI → industry=AI, domain_tags=[] (no AI tag)
- Anduril → industry=Defense, domain_tags=[Drones, AI] (AI core to Hivemind)
- Tesla → industry=Automotive, domain_tags=[EVs, Autonomous Driving, AI, Robotics]
- Recursion → industry=Biotech, domain_tags=[AI, Data]
- Notion → industry=SaaS, domain_tags=[Productivity] (NO AI tag — it's a feature, not core)

**NO Manufacturing as a domain_tag** (decision #13). `Industrial Manufacturing` stays as a hardware industry only. Multi-business companies that do significant manufacturing (Anduril, Tesla, SpaceX) get `Industrial Manufacturing` as a SECONDARY industry under Option B.

### Dedupe at Crust ingestion (decision #8 + Concern 4)

- **Person dedupe via `exclude_profiles`:** ALREADY SHIPPED (Crust Import V1 routes pass `people.linkedin_url`s as `post_processing.exclude_profiles[]`). No new work.
- **Company dedupe before /company/search or /company/identify (NEW for company import UI):** before any paid Crust call from the new `/admin/companies/import` flow, check the local `companies` table for the company by `crustdata_company_id` (preferred) or `linkedin_url` (fallback). If known, skip the Crust call and route admin to the existing record's edit page.

### Auto-create Claude tagging (Concern 3 resolution)

Per Concern 3 resolution: run Claude on every never-seen-before company at candidate ingest time, NOT dict-only. Identify-only signals (name + industries[] + maybe description) are sufficient — Inv2 round-2 eval shows Claude at parity with enrich-tier on category + primary_industry on identify-only inputs (see `03-tagger-eval.md`).

**Concern A flagged on this turn:** at ~1.5s/Claude-call, this adds latency to ingest. **Recommend async tagging:** write the company stub immediately with `tagging_method=NULL`, then a background job invokes the tagger and writes results. Doesn't block candidate ingest. **Awaiting Matt's confirmation on async vs sync.**

### `hq_location_name` for unreviewed-tier rows (decision #6 / Inv1 gap)

Set `hq_location_name=NULL` for unreviewed-tier auto-creates. The free `/company/identify` call returns location only as `country` (often null), not the rich `headquarters` string. Populated only on vetted-tier promotion when enrich runs.

### `tagging_notes` schema use under round-2 architecture

When `tagging_method='claude_dict_disagree'`: tagging_notes records both verdicts in machine-readable form so admin triage UI can display them, e.g.:

```json
{
  "claude": { "category": "hardware", "primary_industry": "Aerospace" },
  "dict":   { "category": "hardware", "primary_industry": "Defense" },
  "summary": "DISAGREEMENT — Claude: hardware/Aerospace; Dict: hardware/Defense. Wrote Claude's verdict; flagged for triage."
}
```

Admin can override with one click; sets `tagging_method='manual'` and freezes the row.

### Async tagging architecture (Concern A — RESOLVED 2026-05-03)

Per round-2 follow-up decision: **async via Vercel Cron**. Implementation:

- `vercel.json` declares one cron: `*/2 * * * *` → `/api/admin/companies/tag-pending`
- `/api/admin/companies/tag-pending` route handler:
  - Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel auto-injects on cron) OR `x-ingest-secret` (manual/CLI)
  - Queries up to 10 companies WHERE `tagging_method IS NULL` ORDER BY `created_at`
  - For each: `/company/identify` (free) → build TaggerInput from basic_info → `tagCompany()` → write back
  - Throttles to 4s/call to stay within Crust's 15 req/min limit
  - On identify failure: row stays NULL, retried next cron (TODO V2: add retry-counter cap)
- UI (deferred to phase 1 build): "tagging…" pill on company list rows when `tagging_method IS NULL` + "Tag now" button on detail page

### Dict refinements applied 2026-05-03

After E1+E2+E3+M2 round-2 fixes, an Anduril regression surfaced (Aerospace fired on bare "Aerospace" category, beating Defense). Two refinements applied:

- **E2.1:** Aerospace rule fires only on SPECIFIC signals (Drones, Space Travel, Satellites, Aviation Component Manufacturing, eVTOL). The bare "Aerospace" category string is excluded — it's too common on defense companies.
- **M2 strengthened:** PNI-vs-categories contradiction threshold loosened from "categoryVotesOnly.X > opposite" to absolute `>= 5`. Catches Shield AI (PNI=Software Development but 5 hardware-leaning category signals) and abstains to null instead of confidently picking the wrong category.
- Defense rule "any" tightened to (Military, National Security, Government). Removed Law Enforcement (cops also buy drones from Skydio etc — not a defense signal alone) and "Defense and Space Manufacturing" PNI (E3 already removed; E2.1 confirms).

Result on the 10-company eval set: dict primary accuracy 6/10 → **9/10 (90%)**. Domain tag precision 0.50 → **1.00**. Targeted expansion eval will validate against 28 new companies.

### Open questions / outstanding

- Companies that exist before V1 migration get `tagging_method=NULL` until first tag (implicit; documented).
- Cron route + tag-pending implementation **requires V1 schema migration** to function. Route fails gracefully (query error) until columns exist. Wire-up complete; activation depends on phase 1 schema landing.

---

## END ROUND-2 AMENDMENTS — round-1 sections below

The remainder of this document is the round-1 inventory. Where it conflicts with the round-2 amendments above, the amendments win. Specific round-1 sections that are now superseded:
- "Section 2 / `category`" enum (no longer includes 'unreviewed')
- "Section 2 / `industry`" (replaced by primary_industry + industries[])
- "Section 5 / `tagging_method`" enum (4 new values, not 3)
- "Section 6 / `manual_review_status`" (replaced by `review_status`)
- "Controlled vocabularies" (new lists — see updated section below)
- "CHECK constraints" (see round-2 SQL above; round-1 SQL is superseded)
- "TS config mirror" (new exports added)

The round-1 section descriptions of UI behavior, source field mapping, and other column details remain accurate.

---

## Scope

**Covers:** every column on the `companies` table after the V1 migration. Each column gets:
- (a) Type, constraints, defaults
- (b) Crust source path (which `/company/search` and/or `/company/enrich` field populates it)
- (c) UI surfaces (admin pages + recruiter pages) and control type
- (d) Notes on edge cases

**Does NOT cover:**
- Satellite tables (`company_metrics_by_year`, `company_locations`, `company_events`, `company_investors`) — that's investigation 1's data-delta output
- Tagger logic (the dictionary itself) — that's investigation 2's deliverable
- Migration ordering / down-migration SQL — that's phase 1 build

---

## 1. Identity columns

### `company_id`
| | |
|---|---|
| **Type** | UUID PRIMARY KEY |
| **Default** | `gen_random_uuid()` |
| **V1 status** | Existing — no change |
| **Crust source** | none (internal) |
| **Admin UI** | URL slug on `/admin/companies/[id]`. Not editable. |
| **Recruiter UI** | not displayed |

### `company_name`
| | |
|---|---|
| **Type** | TEXT NOT NULL |
| **Default** | none |
| **V1 status** | Existing |
| **Crust source** | `basic_info.name` (search, enrich, identify) |
| **Tagging input** | yes (Claude tier-2 sees this) |
| **Admin UI** | List page (sortable column); edit page (text input, editable); new-company form; import preview table |
| **Recruiter UI** | ProfileTable experience-row chip; ProfileDrawer experience list; profile/[id] experience rows; search-builder company picker; CompanyLogo placeholder |
| **Notes** | Already populated 100% of rows. The `upsertCompany` matches on this case-insensitive when `linkedin_url` doesn't match. Crust returns it identically across all three endpoints. |

### `linkedin_url`
| | |
|---|---|
| **Type** | TEXT, UNIQUE |
| **Default** | NULL |
| **V1 status** | Existing — populated by `company-mapper-enrich-minimal` (3.6% → 9.8% post-backfill) |
| **Crust source** | `basic_info.professional_network_url` (search, enrich, identify); also embedded as `company_professional_network_profile_url` in the person sub-object on `/person/search` and `/person/enrich` |
| **Tagging input** | no |
| **Admin UI** | Edit page (text input, editable, validated as URL); list page (clickable LinkedIn icon); import preview table (clickable icon) |
| **Recruiter UI** | none directly (CompanyLogo derives domain from `website_url`, not `linkedin_url`) |
| **Notes** | Canonical LinkedIn identity. UNIQUE constraint already exists. Per resolved issue #8: `upsertCompany` matches by `crustdata_company_id` first (when present), then `linkedin_url`, then case-insensitive name. The bare-name fallback is now last-resort because Crust returns multiple distinct entities for the same short name (e.g. "Anduril" returns 4 different companies, none of them Anduril Industries). |

### `crustdata_company_id` (NEW in V1)
| | |
|---|---|
| **Type** | BIGINT, UNIQUE |
| **Default** | NULL |
| **V1 status** | NEW column, indexed, UNIQUE constraint |
| **Crust source** | `crustdata_company_id` (top-level) on search, enrich, identify responses. Also embedded as `crustdata_company_id` on every person experience entry — **currently dropped by our mapper; V1 phase 1 must update `lib/ingest/mappers/crust-v2.ts` to capture and thread it through to `upsertCompany`.** |
| **Tagging input** | no |
| **Admin UI** | Edit page (read-only display, copyable for debugging); not editable; not on list/new |
| **Recruiter UI** | none |
| **Notes** | Per resolved issue #8 (entity disambiguation): `upsertCompany` matching priority becomes (1) `crustdata_company_id` exact match, (2) `linkedin_url` exact match, (3) `company_name` ILIKE fallback. The integer ID is Crust's canonical key — when present in the person sub-object, it disambiguates "Anduril Industries" (id 639939) from "Anduril Retail" (27679), "Anduril SA" (22024175), "Alanduril" (28759788), etc. that all surface for the bare name "Anduril". |

### `professional_network_id` (NEW in V1)
| | |
|---|---|
| **Type** | TEXT |
| **Default** | NULL |
| **V1 status** | NEW column |
| **Crust source** | `basic_info.professional_network_id` (string, e.g. `"68529"` for HubSpot) |
| **Tagging input** | no |
| **Admin UI** | Edit page (read-only display); not editable |
| **Recruiter UI** | none |
| **Notes** | LinkedIn's internal numeric company ID. Useful as a secondary identity key when the URL slug changes (e.g. company rebrand). Crust returns as a string; store as TEXT. |

---

## 2. Taxonomy columns (the V1 controlled vocabulary)

### `category` (RENAMED from `focus`)
| | |
|---|---|
| **Type** | TEXT (was `company_focus_type` enum) |
| **Default** | `'unreviewed'` |
| **V1 status** | RENAMED from `focus`. Value migration: `hard_tech` → `hardware`; `all_tech` → `non_hardware`; `unreviewed` → `unreviewed` |
| **Constraint** | `CHECK (category IN ('hardware', 'non_hardware', 'unreviewed'))` |
| **Crust source** | derived by tagger; never directly from a Crust field. Defaults to `'unreviewed'` on auto-creation. |
| **Tagging input** | OUTPUT (the tagger writes this) |
| **Admin UI** | List page filter (dropdown: all / hardware / non_hardware / unreviewed); list page bulk-edit; edit page (single-select dropdown); new-company form; triage queue (defaults filter to `unreviewed`) |
| **Recruiter UI** | ProfileTable + search-builder filter candidate results to **only show candidates whose company has `category='hardware'`** (per resolved issue #6). Candidates whose primary current company is `non_hardware` OR `unreviewed` are HIDDEN from candidate result rows in those views. Filter chip labelled "Scope" replaces the old "focusScope". `/admin/companies` list and `/admin/companies/triage` queue stay UNFILTERED — admin sees everything. |
| **Notes** | Migration also renames the enum type itself: `company_focus_type` → `company_category_type`. Saved-filter URL alias for backward compat: `focusScope='hard_tech'` → `categoryScope='hardware'`. |

### `industry` (NEW in V1)
| | |
|---|---|
| **Type** | TEXT |
| **Default** | NULL |
| **V1 status** | NEW column |
| **Constraint** | `CHECK` conditional on `category` — see "CHECK constraints" section below |
| **Crust source** | derived by tagger from `taxonomy.professional_network_industry` (single string) + `basic_info.industries[]` (array) + `taxonomy.categories[]` (array). Mapped through dictionary. |
| **Tagging input** | OUTPUT |
| **Admin UI** | Edit page (single-select dropdown, options gated by `category`); list page filter (single-select); list page column display; new-company form; import preview table; triage queue |
| **Recruiter UI** | search-builder filter (replaces `primary_industry_tag`); ProfileTable cell sublabel under company name; ProfileDrawer; profile/[id]; search-builder dropdown options gated to hardware-branch industries for V1 |
| **Notes** | Locked-in V1 values: 15 hardware + 11 non-hardware (full list in section "Controlled vocabularies" below). When `category='unreviewed'`, must be NULL. |

### `domain_tags` (NEW in V1)
| | |
|---|---|
| **Type** | TEXT[] |
| **Default** | `'{}'::text[]` (empty array) |
| **V1 status** | NEW column |
| **Constraint** | `CHECK` conditional on `category` — see "CHECK constraints" section below |
| **Crust source** | derived by tagger from `taxonomy.categories[]` (free-form), `basic_info.industries[]`, plus Claude tier-2 inference from `basic_info.description` (enrich-only). |
| **Tagging input** | OUTPUT |
| **Admin UI** | Edit page (multi-select with chips, options gated by `category`); list page (chip display, comma-separated); import preview table; triage queue; **NO bulk-edit on multi-select arrays in V1** (deferred — too easy to clobber per-row data) |
| **Recruiter UI** | search-builder filter (multi-select chips, options gated to hardware tags); ProfileTable cell badges (compact display); profile/[id] |
| **Notes** | Locked-in V1 values: 8 hardware + 16 non-hardware. Multi-select. GIN index for performant `@>` containment queries: `CREATE INDEX idx_companies_domain_tags ON companies USING GIN (domain_tags);` Empty array is allowed; NULL is not (use empty array as the "none" state). |

---

## 3. Firmographics

### `company_type` (NEW in V1)
| | |
|---|---|
| **Type** | TEXT |
| **Default** | NULL |
| **V1 status** | NEW column. Per resolved issue #1: normalize Crust's title-case strings to lowercase enum at write time. |
| **Constraint** | `CHECK (company_type IS NULL OR company_type IN (<enumerated set>))` — **set finalized after Investigation 2** enumerates every Crust `basic_info.company_type` value seen across the 10 test companies + other common patterns. **Starter set: `private`, `public`, `subsidiary`.** Investigation 2 will add `partnership` (already observed for OpenAI), `nonprofit`, `government`, `educational`, etc. as needed. |
| **Crust source** | `basic_info.company_type`. Confirmed observations: `"Privately Held"` (Anduril, Stripe → `private`), `"Public Company"` (HubSpot → `public`), `"Partnership"` (OpenAI → `partnership`). |
| **Normalization rule** | Lowercase, strip "Held"/"Company" suffix, condense to one word. e.g. `"Privately Held"` → `private`; `"Public Company"` → `public`; `"Subsidiary"` → `subsidiary`; `"Partnership"` → `partnership`; `"Nonprofit"` → `nonprofit`; `"Government Agency"` → `government`. UI label rendering via TS map at `lib/companies/taxonomy.ts`. |
| **Tagging input** | yes (Claude tier-2 sees the normalized form for context) |
| **Admin UI** | Edit page (single-select dropdown); list page column display; import preview table |
| **Recruiter UI** | profile/[id] header (text); search-builder filter (deferred — not in V1) |
| **Notes** | The CHECK enum is finalized only after Investigation 2 reports. Phase 1 migration may add the column with no CHECK initially, then add CHECK in a follow-up after Investigation 2 confirms the value set. |

### `founding_year`
| | |
|---|---|
| **Type** | SMALLINT |
| **Default** | NULL |
| **V1 status** | Existing (28 rows filled, 1.8%) |
| **Constraint** | `CHECK (founding_year BETWEEN 1800 AND 2100)` |
| **Crust source** | `basic_info.year_founded` (string, e.g. `"2017"` or `"2017-01-01"`). Mapper parses to int. |
| **Tagging input** | no |
| **Admin UI** | Edit page (number input); list page column; new-company form |
| **Recruiter UI** | profile/[id]; search-builder filter (founded after / before — already exists) |
| **Notes** | Crust's `year_founded` is a STRING field. Parse: take first 4 digits, fall back to NULL on invalid. Already used by derived signals (`has_early_stage_experience`). |

### `website_url`
| | |
|---|---|
| **Type** | TEXT |
| **Default** | NULL |
| **V1 status** | Existing (~54% filled from CSV seeds) |
| **Crust source** | `basic_info.website` (full URL). Also `basic_info.primary_domain` available as fallback (just the domain). |
| **Tagging input** | yes (Claude tier-2 may use the domain to disambiguate) |
| **Admin UI** | Edit page (text input, validated); list page link (clickable globe icon); import preview |
| **Recruiter UI** | CompanyLogo derives domain from this for the logo.dev badge; profile/[id] linked text |
| **Notes** | Crust sometimes returns an empty string; treat empty as NULL. Always normalize to include `https://` prefix if missing (already done in places). |

### `headcount_range`
| | |
|---|---|
| **Type** | TEXT |
| **Default** | NULL |
| **V1 status** | Existing column (migration 019), 0% filled. V1 wires it up. |
| **Constraint** | `CHECK (headcount_range IS NULL OR headcount_range IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10000+'))` |
| **Crust source** | `basic_info.employee_count_range` |
| **Tagging input** | yes (informs hardware vs non-hardware sometimes — small companies harder to classify) |
| **Admin UI** | Edit page (single-select dropdown); list page column + filter; import preview |
| **Recruiter UI** | profile/[id]; search-builder filter (compound where-they-worked uses headcount band) |
| **Notes** | The banded form is sticky over time — useful for filtering when precise counts drift. Pair with `headcount_latest` (next field) for the precise integer. |

### `headcount_latest` (NEW in V1, per resolved issue #2)
| | |
|---|---|
| **Type** | INTEGER |
| **Default** | NULL |
| **V1 status** | NEW column. Populated by enrich. |
| **Crust source** | `headcount.total` (enrich; also returned by search). e.g. Anduril = 7218, Stripe = 14728, OpenAI = 7829. |
| **Tagging input** | yes (sometimes helps disambiguate; e.g. distinguishing a stage from a startup) |
| **Admin UI** | Edit page (read-only display, formatted with thousands separator); list page column (sortable); list page filter (>N range slider) |
| **Recruiter UI** | profile/[id] (display); search-builder (sortable, filterable as numeric range) |
| **Notes** | Pair with `headcount_latest_at` for staleness tracking. Re-fetched on every enrich call for vetted-tier; never re-fetched for reference-tier (so reference companies have NULL). |

### `headcount_latest_at` (NEW in V1, per resolved issue #2)
| | |
|---|---|
| **Type** | TIMESTAMPTZ |
| **Default** | NULL |
| **V1 status** | NEW column. Set when `headcount_latest` is written. |
| **Crust source** | none — set to `NOW()` at write time, OR can be derived from enrich's `metadata.growth_calculation_date` for fresher truth (enrich tells us when Crust last computed the headcount stat). Recommend: store the enrich `metadata.growth_calculation_date` when present, fall back to `NOW()`. |
| **Admin UI** | Edit page tooltip on the headcount field ("As of: 2026-04-29"); list page column (sortable); UI shows "stale" badge if older than 90 days |
| **Recruiter UI** | profile/[id] subtle "as of" annotation under headcount display |
| **Notes** | Drives the freshness UI. Future: a "Re-fetch from Crust" admin button on the company detail page, gated by staleness, that triggers a fresh enrich call. Out of scope for V1 (live enrich is admin-button-only V2). |

### `hq_location_name`
| | |
|---|---|
| **Type** | TEXT |
| **Default** | NULL |
| **V1 status** | Existing column, 0% filled. V1 wires it up. |
| **Crust source** | priority order: `locations.headquarters` (enrich, e.g. `"Costa Mesa, CA, US"`) → `locations.country + state + city` concatenation (search returns these as separate fields, often only `country` is set) → NULL |
| **Tagging input** | minor — tagger doesn't strongly use location |
| **Admin UI** | Edit page (text input — free-form for V1); list page column; import preview; new-company form |
| **Recruiter UI** | profile/[id] header; search-builder filter (deferred — recruiter location filter is on candidate.location_name, not company HQ) |
| **Notes** | Search returns spotty location data (we observed only `country` populated for Anduril, Stripe, OpenAI). Enrich's `locations.headquarters` is much richer when present. For V1, free-text storage; future: parse to structured city/state/country. |

---

## 4. Funding (V1 wires up the existing `funding_stage` column)

### `funding_stage`
| | |
|---|---|
| **Type** | TEXT |
| **Default** | NULL |
| **V1 status** | Existing column (migration 019), 0% filled. V1 populates via **derived logic** (per resolved issue #4). |
| **Constraint** | `CHECK (funding_stage IS NULL OR funding_stage IN ('pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'series_d', 'series_e', 'series_f', 'series_g', 'series_h', 'series_i', 'series_j', 'series_k'))` — priced equity rounds only. |
| **Crust source** | DERIVED from `funding.milestones[]` (enrich-only). Walk the array sorted newest-first; pick the first entry whose `round` field matches a priced equity round (Series A through Series Z, Seed, Pre-seed). |
| **Skip rules — round types that DO NOT count for stage:** | `Grant`, `Secondary Market`, `Corporate Round`, `Venture Round` (used for undisclosed-stage participations), `Post-IPO Equity`, `Debt`, `Convertible Note`, `Unknown`. These are funding EVENTS but don't move the company's stage. |
| **Reference-tier behavior** | NULL — reference-tier rows don't get enrich, so no milestones[]; correct fallback. |
| **Tagging input** | minor |
| **Admin UI** | Edit page (single-select dropdown of the 13 priced rounds); list page column; import preview |
| **Recruiter UI** | profile/[id]; search-builder filter (compound where-they-worked uses stage) |
| **Notes** | **Anduril verification confirmed the severity of the issue:** `last_round_type='grant'` would store "grant" for a Series G company. Derived logic correctly identifies Anduril as `series_g` (their $2.5B round on 2025-06-05). Storage of the derived stage requires `funding.milestones[]` from enrich. Implementation: small derive function in `lib/companies/derive-funding-stage.ts`, runs at enrich time. |
| **Round-name parsing** | Crust's milestones[].round comes as e.g. `"Series G - Anduril Industries"` — strip the suffix, lowercase, normalize `series g` → `series_g`. Handle case insensitivity, multiple spaces, "Pre-seed" / "PreSeed" / "Pre Seed" variants. |

---

## 5. Tagging metadata (NEW in V1)

### `tagging_method`
| | |
|---|---|
| **Type** | TEXT |
| **Default** | NULL (no tagging applied yet) |
| **V1 status** | NEW column |
| **Constraint** | `CHECK (tagging_method IS NULL OR tagging_method IN ('crust_dictionary', 'claude_inference', 'admin_manual'))` |
| **Crust source** | none (set by our system) |
| **Tagging input** | METADATA (set by tagger to record provenance) |
| **Admin UI** | Edit page (read-only display, color-coded chip); list page column; triage queue (filter by method) |
| **Recruiter UI** | none |
| **Notes** | Used by the import + triage flow to know whether a row's `category`/`industry`/`domain_tags` are auto-tagged (refreshable) or admin-set (frozen). When a manual edit happens, set to `'admin_manual'` and never overwrite from auto-tagging again. |

### `tagging_confidence`
| | |
|---|---|
| **Type** | NUMERIC(3,2) |
| **Default** | NULL |
| **V1 status** | NEW column |
| **Constraint** | `CHECK (tagging_confidence IS NULL OR (tagging_confidence >= 0 AND tagging_confidence <= 1))` |
| **Crust source** | none. For `crust_dictionary`: hard-coded 0.9–1.0 based on signal strength. For `claude_inference`: returned by Claude as part of structured JSON output. For `admin_manual`: 1.0. |
| **Admin UI** | Edit page (read-only display); list page column (sortable); triage queue (sort ascending — lowest confidence first); list page filter (slider: ≥ 0.7 / 0.5 / 0.3) |
| **Recruiter UI** | none |
| **Notes** | Drives the triage queue prioritization. Recruiter UIs ignore this — they only see/filter on `category`. |

### `tagging_notes`
| | |
|---|---|
| **Type** | TEXT |
| **Default** | NULL |
| **V1 status** | NEW column |
| **Crust source** | none. For `claude_inference`: stores Claude's `reasoning` field. For `crust_dictionary`: stores which signal triggered the match (e.g. `"matched on industries[0]='Defense and Space Manufacturing'"`). For `admin_manual`: NULL or admin-typed override note. |
| **Admin UI** | Edit page (read-only collapsed pane, expandable); triage queue (tooltip on hover) |
| **Recruiter UI** | none |
| **Notes** | Diagnostic / audit field. Useful for understanding low-confidence taggings and refining the dictionary later. |

---

## 6. Status / lifecycle (existing — V1 keeps as-is)

### `current_status`
| | |
|---|---|
| **Type** | `company_status_type` enum: `active | acquired | public | shut_down` |
| **Default** | `'active'` |
| **V1 status** | Existing — no change |
| **Crust source** | derived from `revenue.public_markets.ipo_date` (set → `public`); `revenue.acquisition_status` (when populated → `acquired`); `funding.acquired_by[]` populated → `acquired`. Default `active`. **No Crust signal for `shut_down`** — admin-only. |
| **Tagging input** | minor |
| **Admin UI** | Edit page (single-select); list page filter; new-company form; import preview |
| **Recruiter UI** | profile/[id]; search-builder filter |

### `manual_review_status`
| | |
|---|---|
| **Type** | `manual_review_status_type` enum: `unreviewed | reviewed | locked` |
| **Default** | `'unreviewed'` |
| **V1 status** | Existing — no change. Auto-created stays `'unreviewed'`. Admin promotes to `'reviewed'` once they've vetted the row. `'locked'` prevents auto-tagging from ever overwriting. |
| **Crust source** | none (admin-set) |
| **Admin UI** | Edit page (single-select); list page filter; bulk-edit; triage queue (filter by `'unreviewed'`) |
| **Recruiter UI** | none |

### `is_stealth_company`
| | |
|---|---|
| **Type** | BOOLEAN |
| **Default** | FALSE |
| **V1 status** | Existing — no change. Admin-set. |
| **Admin UI** | Edit page checkbox |
| **Recruiter UI** | profile/[id] badge if true; deferred filter |

### `company_score_mode`
| | |
|---|---|
| **Type** | `company_score_mode_type` enum |
| **Default** | `'manual'` |
| **V1 status** | Existing — no change |

---

## 7. Legacy taxonomy (renamed for backward compat in V1)

| Old name | New name (V1) | Type | Notes |
|---|---|---|---|
| `primary_industry_tag` | `legacy_primary_industry_tag` | TEXT | Preserve all existing data; UI shows in collapsed "Legacy taxonomy" pane on edit page; read-only; not in any new dropdown options. |
| `sub_industry_1` | `legacy_sub_industry_1` | TEXT | same |
| `sub_industry_2` | `legacy_sub_industry_2` | TEXT | same |
| `sub_industry_3` | `legacy_sub_industry_3` | TEXT | same |

**Why preserve:** Investigation showed `primary_industry_tag` is 51.5% filled (~781 rows). Dropping would lose admin context. Renaming to `legacy_*` with a column comment marks them as deprecated without data loss. Recruiter UI (ProfileTable, search-builder) stops referencing them in V1.

**Migration column comments:**
```sql
COMMENT ON COLUMN companies.legacy_primary_industry_tag IS
  'DEPRECATED in V1 — superseded by industry. Read-only after V1 migration. To be dropped in a future migration once all rows are reviewed.';
```

---

## 8. Audit / admin (existing)

| Column | Type | Default | V1 status |
|---|---|---|---|
| `notes` | TEXT | NULL | Existing — admin free-text on edit page |
| `created_at` | TIMESTAMPTZ | NOW() | Existing |
| `updated_at` | TIMESTAMPTZ | NOW() (trigger) | Existing |

---

## 9. Deprecate-eligible (V1 keeps; future cleanup)

These are columns that V1 inventory keeps untouched but that Investigation found are effectively unused. Listed here for visibility — NOT to be dropped in V1, but worth removing in a future cleanup migration after confirmation:

| Column | Reason | Recommendation |
|---|---|---|
| `company_bucket` (`company_bucket_type` enum) | 0.07% filled (1 row) | Keep through V1, drop in V2. The column was the original tier-quality bucket; superseded operationally by `category` + `manual_review_status`. |
| `founding_date` (DATE) | 0% filled (we only ever have year, not month/day) | Keep through V1, drop in V2. `founding_year` is sufficient. |

---

## Controlled vocabularies (round-2 — superseded round-1 lists)

### `category` (round-2 amendment: dropped 'unreviewed')
```
hardware
non_hardware
```
NULL category = "tagger couldn't classify"; row needs admin attention via `review_status='unreviewed'`.

### `review_status` (NEW round-2)
```
vetted
unreviewed
excluded
```

### `industry` by category

**hardware (15):**
```
Defense
Aerospace
Automotive
Robotics
Medical Devices
Biotech
Energy
Energy Storage
Climate
Semiconductors
Consumer Electronics
Industrial Manufacturing
Materials
Maritime
Other Hardware
```

**non_hardware (13 — round-2 added Defense + Aerospace per decision #12):**
```
SaaS
AI
FinTech
Investment Banking
Quant/Trading
Blockchain & Web3
Consumer Tech
HealthTech
Biotech
Services
Legal
Defense          ← round-2 added (software/services for defense customers)
Aerospace        ← round-2 added (software for the aerospace industry)
```

**unreviewed:** `industry` MUST BE NULL.

⚠️ **Note:** `Biotech` appears in BOTH hardware and non-hardware. Intentional (medical-device biotech vs software-biotech), but the dictionary tagger needs to disambiguate using other Crust signals (`taxonomy.categories[]`, `basic_info.description`). **Flag for investigation 2** — verify the dictionary can route Biotech-named-cos correctly.

### `domain_tags` by category

**hardware (9 — round-2 added AI per decision #11):**
```
Rockets
Satellites
Drones
eVTOL
Autonomous Driving
Automotive Manufacturing
EVs
Nuclear
AI               ← round-2 added (suppress when primary_industry='AI')
```

**non_hardware (17 — round-2 added AI per decision #11):**
```
Consumer
Infrastructure
Mobile
Cybersecurity
DevTools
B2B
Data
Payments
Productivity
HR
Gaming
Social
Streaming
Marketplace
Analytics
Enterprise Software
AI               ← round-2 added (suppress when primary_industry='AI')
```

**Suppression rule (round-2 decision #5 / Concern 5):** the orchestrator strips a domain_tag from `domain_tags[]` when it duplicates `primary_industry`. Currently affects only AI (industry name = tag name). Generalized for any future cross-listings.

**unreviewed:** `domain_tags` MUST BE empty array `'{}'::text[]`.

### `tagging_method`
```
crust_dictionary
claude_inference
admin_manual
```

### `funding_stage` (priced equity rounds only)

```
pre_seed
seed
series_a
series_b
series_c
series_d
series_e
series_f
series_g
series_h
series_i
series_j
series_k
```

Skip-list (events that DON'T set stage): Grant, Secondary Market, Corporate Round, Venture Round (undisclosed), Post-IPO Equity, Debt, Convertible Note, Unknown.

### `company_type` (locked starter set; finalized after Investigation 2)

Starter set per resolved issue #1:
```
private
public
subsidiary
```

Investigation 2 enumerates additional Crust values. Already-observed values to add: `partnership` (OpenAI). Likely additions: `nonprofit`, `government`, `educational`. **Final CHECK constraint added in a follow-up migration after Investigation 2 reports the comprehensive set.**

### `headcount_range` (banded)

```
1-10
11-50
51-200
201-500
501-1000
1001-5000
5001-10000
10000+
```

Verbatim from Crust `basic_info.employee_count_range`.

---

## CHECK constraint specifications (SQL — drafts for migration)

```sql
-- category: 3-value enum, enforced via CHECK
ALTER TABLE companies
  ADD CONSTRAINT companies_category_check
  CHECK (category IN ('hardware', 'non_hardware', 'unreviewed'));

-- industry: conditional on category
ALTER TABLE companies
  ADD CONSTRAINT companies_industry_check
  CHECK (
    CASE category
      WHEN 'hardware' THEN industry IN (
        'Defense', 'Aerospace', 'Automotive', 'Robotics', 'Medical Devices',
        'Biotech', 'Energy', 'Energy Storage', 'Climate', 'Semiconductors',
        'Consumer Electronics', 'Industrial Manufacturing', 'Materials',
        'Maritime', 'Other Hardware'
      )
      WHEN 'non_hardware' THEN industry IN (
        'SaaS', 'AI', 'FinTech', 'Investment Banking', 'Quant/Trading',
        'Blockchain & Web3', 'Consumer Tech', 'HealthTech', 'Biotech',
        'Services', 'Legal'
      )
      WHEN 'unreviewed' THEN industry IS NULL
    END
  );

-- domain_tags: each element must be valid for the category
ALTER TABLE companies
  ADD CONSTRAINT companies_domain_tags_check
  CHECK (
    CASE category
      WHEN 'hardware' THEN domain_tags <@ ARRAY[
        'Rockets', 'Satellites', 'Drones', 'eVTOL', 'Autonomous Driving',
        'Automotive Manufacturing', 'EVs', 'Nuclear'
      ]::text[]
      WHEN 'non_hardware' THEN domain_tags <@ ARRAY[
        'Consumer', 'Infrastructure', 'Mobile', 'Cybersecurity', 'DevTools',
        'B2B', 'Data', 'Payments', 'Productivity', 'HR', 'Gaming', 'Social',
        'Streaming', 'Marketplace', 'Analytics', 'Enterprise Software'
      ]::text[]
      WHEN 'unreviewed' THEN domain_tags = ARRAY[]::text[]
    END
  );

-- tagging_method
ALTER TABLE companies
  ADD CONSTRAINT companies_tagging_method_check
  CHECK (tagging_method IS NULL OR tagging_method IN (
    'crust_dictionary', 'claude_inference', 'admin_manual'
  ));

-- tagging_confidence
ALTER TABLE companies
  ADD CONSTRAINT companies_tagging_confidence_check
  CHECK (tagging_confidence IS NULL OR (tagging_confidence >= 0 AND tagging_confidence <= 1));

-- funding_stage (priced equity rounds only — derived from milestones[])
ALTER TABLE companies
  ADD CONSTRAINT companies_funding_stage_check
  CHECK (funding_stage IS NULL OR funding_stage IN (
    'pre_seed', 'seed',
    'series_a', 'series_b', 'series_c', 'series_d', 'series_e',
    'series_f', 'series_g', 'series_h', 'series_i', 'series_j', 'series_k'
  ));

-- headcount_range (Crust banded)
ALTER TABLE companies
  ADD CONSTRAINT companies_headcount_range_check
  CHECK (headcount_range IS NULL OR headcount_range IN (
    '1-10', '11-50', '51-200', '201-500',
    '501-1000', '1001-5000', '5001-10000', '10000+'
  ));

-- crustdata_company_id UNIQUE constraint (per resolved issue #8)
ALTER TABLE companies
  ADD CONSTRAINT companies_crustdata_company_id_unique
  UNIQUE (crustdata_company_id);

-- company_type CHECK deferred to follow-up migration after Investigation 2 enumerates values
```

Plus indexes:
```sql
CREATE INDEX idx_companies_category ON companies (category);
CREATE INDEX idx_companies_industry ON companies (industry) WHERE industry IS NOT NULL;
CREATE INDEX idx_companies_domain_tags ON companies USING GIN (domain_tags);
CREATE INDEX idx_companies_crustdata_id ON companies (crustdata_company_id) WHERE crustdata_company_id IS NOT NULL;
CREATE INDEX idx_companies_tagging_confidence ON companies (tagging_confidence) WHERE tagging_confidence IS NOT NULL;
CREATE INDEX idx_companies_headcount_latest ON companies (headcount_latest) WHERE headcount_latest IS NOT NULL;
CREATE INDEX idx_companies_funding_stage ON companies (funding_stage) WHERE funding_stage IS NOT NULL;
```

---

## TS config mirror (UI dropdown source of truth)

The CHECK constraints are the DB-side truth. The UI needs the same values to populate dropdowns. Single source of truth lives at `lib/companies/taxonomy.ts`:

```typescript
// lib/companies/taxonomy.ts
// Source of truth for V1 taxonomy. Must agree with the CHECK constraints
// in supabase/migrations/{NNN}_companies_v1_taxonomy.sql.
// To extend the taxonomy: write a migration that updates BOTH the CHECK
// constraint AND this file.

export const CATEGORIES = ['hardware', 'non_hardware', 'unreviewed'] as const
export type Category = typeof CATEGORIES[number]

export const HARDWARE_INDUSTRIES = [
  'Defense', 'Aerospace', 'Automotive', 'Robotics', 'Medical Devices',
  'Biotech', 'Energy', 'Energy Storage', 'Climate', 'Semiconductors',
  'Consumer Electronics', 'Industrial Manufacturing', 'Materials',
  'Maritime', 'Other Hardware',
] as const

export const NON_HARDWARE_INDUSTRIES = [
  'SaaS', 'AI', 'FinTech', 'Investment Banking', 'Quant/Trading',
  'Blockchain & Web3', 'Consumer Tech', 'HealthTech', 'Biotech',
  'Services', 'Legal',
] as const

export const HARDWARE_DOMAIN_TAGS = [
  'Rockets', 'Satellites', 'Drones', 'eVTOL', 'Autonomous Driving',
  'Automotive Manufacturing', 'EVs', 'Nuclear',
] as const

export const NON_HARDWARE_DOMAIN_TAGS = [
  'Consumer', 'Infrastructure', 'Mobile', 'Cybersecurity', 'DevTools',
  'B2B', 'Data', 'Payments', 'Productivity', 'HR', 'Gaming', 'Social',
  'Streaming', 'Marketplace', 'Analytics', 'Enterprise Software',
] as const

export const TAGGING_METHODS = [
  'crust_dictionary', 'claude_inference', 'admin_manual',
] as const

export const FUNDING_STAGES = [
  'pre_seed', 'seed',
  'series_a', 'series_b', 'series_c', 'series_d', 'series_e',
  'series_f', 'series_g', 'series_h', 'series_i', 'series_j', 'series_k',
] as const
export type FundingStage = typeof FUNDING_STAGES[number]

export const HEADCOUNT_RANGES = [
  '1-10', '11-50', '51-200', '201-500',
  '501-1000', '1001-5000', '5001-10000', '10000+',
] as const
export type HeadcountRange = typeof HEADCOUNT_RANGES[number]

// Starter set per resolved issue #1 — extended after Investigation 2 reports
export const COMPANY_TYPES = ['private', 'public', 'subsidiary'] as const
export type CompanyType = typeof COMPANY_TYPES[number]

// UI label maps (rendered as title case in dropdowns + chips)
export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  private: 'Private',
  public: 'Public',
  subsidiary: 'Subsidiary',
}
// Add: partnership, nonprofit, government, educational after Investigation 2.

export function industriesFor(category: Category): readonly string[] {
  switch (category) {
    case 'hardware': return HARDWARE_INDUSTRIES
    case 'non_hardware': return NON_HARDWARE_INDUSTRIES
    case 'unreviewed': return []
  }
}

export function domainTagsFor(category: Category): readonly string[] {
  switch (category) {
    case 'hardware': return HARDWARE_DOMAIN_TAGS
    case 'non_hardware': return NON_HARDWARE_DOMAIN_TAGS
    case 'unreviewed': return []
  }
}
```

Used by:
- All admin form components (industry dropdown, domain_tags multi-select)
- Search-builder filter components
- Tagger dictionary (validates Claude tier-2 output before write)
- Future bulk-edit modal (industry dropdown reads from `industriesFor(row.category)`)

---

## UI surface inventory

### Admin pages

| Surface | Path | Renders | Filters/edits |
|---|---|---|---|
| Companies list | `/admin/companies` | name (sort), industry, category (chip), tagging_method (chip), tagging_confidence (sortable), website_url (icon), linkedin_url (icon), founding_year, headcount_range, headcount_latest (sortable), funding_stage, current_status | Filter: category, industry, current_status, manual_review_status, tagging_method, tagging_confidence threshold. **Bulk-edit: ONLY `category` (single-select) and `manual_review_status`** (per resolved issue #5). NO bulk-edit on industry, domain_tags, or any other field. UNFILTERED by category — admin sees everything. |
| Companies detail | `/admin/companies/[id]` | every column | Edit: name, website_url, linkedin_url, founding_year, headcount_range, hq_location_name, current_status, is_stealth_company, manual_review_status, category, industry (gated), domain_tags (gated, multi), notes. Read-only: crustdata_company_id, professional_network_id, company_type, funding_stage, tagging_method, tagging_confidence, tagging_notes, legacy_*. Collapsed pane for legacy taxonomy. |
| New company | `/admin/companies/new` | minimal form | Insert: name, website_url, linkedin_url, founding_year, current_status, category. Defaults: `manual_review_status='unreviewed'`, `tagging_method=NULL`. |
| **Import (NEW)** | `/admin/companies/import` | Sidebar filter builder + preview-then-confirm + per-company workflow | Filters via `/company/search` autocomplete. **Single-company-at-a-time workflow primary** (per Matt's incremental testing pattern); bulk import as secondary mode. After import: preview shows tagger output (category/industry/domain_tags + confidence + reasoning) for admin to approve before write. **Per resolved issue #8:** company-name autocomplete returns ranked results from `/company/search/autocomplete` PLUS `/company/identify` (free) for canonical disambiguation. Each option in the dropdown displays: company name + primary_domain + LinkedIn URL + headcount band — admin picks the canonical entity manually. NO auto-pick of top match (which would have selected wrong "Anduril" entity in our test). |
| **Triage (NEW)** | `/admin/companies/triage` | Queue of low-confidence + unreviewed rows | **Confirmed in V1 per resolved issue #7** — reference-tier auto-creates from candidate ingestion regularly populate `category='unreviewed'`; without a dedicated queue, the pile grows silently. Filter: `category='unreviewed'` OR `tagging_confidence < 0.7`. **Sort: candidate count desc** (companies affecting more search results reviewed first), then `tagging_confidence` asc. Inline edit: category, industry, domain_tags. UNFILTERED by category — admin can edit any row. |

### Recruiter-facing pages

| Surface | File | Renders | V1 changes |
|---|---|---|---|
| ProfileTable | `app/components/ProfileTable.tsx` | company_name (chip), industry (sublabel), domain_tags (badges) | Per resolved issue #6: **filter candidate result rows to only show candidates whose primary current company has `category='hardware'`**. Candidates at non_hardware/unreviewed companies are HIDDEN from the result rows — the JOIN against companies excludes them. The "Scope" filter chip lets admin override (toggle to show all). Replace `primary_industry_tag` references with `industry`. New domain_tags filter (multi-select). |
| ProfileDrawer | `app/components/ProfileDrawer.tsx` | company_name on each experience row | Renders whatever the candidate's experiences link to — including non-hardware past employers (the experience history shouldn't be censored). Only the result-row inclusion is filtered by category, not the per-row experience display. |
| Profile detail | `app/profile/[id]/page.tsx` | company_name + logo on each experience row, industry/domain_tags on current company header card | Same as drawer — past experiences render fully. Only the candidate's INCLUSION in result rows depends on their primary current company's category. |
| Search builder | `app/search-builder/page.tsx` | Company picker + per-condition company attributes (industry, domain_tags, category, founded year, stage, headcount) | Replace `primary_industry_tag` with `industry`. New `domain_tags` filter (multi-select chips, gated to hardware-branch tags for V1 default; admin can toggle to non_hardware view). Replace `focus` filter with `category`. Same hide-non-hardware-and-unreviewed default. |
| FilterSidebar | `app/components/FilterSidebar.tsx` | Search Scope dropdown | Rename "focusScope" → "categoryScope". Default value: `hardware`. Options: `hardware` / `all` (admin override that includes non_hardware AND unreviewed). The old `unreviewed` and `all_tech` recruiter options are removed. |

### Saved-filter URL backward compat

ProfileTable line 293 reads `f.focusScope` from a deserialized filter blob (URL/saved-filter persistence). On deserialize, alias old values:

```ts
const aliasFocusScope = (v: string): CategoryScope => {
  if (v === 'hard_tech') return 'hardware'
  if (v === 'all_tech') return 'non_hardware'
  if (v === 'unreviewed') return 'unreviewed'
  if (v === 'all') return 'all'
  return v as CategoryScope
}
```

Apply at deserialize time. Forever, or for one quarter — Matt's call.

---

## Resolved issues (locked 2026-05-01)

### Issue #1 — `company_type` normalized vocabulary — **RESOLVED**
**Decision:** Normalize to lowercase enum (`private`, `public`, `subsidiary`) with UI label map. Investigation 2 enumerates every Crust `basic_info.company_type` value seen across the 10 test companies + other common patterns; the comprehensive enum is finalized in a follow-up migration after Investigation 2 reports.

### Issue #2 — `headcount_total` precise vs banded — **RESOLVED**
**Decision:** Add `headcount_latest INTEGER` + `headcount_latest_at TIMESTAMPTZ`. Standard practice — store the value plus when we got it for staleness tracking and freshness UI. Useful for hypergrowth detection AND letting users filter/sort by company size. See firmographics section.

### Issue #3 — `Biotech` ambiguity — **RESOLVED**
**Decision:** Approved. Investigation 2 must include at least 2 Biotech-named test companies (one hardware/devices-leaning, one software/drug-discovery-leaning) to stress-test the dictionary. Tagger disambiguates from Crust signals (`taxonomy.categories[]`, `basic_info.description`, `basic_info.industries[]`).

### Issue #4 — `funding_stage` raw vs derived — **RESOLVED**
**Decision:** Option (b) — derived from `funding.milestones[]`. Walk the array backward, pick the most recent priced equity round (Series A-Z, Seed, Pre-seed). Skip grants, secondary markets, corporate rounds, undisclosed venture, debt, post-IPO equity, convertible notes, unknown. Vetted-tier (enrich data available) gets accurate stage. Reference-tier (identify-only, no milestones) stays NULL — correct behavior, no degradation.

**Anduril verification (2026-05-01) confirmed the severity of the issue.** Anduril Industries (crustdata_company_id=639939) reports:
- `last_round_type='grant'` (a $150K XPRIZE prize on 2026-01-29)
- Actual most recent priced equity round: $2.5B Series G on 2025-06-05 (Founders Fund lead)

Option (a) would store `funding_stage='grant'` for a Series G defense unicorn — actively misleading. Option (b) correctly derives `funding_stage='series_g'`. Implementation: ~30-line function in `lib/companies/derive-funding-stage.ts`.

### Issue #5 — Bulk-edit on industry / domain_tags — **RESOLVED**
**Decision:** NO bulk-edit on `industry` or `domain_tags` in V1.
- `industry` is category-gated → bulk-edit fails silently when selection spans categories
- `domain_tags` is an array → unclear semantics on replace vs add vs subtract

Bulk-edit allowed on `category` and `manual_review_status` only. Per-row edit for industry/domain_tags via the company detail page.

### Issue #6 — Hide unreviewed/non_hardware from candidate search — **RESOLVED**
**Decision:** YES hide. ProfileTable and search-builder (currently admin-only — no separate recruiter UI exists yet) **filter candidate result rows** to only show candidates whose primary current company has `category='hardware'`. Candidates whose primary company is `non_hardware` OR `unreviewed` don't surface in those views. The `/admin/companies` list and `/admin/companies/triage` queue stay UNFILTERED so admin can edit unreviewed entries directly.

### Issue #7 — `/admin/companies/triage` in V1 or V2 — **RESOLVED**
**Decision:** KEEP in V1. Reference-tier companies will auto-create at `category='unreviewed'` regularly from candidate ingestion. Without a dedicated triage queue, the pile grows silently. Queue shows `category='unreviewed'` OR `tagging_confidence < 0.7`, prioritized by candidate count (companies affecting more search results reviewed first), then by tagging_confidence ascending.

### Issue #8 — Entity disambiguation for `/company/identify` name matches — **RESOLVED** (new, surfaced from Anduril verification)

**Background:** Identify-by-name returns multiple distinct Crust entities for the same short name. Verified 2026-05-01: identify-by-name "Anduril" returns 4 matches — Anduril (anduril.fr consulting), Anduril Retail, Anduril SA, Alanduril — and **the canonical Anduril Industries (id 639939) is NOT in the top 4 by Crust's ranking**. Auto-picking the top match would silently link to the wrong entity.

**Decision:**
- **Reference-tier ingest path** (`upsertCompany` in `app/api/ingest/route.ts`): use `crustdata_company_id` from the person sub-object as PRIMARY disambiguator (currently dropped by mapper — must update `lib/ingest/mappers/crust-v2.ts` to capture). Fall back to embedded LinkedIn URL (`company_professional_network_profile_url`). Bare-name fallback ONLY as last resort. Matching priority: `crustdata_company_id` exact → `linkedin_url` exact → `company_name` ILIKE.
- **Admin import UI** (`/admin/companies/import`): autocomplete returns ranked options from `/company/search/autocomplete` + `/company/identify` (free). Admin picks the canonical option from a dropdown that **displays domain + LinkedIn URL + headcount band as disambiguators**. NO auto-pick top match.

This requires:
1. `crustdata_company_id` UNIQUE constraint on `companies` (so the primary-key-style match is enforceable)
2. Mapper update to capture `crustdata_company_id` from person sub-object
3. `upsertCompany` matching priority change
4. Import-UI autocomplete component spec for the disambiguator dropdown

---

## Sign-off checklist (LOCKED 2026-05-01)

- [x] Issue #1: `company_type` normalize to lowercase enum (`private`, `public`, `subsidiary` starter; finalized after Investigation 2)
- [x] Issue #2: Add `headcount_latest INTEGER` + `headcount_latest_at TIMESTAMPTZ`
- [x] Issue #3: Biotech ambiguity — Investigation 2 includes 2 Biotech-named test cases
- [x] Issue #4: `funding_stage` derived from `milestones[]` (option b)
- [x] Issue #5: NO bulk-edit on industry/domain_tags; bulk-edit only on `category` and `manual_review_status`
- [x] Issue #6: Hide non_hardware AND unreviewed candidates from ProfileTable + search-builder result rows
- [x] Issue #7: Triage queue `/admin/companies/triage` IN V1
- [x] Issue #8: Entity disambiguation — `crustdata_company_id` UNIQUE constraint, mapper captures it from person sub-object, `upsertCompany` matches by it first, import UI requires admin pick (no auto-pick)
- [x] Controlled vocabulary lists (15/8 hardware, 11/16 non-hardware) re-confirmed by Matt
- [x] CHECK constraint SQL approved as the V1 enforcement mechanism (per pushback #5)
- [x] TS config at `lib/companies/taxonomy.ts` approved as UI source of truth
- [x] Saved-filter URL alias approach approved
- [x] Legacy column rename strategy (`legacy_*` prefix, no drops) approved
- [x] Deprecate-eligible columns (`company_bucket`, `founding_date`) approved to keep through V1
- [x] Matching priority change in `upsertCompany`: `crustdata_company_id` → `linkedin_url` → name (per Issue #8)
- [x] Mapper update: capture `crustdata_company_id` from person sub-object (currently dropped) — required by Issue #8

**This document is now the contract for Phase 1 build. Any change to schema, controlled vocabulary, UI surface behavior, or matching logic during implementation requires updating this document FIRST.**
