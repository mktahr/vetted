# Session Handoff — 2026-06-29 (end of session)

## Where we left off

**Network Connections PR 2b (enriched-connection search integration) is MERGED + live on prod.**
- **PR [#14](https://github.com/mktahr/vetted/pull/14)** squash-merged to `main` (`0f8aad2`); branch `network-connections-pr2b` deleted (local + remote). Prod deploy of `main` confirmed **green**.
- **Migrations 080 (`people.record_kind`) + 081 (`connections.person_id`)** applied to dev + prod earlier in the session (inert until this code shipped). Prod post-deploy smoke: 84 people, all `record_kind='candidate'`, 0 connections, both columns present — the new pool filter is a verified no-op, candidate pool intact.
- PR 2b delivers: enriched connections projected into `people` (`record_kind='network_connection'`) so the existing 25-axis search machinery is reused, **excluded from the default pool** (enrichment ≠ promotion); search-within-connections scope (org/employee). Built increment-by-increment (probe → migrations → filters → freshness → enrich mapper → `writeCanonicalProfile` extraction → `projectConnection` → search UI), each verified before the next; two Codex pressure-tests folded in (architecture) plus a third pre-merge review (5 findings, all fixed: freshness enforcement, merge link-before-promote + checked errors + repair-on-rerun, scope org_id filter, surfaced query errors, loading state).

## What's in flight

**Nothing open.** No open PRs. `main` clean + synced. Working tree clean after this handoff commit.

**Local repo:** `~/DEV/vetted`, on `main`.

## Next thing to do

**Network Connections — GATED PROMOTION** (the next PR 2 sibling). Admin flips a connection from `network_connection` → the general pool, **gated on: company is vetted in our system AND the candidate passes our normal bar/checkpoints**. Mechanically: flip `record_kind` `network_connection`→`both` + ensure the link (no re-pay — the row is already projected and scored). The promotion bar **reads the score written at projection time** (connections are scored when projected, per the locked Q2 decision). Forms: manual add / add-anyone / future auto-rule (scored company → eligible).

After gated promotion: **ADMIN CROSS-ORG VIEW** — for a given candidate, show every org + individual connected to them (schema already supports via `canonical_url` + `connection_owners`; no migration needed).

## Open questions

- **Define "passes our normal bar"** for promotion — "company is vetted" is concrete; the candidate-bar / checkpoint criteria need spec'ing (bucket threshold? manual review? both?). Decide before building the auto-rule.

## Watch-outs

- **Prod network module is empty (0 connections, and orgs likely 0).** To exercise projection end-to-end on prod you must first upload a `Connections.csv` (an org + employee) → classify → enrich → then `POST /api/network/project`. The full projection + merge + stale-refusal flow was verified on **dev** this session, not prod.
- **Committed automated tests for `projectConnection` do NOT exist** — it transitively imports `@/lib` via `write-canonical`, which the node type-strip test loader can't resolve, so a pure unit test can't import it. Coverage is the manual dev-integration harness (in the session scratchpad). A committed seeded-dev integration harness (fresh / stale / merge / link-failure / promotion-failure / rerun-retry / cross-org / owner-query-failure) is a logged follow-up.
- **081's SQL + live DB `COMMENT` say "1:1"** — cosmetic only; the real cardinality is **N:1** (many connections, across orgs, may link one person).
- **Deferred (logged), pick up as needed:** warm-path indicator chip on connection rows; scope ProfileTable's dependent fetches (bucket/exp/edu/signals) to visible IDs (perf — currently whole-table, pre-existing); candidate-ingest→`both` symmetric promote (lattice completeness — only matters once a projected connection is later candidate-ingested); cross-URL-format `people` dedup (pre-existing — candidate ingest uses exact `linkedin_url` match).
- **Free-tier Supabase idle-pause (~7 days)** — on NXDOMAIN / "Failed to fetch", restore both projects from the Supabase dashboard first.
- **Stale `score-all.mjs`** — use `POST /api/admin/rescore-all` for any rescore.
- **Dev-against-dev run** needs the `_DEV` Supabase vars exported over the canonical names before `next dev` (no committed `npm run dev:dev` script yet).
- **`migrate:prod` is a deliberate `ask` guard** in `.claude/settings.local.json` — it prompts on every prod DB migration by design (not a misconfig).
