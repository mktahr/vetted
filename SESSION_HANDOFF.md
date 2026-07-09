# Session Handoff — for the next Claude Code session

_Last session: 2026-07-08 (later session) — the five-axis sub-PR 3 MERGE ARC, executed gated end-to-end: prod migrations 085–097, skills sync, full classifier run, THE FLIP merged (PR [#16](https://github.com/mktahr/vetted/pull/16) → `4c93378`), post-merge full re-score._

## Where we left off
**Sub-PR 3 is MERGED, LIVE on prod, and re-scored.** The arc: cascade plan + 2 Codex review rounds BEFORE any prod write → snapshots (`_mergearc_20260708` schema, still on prod as rollback insurance) → prod migrations 085/086/087/090/091/093 + NEW 094 (role_specialty_map remap) / 095 (founder→unknown cascade incl. title_dictionary) / 096 (dev-parity: a pre-run simulation caught 4 prod-only drift specialties that would have broken the frozen vocab hash, incl. a `robotics_engineering` function-name collision) / 097 (claim RPC — prod PostgREST 14.1 mis-executes `PATCH+or=`: 42703 with named returning, silent execute-with-empty-representation with `select=*`) → scoped skills sync (prod 18→192) → **prod vocab byte-identical to frozen dev** (150/17/192, hash `33c400c8`) → full classifier run (**129/129 done, 996/996 experiences, 0 val-fails, ~$1.6**, five spot-checks matching accepted eval behavior) → flip PR #16 (Codex adversarial: 1 blocker fixed — strict-current mode now also ignores ended-only candidates' past roles) → Matt browser-verified the preview → squash-merged → **full re-score: 73/56 → 82 vetted / 47 needs_review** (9 promotions, all upward, incl. Michael Olson 32.5→47.5 vetted; distribution judged trustworthy).

## What's in flight
- **Nothing.** On `main`, working tree clean (after the end-session docs commit), no open PRs, no feature branches. Prod deploy `4c93378` serving the flip.
- The daily classify-pending cron is LIVE (13:00 UTC, `CRON_SECRET`, RPC claim) — new candidates classify with ~24h latency by accepted design.

## Next thing to do
Matt's pick (both roadmap-sequenced):
1. **Taxonomy sub-PR 4** — aggregated candidate-level columns (`current_title_normalized`, `ever_titles`, person-level skills view) + the extension skills-scrape fix + deterministic alias matcher (BACKLOG item, trigger met).
2. **Network list-building + CSV export** — the GTM unlock (lists from connections + any-list→Google-Sheets-ready CSV).
Fast-follows from the arc, whenever convenient (all small, in BUGS.md): inherited-ⓘ tooltip (Matt's copy specified), PostgREST 14.1→14.5 parity upgrade, ingest-time classify hook.

## Open questions
- When to bump PROMPT_VERSION for `next-prompt-queue.md` rules (recommend: own tuning cycle, regenerate the aging Opus reference FIRST).
- Bucket-B pool-boundary calls (sysadmin / IT-infra / GTM Engineer / Prompt Engineer) — carried.
- When to run the companies-scoring coverage pass (SeJun-class: candidates whose employers have zero `company_year_scores` are structurally pinned at senior-career — now the scoring bottleneck; pairs with the companies-CSV/two-lists deferred architecture).

## Watch-outs
- **Prod PostgREST is 14.1** (dev 14.5): supabase-js `.update().or()` conditional mutations are UNSAFE on prod — silent execute-but-report-nothing. Conditional writes go through SQL RPCs (see 097). After psql DDL, `NOTIFY pgrst, 'reload schema'` before REST sees new functions.
- **Prod vocab == dev vocab is now a live invariant** (the classifier hash depends on it). Any vocab change must land on BOTH DBs dev-first, or the hash forks against the frozen prompt.
- `_preview` columns + `populate-preview.ts`/`populate-inferred-prod.ts` are VESTIGIAL post-flip — cleanup pass later; never reuse for live data.
- `_mergearc_20260708` snapshot schema on prod: drop after a few days of stability (`DROP SCHEMA _mergearc_20260708 CASCADE;`).
- Classifier batch sizing: ~20/call is comfortable; 50 real candidates can blow Vercel's 300s ceiling (fencing self-heals, but avoid).
- Manual `people/[id]` PATCH edits re-queue classification but the edited legacy values do NOT flow into inferred axes (documented gap, BUGS).
- Carried: dup-ingest race (Aadhya's duplicated rows still visible); Opus eval reference aging; `reference/eval/*` is PII, gitignored; scores now FRESH as of the 2026-07-08 re-score.
