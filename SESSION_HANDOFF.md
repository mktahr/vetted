# Session Handoff — for the next Claude Code session

_Last session: 2026-07-01 — Five-axis sub-PR 3 (classifier tuned + validated in-app; integrity hardening; legacy seniority/title-level fixes)._

## Where we left off
Five-axis classifier (sub-PR 3) is built, integrity-hardened (post Codex review + a credit-outage silent-failure incident), and the prompt is **frozen at `cls-2026-07-01d`** (stable **88.2–89.0%** comparable agreement over 3 tuning runs, error=0, on a candidate-split eval). It's validated in-app via a **safe preview** (migration 089 `_inferred_preview` columns + a Vercel preview link off branch `five-axis-subpr3-classify`). Matt reviewed real profiles and gave concrete classification feedback (below). We also fixed two **legacy** (pre-classifier) title-resolution bugs — seniority and title_level/progression both mis-handled compound leadership titles — with targeted prod backfills.

## What's in flight
- Branch **`five-axis-subpr3-classify`** — pushed, **NOT merged**, no PR yet. All work committed + pushed (tip `04ac404` + the end-session docs commit).
- Prod migrations **083/084/088/089 applied** (inert/additive). **085/086/087 (taxonomy) are DEV-ONLY** — prod taxonomy + the `person_experiences.specialty_normalized/function_normalized` cascade + full re-score happen **AT MERGE**.
- Preview `_inferred_preview` columns populated on prod for the 129-candidate cohort (`scripts/eval/populate-preview.ts`, cls-2026-07-01d).
- Seniority/title_level prod backfills applied (257 + 88 rows) — **but scores/buckets were NOT re-run, so drawer score numbers are STALE** until the ship-time full re-score.

## Next thing to do
**Run the classifier tuning batch** (Matt already agreed to the fixes; it was queued on his "go"). One prompt pass in `lib/candidates/classifier/prompt.ts` covering:
1. **Sparse role + explicit About/summary → assign specialties** (Pavlo: About says "backend development, data pipeline engineering" but Rule 7 was too timid → should be `backend` + `data_pipeline`).
2. **Sparse current role → lean on career** (Michael Olson: 21-char current desc guessed `backend`; his history is `fullstack`).
3. **Don't invent niche specialties without evidence** (Joanne: `robotics_integration_engineering` with no evidence — we deprecated the generic "robotics software" specialty so it reached for a niche one; leave empty rather than guess).
Then: bump PROMPT_VERSION → **cheap tuning re-run** (`tsx scripts/eval/tuning-run.ts`, ~$0.22, cost estimate FIRST) → confirm no regression + these three improve → **re-populate the preview** (`populate-preview.ts`, ~$1.18) → hand Matt the refreshed preview.

After that (in order): **holdout one-shot run** (generalization check, run ONCE on the frozen prompt) → **full-corpus POOL run** → **hardening-before-merge** (BUGS.md classifier item) → **prod taxonomy 085–087 + person-data cascade + full prod re-score** → **flip search/scoring to read `_inferred`** → **PR + Vercel-preview-before-merge**.

## Open questions (Matt to decide)
- **`mission_systems_engineering`** (aerospace-parent specialty the classifier put under a software function): keep it, or collapse to `systems_engineering`? Also logged: a validator warning when a specialty's `parent_function` excludes the assigned function.
- Whether to keep tuning the classifier after the batch, or freeze + ship once the batch + holdout look good.

## Watch-outs
- **`reference/eval/*` is PII** (real candidate names/text) and gitignored (added `*.md` this session). Never commit it.
- **Every LLM run gets a cost estimate FIRST; no auto-reruns** (Matt is strict — a credit outage mid-session caused a silent all-`unknown` write + a fake "95% agreement"; that's why the integrity fixes exist). Read a report from disk; never re-run a script just to inspect output.
- **`classification_status` is the live classifier queue key** — a preview must NEVER write it. The 089 `_inferred_preview` columns are the safe target; the real `_inferred` columns + lifecycle are for the real classifier (post-merge).
- **Stale scores**: seniority/title_level backfills changed live data but didn't re-score. A full prod re-score is required at ship.
- **Legacy drawer fields** (seniority/progression/score/full-time) are a SEPARATE cleanup from the classifier — batch, don't whack-a-mole. Known: `employment_type`/`is_full_time_role` not captured on some ingests (all of Makai's roles flagged non-full-time) → affects tenure/scoring.
- Preview classifications used **DEV vocab written into prod preview columns** — fine for review; the real classifier (prod vocab, post-merge) is the source of truth.
- The tuning number is Haiku-vs-Opus **agreement**; as the classifier follows Matt's rules it diverges from the (outdated) Opus reference by design — Matt's in-app judgment is the real ground truth.
- BUGS.md has the seniority + title_level + hardening entries; keep the hardening-before-merge item as the pre-PR checklist.
