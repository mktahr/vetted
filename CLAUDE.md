# Vetted — Master Context for Claude Code

## What is Vetted?

Vetted is an elite recruiting intelligence platform — think of it as the top 10% of LinkedIn profiles, structured, scored, and ranked using a **deterministic, rules-based system** (not AI inference). It helps recruiting teams find high-signal candidates without relying on fuzzy AI guessing.

The core insight: instead of asking AI to judge a candidate, we build our own dictionary and scoring system so the rules are explicit, auditable, and consistent.

---

## Current Tech Stack

| Layer | Tool |
|---|---|
| Frontend / Hosting | Vercel (vetted-self.vercel.app) |
| Database | Supabase (Postgres) |
| Scraping | Chrome Extension (TypeScript) |
| Bulk import | Crust Data `/person/search` v2 + filter-builder admin UI at `/admin/import` |
| Language | TypeScript / Next.js 14 (App Router) |

---

## What Already Exists (DO NOT BREAK)

### Live Supabase Tables — PRESERVE THESE
- `profiles` — legacy display layer, still written to by the ingest pipeline
- `profile_snapshots` — raw scrape storage (append-only)

### Live Supabase Function — PRESERVE THIS
- `upsert_profile_from_snapshot` — the legacy write path called from the ingest route

### Chrome Extension (separate repo)
- Located at: **`/Users/matt/Desktop/DEV/vetted-extension/`** (not inside this repo)
- Scrapes LinkedIn profile pages one at a time
- Sends payload to: `https://vetted-self.vercel.app/api/ingest`
- Auth: `x-ingest-secret` header
- Key files: `src/content.ts` (scraper), `src/background.ts` (API sender), `src/types.ts`

### Vercel API
- `/api/ingest` — receives scrape payload, writes to both legacy and normalized tables, runs scoring

---

## Architecture (What We've Built)

### Data Flow
```
Chrome Extension scrape       Crust Data bulk search
           │                           │
           ▼                           ▼
  POST /api/ingest          POST /api/admin/import (streams progress)
           │                           │
           └────────┬──────────────────┘
                    ▼
      Crust mapper → canonical payload
                    ▼
  profile_snapshots.raw_json (legacy, keep)
                    ▼
  upsert: people + companies + person_experiences + person_education
                    ▼
  compute derived fields (career_progression, highest_seniority,
                          early_stage, hypergrowth)
                    ▼
  score_candidate() → writes candidate_bucket_assignments
```

### Core Domains
1. **Companies** — normalized, with quality scores by year (0–5) and optional function (0–3)
2. **People** — normalized, linked from profiles via `legacy_profile_id`
3. **Experiences** — structured work history, one row per role
4. **Education** — structured education with school scores (0–4)
5. **Dictionaries** — title / function / specialty / seniority / degree / field-of-study / employment-type normalization
6. **Seniority rules** — standalone title→seniority engine (see below)
7. **Scoring + Bucketing** — deterministic per-stage weights, writes to `candidate_bucket_assignments`
8. **Review / Confidence** — `candidate_review_flags` (manual review), `candidate_decision_state` (active/hold/excluded)

---

## THE MOST IMPORTANT DESIGN RULES

### Rule 1: Three Separate Layers — NEVER Collapse These
```
candidate_bucket        ← quality tier (Vetted Talent / High Potential / Silver Medalist / Non-Vetted / Needs Review)
review_flags            ← manual review needs (separate from bucket)
decision_state          ← exclusion/hold/active (separate from bucket)
```
A candidate can be "Vetted talent" AND "needs manual review" at the same time. These are independent dimensions.

### Rule 2: Scoring is NOT One Number
Four separate outputs:
1. Base quality / signal strength
2. Search relevance (query-dependent)
3. Review flags / confidence adjustments
4. Candidate bucket assignment

### Rule 3: Deterministic > AI
- Build dictionaries for title normalization, function mapping, seniority, degree types
- Do NOT use LLM to infer scores
- Rules must be explicit and auditable

### Rule 4: Time-Aware Company Quality
- A company's score in 2018 may differ from 2024
- `company_year_scores` and `company_function_scores` handle this
- Role recency matters heavily in search ranking

### Rule 5: Migration is Additive First
- Never drop or alter `profiles`, `profile_snapshots`, or `upsert_profile_from_snapshot`
- All new tables are additions
- Link back to existing tables where needed

---

## Company Focus Field

Added in migration 016. Every company has a `focus` column (enum `company_focus_type`) with three values:

| Value | Meaning |
|---|---|
| `hard_tech` | Hardware, deep tech, aerospace, defense, robotics, autonomy — the hard-tech product focus |
| `all_tech` | **Default.** The full searchable universe — includes `hard_tech` companies plus SaaS/FinTech/etc. Recruiter default view. |
| `unreviewed` | Auto-created via ingest, not yet triaged by admin. Appears in admin triage queue only. |

**Scoping semantics** — important for filter queries:

- A filter for `hard_tech` matches **only** `focus = 'hard_tech'`.
- A filter for `all_tech` matches `focus IN ('hard_tech', 'all_tech')` — hard_tech companies ARE part of the all_tech universe.
- `unreviewed` is explicitly excluded from both default views; recruiter searches never surface unreviewed companies.

**Write path** — all promotion to `hard_tech` is manual via the admin UI. Ingest auto-creates new companies with `focus = 'unreviewed'`. Backfill on migration 016 set the focus to `unreviewed` for any pre-existing company that had never been triaged (manual_review_status = 'unreviewed' AND no bucket AND no industry).

---

## Role Dictionary + Specialty Taxonomy (Post-Migration 017)

### Role Dictionary
`role_dictionary` — 26 roles that group specialties into recruiter-friendly categories. Roles are the primary search filter; selecting a role expands to all mapped specialties via `role_specialty_map`.

Roles (in display_order): Software Engineer, Embedded/Firmware Engineer, Hardware Engineer, Electrical Engineer, Mechanical Engineer, RF/Wireless Engineer, FPGA/ASIC/Chip Engineer, Aerospace Engineer, Systems Engineer, Controls Engineer, Robotics Engineer, Manufacturing/Production Engineer, Test/Reliability/Quality Engineer, Optics/Photonics Engineer, Materials Engineer, Mechatronics Engineer, Engineering Leadership, Product Manager, Designer, Operator, Sales/GTM, Marketing/Growth, Recruiter/Talent, Finance, Legal, Founder.

### Specialty Dictionary
~215 specialties across all roles. Migration 017 added ~165 new specialties covering deep-tech disciplines (avionics sub-specialties, chip design, manufacturing, test engineering, robotics perception, etc.) plus non-engineering functions (finance, legal, founder). All use `ON CONFLICT DO NOTHING` to preserve existing entries.

### Role-Specialty Mapping
`role_specialty_map` — join table with `is_primary` flag. Most specialties map to exactly one role. Cross-role specialties (e.g., `flight_software` primary to Software Engineer, secondary to Aerospace Engineer) have two rows with `is_primary = true/false`.

### Search UI (Post-Migration 017)
Two-column layout: persistent left sidebar (300px, collapsible) + results main area.

Sidebar filter groups:
- **Search Scope**: company focus (all/hard_tech/all_tech)
- **Who They Are**: Role (primary), Specialty (contextually filtered by role), Seniority, Bucket, Stage, Years, Clearance, Location (US states + cities from static list)
- **Where They Worked**: compound filter (company + relationship + specialty + year range)
- **Where They Studied**: ranked schools only (school_score IS NOT NULL), US/All toggle
- **Keyword Search**: Boolean title search + experience/skills keyword search (AND, OR, NOT, quoted phrases)

Active filter chips appear above results. Full-page search builder at `/search-builder` provides a wider grid layout of the same filters.

Function is no longer a recruiter-facing filter — it stays internal for scoring only.

### Boolean Search
Client-side implementation. Simple AND/OR/NOT parser with quoted phrase support. Title Boolean matches against `person_experiences.title_raw` (any past) or `people.current_title_raw` (current only). Experience Boolean matches against `description_raw`, `headline_raw`, `summary_raw`, `narrative_summary`.

TODO: Move to server-side API when people count exceeds ~500.

### Location Typeahead
Static list at `lib/locations/us-locations.ts` — all 50 US states + DC + top 50 cities. Matches as ILIKE substring against `people.location_name`.

---

## Clearance Field on People (Post-Migration 016)

