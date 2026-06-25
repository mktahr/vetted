# Session Handoff — 2026-06-24 (end of session)

## Where we left off

**Network Connections module is live on prod — PR 1 (pipeline) + PR 2 increment 2a (detail drawer) both shipped.**
- **PR [#10](https://github.com/mktahr/vetted/pull/10)** (squash `593ce3d`) — phase-1 pipeline. Migrations **075–078 promoted to prod in order** after the merge deploy (code-then-DB lockstep). Prod smoke passed; existing data + `/person/search` ingestion untouched. The live Crust `/person/enrich` path was fixed inside this PR (correct `professional_network_profile_urls` param + nested `matches[].person_data` parsing + empty-`matches` no-match guard) — it had shipped untested in-branch, caught during dev testing.
- **PR [#13](https://github.com/mktahr/vetted/pull/13)** (squash `c299d528`) — increment 2a: connection detail drawer (`ConnectionDrawer.tsx` + `GET /api/network/connections/[id]` + row-click). Code only, no migration. Prod-deployed + browser-verified.

Earlier same day: specialty resolver dev/prod parity (PR #12 + migration 079) — also done. Prod DB + prod code in lockstep; both DBs on the migration-defined schema.

## What's in flight

**Nothing open.** PR #10 and #13 are merged + deployed; branches deleted. No open PRs. End-session docs committed (CLAUDE.md Network Connections section + ledger; CHANGELOG; ROADMAP; BUGS/BACKLOG log entries; cross-check-command docs; AGENTS.md).

**Local repo:** `~/DEV/vetted` (off iCloud), on `main`, synced with origin, clean after the end-session commit.

## Next thing to do

**Network Connections PR 2** — candidate-search integration + admin cross-org view + gated promotion.

**FIRST STEP (before any building): a Claude+Codex architecture pressure-test.** Run `pack codex` to hand Codex the two open design decisions and get an adversarial read, then `review codex` on the response:
1. **Data tier:** snapshot-axes-now (cheap; cached `/person/enrich` is `basic_profile` only — no history/education) **vs** paid rich-enrichment (full 25-axis search + full promotion).
2. **Architecture:** the **`people`-projection-with-pool-flag** model — normalize enriched connections into `people`/experiences/education with `in_general_pool=false` + a connection↔person link, so the existing 25-axis search machinery is reused; default search = general pool; org/employee-scoped "search connections" toggle; **promotion = flag flip, no re-pay** (enrichment ≠ promotion). This **reverses 075's literal "never write to people"** rule — needs explicit buy-in.

Then build in this order (recommended): **2b-3** admin cross-org view (no schema change — supported today via `canonical_url` + `connection_owners`) → **2b-0** migration (pool flag + connection↔person link + promotion/eligibility marker, dev-first) → **2b-1** normalizer (cached blob → people, no re-pay) → **2b-2** search reuse + org-scope filter → **2b-4** gated promotion → **2b-5** rich-enrichment upgrade (only if data tier ii). Full scope in BACKLOG "Network Connections".

## Open questions

- Data tier (i snapshot vs ii rich) and architecture buy-in (people-projection-with-pool-flag) — to be resolved by the Codex pressure-test + Matt's call before building 2b.
- Increment order above is a recommendation, not locked.

## Watch-outs

- **Never run `npm run build` while `next dev` is live** — corrupts `.next` ("Cannot find module './XXXX.js'"). Fix: stop dev → `mv`/clear `.next` → restart.
- **Dev-against-dev run** needs the `_DEV` Supabase vars exported over the canonical names — script lives in the session scratchpad; **no committed `npm run dev:dev` yet** (candidate for a package.json script).
- **Enrich blob is snapshot-only** (`basic_profile`, no history/education) — caps PR 2's searchable axes until a richer (paid) enrichment tier; drives the data-tier decision.
- **Cross-check commands are live:** `pack codex` / `review codex` (Claude) ↔ `pack claude` / `review claude` (Codex). If `pack claude`/`review claude` is typed to Claude, redirect to the Codex variants.
- **Free-tier Supabase idle-pause (~7 days)** — on NXDOMAIN / "Failed to fetch", restore both projects from the Supabase dashboard first.
- **DB-code lockstep** remains the rule for any prod taxonomy/scoring/migration change: deploy code to prod first, then promote the DB.
- **Stale `score-all.mjs`** — use `POST /api/admin/rescore-all` for any rescore.
