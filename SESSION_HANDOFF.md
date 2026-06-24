# Session Handoff — 2026-06-24

> This handoff was reconstructed by verifying against git log + `gh` because the
> 2026-06-24 work never got a clean `end session` — the local repo (on the old
> `~/Desktop/DEV` path) was being wiped by iCloud sync mid-work. The repo is now
> a fresh clone at `~/DEV/vetted` (off iCloud). State below is verified against
> GitHub, not memory.

## Where we left off

A full working day (2026-06-24) happened after the last clean wrap (five-axis
sub-PR 2b, 2026-06-21). Three things landed/moved today:

1. **PR #11 — MERGED to main** (squash `11f09a1`, now the main tip). A prod-down
   hotfix: migration 072 made `specialty_dictionary.parent_function` a `TEXT[]`,
   but `ProfileTable.tsx:616` and `search-builder/page.tsx:205` still called
   `.replace()` on it directly, crashing the Candidates page (`/`) and
   `/search-builder` on load. Fix: `Array.isArray` guard + `join(', ')` before
   formatting, so multi-parent specialties render all parents. Client-render only,
   no migration. **Verified live on prod.**
2. **PR #10 — OPEN, not merged.** The Network Connections module (big new
   feature). See "What's in flight."
3. **Session protocol renamed** (committed to main, `70a2d78`): `end session` is
   now primary (`wrap session` kept as alias); `new session` added as alias for
   `start session`; a pre-flight verification step was folded in as step 1 of the
   End protocol; the old `wrap up session` trigger was removed. CLAUDE.md already
   reflects this.

## What's in flight

**PR #10 — Network Connections module, PR 1 of 2** (branch
`network-connections-module`, OPEN, base `main`, 36 files, +3016/−2).

An org-scoped, fully **siloed** warm-intro layer: employees upload their LinkedIn
`Connections.csv` → parse → URL-canonicalize → 3-bucket title classifier
(engineer / not / maybe) → per-org dedupe → Haiku triage of the MAYBE bucket →
optional per-URL Crust enrichment → basic admin view + review queue. Core
principle: connections live ONLY in the module's tables — never written to
`people`, never routed through `/api/ingest`, never in the global candidate
search. PR 2 (separate stacked branch, not yet built) wires connections into the
existing candidate search as an org/employee-scoped filter.

- **Migrations 075–078 — applied + verified on DEV only, NOT on prod.** Per the
  dev-first workflow, they promote to prod after review/merge.
  - 075 — 7 tables (`organizations`, `employees`, `upload_batches`,
    `raw_connection_rows`, `connections`, `connection_owners`,
    `network_enriched_profiles` — the last is the deliberate cross-silo enrichment
    cache, the only table with no `org_id`).
  - 076 — RLS-off follow-up (Supabase auto-enable pattern).
  - 077 — `crust_import_log.request_kind` CHECK += `network_enrich` (non-additive
    → dev-first).
  - 078 — additive LLM-triage columns on `connections`.
- Verified in PR: 19/19 `lib/network` unit tests, `tsc --noEmit` clean,
  `npm run build` clean, ingest + Haiku-triage + enrich-estimate smoke on dev.
- Not yet browser-verified by Matt on the Vercel preview (per the
  architecture-change rule, that's the gate before merge).

**Local repo:** fresh clone at `~/DEV/vetted`, on `main` at `11f09a1`, synced with
`origin/main` (I fast-forwarded — the clone was 1 commit behind on first fetch).

## Next thing to do

1. **Rebuild `.env.local` FIRST — it's a hard blocker.** It did not survive the
   iCloud wipe (gitignored). Nothing local works without it: `npm run build`,
   every `scripts/*.mjs`, and the `migrate:dev` / `migrate:prod` wrappers all read
   it. Needs both the prod vars and the `_DEV`-suffixed dev vars (see CLAUDE.md
   "Environment Variables" + "Dev/prod Supabase split"). Source values from
   Vercel env (prod) + the Supabase dashboards.
2. **Then decide the thread** (ask Matt — don't assume):
   - **(a) Land PR #10** — browser-verify the network-connections preview, merge,
     then promote migrations 075–078 to prod (dev-first workflow, DB-code lockstep:
     code deploys on merge, then migrate prod). Then PR 2 (search-filter
     integration).
   - **(b) Resume five-axis sub-PR 3** — ingest-side LLM per-experience inference
     outputting the five-axis tuple incl. `title_normalized` (ROADMAP item #2,
     build step 3). Was the "next" before today's network-connections detour.

## Open questions

- **Which thread next — finish PR #10 or resume five-axis sub-PR 3?** Matt's call.
- Sub-PR 3 design (prompt shape, fields fed to the LLM, confidence thresholds,
  `title_normalized` canonicalization) is still unscoped whenever it's picked up.

## Watch-outs

- **`.env.local` is missing** — see Next-thing-to-do #1. Any build/script/migration
  attempt fails until it's rebuilt.
- **Open ingest-side bug, unresolved:** `lib/normalize/specialty.ts:56` still
  `select`s `function_normalized` from `specialty_dictionary`, a column migration
  072 renamed to `parent_function` (`TEXT[]`). PR #11 was client-render only and
  did NOT fix this. **The two PRs describe it inconsistently** — PR #10's body
  calls it prod-affecting (`loadSpecialtyDictionary()` / `/api/ingest` throws),
  PR #11's body calls it dev-only drift. Settle it by querying the actual prod
  schema (needs `.env.local`) before relying on either framing. Logged to BUGS.md.
- **Keep the repo OFF iCloud.** The old `~/Desktop/DEV` path was inside iCloud
  sync and got wiped mid-work. Now at `~/DEV/vetted` with iCloud sync disabled —
  don't move it back.
- **PR #10 migrations 075–078 are dev-only**, not on prod. Promote after merge,
  dev-first, code-then-DB lockstep.
- **Free-tier Supabase idle-pause (~7 days).** Last activity 2026-06-24, so likely
  live — but on NXDOMAIN / "Failed to fetch", restore both projects from the
  Supabase dashboard first; it's not a code or Vercel problem.
- **Stale `score-all.mjs`** — drifted from `lib/scoring/score-candidate.ts`;
  mis-scores the underscore taxonomy. Use `POST /api/admin/rescore-all` for any
  rescore.
- **DB-code lockstep** is the rule for any prod taxonomy/scoring/migration change:
  deploy code to prod first, then promote the DB.
