# Session Handoff — for the next Claude Code session

_Last session: 2026-07-13 — **sequencing + Step-0 verification session** (research-only; NOTHING executed). Ended early because Matt's computer hit application-memory problems — the session closed safely mid-arc: all findings are recorded below, no writes to code/DB/docs beyond this handoff + changelog, no PR opened, no reclassify run. This handoff extends (does not replace) the 2026-07-08→12 Piece B state, which is still accurate — see "Piece B state" below._

## Where we left off

**The three-workstream sequence is verified, Codex-converged (2 loop rounds, gpt-5.5 high), and Step 0's scope is verified — but Matt had NOT yet approved the Step-0 execution order when the session ended.** The next session's first job: re-present the Step-0 execution order (below) for Matt's approval, then execute.

### Verified this session (all against real code/DBs; read-only)
- **Hash linchpin (exact):** vocab hash inputs = sorted active function names + sorted active specialty names + sorted active skill canonical_names + specialty→parent_function[] arrays in DB-STORED ELEMENT ORDER (`join('+')`, order-sensitive) — `lib/candidates/classifier/index.ts:28-63`. **NOT in the hash:** role_specialty_map (CLAUDE.md's claim that it is = ERROR, docs fix pending), skill aliases, primary_specialty hints. Recomputed live: both DBs at `83e9c32a` (17/150/196); removing the 4 tactical-pass skills reproduces `33c400c8` exactly (algorithm validated).
- **All 129 prod people still carry `…/33c400c8` provenance** (0 pending/failed). Composition: **128 `candidate` + 1 `both` (promoted connection)** — zero un-promoted network_connection rows. "Reclassify all 129" is correct as written; the `both` row must be included.
- **Classify-queue boundary: INTENDED-AND-CONFIRMED, not a leak.** Raw CSV connection upload never touches `people` (`lib/network/ingest.ts:77` writes connections-side tables only). Connections reach `people` ONLY via explicit admin projection (`POST /api/network/project`, enriched-gated; `projectConnection` refuses new persons without a fresh Crust blob — `lib/network/project-connection.ts:107-121`) or promote (projects first). `writeCanonicalProfile` always ends with `bump_classification_generation` → pending → cron. `classifyPending` has no record_kind filter (`index.ts:256-258`) but the gate lives upstream. Nuance to log in BACKLOG (not yet done): projected-but-unpromoted connections DO classify on cron — consistent with design, consumes budget knowingly.
- **DB is ahead of code (benign):** migration 098 applied on BOTH DBs; Piece B backfill partially ran on prod (9 people populated); 4-skill sync live. Zero readers on `main` → inert. Piece B PR merge arc is code-only, no DB step. Reclassify does NOT need the PR in either direction (matcher/ingest hook never feed the classifier).

### Final agreed sequence (Matt approved the shape; Codex converged)
- **STEP 0** — reconcile fork + land Piece B (details below; AWAITING MATT'S GO on the execution order).
- **STEP 1** — Piece A (hash-safe; HARD GATE: no-wipe/write-through ingest design for experience-keyed declared skills BEFORE migration 099; live-browser association-decoration check first). Can interleave with Step 2.
- **STEP 2** — refactor Phase 1, plumbing only: DB→CSV export **from the DB, not seed scripts** (seniority_rules 400+ live only in DB; schools source CSV not in repo) for functions/specialties/role_specialty_map/seniority_rules/title levels/recruiting titles/schools+aliases; new sync handlers; **fix GATE-1 exit-code lie (hard prereq — expansion session depends on the gates)**; pagination on all sync DB reads (bare `.select('*')` hits the 1000-row cap — schools would break); strict CSV serializer or forbidden-char validation; fix import-teams.mjs dead path; adopt-or-delete orphaned CSVs (reference/teams/*, reference/dictionaries/field_of_study.csv); never export created_at/updated_at. Gates: dry-run zero diff AND hashVocab byte-identical before/after AND grep-clean ERROR AND non-zero exit on failure. NO department layer here.
- **STEP 3** — Phase 2 expansion (separate Fable session): one gated arc — dev-first, read-only simulation vs prod rows, **cron paused/queue drained for the duration**, PROMPT_VERSION decision, prompt-size/cost eval (dynamic prompt grows with vocab), full re-classify + re-score, regenerate aging Opus reference. Department layer lives HERE, not Phase 1. Correction to earlier assumption: GATE 1 validates hints against the TARGET DB (not CSVs), so the expansion isn't hard-blocked on Phase 1 — Phase-1-first is for foundation/verification reasons.

## Next thing to do — Step 0 execution order (present to Matt for approval FIRST)
1. Docs pass 1: factual corrections — CLAUDE.md/ROADMAP: 196 skills, live hash `83e9c32a`, fix the role-map-in-hash error; BUGS/BACKLOG: boundary-confirmed note + projected-unpromoted-connections-classify design record.
2. Snapshot baseline BEFORE any bump (Codex gate): person_experiences inferred axes + scores/buckets for all 129.
3. Bump `bump_classification_generation` on all 129 → run LOCAL loop calling `classifyPending(supabase, 20)` with service role (NOT the Vercel route — 300s ceiling; keeps halt-after-3-infra-discards). Verify: single classifier_version `cls-2026-07-08a/claude-haiku-4-5/83e9c32a`, 0 pending, 0 failed. ~$1.6 at Haiku prices, well under cap.
4. Re-score via the real `rescore-all` API (NOT scripts/score-all.mjs — it lacks the record_kind filter) → churn diff report to Matt (classification flips + bucket moves; reclassify is NOT a data no-op — sampling variance).
5. Docs pass 2 (only AFTER verification proves uniform provenance): CHANGELOG new dated entry recording fork+reconcile.
6. Piece B PR: `npm run build` → PR → Vercel preview URL to Matt → browser check → merge decision gate.

## Piece B state (unchanged from prior handoff — still true)
- Branch `subpr4-person-skills` (commits `5fde7d7`/`6de0d0b`/`9d07be6` + docs/planning). No open PR. Preview: https://vetted-git-subpr4-person-skills-matt-tahrtechs-projects.vercel.app (Matt browser-verified earlier).
- Prod ingest does NOT write skills columns until merge (hook on branch only). Archive-mining backfill (~49 profiles' fullProfile Skill entities; new extractSkills shape — NOT yet built) is a queued quick-win, fits Step 0 or later.
- Piece A findings: `reference/_planning/piece-a-skills-findings.md` — this session VERIFIED most claims with corrections: extension skills come from PASSIVE profileSkill interception (opportunistic), not the fetched FullProfileWithEntities blob (whose embedded Skill entities nothing reads); wipe risk CONFIRMED (`write-canonical.ts:516-519` delete+reinsert, no skills columns on reinsert).

## Open questions
- Step 0 execution-order approval (Matt was about to decide when the session ended).
- Whether the archive-mining backfill rides Step 0 or waits.
- Carried: PROMPT_VERSION bump timing; companies-scoring coverage pass; PostgREST 14.1→14.5 parity; ingest-time classify hook.

## Watch-outs
- **Session ended abruptly (Matt's machine memory issues)** — re-confirm branch/tree state at next session start; expect tree clean at commit for THIS handoff.
- Docs still stale until Step 0: CLAUDE.md/ROADMAP say 192/`33c400c8` and CLAUDE.md wrongly claims role_specialty_map is a hash input.
- Daily classify-pending cron (13:00 UTC) stamps any NEW pending person with `83e9c32a` — mixed provenance accumulates until Step 0 runs (today: zero pending, so quiet unless something ingests).
- Vocab-change rule stands: ALL /reference/skills CSV edits sync BOTH DBs dev-first; new canonical rows move the hash, alias-only edits don't.
- Carried: `_mergearc_20260708` snapshot schema still on prod (drop after stability window); reference/eval PII gitignored; location-filter → geocode-on-ingest queued in ROADMAP.
