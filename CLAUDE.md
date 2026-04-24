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
| Bulk import | Crust Data `/screener/persondb/search` + streaming admin page |
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

## Specialty as the Primary Search Filter (Post-Migration 016)

Recruiters search by **specialty** (mechanical_engineering, avionics, backend, gnc…), not by function (engineering, product…). The `ProfileTable` filter bar reflects this:

- Specialty is the widest, most prominent filter, with a "Any past specialty" (default) / "Current only" scope toggle. Default mode scans all of a person's experiences, capturing career switchers. "Current only" queries `people.primary_specialty`.
- Function remains available but is labeled "(secondary)" and visually demoted. Function still drives the scoring engine internally and powers `company_function_scores`; it's not the recruiter's primary search axis.

The specialty picker displays all active specialties grouped: **Hardware engineering** (first — matches the hard-tech focus), **Software engineering**, then non-engineering by parent_function (operations, product_management, product_design, recruiting).

Migration 016 added 23 hardware-oriented specialties (mechanical_engineering, electrical_engineering, firmware, flight_software, avionics, gnc, propulsion, controls_engineering, rf_engineering, fpga_engineering, asic_engineering, hardware_engineering, systems_engineering, test_engineering, manufacturing_engineering, reliability_engineering, quality_engineering, structural_engineering, thermal_engineering, materials_engineering, power_electronics, optics_engineering, mechatronics). Title→specialty mappings for these are **not yet seeded** — they appear in the filter UI but candidates won't be auto-tagged from raw LinkedIn titles until a follow-up session adds the title_dictionary entries.

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

## Database: Final Schema State (after migrations 001–005)

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
├── supabase/migrations/
│   ├── 001_vetted_normalized_schema.sql         ← all Phase 1 tables + enums
│   ├── 002_vetted_seed_data.sql                 ← dictionaries (functions, specialties, titles, degrees, employment types)
│   ├── 003_bucket_taxonomy_and_schools.sql      ← bucket enum swap + school_score + is_foreign
│   ├── 004_aliases_derived_fields.sql           ← school_aliases + people derived columns + companies.founding_year
│   └── 005_seniority_taxonomy.sql               ← 6-value seniority enum + seniority_rules table
│
├── app/                                         ← Next.js 14 App Router
│   ├── page.tsx                                 ← "/" renders ProfileTable
│   ├── layout.tsx
│   ├── types.ts                                 ← Person, Experience, Education, Company, BucketAssignment, etc.
│   ├── components/
│   │   ├── ProfileTable.tsx                     ← main people table + faceted filters + search + bucket chips
│   │   └── ProfileDrawer.tsx                    ← row-click side drawer with bucket + score reasoning
│   ├── profile/[id]/page.tsx                    ← "/profile/[id]" detail page
│   ├── admin/
│   │   ├── companies/
│   │   │   ├── page.tsx                         ← "/admin/companies" list + filters + sort
│   │   │   ├── [id]/page.tsx                    ← edit company + year scores
│   │   │   └── new/page.tsx                     ← create company form
│   │   ├── import/page.tsx                      ← "/admin/import" — Crust bulk import UI with live NDJSON progress
│   │   └── seed/page.tsx                        ← "/admin/seed" — 3 hardcoded test payloads for smoke tests
│   └── api/
│       ├── ingest/route.ts                      ← POST /api/ingest (Chrome ext + admin/import target)
│       └── admin/
│           ├── import/route.ts                  ← POST /api/admin/import (streaming full import via /person/search v2)
│           └── import/preview/route.ts          ← POST /api/admin/import/preview (sample + total_count for confirm dialog)
│
├── lib/
│   ├── supabase.ts                              ← browser Supabase client (anon key)
│   ├── normalize/
│   │   ├── index.ts                             ← barrel
│   │   ├── titles.ts                            ← normalizeTitle() → title_dictionary lookup with prefix/suffix strip
│   │   ├── degrees.ts                           ← normalizeDegree() + normalizeFieldOfStudy()
│   │   ├── employment.ts                        ← normalizeEmploymentType()
│   │   └── seniority.ts                         ← resolveSeniority() + graduationDateFromEducation() — the ONLY source of seniority
│   ├── scoring/
│   │   ├── index.ts                             ← barrel
│   │   ├── score-candidate.ts                   ← scoreCandidate() + writeBucketAssignment()
│   │   └── compute-derived.ts                   ← computeAndWriteDerivedFields()
│   └── ingest/
│       ├── index.ts                             ← barrel
│       ├── crust-person-search.ts               ← buildPersonSearchBody() + fetchPersonSearchPage() for v2 /person/search
│       ├── crust-api.ts                         ← legacy — old /screener/persondb/search network layer + postIngest()
│       └── mappers/
│           ├── crust-v2.ts                      ← mapPersonSearchToCanonical() for /person/search v2 responses (live)
│           ├── crust.ts                         ← legacy — mapCrustToCanonical() for old /screener/persondb/search
│           └── generic.ts                       ← mapGenericToCanonical() — best-effort aliasing for unknown JSON
│
└── scripts/                                     ← one-shot + backfill scripts (all .mjs, run with node)
    ├── reseed-companies.mjs                     ← clears + re-seeds companies + company_year_scores from CSV
    ├── seed-company-scores.mjs                  ← original seed (non-destructive upsert version)
    ├── seed-founding-years.mjs                  ← hardcoded founding_year for 20 scored companies
    ├── seed-universities.mjs                    ← seeds schools from CSV (66 rows)
    ├── seed-school-aliases.mjs                  ← 93 aliases across 32 schools
    ├── seed-recruiting-titles.mjs               ← 16 recruiting titles → title_dictionary
    ├── seed-seniority-rules.mjs                 ← 73 rules into seniority_rules (idempotent: delete + re-insert)
    ├── compute-derived-fields.mjs               ← batch version of computeAndWriteDerivedFields for all people
    ├── backfill-seniority.mjs                   ← re-evaluates seniority for every experience + recomputes years_experience_estimate + career_stage
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

