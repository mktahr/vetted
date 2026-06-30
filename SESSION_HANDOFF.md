# Session Handoff — 2026-06-29 (end of session — gated promotion)

## Where we left off

**Network Connections PR 2 (gated promotion + admin cross-org view) is MERGED + live on prod.**
- **PR [#15](https://github.com/mktahr/vetted/pull/15)** squash-merged to `main`; branch `network-connections-gated-promotion` deleted. Prod deploy of `main`.
- **Migration 082** (`connections.pool_override` + `people.promoted_from_connection`) applied dev + prod.
- Delivers: promotion = flag flip `record_kind` network_connection→both + `person_id` link (no re-pay/re-enrich/re-score); vetted-company auto-rule (`review_status='vetted'`) + manual `pool_override` (final say); **demote-safety guard** (a native candidate is NEVER removed from the pool); admin cross-org view on the profile page + candidates drawer + a subtle list chain icon; connection-drawer rich-enrichment display fix; persistent org→connections navigation.
- **Proven end-to-end on REAL data:** uploaded 17 real LinkedIn profiles to "Test Organization One", enriched 10 (Notion + Robinhood), promoted **Annie Cheng** into the candidate pool with a full profile.
- **`codex loop`** (new command this session) ran a pre-merge adversarial review: DO-NOT-SHIP → 3 real fixes folded in (candidate-ingest provenance clear, fail-closed sibling read, row-count-verified guards). 4th finding (no auth) consciously deferred.

## What's in flight

**Nothing open.** No open PRs. `main` clean + synced. The PR 2 arc is complete.

## Next thing to do

Matt's pick between two threads (both teed up):
1. **Companies CSV-curation + two-lists rework** (newly backlogged + saved to memory `companies-csv-two-lists`). Build `export-companies.mjs` → committed `reference/companies/company_roster.csv` + a diff-only sync-back for `review_status`/scores; split List 1 (all 1517 auto-created companies) from List 2 (the searchable scored+vetted set, ~767/99); make searchable views default to List 2. **This also resolves the gated-promotion eligibility-rule question** (vetted flag is noisy — 0 of 9 score-5 companies are vetted). Matt was reviewing `/Users/matt/Downloads/vetted-companies-ALL.csv` to decide.
2. **Five-axis sub-PR 3 — LLM ingest inference** (the next taxonomy build). Reads full work history/skills/descriptions to infer function/specialty/title. Today's classification is title-dictionary only; the rich enriched data is now stored and ready to feed it.

## Open questions

- **Gated-promotion eligibility rule:** keep `review_status='vetted'` (current, narrow/noisy) vs switch to score-based vs threshold. Isolated in `desiredInPool()` (one-line change). Tied to the companies-curation decision above.
- **App-wide auth/admin workstream** (ROADMAP item 4): Matt agreed to do auth properly app-wide (not bolt onto the two new network routes). All service-role routes are currently open (pre-launch, single-admin) — the deferred Codex finding.

## Watch-outs

- **Test data in prod:** "Test Organization One" (`org_id=76f902eb-1bb8-45ff-9568-d04c9db84443`) + 17 real connections; **Annie Cheng + any other promoted connections are in the REAL candidate pool** as `record_kind='both'`. To remove: delete org `76f902eb…` (cascades connections/owners) + the promoted `people` rows. (`seed-gated-promotion-demo.mjs --cleanup` only handles the earlier MOCK fixture, already cleaned — it does NOT touch the real uploaded data.)
- **Athletics extractor false-positive** (BUGS.md): "olympian"/"olympic" matches context-free (hit Annie's Airbnb role description "Online Olympian & Paralympian festivals"). Her bad signal was deleted manually but **re-fires on any re-extract/rescore** until the extractor is fixed.
- **Deferred (logged) gated-promotion edge:** candidate-ingest→`both` symmetric promote — a `network_connection` person who is later candidate-ingested stays `network_connection` (not auto-promoted to the pool). The DEMOTE side of this edge is now fixed (Codex critical); the PROMOTE side is still deferred (BACKLOG).
- **`scripts/seed-gated-promotion-demo.mjs`** left untracked (throwaway; not merged).
- **Free-tier dev Supabase idle-pause (~7 days)** — restore from dashboard on NXDOMAIN.
- **`migrate:prod` is a deliberate `ask` guard** — prompts on every prod migration by design.
- Use `POST /api/admin/rescore-all` for rescores (`scripts/score-all.mjs` is a stale mirror).