`people.clearance_level` (enum `clearance_level_type`): `unknown`, `none`, `confidential`, `secret`, `top_secret`, `ts_sci`, `q_clearance`, `other`. Default `unknown`; always manually edited (never inferred from resume text). `people.clearance_notes` is an optional free-text field.

Surfaces in the candidate search table as a multi-select filter (useful for defense/aerospace roles) and on the profile detail page as an editable admin section.

---

## Function-Level Company Scoring (company_function_scores)

`function_dictionary` (18 functions) classifies **people** — it's the full set a candidate's role can normalize to.

`company_function_scores` is a separate, narrower dimension: it scores **companies** on non-engineering functions where exceptional quality differentiates them. Migration 016 added a CHECK constraint restricting `function_normalized` to **three values**: `design`, `operations`, `sales`.

**Why engineering isn't scored as a function.** The overall `company_year_scores.company_score` already encodes engineering quality — the baseline for company tiering. Adding a redundant "engineering function score" would double-count. If a company excels at engineering beyond what the overall score captures, the overall score itself should move up.

The table is empty today (as of the 016 migration); rows will be populated manually via the admin UI over time. The scoring engine's `company_function_quality` bonus component reads from this table and falls back to the overall `company_year_scores.company_score` when no function-specific row exists.

---

## Profiles Table — Deprecated Writes

As of 2026-04-24, the ingest route **no longer writes to the legacy `profiles` table** or calls `upsert_profile_from_snapshot()`. Zero application code reads from `profiles`. The RPC function remains defined in the DB as a read-only archive and can be dropped in a future cleanup. All ingest traffic goes directly to the normalized tables (`people` + `person_experiences` + `person_education` + `candidate_bucket_assignments`).

---

## Candidate Bucket Taxonomy

| Bucket | Meaning |
|---|---|
| `vetted_talent` | Clearly crosses the high-signal bar — top tier |
| `high_potential` | Strong signals but earlier in career, or not yet fully proven |
| `silver_medalist` | Strong, credible candidate — doesn't make the top tier but clearly above the "good enough" baseline (e.g., past finalists, near-misses) |
| `non_vetted` | Capable, but doesn't cross the Vetted bar |
| `needs_review` | Default state before the scoring engine has classified them, OR scoring failed / data was insufficient. A person in any other bucket has been deterministically scored |

DO NOT add "rejected" or "excluded" to this taxonomy. That lives in `candidate_decision_state`.

**Note on `needs_review`:** this bucket value means "not yet classified by the scorer" — it is distinct from the `candidate_review_flags` table, which tracks manual-review signals (credential ambiguity, contractor ambiguity, etc.) on already-classified candidates. Per Rule 1, the two dimensions remain independent: a `vetted_talent` candidate can still have open review flags.

### Display labels (UI)

When rendering buckets in the UI (tables, chips, detail pages), use these title-cased labels. The database always stores the snake_case enum value.

| Enum value | UI label |
|---|---|
| `vetted_talent` | Vetted Talent |
| `high_potential` | High Potential |
| `silver_medalist` | Silver Medalist |
| `non_vetted` | Non-Vetted |
| `needs_review` | Needs Review |

---

## Career Stages (canonical — used by the scoring engine)

| Stage | Range | Description |
|---|---|---|
| `pre_career` | 0–0.49 yrs | Students, no full-time roles yet |
| `early_career` | 0.5–1.99 yrs | Early-career operators |
| `mid_career` | 2–4.99 yrs | Mid-career operators |
| `senior_career` | 5+ yrs | Senior operators |

Scoring weights differ sharply by stage — see "Scoring Spec" below.

**Note:** as of migration 016, `career_stage_config` in the DB matches these boundaries (0.5 / 2 / 5). The `inferCareerStage()` function in `app/api/ingest/route.ts` and the scoring engine (`lib/scoring/score-candidate.ts::determineStage()`) also use these same boundaries. All three agree.

### Years-of-experience calculation

`years_experience_estimate` = span from the earliest **post-graduation, non-internship, non-student** role start to now. See `lib/ingest/mappers/crust.ts::computeYearsSpan()` and the backfill script for the implementation. Specifically:

- Skip any experience whose title matches `intern | internship | co-?op`
- Skip any experience whose `seniority_normalized = 'student'`
- Skip any experience whose `start_date` is before the person's **earliest post-secondary** graduation end_year (high-school / certificate / coursework entries are excluded from the graduation anchor — see `graduationDateFromEducation()`)

We do NOT use Crust's `years_of_experience_raw` because it includes pre-graduation student work.

---

## Seniority System

### Enum (9 active values + 2 deprecated)
`unknown`(0) < `intern`(1) < `entry`(2) < `individual_contributor`(3) < `senior_ic`(4) < `lead_ic`(5) < `founder`(6) < `manager`(7) < `executive`(8)

Deprecated aliases kept in the enum for backward compat: `student`(=intern), `lead`(=lead_ic).

Stored in `seniority_dictionary` with `rank_order` 0–8.

| Level | Meaning | Examples |
|---|---|---|
| `intern` | Internship, co-op, student worker | SWE Intern, Research Intern |
| `entry` | Junior, associate, new grad | Associate Engineer, SDE I, Junior PM |
| `individual_contributor` | Mid-level IC | Software Engineer, SDE II, Product Manager |
| `senior_ic` | Senior IC | Senior Software Engineer, SDE III, Senior PM |
| `lead_ic` | Staff, principal, architect, tech lead | Staff Engineer, Principal PM, TLM |
| `founder` | Company founder/co-founder | Founder, Co-Founder (without CxO qualifier) |
| `manager` | People manager, director | Engineering Manager, Director of Product |
| `executive` | VP, C-suite, Head-of | VP Engineering, CTO, Founder & CEO |

### `seniority_rules` table

Comprehensive title→seniority dictionary with 400+ patterns covering engineering, product management, product design, operations, and recruiting. All matching is **case-insensitive exact** (no fuzzy/contains/regex).

Columns: `title_pattern`, `seniority_level`, `function_hint`, `priority`, `active`.

Priority 0 = founder+CxO combos that override bare-founder rules. Priority 1 = main dictionary. Priority 2 = short ambiguous patterns (e.g. `pm`, `em`, `tl`). Priority 3 = very generic patterns (`engineer`, `developer`, `designer`).

Includes company-specific ladder mappings: Amazon SDE I/II/III, Google L3–L8, Meta E3–E8. Also covers McKinsey/Bain consulting ladders (analyst→associate→engagement manager→principal→partner).

### Override logic (in `resolveSeniority`)

Before scanning rules:
1. If `employment_type` normalizes to `internship` (or raw text matches `/intern|co-?op/`) → `intern`
2. If `role_start_date < earliest post-secondary graduation date` → `intern`

Then exact case-insensitive title lookup against the rule map; first match (lowest priority) wins. If no rule matches and the title is non-empty → `individual_contributor`. Empty title → `unknown`.

---

## Score Scales

| Signal | Scale | Where stored |
|---|---|---|
| Company quality (overall) | 0–5 (0 = unknown, 1 = weak → 5 = elite) | `company_year_scores.company_score` |
| Company quality (by function) | 0–3 (0 = n/a, 1 = okay → 3 = exceptional) | `company_function_scores.function_score` |
| School quality | 0–4 (0 = unknown, 1 = low tier → 4 = top tier) | `schools.school_score` |
| Everything else (fellowships, labs, clubs, investors, etc.) | 0–3 | per-table tier columns |

---

## Scoring Spec (Phase 2)

The engine lives at [lib/scoring/score-candidate.ts](lib/scoring/score-candidate.ts). Summary:

### Structure

Each career stage has three buckets of signals:

- **CORE** — always evaluated, sum to ~100 points. Missing data → 0 for that component.
- **BONUS** — only adds points if the underlying data exists. Stacks on top of core, not capped at 100.
- **PENALTY** — only in mid/senior; scales with how far the candidate's average tenure is below the threshold.

### Weights by stage

**Pre-career (0–0.49 yrs)**
- Core: education 30, degree_relevance 30, internships 40
- Bonus: hackathons 10, clubs 10, labs 10, publications 10, open_source 10, fellowships 25

**Early career (0.5–1.99 yrs)**
- Core: company_quality_recent 40, education 25, degree_relevance 25, internships 10
- Bonus: company_function_quality 10, hackathons 10, publications 10, open_source 10, labs 5, fellowships 25, biz_unit 25

