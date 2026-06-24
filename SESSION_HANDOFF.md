# Session Handoff — 2026-06-24 (end of session)

## Where we left off

**Specialty resolver dev/prod parity workstream — fully closed.** PR #12 merged to
main (squash `1e3cedd`), prod-deployed, branch deleted; migration 079 applied to
prod (dev first = no-op) and verified. Prod DB + prod code in lockstep, both DBs
now on the migration-defined schema.

- **B-lite fix** — `lib/normalize/specialty.ts::loadSpecialtyDictionary()` reads
  `specialty_dictionary.parent_function` and derives the scalar function via the
  single-parent rule (single → `parent_function[0]`; multi → `null`, deferred to
  sub-PR 3 LLM). Mirrors migration 073. Fixes the dev-only `/api/ingest` `400` and
  the stale-umbrella prod ingest (`backend` now → `software_engineering`, not
  `engineering`).
- **Migration 079** — dropped the orphan `function_normalized` column from prod
  (`DROP COLUMN IF EXISTS` → no-op on dev). Post-drop checks: orphan select → 400,
  `parent_function` select → 200.

This session also reconstructed the previous (stale) handoff and confirmed the true
2026-06-24 state of earlier work, plus housekeeping (see below).

## What's in flight

**PR #10 — Network Connections module (PR 1 of 2)** — branch
`network-connections-module`, **OPEN, not merged**, base `main`. Org-scoped, siloed
warm-intro layer (CSV upload → canonicalize → 3-bucket classify → Haiku triage →
optional Crust enrich → admin view). Migrations **075–078 are dev-only, NOT on
prod** — promote after merge (dev-first, code-then-DB lockstep). PR 2 (search-filter
integration) is a future stacked branch, not started.

**Local repo:** `~/DEV/vetted` (off iCloud), on `main`, synced with origin, clean
after this session's end-session commit.

## Next thing to do

Pick the thread (Matt's call — don't assume):
- **(a) Land PR #10** — browser-verify the network-connections Vercel preview, merge,
  then promote migrations 075–078 to prod (dev-first, code-then-DB lockstep). Then
  PR 2 (search-filter integration).
- **(b) Resume five-axis sub-PR 3** — ingest-side LLM per-experience inference
  outputting the five-axis tuple incl. `title_normalized`, constrained to the active
  controlled vocabulary. Precedent: `lib/companies/tagger/` (Haiku single-shot).
  This is where multi-parent specialties (which B-lite now leaves `null`) get
  resolved per-candidate. ROADMAP item #2, build step 3.

## Open questions

- Thread (a) vs (b) above.
- Sub-PR 3 design (prompt shape, fields fed to the LLM, confidence thresholds,
  `title_normalized` canonicalization) still unscoped whenever it's picked up.

## Watch-outs

- **PR #10 migrations 075–078 are dev-only**, not on prod. Promote only after merge.
- **Stale `score-all.mjs`** — drifted from `lib/scoring/score-candidate.ts`; use
  `POST /api/admin/rescore-all` for any rescore. (Still Active in BUGS.)
- **Keep the repo off iCloud** — now at `~/DEV/vetted`; the old `~/Desktop/DEV` path
  was being wiped mid-work.
- **Free-tier Supabase idle-pause (~7 days)** — on NXDOMAIN / "Failed to fetch",
  restore both projects from the Supabase dashboard first; not a code/Vercel problem.
- **DB-code lockstep** is the rule for any prod taxonomy/scoring/migration change:
  deploy code to prod first, then promote the DB. Held it again this session.
- **3 pre-existing dangling specialty refs in `title_dictionary`** (`analytics`,
  `enterprise_sales`) — non-engineering, harmless, logged to BACKLOG.
