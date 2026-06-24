# Vetted — Master Context for Claude Code

## What is Vetted?

Vetted is an elite recruiting intelligence platform — think of it as the top 10% of LinkedIn profiles, structured, scored, and ranked using a **deterministic, rules-based system** (not AI inference). It helps recruiting teams find high-signal candidates without relying on fuzzy AI guessing.

The core insight: instead of asking AI to judge a candidate, we build our own dictionary and scoring system so the rules are explicit, auditable, and consistent.

---

## Documentation Index

This file (CLAUDE.md) is the engineering context. Other docs at repo root:

- **[README.md](README.md)** — GitHub-facing project intro: what Vetted is, stack summary, data-flow paragraph.
- **[SESSION_HANDOFF.md](SESSION_HANDOFF.md)** — Latest session's handoff block only (overwritten each `end session`). Read first by the Start-of-Session Protocol when Matt types "start session".
- **[CHANGELOG.md](CHANGELOG.md)** — Reverse-chronological work-session log (shipped / decisions / where we left off / open questions / watch-outs). Updated automatically by the End-of-Session Protocol when Matt types "end session".
- **[ROADMAP.md](ROADMAP.md)** — Current build, sequenced "Next Up" items, recently completed (with PR links). The "what are we shipping" doc.
- **[BACKLOG.md](BACKLOG.md)** — Major deferred features (>0.5 day to scope/build), sub-sectioned by domain. Each entry has a trigger condition for when to build.
- **[BUGS.md](BUGS.md)** — Small fixes (<0.5 day each). Items move here from BACKLOG when they're scoped down or surface during build.
- **[POSITIONING.md](POSITIONING.md)** — Product positioning + differentiators. Marketing-facing language, not engineering.
- **[COMMANDS.md](COMMANDS.md)** — Plain-English commands Matt uses with Claude Code + technical command reference + glossary.
- **[GETTING_STARTED.md](GETTING_STARTED.md)** — Onboarding for a new machine. **Currently stale; references old build phases.**

**When to update which:**
- Session ends (Matt typed "end session" / "wrap session") → CHANGELOG.md (append) + SESSION_HANDOFF.md (overwrite) per End-of-Session Protocol below
- Session starts (Matt typed "start session" / "new session") → read SESSION_HANDOFF.md + ROADMAP + CHANGELOG top entry per Start-of-Session Protocol below
- New deferred feature → BACKLOG.md
- New small fix that's <0.5 day → BUGS.md
- Item moved into active queue → ROADMAP.md "Next Up"
- Item finished and merged → ROADMAP.md "Recently Completed" (with PR link)
- Engineering decision or new system → CLAUDE.md (this file)

---

## Documentation Vocabulary

Matt uses plain-English phrases for common doc operations. Recognize these and act accordingly:

| Phrase | What to do |
|---|---|
| "Add to roadmap" | Edit ROADMAP.md under the appropriate section ("Current Build" / "Next Up" / "Recently Completed") |
| "Add to backlog" | Edit BACKLOG.md (deferred features, sub-sectioned by domain) |
| "Add to bugs" | Edit BUGS.md (small fixes) |
| "Add to CLAUDE.md" | Add engineering context to this file |
| "start session" (primary) / "new session" (alias) | Execute the Start-of-Session Protocol: read SESSION_HANDOFF.md + ROADMAP + most recent CHANGELOG entry, synthesize kickoff message, ask whether to proceed with the queued task or pivot. See "Start-of-Session Protocol" section below. |
| "end session" (primary) / "wrap session" (alias) | Execute the End-of-Session Protocol: **pre-flight verification first** (state check + hard-stop on uncommitted/un-pushed work; open PR + not-yet-deployed reported as context) → session summary + CHANGELOG entry + migration ledger + ROADMAP + BACKLOG/BUGS + commit + push + PR merge decision + write SESSION_HANDOFF.md. Two approval gates (post-docs-diff, pre-merge). See "End-of-Session Protocol" section below. |
| "Status check" | Report: current branch, what's in flight, last commit, what's on roadmap next |
| "What did we ship last session?" | Report the last merged PR with contents (from `git log main` and PR titles) |
| "What's next on the roadmap?" | Read ROADMAP.md "Current Build" + top of "Next Up" |
| "What did we last complete?" | Read ROADMAP.md "Recently Completed" — most recent row |
| "block" (exact, single word) | Re-output the immediately preceding response as ONE self-contained plain-text copyable code block, for one-click forwarding (to a Claude chat, Codex, or a fresh session). See "Block Command" section below. |

---

## Prompt Output & Copyable-Block Conventions

### Full-copyable-prompt rule

This is primarily a rule for how the **chat assistant (Claude.ai)** outputs prompts intended to be handed to Claude Code. Whenever a prompt is provided for Matt to give to CC, it must come as **one full, consolidated, copyable block** — the entire prompt, ready to copy in a single action. Never partial updates, never "change line X to Y," never a diff against a previous prompt. If the prompt changed, re-output the whole thing from scratch. Matt copies one block and pastes it; he should never have to assemble a prompt from fragments.

### Block Command

**Trigger phrase: `block`** (exact, single word). When Matt types it, take whatever was produced in the **immediately preceding response** — summary, audit, proposals, judgment calls, report, or prompt — and re-output it as a **single self-contained copyable code block** so Matt can one-click copy and paste it elsewhere (a Claude chat, Codex, or a fresh CC session) without manually highlighting.