**Mid career (2–4.99 yrs)**
- Core: company_quality_recent 60, company_quality_average 10, education 15, degree_relevance 15
- Bonus: career_slope 15, fellowships 10, company_function_quality 10, publications 10, open_source 5, biz_unit 25
- Penalty: if average tenure < 12 mo, deduct up to 20 pts (linear, 20 pts at 0 mo → 0 at 12 mo)

**Senior career (5+ yrs)**
- Core: company_quality_recent 60, company_quality_average 30, education 5, degree_relevance 5
- Bonus: career_slope 10, company_function_quality 10, publications 10, open_source 5, biz_unit 25
- Penalty: if average tenure < 18 mo, deduct up to 30 pts (linear, 30 pts at 0 mo → 0 at 18 mo)

### Signal definitions

- **company_quality_recent** — avg `company_year_scores.company_score` over the years worked at the most recent full-time role. Not in scored set → 0. Normalized /5.
- **company_quality_average** — same avg across *all* full-time roles. Not in scored set → treated as 0 per rubric. Normalized /5.
- **education** — max `schools.school_score` across the candidate's education entries, with lookups going `schools.school_name` → `school_aliases.alias_name` → no match → 0. Whitespace and trailing `.`/`,` stripped before matching. Normalized /4.
- **degree_relevance** — dictionary lookup by function (see below). Normalized /1.
- **internships** — avg `company_year_scores.company_score` across all internship experiences. Quality-based, *not* count-based. Normalized /5.
- **career_slope** (BONUS only) — if `people.career_progression = 'rising'`, full bonus points. `flat`/`declining`/`insufficient_data`/null → 0. **Never subtracts.**
- All other bonus signals (hackathons, clubs, labs, publications, open_source, fellowships, biz_unit, company_function_quality) — not yet sourced; they're declared with weights but contribute 0 until data arrives.

### Degree relevance dictionary (by function)

When `current_function_normalized` is unknown, default to **software_engineering** rules.

| Function | 100% | 75% | 50% | 25% | 0% |
|---|---|---|---|---|---|
| software_engineering | CS, Computer/Electrical Eng, Software Eng, EECS | EE, Math, Applied Math, Statistics, Physics | ME, Info Systems, Cognitive Science | Any other STEM | Non-STEM |
| hardware / electrical_engineering | EE, Computer Eng, Electrical & Computer Eng | ME, Physics, Materials Science, Aerospace | CS, Applied Math | Any other STEM | Non-STEM |
| mechanical / robotics | ME, Robotics, Aerospace, Systems Eng | EE, Physics, Materials Science | CS, Applied Math | Any other STEM | Non-STEM |
| product | CS, any Engineering, Econ, HCI, **MBA (any school, regardless of other degrees)** | Business, Math, Cognitive Science, Psychology | Any other STEM | — | Non-STEM without MBA → 10% |
| design | Product/Industrial/Interaction/Graphic/UX Design, HCI, Fine Arts, Architecture | Cognitive Science, Psychology, CS, Engineering | — | Any other field | Clearly unrelated |
| operations | Business Admin, Econ, MBA, Ops Research, Industrial Eng, Finance, Math, Stats, CS | — | Any other STEM | Any non-STEM | — |
| sales / marketing | Business, Econ, Marketing, Communications, CS, any Engineering | — | — | Any other degree | — |
| recruiting | Any degree | — | — | — | — |

### Recruiting function override

When `current_function_normalized = 'recruiting'`, all stage weights are replaced (regardless of career stage):

- company_quality_recent: **70**
- education: **5**
- degree_relevance: **5**
- career_slope (bonus): **20**

Total max = 100 core + 20 bonus.

### Executive override

When `highest_seniority_reached = 'executive'` AND the recruiting override does **not** apply, all stage weights are replaced. Education is deprioritized; company quality and role scope dominate.

- company_quality_recent: **55**
- company_quality_average: **30**
- role_scope: **10**
- degree_relevance: **3**
- education: **2**
- career_slope (bonus): **10**
- biz_unit (bonus): **25**
- publications (bonus): **10**

Total max = 100 core + 45 bonus.

**Override priority:** `recruiting > executive > stage-default`. A head-of-talent with executive seniority is still scored as a recruiter.

**`role_scope` component** — executive-only core signal read directly from `highest_seniority_reached`:
- `executive` → 1.0
- `manager` → 0.7
- `lead` → 0.5
- `individual_contributor` → 0.3
- anything else → 0

### Bucket assignment thresholds

| Stage | vetted_talent | high_potential | silver_medalist | non_vetted |
|---|---|---|---|---|
| pre_career | ≥ 60 | 45–59 | — | < 45 |
| early_career | ≥ 65 | 50–64 | — | < 50 |
| mid_career | ≥ 65 | — | 50–64 | < 50 |
| senior_career | ≥ 70 | — | 55–69 | < 55 |

- `high_potential` applies only to pre/early career.
- `silver_medalist` applies only to mid/senior career.
- `needs_review` is the default state for anyone not yet scored.

Final bucket is written to `candidate_bucket_assignments` with the full score breakdown in `assignment_reason`.

---

## Derived Signals on `people`

Populated by `computeAndWriteDerivedFields()` in [lib/scoring/compute-derived.ts](lib/scoring/compute-derived.ts) — called inline during ingest, before scoring. A batch backfill exists at `scripts/compute-derived-fields.mjs` for historical data.

All are **searchable filter tags** — never direct inputs to the score, except `career_progression` which gates the `career_slope` bonus.

| Column | Type | Meaning |
|---|---|---|
| `career_progression` | text | Trajectory of the last 2-3 scored full-time roles. With ≥3 scored roles, compares newest to mean of the prior two; with exactly 2, compares newest to previous. Threshold ±0.3 on the 0–5 company-score scale. Values: `'rising'` (diff > 0.3), `'flat'` (|diff| ≤ 0.3), `'declining'` (diff < -0.3), `'insufficient_data'` (fewer than 2 scored FT roles). Only `'rising'` triggers the career_slope bonus. |
| `highest_seniority_reached` | `seniority_level` enum | Max `seniority_normalized` across all experiences, by `seniority_dictionary.rank_order`. |
| `title_level_slope` | text | Trajectory of `title_level` (1–10) across the last 2–3 leveled full-time roles. Same algorithm as `career_progression` but reading the numeric title level (±0.5 threshold on integer scale). Values: `'rising'`, `'flat'`, `'declining'`, `'insufficient_data'`. Distinct from `career_progression` (company-tier) — these are independent dimensions. |
| `has_early_stage_experience` | boolean | TRUE if any experience started within 4 years of the company's `founding_year`. |
| `early_stage_companies_count` | smallint | How many such companies. |
| `has_hypergrowth_experience` | boolean | TRUE if any experience overlapped a year where `company_metrics_by_year.headcount_estimate` ≥ 2× the prior year. |
| `hypergrowth_companies_count` | smallint | How many such companies. |

---

## Build Phases

### Phase 1 — Normalized Foundation ✅ DONE
Tables: companies, people, person_experiences, person_education, schools (+ school_aliases), dictionaries (title/function/specialty/degree/field-of-study/employment-type/seniority_dictionary/seniority_rules), candidate_bucket_assignments, candidate_review_flags, candidate_decision_state.

### Phase 2 — Scoring + Bucketing Logic ✅ DONE
Deterministic scoring function, bucket assignment, derived-signal computation, inline scoring on ingest. Backfill scripts available.

### Phase 3 — Search Layer 🟡 PARTIAL
Main table at `/` supports search + faceted filters (bucket, stage, function, seniority). No dedicated `/search` page yet. Query-relevant ranking not implemented.

### Phase 4 — Advanced Signals 🔴 NOT STARTED
Publications, open source, founder scoring, investor signals, hackathons/labs/clubs/fellowships/biz_unit/company_function_quality. Scoring engine has the weights wired up but the source tables are empty.

---

## Database: Final Schema State (after migrations 001–030)

