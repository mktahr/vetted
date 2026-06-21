# Session Handoff — 2026-06-10

## Where we left off

Five-axis candidate taxonomy rebuild — sub-PR 2b is COMPLETE on dev, NOT yet promoted to prod. Branch `five-axis-taxonomy-sub-pr-2b` pushed to GitHub but no PR opened yet.

Session ended early due to system memory pressure on Matt's machine (closed VSCode to free RAM). Work was committed safely; no formal `wrap session` protocol executed — CHANGELOG.md not yet updated for this session, this handoff is the only artifact.

## What's in flight

**Branch:** `five-axis-taxonomy-sub-pr-2b`
**Pushed:** yes, to `origin/five-axis-taxonomy-sub-pr-2b`
**PR:** NOT yet opened. URL to create: https://github.com/mktahr/vetted/pull/new/five-axis-taxonomy-sub-pr-2b
**Commit:** `e731eed` — 8 files, 1569 insertions, 28 deletions

**Migrations in the branch (all dev-applied + verified, prod pending):**
- `071_function_dictionary_expansion_and_v1_scope_cut.sql` — 16 active sub-functions + 18 inactive (18a/18i/36 total)
- `072_specialty_dictionary_multi_parent_and_reparenting.sql` — drops FK, converts parent_function to TEXT[], reparents 137+20+5 active specialties under new taxonomy, defensive catchall sweeps ghost rows. 45 multi-parent assignments locked. Dev result: 202 total / 156 active / 46 inactive / 45 multi-parent (prod expected: 225 / 166 / 59 / 45)
- `073_reclassify_person_data_to_new_taxonomy.sql` — person_experiences + people reclassification, single-parent active gets the new function, multi-parent stays at 'engineering' per option (b), orphan cleanup (4 title-like → NULL specialty, data_engineering → NULL specialty + function='data_engineering')
- `074_title_dictionary_function_remap.sql` — Cohort A (20 specialty-driven), Cohort B (7 leadership stay at 'engineering' inactive umbrella per locked override; 10 IC → software_engineering), orphan specialty cleanup mirrors 073

**Code changes (in the same commit):**
- `lib/scoring/score-candidate.ts` — SW_LIKE / HW_LIKE / MECH_LIKE function-group sets in degreeRelevance, FUNCTION_MAP expanded for all 16 sub-functions, engineering_leadership branch removed (killed as a function — it's a seniority)

**Doc updates (in the same commit):**
- ROADMAP.md — item #2 renamed Four-axis → Five-axis, title axis added, build order expanded to 7 sub-PRs
- CLAUDE.md — new "Five-Axis Taxonomy" section with multi-parent examples + no-FK rationale + engineering_leadership-is-not-a-function guard rail
- BACKLOG.md — "Taxonomy Expansion" section with 10 deferred sub-functions

## Next thing to do

**1. Open the PR** for `five-axis-taxonomy-sub-pr-2b` → `main`. Title suggestion: "Five-axis taxonomy sub-PR 2b: function + specialty rebuild".

**2. After PR review + merge to main**, wait for Vercel to deploy the code changes. CRITICAL: don't promote prod DB ahead of code — would degrade scoring engine until deploy completes (score-candidate.ts on Vercel needs to know about the new function values BEFORE the DB starts returning them).

**3. Promote 071/072/073/074 to prod TOGETHER in order:**
```bash
npm run migrate:prod -- supabase/migrations/071_function_dictionary_expansion_and_v1_scope_cut.sql
npm run migrate:prod -- supabase/migrations/072_specialty_dictionary_multi_parent_and_reparenting.sql
npm run migrate:prod -- supabase/migrations/073_reclassify_person_data_to_new_taxonomy.sql
npm run migrate:prod -- supabase/migrations/074_title_dictionary_function_remap.sql
```

**4. Verify prod state** matches expected numbers:
- 071: 18 active / 18 inactive / 36 total in function_dictionary
- 072: 225 total / 166 active / 59 inactive / 45 multi-parent in specialty_dictionary (delta -5 from pre-migration)
- 073: pre-flight diagnostic will print actual reclassification counts (expect ~6 data_engineering lifts + ~10 title-like orphan NULLs)
- 074: leadership_still_eng=7, software_engineering_count=28, data_engineering_count=1

**5. After prod verification, formal `wrap session`** — updates CHANGELOG.md, SESSION_HANDOFF.md, ROADMAP.md recently-completed, then closes the sub-PR 2b workstream.

## Open questions

None blocking — all design decisions were locked through the prior session. The remaining work is mechanical (open PR, merge, promote, verify).

## Watch-outs

- **DB-code lockstep is mandatory.** Prod code on Vercel must deploy BEFORE prod migrations run. Otherwise the scoring engine falls through to the default branch of degreeRelevance for all new sub-function values, which would mildly degrade scoring (not crash, just suboptimal) until deploy completes.
- **Catchall in 072 is a no-op on prod** (verified by direct query during dev verification — the 12 ghost rows that triggered it on dev don't exist on prod). Don't be alarmed if the prod log shows 0 rows swept.
- **073 expects orphan refs on prod.** Earlier prod inspection showed 16 person_experiences rows referencing the 5 deleted specialty values (1 chief_engineer + 1 distinguished_engineer + 2 principal_engineer + 6 engineering_management + 6 data_engineering). 073 step 2 NULLs the first 10; step 3 lifts the 6 data_engineering rows to function='data_engineering'.
- **DEV migrations 071-074 are applied.** If dev needs to be reset for any reason, the schema is now ahead of prod. Catch-up on prod will reconcile.
- **Two sub-PRs already shipped earlier in the five-axis rebuild:** sub-PR 1 (founder-soft-NFT fix, PR #7) and sub-PR 2a (skills_dictionary, PR #8, migrations 069/070). Sub-PR 2b (this branch) is the third.
- **Sub-PRs 3-7 are next after 2b ships:** LLM ingest inference → per-experience storage + derived columns → UI → scoring engine → calibration. See ROADMAP.md item #2.
