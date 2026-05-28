# Vetted — Backlog

Major deferred features that exceed ~0.5 day of scoping/building. For sequenced upcoming work see [ROADMAP.md](ROADMAP.md). For small fixes see [BUGS.md](BUGS.md). For engineering context on existing systems see [CLAUDE.md](CLAUDE.md).

Each entry: **what**, **status / trigger to build**, **scope outline**.

---

## V1 Scoring Refactor — Deferred from PR A

These were intentionally cut from PR A scope. All have hooks in the already-shipped V1 scoring code.

### Admin field editor for derived/normalized fields
- **Status:** deferred; bucket override (PR A) handles the bucket layer only
- **Trigger:** when manual correction of computed fields becomes a recurring need
- **Scope:** ~1–2 days. Per-field editors with simple PATCH endpoints, anchored on the profile page in an "Admin corrections" section. Fields: specialty, seniority (per-experience and `highest_seniority_reached`), `career_progression`, `title_level_slope`, person_signals add/remove

### Migrate `seniority_rules` to CSV-driven sync
- **Status:** currently DB-only (400+ rows seeded by `scripts/seed-seniority-rules.mjs`); no CSV mirror
- **Trigger:** when seniority rule edits become more frequent, or as part of a broader audit of remaining DB-only reference data
- **Scope:** ~0.5 day. Dump current `seniority_rules` to `/reference/seniority/seniority_rules.csv`, add handler to `scripts/sync-reference.mjs`, deprecate `seed-seniority-rules.mjs`. Rationale: architectural consistency with other reference data — every dictionary edit should flow through CSV → commit → sync.

### `company_quality_slope` bonus computation
- **Status:** weight wired in `signal_scoring_weights` (migration 050, mid=10 / senior=5) but engine contributes 0 because no derivation exists yet
- **Trigger:** when ready to broaden the scoring signal beyond career_slope
- **Scope:** ~150 LOC. Trajectory of `company_year_scores.company_score` across the candidate's last 2-3 FT roles, similar pattern to `career_progression` but on raw company scores. Write to a new `people.company_quality_slope` derived column (rising/flat/declining/insufficient_data); `score-candidate.ts` reads it like `title_level_slope`

---

## Data Quality

### Comprehensive `specialty_normalized` dictionary
- **Status:** current count is 25 patterns; target 80–100 for engineering alone
- **Trigger:** when normalized-specialty matching becomes the dominant search vector
- **Scope:** target depth — engineering (backend sub-specialties like payments/auth/data-pipeline, ML sub-specialties like NLP/vision/rec-sys, infra sub-specialties like kubernetes/observability/databases), then equivalent depth for product, design, sales, marketing, operations, recruiting, finance, data/analytics

### Company data enrichment
- **Status:** founding year partially done (20 hand-seeded); funding rounds, investor names, headcount by year, major events (acquisitions, layoffs, C-suite departures) not yet pulled
- **Trigger:** **required precondition** for the AI narrative summary feature below
- **Scope:** populate `company_metrics_by_year` with real data so tenure scoring has more context

### Executive scoring weights
- **Status:** general executive override exists in `score-candidate.ts`; a dedicated executive-specific weight profile is not yet built
- **Trigger:** when executive search becomes a focused use case
- **Scope:** dedicated weight profile that deprioritizes `education` and `degree_relevance` and heavily weights `company_quality_recent`, `company_quality_average`, and role scope. Activation: `highest_seniority_reached = 'executive'` OR (scoring stage is `senior_career` AND current title matches the executive rule set)

### Schools dedup pass (37 schools added during migration 047)
- **Status:** 37 new school rows created during competitions/teams import to resolve unmatched team imports. Some may duplicate existing canonical rows under different naming
- **Trigger:** before broader school-name search becomes important
- **Scope:** identify and merge duplicates. Known suspects: `Pennsylvania State University` vs `Penn State University`; `Texas A&M University` vs `Texas A&M`; `Virginia Polytechnic Institute and State University` vs `Virginia Tech`. Until done, `teams.school_id` may point at the newly-inserted row rather than the canonical one for those schools