## Admin Import (Crust Data — Person Search API v2)

Uses Crust's **`POST https://api.crustdata.com/person/search`** API with Bearer auth and `x-api-version: 2025-11-01`. Two-step sample-first workflow:

**Step 1 — `POST /api/admin/import/preview`** (non-streaming JSON)

```ts
{ company_name?, location?, seniority_level?, function_category? }
```

Calls Crust with `limit: 50` and returns a sample plus `total_count`. (`preview: true` is supported by the API but not enabled on our current plan — the fallback still returns a real sample of 50.) Response: `{ total_count, sample_count, samples[], filters }`. UI renders a confirmation table before the full pull.

**Step 2 — `POST /api/admin/import`** (streaming NDJSON)

Same filter body plus optional `total_count` (for progress denominator). Flow:
1. Queries `people.linkedin_url` → passes as `post_processing.exclude_profiles` so Crust skips already-ingested profiles server-side.
2. Paginates via `next_cursor` at 100/page until exhausted.
3. Each record → `mapPersonSearchToCanonical` (`lib/ingest/mappers/crust-v2.ts`) → `postIngest` to `/api/ingest`.

Events: `start` (with `estimated_total` and `excluded_count`), `progress`, `info`, `error`, `complete`.

**Filter syntax** — leaf `{ field, type: '(.)', value }`; composite `{ op: 'and', conditions: [...] }`. The four user-facing filters map to:

| Input | Crust field |
|---|---|
| company_name | `experience.employment_details.current.company_name` |
| location | `basic_profile.location.full_location` (broader than city/state/country) |
| seniority_level | `experience.employment_details.current.seniority_level` |
| function_category | `experience.employment_details.current.function_category` |

Note: `seniority_level` and `function_category` are filter-only — they are not returned in responses, so the preview table shows `—` for Seniority.

**Key mapping rules in `lib/ingest/mappers/crust-v2.ts`:**
- `linkedin_url` ← `social_handles.professional_network_identifier.profile_url`
- `full_name` ← `basic_profile.name`
- `location_resolved` ← `basic_profile.location.raw` (fallback to city/state/country — structured fields can be unreliable)
- Current company/title = `employment_details.current[is_default=true]` → `current[0]` fallback
- `experiences[]` = `employment_details.current[]` (marked `is_current=true`) + `.past[]` (`is_current=false`)
- `education[]` ← `education.schools[]` with fields `{ school, degree, start_year, end_year }` — note `school` not `school_name`, and `start_year`/`end_year` are direct integers, not parsed from ISO dates
- Dates: strip ISO time ("2022-05-01T00:00:00" → "2022-05-01")
- `years_experience` = post-graduation, non-internship span (Crust's `years_of_experience_raw` is NOT used — it counts student jobs)

**Legacy old-API integration** — `lib/ingest/mappers/crust.ts` and `lib/ingest/crust-api.ts` still exist for the old `/screener/persondb/search` endpoint. Not used by the live import flow.

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
