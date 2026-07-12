# Session Handoff — for the next Claude Code session

_Last session: 2026-07-08→12 — the sub-PR 4 **Piece B execution session** (person-level skills). This handoff CORRECTS the prior 2026-07-12 docs-only handoff, which was written by a parallel session unaware of this work and wrongly said "no build in flight" / called this branch's commits "unrelated."_

## Where we left off

**Taxonomy sub-PR 4 Piece B (deterministic person-level skills) is BUILT and DB-LIVE on prod — code awaiting merge.** Be precise about the split:

- **On the prod DB (live now):** migration 098 (`people.skills_scraped_raw / skills_matched / skills_matched_at / skills_scraped_source` + GIN index) applied dev+prod; skills dictionary tactical pass synced BOTH DBs (+4 rows: Git, GitHub, Linux, Distributed Systems; alias fixes incl. `rf`→RF Design after the collision gate caught a duplicate-row attempt; **vocab hash moved 33c400c8 → `83e9c32a`, parity verified identical on dev+prod**, 17 fns / 150 specs / 196 skills); backfill `--apply` wrote **9 people** (Reid Buzby 21 matched … Marcus Webb 1; four-source mining: profile_snapshots via legacy `profiles.id` bridge, network_enriched_profiles, raw_ingest_events, legacy `profiles.skills_tags`).
- **On branch `subpr4-person-skills` only (NOT merged, no PR yet):** the code — `lib/skills/match.ts` whole-tag matcher (capture-biased: exact → qualifier-merge → contradiction-blocklist → strip; Codex-converged 2 rounds) + `.mjs` twin + 40-fixture parity suite; sync-reference global token-collision gate; ingest hook (writeCanonicalProfile Step 4.5, no-wipe on null/empty, never touches classification lifecycle — smoke-tested end-to-end on dev incl. the no-wipe rule); `scripts/backfill-person-skills.mjs` (--apply/--rematch/--dev); badged "Profile Skills" UI (profile page + drawer, supersedes a DEAD profile_snapshots query that filtered on a nonexistent column); `InfoTip.tsx` real tooltips on all 6 provenance ⓘ markers (BUGS item resolved). **Until this branch merges, prod deploys do NOT run the ingest skills hook or show the UI** — new prod ingests won't write the skills columns (recoverable later via backfill).

Design + Codex history: `reference/_planning/piece-b-design.md`. Piece A findings: `reference/_planning/piece-a-skills-findings.md` (UNVERIFIED-FINDINGS header — re-verify before acting).

## What's in flight
- Branch `subpr4-person-skills` (Piece B commits `5fde7d7`/`6de0d0b`/`9d07be6` + planning/docs commits). **No open PR.** Preview: https://vetted-git-subpr4-person-skills-matt-tahrtechs-projects.vercel.app (Matt verified Reid/Annie/Anirudh + tooltips in-browser).
- **Piece A (extension skills scrape) is NEXT after Step 0** and its scope EXPANDED after the third-skills-source discovery — see findings doc. Holding for Matt at a browser (live Voyager endpoint verification loop; opens with the association-decoration question).
- Queued quick win: archive-mining backfill extension (~49 archived profiles have mineable Skill entities in their fullProfile blobs — no re-scrape needed; ~20-min addition to the backfill script).

## Next thing to do — Matt's phased sequence
1. **Step 0 — fork-reconcile + reclassify + docs fix.** The 07-09 dictionary pass moved the live vocab hash off the frozen `cls-2026-07-08a/33c400c8` contract: all 129 classified candidates carry `33c400c8` provenance, but the live vocab now hashes `83e9c32a` — and the daily classify-pending cron stamps NEW classifications with the new hash (mixed provenance accumulating). Reconcile: bless the new hash + re-classify (or explicitly accept mixed provenance), and fix stale docs — CLAUDE.md still calls `33c400c8` frozen, and the `_planning/` docs (written before the pass) cite it as the gate value. Also fold in: PR + merge decision for `subpr4-person-skills` (prod deploys need the ingest hook).
2. **Piece A** — extension skills scrape, expanded scope (association-bearing decoration, per-role `skills_declared` storage incl. the delete+reinsert no-wipe design problem, fullProfile fallback extraction). Live-browser verification loop with Matt.
3. **Phase 1 — storage refactor** (per `skills-expansion-outline.md`; hash-unchanged is the gate).
4. **Phase 2 — skills-dictionary expansion** (kickoff prompt at `skills-expansion-prompt.md`).

## Open questions
- Step 0's call: re-classify all 129 under `83e9c32a` (~$1.6, known-good pipeline) vs bless-and-mix. Recommend re-classify — cheap, restores uniform provenance.
- Piece C display/scoping calls are settled in-conversation (one section, evidenced family = extracted + declared, mentioned muted, evidenced-wins overlap, union search + proven-only toggle, mentioned = ever-scope only) but Piece C build waits on Piece A's association answer.
- Carried: PROMPT_VERSION bump timing; bucket-B pool boundaries; companies-scoring coverage pass (SeJun-class bottleneck).

## Watch-outs
- **Vocab hash is no longer `33c400c8` anywhere live** — both DBs at `83e9c32a` (parity holds; the fork is vs the FROZEN CONTRACT, not dev-vs-prod). Any doc citing 33c400c8 as current is stale until Step 0's docs fix.
- **Prod ingest does not write skills columns until the branch merges** — the hook lives on `subpr4-person-skills` only.
- Vocab-change rule stands: ALL /reference/skills CSV edits sync BOTH DBs dev-first (new rows move the hash; alias-only edits don't).
- Location-filter item from the parallel session's handoff remains valid and queued in ROADMAP (geocode-on-ingest; don't extend the hardcoded city list).
- Carried: PostgREST 14.1→14.5 parity; ingest-time classify hook; `_mergearc_20260708` snapshot schema still on prod (drop after stability window); reference/eval PII gitignored.
