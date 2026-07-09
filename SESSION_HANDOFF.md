# Session Handoff — for the next Claude Code session

_Last session: 2026-07-08 — Five-axis sub-PR 3: deterministic career-fallback architecture + robotics carve-out; holdout (82.1%, ACCEPTED) + POOL (85.9%) on frozen cls-2026-07-08a; hardening-before-merge done. Eval + hardening phases COMPLETE._

## Where we left off
The classifier is **done tuning**: prompt FROZEN at `cls-2026-07-08a`, dev vocab frozen at **150 specialties / 192 skills**. The architecture pivot shipped: the LLM classifies only role-evidenced axes; **CODE does inheritance** (`lib/classification/career-fallback.ts` → new `specialty_inherited` columns, migration 092 dev+prod, atomic in `commit_classification`) and the robotics carve-out anti-leak (`carve-out-guard.ts`). Eval on the frozen config: tuning 89 → holdout one-shot **82.1% ACCEPTED** (audit: ~96% conformance to our own rules; misses are logged, not re-rolled) → POOL **85.9%** — error=0 and 0 val-fails everywhere. Preview verified per-candidate: Joanne (robotics/robotics_software), Michael (inherited [fullstack, backend]), Pavlo (inherited [backend, distributed]), Aadhya (conservative-empty), SeJun (powertrain, migration 093). Hardening-before-merge (BUGS.md entry) closed. Branch pushed through `f617ca9`; **no PR yet** (intentional — PR comes at the end of the merge arc).

## What's in flight
- Branch **`five-axis-subpr3-classify`** — all session work committed + pushed, working tree clean. (`scripts/seed-gated-promotion-demo.mjs` is now COMMITTED — kept as a reusable gated-promotion test fixture per Matt's 2026-07-08 call.)
- **Dev-only migrations awaiting prod at merge: 085/086/087/090/091/093** (taxonomy). **092 is already on prod** (additive, inert). Prod skills dictionary still has the old 14 rows.
- Next-prompt rules queued in `lib/candidates/classifier/next-prompt-queue.md` — do NOT touch the frozen prompt.

## Next thing to do — the MERGE ARC (all prod-touching, every step gated on Matt)
1. **Prod taxonomy application**: migrations 085/086/087/090/091/093 in order (dev-first workflow already done — these are prod applies) + prod skills sync (`sync-reference.mjs`, default prod target) — expect 150 specialties / 192 skills on prod.
2. **Person-data cascade**: reclassify `person_experiences.function_normalized`/`specialty_normalized` + `people.current_*` mirroring migration 073's pattern (the 085–087 deprecations/renames need their data cascade).
3. **Full prod re-score** via `/api/admin/rescore-all` (NOT scripts/score-all.mjs — stale mirror, see BUGS).
4. **Flip search/scoring to read `_inferred` + `specialty_inherited`** (union) — this is the user-visible switch.
5. **PR + Vercel-preview-before-merge** (hard backstop — never merge unseen). Consider `/codex:adversarial-review` on the final diff.
6. Post-merge: run the real classifier (`classifyPending`) to populate the real `_inferred` columns.

## Open questions
- Bucket-B pool-boundary calls (sysadmin / IT-infra / GTM Engineer / Prompt Engineer): currently fail-safe abstentions; explicit routing = Matt's call, next prompt version.
- Next-prompt-queue items (Solutions/FDE/Architect evidence-gating, frontier-lab research-title clarifier, embedded-vs-carve-out precedence, COBOL clarifier): applied at the next PROMPT_VERSION bump — before or after merge is Matt's call (recommend after: don't reopen the freeze mid-merge-arc).

## Watch-outs
- **FREEZE IS ON**: no prompt or vocab changes until the merge arc completes. Changes go to `next-prompt-queue.md`.
- The Opus eval reference is AGING (predates new vocab/rules — it drove most holdout/POOL "disagreements"). Regenerate `_draft-rows.json` before trusting agreement %s in the next tuning cycle.
- Migration order at merge matters: code deploy → prod migrations in sequence → cascade → re-score (code-then-DB lockstep, see Development Rules).
- Scores/buckets are STALE until the merge-arc re-score. `classification_status` remains the live queue key — previews only ever write `_preview` columns.
- `reference/eval/*` is PII, gitignored — never commit. Every LLM run: cost estimate FIRST, no auto-reruns.
- Aadhya's duplicated experience rows (dup-ingest race) are still in prod — BUGS.md, ships separately; career-fallback already defends via source dedupe.
- Preview URL (still live for spot-checks): https://vetted-git-five-axis-subpr3-classify-matt-tahrtechs-projects.vercel.app