Rules for the block:
- **Full substance, not a summary** — include everything of substance from the prior response. It must stand alone so the recipient has full context.
- **Plain readable text inside the block** — no reliance on rendered bold / links / tables (code blocks don't render those). Convert tables to plain lists/labels, links to bare URLs, etc.
- **Faithful reformat only** — do not add new analysis or change any recommendation. It's a re-packaging of what was already said, for forwarding.
- **On-demand only** — normal responses stay normally formatted for readability. Only `block` triggers the plain copyable version.

---

## Reference Data Convention (Post-Migration 060 / 2026-05-20)

Reference data (dictionaries, lookup tables, curated lists) lives in **`/reference/`** as canonical CSVs. Edits flow: **edit CSV → commit → run `node scripts/sync-reference.mjs` → DB updates.**

**HARD RULE:** Do not edit reference data directly in Supabase Studio. The CSV is the source of truth. Direct DB edits will be overwritten on the next sync.

### Folder layout (`/reference/`)

```
/reference/
├── signals/                          # one CSV per signal_dictionary.category (post-063: all is_searchable=FALSE)
│   ├── academic_distinction.csv      # PBK, Latin honors, valedictorian, etc.
│   ├── athletics.csv                 # 6 rows (D1/Pro/Olympic = tier_3; JrOlympic/D2/D3 = tier_2)
│   ├── competition.csv               # engineering competition leagues (FSAE, IREC, RoboCup, IAC, etc.)
│   ├── engineering_team.csv          # category-row only (141 specific teams seeded via import-teams.mjs)
│   ├── fellowship.csv                # non-university only (Hertz, KP, Thiel, etc.)
│   ├── founder.csv                   # 3 rows after migration 063 (Side Project Founder dropped)
│   ├── greek_life.csv
│   ├── hackathon.csv
│   ├── military.csv
│   ├── national_lab.csv              # federal R&D centers ONLY (JPL, Lincoln Lab, MITRE, etc.)
│   ├── olympiad.csv
│   ├── patent.csv
│   ├── publication.csv               # conferences + tag-style ("Has Conference Publication")
│   ├── research_institute.csv        # Allen AI, Arc, Santa Fe, CSET, RAND, Broad
│   ├── scholarship.csv               # Rhodes, Marshall, Truman, etc.
│   ├── student_leadership.csv
│   ├── student_venture_fund.csv      # Dorm Room Fund, RDV, Prospect, Harvard Ventures Alpha
│   ├── university_fellowship.csv     # Mayfield, Kessler, HUTIF, ELITE, Viterbi, Tsai CITY
│   ├── university_incubator_accelerator.csv  # StartX, SkyDeck, delta v, Sandbox, etc.
│   ├── university_lab.csv            # SAIL, BAIR, Sky, CSAIL, ERL, SISL
│   └── university_program.csv        # M.E.T., M&T, IBE, Iovine, Schreyer, CS+X, Converse, SEAL
├── teams/
│   ├── teams.csv                     # 141 university teams (FSAE, rocketry, etc.)
│   ├── competitions.csv              # 21 competition leagues
│   └── (team_domain_tags loaded by scripts/import-teams.mjs)
├── companies/
│   └── company_scores.csv            # company year-scores source (moved from ~/Downloads on 2026-05-20)
├── investors/
│   └── investor_tiers.csv            # 70 rows: 44 VC firms + 26 individual angels (post-migration 061)
├── dictionaries/
│   └── field_of_study.csv            # 86 rows → 43 normalized values (added migration 064)
├── schools/                          # canonical school list + aliases (TBD — not yet CSV-driven)
└── search_intents/
    └── intent_signal_map.csv         # reference-only; not DB-loaded (AI chat search workstream will consume)
```

### Sync script (`scripts/sync-reference.mjs`)

- Dispatcher pattern — one handler per CSV target table.
- `--dry-run` prints diff (inserts / updates / deletes) without writing.
- `--only=signals/athletics.csv,investors/investor_tiers.csv` to scope.
- `--table=signal_dictionary` to scope by target table.
- UPSERT on conflict keys: `signal_dictionary(canonical_name, category)`, `investor_tiers(investor_name)`.
- **Diff scoping for signal CSVs** — each CSV's diff is restricted to its own category (athletics.csv compares against `WHERE category='athletics'`, not the whole table), so rows in DB outside that category aren't touched.
- Deletes cascade through FKs where configured (e.g., `person_signals` follows `signal_dictionary` deletes — per the "candidate data is test material until launch" memory, this is acceptable).
- The `investor_tiers.kind` legacy column is kept in sync with `investor_type` via a post-sync SQL the script emits — run it manually after sync if you see the prompt.

### What's NOT yet CSV-driven (still ad-hoc)

- `companies` + `company_year_scores` — uses `scripts/reseed-companies.mjs` reading from `/reference/companies/company_scores.csv`. Not yet folded into sync-reference because the company table is too large to UPSERT row-by-row efficiently.
- `teams` + `competitions` + `team_domain_tag_dictionary` — uses `scripts/import-teams.mjs`. Could be folded into sync-reference; not today.
- `schools` + `school_aliases` — uses `scripts/seed-universities.mjs` + `scripts/seed-school-aliases.mjs`. Backlog item to migrate.
- `seniority_rules` — DB-only, no CSV. Backlog item.
- `lib/companies/tagger/dictionary.ts` — hardcoded TS dictionary. Stays as code because it's deeply tied to the Claude prompt structure.
- `lib/companies/taxonomy.ts` — hardcoded TS (CATEGORIES + HARDWARE_INDUSTRIES + NON_HARDWARE_INDUSTRIES + domain tags). Stays as code because it's enforced via CHECK constraints AND tagger prompt.
- `lib/tenure/data/*.ts` + `lib/education/data/*.ts` + `lib/locations/us-locations.ts` — small, semantic, paired with logic in same module. Stay as code.

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

### Rule 6: Data State During Build Phase
The database holds a small, sparse set of real candidates and companies — enough to test logic and verify features work, but not a robust or complete corpus. It will be expanded and enriched later (companies need enrichment, dedup, additions/removals; candidate volume grows over time). When building features: build the logic to be correct against the full corpus it will eventually hold, and use the existing data only to validate that the logic runs and behaves correctly on a sample. Do NOT flag sparse or empty data as a blocker or concern — we already know the data is thin and are populating it separately. Only flag data state if it affects the correctness of the logic itself (e.g. a calculation that would break, not merely return few results).

---

## Companies V1 Taxonomy (Post-Migration 031)

Migration 031 replaced the old `focus` (`hard_tech`/`all_tech`/`unreviewed`) and `manual_review_status` columns with two **independent** dimensions: `category` (what kind of company) and `review_status` (workflow state). The old binary "is this hard tech" flag is gone — companies now have a richer taxonomy backed by Crust + Claude tagger.

### Two independent dimensions

| Column | Purpose | Values |
|---|---|---|
| `category` | What kind of company. Drives industry validation. | `hardware`, `non_hardware`, `NULL` (unclassified) |
| `review_status` | Triage workflow state. | `vetted`, `unreviewed`, `excluded` |

**Migration of legacy values:** `focus='hard_tech' → category='hardware'`, `focus='all_tech' → category='non_hardware'`, `focus='unreviewed' → category=NULL`. Workflow state moved from `manual_review_status` (reviewed/locked → vetted; unreviewed → unreviewed). The `manual_review_status` enum was dropped.

### New taxonomy columns on `companies`

- `category` (TEXT, nullable, CHECK in (`hardware`, `non_hardware`))
- `primary_industry` (TEXT, nullable) — single value picked from the category-specific industry list (see [lib/companies/taxonomy.ts](lib/companies/taxonomy.ts))
- `industries` (TEXT[], default `{}`) — multi-industry support; primary is required to appear in this array
- `domain_tags` (TEXT[], default `{}`) — orthogonal multi-select tags (e.g. `AI`, `Climate`, `Defense`) within a category
- `crustdata_company_id` (BIGINT UNIQUE), `professional_network_id` (TEXT) — external IDs for cross-system identity
- `company_type` (TEXT, no CHECK yet) — final enum deferred to a later investigation
- `tagging_method` / `tagging_confidence` / `tagging_notes` — provenance from the Claude tagger
- `headcount_latest` + `headcount_latest_at` — denormalized snapshot for sorting
- `review_status` (TEXT, CHECK in (`vetted`, `unreviewed`, `excluded`))

### Critical constraint: category gates industries

A company with `category=NULL` MUST have `primary_industry=NULL`, `industries={}`, and `domain_tags={}`. Inserts/updates that violate this will be rejected by application code. See [app/admin/companies/new/page.tsx:52-56](app/admin/companies/new/page.tsx#L52) for the canonical pattern.

### Filter scope: candidate search defaults to "all"

Per Matt's Option C decision (2026-05-04): both `categoryScope` and `reviewStatusScope` default to `'all'` in the candidate filter sidebar so the V1 schema migration does NOT silently filter the recruiter view. Admin can opt into stricter scopes (e.g. `vetted-only`) explicitly. See [app/components/FilterSidebar.tsx:14-21](app/components/FilterSidebar.tsx#L14).

### No bulk backfill

Existing 1,500+ companies stay at `category=NULL` after 031. They get classified as the auto-tagger cron processes them (see "Auto-Tagging Cron" section).

### Legacy columns

`primary_industry_tag` → renamed to `legacy_primary_industry_tag` (preserved, not actively used). `sub_industry_1/2/3` → `legacy_*`. The old `company_focus_type` enum was dropped.

---

## Auto-Tagging Cron + Spend Cap (Post-Migration 032)

A nightly cron classifies companies with `category=NULL` and `tagging_method=NULL` using Claude Haiku 4.5. Each tagged company gets `category`, `primary_industry`, `industries[]`, `domain_tags[]` filled in and `tagging_method='claude_haiku'`.

### Spend cap

`companies_tag_spend_log` is a per-day rollup (`log_date` PK). Each `tagCompany()` call increments `total_companies_tagged` and adds `EST_CENTS_PER_TAG=1` (rounded up from ~$0.005 actual). When `estimated_anthropic_cents >= MAX_DAILY_ANTHROPIC_CENTS` (default 1000 = $10/day) the cron throttles for the rest of the UTC day.

At the cap the cron processes ~1,000 companies/day. Adjust env var if real spend differs.

### Routes

- **Cron**: `vercel.json` schedules a daily route that calls `[app/api/admin/companies/tag-pending/route.ts](app/api/admin/companies/tag-pending/route.ts)`. Was disabled before 031 shipped (see commit 9a7c9dd) and re-enabled after.
- **On-demand**: `[app/api/admin/companies/[id]/tag/route.ts](app/api/admin/companies/[id]/tag/route.ts)` — "Tag now" button on the company detail page. Also writes to the spend log.
- **Re-enrich**: `[app/api/admin/companies/[id]/re-enrich/route.ts](app/api/admin/companies/[id]/re-enrich/route.ts)` — refreshes Crust firmographics + funding for one company without touching the tagger output.

### Tagger module

Lives at [lib/companies/tagger/](lib/companies/tagger/). Files: `claude.ts` (LLM call), `dictionary.ts` (industry/tag vocabulary used in the prompt), `index.ts`, `types.ts`.

---

## Triage Page

`/admin/companies/triage` lists companies with `review_status='unreviewed'`, sorted by `created_at` desc. Provides quick actions: mark vetted, mark excluded, edit, or open the company detail page. Used by Matt to clear the queue after auto-tagging or after Crust ingest creates new stub companies.

---

## Role Dictionary + Specialty Taxonomy (Post-Migration 017)

> **Superseded by the Five-Axis Taxonomy (post-migrations 071/072).** The 17-era role+specialty model is being replaced with a five-axis structure (function, specialty, skills, industry context, title). The legacy `role_dictionary` and `role_specialty_map` are still wired today but will be retired as the new taxonomy fully lands across ingest, scoring, and UI. See "Five-Axis Taxonomy" section below.

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

## Five-Axis Taxonomy (Post-Migrations 069–074)

The candidate model captures what kind of work someone does, at what depth, in what context — across **five searchable axes**:

| Axis | Storage | Source of truth |
|---|---|---|
| **Function** | `person_experiences.function_normalized` + `people.current_function_normalized` | `function_dictionary` — 18 active values (16 V1 engineering sub-functions + founder + unknown) |
| **Specialty** | `person_experiences.specialty_normalized` + `people.current_specialty_normalized` | `specialty_dictionary` — 166 active, multi-parent (TEXT[]) under function |
| **Skills** | `person_experiences.skills[]` (sub-PR 4) | `skills_dictionary` — 14 rows today (migrations 069/070), grows via `/reference/skills/*.csv` |
| **Industry context** | derived per-experience from the company's `industries[]` / `domain_tags[]` | `companies` (migration 031 taxonomy) |
| **Title** | `person_experiences.title_raw` (exists today) + `title_normalized` (added in sub-PR 4) | LLM ingest inference (sub-PR 3) computes canonical title |

Recruiters search by ALL FIVE axes independently — a candidate whose function is `firmware_engineering` but whose title is "Senior Mechanical Engineer" should surface for BOTH `function=firmware` AND `title=mechanical` searches. The five axes are independent, additive dimensions.

### Function axis — 16 V1 engineering sub-functions (migration 071)

`software_engineering`, `firmware_engineering`, `mechanical_engineering`, `electrical_engineering`, `hardware_engineering`, `chip_engineering`, `systems_engineering`, `controls_engineering`, `robotics_engineering`, `aerospace_engineering`, `materials_engineering`, `manufacturing_engineering`, `test_engineering`, `optics_engineering`, `ml_engineering`, `data_engineering` — plus `founder` + `unknown` (= 18 active).

Inactive functions (V1 scope cut, kept in dictionary as FK targets): legacy `engineering` umbrella, `data_science`, `product`, `design`, `product_management`, `product_design`, `sales`, `marketing`, `operations`, `finance`, `legal`, `recruiting`, `people_hr`, `customer_success`, `research`, `communications`, `investing`, `consulting`. (= 18 inactive.)

**`engineering_leadership` is NOT a function.** Engineering managers / directors / VPs / CTOs sit at `function=<their discipline>` (the function they manage) + `seniority=manager|director|vp|c_suite` (migration 067). Leadership is the seniority axis, not function. Guard rail: migration 071 verification block fails loud if `engineering_leadership` ever exists as a function row.

### Specialty axis — multi-parent (`parent_function` is TEXT[])

`specialty_dictionary.parent_function` is `TEXT[]` post-migration 072. 35 of 166 active specialties carry a multi-parent array (~21%) where the discipline genuinely spans two or three categories. Examples:

- `mechatronics` → `[mechanical_engineering, electrical_engineering, controls_engineering]`
- `sensor_fusion` → `[robotics_engineering, ml_engineering]`
- `pcb_design` → `[electrical_engineering, hardware_engineering]`
- `embedded_hardware` → `[hardware_engineering, firmware_engineering]`
- `battery_engineering` → `[electrical_engineering, mechanical_engineering, hardware_engineering]`
- `industrial_engineering` → `[manufacturing_engineering, systems_engineering]`
- `automation_engineering` → `[manufacturing_engineering, controls_engineering]`

Single-parent for the rest. The "don't over-multi" rule: only flag multi where the cross is genuine for typical hiring; default to single where the specialty cleanly sits in one discipline.

### Why `specialty_dictionary.parent_function` has no FK constraint

PostgreSQL does not support multi-value foreign keys natively. Same pattern as `companies.industries[]` (migration 031) and `companies.domain_tags[]`. Array membership is enforced **at the application layer** in `scripts/sync-reference.mjs`, which validates that every element of `parent_function` exists in `function_dictionary.function_normalized` before applying CSV diffs.

**`parent_function` semantics: HINT not constraint.** The array is metadata that helps the sub-PR 3 LLM ingest inference pick a function for a given candidate's role — soft suggestion of "these are typical homes for this specialty." The LLM is free to assign any function from the active `function_dictionary` based on the candidate's actual work, not restricted to the parent array. Useful for fuzzy specialties whose typical home varies by company (e.g. `mechatronics` typical home depends on whether the team sits in EE org, ME org, or controls org).

### Title axis — added in sub-PR 4

`person_experiences.title_raw` already exists. Sub-PR 4 adds `title_normalized` (canonical / cleaned, e.g. "Sr Mech Eng" / "Senior Mechanical Engineer" / "Sr. Mech Eng" all collapse to "Senior Mechanical Engineer"). LLM ingest inference (sub-PR 3) computes `title_normalized` alongside the other four axes. Aggregated candidate-level columns: `people.current_title_normalized` + `people.ever_titles` (sub-PR 4).

No "title family" normalization dictionary layer needed — the function axis already groups by discipline more rigorously (grounded in actual work, not just title text). Title variants get handled at search time via expansion ("mechanical engineer" search expands to "Sr/Staff/Lead Mechanical Engineer" etc.).

### Scoring with the five axes (sub-PR 6, not yet shipped)

Intersection scoring per-role: `match × tenure_weight × recency_decay`. Tenure curve 30/70/90/100 (months 0-12-24-36+). Axis-specific recency decay: skills decay fastest, specialty slower, industry slowest. Title match contributes per-role alongside function/specialty/skills/industry. Context-aware skill multiplier (0.5× when subsequent role's specialty matches the skill's `primary_specialty`, 1.0× otherwise — see `skills_dictionary.primary_specialty`).

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

## Candidate Bucket Taxonomy (V1 — post-migrations 049, 058)

Collapsed from 5 values to 3 in migration 049. Migration 058 renamed `non_vetted` → `flagged` for clarity (the old name was ambiguous — could read as "not yet vetted").

| Bucket | Meaning | Who assigns | Default visibility |
|---|---|---|---|
| `vetted` | Score ≥ stage threshold AND no system flags | Scoring engine (auto) | Shown by default |
| `needs_review` | Default state for everything that isn't clean enough to be vetted — low score, has flags, or unknown_seniority. Still in the recruiter pool. | Scoring engine (auto) | Shown by default |
| `flagged` | Admin manually hid this candidate. Carries flagged_reasons[] explaining why. | Admin only — engine never assigns | **Hidden by default** unless admin explicitly selects "Flagged" in the bucket filter sidebar |

DO NOT add "rejected" or "excluded" to this taxonomy. That lives in `candidate_decision_state`. The dropped values (`vetted_talent`, `high_potential`, `silver_medalist`) were removed from the CHECK constraint in migration 049 along with the old `candidate_bucket_type` enum.

### Default-exclude behavior for `flagged`

Implemented in [app/components/ProfileTable.tsx](app/components/ProfileTable.tsx) `filteredPeople`: when the bucket filter sidebar selection is empty, `flagged` candidates are filtered out. Admin must explicitly select "Flagged" in the sidebar to see them. This is the canonical mechanism for "admin manual hide" — no separate query-level filter needed.

### flagged_reasons column (added in 049)

`candidate_bucket_assignments.flagged_reasons TEXT[]` carries system-computed flags. Bucket assignment uses this:

| Condition | Bucket | flagged_reasons |
|---|---|---|
| `highest_seniority_reached='unknown'` | needs_review | `['unknown_seniority', ...]` |
| Only contract/freelance employment | needs_review | `['contractor_only', ...]` |
| Avg tenure below half of penalty threshold | needs_review | `['job_hopping', ...]` |
| total_score < stage threshold | needs_review | `['low_score', ...]` |
| score ≥ threshold AND empty flags | **vetted** | `[]` |

Flags stack (a candidate can have all of unknown_seniority + low_score + job_hopping). Admin-managed concerns still live in `candidate_review_flags` (separate table) — flagged_reasons is system-computed only.

### Display labels (UI)

| Enum value | UI label |
|---|---|
| `vetted` | Vetted |
| `needs_review` | Needs Review |
| `flagged` | Flagged |

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
`unknown`(0) < `intern`(1) < `junior_ic`(2) < `individual_contributor`(3) < `senior_ic`(4) < `lead_ic`(5) < `founder`(6) < `manager`(7) < `executive`(8)

Deprecated aliases kept in the enum for backward compat: `student`(=intern), `lead`(=lead_ic).

Note: `junior_ic` was renamed from `entry` in migration 048. The rename was an `ALTER TYPE RENAME VALUE` — all enum-typed columns cascaded automatically. The user-facing label "Junior IC" lives in UI label maps.

Stored in `seniority_dictionary` with `rank_order` 0–8.

| Level | Meaning | Examples |
|---|---|---|
| `intern` | Internship, co-op, student worker | SWE Intern, Research Intern |
| `junior_ic` | Junior, associate, new grad | Associate Engineer, SDE I, Junior PM |
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

## Scoring Spec (V1 — post-migrations 049-055)

The engine lives at [lib/scoring/score-candidate.ts](lib/scoring/score-candidate.ts). Summary:

### Architecture: config-driven bonus, hardcoded core

- **CORE weights stay hardcoded** in [lib/scoring/score-candidate.ts](lib/scoring/score-candidate.ts) (`STAGE_CORE_WEIGHTS`, `RECRUITING_OVERRIDE_CORE`, `EXECUTIVE_OVERRIDE_CORE`). Per user decision in the V1 refactor: "no changes to existing core weight profiles."
- **BONUS weights are read from `signal_scoring_weights`** (migration 050, 104 rows). Keyed by `(category, tier_group, career_stage)`. Recruiters can tune via direct SQL without code deploys.
- **TEAM membership scoring** is read from `team_role_scoring_weights` (migration 051, 48 rows). When a `person_signals` row has `category=engineering_team`, lookup uses `(team_tier, team_role_tier, career_stage)` and applies the points directly — no multiplier math.
- **Bucket thresholds** are read from `career_stage_bucket_thresholds` (migration 052, 4 rows). Low by design (30/35/40/45) — curation at ingest is the real quality gate; the threshold is a safety net for curation accidents.

Each career stage still has three categories of signals:
- **CORE** — always evaluated, sum to ~100 points. Missing data → 0 for that component.
- **BONUS** — only adds points if the underlying data exists. Stacks on top of core, not capped at 100. Sourced from signal_scoring_weights config + person_signals_active rows.
- **PENALTY** — only in mid/senior; scales with how far the candidate's average tenure is below the threshold. Also fires the `job_hopping` flag when avg tenure < threshold/2.

### Core weights by stage (unchanged from prior V1)

**Pre-career (0–0.49 yrs)** — Core: education 30, degree_relevance 30, internships 40

**Early career (0.5–1.99 yrs)** — Core: company_quality_recent 40, education 25, degree_relevance 25, internships 10

**Mid career (2–4.99 yrs)** — Core: company_quality_recent 60, company_quality_average 10, education 15, degree_relevance 15. Penalty: avg tenure < 12 mo → deduct up to 20 pts (linear).

**Senior career (5+ yrs)** — Core: company_quality_recent 60, company_quality_average 30, education 5, degree_relevance 5. Penalty: avg tenure < 18 mo → deduct up to 30 pts (linear).

### Bonus categories (from signal_scoring_weights)

Tiered (3 tiers × 4 stages): `olympiad`, `fellowship`, `incubator`, `national_lab`, `hackathon`, `publication`. Pre/early get same values; mid ≈ 60% taper; senior ≈ 40% taper (except publication which stays higher because cumulative).

Flat (no tier): `patent`, `former_founder` (reads `people.is_former_founder`), `open_source` (placeholder — no data source yet), `growth_stage_tenure` (placeholder), `career_slope` (reads `people.title_level_slope='rising'`), `company_quality_slope` (PLACEHOLDER — bonus weight wired but computation deferred), `biz_unit` (placeholder), `company_function_quality` (reads `company_function_scores` with overall-score fallback).

### Signal definitions (core)

- **company_quality_recent** — avg `company_year_scores.company_score` over the years worked at the most recent full-time role. Not in scored set → 0. Normalized /5.
- **company_quality_average** — same avg across *all* full-time roles. Not in scored set → treated as 0. Normalized /5.
- **education** — max `schools.school_score` across the candidate's education entries, with lookups going `schools.school_name` → `school_aliases.alias_name` → no match → 0. Normalized /4.
- **degree_relevance** — dictionary lookup by function (see below). Normalized /1.
- **internships** — avg `company_year_scores.company_score` across all internship experiences. Normalized /5.

### Signal-driven bonus loop

For each `person_signals_active` row:
- If `category=engineering_team`: look up `team_role_scoring_weights[team_tier, team_role_tier ?? 1, stage]` (NULL role_tier treated as Member tier 1).
- Else: look up `signal_scoring_weights[category, tier_group, stage]`. NULL tier_group hits the flat row.
- Points summed per category for the breakdown chip ("3 signal(s)" pattern in the score_breakdown UI).

Synthetic bonus signals (not from person_signals): `career_slope` reads `people.title_level_slope='rising'`, `former_founder` reads `people.is_former_founder`, `company_function_quality` reads `company_function_scores`. All three read their points value from signal_scoring_weights but pull truth from the relevant column rather than person_signals.

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
- `manager` / `founder` → 0.7
- `lead_ic` / `lead` → 0.5
- `senior_ic` → 0.4
- `individual_contributor` → 0.3
- `junior_ic` / `entry` → 0.2
- `intern` / `student` → 0.1
- anything else → 0

### Bucket assignment (V1 model — only `vetted` or `needs_review` ever auto-assigned; `flagged` is admin-only)

Thresholds come from `career_stage_bucket_thresholds` table (migration 052):

| Stage | vetted threshold |
|---|---|
| pre_career | ≥ 30 |
| early_career | ≥ 35 |
| mid_career | ≥ 40 |
| senior_career | ≥ 45 |

Thresholds are **intentionally low** — curation at ingest is the real quality gate. The threshold is a safety net for curation accidents (e.g., a junk profile slipping through).

Bucket logic (in order):
1. Build `flagged_reasons` array from: `unknown_seniority`, `contractor_only`, `job_hopping`, `low_score`.
2. If `flagged_reasons` is empty → bucket = `vetted`.
3. Else → bucket = `needs_review` (with the flags array attached).
4. `flagged` is never auto-assigned — admin-only via POST `/api/admin/bucket/[person_id]`. Default-excluded from the candidate list view.

Final bucket + flagged_reasons + full score_breakdown JSONB are written to `candidate_bucket_assignments`.

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
| `is_current_founder` | boolean | TRUE if any `is_current=true` experience has a founder-titled role (matches `/\b(co-?)?founder\b/i` OR `seniority_normalized='founder'`). **Default search excludes these candidates** per V1 spec — active founders aren't recruitable. Filter at [app/components/ProfileTable.tsx](app/components/ProfileTable.tsx) `filteredPeople`. Opt-in toggle is in backlog. |
| `is_former_founder` | boolean | TRUE if any past founder-titled experience exists AND `is_current_founder=FALSE` (mutually exclusive by spec). Surfaces as positive-signal chip on profile page. Also drives `former_founder` bonus weight from `signal_scoring_weights` (20 / 20 / 15 / 12 pts by stage). |

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

## Database: Final Schema State (after migrations 001–079; 075–078 dev-only/PR #10-pending)

**Migration ledger** (full per-migration descriptions live in `supabase/migrations/*.sql` headers):
- 001 — Phase 1 normalized schema + enums
- 002 — dictionary seeds (functions, specialties, titles, degrees, employment types)
- 003 — bucket taxonomy + school_score + is_foreign
- 004 — school_aliases + people derived columns + companies.founding_year
- 005 — 6-value seniority enum + seniority_rules table (later expanded to 9 active in 006)
- 006–015 — incremental signal/specialty/seniority/title-level work (see migration headers)
- 016 — `company_focus_type` enum + `companies.focus` + clearance_level on people *(focus replaced in 031)*
- 017 — role_dictionary (26) + role_specialty_map + ~165 new specialties
- 018 — RLS policies on role tables
- 019 — `companies.funding_stage` + `companies.headcount_range` (text columns)
- 020–021 — specialty signal columns + 130k-row signal seeds
- 022–025 — signals_schema, signal_dictionary tier/group/competition + seeds
- 026 — education text fields on `person_education`
- 027 — school_groups + company_groups + 14 top law firms
- 028 — `raw_ingest_events` archive (see "Raw Ingest Archive" section)
- 029 — `crust_import_log` audit table (see "Crust Import Audit Log" section)
- 030 — `person_experiences.is_primary_current` + partial index (see "Primary-Current Disambiguation" section)
- 031 — Companies V1 taxonomy: `category` + `primary_industry` + `industries[]` + `domain_tags[]` + `review_status` + tagger provenance (see "Companies V1 Taxonomy" section)
- 032 — `companies_tag_spend_log` for daily cron cap (see "Auto-Tagging Cron + Spend Cap" section)
- 033 — funding scalars on companies + `company_funding_rounds` table (see "Funding & Investors" section)
- 034 — disable RLS on admin tables created in 032/033 (Supabase auto-enables; pattern repeated several times — see Development Rules)
- 035 — firmographics: description, logo_permalink, locations JSONB, founders JSONB, headcount growth %s + timeseries (see "Firmographics" section)
- 036 — `investor_tiers` table + tier 1/tier 2 seed from curated CSV (see "Investor Tiers" section)
- 037 — disable RLS on `investor_tiers`
- 038 — `lists` + `list_items` + `saved_searches` + `hidden_items` (see "Lists, Saved Searches, Hidden Items" section)
- 039 — disable RLS on the four tables from 038
- 040 — competitions + teams + team_competition_map + team_domain_tag_dictionary + person_signals.team_role_tier/_text; signal_dictionary CHECK extended with `olympiad` and `national_lab` (see "Competitions, Teams, Hard-Tech Signals" section)
- 041 — disable RLS on the four tables from 040
- 042 — reclassify 23 existing `engineering_team` rows to `category='competition'`; ACM ICPC DO-block auto-handle (delete or rename based on `person_signals` count)
- 043 — seed signal_dictionary with `olympiad` (17), `national_lab` (24), and military/patent/publication tags (12; 3 clearance rows dropped — clearance lives on `people.clearance_level`)
- 044 — seed signal_dictionary with hackathons (24), conferences/journals (49), fellowships (45 UPSERT MERGE)
- 045 — 10 new `competition` signal_dictionary rows + 21 `competitions` rows seeded (CTE-based slug→signal_id resolution; fails loud on NULL signal_id)
- 046 — marker only; data load via `scripts/import-teams.mjs` (141 teams + 142 team_competition_map rows + 17 domain tags)
- 047 — extended `person_signals_active` view with team + competition metadata via LATERAL subquery (no row multiplication when a team competes in multiple competitions)
- 048 — `ALTER TYPE seniority_level RENAME VALUE 'entry' → 'junior_ic'` (enum cascade — all enum-typed columns auto-migrated); signal_dictionary CHECK extended with `incubator` category (see "Scoring Spec" + "Seniority System")
- 049 — bucket schema swap: dropped `candidate_bucket_type` enum, replaced with TEXT + CHECK (`vetted`, `non_vetted`, `needs_review`); added `flagged_reasons TEXT[]` + GIN partial index; TRUNCATE'd existing bucket assignments (no audit value once model changed). See "Candidate Bucket Taxonomy" section.
- 050 — `signal_scoring_weights` config table (104 rows: 6 tiered × 4 stages × 3 tiers + 8 flat × 4 stages). Read by scoring engine, mutable without code deploy. See "Scoring Spec" section.
- 051 — `team_role_scoring_weights` config table (48 rows: 3 team_tiers × 4 role_tiers × 4 career_stages). Direct point lookup for engineering_team signals.
- 052 — `career_stage_bucket_thresholds` config table (4 rows: pre=30, early=35, mid=40, senior=45). Low by design — curation at ingest is the real gate.
- 053 — disable RLS on the 3 config tables from 050-052
- 054 — reclassify 7 fellowship rows → category='incubator' (YC, EF, Antler, CDL, SPC, Pioneer, On Deck with tier adjustments); seed 38 new incubator entries (Techstars, Neo, HF0, AI Grant, In-Q-Tel, DIU, AFWERX, etc.)
- 055 — `people.is_current_founder` + `is_former_founder` BOOLEAN columns + partial indexes. Computed by `computeAndWriteDerivedFields()` via `/\b(co-?)?founder\b/i` title match or `seniority_normalized='founder'`. Mutually exclusive by definition.
- 058 — rename `candidate_bucket` value `non_vetted` → `flagged`. CHECK constraint updated to `(vetted, needs_review, flagged)`. Same admin-only semantic; clearer name. Default UI behavior: flagged candidates excluded from main list unless admin explicitly selects them. Numbered 058 (skipping 056/057) to avoid collision with the parallel sourcing-pipeline workstream on `sourcing-pipeline-phase1` branch.
- 059 — fix `seniority_dictionary` rank ordering: founder bumped from rank 6 → 8 (now the highest active rank); manager 7→6; executive 8→7. Locked spec: `intern(1) < junior_ic(2) < individual_contributor(3) < senior_ic(4) < lead_ic(5) < manager(6) < executive(7) < founder(8)`. Affects `highest_seniority_reached` derivation; scoring engine's executive override is gated on `=executive` and is unaffected.
- 060 — extend `signal_dictionary.category` CHECK with **6 net-new categories** for university-affiliated and research-org signal coverage: `university_program`, `university_fellowship`, `university_incubator_accelerator`, `university_lab`, `research_institute`, `student_venture_fund`. Total: 31 categories in CHECK constraint. Data load via `scripts/sync-reference.mjs` from `/reference/signals/*.csv`.
- 061 — add `investor_tiers.investor_type` column (`vc_firm` / `angel`, default `vc_firm`) so VC firms and individual angels coexist with a clear distinction. Existing rows defaulted to `vc_firm`; sync from `/reference/investors/investor_tiers.csv` corrected the 19 rows that should be `angel` (kept from older `kind='angel'` tagging) and seeded 7 new angels (Alana Goyal, Charlie Cheever, Daniel Gross, Jack Altman, Mike Vernal, Sahil Lavingia, Sriram Krishnan).
- 062 — add `signal_dictionary.is_searchable BOOLEAN DEFAULT TRUE` column + cleanup pass on dictionary entries (30 Under 30 removal, naming cleanups). Wired into UI filter dropdown so individual signals can be flagged out of the searchable set without deletion. (Universal one-bucket policy in 063 then flips ALL rows to FALSE.)
- 063 — universal one-bucket filter policy: `UPDATE signal_dictionary SET is_searchable = FALSE` on all rows. Only categories surface as UI filters today; granular per-signal search deferred to AI chat workstream. Added `people.is_vc_backed_founder` + `is_bootstrapped_founder` BOOLEAN columns with partial indexes. Dropped Side Project Founder from signal_dictionary (founder category 4 → 3 rows). VC-backed gated on: funding rounds OR recorded investors OR linked incubator/accelerator signal OR `current_status IN ('acquired','public')`; bootstrapped is the default for founders. Auto-reclassifies on rescore via `computeAndWriteDerivedFields()`. Backfill yields 0 VC-backed / 21 bootstrapped today (data-quality gap — see CHANGELOG 2026-05-25 watch-out).
- 064 — seeded `field_of_study_dictionary` with 86 rows → 43 distinct `field_of_study_normalized` values across 7 domain groups: core_engineering, advanced_engineering, software_cs, physical_sciences, life_sciences, math, design. Aliases include EECS→ECE, Mech E→Mechanical Engineering, CS→Computer Science, AI/ML→`artificial_intelligence_ml`, Life Sciences catch-all (biology/biochem/microbiology/genetics roll up), comp-bio/bioinformatics together, neuroscience kept distinct. Wired as multi-select in FilterSidebar + search-builder. Backfill populated 22 `person_education` rows (sparse `field_of_study_raw` coverage on existing base).
- 065 — sourcing-pipeline phase 1 schema (PR #4). New tables: `sources`, `source_roster_entries`, `source_runs`, related provenance columns. Schema only — no behavior wired yet.
- 066 — disable RLS on tables created in 065 (Supabase auto-enables pattern; see Development Rules).
- 067 — split `seniority_level.executive` into three distinct enum values: `director`, `vp`, `c_suite` (PR #5). Regex classification of existing executive-tier rows; bain/mckinsey partner held back as legacy `executive`. Affects seniority_rules. Director/VP/C-suite are the leadership axis — engineering managers / leaders sit at `function=<discipline>` + `seniority=director|vp|c_suite`, NOT at a separate `engineering_leadership` function.
- 068 — `people.slope_score INTEGER` column (PR #6) — continuous candidate slope score replacing the binary `title_level_slope='rising'` gate. Computed by `computeAndWriteDerivedFields()` from per-experience title_level trajectory. Wired into `signal_scoring_weights` lookup for the career_slope bonus.
- 069 — `skills_dictionary` table (PR #8, sub-PR 2a of taxonomy rebuild). UUID PK, UNIQUE canonical_name, CHECK-constrained category (7 values: programming_language / framework / protocol / tool / domain / hardware / methodology), aliases TEXT[] GIN-indexed, primary_specialty TEXT[] for context-aware skill decay multiplier, is_active, is_searchable. Seeded via `/reference/skills/*.csv` through `scripts/sync-reference.mjs`. Skill rows: 14 today, grows via CSV edits.
- 070 — disable RLS on `skills_dictionary` (auto-enable pattern).
- 071 — `function_dictionary` expansion to 16 active engineering sub-functions (PR [#9](https://github.com/mktahr/vetted/pull/9), sub-PR 2b — **merged + prod-applied 2026-06-21**). Active: software_engineering, firmware_engineering, mechanical_engineering, electrical_engineering, hardware_engineering, chip_engineering, systems_engineering, controls_engineering, robotics_engineering, aerospace_engineering, materials_engineering, manufacturing_engineering, test_engineering, optics_engineering, ml_engineering, data_engineering + founder + unknown (=18 active). 2 new INACTIVE rows (product_management, product_design — rebranded targets for future scope). 16 LEGACY V1-scope-cut deactivations. Net: 18 active / 18 inactive / 36 total. `engineering_leadership` explicitly NOT a function — verification block fails loud on reintroduction. See "Five-Axis Taxonomy" section.
- 072 — `specialty_dictionary` multi-parent restructure (PR [#9](https://github.com/mktahr/vetted/pull/9), sub-PR 2b — **merged + prod-applied 2026-06-21**; prod verified 225 / 166 / 59 / 45 multi-parent, 0 invalid parent refs, catchall a no-op on prod as predicted). Drops single-value FK on parent_function. Converts `parent_function` from TEXT to TEXT[] (multi-parent array, GIN-indexed). Deletes 4 title-like specialties (chief_engineer, distinguished_engineer, engineering_management, principal_engineer) + 1 redundant (data_engineering — function takes its place). Reparents 137 engineering-parented + 20 NULL-parented active + 5 redline legacy non-eng specialties under the new 16 sub-functions. 45 multi-parent assignments where the discipline genuinely spans categories (mechatronics → [mechanical, electrical, controls]; sensor_fusion → [robotics, ml]; battery_engineering → [electrical, mechanical, hardware]; etc.). 59 V1-scope-cut deactivations. Defensive catchall sweeps specialties with all-inactive parents (no-op on prod, sweeps 12 dev-only legacy ghost rows). Portable verification block (delta + structural invariants) works across dev/prod where pre-migration row counts differ. App-layer enforcement of array-element validity lives in `scripts/sync-reference.mjs` — Postgres lacks native multi-value FK. Final: 225 total / 166 active / 59 inactive on prod (dev: 202/156/46 due to dev-only ghost rows). See "Five-Axis Taxonomy" section.
- 073 — `person_experiences` + `people` reclassification (PR [#9](https://github.com/mktahr/vetted/pull/9), sub-PR 2b — **merged + prod-applied 2026-06-21**; prod verified 0 orphan refs remaining, 6 rows lifted to `function='data_engineering'`, 1 lone `engineering` row left for sub-PR 3). UPDATEs `function_normalized` via JOIN to specialty_dictionary.parent_function[1] for single-parent active specialties. Multi-parent specialty rows stay at `function='engineering'` per option (b) — sub-PR 3 LLM ingest inference reclassifies per-candidate based on actual title/description/skills. Orphan cleanup for 5 deleted specialty refs: 4 title-like → specialty=NULL; data_engineering → specialty=NULL + function=`'data_engineering'` (signal lifted from specialty axis to function axis). Recomputes `people.current_function_normalized` from primary current experience using same priority order as ingest route (is_primary_current → first non-student-titled → first with title → first by start_date desc).
- 074 — `title_dictionary` function remap (PR [#9](https://github.com/mktahr/vetted/pull/9), sub-PR 2b — **merged + prod-applied 2026-06-21**; prod verified 7 leadership@`engineering` / 28 `software_engineering` / 1 `data_engineering`). Followed by a full prod rescore via `/api/admin/rescore-all` (84/84, bucket distribution unchanged vetted 49 / needs_review 35). Cohort A (20 rows with single-parent active specialty) reclassified via JOIN. Cohort B leadership titles (7 rows: CTO / chief technology officer / director of engineering / em / engineering manager / vp engineering / vp of engineering) intentionally left at `function='engineering'` (legacy inactive umbrella) — defaulting to software_engineering would destroy information in hard-tech context; sub-PR 3 LLM reclassifies per-candidate. Cohort B explicit IC titles (10 rows: senior software engineer, principal software engineer, swe, mobile engineer, etc.) → software_engineering. Orphan specialty cleanup mirrors 073 pattern (data engineer title row → function=`'data_engineering'`).
- 075–078 — **reserved by the open Network Connections module (PR [#10](https://github.com/mktahr/vetted/pull/10), not yet merged).** Applied + verified on dev only; NOT on prod. 075 = 7 network tables; 076 = RLS-off; 077 = `crust_import_log.request_kind` CHECK += `network_enrich`; 078 = additive LLM-triage columns on `connections`. See SESSION_HANDOFF for status.
- 079 — drop orphan `specialty_dictionary.function_normalized` column (PR [#12](https://github.com/mktahr/vetted/pull/12) — **merged + prod-applied 2026-06-24**). The column was never created by any migration (001 made the column `parent_function`; 072 → `TEXT[]`); it survived only on prod as an out-of-band orphan holding stale pre-rebuild umbrella values (`engineering`/`operations`), causing dev/prod drift that threw `400` on dev (`loadSpecialtyDictionary()`). Paired with a code fix: `lib/normalize/specialty.ts::loadSpecialtyDictionary()` now reads `parent_function` and derives the scalar function via the single-parent rule (single → `parent_function[0]`; multi → `null`, deferred to sub-PR 3 LLM) — mirrors migration 073's reclassification logic. `DROP COLUMN IF EXISTS` → drops on prod, no-op on dev. Both DBs now converge on the migration-defined schema. Lockstep held: B-lite code deployed to prod first, then column dropped.

The "Normalized tables" / "Dictionary tables" lists below describe the post-migration state. They name the most-used columns; consult the actual schema for exhaustive column lists.

### Enums
- `seniority_level` (9 active + 2 deprecated): `unknown`, `intern`, `junior_ic`, `individual_contributor`, `senior_ic`, `lead_ic`, `founder`, `manager`, `executive` (+ deprecated `student`, `lead`)
- `candidate_bucket_type` — **DROPPED in migration 049**. `candidate_bucket_assignments.candidate_bucket` is now TEXT with CHECK constraint (`vetted`, `needs_review`, `flagged`) — `non_vetted` was renamed to `flagged` in migration 056.
- `degree_level_type`: high_school, associate, bachelor, master, mba, phd, jd, md, certificate, coursework, other
- `employment_type_norm`: full_time, contract, part_time, internship, freelance, advisory, board, unknown
- `career_stage_type`: pre_career, early_career, mid_career, senior_career
- `company_bucket_type`: static_mature, high_bar_tech, growth_startup, emerging_startup
- `company_status_type`: active, acquired, public, shut_down
- `review_flag_status_type` / `review_flag_severity_type` / `decision_state_type`

### Normalized tables
- **`people`** — person_id PK, full_name, linkedin_url UNIQUE, location_name, headline_raw, summary_raw, current_company_id, current_title_raw, current_title_normalized, current_function_normalized, years_experience_estimate, career_stage_assigned, career_stage_override, legacy_profile_id, **career_progression, highest_seniority_reached, has_early_stage_experience, early_stage_companies_count, has_hypergrowth_experience, hypergrowth_companies_count, is_current_founder, is_former_founder** (derived fields)
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
- `function_dictionary` — 36 rows post-migration 071 (18 active + 18 inactive). Active: 16 V1 engineering sub-functions (software_engineering, firmware_engineering, mechanical_engineering, electrical_engineering, hardware_engineering, chip_engineering, systems_engineering, controls_engineering, robotics_engineering, aerospace_engineering, materials_engineering, manufacturing_engineering, test_engineering, optics_engineering, ml_engineering, data_engineering) + founder + unknown. Inactive (V1 scope cut): engineering (legacy umbrella), data_science, product, design, product_management, product_design, sales, marketing, operations, finance, legal, recruiting, people_hr, customer_success, research, communications, investing, consulting. `engineering_leadership` is NOT a function — engineering managers / directors / VPs / CTOs sit at function=<their discipline> + seniority=manager|director|vp|c_suite (migration 067). See "Five-Axis Taxonomy" section.
- `specialty_dictionary` — 225 rows post-migration 072 (166 active + 59 inactive). `parent_function` is `TEXT[]` (multi-parent array, GIN-indexed). 45 of 166 active specialties have multi-parent assignments where the discipline genuinely spans two or three categories (e.g. `mechatronics` → [mechanical, electrical, controls]; `sensor_fusion` → [robotics, ml]; `pcb_design` → [electrical, hardware]; `battery_engineering` → [electrical, mechanical, hardware]). No FK constraint on `parent_function` — see "Five-Axis Taxonomy" section for the no-FK rationale.
- `title_dictionary` — ~175 patterns, populated by migration 002 + `scripts/seed-recruiting-titles.mjs` (16 recruiting titles). **Stores title_normalized + function_normalized + specialty_normalized + confidence only — seniority comes from `seniority_rules`.**
- `employment_type_dictionary` — 20 patterns (full-time, contract, freelance, part-time, internship, board, advisory variants)
- `degree_dictionary` — 32 patterns (BS, BA, MS, MA, MBA, PhD, JD, MD, Certificate, Bootcamp, Coursework, etc.)
- `field_of_study_dictionary` — 86 rows → 43 normalized values (seeded migration 064). Domain groups: core_engineering, advanced_engineering, software_cs, physical_sciences, life_sciences, math, design.
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
├── supabase/migrations/                         ← see "Database: Final Schema State" for full migration set 001–079
├── supabase/seeds/                              ← DEPRECATED post-migration 060. Source of truth is now /reference/. README.md is a deprecation pointer; legacy CSVs (olympiads_signals, national_labs_signals, tags_signals, hackathons_signals, conferences_signals, fellowships_signals, vetted_competitions, vetted_teams) live on for historical replay only.
│
├── app/                                         ← Next.js 14 App Router
│   ├── page.tsx                                 ← "/" renders ProfileTable
│   ├── layout.tsx                               ← renders <GlobalNav /> + {children}
│   ├── types.ts                                 ← Person, Experience, Education, Company, BucketAssignment, etc.
│   ├── design-system.css                        ← color/scale/spacing tokens; ⚠ global a + a:hover rules — see "Global Nav" section
│   ├── components/
│   │   ├── GlobalNav.tsx                        ← persistent app bar (rendered once in layout.tsx); inline-styled nav links + portaled Import dropdown
│   │   ├── ProfileTable.tsx                     ← main people table + faceted filters + search + bucket chips
│   │   ├── ProfileDrawer.tsx                    ← row-click side drawer with bucket + score reasoning
│   │   ├── FilterSidebar.tsx                    ← sidebar filter pane shared with /search-builder
│   │   ├── CompanyLogo.tsx                      ← logo_permalink (Crust) → logo.dev → initial-letter placeholder
│   │   ├── AddToListMenu.tsx                    ← portal-rendered "+ list" popover with checkboxes + inline create
│   │   ├── ThemeToggle.tsx                      ← light/dark/ember toggle
│   │   ├── MultiSelect.tsx                      ← shared multi-select widget used across filter UIs
│   │   └── condition-rows/                      ← compound where-they-worked / where-they-studied filter UI
│   ├── profile/[id]/page.tsx                    ← "/profile/[id]" detail page (max-width 900)
│   ├── search-builder/page.tsx                  ← "/search-builder" — full-page filter UI sharing FilterSidebar
│   ├── lists/
│   │   ├── page.tsx                             ← "/lists" — browse all lists, two columns (candidate / company)
│   │   └── [id]/page.tsx                        ← list detail with multi-select + bulk actions
│   ├── admin/
│   │   ├── companies/
│   │   │   ├── page.tsx                         ← "/admin/companies" list + filters + sort + bulk-edit
│   │   │   ├── [id]/page.tsx                    ← edit company + funding + investors + firmographics + per-year scores
│   │   │   ├── new/page.tsx                     ← create company form (V1 taxonomy: category gates industries)
│   │   │   └── triage/page.tsx                  ← "/admin/companies/triage" — review_status='unreviewed' queue
│   │   ├── import/
│   │   │   ├── page.tsx                         ← "/admin/import" — Crust v2 candidate filter-builder + NDJSON streaming
│   │   │   ├── companies/page.tsx               ← "/admin/import/companies" — single-company import with Crust identify + enrich
│   │   │   └── components/                      ← AutocompleteSelect / CompanyMultiSelect / RangeInput / InfoTooltip
│   │   └── seed/page.tsx                        ← "/admin/seed" — 3 hardcoded test payloads for smoke tests
│   └── api/
│       ├── ingest/route.ts                      ← POST /api/ingest (Chrome ext + admin/import target; raw archive + upsert + score)
│       ├── people/[id]/{route.ts,narrative/route.ts}  ← person detail + AI narrative (Claude Haiku)
│       └── admin/
│           ├── crust-import/                    ← Crust v2 candidate import endpoints
│           │   ├── preview/route.ts             ← POST /api/admin/crust-import/preview
│           │   ├── run/route.ts                 ← POST /api/admin/crust-import/run (streaming NDJSON)
│           │   └── autocomplete/route.ts        ← free Crust autocomplete proxy
│           ├── companies-import/                ← Crust company import (single-row)
│           │   ├── identify/route.ts            ← POST — entity resolution via /company/identify (FREE)
│           │   ├── single/route.ts              ← POST — full single-company import: identify + enrich + tag + write
│           │   └── autocomplete/route.ts        ← free Crust company-autocomplete proxy
│           ├── companies/
│           │   ├── tag-pending/route.ts         ← cron entry point — tag up to N companies/day (spend-capped)
│           │   └── [id]/
│           │       ├── tag/route.ts             ← "Tag now" button on company detail
│           │       └── re-enrich/route.ts       ← refresh Crust firmographics + funding without re-tagging
│           ├── bucket/[person_id]/route.ts      ← admin bucket override: POST {bucket, flagged_reasons, reason} → new candidate_bucket_assignments row with assigned_by='admin'
│           └── rescore-all/route.ts             ← admin-only batch re-score endpoint for candidates
│
├── lib/
│   ├── supabase.ts                              ← browser Supabase client + fetchAllRows() pagination helper
│   ├── normalize/                               ← title / degree / employment / seniority / specialty resolvers
│   ├── scoring/                                 ← scoreCandidate(), writeBucketAssignment(), computeAndWriteDerivedFields()
│   ├── tenure/                                  ← FT classification + company-stretch tenure (see "Tenure Helper" below)
│   ├── education/                               ← display-only education filter (see "Education Display Filter" below)
│   ├── signals/                                 ← processCandidateSignals() (publications, fellowships, etc. — empty data, weights wired)
│   ├── ai/
│   │   └── narrative.ts                         ← Claude Haiku 4.5 narrative summary (direct fetch, ANTHROPIC_API_KEY)
│   ├── companies/
│   │   ├── taxonomy.ts                          ← V1 category/industry/domain-tag vocabulary (HARDWARE_INDUSTRIES, NON_HARDWARE_INDUSTRIES, etc.)
│   │   ├── tagger/                              ← Claude Haiku company auto-tagger
│   │   │   ├── claude.ts                        ← LLM call (single-shot classification)
│   │   │   ├── dictionary.ts                    ← industry/tag vocabulary used in the prompt
│   │   │   ├── index.ts                         ← tagCompany(): increment spend log + write to companies
│   │   │   └── types.ts
│   │   ├── funding.ts                           ← pickLatestMeaningfulRound() + toInvestorArray() + Crust funding mappers
│   │   ├── firmographics.ts                     ← parsers + writers for description/logo/locations/founders/headcount
│   │   ├── investor-tiers.ts                    ← getNotableInvestors() + companyHasTier() helpers (reads investor_tiers)
│   │   └── year-scores.ts                       ← founding_year auto-fill helper
│   ├── lists/
│   │   └── api.ts                               ← fetchLists/addToList/removeFromList/createList/renameList/deleteList/listsContaining
│   ├── crust/                                   ← Crust v2 API client + filter builder + audit log
│   │   ├── types.ts                             ← UIFilterState + AUTOCOMPLETE_FIELDS map + EMPTY/INITIAL_FILTERS + HARD_VOLUME_CAP
│   │   ├── api.ts                               ← v2 API client (fetchPersonSearch, fetchAutocomplete, identify, enrich) + Bearer auth
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
    ├── import-teams.mjs                         ← reads supabase/seeds/vetted_teams.csv; idempotent UPSERT to teams + team_competition_map + signal_dictionary; --dry-run flag prints unmatched schools
    ├── seed-national-labs-company-group.mjs     ← links 24 national lab companies (when present in companies table) to a "US National Labs" company_groups row; re-runnable as new lab companies land
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

## Backlog → moved out of this file

The backlog content that used to live here has been split into separate docs:
- **Sequenced upcoming work + recently completed** → [ROADMAP.md](ROADMAP.md)
- **Major deferred features (>0.5 day to scope/build)** → [BACKLOG.md](BACKLOG.md)
- **Small fixes (<0.5 day each)** → [BUGS.md](BUGS.md)

This file (CLAUDE.md) keeps only engineering context: architecture, schema, scoring spec, migration ledger, hard rules, file layout, design rules, bucket taxonomy, derived fields, development rules.

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

### End-of-session docs update — MUST DO

Before wrapping a session that shipped any feature, migration, or architectural change, update CLAUDE.md + CHANGELOG.md + ROADMAP.md so the next Claude session starts with accurate ground truth. The full procedure (trigger phrase `end session`, alias `wrap session`, the 12 steps, the next-session starter-prompt template) lives in the "End-of-Session Protocol" section near the bottom of this file.

A stale CLAUDE.md is worse than a short one — future sessions read it as authoritative.

### Supabase RLS auto-enables on `CREATE TABLE`

When you create a table — even with `DISABLE ROW LEVEL SECURITY` in the same migration / transaction — Supabase re-enables RLS afterward. The fix pattern (hit on 034, 037, 039, plus earlier) is a SEPARATE follow-up migration containing only `ALTER TABLE … DISABLE ROW LEVEL SECURITY` for the new tables. Don't try to do it inline; it doesn't stick.

If a migration creates admin tables and you forget the follow-up, your reads will silently return empty result sets even with the service-role key (because RLS-on + no policies = no rows visible).

### Dev/prod Supabase split — workflow (live as of 2026-06-01)

Two Supabase projects: **prod** (the original, serving `vetted-self.vercel.app`) and **dev** (free-tier, used for migration testing only — data layer stays empty). Migrations land on dev first, get verified, then apply to prod.

**Env var convention** (in `.env.local`):
- App code reads prod vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
- Scripts read dev vars when targeting dev: same names + `_DEV` suffix (`DATABASE_URL_DEV`, etc.)
- Vercel env (production) untouched — only has the prod vars.

**Workflow for any new migration:**
```bash
# Always apply to dev first:
npm run migrate:dev -- supabase/migrations/0NN_filename.sql

# Verify on dev (psql query, app behavior in dev mode, etc.)

# Then apply to prod:
npm run migrate:prod -- supabase/migrations/0NN_filename.sql
```

Both commands wrap `scripts/apply-migration.sh` which uses `psql -v ON_ERROR_STOP=1`. A failure on dev halts before prod ever gets the change.

**Non-additive migrations MUST go through dev first** — any FK constraint addition referencing an existing table, any column modification on an existing table (rename, retype, drop, NOT NULL flip), any data migration on existing rows, any RLS change on a previously-existing table. Purely additive migrations (`CREATE TABLE` for new tables, `ADD COLUMN` nullable, `INSERT` seeds, `CHECK` constraint extensions, `ALTER TABLE … DISABLE RLS` on same-workstream tables) can technically go straight to prod but the workflow above applies them to both anyway for consistency.

**Fresh dev DB bootstrap** (one-time, already done for current dev project):
```bash
./scripts/replay-migrations-to-dev.sh
```

This applies all migrations in order against an empty dev DB. **Known caveats** observed during the initial 2026-06-01 replay — keep in mind if/when re-bootstrapping a new dev project:
- Migration 027 contains `INSERT INTO school_aliases` statements with hardcoded school UUIDs from prod's seed data. On empty dev, these FK to non-existent schools and fail. The migration's earlier statements (ALTER TABLE, INSERTs of military academies + their aliases) apply cleanly before the failure, so the SCHEMA part of 027 is correct on dev; only the prod-UUID-dependent alias rows are absent.
- Migrations 062 and 063 contain verification DO blocks (`RAISE EXCEPTION IF count != expected`) that fail on empty dev because they assume prod's seed data exists. The whole migration rolls back, dropping the schema columns it would have added (`is_searchable`, `is_vc_backed_founder`, `is_bootstrapped_founder`). One-off catchup is at `scripts/_dev-catchup-062-063.sql` (schema-only, no verification, idempotent).
- Migrations 056 / 057 don't exist (numbers reserved during the sourcing-pipeline workstream and ultimately renumbered to 065/066 — see migration ledger).

**Going-forward rule for new migrations:** avoid hardcoded UUIDs from prod data; verification DO blocks must be tolerant of empty DBs (e.g., check schema-level invariants, not specific row counts). Otherwise future re-bootstraps of dev will hit the same friction.

**What lives on dev today:** schema only. No reference data (no schools, companies, signal_dictionary entries, etc.). Per Rule 6 (Data State During Build Phase), sparse dev data is expected and not a blocker. If a future migration needs reference data to validate, seed it on dev manually via the existing seed scripts (which currently target prod by default — env-awareness of seed scripts is a follow-up).

### Don't propose options the user has explicitly rejected

When an approach fails or needs revision, do NOT silently fall back to an option the user already turned down earlier in the same workstream. Reread the conversation, identify the rejected option, and find a third path. (Incident: 2026-05-05, candidate name hover — user rejected underline in favor of subtle accent; when accent failed I retreated to underline.)

### Open questions get a recommendation, not an action

When the user asks "is X better than Y?" / "should we do Z?", they want reasoning + a recommendation in text, NOT an immediate code change. Pulling the trigger pre-empts the conversation. Wait for explicit "do it" / "go ahead" before executing. (Incident: 2026-05-05, profile page max-width — user asked an open question, I bumped the value without giving a recommendation first.)

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

---

## Funding & Investors (Post-Migration 033)

Captures company funding totals and per-round investor data from Crust enrich.

### Scalars on `companies`

- `total_funding_usd` — Crust's `funding.total_investment_usd`
- `last_funding_amount_usd` — Crust's `funding.last_round_amount_usd`
- `last_funding_date` — Crust's `funding.last_fundraise_date`
- `last_funding_round_type` — Crust's raw `funding.last_round_type` string

`funding_stage` (snake_case enum: `pre_seed`/`seed`/`series_a..k`) was added in 019 and stays for filtering. It is set from a meaningful-round detection helper (NOT from `last_round_type` directly — see "Latest meaningful round" below).

### Table: `company_funding_rounds`

One row per round per company. ON DELETE CASCADE with `companies`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `company_id` | UUID FK | |
| `round_type` | TEXT | Crust's raw string ("Series A", "Venture Round", "series_unknown", etc.) |
| `round_date` | DATE | |
| `amount_usd` | NUMERIC | |
| `investors` | TEXT[] | All investors that participated |
| `lead_investors` | TEXT[] | GIN-indexed for "search by investor" |

### Latest meaningful round

Crust's `funding.last_round_type` is literally the most recent round, which is often a tiny grant or extension (e.g. "Grant"). For UI display and `funding_stage` we want the **latest meaningful priced round**.

`pickLatestMeaningfulRound()` in [lib/companies/funding.ts](lib/companies/funding.ts) iterates milestones in reverse chronological order and returns the first match against `/^(series\s+[a-k]|pre.?seed|seed)/i`. Anduril, for example, has a Series G as its meaningful latest round even though the literal `last_round_type` was "Grant".

### Investors-as-comma-string quirk

Crust returns investors in milestones as a comma-separated string (NOT an array). `toInvestorArray()` in [lib/companies/funding.ts](lib/companies/funding.ts) splits and trims. This was a real bug — first commit of Bundle B initially showed all rounds as having one investor named "X, Y, Z".

---

## Firmographics: Locations, Founders, Headcount Growth (Post-Migration 035)

Crust's enrich response carries richer company data than the basic search response. 035 captures it.

### Columns added to `companies`

- `description` (TEXT) — Crust's `basic_info.description`. Free-form, not always populated.
- `logo_permalink` (TEXT) — Crust's S3 logo URL. Used by `CompanyLogo` as the preferred source over logo.dev (resolves the Arc/Arc Boats ambiguity).
- `locations` (JSONB) — `{ headquarters: string|null, offices: string[] }`. Office strings are stripped of the leading ", " Crust returns.
- `founders` (JSONB) — array of `{ name, title, professional_network_url, ... }` (raw Crust shape).
- `headcount_growth_3m` / `_6m` / `_12m` (NUMERIC(7,2)) — percentage growth windows from `headcount.growth_percent`.
- `headcount_timeseries` (JSONB) — array of `{ date, count }` for the headcount chart on the company detail page.

### Auto-fill year scores from founding_year

When a company's `founding_year` is set (Crust returns it via enrich), the company list sort by "founded date" works directly. Year scores are still seeded manually but the founding_year fill is automatic via the firmographics path. See [lib/companies/year-scores.ts](lib/companies/year-scores.ts) for the helper.

### Helpers

[lib/companies/firmographics.ts](lib/companies/firmographics.ts) has the parsers + writers; called from the import single-row endpoint and the re-enrich endpoint.

---

## Investor Tiers (Post-Migration 036)

Curated list of notable investors used to (a) highlight "Notable Investors" callouts on the company detail page and (b) filter the companies list by "has tier 1 investor".

### Table: `investor_tiers`

| Column | Notes |
|---|---|
| `investor_name` | TEXT PK (matched against `investors[]` and `lead_investors[]` in `company_funding_rounds`) |
| `tier` | INT (1 = top, 2 = strong; tier 3+ reserved) |
| `notes` | TEXT, optional |

### Tier mapping (from Matt's CSV, 2026-05-05)

- **CSV tier 0 + tier 1 → DB tier 1** (top-tier: Sequoia, a16z, Founders Fund, Benchmark, Accel, KP, GC, …)
- **CSV tier 2 → DB tier 2** (strong: YC, Battery, Insight, Pear VC, GV, …)

Investor names in the seed are normalized to Crust's canonical form (e.g. "Andreessen Horowitz" not "Andreessen Horowitz (a16z)") so the match works without an alias table.

### Helpers

[lib/companies/investor-tiers.ts](lib/companies/investor-tiers.ts) exports `getNotableInvestors(companyId)` and `companyHasTier(companyId, tier)`. Used by the company detail page Notable Investors callout and the companies-list `tier` filter.

---

## Lists, Saved Searches, Hidden Items (Post-Migration 038)

User-curated bookmarks + saved filter state. Today all rows are `owner_id='admin'` (single-user); the schema is multi-user-ready (`owner_id` is part of every UNIQUE constraint).

### Tables

| Table | Purpose |
|---|---|
| `lists` | Named bookmark collections. `kind` ∈ (`candidate`, `company`). |
| `list_items` | Polymorphic membership. `item_id` references `people.person_id` OR `companies.company_id` based on the parent list's `kind`. |
| `saved_searches` | Re-runnable filter state per kind (filter JSON + name). |
| `hidden_items` | Per-owner hidden candidates/companies — they don't reappear in default search results. |

### Polymorphism without FK enforcement

`list_items.item_id` is UUID with no FK constraint — the parent list's `kind` is the discriminator. The application is responsible for inserting valid IDs. This was a deliberate trade: a single membership table is much simpler than two parallel tables, and the integrity risk is low because all writes go through [lib/lists/api.ts](lib/lists/api.ts).

### API surface

[lib/lists/api.ts](lib/lists/api.ts) exports: `fetchLists(kind)`, `addToList(listId, itemId)`, `removeFromList(...)`, `createList(...)`, `renameList(...)`, `deleteList(...)`, `listsContaining(itemId)`. Hardcoded `OWNER_ID = 'admin'`.

### UI

- `[app/lists/page.tsx](app/lists/page.tsx)` — browse all lists, two columns (candidate | company)
- `[app/lists/[id]/page.tsx](app/lists/[id]/page.tsx)` — list detail with multi-select + bulk actions ("Find candidates at N selected" for company lists, "Remove N from list")
- `[app/components/AddToListMenu.tsx](app/components/AddToListMenu.tsx)` — portal-rendered popover with existing-list checkboxes + inline "create new list" input. Triggered from a compact "+" icon next to each row's LinkedIn icon in the candidate/company tables.

Saved Searches and Hidden Items are **schema-only as of 2026-05-06** — UI not yet built.

### RLS

Disabled in 039. Supabase auto-enables RLS on `CREATE TABLE`, even when the migration includes `DISABLE ROW LEVEL SECURITY` in the same transaction. The fix pattern (now hit four times — 034, 037, 039, plus older) is a separate follow-up migration with just `ALTER TABLE … DISABLE ROW LEVEL SECURITY`. See "Development Rules" for the rule.

---

## Global Nav (2026-05-05 Refactor)

Persistent app bar rendered ONCE at the layout level, in [app/layout.tsx](app/layout.tsx). Replaces the per-page `TopNav` component (which had been duplicated across many pages).

### Component: `[app/components/GlobalNav.tsx](app/components/GlobalNav.tsx)`

Layout: `[V Vetted brand → /]   [Candidates] [Companies] [Lists] [Import▾]   [theme]`

- Sticky at top with `position: sticky; top: 0; z-index: 50`.
- Active state determined by pathname matching: `/` and `/profile/*` → Candidates; `/admin/companies/*` → Companies; `/lists/*` → Lists; `/admin/import/*` → Import.
- Import is a dropdown with "Import candidates" and "Import companies" — portaled to `document.body` (`createPortal`) so the sticky-header stacking context can't clip it.
- Active nav button styling: `bg-card text-foreground font-medium border border-border` (chip look). Inactive: subtle muted-foreground that hovers to fg-primary.

### Inline-style override on the global `a:hover` rule

[app/design-system.css:377](app/design-system.css#L377) defines `a:hover { color: var(--accent-strong); }` globally. That rule's specificity (element + pseudo = 0,1,1) **beats** Tailwind's `hover:text-foreground` (class + pseudo = 0,1,0 — wait, actually it's class which is 0,1,0; the global wins). To prevent every nav link from going orange on hover, the GlobalNav nav buttons are rendered as inline-styled components (`NavLinkButton`, `NavTriggerButton`, `ImportMenuItem`). Inline styles win specificity outright.

The eventual cleanup is to change the global rule to `a { color: inherit }` so links stop carrying the brand color by default — tracked in backlog. Until then, anything inside the nav must use inline styles for color.

---

## Competitions, Teams, Hard-Tech Signals (Post-Migrations 040–047)

V1 of hard-tech university competition + team signals. The bones: an existing extractor (`extractPatterns.ts`) already scans candidate text against `signal_dictionary.aliases[]` and writes `person_signals` rows. This work extends that pipeline with two architectural additions and two new categories — no new extractor needed.

### Two new `signal_dictionary` categories

| Category | Added in | Rows | Detection target |
|---|---|---|---|
| `olympiad` | 043 | 17 (USAMO/USACO/Putnam/IPhO/ISEF/Davidson Fellows + more) | `activities_honors`, `education_description`, `experience_description` |
| `national_lab` | 043 | 24 (JPL/Lincoln Lab/JHU APL/LLNL/AFRL/DARPA + more) | `title`, `company_name` — matches against `person_experiences.title_raw` / `company_name_raw` |

Both required adding to the CHECK constraint on `signal_dictionary.category` (migration 040). Required corresponding UI updates in `ProfileTable.tsx`, `ProfileDrawer.tsx`, and `search-builder/page.tsx` to add them to `SIGNAL_CATEGORY_ORDER` + `SIGNAL_CATEGORY_LABELS` — without those edits the signals exist but don't render in filter chip groups.

### `engineering_team` category semantic shift (migration 042 reclassification)

**Before this migration set:** category `engineering_team` held 24 generic *league* signals seeded in migration 025 — e.g., `Formula SAE`, `Baja SAE`, `RoboSub`, `Mars Rover Team`. The category name was imprecise — these were leagues, not specific teams.

**After 042:** 23 of those rows reclassified to category `competition`. The 24th (`ACM ICPC`) deleted (DELETE path fired since 0 `person_signals` referenced it; migration 044 re-created the canonical `ICPC` row under category `hackathon`).

**After 046 import:** category `engineering_team` now holds **141 specific team rows** (`Cornell Racing`, `USCRPL`, `MRover`, etc.) — one per team, with aliases for detection. So `engineering_team` semantic = "this candidate was a member of this specific team."

### `competitions` table (sidecar to signal_dictionary)

```
competitions
├─ signal_id UUID PK FK → signal_dictionary(id)   -- one row per league
├─ competition_slug TEXT UNIQUE   -- 'fsae_ic', 'irec', 'urc', 'robosub', ...
├─ tier_int SMALLINT (1-3)        -- 3 = elite, 1 = standard
├─ governing_org TEXT             -- 'SAE International', 'NASA', etc.
├─ domain_primary TEXT            -- 'automotive', 'rocketry', 'robotics_marine'
├─ common_role_titles TEXT[]      -- ['Team Captain', 'Chief Engineer', ...]
├─ grad_skew_typical TEXT         -- 'undergrad_majority' / 'grad_majority' / 'mixed'
├─ typical_team_size TEXT
├─ us_focus BOOLEAN
├─ official_url TEXT
└─ notes TEXT
```

21 rows. 11 mapped to existing signal_dictionary rows (reclassified from engineering_team). 10 needed new signal_dictionary rows (sae_aero, irec, robocup, iac, f1tenth, lunabotics, ccdc, ctf, vfs_design, vex_u).

### `teams` table (per-school specific teams)

```
teams
├─ team_id UUID PK
├─ signal_id UUID UNIQUE FK → signal_dictionary(id)  -- one signal_dictionary row per team
├─ school_id UUID FK → schools(school_id)
├─ team_name, team_slug (UNIQUE per school)
├─ tier_int SMALLINT (1-3)        -- 3 = elite team within its competition
├─ domain_tags TEXT[]             -- ['mech', 'controls', 'embedded', 'power_electronics', ...]
├─ grad_skew TEXT
├─ website TEXT
├─ is_consortium BOOLEAN          -- TRUE for multi-school teams; lead school in school_id
├─ consortium_partners TEXT       -- free-text partner schools
└─ is_verified BOOLEAN            -- empirical alumni-trace validation (future)
```

141 rows seeded by `scripts/import-teams.mjs` from `supabase/seeds/vetted_teams.csv` (142 CSV rows; one is a dedup — Stanford Solar Car Project appears under both `fsae_ev` and `solar_challenge`). 3 consortium teams: MIT-PITT-RW, AI Racing Tech, Black & Gold Autonomous Racing.

### `team_competition_map` (M:N junction)

```
team_competition_map
├─ team_id (FK)
├─ competition_id (FK → competitions.signal_id)
├─ is_primary BOOLEAN
└─ PK (team_id, competition_id)
```

142 rows. Most teams compete in 1 competition (so team_id appears once); Stanford Solar Car Project is the one team in V1 with two map rows.

### `team_domain_tag_dictionary` (controlled vocabulary)

17 tags seeded from the union of `domain_tags` across all 141 teams: `mech`, `controls`, `embedded`, `power_electronics`, `manufacturing`, `aero`, `structures`, `propulsion`, `avionics`, `robotics`, `autonomy`, `perception`, `cyber`, `security`, `ml`, `rotorcraft`, `space`. **Intentionally separate from `specialty_normalized`** — specialty describes a person, domain_tags describe a team's build focus. Different concept layer.

### Person-team detection — single pipeline

Same `extractPatterns.ts` runner scans `person_education.activities_raw`, `experience.title_raw`, `experience.company_name_raw`, etc., for matches against `signal_dictionary.aliases[]`. When a match hits a row where category=`engineering_team`, the resulting `person_signals` row JOINs back to the team via:

```sql
SELECT t.*
FROM person_signals ps
JOIN signal_dictionary sd ON sd.id = ps.signal_id
JOIN teams t ON t.signal_id = sd.id
WHERE ps.person_id = $1 AND sd.category = 'engineering_team'
```

No `person_team_memberships` table. The team membership IS the `person_signals` row.

### `person_signals.team_role_tier` and `team_role_text` (new columns)

Two new columns on `person_signals` to capture role-within-team:

| `team_role_tier` (SMALLINT 1–4) | Meaning |
|---|---|
| 4 | Captain / Chief Engineer / President / Founder |
| 3 | Department or Subsystem Lead |
| 2 | Engineer / Specialist |
| 1 | General member / unspecified |

**V1 detection** populates only tier 4 (regex match on `captain|chief\s+\w+|president|founder|team\s+lead|lead\s+engineer`) and tier 1 (everything else). Tiers 2 and 3 stay NULL until a future PR extends the extractor with mid-tier patterns. The `team_role_text` column preserves the raw source text so future re-classification can populate 2/3 without re-fetching from `raw_ingest_events`.

NULL for all non-team signals (olympiads, fellowships, etc.).

### `person_signals_active` view extension (migration 047)

View was extended with 13 new columns (team_id, team_name, team_tier, team_domain_tags, team_school_id, team_is_consortium, team_is_verified, team_role_tier, team_role_text, competition_slug, competition_tier, competition_domain, competition_governing_org).

**Critical pattern: LATERAL subquery with LIMIT 1.** Naive LEFT JOIN to `team_competition_map` would multiply rows when a team competes in multiple competitions. The view uses:

```sql
LEFT JOIN LATERAL (
  SELECT cmp.competition_slug, cmp.tier_int, cmp.domain_primary, cmp.governing_org
  FROM team_competition_map tcm
  JOIN competitions cmp ON cmp.signal_id = tcm.competition_id
  WHERE tcm.team_id = t.team_id
  ORDER BY tcm.is_primary DESC, cmp.competition_slug ASC
  LIMIT 1
) c ON t.team_id IS NOT NULL
```

Picks one competition per team (primary first, slug as tiebreaker). Confirmed via post-migration query: `0` duplicated rows in the view.

### `import-teams.mjs` — fuzzy school matching + idempotent UPSERT

Script reads `supabase/seeds/vetted_teams.csv`, deduplicates by `(school_id, team_slug)`, resolves competition slugs to signal_ids, then UPSERTs into signal_dictionary + teams + team_competition_map + team_domain_tag_dictionary. `--dry-run` flag short-circuits before writes and prints any unmatched schools/competitions to stdout.

**Slug derivation (locked):** lowercase team_name, replace non-alphanumerics with hyphens, drop article words (a/an/the/of/at/in), collapse hyphens, strip leading/trailing. Examples: `Cornell Racing` → `cornell-racing`; `MIT-PITT-RW` → `mit-pitt-rw`; `UM::Autonomy` → `um-autonomy`.

**School lookup:** exact match → case-insensitive match → `school_aliases` match → skip with stdout warning if all three fail.

**Consortia:** school field ending `(lead)` triggers `is_consortium=TRUE`; the lead school is parsed out; `consortium_partners` text is populated from the row's `notes` field.

### 37 schools added to `schools` table during staging — backlog implication

The first `--dry-run` against staging surfaced 61 unmatched team rows across 37 unique school names — all legitimate US universities not previously in the `schools` table (consistent with the existing schools-dedup backlog: schools are only added when candidate ingest surfaces them via Crust). Resolution before the real import: INSERTed all 37 as new canonical `schools` rows with `school_score = NULL` (unranked for now).

⚠ **Some of these 37 may be duplicates of existing canonical names** that didn't match because of word-order / punctuation / canonical-form variance — e.g., `Pennsylvania State University` may co-exist with a canonical `Penn State University`. The schools-dedup backlog now includes these 37 additions in scope.

### Reminder: app-code dependency

Adding new `signal_dictionary` categories REQUIRES updates to:
- [app/components/ProfileTable.tsx](app/components/ProfileTable.tsx) — `SIGNAL_CATEGORY_ORDER` + `SIGNAL_CATEGORY_LABELS`
- [app/components/ProfileDrawer.tsx](app/components/ProfileDrawer.tsx) — same shape
- [app/search-builder/page.tsx](app/search-builder/page.tsx) — same shape

Without these edits, signals with the new category exist in the DB but don't render in filter chips. Olympiad and national_lab are in there as of this work; future categories must follow.

---

## Start-of-Session Protocol

**Trigger phrase: `start session`** (primary) — **`new session`** also works as an
alias; both fire this identical protocol. When Matt types either (exact match) at
the beginning of a new CC session, execute:

1. **Read [SESSION_HANDOFF.md](SESSION_HANDOFF.md)** — the latest handoff
   block written by the previous session's End-of-Session Protocol.
2. **Read [ROADMAP.md](ROADMAP.md)** — specifically the "Current Build" and
   "Next Up" sections.
3. **Read the most recent entry in [CHANGELOG.md](CHANGELOG.md)** (top entry,
   reverse-chronological).
4. **Synthesize the three sources into a brief kickoff message** in this
   exact format:
   ```
   ## Last session shipped
   [1–2 sentence summary from CHANGELOG most recent entry]

   ## Picking up from
   [Next thing to do from SESSION_HANDOFF]

   ## Open questions Matt needs to decide
   [from SESSION_HANDOFF if any; omit section if none]

   ## Watch-outs for this session
   [from SESSION_HANDOFF if any; omit section if none]

   ## Current Build per ROADMAP
   [what ROADMAP says is in flight]
   ```
5. **Then ask**: *"Ready to start. Want to proceed with [Next thing to do],
   or pivot to something else?"*
6. **Wait for Matt's response** before doing any work.

Matt's first message in a new session is just `start session` — CC orients
itself from the handoff file + roadmap + changelog rather than Matt pasting
context manually.

---

## End-of-Session Protocol

**Trigger phrase: `end session`** (primary) — **`wrap session`** also works as an
alias; both fire this identical protocol. When Matt types either (exact match),
execute the following without further prompting — do the work, gate only at the
explicit approval points (steps 8 and 11):

1. **Pre-flight verification — runs BEFORE any docs are written.** Take stock of
   repo + deploy state and decide whether it's safe to close out:
   - **Report current state:** working tree clean? (list any uncommitted /
     untracked changes); current branch; any un-pushed commits (`git status` +
     `git log @{u}..HEAD`); open PR for the branch and its state (`gh pr view`);
     prod deploy state (latest `main` deploy on Vercel); whether the docs
     (CLAUDE/CHANGELOG/ROADMAP/BACKLOG/BUGS) already reflect this session's work.
   - **HARD-STOP — block and ask before continuing** only on unambiguous
     problems: **uncommitted changes that would be lost** or **un-pushed
     commits**. Surface them and ask Matt how to proceed (commit / stash / push /
     discard) BEFORE writing any docs. Do not proceed past this gate until
     resolved.
   - **REPORT-AS-CONTEXT — note, do NOT block** for expected-by-design states:
     an **open / unmerged PR** and **"not yet deployed to prod"** are NORMAL when
     ending a session with a PR still open (prod deploy only happens after merge
     in step 11). Flag them as context, not as gaps.
   - If nothing needs flagging, say so in one line and continue.
2. **Generate a short session summary** (2–4 sentences max).
3. **Append a dated entry to [CHANGELOG.md](CHANGELOG.md)** using the 6-block
   template (if today's entry already exists, expand it rather than duplicating
   the date):
   ```
   ## YYYY-MM-DD — Headline

   **Shipped**
   **Decisions**
   **Where we left off**
   **Open questions**
   **Watch-outs**
   ```
4. **Update CLAUDE.md migration ledger** if any new migrations ran this session.
   Add the section/sub-section if a new system was introduced. Update the File
   Layout if new files were added. Prune anything now wrong.
5. **Update [ROADMAP.md](ROADMAP.md)** — move completed items to Recently
   Completed (with PR link), add new Next Up items if any surfaced.
6. **Add new items to [BACKLOG.md](BACKLOG.md)** (organized by domain) if surfaced.
7. **Add small fixes to [BUGS.md](BUGS.md)** if surfaced.
8. **Show docs file changes for review.** DO NOT auto-commit. Wait for explicit
   approval.
9. **After Matt approves**, commit the docs with message:
   ```
   End session YYYY-MM-DD: <headline>
   ```
10. **Push the commit to the current branch.**
11. **PR MERGE DECISION STEP.** If the current branch has an open PR:
    - Check PR state: build status, Vercel preview status, any unresolved review
      comments, any tests failing. Use `gh pr view <N> --json` for state +
      `gh pr checks <N>` for CI.
    - Print a concise readiness report:
      ```
      Branch: <name>
      PR: #<N>
      Build: <pass/fail>
      Vercel preview: <URL + status>
      Tests: <pass/fail>
      Open review comments: <count>
      Recommendation: MERGE / DO NOT MERGE YET
      Reasoning: <1–2 sentences>
      ```
    - Ask Matt: **"Merge PR #<N> to main? (yes / no / not yet)"**
    - If **yes**: squash-and-merge with the PR title as the commit message,
      then delete the branch (local + remote).
    - If **no** or **not yet**: leave the PR open. Note in the starter prompt
      (step 12) that the PR is still pending.
    - If no open PR on this branch: skip the merge ask; note in the starter
      prompt that work is direct-to-main or pre-PR.
12. **Generate the next-session starter prompt.** Write it to
    [SESSION_HANDOFF.md](SESSION_HANDOFF.md) — **overwrite** the previous
    contents, do not append. Print it in the chat too for visibility. Include
    SESSION_HANDOFF.md in the same commit as the other docs updates from
    step 9 (if step 9 already shipped, this becomes its own follow-on commit
    `Update SESSION_HANDOFF for next session`).

    Format (reflect PR merge status from step 11):
    ```
    ## Where we left off
    [summary including PR status — merged, pending, blocked]
    ## What's in flight
    [current branch state, any open PRs and why]
    ## Next thing to do
    [literal first task]
    ## Open questions
    ## Watch-outs
    ```
    The next CC session reads this file via the Start-of-Session Protocol.

A stale CLAUDE.md is worse than a short one — future sessions read it as
authoritative and either reinvent existing systems or break them. The whole
point of this protocol is to keep the docs in lockstep with reality.