**Migration ledger** (full per-migration descriptions live in `supabase/migrations/*.sql` headers):
- 001 — Phase 1 normalized schema + enums
- 002 — dictionary seeds (functions, specialties, titles, degrees, employment types)
- 003 — bucket taxonomy + school_score + is_foreign
- 004 — school_aliases + people derived columns + companies.founding_year
- 005 — 6-value seniority enum + seniority_rules table (later expanded to 9 active in 006)
- 006–015 — incremental signal/specialty/seniority/title-level work (see migration headers)
- 016 — `company_focus_type` enum + `companies.focus` + clearance_level on people
- 017 — role_dictionary (26) + role_specialty_map + ~165 new specialties
- 018 — RLS policies on role tables
- 019 — `companies.funding_stage` + `companies.headcount_range` (text columns, currently un-used)
- 020–021 — specialty signal columns + 130k-row signal seeds
- 022–025 — signals_schema, signal_dictionary tier/group/competition + seeds
- 026 — education text fields on `person_education`
- 027 — school_groups + company_groups + 14 top law firms
- 028 — `raw_ingest_events` archive (see "Raw Ingest Archive" section)
- 029 — `crust_import_log` audit table (see "Crust Import Audit Log" section)
- 030 — `person_experiences.is_primary_current` + partial index (see "Primary-Current Disambiguation" section)

The "Normalized tables" / "Dictionary tables" lists below describe the post-migration state. They name the most-used columns; consult the actual schema for exhaustive column lists.

### Enums
- `seniority_level` (6): `unknown`, `student`, `individual_contributor`, `lead`, `manager`, `executive`
- `candidate_bucket_type` (5): `vetted_talent`, `high_potential`, `silver_medalist`, `non_vetted`, `needs_review`
- `degree_level_type`: high_school, associate, bachelor, master, mba, phd, jd, md, certificate, coursework, other
- `employment_type_norm`: full_time, contract, part_time, internship, freelance, advisory, board, unknown
- `career_stage_type`: pre_career, early_career, mid_career, senior_career
- `company_bucket_type`: static_mature, high_bar_tech, growth_startup, emerging_startup
- `company_status_type`: active, acquired, public, shut_down
- `review_flag_status_type` / `review_flag_severity_type` / `decision_state_type`

### Normalized tables
- **`people`** — person_id PK, full_name, linkedin_url UNIQUE, location_name, headline_raw, summary_raw, current_company_id, current_title_raw, current_title_normalized, current_function_normalized, years_experience_estimate, career_stage_assigned, career_stage_override, legacy_profile_id, **career_progression, highest_seniority_reached, has_early_stage_experience, early_stage_companies_count, has_hypergrowth_experience, hypergrowth_companies_count** (derived fields)
- **`person_experiences`** — company_id FK, title_raw, title_normalized, function_normalized, specialty_normalized, seniority_normalized, employment_type_normalized, start_date, end_date, is_current, duration_months, description_raw, is_founder_role, is_full_time_role
- **`person_education`** — school_id FK, school_name_raw, degree_raw, degree_normalized, degree_level, field_of_study_raw, field_of_study_normalized, start_year, end_year
- **`companies`** — company_name, primary_industry_tag, company_bucket, company_score_mode, current_status, hq_location_name, linkedin_url, website_url, **founding_year**
- **`company_year_scores`** — (company_id, year) PK, company_score 1–5
- **`company_function_scores`** — (company_id, function_normalized, year) PK, function_score 0–3
- **`company_metrics_by_year`** — headcount_estimate, funding_that_year, funding_total_to_date (empty at time of writing)
- **`schools`** — school_name UNIQUE, school_type, location_name, country, **school_score (0–4), is_foreign**
- **`school_aliases`** — alias_name PK, school_id FK
- **`candidate_bucket_assignments`** — person_id, candidate_bucket, assigned_by, assignment_reason, effective_at (latest per person = current state)
- **`candidate_review_flags`** — flag_type, flag_status, flag_severity
- **`candidate_decision_state`** — decision_state (active/hold/excluded), effective_at

### Dictionary tables (seeded)
- `function_dictionary` — 18 rows (engineering, product, design, data_science, sales, marketing, operations, finance, legal, recruiting, people_hr, customer_success, research, communications, founder, investing, consulting, unknown)
- `specialty_dictionary` — 25 rows, partitioned by parent_function (backend, frontend, fullstack, mobile_ios, mobile_android, infrastructure, ml_engineering, data_engineering, security, embedded, ai_research, analytics, product_b2b, product_consumer, product_platform, product_growth, ux_design, product_design, brand_design, enterprise_sales, smb_sales, sales_engineering, partnerships, growth_marketing, content_marketing, brand_marketing)
- `title_dictionary` — ~175 patterns, populated by migration 002 + `scripts/seed-recruiting-titles.mjs` (16 recruiting titles). **Stores title_normalized + function_normalized + specialty_normalized + confidence only — seniority comes from `seniority_rules`.**
- `employment_type_dictionary` — 20 patterns (full-time, contract, freelance, part-time, internship, board, advisory variants)
- `degree_dictionary` — 32 patterns (BS, BA, MS, MA, MBA, PhD, JD, MD, Certificate, Bootcamp, Coursework, etc.)
- `field_of_study_dictionary` — empty (declared in migration, no seeds yet)
- `seniority_dictionary` — 11 rows (9 active + 2 deprecated, with rank_order 0–8)
- `seniority_rules` — 400+ rows, exact case-insensitive matching (see Seniority System section above)
- `title_level_dictionary` — ~85 patterns mapping title substrings to numeric levels (1–10). Level scale: 1=intern, 2=junior, 3=mid-IC, 4=IC-II, 5=senior/IC-III, 6=staff/lead, 7=principal, 8=distinguished, 9=VP/director, 10=C-suite. Per-experience `title_level` stored on `person_experiences`; trajectory across roles → `people.title_level_slope`.
- `career_stage_config` — 4 rows (rougher boundaries than scoring engine uses)

---

## File Layout

