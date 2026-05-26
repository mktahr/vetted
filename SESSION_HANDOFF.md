# Session Handoff

> Overwritten on every `wrap session` execution. Latest only — no history.
> Historical record lives in [CHANGELOG.md](CHANGELOG.md).

## Where we left off

PR #3 merged to main (commit `c5eae44`, 2026-05-25) — bundled the reference-data restructure (migrations 060–064), universal one-bucket filter policy, Founder taxonomy (VC-Backed / Bootstrapped), Field of Study dictionary, CHANGELOG.md introduction, and the formal End-of-Session Protocol. All migrations 060–064 already applied to prod DB during the session; Vercel auto-deploy from main is in flight.

## What's in flight

- Current branch: `main` (clean after PR #3 merge).
- No open PRs.
- Untracked locally and intentionally not on main: sourcing-pipeline workstream files (`app/api/admin/import/`, `docs/pdl/`, `scripts/seed-test-profiles.mjs`, `supabase/migrations/056_…`, `057_…`). These belong on the `sourcing-pipeline-phase1` branch — ROADMAP "Current Build" tracks it.

## Next thing to do

Resume Sourcing Pipeline — phase 1: check out `sourcing-pipeline-phase1`, move the locally-untracked sourcing files onto that branch, and decide whether to ship the phase-1 schema (migrations 056 + 057) standalone or wait until phase 2 wiring lands. ROADMAP "Current Build" has the framing; phase 2+ scope is TBD.

## Open questions

- VC-backed founder taxonomy: 0/21 backfilled today because no `company_funding_rounds` exist for any founder's company. Re-runs derivation automatically on rescore — flag when Crust company-funding enrichment lands and check coverage moves off zero.

## Watch-outs

- Three UI files share `SIGNAL_CATEGORY_ORDER` + `SIGNAL_CATEGORY_LABELS` (ProfileTable, ProfileDrawer, search-builder) — any new signal_dictionary category requires edits in all three or it won't render in filter chips.
- Reference data: never edit directly in Supabase Studio. CSV in `/reference/` is the source of truth; `node scripts/sync-reference.mjs` is the only path. HARD RULE in CLAUDE.md.
- Field of study `field_of_study_raw` coverage is sparse on the existing candidate base (22 backfilled). Grows organically with new ingests.
- Founder rank in `seniority_dictionary` is 8 (highest), not 6 — migration 059 fix. Check `highest_seniority_reached` derivation if anything seniority-ranking-adjacent surprises you.