### Team role tier 2 + 3 extractor
- **Status:** V1 extractor populates only `team_role_tier=4` (Captain/Chief/President/Founder) and `team_role_tier=1` (everyone else). Tiers 2 (Engineer/Specialist) and 3 (Dept/Subsystem Lead) stay NULL
- **Trigger:** when team-role granularity affects scoring outcomes meaningfully
- **Scope:** extend the regex set. `team_role_text` already preserves source text so re-classification doesn't require re-fetching from `raw_ingest_events`

### Founder experience validation (real company gate)
- **Status:** identified during PR #5 seniority-split review (2026-05-28). Today, "Co-Founder" / "Founder" in a title triggers founder status from the title string alone, with no check that the entity is a real company. Meetups, clubs, side projects with "founder" in the title falsely trigger founder status (e.g. "Co-Founder/Organizer, Meetups @ Mercedes-Benz R&D")
- **Trigger:** ties to Company data enrichment landing (above) — both depend on `company_funding_rounds`, investor data, headcount, and domain signal coverage being populated. Resolve together
- **Scope:** gate founder status on **structured company signals FIRST** — does the company exist in our DB with funding rounds, recorded investors, headcount data, or a real domain? No structured footprint → flag for review, don't count as founder experience. LLM web lookup ONLY as a fallback when zero structured data exists, and only to flag-for-review (never as the primary gate — live lookups return unreliable/conflicting data). Ties to the VC-backed derivation gap: real funded companies (e.g. Auradine, $314M raised) currently show as bootstrapped because `company_funding_rounds` is unpopulated — same enrichment unblocks both

### Specialty dictionary cleanup — title-like specialty names
- **Status:** identified during PR #5 seniority-split review (2026-05-28). `specialty_dictionary` has entries that read as titles rather than specialties — e.g. `chief_engineer` (parent_function=engineering). Jennifer Tran's "VP of Engineering" current role resolves to `specialty=chief_engineer`, which is semantically odd ("Chief Engineer" is a title, not a specialty). Collides with the new `c_suite` seniority value
- **Trigger:** before specialty matching becomes a primary search vector (overlaps with Comprehensive `specialty_normalized` dictionary above)
- **Scope:** audit `specialty_dictionary` for title-like entries. Decide each: keep as specialty (e.g. if it captures a real sub-discipline), rename to a clearer specialty name, or delete and let title carry the meaning. Specifically revisit `chief_engineer` — likely belongs in `seniority_normalized=c_suite` territory now, not in specialty

---

## UI / Search

### School → Programs expansion UI
- **Status:** concept; schema work needed before UI can ship
- **Trigger:** after sourcing pipeline + AI chat search land; once school-filter usage patterns are clearer
- **Scope:** when admin/recruiter filters by a school in the search builder (e.g. Berkeley), expand to show specific programs/labs/accelerators at that school (Berkeley M.E.T., SkyDeck, CITRIS Foundry, SAIL, BAIR, etc.). Data exists today — university_program / university_lab / university_incubator_accelerator signal_dictionary entries with school-name aliases. UI affordance to be built.
- **Schema gap:** `signal_dictionary` has no `affiliated_school_id` foreign key today. Three implementation paths to evaluate:
  - **(a)** Add `affiliated_school_id` column → migration + backfill all university_* entries. Cleanest.
  - **(b)** New join table `school_signal_map` for many-to-many (e.g. Pear VC Garage operates at Stanford + Berkeley + MIT). More flexible.
  - **(c)** Fragile string-match between `canonical_name` / `aliases` and `school_name`. Quickest, dirtiest.
  - Multi-campus entries like Pear VC Garage favor (b).
- **Scope estimate:** schema work (a or b) + backfill + filter sidebar UI + drawer expansion = ~1–2 days.

### Crust enrichment for activities/honors coverage
- **Status:** ~90% of `person_education.activities_raw` is empty because Crust's `/person/search` (used by ingest today) doesn't return `activities_and_societies` — only `/person/enrich` does
- **Trigger:** defer until signal-driven search proves valuable enough to justify the credit spend
- **Scope:** three approaches (probably (a) + (b) combined):
  - **(a) Enrich-at-ingest:** every new candidate gets enriched immediately. Blanket coverage; ~$0.01–0.03 per candidate
  - **(b) Enrich-on-promote:** fire enrich when a recruiter signals interest (added to list, opened detail). Lazy, cheaper, more targeted
  - **(c) Enrich-backfill:** one-time pass over existing corpus. Solves history; doesn't help future

