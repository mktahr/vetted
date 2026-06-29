# Vetted — Changelog

Reverse-chronological running log of work sessions. Each entry: what shipped, what was decided, where we left off, open questions, watch-outs.

Updated automatically by the End-of-Session Protocol when Matt types "wrap session". For sequenced upcoming work see [ROADMAP.md](ROADMAP.md). For deferred features see [BACKLOG.md](BACKLOG.md). For engineering context see [CLAUDE.md](CLAUDE.md).

---

## 2026-06-29 — Network Connections PR 2b: enriched-connection search integration (PR #14, open)

**Shipped** (branch `network-connections-pr2b`, PR [#14](https://github.com/mktahr/vetted/pull/14) — open at session end, migrations on prod, code pending merge)
- **Enrich data-tier resolved by live probe:** `/person/enrich` returns rich data (experience/education/skills) ONLY when `fields=[basic_profile,experience,education,skills]` is explicitly requested — the docs' "all fields if omitted" is false for our account; `certifications`/`honors` are denied (403 the whole call). Fixed `lib/network/enrich.ts` (request the allowlist; parse `experience.employment_details`; employer `name` not `company_name`; primary-current via `is_default`). `CREDITS_PER_ENRICH` 1→3 (conservative; test key); post-run credits labeled "(estimated)". `docs/crust/07` banner added.
- **Migrations 080 (`people.record_kind`) + 081 (`connections.person_id`)** applied dev+prod, inert until code uses them. `record_kind` is a KIND column (candidate|network_connection|both, default candidate — fail-safe), not a boolean (Codex's catch). Pool membership derives from it.
- **Server-side pool filters** (`record_kind IN (candidate,both)`) on ProfileTable fetch, rescore-all, company-triage counts. No-op on prod (0 connections) — preview-verified the candidate list is unchanged.
- **Cache freshness** (`STALE_AFTER_DAYS=90`; only fresh real-blob rows reused; hollow `global_pool_reuse` rows no longer block re-enrichment).
- **`mapEnrichToCanonical`** (`lib/ingest/mappers/crust-enrich.ts`) — preserves description/employment_type/field_of_study/skills the search mapper drops. 24/24 unit tests.
- **`writeCanonicalProfile`** (`lib/ingest/write-canonical.ts`) — extracted ingest steps 2–9 into a transport-agnostic core; `/api/ingest` is now a thin wrapper. Candidate ingest proven **semantically byte-equivalent** via OLD-vs-NEW differential on the real HTTP route (empty snapshot + response diffs, incl. existing-person re-ingest + identical company baseline).
- **`projectConnection`** (`lib/network/project-connection.ts` + `app/api/network/project/route.ts`) — resolve-existing-person-first → merge (link + guarded candidate→both, no rewrite) else `network_insert`; `record_kind` transition applied LAST; bounded 23505 recovery; `person_id` set only after the person op. Dev-verified: new connection → `network_connection`, full exp/edu/skills via the real resolver, scored, **excluded from default pool**; merge → `both`, no duplicate.
- **Search-within-connections** — FilterSidebar `[General pool | Pool+connections | Connections-only]` + org/employee picker (optional/gated; search-builder untouched); ProfileTable reactive scoped loader (two-query merge by person_id, `fetchGen` stale-guard, scope-change resets). Browser-verified on the Vercel preview.
- **Codex pre-merge review fixes** (commit `3b1332d`): a second Codex pass flagged 2 HIGH + 3 lower. Fixed all: (1) `projectConnection` now enforces `STALE_AFTER_DAYS` on the enrich blob — refuses a stale blob for a new-person projection (`stale_enrichment_blob`); (2) merge now LINKS before promoting, both error-checked, `promoteCandidateToBoth` returns boolean, already-linked path re-runs the promote to repair a partial state (no `both` with no link, no false `merged`); (3) project route `scope='connections'` filters IDs by `org_id`; (4) ProfileTable surfaces connection-scope query errors instead of silently empty; (5) `setLoading(true)` on scope change. Re-verified on dev: fresh→projected, merge→both (link-first), stale→refused.

**Decisions**
- Data tier (ii) and the `people`-projection-with-`record_kind` architecture both adopted (reverses 075's literal "never write connections to people," justified by enrichment ≠ promotion).
- KIND column over boolean (Codex); default `candidate` fail-safe; ingest does NOT write `record_kind` (relies on the default) to avoid demoting a promoted `both` on re-ingest.
- Projection scoring: score connections at projection time (bucket written) but keep them out of pool via `record_kind` — the promotion bar needs a score.
- Two Codex pressure-tests folded in across the build (identity/upsert contract, resolve-first ordering, record_kind-transition-last, bounded 23505, identical-baseline + re-ingest regression).

**Where we left off**
- PR #14 open + MERGEABLE, Vercel check passing. Migrations 080/081 on prod (inert). Code pending the merge gate.

**Open questions** — none blocking.

**Watch-outs**
- Merging the code deploys the `record_kind` filters + projection to prod; safe (filters no-op against 0 connections; projection only on explicit `/api/network/project`). Lockstep is DB-then-code here and fine.
- 081's SQL/DB comment still says "1:1" — cosmetic; the real cardinality is N:1 (many connections → one person).
- Deferred: warm-path chip; scope dependent fetches to visible IDs (perf); candidate-ingest→`both` symmetric promote; cross-URL-format people dedup.

---

## 2026-06-24 — Network Connections module landed (PR #10 pipeline + PR #13 detail drawer) + enrich fix + perms/docs

**Shipped**
- **PR [#10](https://github.com/mktahr/vetted/pull/10) merged + prod-applied** (squash `593ce3d`): Network Connections module phase 1 (the pipeline). Migrations 075–078 promoted to prod IN ORDER after the merge deploy (code-then-DB lockstep held; prod deploy confirmed Ready before any DB change). Prod smoke passed: `/network` 200, tables present (0 rows), existing data intact (people 84 / companies 1517), existing `/person/search` ingestion untouched.
- **Enrich path fixed inside PR #10** (the headline feature was shipped untested — PR only smoke-tested the free estimate). Three bugs, all caught in dev browser-testing: (1) wrong Crust field `enrich_by_profile_url` → `professional_network_profile_urls` (400'd every call); (2) parsed a flat shape but Crust returns nested `matches[].person_data.basic_profile` (URL from `matched_on`); (3) empty `matches[]` (true no-match) was counted as "enriched" → added a guard. Verified live: real engineers enriched correctly.
- **PR [#13](https://github.com/mktahr/vetted/pull/13) merged + prod-deployed** (squash `c299d528`): increment 2a — connection detail drawer. `GET /api/network/connections/[id]` + `ConnectionDrawer.tsx` + row-click wiring. Browser-verified. Code only, no migration. Fixes the PR 1 gap ("couldn't see enriched info").
- **Pre-merge branch hygiene:** merged current `main` into the network branch first (carried PR #12 specialty fix + migration 079) — verified via merge-tree simulation that it reverts nothing. (Codex had flagged a "merge reverts PR #12" blocker; disproven — Codex read the two-dot tip diff, not the base...head merge diff.)
- **Permissions fix:** added `Bash(*)` to `.claude/settings.local.json` allow-list (keeping the destructive-ops `ask` guards) so routine dev bash stops prompting. Cross-check commands (`pack codex`/`review codex` + Codex's `pack claude`/`review claude`) added to CLAUDE.md + COMMANDS.md; AGENTS.md (Codex pointer to CLAUDE.md) created by Codex.
- **CLAUDE.md:** new "Network Connections Module" section; migration ledger 075–078 flipped to prod-applied; schema-state header bumped.
- **Logged (BUGS/BACKLOG):** select-all grabs NO rows; classifier missing aero/space disciplines (propulsion/avionics/GNC); drawer ↑↓→should be ←→; review-actions queue-only; hide drawer internal metadata; profile-image source stability; snapshot-only specialty/summary limits; PR 2 detail+integration.

**Decisions**
- Adopted the dedicated-drawer-first path (2a) before any candidate-search integration; integration (2b) deferred pending design decisions.
- Enrich fix belonged on the PR #10 branch (making the PR's own feature work — not scope creep).
- Dev test org wiped after testing (the "fake" CSV handles resolved to real other people via Crust — junk enrichments cleaned).

**Where we left off**
- Network Connections PR 1 + 2a both live on prod. PR 2 (candidate-search integration + admin cross-org view + gated promotion) is next.
- Schema read for PR 2 done: cross-org view supported today; the big gap is reusing the 25-axis search machinery — needs a `people`-projection-with-pool-flag model AND a data-tier decision (the cached `/person/enrich` blob is snapshot-only).

**Open questions**
- PR 2 data tier: snapshot-axes-now (cheap) vs paid rich-enrichment (full 25-axis + full promotion).
- Accept the `people`-projection-with-pool-flag architecture (reverses 075's literal "never write to people," justified by enrichment ≠ promotion)?

**Watch-outs**
- **Don't run `npm run build` while `next dev` is live** — it corrupts `.next` ("Cannot find module './XXXX.js'"); fix is stop dev → clear `.next` → restart.
- Dev-against-dev requires exporting the `_DEV` Supabase vars over the canonical names (script at scratchpad; no committed `npm run dev:dev` yet — candidate for a package.json script).
- Session doc bundle (CLAUDE/COMMANDS/AGENTS + BUGS/BACKLOG) was carried across branch switches via `git stash` — fragile; committed at end-session.

---

## 2026-06-24 — Recovery + specialty resolver dev/prod parity fix (PR #12 + migration 079) + protocol/tooling housekeeping

**Shipped**
- **PR #12 merged to main** (squash → `1e3cedd`), prod-deployed, branch deleted. B-lite fix: `lib/normalize/specialty.ts::loadSpecialtyDictionary()` now reads `specialty_dictionary.parent_function` and derives the scalar function via the single-parent rule (single → `parent_function[0]`; multi-parent → `null`, deferred to sub-PR 3 LLM) — mirrors migration 073's reclassification logic. Localized to that one function; resolver + ingest unchanged.
- **Migration 079 applied to prod** (dev first = no-op, then prod = drop). Drops the orphan `specialty_dictionary.function_normalized` column via `DROP COLUMN IF EXISTS` + fail-loud verification. The column was never created by any migration (001 made it `parent_function`; 072 → `TEXT[]`); it survived only on prod as an out-of-band orphan with stale pre-rebuild umbrella values (`engineering`/`operations`). Dev (built from migrations) lacked it, so the old select threw `400` there and broke `/api/ingest`'s specialty step. Both DBs now converge on the migration-defined schema.
- Verification: `npm run build` clean; dev/prod smoke (old query 400s on dev, new query succeeds both, 0 derivation-invariant violations, `backend`→`software_engineering`, `mechatronics`→`null`); Vercel preview browser-verified; post-drop REST checks (orphan → 400, `parent_function` → 200 on prod).
- **SESSION_HANDOFF.md reconstructed** (`1168fda`) to the true 2026-06-24 state after the previous handoff went stale (the prior day's work never got a clean wrap — local repo was being wiped by iCloud mid-work).
- **`.claude/settings.local.json` created** (personal/gitignored) — Bash approval set: `allow` git/gh/`npm run`/ls/cd/cat/grep/`apply-migration.sh dev`; `ask` (still prompts) for `migrate:prod`, `apply-migration.sh prod`, `rm -rf`/`-fr`, force-push, hard-reset, `git clean -f`.
- **CLAUDE.md + COMMANDS.md doc additions** (in this commit): new "Prompt Output & Copyable-Block Conventions" section — the full-copyable-prompt rule (chat assistant always emits prompts as one consolidated copyable block) + the new `block` command (re-output the previous response as a single plain-text copyable block, on-demand). Migration ledger extended through 079; schema-state header bumped.
- BUGS.md: marked the `specialty_dictionary.function_normalized` drift **Resolved**; the `score-all.mjs` stale-mirror item stays Active.

**Decisions**
- Fix option (b) over (a): drop the redundant orphan column rather than re-adding it to dev. Post-072 its info lives in `parent_function[]`; keeping it would enshrine drift in the wrong direction.
- Multi-parent specialties derive `null` function (NOT `parent_function[0]`) — respects the locked decision that multi-parent rows defer to the sub-PR 3 LLM rather than being deterministically collapsed.
- Held the CLAUDE.md/COMMANDS.md doc changes out of the PR #12 branch commit; folded them into this end-session commit instead.
- DB-code lockstep held: B-lite deployed to prod BEFORE migration 079 dropped the column, so nothing read `function_normalized` at drop time.

**Where we left off**
- Specialty-parity workstream fully closed: merged, prod-deployed, migration applied + verified, BUGS updated. Prod DB + prod code in lockstep.
- This session also surfaced/clarified the true state of earlier 2026-06-24 work: PR #11 (parent_function render hotfix) merged; PR #10 (network connections) still OPEN; session-protocol rename committed (`70a2d78`).

**Open questions**
- None blocking. The next substantive thread is either landing PR #10 (network connections) or resuming five-axis sub-PR 3 (LLM ingest inference) — Matt's call next session.

**Watch-outs**
- **PR #10 (network connections) is open**; its migrations 075–078 are dev-only, not on prod. Promote after merge (dev-first, code-then-DB lockstep).
- **Stale `score-all.mjs`** — still drifted; use `POST /api/admin/rescore-all` for rescoring.
- **Keep the repo off iCloud** — it's now at `~/DEV/vetted`; the old `~/Desktop/DEV` path was being wiped.
- **Free-tier Supabase idle-pause (~7 days)** — restore from the dashboard on NXDOMAIN.

---

## 2026-06-21 — Five-axis taxonomy sub-PR 2b SHIPPED to prod (PR #9 merged + 071–074 promoted + rescore)

**Shipped**
- **PR #9 merged to main** (squash → `fd0e9dd`); branch `five-axis-taxonomy-sub-pr-2b` deleted. Vercel production deploy of `fd0e9dd` confirmed live BEFORE any prod migration (DB-code lockstep held — code led the DB).
- **Migrations 071–074 promoted to prod, in order, each independently verified:**
  - 071 — function_dictionary: **18 active / 18 inactive / 36 total**; 0 `engineering_leadership` function rows (guard rail holds).
  - 072 — specialty_dictionary multi-parent: **225 / 166 / 59**, **45 multi-parent**, `parent_function` now `TEXT[]`, 0 invalid parent refs, 0 active rows with empty parent. Catchall a confirmed no-op on prod (delta −5 = exactly the 5 DELETEs; 0 ghost rows swept).
  - 073 — person/people reclassification: **0 orphan specialty refs remaining**, **6 person_experiences at `data_engineering`**, 1 lone `engineering` row (NULL-specialty, left for sub-PR 3), 0 invalid function refs. Pre-flight matched exactly (126 single-parent reclassified, 10 title-like → NULL, 6 data_engineering lifted, 35 people recomputed).
  - 074 — title_dictionary remap: **7 leadership stay at `engineering`** (CTO/Dir/EM/VP), **28 at `software_engineering`**, **1 at `data_engineering`**; 0 refs to the 5 deleted specialties.
- **Prod rescore via `/api/admin/rescore-all`** (the deployed canonical TS scorer, NOT the stale `score-all.mjs` mirror): **84/84 success, 0 failed, 0 skipped**. Bucket distribution unchanged (vetted 49 / needs_review 35 before and after) — confirmation, not churn. Bucket rows 261 → 345 (append-only).

**Decisions**
- Rescored via the deployed API endpoint instead of `scripts/score-all.mjs`. Discovered mid-session that the `.mjs` is a stale JS mirror whose `degreeRelevance` branches on space/bare function strings (`'software engineering'`, `'hardware'`, `'mechanical'`) and does NOT recognize the underscore taxonomy values (`software_engineering`, `firmware_engineering`, `ml_engineering`, etc.) — running it would have written mis-scored buckets to prod. The API route imports the real `@/lib/scoring`, so it reflects the new taxonomy correctly. Logged the stale mirror to BUGS.
- Unchanged bucket distribution is correct: the `score-candidate.ts` change was a `degreeRelevance` refactor (group-set dispatch + FUNCTION_MAP expansion) that generalizes function→degree mapping without moving existing candidates' point values across the low bucket thresholds (30/35/40/45).

**Where we left off**
- Sub-PR 2b fully shipped: merged, prod-migrated, rescored, verified. Prod DB + prod code in lockstep.
- Session opened with an incident: free-tier Supabase (prod + dev) had auto-paused after ~11 days idle (NXDOMAIN on both API subdomains). Matt restored from the Supabase dashboard; origin boot lag (NXDOMAIN → 521 → 200) cleared on its own. Vercel was healthy throughout — the "Failed to fetch" was purely the paused backend.

**Open questions**
- None blocking. Next in the five-axis build is sub-PR 3 (LLM ingest inference outputting the five-axis tuple incl. `title_normalized`).

**Watch-outs**
- **Stale `score-all.mjs` mirror** — do not use it for rescoring; it has drifted from `lib/scoring/score-candidate.ts`. Use `/api/admin/rescore-all` (deployed TS) until the mirror is fixed or retired. Logged to BUGS.
- **3 pre-existing dangling specialty refs in `title_dictionary`** (`Data Scientist`/`Senior Data Scientist` → `analytics`; `Account Executive` → `enterprise_sales`) — non-engineering, absent from `specialty_dictionary`, unrelated to this workstream. Harmless; logged to BACKLOG.
- **Free-tier pause will recur** — both Supabase projects idle-pause after ~7 days. If a future session opens with NXDOMAIN / "Failed to fetch", restore from the Supabase dashboard first (it's not a code or Vercel problem).

---

## 2026-06-10 — Five-axis taxonomy sub-PR 2b (dev-verified, prod pending)

**Shipped**
- Branch `five-axis-taxonomy-sub-pr-2b` pushed to GitHub (commits `e731eed` + `b838219`). PR not yet opened. URL: https://github.com/mktahr/vetted/pull/new/five-axis-taxonomy-sub-pr-2b
- Migration 071 — `function_dictionary` expansion: 16 new active engineering sub-functions (software, firmware, mechanical, electrical, hardware, chip, systems, controls, robotics, aerospace, materials, manufacturing, test, optics, ml, data). 2 inactive rebrands (product_management, product_design). 16 legacy V1-scope-cut deactivations. Final: 18 active / 18 inactive / 36 total. `engineering_leadership` explicitly NOT a function (verification guard rail).
- Migration 072 — `specialty_dictionary` multi-parent: drops single-value FK, converts `parent_function` from TEXT to TEXT[]. Deletes 4 title-like specialties + 1 redundant (data_engineering). Reparents 137+20+5 active specialties with 45 multi-parent assignments where the discipline genuinely spans categories. Defensive catchall sweeps any specialty with all-inactive parents (no-op on prod, sweeps 12 dev-only ghost rows). Portable verification block (delta + structural invariants) works on both dev and prod despite different pre-migration row counts.
- Migration 073 — `person_experiences` + `people` reclassification: single-parent active specialties get the new function via JOIN; multi-parent stays at `'engineering'` per option (b); orphan cleanup for 5 deleted specialty refs (4 title-like → specialty=NULL; data_engineering → specialty=NULL + function=`'data_engineering'`); `people.current_function_normalized` recomputed from primary current experience.
- Migration 074 — `title_dictionary` remap: Cohort A (20 specialty-driven via JOIN); Cohort B (7 leadership stay at `'engineering'` inactive umbrella per locked override; 10 IC → software_engineering); orphan specialty cleanup mirrors 073 pattern (data engineer title row lifted to function=`'data_engineering'`).
- `lib/scoring/score-candidate.ts` — `degreeRelevance` refactored to dispatch via SW_LIKE / HW_LIKE / MECH_LIKE function-group sets. `FUNCTION_MAP` expanded for all 16 sub-functions. Legacy non-engineering branches preserved.
- ROADMAP item #2 renamed Four-axis → Five-axis. Title axis added (storage plan: `person_experiences.title_normalized` + `people.current_title_normalized` + `ever_titles` in sub-PR 4). Build order expanded to 7 sub-PRs (2a/2b split; calibration broken out as its own item).
- CLAUDE.md — new "Five-Axis Taxonomy (Post-Migrations 069–074)" section. Multi-parent examples, no-FK rationale for `parent_function` TEXT[], title axis design, engineering_leadership-is-not-a-function guard rail. Dictionary table entries updated. Migration ledger extended through 074.
- BACKLOG.md — "Taxonomy Expansion" section with 10 deferred sub-functions (nuclear, biomedical, chemical, environmental, civil/structural, ocean/marine, agricultural, petroleum, mining, audio/acoustic).
- All 4 migrations applied + verified on dev. Prod untouched.

**Decisions**
- Function list locked at 16 active engineering sub-functions + founder + unknown (=18 active). `engineering_leadership` killed as a function — engineering managers / directors / VPs / CTOs sit at function=<discipline> + seniority=manager|director|vp|c_suite (migration 067).
- `data_engineering` added as a function (alongside `ml_engineering`). The `data_engineering` specialty dropped because the function takes its place; person_experiences signal lifted from specialty axis to function axis in 073.
- `parent_function` becomes TEXT[] (multi-parent). No FK constraint — Postgres lacks native multi-value FK; same pattern as `companies.industries[]`. App-layer enforcement in sync-reference.mjs. Semantics: HINT metadata for sub-PR 3 LLM ingest inference, NOT a hard restriction.
- Multi-parent count locked at exactly 45 of 166 active specialties (~27%). Don't over-multi.
- Multi-parent reclassification in 073: option (b) — multi-parent specialty rows stay at function=`'engineering'` until sub-PR 3 LLM picks per-candidate. Deterministic pick would discard information.
- Cohort B leadership titles in 074: 7 rows (CTO / chief technology officer / director of engineering / em / engineering manager / vp engineering / vp of engineering) stay at function=`'engineering'` (inactive). Defaulting to software_engineering would destroy information in hard-tech context where customers hire engineering leadership at hardware / aerospace / robotics / defense companies.
- Fifth axis added mid-session: **title** as a searchable axis alongside function, specialty, skills, industry context. Storage: `title_raw` already exists; `title_normalized` added in sub-PR 4 via LLM ingest inference. No "title family" normalization layer.
- Promotion sequencing: 071/072/073/074 to prod TOGETHER in order, AFTER PR merges + Vercel deploys the code changes. Splitting promotion would put prod DB ahead of prod code.
- Verification blocks: portable design (delta from pre-migration + structural invariants) instead of absolute counts. Works across dev/prod where pre-migration row counts differ.

**Where we left off**
- Branch `five-axis-taxonomy-sub-pr-2b` pushed but PR NOT yet opened.
- Prod untouched. Dev has 071-074 applied + verified.
- Session ended early due to system memory pressure on Matt's machine (closed VSCode to free RAM).

**Open questions**
- None blocking. All design decisions locked through the session.

**Watch-outs**
- **DB-code lockstep is mandatory.** Prod code on Vercel must deploy BEFORE prod migrations run. Otherwise scoring engine falls through default branch of degreeRelevance for new sub-function values — mild degradation (not crash) until deploy completes.
- **Catchall in 072 is no-op on prod** (verified by direct query — the 12 ghost rows that triggered it on dev don't exist on prod).
- **073 expects ~16 orphan refs on prod**: 1 chief_engineer + 1 distinguished_engineer + 2 principal_engineer + 6 engineering_management + 6 data_engineering (last 6 get lifted to function=`'data_engineering'`).
- **Context-compaction drift incident**: mid-session, an earlier context compaction lost the locked function list. CC reintroduced `engineering_leadership` as a function. Matt caught it and corrected. Saved as feedback memory `feedback_surface_context_loss.md` — going forward, CC must flag locked decisions before they drift silently.
- **DEV migrations 071-074 are applied**; dev schema is ahead of prod until prod promotion runs.
- **Multi-parent count locked at 45, NOT 35**: my prior summary "35 multi-parent" was a math error. Verification block enforces =45.
- **`wrap session` discipline matters**: this session almost closed without a formal wrap (memory pressure interpreted as "skip docs update"). Always run the protocol unless explicitly told to skip — SESSION_HANDOFF.md not getting overwritten was the visible failure mode.
- **CHANGELOG gap 2026-05-26 through 2026-06-09**: PRs #4 (sourcing pipeline), #5 (seniority split), #6 (slope_score), #7 (founder-soft-NFT), #8 (skills_dictionary) shipped without per-session CHANGELOG entries. Migration ledger in CLAUDE.md catches up the schema side, but the session-narrative gap remains. Acceptable — git log captures the work; backfilling CHANGELOG retroactively isn't worth the effort.

---

## 2026-05-25 — PR #3 + docs maintenance + End-of-Session Protocol

**Shipped**
- Migration 062 — `signal_dictionary.is_searchable BOOLEAN DEFAULT TRUE` column + dictionary cleanup (30 Under 30 removal, etc.)
- Migration 063 — Universal one-bucket: `UPDATE signal_dictionary SET is_searchable = FALSE` (all rows). Added `is_vc_backed_founder` + `is_bootstrapped_founder` BOOLEAN columns on `people` with partial indexes. Dropped Side Project Founder from signal_dictionary.
- Migration 064 — Seeded `field_of_study_dictionary` with 86 rows → 43 normalized values across 7 domain groups (core_engineering, advanced_engineering, software_cs, physical_sciences, life_sciences, math, design).
- PR #3 pushed to `reference-data-restructure` (commits `d181128` + `6690217`): full UI refactor — drop "Any X" prefix from filter labels, `engineering_team` → "University Team", `competition` → "Engineering Competition", remove legacy Accelerator filter, add Founder Type + Field of Study filters. Drop "Category" sublabel from signal dropdown options.
- VC-backed/bootstrapped derivation logic in `lib/scoring/compute-derived.ts` — auto-reclassifies on rescore.
- **Docs maintenance commit** (`d59e4cf`): new `CHANGELOG.md` at repo root with reverse-chronological session log; CLAUDE.md Documentation Index + Vocabulary updated; `/reference/` tree synced to actual on-disk state (6 missing CSVs added, phantom incubator.csv removed, `dictionaries/` subtree added); migration ledger extended through 064; `supabase/seeds/` File Layout collapsed to deprecation pointer; formal End-of-Session Protocol introduced.
- **Protocol revision** (this commit): expanded the End-of-Session Protocol from 8 steps to 11 — added explicit push step (9), PR merge decision step (10) with readiness-report template and merge ask, renumbered starter-prompt to step 11 so it can reflect post-merge state.

**Decisions**
- Universal one-bucket policy: ALL `signal_dictionary` entries get `is_searchable=FALSE`. Only categories surface as UI filters. Granular search (specific elite olympiads, fellowships) deferred to AI chat search workstream.
- Founder taxonomy is binary (VC-Backed / Bootstrapped); no Unknown bucket. VC-backed gated on: funding rounds OR recorded investors OR linked incubator/accelerator signal OR `current_status IN ('acquired','public')`.
- Field of Study aliases: EECS→ECE, CS→Computer Science, AI/ML→`artificial_intelligence_ml`, Life Sciences umbrella catches biology/biochem/microbiology/genetics; comp-bio + bioinformatics together; neuroscience kept distinct.
- Trigger phrase for End-of-Session Protocol is lowercase exact `wrap session`. Distinct from existing "Wrap up session" status-verification phrase.
- Protocol owns the full lifecycle: docs update → review gate → commit → push → PR-merge-decision gate → starter-prompt with merge status. Two explicit user-approval gates (steps 7 and 10) preserve human-in-the-loop control.

**Where we left off**
- PR #3 ready for merge. Matt confirmed Vercel preview verified. Step 10 readiness report + merge ask is the next protocol step.

**Open questions**
- None outstanding for this workstream.

**Watch-outs**
- **VC-backed founder coverage gap**: backfill yielded 0 VC-backed / 21 bootstrapped because no `company_funding_rounds` rows match any founder's company today (only 41 funding rounds in DB total). Closes as Crust company-funding enrichment lands. Don't read the 0 as a derivation bug.
- Field of study backfill only populated 22 rows — `field_of_study_raw` is sparsely populated on existing candidate base. Coverage grows with new ingests.
- Three UI files share the `SIGNAL_CATEGORY_ORDER` + `SIGNAL_CATEGORY_LABELS` pattern (ProfileTable, ProfileDrawer, search-builder). Any new signal_dictionary category requires edits in all three.
- Sourcing-pipeline workstream files (`app/api/admin/import/`, `docs/pdl/`, `scripts/seed-test-profiles.mjs`, `supabase/migrations/056_…`, `057_…`) remain untracked on this branch. They belong to a separate workstream — do not stage during PR #3 closeout.

---

## 2026-05-20 — Reference data restructure + 6 university signal categories + investor angels

**Shipped**
- Migration 060 — Extended `signal_dictionary.category` CHECK with 6 university-affiliated categories: `university_program`, `university_fellowship`, `university_incubator_accelerator`, `university_lab`, `research_institute`, `student_venture_fund`. Total: 31 categories.
- Migration 061 — Added `investor_tiers.investor_type` column (`vc_firm` / `angel`).
- New `/reference/` folder convention + `scripts/sync-reference.mjs` dispatcher (dry-run / diff / UPSERT / scope flags). Replaces scattered `supabase/seeds/` + ad-hoc seed scripts + the unportable `/Users/matt/Downloads` company-scoring CSV.
- Athletics retiered to 6 rows (D1/Pro/Olympic = tier_3; JrOlympic/D2/D3 = tier_2; 24 sport-specific + club sport rows dropped).
- 19 existing angel rows corrected + 7 new angels seeded (Alana Goyal, Charlie Cheever, Daniel Gross, Jack Altman, Mike Vernal, Sahil Lavingia, Sriram Krishnan).

**Decisions**
- CSV is the source of truth for reference data — never edit directly in Supabase Studio (HARD RULE captured in CLAUDE.md).
- `national_lab` reserved for federal R&D centers only; `fellowship` non-university only; `incubator` independent only. University-affiliated entries move to the new `university_*` categories.
- 5 separate "tier" systems coexist without conflation (signal_dictionary tier_group, investor_tiers.tier, company_year_scores.company_score, teams.tier_int, team_role_scoring_weights.team_role_tier).

**Where we left off**
- Initial branch commits in place; PR #3 created.

**Watch-outs**
- Cascade-deleted 5 `person_signals` rows during athletics retier (test data; acceptable per project memory).

---

## 2026-05-19 — V1 scoring refactor: 3-bucket model + flagged_reasons + admin override (PR #2)

**Shipped**
- Migrations 048–055 + 058 + 059. Collapsed candidate buckets to 3 (vetted / needs_review / flagged). Config tables for signal weights (`signal_scoring_weights`, `team_role_scoring_weights`, `career_stage_bucket_thresholds`). Admin bucket-override endpoint + UI. Founder flag derivation. Founder rank-ordering fix (059). Education + Degree filter in sidebar + search-builder.
- Renamed `entry` → `junior_ic` (migration 048 — ALTER TYPE RENAME VALUE cascade).
- Renamed `non_vetted` → `flagged` for clarity (migration 058).

**Decisions**
- Bucket thresholds intentionally low (30/35/40/45) — curation at ingest is the real gate; the threshold is a safety net.
- `flagged` is admin-only; engine never auto-assigns. Default UI excludes `flagged` from main list.
- CORE weights stay hardcoded in scoring engine; BONUS weights move to config table for tuning without code deploys.

**Watch-outs**
- Skipped migration numbers 056/057 to avoid collision with parallel `sourcing-pipeline-phase1` branch.

---

## 2026-05-11 — SIGNAL_CATEGORY_LABELS audit + backlog updates

**Shipped**
- Full audit of `signal_dictionary` categories vs UI label maps in ProfileTable / ProfileDrawer / search-builder. Direct-to-main.

**Decisions**
- Three-file label-map consistency requirement formalized (ProfileTable.tsx + ProfileDrawer.tsx + search-builder/page.tsx).

---

## 2026-05-10 — Hard-tech university competitions + teams + extended signal_dictionary (PR #1)

**Shipped**
- Migrations 040–047. New tables: `competitions` (21 rows), `teams` (141 rows), `team_competition_map`, `team_domain_tag_dictionary` (17 tags).
- 141 university teams seeded via `scripts/import-teams.mjs` from `supabase/seeds/vetted_teams.csv`.
- 24 olympiad rows + 24 national_lab rows + 24 hackathon rows + 49 publication rows + 45 fellowship rows seeded.
- `engineering_team` category semantic shift: was 24 generic leagues, now holds 141 specific teams (per-school).
- `person_signals_active` view extended with team + competition metadata via LATERAL subquery (no row multiplication).

**Decisions**
- Team membership IS the `person_signals` row (no separate `person_team_memberships` table).
- Slug derivation locked: lowercase + non-alphanumeric→hyphen + drop articles + collapse + strip.

**Watch-outs**
- 37 new schools added during staging; some may be duplicates of existing canonical names (word-order / punctuation variance). Schools-dedup backlog item now includes these.

---

## 2026-05-06 — Lists + GlobalNav + funding/investors + firmographics

**Shipped**
- Migrations 031–039. Lists + saved_searches + hidden_items schema. Notable Investors callout. Funding rounds table. Firmographics columns (description, logo, locations, founders, headcount growth).
- GlobalNav refactor: persistent app bar at layout level (replaces per-page TopNav).
- Companies V1 taxonomy (`category` + `primary_industry` + `industries[]` + `domain_tags[]`) + auto-tagging cron with spend cap.

**Decisions**
- `list_items` is polymorphic by parent list's `kind` (no FK on `item_id`) — single membership table preferred over two parallel tables.
- Supabase RLS auto-enables on `CREATE TABLE`; the fix pattern is a separate follow-up migration (hit four times — 034, 037, 039, plus older).

---

## Pre-CHANGELOG history

Earlier sessions are documented in:
- [CLAUDE.md migration ledger](CLAUDE.md) — migrations 001–055 with per-migration notes
- [ROADMAP.md Recently Completed](ROADMAP.md) — older shipped work
- `git log main` — full commit history
