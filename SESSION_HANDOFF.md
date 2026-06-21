# Session Handoff — 2026-06-21

## Where we left off

Five-axis taxonomy **sub-PR 2b is fully SHIPPED** — PR #9 merged to main, migrations 071–074 promoted to prod (in order, each verified), and a full prod rescore run. Prod DB and prod code are in lockstep. This closes the function/specialty dictionary rebuild portion of the five-axis workstream.

The session also recovered from an infra incident: both free-tier Supabase projects (prod + dev) had auto-paused after ~11 days idle (NXDOMAIN on both API subdomains → the app showed "Failed to fetch"). Restored from the Supabase dashboard; recovered cleanly. Vercel was healthy throughout.

## What's in flight

**Nothing open.** Branch `five-axis-taxonomy-sub-pr-2b` was merged (squash → `fd0e9dd`) and deleted. No open PR. Local is on `main`, up to date, plus this session's wrap-docs commit.

**Prod state after this session:**
- `function_dictionary`: 18 active / 18 inactive / 36 total (16 eng sub-functions + founder + unknown; no `engineering_leadership`).
- `specialty_dictionary`: 225 / 166 / 59, `parent_function` = TEXT[], 45 multi-parent.
- `person_experiences` / `people` / `title_dictionary`: reclassified to the new taxonomy; 0 orphan refs in-scope.
- `candidate_bucket_assignments`: rescored (84/84); distribution vetted 49 / needs_review 35 (unchanged — refactor preserved scores).

## Next thing to do

**Sub-PR 3 of the five-axis rebuild: ingest-side LLM-assisted per-experience inference.** Outputs the five-axis tuple (function, specialty, skills, industry context, `title_normalized`) constrained to the controlled vocabulary (active `function_dictionary` + active `specialty_dictionary` + active `skills_dictionary`). Precedent to follow: the existing `lib/companies/tagger/` pattern (Claude Haiku single-shot classification). This is where multi-parent specialties + the 1 lone `engineering` person_experience + legacy `current_function_normalized` values (engineering/product/operations tails) get reclassified per-candidate.

See ROADMAP.md item #2, build order step 3.

## Open questions

- None blocking. Sub-PR 3 design (prompt shape, which fields feed the LLM, confidence thresholds, how `title_normalized` canonicalization works) is the first thing to scope when picking it up.

## Watch-outs

- **Stale `score-all.mjs`** — drifted from `lib/scoring/score-candidate.ts`; mis-scores the underscore taxonomy. Use `POST /api/admin/rescore-all` for any rescore. Logged to BUGS.
- **Free-tier Supabase idle-pause recurs (~7 days).** If a session opens with NXDOMAIN / "Failed to fetch", restore both projects from the Supabase dashboard FIRST — it's not a code or Vercel problem. (Vercel Hobby keeps the last deploy live; the data layer is what pauses.)
- **3 pre-existing dangling specialty refs in `title_dictionary`** (`analytics`, `enterprise_sales`) — non-engineering, harmless, logged to BACKLOG for a future integrity sweep.
- **DB-code lockstep is the rule for any future prod taxonomy/scoring change**: deploy the code to prod first, then promote the DB. We held it this session and it paid off.