### Function taxonomy consistency — promote disciplines from specialty to function
- **Status:** identified during PR #5 seniority-split review (2026-05-28). The current taxonomy is internally inconsistent — for **software**, the discipline lives at FUNCTION level (`function=engineering`, `specialty=backend/frontend/fullstack`); for **mechanical/electrical/etc.**, the discipline lives at SPECIALTY level (`function=engineering`, `specialty=mechanical_engineering`). So "Software Engineer" and "Mechanical Engineer" both end up as `function=engineering`, with their actual discipline buried in `specialty` for one and not the other
- **Trigger:** feeds the future **three-layer title/role/domain search** (ROADMAP #3 V1: specific-title match + normalized-role match + domain inference). That search needs consistent role normalization — same kind of work classified the same way regardless of stack. Should land before AI chat search V1 if possible
- **Scope:** domain-by-domain refactor — promote disciplines from specialty to function level (`software_engineering`, `mechanical_engineering`, `electrical_engineering`, `chemical_engineering`, etc. become first-class functions); specialty becomes uniformly the sub-discipline within (embedded, ML, infra, backend, controls, RF, etc.). Touches: `function_dictionary` seed, `specialty_dictionary` re-parenting, every `title_dictionary` row's function_normalized, scoring engine's function override gates, role↔specialty mapping in `role_specialty_map`, ingest pipeline title→function/specialty resolution, all UI filter dropdowns. Multi-day refactor; needs migration + data backfill + cross-file edits. Don't start until three-layer search scope is locked

---

## Vetted Companies V1 — Vocabulary Gaps

Surfaced during the larger-eval ground truth pass (2026-05-03).

### Gaming as a hardware domain_tag
- **Status:** Gaming lives only in `NON_HARDWARE_DOMAIN_TAGS`. Hardware cos with real gaming businesses (Sony PlayStation, Valve / Steam Deck, Razer, Logitech G) have nowhere to surface that signal. Sony's `domain_tags` ended up `[]` in larger eval for this reason
- **Trigger:** defer until recruiter searches surface gaming-hardware roles often enough to justify
- **Scope:** migration that updates the CHECK constraint AND `lib/companies/taxonomy.ts` together

### Out-of-scope industry gaps
- **Status:** known gaps — Telecommunications (Verizon falls to Services), Real Estate / co-working (WeWork falls to Services), Streaming/Music as primary (Spotify falls to Consumer Tech), Agriculture (John Deere falls to Industrial Manufacturing)
- **Trigger:** only add as V1 industries if recruiter demand surfaces them

---

## Vetted Companies V1 — Tagger Issues (Track in Production)

Known tagger limitations from the round-3/round-4 eval. Not severe enough to block ship.

### Climate-vs-Energy disambiguation (systemic)
- **Status:** 2/4 Climate companies misclassified as Energy across rounds 3-4 — Climeworks (DAC, called Energy) and Twelve (CO2-to-fuel, called Energy). Charm Industrial and Heirloom Carbon classified correctly. Pattern: Claude reads "produces fuel/material from carbon" as energy-production rather than climate-tech
- **Trigger:** revisit if recruiters surface confusion or if more Climate cos enter the DB and the misclassification rate stays high
- **Scope:** prompt-tightening fix possible (rule: "carbon removal/avoidance mission → Climate, even if byproduct is fuel/material")

### AI-feature over-tagging on Asana (borderline)
- **Status:** in the larger eval, 3/3 AI-feature-not-core companies (Asana / Zoom / Salesforce) classified primary correctly as SaaS, but Asana was over-tagged with `AI` in domain_tags. Zoom and Salesforce correctly suppressed it. Notion (round-3) also passed
- **Trigger:** revisit if over-tagging on AI-feature SaaS rises above ~25% of cases
- **Scope:** **don't fix now** — risk of regressing AI-suppression on AI-core companies (Anthropic / OpenAI / Mistral / Perplexity all got AI-suppression right 4/4 in round-4)

---

## AI Features

### AI sourcing partner mode
- **Status:** concept; not started
- **Trigger:** post-launch, after AI chat search is stable
- **Scope:** educate recruiters on where to find talent — skills, titles, adjacent companies, transition profiles. Knowledge work, defensible. AI surfaces the *strategy* of where to look, not just the search result

### AI sourcing co-pilot
- **Status:** concept; not started
- **Trigger:** post-launch, after AI chat search is stable
- **Scope:** questions-driven search focus, talent mapping, JD upload, alternative titles surfacing. Conversational refinement of search intent

### Automated AI company researcher
- **Status:** concept; not started
- **Trigger:** when sourcing pipeline phases are stable
- **Scope:** cron-style backend agent that monitors news / fundraising announcements / press, surfaces new startups for admin review and database addition. Reduces manual curation overhead

### AI narrative summary
- **Status:** scoped earlier; depends on company data enrichment having enough signal for useful summaries
- **Trigger:** when company enrichment lands
- **Scope:** Claude API generates a short story-of-the-candidate paragraph from structured data (experiences + company context + education). **Summarization, not judgment** — scoring and bucketing stay deterministic

---

## Candidate Intelligence

### Candidate activity tracking
- **Status:** concept; not started
- **Trigger:** post-launch, when recruiter usage signals demand
- **Scope:**
  - Notifications on followed candidates
  - Deep social research (LinkedIn, X, Instagram, spouse activity)
  - Interest mapping via Google search / Reddit / YouTube history
  - Location history for relocation prediction (personal + spouse + family + grew-up)

---

## Pipelines

### Early-stage startup monitoring
- **Status:** concept; not started
- **Trigger:** when company-set freshness becomes a constraint
- **Scope:** auto-ingest companies backed by A16Z, Sequoia, YC (and similar) on funding rounds or stealth-exit events. Keeps the scored-company set fresh without manual re-seeding

### Bulk company scoring
- **Status:** concept; not started
- **Trigger:** when mid-tier coverage breadth matters more than precision
- **Scope:** Claude + Excel pipeline to auto-apply tier scores to mid-tier companies based on founding date and other signals. Output tagged as `AI-averaged` vs `manually ranked` (add a column or reuse `company_score_mode`). Deliverable: CSV that re-seeds `company_year_scores` in bulk

### PDL Preview API
- **Status:** evaluation; not started
- **Trigger:** when alternative coverage or pricing matters
- **Scope:** explore PDL as a supplement / alternative to Crust Data for bulk pulls (different coverage profile, different credit economics)

### Import UI: sample-first workflow
- **Status:** concept; not started
- **Trigger:** when credit burn on bad filters becomes a real cost
- **Scope:** before firing a full 500-profile pull, let the user request 50, review the mapped output, then confirm the full pull

### Slack integrations for ATS workflows
- **Status:** concept; not started
- **Trigger:** post-launch, when recruiter usage patterns are clear
- **Scope:** Slack-side hooks that thread into existing ATS workflows. **Ashby and Greenhouse priority. Skip Lever — no one uses it. Gem for sequencing context.**

### Lightweight Slack-first ATS
- **Status:** concept; long-term
- **Trigger:** post-launch, after Slack integrations validate the recruiter-flow hypothesis
- **Scope:** a Slack-first ATS for recruiters who don't want Ashby/Greenhouse complexity. Stretch goal

---

## Product Expansion (Long-term)

### Elite Upwork marketplace
- **Status:** concept; long-term
- **Trigger:** after core recruiting product has validated demand
- **Scope:** vetted contract / fractional / trial work marketplace. Built-in contracts and payments. Equity option flagged as complex/unlikely — may skip

### Co-founder matching
- **Status:** concept; long-term
- **Trigger:** after core recruiting product validates
- **Scope:** vetted matching system, technical first then operators / sales / recruiters. Scoring-driven matches (positioned as "better than YC's"). Background + role type + seniority filters

### Curated newsfeed
- **Status:** concept; long-term
- **Trigger:** when user count justifies a content surface
- **Scope:** stringent posting rules — **only** job openings, fundraising, product launches, acquisitions, major company announcements. No opinions, no slop, no comments on ARR posts. Counter-positioned vs LinkedIn newsfeed
