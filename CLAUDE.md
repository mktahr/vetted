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
| `vetted_talent` | Clearly crosses the high-signal bar |
| `vetted_potential` | Strong signals, earlier career or not fully proven yet |
| `solid_below_threshold` | Good, capable, but doesn't cross the Vetted bar |

DO NOT add "rejected" or "excluded" to this taxonomy. That lives in `candidate_decision_state`.

---

## Career Stages

| Stage | Description |
|---|---|
| `pre_career` | Students, no full-time roles yet |
| `early_career` | 0–4 years full-time |
| `mid_career` | 4–10 years full-time |
| `senior_career` | 10+ years full-time |

Scoring weights differ by stage. Early career = weight education heavily. Senior career = weight recent company/role quality heavily.

---

## Company Score Scales

**company_year_scores** (overall company quality):
- 1 = weak
- 2 = mixed
- 3 = solid
- 4 = excellent
- 5 = elite

**company_function_scores** (quality of a specific function at a company):
- 0 = not meaningful / insufficient signal
- 1 = okay
- 2 = strong
- 3 = exceptional

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
- DO NOT invent new bucket names beyond the three defined above
- DO NOT make scoring a single global score
- DO NOT skip the dictionary/normalization layer and go straight to scoring
