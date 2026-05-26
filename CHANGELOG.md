# Vetted — Changelog

Reverse-chronological running log of work sessions. Each entry: what shipped, what was decided, where we left off, open questions, watch-outs.

Updated automatically by the End-of-Session Protocol when Matt types "wrap session". For sequenced upcoming work see [ROADMAP.md](ROADMAP.md). For deferred features see [BACKLOG.md](BACKLOG.md). For engineering context see [CLAUDE.md](CLAUDE.md).

---

## 2026-05-25 — PR #3: Universal one-bucket filters + Founder taxonomy + Field of Study

**Shipped**
- Migration 062 — `signal_dictionary.is_searchable BOOLEAN DEFAULT TRUE` column + dictionary cleanup (30 Under 30 removal, etc.)
- Migration 063 — Universal one-bucket: `UPDATE signal_dictionary SET is_searchable = FALSE` (all rows). Added `is_vc_backed_founder` + `is_bootstrapped_founder` BOOLEAN columns on `people` with partial indexes. Dropped Side Project Founder from signal_dictionary.
- Migration 064 — Seeded `field_of_study_dictionary` with 86 rows → 43 normalized values across 7 domain groups (core_engineering, advanced_engineering, software_cs, physical_sciences, life_sciences, math, design).
- PR #3 pushed to `reference-data-restructure` (commits `d181128` + `6690217`): full UI refactor — drop "Any X" prefix from filter labels, `engineering_team` → "University Team", `competition` → "Engineering Competition", remove legacy Accelerator filter, add Founder Type + Field of Study filters. Drop "Category" sublabel from signal dropdown options.
- VC-backed/bootstrapped derivation logic in `lib/scoring/compute-derived.ts` — auto-reclassifies on rescore.

**Decisions**
- Universal one-bucket policy: ALL `signal_dictionary` entries get `is_searchable=FALSE`. Only categories surface as UI filters. Granular search (specific elite olympiads, fellowships) deferred to AI chat search workstream.
- Founder taxonomy is binary (VC-Backed / Bootstrapped); no Unknown bucket. VC-backed gated on: funding rounds OR recorded investors OR linked incubator/accelerator signal OR `current_status IN ('acquired','public')`.
- Field of Study aliases: EECS→ECE, CS→Computer Science, AI/ML→`artificial_intelligence_ml`, Life Sciences umbrella catches biology/biochem/microbiology/genetics; comp-bio + bioinformatics together; neuroscience kept distinct.

**Where we left off**
- PR #3 pushed, awaiting Vercel preview verification in incognito browser before merge to main.
- Next session first task: verify preview deploy renders Founder Type + Field of Study filters correctly, then merge PR #3.

**Open questions**
- None outstanding for this workstream.

**Watch-outs**
- **VC-backed founder coverage gap**: backfill yielded 0 VC-backed / 21 bootstrapped because no `company_funding_rounds` rows match any founder's company today (only 41 funding rounds in DB total). Closes as Crust company-funding enrichment lands. Don't read the 0 as a derivation bug.
- Field of study backfill only populated 22 rows — `field_of_study_raw` is sparsely populated on existing candidate base. Coverage grows with new ingests.
- Three UI files share the `SIGNAL_CATEGORY_ORDER` + `SIGNAL_CATEGORY_LABELS` pattern (ProfileTable, ProfileDrawer, search-builder). Any new signal_dictionary category requires edits in all three.

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
