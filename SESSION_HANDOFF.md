# Session Handoff — for the next Claude Code session

_Last session: 2026-08-02 — skills/Piece-A thread fully closed, Crust scoped down, Send-to-ATS sender shipped + live-verified. All work is on `main`; nothing in flight._

## Where we left off
- **`main` = `4290314`, tree clean, in sync with origin. No branches in flight, no open PRs.**
- **Send-to-ATS (Vetted sender side) is SHIPPED and LIVE-VERIFIED.** Matt sent real candidates end-to-end; they landed in the ATS "Sourced" column. Code on main: `lib/ats/canonical-from-person.ts` (reverse serializer), `app/api/ats/export/route.ts` + `app/api/ats/jobs/route.ts` (two routes), `app/components/SendToAtsButton.tsx` (bulk-bar button + job picker), BUGS.md no-auth accepted-risk entry. The `send-to-ats` branch was merged (`4290314`) and deleted — it no longer exists.

## What happened this session (the skills/Piece-A arc, now CLOSED)
1. **Step 0 closed** — Piece B person-skills + classifier vocab-fork reconcile (`33c400c8`→`83e9c32a`) merged as PR #17 (`630c956`); all 129 candidates uniform at `83e9c32a`, 0 bucket moves.
2. **Crust "migration" investigated → downgraded.** It is NOT a pipeline rework — all live Crust callers are already on the 2025-11-01 API with compliant `Bearer` + `x-api-version` headers. The only `/screener/*` reference in the codebase is dead code with zero live callers. Real scope = **~half-day dead-code cleanup, deadline 2026-09-30, no urgency.** Opt-in "Crust enhancements" (normalized job titles / batch APIs / contact enrich) split into a separate unscheduled backlog item — JTN is the one with mapper adjacency (sequence against title-axis work).
3. **Piece A / role-attributed skills → CANCELLED with proof.** Role-attribution doesn't exist from any source: Crust enrich (~99% of profiles) = flat `string[]`, 0/100 positions carry a skill field; Crust search = no skills; LinkedIn voyager = flat name+index, `positionUrnCount:0`; legacy association endpoints 410 Gone; `/details/skills/` attributions are SDUI display-only. **Migration 099 + no-wipe ingest redesign KILLED** (no data to populate). Skills are profile-level-only, permanently — Piece B already captures that. Search-path skills gap (crust-v2 returns no skills) = **intentional no-fix** (costs ~1 credit/person enrich for marginal gain). All logged durably in BACKLOG under "Five-Axis Classification" — **do not reinvestigate.**

## Cross-app note (IMPORTANT for a cold start)
Send-to-ATS spans **two repos**: `vetted` (sender = this repo) and `vetted-ats` (receiver = separate session/repo). **They are independent at deploy time — the only coupling is a shared env secret.** The receiver side shipped separately in vetted-ats. A change to one does not require the other. Also: this repo may be acted on by a concurrent vetted-ats session — a merge + branch-delete appeared mid-session today. **Always `git fetch` and re-verify refs before reporting branch state.**

## Next thing to do (Matt picks — nothing is queued as active)
Parked items, in rough priority:
1. **Crust dead-code cleanup** — before 2026-09-30. Retire `fetchCrustPage` + `CRUST_SEARCH_URL` (`lib/ingest/crust-api.ts` — note its `Token` auth = old scheme), the unused v1 mapper (`lib/ingest/mappers/crust.ts`), relocate `postIngest` out of the misleadingly-named file, sweep the "kept for reference" legacy descriptions in CLAUDE.md. Zero blast radius; verify with build + one import/enrich smoke test. Full scope in BACKLOG "Pipelines".
2. **Two founder backlog items** (both in BACKLOG "Data Quality"): (a) `is_current_founder` default-view exclusion is too blunt — a low-signal side/advisory "Founder" role removes a recruitable senior IC from search (Alen Rakipovic example); (b) "Founder" seniority option verify-and-reconcile — Matt believed it was removed but it still appears in the filter and returns 13 candidates; **report findings before any change.**
3. **Minor Send-to-ATS send-process tweaks** — not scoped, low priority, Matt doesn't need them yet.

## Open questions
- None blocking.

## Watch-outs
- **Two-repo, two-session reality:** re-verify git refs (`git fetch` first) before trusting any prior report of branch state — the remote moved under this session today.
- Crust dead-code cleanup has a real external deadline (2026-09-30) but is trivial; don't let it slip silently.
- Vocab hash is `83e9c32a` (196 skills / 150 specialties / 17 functions), prod == dev. Any vocab change forks the hash → requires a coordinated re-classify arc; the classifier prompt is built dynamically from live vocab.
- Carried from prior arcs: PostgREST 14.1→14.5 parity; `_mergearc_20260708` snapshot schema still on prod (drop after stability window); reference/eval is gitignored PII (now also `*.har` — LinkedIn session-cookie captures must never enter git).
