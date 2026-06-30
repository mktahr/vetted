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

### Dangling specialty refs in `title_dictionary` (non-engineering)
- **Status:** surfaced during sub-PR 2b prod verification (2026-06-21). 3 rows reference specialties absent from `specialty_dictionary`: `Data Scientist` + `Senior Data Scientist` → `analytics` (fn=data_science); `Account Executive` → `enterprise_sales` (fn=sales). Pre-existing — unrelated to the five-axis rebuild (none of these were in 072's delete set). Harmless today (title_dictionary specialty hints are advisory; these are non-engineering / out of V1 scope).
- **Trigger:** when the non-engineering taxonomy gets built out, OR when a referential-integrity sweep across dictionary tables is run.
- **Scope:** trivial — either seed `analytics` + `enterprise_sales` into `specialty_dictionary` (if they should exist) or NULL the 3 `specialty_normalized` refs. ~10 min. Worth bundling into a broader title/specialty dictionary integrity audit rather than a one-off.

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
- **Promoted to ROADMAP item #3** (Four-axis candidate taxonomy rebuild — 2026-05-29). Absorbed into sub-PR 2b of that build (`specialty_dictionary` cleanup as part of the function/specialty rework). Original notes preserved in PR #5 / PR #6 history; see ROADMAP for current scope.

### Dictionary refinement: methodology category split
- **Status:** identified during sub-PR 2a of four-axis taxonomy build (2026-06-01). `skills_dictionary.category='methodology'` is the broadest of the 7 V1 categories — could legitimately hold engineering practices (CI/CD, DevOps, TDD, V-model, design review) AND testing methodologies (HIL, MIL, SIL, formal verification, fuzz testing) which are pretty different beasts
- **Trigger:** when methodology entries grow past ~20 in the dictionary OR when recruiters surface confusion between "uses HIL testing" and "practices CI/CD" as functionally different searches
- **Scope:** evaluate split into `engineering_practice` (process / workflow) vs `testing_methodology` (verification / validation technique). Migration to extend the CHECK constraint with the new category values + reclassify existing methodology rows. Low-effort once triggered

### Industry-specific title normalization
- **Status:** identified during PR #6 slope-score build (2026-05-29). Titles map to seniority/function differently across industries. A "VP" at an investment bank (Morgan Stanley, Goldman) is NOT a management title — it's roughly equivalent to Senior IC / early Lead in tech. Associate/Analyst at consultancies (McKinsey, Bain) and law firms map to junior-to-mid IC. Military ranks have their own ladder (Lieutenant → Captain → Major → Lt Col → Colonel) that maps to IC → manager → director → VP equivalents. Currently `seniority_rules` assumes a startup/tech mapping uniformly — every "VP" resolves to `vp`, every "Associate" resolves to `junior_ic`, etc.
- **Trigger:** out of scope until Vetted expands beyond engineering. The schema decision (industry-conditional title rules) should be made BEFORE expanding so we don't ship industry-bias to non-tech recruiters
- **Scope:** industry-conditional rules — same `title_pattern` resolves to different `seniority_level` based on the company's industry/sub-industry. Schema options: (a) extend `seniority_rules` with optional `industry_scope` column (TEXT[] or single value); (b) separate `seniority_rules_overrides` table keyed on `(title_pattern, industry)`; (c) per-industry rule sets composed at lookup time. Also relevant: "forward-deployed engineer" and similar hybrid technical-but-not-traditional-eng roles at banks/consultancies need to surface in engineering searches via specialty/function bridging. Pick approach at design time, not now

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
- **Promoted to ROADMAP item #3** (Four-axis candidate taxonomy rebuild — 2026-05-29). This IS the work — promoted from "domain-by-domain refactor" backlog into the four-axis taxonomy build as sub-PR 2b (`function_dictionary` expansion to first-class disciplines: software_engineering, mechanical_engineering, electrical_engineering, etc.). See ROADMAP for full scope including the three other axes (specialty, skills, industry context) the function expansion plugs into.

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

## Network Connections (warm-intro module)

PR 1 (the pipeline) shipped 2026-06-24 via PR [#10](https://github.com/mktahr/vetted/pull/10). These are the deferred follow-ups.

### Per-connection review actions on the connections table
- **Status:** PR 1 puts web-check / Keep-Drop only in the MAYBE review queue; the connections table shows buckets read-only.
- **Trigger:** when curating real org connection sets (esp. as volume grows) makes queue-only actions painful.
- **Scope:** ~0.5–1 day. Surface per-connection actions (web-check, Keep/Drop, re-bucket with full yes↔maybe↔no transitions) as row actions on [app/network/connections/page.tsx](app/network/connections/page.tsx) (or a row detail drawer), available for ANY bucket — not just MAYBE. Today a connection auto-bucketed YES/NO at upload (or already decided) can't be re-examined or sent back to review, and because the decision is stamped `title_bucket_source='manual'`, even re-upload won't reset it. New API: extend `POST /api/network/connections/[id]` to accept a `maybe` transition. Also covers the "no undo on Keep/Drop" gap (same root cause).

### PR 2 — connection detail view + candidate-search integration
- **Status:** PR 1 is the pipeline only (upload → classify → triage → enrich → store + basic admin table). **Update 2026-06-24: increment 2a (connection detail drawer) shipped via PR [#13](https://github.com/mktahr/vetted/pull/13)** — enriched data is now viewable. Remaining: (b) candidate-search integration, (c) warm-intro routing — both pending the 2b design decisions.
- **Trigger:** next up after PR 1 merge — the module delivers little usable value without it.
- **Scope:** multi-day, stacked branch on PR 1. ~~(a) Connection detail view/drawer~~ ✅ done (2a, PR #13). (b) wire connections into the existing candidate search via the **`people`-projection-with-pool-flag** model (project enriched connections into `people`/experiences/education with `in_general_pool=false` + connection↔person link; default search = general pool; org/employee-scoped "search connections" toggle; **promotion = flag flip, no re-pay**; enrichment ≠ promotion, pool entry is admin-gated). Reuses the existing 25-axis search machinery rather than a separate weaker search. Reverses 075's literal "never write to `people`" — justified by enrichment≠promotion. (c) warm-intro routing (which employee can make the intro). Admin cross-org view (every org + individual connected to a candidate) is supported by current schema (canonical_url + connection_owners) — can ship early. **Schema gap flagged:** the cached `/person/enrich` blob is current-snapshot-only (no work history / education), so full 25-axis search + full promotion need a richer (paid) enrichment tier — decision: snapshot-axes-now vs pay-for-rich.

### Warm-path ranking — "who knows this candidate best"
- **Status:** the cross-org view + `connection_owners` (M:N) already surface EVERY org + individual connected to a candidate (drawer Network section, profile page, connections "Via" column, `/api/network/cross-org`). What's missing is RANKING those warm paths by connection strength so the admin knows which of the 3–4 connectors to ask for the intro.
- **Trigger:** when an admin actually wants to action a warm intro and there are multiple connectors.
- **Scope:** add a connection-strength signal and sort the cross-org employees by it. Data on hand is thin — `connection_owners.connected_on` (a weak recency proxy) is the only built-in signal. Richer options (deferred): mutual-connection count, manual "closeness" rating per owner, or interaction data we don't currently ingest. V1 could simply sort by `connected_on` (longest-connected first) + show the date, labeled as a weak proxy. Surfaces in the cross-org Network section (drawer + profile page).

### Network: dedicated "all organizations" browse/review index
- **Status:** you reach an org's connections only via the `/network` upload page's org dropdown → "View / review connections" (added 2026-06-30). There's no standalone index of all orgs (with counts, last-upload, enriched/pooled tallies) as a review home.
- **Trigger:** once there are several orgs and the dropdown-on-the-upload-page feels cramped as the review entry point.
- **Scope:** a `/network/organizations` (or repurpose `/network`) index listing every org with employee/connection/enriched/pooled counts, each linking to its connections table + review queue. Small-to-medium.

### Gated promotion — deferred follow-ups (post-082)
- **Status:** gated promotion shipped (migration 082; `network-connections-gated-promotion`). The auto-rule gate is **vetted-company only** (`companies.review_status='vetted'` via the connection's overlay `company_id`), plus full manual override (force in/out). Two items were deliberately deferred:
  1. **Additional candidate "bar" beyond vetted-company.** The handoff floated an extra promotion gate (bucket threshold? manual review? score floor read from the projection-time score?). Per Matt (2026-06-29) this is a separate product decision — vetted-company + manual override is the shippable V1 gate. **Trigger:** when auto-promoting at vetted companies still lets through candidates you'd rather not pool. **Scope:** add a score/bucket predicate to `desiredInPool()` in [lib/network/promote.ts](lib/network/promote.ts) — the projection-time score is already on `candidate_bucket_assignments`. Small.
  2. **candidate-ingest→`both` symmetric promote edge.** A connection promoted to `both` (so `promoted_from_connection=true`) that is *later* independently candidate-ingested stays marked promotion-origin, so a force-out could wrongly demote a now-real candidate. Already logged in the PR 2b handoff. **Trigger:** only once a projected connection is later candidate-ingested (can't happen until candidate ingest overlaps a promoted connection). **Scope:** on candidate ingest, if an existing person is `promoted_from_connection`, clear the flag (they're now native). Small; lives in the ingest upsert path.

### Drawer: hide internal classification metadata from user-facing view
- **Status:** the 2a connection drawer (PR #13) surfaces admin/debug-only fields (`bucket source: taxonomy`, `scope`) that aren't user-facing.
- **Trigger:** when a recruiter-facing connections view exists (ties to the kebab/recruiter-view work).
- **Scope:** gate classification-internals (`title_bucket_source`, `function_scope`) behind admin view; keep specialty + company-score user-facing. Small.

### Drawer profile image: confirm source stability / caching
- **Status:** the 2a drawer renders `basic_profile.profile_picture_permalink` from the Crust enrich blob. Unconfirmed whether that's a stable Crust-hosted S3 URL or a pass-through LinkedIn CDN URL that expires.
- **Trigger:** before connections (or candidates) rely on profile images in a shipped recruiter-facing view.
- **Scope:** verify URL host/stability; if LinkedIn-hosted/expiring, plan image refresh on re-enrich or cache to our own storage. Same question likely applies to candidate profile images.

### Connection specialty accuracy limited by snapshot-only data
- **Status:** `connections.specialty_normalized` is `resolveSpecialty()` best-effort on the terse snapshot current-title alone (e.g. "fullstack" guessed from title), with no work history to disambiguate.
- **Trigger:** ties directly to the 2b data-tier decision (snapshot vs rich enrichment).
- **Scope:** if rich enrichment (2b tier ii) lands, re-derive specialty from full history; until then treat connection specialty as low-confidence. Folds into 2b — no standalone work.

### Connection enrichment summary completeness varies
- **Status:** the enriched `basic_profile.summary` is rich for some profiles, sparse/empty for others — a Crust source-data limitation, not a bug.
- **Trigger:** revisit if/when summaries are surfaced in a recruiter-facing or scoring context.
- **Scope:** note only. Consider a fallback (headline + current role) when the summary is thin.

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

## Taxonomy Expansion

### Additional engineering sub-functions (post-V1 expansion)
- **Status:** deferred from sub-PR 2b (taxonomy rebuild)
- **Trigger:** customer demand OR material candidate volume in these disciplines
- **Scope:** V1 taxonomy ships with 16 active engineering sub-functions (software, firmware, mechanical, electrical, hardware, chip, systems, controls, robotics, aerospace, materials, manufacturing, test, optics, ml, data). Disciplines deferred for later expansion:
  - `nuclear_engineering`
  - `biomedical_engineering` / `bioengineering`
  - `chemical_engineering`
  - `environmental_engineering`
  - `civil_engineering` / `structural_engineering`
  - `ocean_engineering` / `marine_engineering`
  - `agricultural_engineering`
  - `petroleum_engineering`
  - `mining_engineering`
  - `audio_engineering` / `acoustic_engineering`

When expansion is triggered: add the new function as INSERT in a follow-on migration, surface in UI filter dropdowns, decide which existing specialties (if any) need to reparent.

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
