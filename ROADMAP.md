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
2. **AI chat search + auto-tagging** — THE wedge feature. Must ship pre-launch. Natural-language search over candidates + companies; auto-tagging of new candidates as they're ingested. Scope to be defined.
3. **Landing page + auth + admin vs user pages** — public marketing surface, login flow, role separation. Required for any external user.
4. **Kebab dropdown / recruiter view** — admin/recruiter view toggle via `?view=` URL param + global nav toggle. Hides admin-only signals (bucket badges, score breakdown, flagged_reasons, clearance section, Bucket column on main list) when in recruiter view. Affects ProfileTable, ProfileDrawer, profile/[id]/page.tsx, admin/companies/*. Scope ~0.5 day.
5. **Signals column on the main candidate table** — currently signals only render in the drawer + profile page. Recruiters scanning the list need to see why a candidate is interesting at a glance. Pattern: top 3–5 chips per row + `+N` overflow popover (mirroring the Company column's multi-subcategory pattern). Scope tight — 2–3 days max. Should NOT slip the AI chat search project; signals column is table stakes, AI chat is the actual product moment.
6. **Modular columns** — admin-selected column visibility on the main list. Phased: (a) localStorage-persisted column-visibility checklist behind a "Columns" button in the table toolbar (~100 LOC); (b) DB-persisted preference once auth lands; (c) per-user role defaults. User has repeatedly asked — high latent value.
7. **PhD Researcher bucket** — only if time permits before launch. Dedicated bucket / classification for academic researchers (PhDs, postdocs, faculty). Distinct scoring profile from operators. Lower priority than items 1–6.

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
