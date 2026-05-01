# Vetted Companies V1 — Field-to-UI Mapping Inventory

**Status:** PROPOSED. Lock this document before phase 1 build.
**Author:** Claude Code
**Date:** 2026-05-01

This document is the **contract** between:
- The schema migration (what columns exist, what constraints they have)
- The auto-tagging system (what values it produces, what input data it reads)
- The UI build (what surfaces display each field, what control type)

If any of these three diverge from this document during implementation, this document is wrong and gets updated; we don't ship code that disagrees with the inventory.

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
| **Notes** | Canonical company identity. UNIQUE constraint already exists. `upsertCompany` matches by this first, name fallback. |

### `crustdata_company_id` (NEW in V1)
| | |
|---|---|
| **Type** | BIGINT |
| **Default** | NULL |
| **V1 status** | NEW column, indexed |
| **Crust source** | `crustdata_company_id` (top-level) on search, enrich, identify responses. Also embedded as `crustdata_company_id` on every person experience entry (currently dropped by our mapper). |
| **Tagging input** | no |
| **Admin UI** | Edit page (read-only display, copyable for debugging); not editable; not on list/new |
| **Recruiter UI** | none |
| **Notes** | Required for chaining identify → enrich without redundant lookups. Once populated, `upsertCompany` should prefer this over `linkedin_url` for matching (it's an integer, faster, and Crust's canonical key). Add `INDEX idx_companies_crustdata_id`. |

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
| **Recruiter UI** | ProfileTable filter (replaces `focusScope`); search-builder filter; FilterSidebar; **V1 default: hide `non_hardware` from recruiter UIs** (only `hardware` surfaces; `unreviewed` admin-only) |
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
| **V1 status** | NEW column |
| **Constraint** | `CHECK (company_type IS NULL OR company_type IN ('private', 'public', 'subsidiary', 'partnership', 'nonprofit', 'government'))` ← **need to verify Crust's full enum, see open question** |
| **Crust source** | `basic_info.company_type`. Observed values: `"Privately Held"` (Anduril, Stripe), `"Public Company"` (HubSpot), `"Partnership"` (OpenAI). **Need to enumerate the full Crust value set during investigation 2 / dictionary build.** |
| **Tagging input** | yes (Claude tier-2 sees this for context) |
| **Admin UI** | Edit page (single-select dropdown); list page column display; import preview table |
| **Recruiter UI** | profile/[id] header (text); search-builder filter (deferred — not in V1) |
| **Notes** | Crust returns a string with title casing; we should normalize at write time (e.g. `"Privately Held"` → `'private'`). The CHECK constraint enforces our normalized form. **Open question: does our normalized vocabulary match what Matt wants displayed?** Recommend: store normalized lowercase enum, render UI label via TS map. |

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
| **Constraint** | none today; recommend `CHECK` against Crust's banded set: `'1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10000+'` |
| **Crust source** | `basic_info.employee_count_range` |
| **Tagging input** | yes (informs hardware vs non-hardware sometimes — small companies harder to classify) |
| **Admin UI** | Edit page (single-select dropdown using the 8 banded values); list page column; list page filter; import preview |
| **Recruiter UI** | profile/[id]; search-builder filter (compound where-they-worked uses headcount band) |
| **Notes** | The exact-headcount integer is also available via `headcount.total` on enrich (e.g. `7218` for Anduril); we may want a separate `headcount_total` column for that — **decision needed in (e) below**. For V1 keep the banded string only. |

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
| **V1 status** | Existing column (migration 019), 0% filled. V1 populates from enrich's `funding.last_round_type`. |
| **Constraint** | none today; recommend `CHECK` against the Crust value set (TBD — observed: `series_a`, `series_b`, `series_unknown`, `secondary_market`, `grant`, `post_ipo_equity`). Need to enumerate the full set during investigation 2. |
| **Crust source** | `funding.last_round_type` (enrich; also in search) |
| **Tagging input** | minor |
| **Admin UI** | Edit page (single-select); list page column; import preview |
| **Recruiter UI** | profile/[id]; search-builder filter (compound where-they-worked uses stage) |
| **Notes** | ⚠️ Crust's "last round" is the most recent funding EVENT, not the most recent priced equity round. Anduril's `last_round_type='grant'` for a $150K grant ≠ their actual stage (they're a megaround startup). **Display caveat needed** in admin UI. The `funding.milestones[]` array (enrich-only) gives the full round-by-round history if we want to derive a saner "stage" — recommend: future enhancement, not V1. For V1 store the raw `last_round_type` and accept the noise. |

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

## Controlled vocabularies (CHECK constraint values)

### `category`
```
hardware
non_hardware
unreviewed
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

**non_hardware (11):**
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
```

**unreviewed:** `industry` MUST BE NULL.

⚠️ **Note:** `Biotech` appears in BOTH hardware and non-hardware. Intentional (medical-device biotech vs software-biotech), but the dictionary tagger needs to disambiguate using other Crust signals (`taxonomy.categories[]`, `basic_info.description`). **Flag for investigation 2** — verify the dictionary can route Biotech-named-cos correctly.

### `domain_tags` by category

**hardware (8):**
```
Rockets
Satellites
Drones
eVTOL
Autonomous Driving
Automotive Manufacturing
EVs
Nuclear
```

**non_hardware (16):**
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
```

**unreviewed:** `domain_tags` MUST BE empty array `'{}'::text[]`.

### `tagging_method`
```
crust_dictionary
claude_inference
admin_manual
```

### `company_type` (TBD — verify Crust enum)

Proposed normalized values: `private`, `public`, `subsidiary`, `partnership`, `nonprofit`, `government`. **Investigation 2 must enumerate the full Crust `basic_info.company_type` value set across the 10 test companies before we lock this CHECK.**

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
```

Plus indexes:
```sql
CREATE INDEX idx_companies_category ON companies (category);
CREATE INDEX idx_companies_industry ON companies (industry) WHERE industry IS NOT NULL;
CREATE INDEX idx_companies_domain_tags ON companies USING GIN (domain_tags);
CREATE INDEX idx_companies_crustdata_id ON companies (crustdata_company_id) WHERE crustdata_company_id IS NOT NULL;
CREATE INDEX idx_companies_tagging_confidence ON companies (tagging_confidence) WHERE tagging_confidence IS NOT NULL;
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
| Companies list | `/admin/companies` | name (sort), industry, category (chip), tagging_method (chip), tagging_confidence (sortable), website_url (icon), linkedin_url (icon), founding_year, headcount_range, current_status | Filter: category, industry, current_status, manual_review_status, tagging_method, tagging_confidence threshold. Bulk-edit: category (single-select), manual_review_status. **NO bulk-edit on industry or domain_tags in V1** (per-row gated dropdowns are too complex for bulk). |
| Companies detail | `/admin/companies/[id]` | every column | Edit: name, website_url, linkedin_url, founding_year, headcount_range, hq_location_name, current_status, is_stealth_company, manual_review_status, category, industry (gated), domain_tags (gated, multi), notes. Read-only: crustdata_company_id, professional_network_id, company_type, funding_stage, tagging_method, tagging_confidence, tagging_notes, legacy_*. Collapsed pane for legacy taxonomy. |
| New company | `/admin/companies/new` | minimal form | Insert: name, website_url, linkedin_url, founding_year, current_status, category. Defaults: `manual_review_status='unreviewed'`, `tagging_method=NULL`. |
| **Import (NEW)** | `/admin/companies/import` | Sidebar filter builder + preview-then-confirm + per-company workflow | Filters via `/company/search` autocomplete. **Single-company-at-a-time workflow primary** (Matt's incremental testing); bulk import as secondary mode. After import: preview shows tagger output (category/industry/domain_tags + confidence + reasoning) for admin to approve before write. |
| **Triage (NEW)** | `/admin/companies/triage` | Queue of low-confidence + unreviewed rows | Filter: `category='unreviewed'` OR `tagging_confidence < 0.7`. Sort: candidate count desc, then confidence asc. Inline edit: category, industry, domain_tags. |

### Recruiter-facing pages

| Surface | File | Renders | V1 changes |
|---|---|---|---|
| ProfileTable | `app/components/ProfileTable.tsx` | company_name (chip), industry (sublabel) | Replace `focusScope` filter with `category` filter. Default-hide `non_hardware` and `unreviewed` from filter options (admin-only). Replace `primary_industry_tag` references with `industry`. |
| ProfileDrawer | `app/components/ProfileDrawer.tsx` | company_name on each experience row | No filter changes; just renders whatever is linked. |
| Profile detail | `app/profile/[id]/page.tsx` | company_name + logo on each experience row | No taxonomy changes here; renders whatever is linked. |
| Search builder | `app/search-builder/page.tsx` | Company picker + per-condition company attributes | Replace `primary_industry_tag` with `industry`. New `domain_tags` filter (multi-select chips, gated to hardware-branch tags for V1). Replace `focus` filter with `category`. Same hide-non-hardware default. |
| FilterSidebar | `app/components/FilterSidebar.tsx` | Search Scope dropdown | Rename "focusScope" → "categoryScope", values: all / hardware. Remove `non_hardware` and `unreviewed` from recruiter-facing options for V1. |

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

## Open issues for review (please answer before phase 1 build)

1. **`company_type` normalized vocabulary.** Crust returns title-case strings (`"Privately Held"`, `"Public Company"`, `"Partnership"`). Should we (a) normalize to lowercase enum (`private`, `public`, `partnership`) and render UI labels via TS map, or (b) store Crust's raw string and CHECK against a literal list? Recommend (a). **Need to enumerate the full Crust value set during investigation 2.**

2. **`headcount_total` (precise integer) vs `headcount_range` (banded string).** Enrich returns both. We currently only have a column for the banded string. Worth adding `headcount_total INTEGER NULL` for precise filtering / display? Tradeoff: more data → more drift over time as headcount changes, vs the band which is sticky. Recommend: add it as `headcount_latest INTEGER NULL`, populated from enrich `headcount.total`, with a `headcount_latest_at TIMESTAMPTZ` for staleness.

3. **`Biotech` ambiguity.** Listed in BOTH hardware and non-hardware industries. Tagger needs to disambiguate (hardware = medical device / wet lab / instrumentation; non-hardware = software / AI for biotech). Investigation 2 must verify the tagger can route correctly given Crust signals. Recommend: investigation 2 runs at least 2 Biotech-named test companies — one hardware-leaning, one software-leaning.

4. **`funding_stage` raw vs derived.** Crust's `last_round_type` is event-based (Anduril's "last" is a $150K grant ≠ their actual stage). Storing it raw misleads. Three options: (a) store raw and accept the noise; (b) derive a saner stage from `funding.milestones[]` history (enrich-only); (c) leave NULL and force admin-set. Recommend (a) for V1 with a UI caveat tooltip; (b) is a future enhancement. **Decision needed.**

5. **Bulk edit on `industry` / `domain_tags`?** Industry is gated by category (per-row) so bulk edit is awkward — you'd need to filter to one category first, then bulk-set industry. Domain tags are arrays so semantics are unclear (replace? union? subtract?). Recommend: NO bulk edit on these in V1. Bulk edit only on category, manual_review_status. **Decision needed.**

6. **`unreviewed` companies in the recruiter ProfileTable filter.** Today, recruiter UI hides `focus='unreviewed'`. After rename to `category='unreviewed'`, do we still hide? The new V1 `unreviewed` includes auto-created reference-tier rows (which now ALSO get the free `/company/identify` call → tagger fires → most go to hardware/non_hardware). What stays at `unreviewed` after the identify+tagger pass is genuinely "tagger couldn't classify" — those probably DO belong hidden from recruiter UI. Recommend: keep recruiter hide-unreviewed default. **Decision needed.**

7. **Triage queue `/admin/companies/triage` — V1 or V2?** Investigation 3 includes it as a "potentially NEW route". Given the import UI's single-company workflow already lets admin review tagging during import, triage might be redundant in V1. Recommend: defer triage queue to V2 unless admin wants a separate "review backlog of low-confidence existing rows" view. **Decision needed.**

---

## Sign-off checklist

Before proceeding to investigations 1 and 2:
- [ ] Open issue #1: `company_type` normalization approach confirmed
- [ ] Open issue #2: `headcount_total` column added or deferred
- [ ] Open issue #3: Biotech ambiguity acknowledged; investigation 2 will test it
- [ ] Open issue #4: `funding_stage` raw-with-caveat vs derived vs NULL — decide
- [ ] Open issue #5: bulk-edit policy on industry/domain_tags
- [ ] Open issue #6: recruiter hide-unreviewed default
- [ ] Open issue #7: triage queue in V1 or deferred
- [ ] Controlled vocabulary lists (15/8 hardware, 11/16 non-hardware) re-confirmed
- [ ] CHECK constraint SQL approved as the V1 enforcement mechanism
- [ ] TS config at `lib/companies/taxonomy.ts` approved as UI source of truth
- [ ] Saved-filter URL alias approach approved
- [ ] Legacy column rename strategy (`legacy_*` prefix, no drops) approved
- [ ] Deprecate-eligible columns (`company_bucket`, `founding_date`) approved to keep through V1