```
/
├── CLAUDE.md                                    ← this file, always read first
├── docs/crust/                                  ← Crust API specs (source of truth for endpoint shapes / pricing)
│   ├── 01-company-search.md                     ← /company/search (filter-based)
│   ├── 02-company-identify.md                   ← /company/identify (entity resolution, FREE)
│   ├── 03-company-enrich.md                     ← /company/enrich (cached / IN-DB)
│   ├── 04-company-autocomplete.md               ← /company/search/autocomplete (FREE)
│   ├── 05-pricing-and-rate-limits.md            ← credit costs, rate limits, OPEN reconciliation Qs (CSV vs docs)
│   ├── 06-person-search.md                      ← /person/search (used by live import flow)
│   ├── 07-person-enrich.md                      ← /person/enrich (cached / IN-DB) + add-on cost model
│   ├── 08-person-autocomplete.md                ← /person/search/autocomplete (FREE)
│   └── 09-person-live-enrich.md                 ← /person/professional_network/enrich/live (5 credits, real-time scrape)
├── supabase/migrations/                         ← see "Database: Final Schema State" for full migration set 001–030
│
├── app/                                         ← Next.js 14 App Router
│   ├── page.tsx                                 ← "/" renders ProfileTable
│   ├── layout.tsx
│   ├── types.ts                                 ← Person, Experience, Education, Company, BucketAssignment, etc.
│   ├── components/
│   │   ├── ProfileTable.tsx                     ← main people table + faceted filters + search + bucket chips
│   │   ├── ProfileDrawer.tsx                    ← row-click side drawer with bucket + score reasoning
│   │   ├── FilterSidebar.tsx                    ← sidebar filter pane shared with /search-builder
│   │   ├── CompanyLogo.tsx                      ← logo.dev badge or initial-letter placeholder
│   │   └── condition-rows/                      ← compound where-they-worked / where-they-studied filter UI
│   ├── profile/[id]/page.tsx                    ← "/profile/[id]" detail page
│   ├── search-builder/page.tsx                  ← "/search-builder" — full-page filter UI sharing FilterSidebar
│   ├── admin/
│   │   ├── companies/
│   │   │   ├── page.tsx                         ← "/admin/companies" list + filters + sort + bulk-edit focus
│   │   │   ├── [id]/page.tsx                    ← edit company + per-year scores + per-function scores
│   │   │   └── new/page.tsx                     ← create company form
│   │   ├── import/                              ← "/admin/import" — Crust v2 filter-builder UI
│   │   │   ├── page.tsx                         ← sidebar filter builder + preview-then-confirm + NDJSON progress
│   │   │   └── components/
│   │   │       ├── AutocompleteSelect.tsx       ← server-side typeahead dropdown (calls /autocomplete)
│   │   │       ├── CompanyMultiSelect.tsx       ← chips with per-row scope (current/past/ever)
│   │   │       ├── RangeInput.tsx               ← min/max number-pair input
│   │   │       └── InfoTooltip.tsx              ← portal-rendered hover tooltip with collision detection
│   │   └── seed/page.tsx                        ← "/admin/seed" — 3 hardcoded test payloads for smoke tests
│   └── api/
│       ├── ingest/route.ts                      ← POST /api/ingest (Chrome ext + admin/import target; raw archive + upsert + score)
│       ├── people/[id]/{route.ts,narrative/route.ts}  ← person detail + AI narrative (Claude Haiku)
│       └── admin/
│           ├── crust-import/                    ← Crust v2 import endpoints
│           │   ├── preview/route.ts             ← POST /api/admin/crust-import/preview (sample + total_count, JSON)
│           │   ├── run/route.ts                 ← POST /api/admin/crust-import/run (streaming NDJSON full import)
│           │   └── autocomplete/route.ts        ← POST /api/admin/crust-import/autocomplete (free Crust autocomplete proxy)
│           └── rescore-all/route.ts             ← admin-only batch re-score endpoint
│
├── lib/
│   ├── supabase.ts                              ← browser Supabase client (anon key) + fetchAllRows() pagination helper
│   ├── normalize/                               ← title / degree / employment / seniority / specialty resolvers
│   ├── scoring/                                 ← scoreCandidate(), writeBucketAssignment(), computeAndWriteDerivedFields()
│   ├── tenure/                                  ← FT classification + company-stretch tenure (see "Tenure Helper" below)
│   ├── education/                               ← display-only education filter (see "Education Display Filter" below)
│   ├── signals/                                 ← processCandidateSignals() (publications, fellowships, etc. — empty data, weights wired)
│   ├── ai/
│   │   └── narrative.ts                         ← Claude Haiku 4.5 narrative summary (direct fetch, ANTHROPIC_API_KEY)
│   ├── crust/                                   ← Crust v2 API client + filter builder + audit log
│   │   ├── types.ts                             ← UIFilterState + AUTOCOMPLETE_FIELDS map + EMPTY/INITIAL_FILTERS + HARD_VOLUME_CAP
│   │   ├── api.ts                               ← v2 API client (fetchPersonSearch, fetchAutocomplete) + Bearer auth
│   │   ├── build-filter.ts                      ← UIFilterState → Crust filter body translator + summarizeFilters()
│   │   └── log.ts                               ← writeCrustLog() to crust_import_log (migration 029) + estimateCredits()
│   ├── locations/                               ← static US states + top-50 cities for location typeahead
│   └── ingest/
│       ├── index.ts                             ← barrel
│       ├── crust-person-search.ts               ← legacy v1-style typed wrapper (kept for v2 type-shape compatibility)
│       ├── crust-api.ts                         ← legacy /screener/persondb/search network layer + postIngest()
│       └── mappers/
│           ├── crust-v2.ts                      ← mapPersonSearchToCanonical() — LIVE path (v1.1.0; threads company_linkedin_url)
│           ├── crust.ts                         ← legacy — mapCrustToCanonical() for old /screener/persondb/search
│           └── generic.ts                       ← mapGenericToCanonical() — best-effort aliasing for unknown JSON
│
└── scripts/                                     ← one-shot + backfill scripts (all .mjs, run with node)
    ├── reseed-companies.mjs                     ← clears + re-seeds companies + company_year_scores from CSV
    ├── seed-*.mjs                               ← seed dictionaries / school aliases / founding years / recruiting titles / etc.
    ├── compute-derived-fields.mjs               ← batch version of computeAndWriteDerivedFields for all people
    ├── backfill-seniority.mjs                   ← re-evaluates seniority for every experience + recomputes years_experience_estimate + career_stage
    ├── backfill-company-linkedin-urls.mjs       ← mines raw_ingest_events to fill companies.linkedin_url where NULL (3.6% → 9.8% on prod)
    ├── score-all.mjs                            ← recompute derived fields + score every person; use --unscored-only to skip already-scored
    ├── score-test-profiles.mjs                  ← runs scorer against Priya/Marcus/Jennifer test profiles w/ breakdown
    └── verify-company-scores.mjs                ← read-only — print score distribution across companies
```

---

## Ingest Contract

**POST `/api/ingest`** — auth via `x-ingest-secret` header.

```ts
{
  linkedin_url: string,        // required, UNIQUE key for upserts
  full_name: string,           // required
  canonical_json: {
    full_name?, location_resolved?, current_company?, current_title?,
    years_experience?, years_at_current_company?,
    undergrad_university?, secondary_university?, phd_university?,
    skills_tags?: string[],
    experiences?: Array<{ company_name, title, start_date, end_date, is_current, duration_months, description, employment_type }>,
    education?: Array<{ school_name, degree, field_of_study, start_year, end_year }>,
  },
  raw_json?: Record<string, unknown>,  // optional — preserved to profile_snapshots
}
```

Returns `{ success, person_id, legacy_ok, bucket, total_score, message }`.

**Order of operations** (all in one handler, non-fatal on score failure):
1. Legacy RPC `upsert_profile_from_snapshot` (writes to `profiles` + `profile_snapshots`)
2. Upsert `companies` for current company
3. Normalize current title via `title_dictionary`
4. Upsert `people` (onConflict: linkedin_url)
5. Delete + re-insert `person_experiences` (each row: company upsert, title normalize, seniority resolve, employment_type normalize, date parse)
6. Delete + re-insert `person_education` (school upsert, degree normalize, field normalize)
7. Seniority override checks run per experience: `employment_type=internship` → `student`; `role start < earliest post-secondary graduation` → `student`; else seniority_rules scan
8. `computeAndWriteDerivedFields` → writes to `people`
9. `scoreCandidate` → writes to `candidate_bucket_assignments`
10. Insert initial `candidate_decision_state = active` if new person

---

## Admin Import — Crust Import V1 (Person Search v2)

Filter-builder UI at `/admin/import` for bulk ingesting candidates via Crust v2. Three routes back the page:
- `POST /api/admin/crust-import/autocomplete` — proxies Crust's free autocomplete, used by every typeahead picker in the sidebar
- `POST /api/admin/crust-import/preview` — non-streaming JSON sample + total_count
- `POST /api/admin/crust-import/run` — streaming NDJSON full import

Crust auth: `Authorization: Bearer <CRUSTDATA_API_KEY>` + `x-api-version: 2025-11-01`. Default rate limit: 15 req/min (429 on breach). Person-search cost: 0.03 credits per result. Autocomplete: free.

### Sidebar filter shape

State lives as a single `UIFilterState` object (`lib/crust/types.ts`). Five collapsible sections:

| Section | Filters |
|---|---|
| **Where they work** | `companies[]` (multi-select with per-row scope: current/past/ever), `years_at_current_min/max`, `headcount_ranges[]` (1-10, 11-50, … 10000+), `industries[]` |
| **Who they are** | `function_category` (single, **REQUIRED** — gate for preview/run), `skills[]`, `title` (free-text comma-list), `seniority_levels[]`, `years_experience_min/max` |
| **Where they are** | `geo_mode` (none / country / region / radius). Country mode: multi-select countries. Region: multi-select states/regions. Radius: single city + miles slider. **Initial page load** pre-selects `country` + both Crust US variants (`'United States of America'` and `'United States'`) — Crust indexes them separately, so multi-select `in` operator captures both populations. "Clear all" resets to truly empty (`EMPTY_FILTERS`). |
| **Education** (collapsed by default) | `schools[]`, `degrees[]`, `fields_of_study[]` |
| **Signals** (collapsed by default) | `recently_changed_jobs` boolean |

`HARD_VOLUME_CAP = 5000`, `SOFT_VOLUME_WARNING = 1000` (UI shows a "large import" caution chip).

### Filter translation: `lib/crust/build-filter.ts`

`UIFilterState` → Crust filter body. Leaf: `{ field, type, value }`. Composite: `{ op: 'and', conditions: [...] }`. Operators include `=`, `!=`, `<`, `=<`, `>`, `=>`, `in`, `not_in`, `contains`, `(.)`, `geo_distance` (Crust uses `=<` for ≤ and `=>` for ≥, **not** `<=` / `>=`).

