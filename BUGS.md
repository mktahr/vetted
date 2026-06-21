# Vetted — Bugs & Small Fixes

Items that take less than ~0.5 day each. For larger deferred features see [BACKLOG.md](BACKLOG.md). For sequenced upcoming work see [ROADMAP.md](ROADMAP.md).

---

## Active

- **`scripts/score-all.mjs` is a stale scoring mirror — do not use for rescoring.** Surfaced 2026-06-21 during the sub-PR 2b prod rescore. The script reimplements scoring in JS (a "mirror of `lib/scoring`") but its `degreeRelevance` branches on space/bare function strings (`'software engineering'`, `'hardware'`, `'mechanical'`, `'robotics'`) and does NOT recognize the underscore taxonomy values actually stored (`software_engineering`, `firmware_engineering`, `ml_engineering`, `data_engineering`, etc.) — so it mis-scores nearly every engineering candidate's degree-relevance component. **Use `POST /api/admin/rescore-all` (imports the real `@/lib/scoring`) for any prod rescore.** Fix options: (a) retire `score-all.mjs` and point all rescore paths at the API route / a thin Node wrapper that imports the TS engine, or (b) regenerate the mirror from current `score-candidate.ts`. Option (a) preferred — a hand-maintained mirror will keep drifting. ~0.5 day for (a).

- **Flags-only quick edit.** Admin can edit flags only via the bucket override popover today (which requires picking a bucket). Add a flag-only popover that inserts a new `candidate_bucket_assignments` row with the SAME bucket but edited `flagged_reasons`. Reuses the existing `POST /api/admin/bucket/[person_id]` endpoint with `bucket=current`. ~50 LOC.

- **Field of study filter (companion to Degree).** PR A added Degree-level filtering (Bachelor's / Master's / MBA / etc.) but not Field of Study (Computer Science / Electrical Engineering / Mechanical Engineering / Finance / etc.). Data already exists: `person_education.field_of_study_normalized`. Add a multi-select alongside the Degree filter in both the sidebar (Where they studied section) and build-a-search (Who they are section). Options pulled from `field_of_study_dictionary` if seeded, else `DISTINCT field_of_study_normalized` from the data. ~50 LOC. May need a separate seed migration for canonical normalization (the `field_of_study_dictionary` table is currently empty per CLAUDE.md).

- **Include-current-founders filter toggle.** Today current founders are excluded from the default candidate list with no UI to opt back in. Add a checkbox to FilterSidebar ("Include current founders" — off by default) and wire to the `filteredPeople` filter at [app/components/ProfileTable.tsx](app/components/ProfileTable.tsx). Pairs naturally with the kebab/recruiter-view PR.

- **Rescore-on-seniority-change endpoint.** When admin edits a candidate's seniority manually (`career_stage_override` or per-experience `seniority_normalized`), trigger a rescore so the new bucket reflects the edit immediately. **Gated on the admin field editor UI being built first** (no UI exists for editing seniority yet). ~50 LOC once the UI exists.

- **`isStudentTitle` regex limitation at ingest derive-current step.** [app/api/ingest/route.ts](app/api/ingest/route.ts) only matches title patterns (`intern|internship|co-op|student`). Crust v2 sometimes returns `employment_type='Internship'` on roles with non-student titles like "Flight Test Engineering" — those slip through the filter. Cross-check `employment_type='internship'` once that signal is consistently populated in v2 responses. Mitigated for now by `is_primary_current` being checked first (Crust's `is_default` flag wins over heuristics).

- **National Labs `company_groups` seed not yet run against prod.** `scripts/seed-national-labs-company-group.mjs` is staged but hasn't executed. Re-run periodically as Crust ingest adds national lab companies to the `companies` table. The signal_dictionary `national_lab` category (24 rows) already provides text-based detection; this script adds clean filter-UX via `company_groups` when the companies are FK-linkable.

- **Concurrent-ingest race on `companies` name-only inserts.** `upsertCompany` (post-`company-mapper-enrich-minimal` merge) handles the `linkedin_url` UNIQUE collision via 23505 re-resolve, but two ingests of a never-seen-before company *without* a LinkedIn URL (e.g. concurrent Chrome extension scrapes) can still create duplicate rows because `companies.company_name` has no UNIQUE constraint. Low impact today — extension throughput is single-user, Crust import always has a `linkedin_url` to dedupe by. **Blocked on schools-dedup-style pass:** fix is a case-insensitive UNIQUE on `company_name` (or a generated `company_name_lower` column) — not safe to add without first deduping existing case-variant duplicates.

- **Crust Data API confirmations.** Five questions to confirm directly with Crust:
  - Exact JSON shape for the `exclude_profiles` parameter on `/screener/persondb/search`
  - Whether a `years_of_experience` filter is supported (to pre-filter by experience server-side)
  - Full list of valid `SENIORITY_LEVEL` values accepted by the filter
  - Whether a `school` filter is available
  - Direct URL to the full authenticated API docs (current docs are public-facing and partial)
