# Vetted — Roadmap

Active work tracking. For deferred features see [BACKLOG.md](BACKLOG.md). For small fixes see [BUGS.md](BUGS.md). For deep engineering context see [CLAUDE.md](CLAUDE.md).

---

## Current Build

**Sourcing pipeline — phase 1** (branch: `sourcing-pipeline-phase1`)

A separate sourcing layer for discovering high-signal early-career talent via public roster pages (FSAE teams, fellowships, hackathon winners) or CSV import. Members get LinkedIn URL discovery + full profile enrichment, then surface in admin UI for review before being ingested into the candidate DB.

- **Phase 1 (in flight):** schema only — `sourced_prospects` table + supporting structures. Migrations `056_sourcing_pipeline_schema.sql` + `057_sourcing_pipeline_rls_off.sql` staged locally; tables sit dormant until phase 2+ wires them up.
- Untracked supporting work in the branch: `app/api/admin/import/`, `scripts/seed-test-profiles.mjs`, `docs/pdl/`.

---

## Next Up (sequenced toward Aug 28 launch)

1. **Sourcing pipeline phases 2+** — wire up roster scrapers, LinkedIn URL discovery, profile enrichment, admin review UI. Phase 2+ scope TBD after phase 1 lands.
2. **Set up dev/prod Supabase environment split** — all 66 migrations to date have been applied to a single Supabase project serving as both dev and prod. Acceptable while migrations stay purely additive (CREATE TABLE for new tables, ADD COLUMN, INSERT seeds, CHECK extensions). Becomes risky as soon as we ship one that modifies existing tables, adds an FK constraint referencing an existing table, or touches live data. **Approach**: create a second Supabase project for dev (free tier is fine at current scale), rename existing project's role to "prod" in env-var naming, add separate env vars for dev DATABASE_URL / SUPABASE_URL / SERVICE_ROLE_KEY, add small npm scripts to apply migrations to dev vs prod explicitly, replay all 66 existing migrations against the new dev project in order, document the new workflow in CLAUDE.md. **Hard gate**: must exist before the next non-additive migration ships (see CLAUDE.md "Non-additive migrations gated on dev/prod Supabase split"). For the sourcing pipeline specifically, this gates the future migration adding `sourced_prospects.candidate_id REFERENCES people(person_id)` FK. Scope ~1–2 hours.
3. **Four-axis candidate taxonomy rebuild**

   Replaces today's coarse function/specialty model with a four-axis structure capturing what kind of work the candidate does, at what depth, in what context. Foundational for AI chat search V1 — three-layer title/role/domain matching depends on this taxonomy existing. Also the platform's strongest competitive moat against horizontal sourcing tools (Juicebox, LinkedIn, SeekOut, Pin, Clado) — vertical depth on hard-tech engineering is the wedge they structurally won't build.

   **The four axes:**
   - **Function** — discipline. Replaces coarse `function=engineering` with `software_engineering` / `mechanical_engineering` / `electrical_engineering` / `systems_engineering` / `hardware_engineering` / `firmware_engineering` / etc. Per role: primary + optional secondary functions with weight.
   - **Specialty** — sub-area within discipline (embedded, backend, ML, controls, RF, payments-platform, etc.). Per role: primary + optional secondary.
   - **Skills / domain tags** — concrete laundry list, multi-per-role, cross-disciplinary tags allowed (RTOS, CAN bus, Kubernetes, CUDA, SLAM, Cadence, Simulink, etc.). New `skills_dictionary` required. Each skill tagged with `primary_specialty` for context-aware decay.
   - **Industry context** — a property of each experience (derived from the company's industry/domain tags). NOT a candidate-level tag. The scoring engine reads the intersection per-role, so "embedded + defense" only contributes when both co-occur on the same role.

   **Time-aware views on every axis** — current primary + current secondaries; ever (union across all roles); for skills also a "most recently used" view with per-skill dates. Mirrors the existing `current_*` / `highest_*` pattern.

   **Intersection scoring per role** — `match × tenure_weight × recency_decay`. Tenure curve (30/70/90/100 capped at 36+ months). Three axis-specific recency decay curves (skills decay fastest, specialty slower, industry slowest). Context-aware skill multiplier (0.5× for same-family subsequent roles, 1.0× otherwise — only skills need this, because specialty/industry naturally decay when the candidate leaves the role). Surfaces "did the relevant work in the relevant environment for meaningful duration" instead of "has two true but unrelated facts in their history."

   **Eligibility rules (stage-gated dispatch):**
   - **Working pros** (`years_experience_estimate IS NOT NULL`): FT roles count; concurrent advisory/contractor/founder-side-projects filter out via existing `filterSecondaryCompanySpans` (after the founder prerequisite fix). Pre-grad internships excluded. Existing `aggregatePersonSpecialties` filter preserved unchanged.
   - **Pre-career** (`years_experience_estimate IS NULL`): internships + hackathon signals (synthesized at inference time from `person_signals` — no stub experiences) + side-project founder roles count via new parallel `aggregatePersonSpecialtiesPreCareer` aggregator. Only fires when stage = pre_career.

   **Prerequisite (must ship before the taxonomy build begins):** founder-soft-NFT fix in `lib/tenure/helpers.ts` — add `\b(co-?)?founder\b` to SOFT_NON_FT_TITLE_PATTERNS so concurrent founder side projects defer to FT roles. Small standalone ticket. Eventually pairs with the existing backlog "Founder experience validation (real company gate)" — that validation step distinguishes "real funded company" from "side project," and only the latter gets the soft-NFT treatment.

   **Build order (six sub-PRs, each independent — do not bundle):**
   1. Founder-soft-NFT prerequisite fix in `filterSecondaryCompanySpans`
   2. Dictionary work: expand `function_dictionary` to disciplines; clean `specialty_dictionary` (drop title-like entries per existing backlog); new `skills_dictionary` with `primary_specialty` tags. Reference CSVs in `/reference/`.
   3. Ingest-side LLM-assisted per-experience inference (constrained to controlled vocabulary). Precedent: existing `lib/companies/tagger/` pattern.
   4. Per-experience axis storage + derived candidate-level columns + re-derivation logic in `compute-derived.ts`. New pre_career aggregator.
   5. UI: filter sidebar + search-builder + result rows + drawer + profile page (current-vs-most-recent-vs-ever toggles on each axis).
   6. Scoring engine: co-occurrence intersection scoring with tenure weighting + axis-specific recency decay + context-aware skills multiplier.

   Calibration assumptions (curve points, decay rates, 0.5× multiplier, floors) are educated guesses anchored on domain knowledge — revisit post-launch with real candidate data flowing through the new pipeline.

4. **AI chat search + auto-tagging** — THE wedge feature. Must ship pre-launch. Natural-language search over candidates + companies; auto-tagging of new candidates as they're ingested. Three-layer matching (specific title + normalized role + domain inference) depends on the four-axis taxonomy from item 3.
5. **Landing page + auth + admin vs user pages** — public marketing surface, login flow, role separation. Required for any external user.
6. **Kebab dropdown / recruiter view** — admin/recruiter view toggle via `?view=` URL param + global nav toggle. Hides admin-only signals (bucket badges, score breakdown, flagged_reasons, clearance section, Bucket column on main list) when in recruiter view. Affects ProfileTable, ProfileDrawer, profile/[id]/page.tsx, admin/companies/*. Scope ~0.5 day.
7. **Signals column on the main candidate table** — currently signals only render in the drawer + profile page. Recruiters scanning the list need to see why a candidate is interesting at a glance. Pattern: top 3–5 chips per row + `+N` overflow popover (mirroring the Company column's multi-subcategory pattern). Scope tight — 2–3 days max. Should NOT slip the AI chat search project; signals column is table stakes, AI chat is the actual product moment.
8. **Modular columns** — admin-selected column visibility on the main list. Phased: (a) localStorage-persisted column-visibility checklist behind a "Columns" button in the table toolbar (~100 LOC); (b) DB-persisted preference once auth lands; (c) per-user role defaults. User has repeatedly asked — high latent value.
9. **Agentic layer (user + admin) — distinct from AI chat search**
   A natural-language agent that *takes actions*, not just answers. Different from AI chat search (item 4), which is read-only (NL → search filters) and sits earlier on the roadmap. The agent mutates data and performs in-app tasks.

   **Admin agent — priority, build first.** Operate the business at scale via natural language instead of manual clicking: bulk record operations, company curation, rescoring, batch edits. Example: "Tag every aerospace company founded before 2015 as hard_tech and rescore candidates who worked there." How we run the admin side AI-natively in production; useful before we have users.

   **User agent — later, post-launch.** Users take in-app actions over their own workspace (lists, saved searches, starred items) via natural language. Example: "Add the top 15 results to a new list called 'Embedded — West Coast' and save this search to re-run weekly."

   Both need a defined set of callable actions plus human-in-the-loop confirmation for anything that changes or sends data. Depends on auth / user-admin split (item 5).
10. **PhD Researcher bucket** — only if time permits before launch. Dedicated bucket / classification for academic researchers (PhDs, postdocs, faculty). Distinct scoring profile from operators. Lower priority than items 1–8.

---

## Recently Completed

| Date | Title | PR | Notes |
|---|---|---|---|
| 2026-05-25 | Universal one-bucket filters + Founder taxonomy + Field of Study + docs maintenance | [#3](https://github.com/mktahr/vetted/pull/3) | Migrations 062–064. Universal `is_searchable=FALSE` on all signal_dictionary rows (granular search deferred to AI chat workstream). Binary Founder taxonomy (VC-Backed / Bootstrapped) with auto-derivation. field_of_study_dictionary seeded (86 rows → 43 normalized). UI refactor: drop "Any X" prefix, rename `engineering_team` → "University Team" + `competition` → "Engineering Competition", remove Accelerator filter, add Founder Type + Field of Study filters. **Also bundled**: CHANGELOG.md introduced, End-of-Session Protocol formalized (8 → 11 steps incl. push + PR merge decision), CLAUDE.md synced to actual `/reference/` state, migration ledger extended through 064. |
| 2026-05-20 | Reference data restructure + 6 new signal categories + investor angels | [#3](https://github.com/mktahr/vetted/pull/3) | Migrations 060 + 061. New `/reference/` folder convention with `scripts/sync-reference.mjs` dispatcher. 6 new signal_dictionary categories (university_program, university_fellowship, university_incubator_accelerator, university_lab, research_institute, student_venture_fund) — total 31 in CHECK. Athletics retiered to 6 rows (D1/Pro/Olympic = tier_3; JrOlympic/D2/D3 = tier_2; 24 dropped). investor_tiers extended with investor_type column + 7 new angel rows. /Users/matt/Downloads company-scoring CSV moved into repo at /reference/companies/. (Bundled into PR #3 along with 2026-05-25 work above.) |
| 2026-05-19 | V1 scoring refactor: 3-bucket model + flagged_reasons + admin override | [#2](https://github.com/mktahr/vetted/pull/2) | Migrations 048-055 + 058 + 059. Collapsed buckets (vetted/needs_review/flagged), config tables for signal weights, admin override endpoint + UI, founder flag derivation, **founder rank ordering fix (migration 059)**, **Education / Degree filter in sidebar + search-builder (round-2 commit)** |
| 2026-05-11 | Audit SIGNAL_CATEGORY_LABELS + backlog updates | direct to main | Full audit of signal_dictionary categories vs UI label maps. Backlog: signals column + Crust enrich design space |
| 2026-05-10 | Hard-tech university competitions + teams + extended signal_dictionary | [#1](https://github.com/mktahr/vetted/pull/1) | Migrations 040-047. competitions / teams / team_competition_map / team_domain_tag_dictionary tables. 141 teams seeded via import-teams.mjs |
| 2026-05-10 | CLAUDE.md catch-up: migrations 040-047 | direct to main | Doc-only — competitions / teams / hard-tech signals sections added |
| 2026-05-06 | CLAUDE.md catch-up: migrations 031–039 | direct to main | Doc-only — lists, GlobalNav, funding/investors, firmographics |
| 2026-05-06 | Polish bundle 1 merge | direct to main | Nav dropdown portal, sidebar padding, name hover, profile width revert |
| 2026-05-05 | GlobalNav replaces per-page TopNav | direct to main | Persistent app bar rendered at layout level |
