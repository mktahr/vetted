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
| Language | TypeScript / Next.js |

---

## What Already Exists (DO NOT BREAK)

### Live Supabase Tables — PRESERVE THESE
- `profiles` — current working search/display layer
- `profile_snapshots` — raw scrape storage

### Live Supabase Function — PRESERVE THIS
- `upsert_profile_from_snapshot` — handles the ingest write

### Chrome Extension
- Located in: `vetted-extension-main/`
- Scrapes LinkedIn profile pages one at a time
- Sends payload to: `https://vetted-self.vercel.app/api/ingest`
- Auth: `x-ingest-secret` header
- Key files: `src/content.ts` (scraper), `src/background.ts` (API sender), `src/types.ts`

### Vercel API
- `/api/ingest` — receives scrape payload, writes to Supabase

---

## New Architecture (What We're Building)

### Data Flow
```
Chrome Extension scrape
→ profile_snapshots.raw_json (existing, keep)
→ canonical extraction
→ normalized relational tables (NEW)
→ scoring/ranking layer (NEW)
→ bucket assignment (NEW)
→ search layer (NEW)
```

### Core New Domains
1. **Companies** — normalized company table with quality scores by year/function
2. **People** — normalized people table linked from profiles
3. **Experiences** — structured work history
4. **Education** — structured education with school scores
5. **Dictionaries** — title/function/seniority/degree normalization tables
6. **Scoring + Bucketing** — deterministic quality signals
7. **Review / Confidence** — flags for manual review, separate from bucket

---

## THE MOST IMPORTANT DESIGN RULES

### Rule 1: Three Separate Layers — NEVER Collapse These
```
candidate_bucket        ← quality tier (Vetted / Potentially Vetted / Solid)
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
- company_year_scores and company_function_scores handle this
- Role recency matters heavily in search ranking

### Rule 5: Migration is Additive First
- Never drop or alter `profiles`, `profile_snapshots`, or `upsert_profile_from_snapshot`
- All new tables are additions
- Link back to existing tables where needed

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

**Note:** `career_stage_config` in the DB was seeded with rougher boundaries (0/4/10/10+). The scoring engine recomputes the stage from `years_experience_estimate` at scoring time using the ranges above, so these are the authoritative cutoffs.

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
- **career_slope** (BONUS only) — if `people.career_progression = 'upward'`, full bonus points. `lateral`/`unclear`/null → 0. **Never subtracts.**
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

Populated by `scripts/compute-derived-fields.mjs` (run after any ingest batch). All are **searchable filter tags** — never direct inputs to the score, except `career_progression` which gates the `career_slope` bonus.

| Column | Type | Meaning |
|---|---|---|
| `career_progression` | text | `'upward'` (last scored FT > first), `'lateral'` (equal or only 1 scored role), `'unclear'` (last < first). Null if no scored FT roles. Only `'upward'` triggers the career_slope bonus. |
| `highest_seniority_reached` | seniority_level | Max `seniority_normalized` across all experiences, by `seniority_dictionary.rank_order`. |
| `has_early_stage_experience` | boolean | TRUE if any experience started within 4 years of the company's `founding_year`. |
| `early_stage_companies_count` | smallint | How many such companies. |
| `has_hypergrowth_experience` | boolean | TRUE if any experience overlapped a year where `company_metrics_by_year.headcount_estimate` ≥ 2× the prior year. |
| `hypergrowth_companies_count` | smallint | How many such companies. |

---

## Build Phases

### Phase 1 (Current) — Normalized Foundation
Tables: companies, people, person_experiences, person_education, schools, school_scores, dictionaries, candidate_bucket_assignments, candidate_review_flags, candidate_decision_state

### Phase 2 — Scoring + Bucketing Logic
Implement deterministic scoring functions, bucket assignment logic, review flag generation

### Phase 3 — Search Layer
Query-relevant ranking, weighted search, filters by function/seniority/stage

### Phase 4 — Advanced Signals
Publications, open source, founder scoring, investor signals, deeper graph

---

## Key File Locations (once repo is set up)

```
/
├── CLAUDE.md                    ← this file, always read first
├── vetted-extension-main/       ← Chrome scraper (existing)
│   └── src/
│       ├── content.ts           ← LinkedIn scraping logic
│       ├── background.ts        ← API send logic
│       └── types.ts             ← shared types
├── app/                         ← Next.js app (Vercel)
│   └── api/
│       └── ingest/              ← ingest endpoint
├── supabase/
│   └── migrations/              ← all SQL migration files, run in order
└── lib/
    ├── normalize/               ← title/function/degree normalization logic
    └── scoring/                 ← deterministic scoring functions
```

---

## Open Questions (Do Not Block On These)

1. How strict should the Vetted threshold be at launch?
2. How strict is "vetted_potential" for early-career candidates?
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