**Field-path quirks:** the filter API and the autocomplete API have OVERLAPPING but NOT IDENTICAL valid-field allowlists. `lib/crust/build-filter.ts` uses qualified paths (e.g. `basic_profile.location.country`); `lib/crust/types.ts::AUTOCOMPLETE_FIELDS` uses the autocomplete-side allowlist (top-level shorthand like `country`, `region`, `function_category`). **Don't unify them** — Crust will reject otherwise-valid fields when applied to the wrong API. Re-verify against api.crustdata.com on changes.

### Preview workflow (`/preview` route)

`{ filters, limit?: number, cursor?: string }` →  
1. Validates `function_category` set; else 400.
2. Builds Crust filter body via `buildCrustFilter(ui)`.
3. Pulls all existing `people.linkedin_url` via `fetchAllRows()` and passes as `post_processing.exclude_profiles` so Crust skips already-ingested profiles server-side.
4. Calls `POST /person/search` with `limit` (default 50, cap 100).
5. Response: `{ total_count, sample_count, profiles[], excluded_count, next_cursor }`. The "Load 50 more (free per Crust pricing)" button paginates via cursor, capping the local sample at 100.
6. Writes a row to `crust_import_log` (request_kind=`preview`).

### Run workflow (`/run` route)

`{ filters, volume }` → streaming NDJSON.
1. Same dedup/exclude_profiles pass.
2. Paginates `/person/search` at 100/page until either `volume` ingested or cursor exhausted.
3. Each record → `mapPersonSearchToCanonical` (`lib/ingest/mappers/crust-v2.ts`) → `postIngest()` → `/api/ingest`.
4. Emits NDJSON events: `start` (with `estimated_total` + `excluded_count`), `progress` (per profile, with status: success/skipped/failed), `info`, `error`, `complete` (with success/skipped/failed counts).
5. Writes `crust_import_log` row at completion.

### Mapper notes (`lib/ingest/mappers/crust-v2.ts` — version 1.1.0)

- `linkedin_url` ← `social_handles.professional_network_identifier.profile_url`
- `full_name` ← `basic_profile.name`
- `location_resolved` ← `basic_profile.location.raw` (structured fields are unreliable — observed "Emilia-Romagna, Italy" for someone in "Greater Seattle Area")
- **Current role disambiguation**: prefer `is_default=true` (Crust's flag) → first `current[]` entry as fallback. Threaded through to `person_experiences.is_primary_current` (migration 030).
- `experiences[]` = `employment_details.current[]` (`is_current=true`) + `.past[]` (`is_current=false`). Per-experience dedup by `(company|title|start|end)` lower-cased key.
- `education[]` ← `education.schools[]` with `{ school, degree, start_year, end_year }` — note `school` not `school_name`, and years are direct integers, not parsed from ISO.
- **`company_linkedin_url`** is now captured from `experience.employment_details.{current,past}[].company_professional_network_profile_url` and threaded to ingest's `upsertCompany` (see "Company Metadata Capture" section below).
- `current_company_linkedin_url` populated from primary current employer.
- Dates: strip ISO time (`"2022-05-01T00:00:00"` → `"2022-05-01"`).
- `years_experience` = post-graduation, non-internship span. Crust's `years_of_experience_raw` is NOT used (counts pre-graduation student jobs).

### Filter-only fields

`seniority_level` and `function_category` are filter-only on Crust — they are NOT returned in responses. Preview table shows `—` for Seniority and Function. Mitigation post-merge: `is_primary_current` (Crust's `is_default`) wins when picking the candidate's primary current role even with multiple `is_current=true` entries.

### Legacy old-API integration

`lib/ingest/mappers/crust.ts` and `lib/ingest/crust-api.ts` still exist for the legacy `/screener/persondb/search` endpoint. Not used by the live flow. Kept for reference only.

---

## Company Metadata Capture on Ingest (post-`company-mapper-enrich-minimal`, 2026-04-30)

When a candidate is ingested via Crust v2, the mapper now captures the company's canonical LinkedIn URL from the embedded `experience.employment_details.{current,past}[].company_professional_network_profile_url` field. This populates `companies.linkedin_url` on every auto-created stub.

### `upsertCompany` behavior (`app/api/ingest/route.ts`)

Real upsert pattern, not lookup-then-stub:

1. **linkedin_url exact match** (canonical identity, when URL provided)
2. **company_name ILIKE fallback** (legacy, case-insensitive)
3. **INSERT new stub** if neither matches

On a name-match hit where the existing row has `linkedin_url IS NULL` and the ingest brings a URL, an **atomic update fills the column** (`.is('linkedin_url', null)` guard makes it race-safe). Admin-curated values (non-null) are NEVER overwritten.

Concurrent-insert race on the `linkedin_url UNIQUE` constraint is handled by re-resolving via URL or name on 23505 error. (Race on the name-match path without a LinkedIn URL is still possible — see backlog.)

**Tier-tagging unchanged:** auto-created rows still land as `focus='unreviewed' / manual_review_status='unreviewed'`. Admin triage workflow is not affected.

### What's captured vs not

The Crust v2 person-endpoint sub-object embeds ONLY: `name`, `title`, `start_date`, `end_date`, `employment_type`, `is_default`, `crustdata_company_id`, `professional_network_id` (LinkedIn numeric ID), `company_professional_network_profile_url`, and `company_profile_picture_permalink`.

It does NOT embed: website_url, primary_industry_tag, founding_year, headcount_range, description, funding info. Those live on the separate Crust company-side endpoints (`/company/search`, `/company/identify`, `/company/enrich`) — not used at ingest time. See `docs/crust/` for the full company-API specs.

The `crustdata_company_id` and `professional_network_id` (LinkedIn numeric ID) are returned by Crust but are **not yet captured** because no schema columns exist for them. Will be added when company-enrichment work scopes the right columns.

### Backfill: `scripts/backfill-company-linkedin-urls.mjs`

Mines `raw_ingest_events.payload` (Crust v2 source, `processing_status='mapped'`) to extract company LinkedIn URLs and atomically fills `companies.linkedin_url` where NULL. Default dry-run with anomaly report (multi-URL conflicts per company name, malformed URLs); `--apply` to commit.

Production run on 2026-04-30 lifted fill from **3.6% → 9.8%** (95 rows backfilled, 0 anomalies). Limit: only Crust v2 ingests after migration 028 are recoverable via this path; older companies fill progressively as new candidates land at them.

### Mapper version

`lib/ingest/mappers/crust-v2.ts` bumped 1.0.0 → 1.1.0. Version is recorded as `people.last_mapper_version` so future re-mappings can target a specific output shape.

---

## Environment Variables

Required in `.env.local` and on Vercel:

| Key | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend + all scripts |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend (Supabase client) |
| `SUPABASE_SERVICE_ROLE_KEY` | `/api/ingest` + all backfill scripts (writes that bypass RLS) |
| `INGEST_SECRET` | `/api/ingest` auth + `/api/admin/import` forwarding |
| `CRUSTDATA_API_KEY` | `/api/admin/import` + `/api/admin/import/preview` (Person Search v2, Bearer auth) |
| `CRUST_DATA_API_KEY` | Legacy — old `/screener/persondb/search` integration (unused by live flow) |

---

## Open Questions (Do Not Block On These)

1. How strict should the Vetted threshold be at launch?
2. How strict is "high_potential" for early-career candidates?
3. Should `candidate_decision_state` start with only `active / hold / excluded`?
4. How aggressive should title normalization be in v1?
5. When (if ever) should embeddings be introduced vs staying deterministic?

---

## Reminder: What NOT to Do

- DO NOT rebuild profiles or profile_snapshots
- DO NOT replace deterministic scoring with LLM scoring
- DO NOT collapse bucket + review state + exclusion into one field
- DO NOT invent new bucket names beyond the five defined above
- DO NOT make scoring a single global score
- DO NOT skip the dictionary/normalization layer and go straight to scoring
- DO NOT re-introduce seniority into `title_dictionary` — it lives exclusively in `seniority_rules` now
- DO NOT use Crust's `years_of_experience_raw` — it includes pre-graduation student work

---

## Backlog

Not scoped to a build phase yet. Ordered roughly by dependency / impact.

### Data quality

- **Comprehensive `specialty_normalized` dictionary.** Current count is 25. Target 80–100 patterns for engineering alone (backend sub-specialties like payments/auth/data-pipeline, ML sub-specialties like NLP/vision/rec-sys, infra sub-specialties like kubernetes/observability/databases), then equivalent depth for product, design, sales, marketing, operations, recruiting, finance, data/analytics.
- **Company data enrichment.** Pull funding rounds, founding year (partially done — 20 hand-seeded), investor names, headcount by year, and major events (acquisitions, layoffs, C-suite departures) so `company_metrics_by_year` has real data and tenure scoring has more context. Required precondition for the AI narrative summary below.
- **Executive scoring weights.** Dedicated weight profile that deprioritizes `education` and `degree_relevance` and heavily weights `company_quality_recent`, `company_quality_average`, and role scope. Kicks in when `highest_seniority_reached = 'executive'` or when the scoring stage is `senior_career` AND current title matches the executive rule set.
- **`isStudentTitle` regex at ingest derive-current step ([app/api/ingest/route.ts](app/api/ingest/route.ts)) only matches title patterns (`intern|internship|co-op|student`). Crust v2 sometimes returns `employment_type='Internship'` on roles with non-student titles like "Flight Test Engineering" — those slip through the filter. Cross-check `employment_type='internship'` once that signal is consistently populated in v2 responses. Mitigated for now by `is_primary_current` being checked first (Crust's `is_default` flag wins over heuristics).**
- **Concurrent-ingest race on `companies` name-only inserts.** [`upsertCompany`](app/api/ingest/route.ts) (post-`company-mapper-enrich-minimal` merge) handles the `linkedin_url` UNIQUE collision via 23505 re-resolve, but two ingests of a never-seen-before company *without* a LinkedIn URL (e.g. concurrent Chrome extension scrapes) can still create duplicate rows because `companies.company_name` has no UNIQUE constraint. Low impact today — extension throughput is single-user, and Crust import always has a `linkedin_url` to dedupe by. Fix would be a case-insensitive UNIQUE on `company_name` (or a generated `company_name_lower` column) — not safe to add without first deduping existing case-variant duplicates.

### Vetted Companies V1 — vocabulary gaps surfaced during eval

- **Gaming as a hardware domain_tag.** Currently Gaming lives only in `NON_HARDWARE_DOMAIN_TAGS` (typed as a non-hardware-only tag). Hardware companies with real gaming businesses — Sony PlayStation, Valve (Steam Deck), Razer, Logitech G — have nowhere to surface that signal. During the larger-eval ground truth (2026-05-03), Sony's domain_tags ended up `[]` for this reason. Defer the call until recruiter searches surface gaming-hardware roles often enough to justify adding `Gaming` to `HARDWARE_DOMAIN_TAGS`. If added, requires a migration that updates the CHECK constraint AND `lib/companies/taxonomy.ts` together.
- **Out-of-scope industry gaps**: Telecommunications (Verizon falls to Services), Real Estate / co-working (WeWork falls to Services), Streaming/Music as primary (Spotify falls to Consumer Tech), Agriculture (John Deere falls to Industrial Manufacturing). Tracked as known gaps in the larger-eval report; only add as V1 industries if recruiter demand surfaces them.

### Pipelines

- **Early-stage startup monitoring.** Auto-ingest companies backed by A16Z, Sequoia, YC (and similar) on funding rounds or stealth-exit events. Keeps the scored-company set fresh without manual re-seeding.
- **Bulk company scoring.** Claude + Excel pipeline to auto-apply tier scores to mid-tier companies based on founding date and other signals. Output tagged as `AI-averaged` vs `manually ranked` (add a column or reuse `company_score_mode`). Deliverable: CSV that re-seeds `company_year_scores` in bulk.
- **PDL Preview API.** Explore as a supplement / alternative to Crust Data for bulk pulls (different coverage profile, different credit economics).
- **Import UI: sample-first workflow.** Before firing a full 500-profile pull, let the user request 50, review the mapped output, then confirm the full pull. Reduces credit burn on bad filters.

### AI (bounded, non-decision-making)

- **AI narrative summary.** Claude API generates a short story-of-the-candidate paragraph from their structured data (experiences + company context + education). This is summarization, not judgment — the scoring and bucketing stay deterministic. Depends on company data enrichment to have enough signal for useful summaries.

### Crust Data follow-ups

Confirm directly with Crust:
- Exact JSON shape for the `exclude_profiles` parameter on `/screener/persondb/search`
- Whether a `years_of_experience` filter is supported (to pre-filter by experience server-side)
- Full list of valid `SENIORITY_LEVEL` values accepted by the filter
- Whether a `school` filter is available
- Direct URL to the full authenticated API docs (our current docs are public-facing and partial)

---

## Development Rules — MUST FOLLOW

### Two lessons from 2026-04-29 (top of mind)

**1. Forward-referenced `const` inside a synchronous closure → runtime TDZ.**
TypeScript will accept code like `setPeople(rows.map(r => ({ x: cMap[r.id] })))` where `const cMap = ...` is declared LATER in the same scope. The compiler is correct that closures CAN capture forward-declared bindings — but only if the closure runs AFTER the declaration line. `.map()` callbacks inside `setState(...)` execute synchronously, so they hit the const before its initializer runs and V8 throws `Cannot access 'X' before initialization`. **Always declare consts BEFORE any synchronous callback that references them.**

**2. Curl HTTP 200 ≠ "preview works."**
Next.js prerenders the static shell server-side and bails out to client-side rendering for pages with dynamic data. Curl gets the shell. The browser executes JS during hydration and that's when client-side TDZ / runtime errors fire. **Before declaring a preview deploy verified, load the URL in an actual incognito browser window.** No exceptions for "I can see the title in the HTML."

See "TDZ from forward-referenced const inside synchronous closure" section below for the full diagnostic flow when this class of bug appears.

### Hard gates

When the user says "show me X before pushing," that's a hard gate. Pushing without showing is a process violation. Wait for explicit approval before proceeding past a gate.

### Pre-push verification

Before pushing ANY commit to main, run `npm run build` locally and confirm it completes with no errors or warnings. Production deployments should never go down due to a missed build error. The Vercel deploy is triggered by push to main — there is no staging environment.

### Architecture-level changes ship to a feature branch first

Tenure helpers, scoring engine, ingest pipeline, ranking changes, etc. — anything touching multiple files or a hot path — ships to a feature branch and gets a Vercel preview URL. The user verifies in browser before merging to main. Curl-only verification is insufficient (see TDZ rule below).

### Browser verification required for client-bundle changes

A curl response of HTTP 200 is NOT proof a page works. Next.js often prerenders the static shell server-side and bails out to client-side rendering for pages with dynamic data. Curl gets the shell. Browser executes the JS and may hit runtime errors that curl never sees.

**Before declaring "preview deploy works":** load the URL in an actual incognito browser window. Verify the data renders, no error fallback shows, and the React tree mounts cleanly. If you can't access a browser, ask the user to verify before claiming success.

### TDZ from forward-referenced const inside synchronous closure (incident: 2026-04-29)

This bug class is invisible to TypeScript, the build, lint, dev mode, AND curl tests of production. It only manifests when JavaScript actually executes the closure on the client.

**Pattern that fails:**
```ts
setPeople(rows.map(r => ({
  // This .map callback runs SYNCHRONOUSLY inside setPeople(...)
  tenure: helper(r.experiences.map(e => ({
    company_name: cMap[e.company_id]   // ← TDZ: cMap not yet declared
  })))
})))
const cMap = {}                          // ← declared AFTER usage above
for (const c of companies) cMap[c.company_id] = c.company_name
```

TypeScript accepts the forward reference because closures CAN capture forward-declared `const`s — but only if the closure runs AFTER the declaration line. The inner `.map(...)` callback runs synchronously inside `setPeople`, so it executes before the `const cMap` initializer line, hitting V8's Temporal Dead Zone:
```
ReferenceError: Cannot access 'cMap' before initialization
```

**Why this is hard to catch:**
- `npm run build` passes (TypeScript is fine with it)
- `next dev` may or may not show it depending on data flow
- `npx next start` + `curl` returns HTTP 200 (server prerenders the shell, bails to CSR, curl never executes the JS)
- Vercel preview deploy returns HTTP 200 to curl for the same reason
- Only manifests when a real browser executes the JS during hydration
- Minified variable name in production is a single letter (Q, U, etc.) which makes the error message look unrelated to source code

**Diagnostic flow when you see "Cannot access 'X' before initialization" in production:**
1. Pull the failing chunk from the deployed URL: `curl https://<deploy>.vercel.app/_next/static/chunks/app/page-<hash>.js`
2. Find ALL byte positions of the minified letter as a whole word: `grep -obE '\bX\b' chunk.js`
3. Find where it's declared: `grep -obE 'let X[ =]|var X[ =]|const X[ =]' chunk.js`
4. Check if any usage byte position is BEFORE the declaration position. That's the TDZ.
5. Get context with `dd if=chunk.js bs=1 skip=<usage_pos-50> count=200` to identify the source-level variable name.
6. Find that name in source — the fix is to move the `const` declaration above any code that references it (including code inside `.map`/`.filter`/etc. callbacks that run synchronously).

**Prevention rule:** When passing data into a `setState(arr.map(...))` callback that captures a `const` declared elsewhere in the same function scope, declare the `const` BEFORE the `setState` call, not after. This applies to any synchronous-executing closure (Array methods, generators, `Object.entries`, etc.) — not just `.map`.

---

## Raw Ingest Archive (Post-Migration 028)

Every ingest writes the verbatim payload to `raw_ingest_events` BEFORE normalization. If mapping fails, the raw row stays for replay. If a mapper bug corrupts normalized data, the archive enables re-mapping without re-fetching.

### Table: `raw_ingest_events`

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `linkedin_url` | TEXT NOT NULL | |
| `source` | TEXT NOT NULL | `chrome_extension_voyager`, `crust_v1`, `crust_v2`, `manual_admin` |
| `source_version` | TEXT | Extension version, Crust API version |
| `mapper_version` | TEXT | Semver from mapper module constant |
| `payload` | JSONB NOT NULL | Verbatim, no mutation |
| `payload_hash` | TEXT | SHA-256 hex |
| `fetched_at` | TIMESTAMPTZ | Default `now()` |
| `mapped_at` | TIMESTAMPTZ | Set when status → `mapped` |
| `processing_status` | TEXT | `pending`, `mapped`, `mapping_failed`, `superseded` |
| `mapping_error` | TEXT | Error message on failure |
| `person_id` | UUID FK | Set after successful mapping |

`source` is required on every POST to `/api/ingest`. Missing → 400. Step 0 of ingest writes the raw row before normalization. On success → status `mapped`, person_id set. On failure → status `mapping_failed`, error captured.

Each mapper in `lib/ingest/mappers/` exports `MAPPER_VERSION = '1.0.0'`. Bump per semver when output shape or field extraction changes.

Provenance columns on `people`, `person_experiences`, `person_education`: `last_ingest_source`, `last_ingest_at`. `people` also has `last_mapper_version`.

---

## Crust Import Audit Log (Post-Migration 029)

`crust_import_log` records every Crust v2 API call from the admin import flow — preview, run, and autocomplete requests. Used for cost tracking, debugging filter behavior, and verifying volume against credit cap.

### Table: `crust_import_log`

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `created_at` | TIMESTAMPTZ | Default `now()` |
| `request_kind` | TEXT NOT NULL | `'preview'` / `'run'` / `'autocomplete'` |
| `filter_body` | JSONB | The Crust filter body sent (after `buildCrustFilter`) |
| `results_count` | INTEGER | Profiles returned in this call |
| `credits_used` | INTEGER | Estimate via `estimateCredits()` (0.03/profile rounded up; 0 for autocomplete) |
| `error_message` | TEXT | Crust error body when applicable |
| `user_id` | TEXT | `'admin'` placeholder — auth not user-attributed today |

Helper: `lib/crust/log.ts::writeCrustLog()`. Fire-and-forget — never blocks the request path. All three Crust import routes call it after their Crust call completes.

---

## Primary-Current Disambiguation (Post-Migration 030)

`person_experiences.is_primary_current` BOOLEAN NOT NULL DEFAULT FALSE. Marks the candidate's primary current role.

### Why this column exists

Crust v2 sometimes returns multiple `is_current=true` experiences per candidate when employment overlaps (still-listed internships, advisory roles, side projects, board seats). Crust flags ONE with `is_default=true` to indicate the candidate's primary role — that flag is preserved via this column.

### Index

`idx_person_exp_primary_current ON person_experiences (person_id) WHERE is_primary_current = TRUE` (partial index — only the ~1 primary row per person).

### Used by

The "derive current role" step in `app/api/ingest/route.ts` checks in priority order:
1. `is_primary_current = true`
2. First non-student-titled current role
3. Any current role with a title
4. `currentExps[0]`

Mitigates the `isStudentTitle` regex limitation (see backlog): if Crust returns a still-listed internship as one of multiple `is_current=true` rows, `is_primary_current=true` on the real current job wins.

---

## Tenure Helper (`lib/tenure/helpers.ts`)

Two-pass FT classification + company-stretch tenure:

**Pass 1 — `isCountedAsFt(exp, education, mode)`:** hard exclusions (no title, no start_date, internship, hard non-FT title patterns like intern/co-op/volunteer, student titles, assistantship+edu overlap, mode-specific date filter).
- `mode='yoe'`: exclude if start year < gradYear
- `mode='tenure'`: exclude if end year < gradYear + 0.5

**Pass 2 — `filterSecondaryCompanySpans()`:** group Pass-1 survivors by company, merge contiguous stints (gap ≤ 30 days). When two company spans overlap > 3 months: if one is all soft-non-FT-titled OR self-employed name OR known OSS project → that company is secondary. Otherwise longest span wins, most recent start tiebreak.

**Soft non-FT title patterns:** advisor, advisory (not "Advisory Services/Group"), board member/director/observer, contractor, freelancer.

**Consultant titles:** soft-non-FT UNLESS at a known consulting firm (McKinsey, Bain, BCG, Deloitte, etc. — see `lib/tenure/data/consulting-firms.ts`).

**Self-employed company names** (always soft-non-FT regardless of title): Freelance, Self-Employed, Independent, Independent Contractor, Consulting (exact), Personal, N/A, Various, Sole Proprietor — see `lib/tenure/data/self-employed-companies.ts`.

**OSS projects + role patterns:** roles like "Core Developer" / "Maintainer" / "Committer" at OSS projects (CPython, Apache, Linux Foundation, etc.) are soft-non-FT — see `lib/tenure/data/oss-projects.ts` and `lib/tenure/data/oss-role-patterns.ts`.

### Module structure for client/server-shared modules — IMPORTANT

`lib/tenure/helpers.ts` is imported by both client (`ProfileTable.tsx`) and server (`lib/normalize/seniority.ts`). Constants that allocate at module-top (`new Set([...])`, `new Map([...])`) are forbidden in this file. Use plain arrays exported from `lib/tenure/data/*.ts` and lazy-init Sets inside function bodies via closure-bound `let _x: Set | null = null`. The data files contain ZERO imports, ZERO constructors, ZERO function calls at module top — pure `export const FOO = [...]` only.

This is a defensive pattern. Even though the actual TDZ incidents (49bcbb7, 0bb89ca, freelance-edu-fix-v3 v1) traced to forward-referenced consts in component code (not Sets), keeping the data layer purely declarative removes one entire class of bundling-order risk for files that span client/server.

### Known limitations (backlog)

- Long-running side commitments without non-FT title signal (e.g. Co-Founder at side project) can win concurrent-span tiebreak. Needs company-quality/prestige score input.
- Waterloo-style co-op detection: short stints at multiple companies pre-graduation without explicit co-op title signal.

---

## Education Display Filter (`lib/education/display-filter.ts`)

Filters education entries for display in drawer, full profile, and list view school column. Data stays in `person_education`; this is display-only.

**Rules in order:**
1. Blocklist removed: yoga/yogi schools, NOLS/outdoor programs, IDEO/Acumen certificates, summer programs, bootcamps, workshops. Plus `degree_level = 'certificate'` or `'coursework'`.
2. Incubator/accelerator removed (belong in signals): Singularity University, Y Combinator school program, Techstars, 500 Startups, AngelPad, MassChallenge, Startup Chile.
3. Degree allowlist: only entries with bachelor, master, MBA, PhD, JD, MD, associate, IB. Falls back to step-2 survivors if nothing passes.
4. Dedupe by `school_name_raw + degree_raw`.
5. Sort by `end_year DESC`.

Same data-files architecture as tenure helpers — see `lib/education/data/*.ts`.

---

## Seniority Display (Drawer + Profile Page)

Two separate lines in the classification metadata grid:
- **"Seniority"** — current role's `seniority_normalized` (from `is_current=true` experience)
- **"Highest seniority"** — `people.highest_seniority_reached` (only shown when different from current)

A candidate can be an IC in their current role but have reached Lead IC at a previous company.
