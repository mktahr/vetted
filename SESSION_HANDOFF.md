# Session Handoff — for the next Claude Code session

_Last session: 2026-07-07 — Five-axis sub-PR 3: tuning batch cls-2026-07-02a + validator guards; skills dictionary 14→188; specialty gap-fill (migration 090); preview re-populated._

## Where we left off
Prompt frozen at **`cls-2026-07-02a`** (4 fixes: Pavlo About-evidence, Michael career-fallback, Joanne evidence-bar, Aadhya title-keyword trap) + two validator **REJECT-then-REPAIR guards** (parent-function mismatch, unknown skill). Tuning: **91.2% comparable agreement, error=0** (best yet). Dev vocab completed: **148 specialties** (migration 090: +computer_vision/nlp/sre/devops/platform — fixed the prompt-vocab drift) + **188 skills** (Matt's full dictionary via `/reference/skills/*.csv`; sync-reference gained `--dev` + hint validation). Preview **re-populated against complete vocab** (980 roles / 129 candidates, $1.82 actual vs $1.45 est — populate estimates now carry ±30%).

## Next thing to do
**⚠ MATT VERIFIES THE PREVIEW IN-APP FIRST** — the fixes landed in data but have NOT been human-verified. This gates freeze → holdout. Preview: https://vetted-git-five-axis-subpr3-classify-matt-tahrtechs-projects.vercel.app

1. **The four fixes** (pass criteria):
   - [Pavlo Cherepanov](https://vetted-git-five-axis-subpr3-classify-matt-tahrtechs-projects.vercel.app/profile/0685ad91-6d4f-4e70-a4f6-ec9561f1c6d5) — sparse roles carry `backend` + `data_pipeline` from his About
   - [Michael Olson](https://vetted-git-five-axis-subpr3-classify-matt-tahrtechs-projects.vercel.app/profile/a7e47a98-2c3e-492d-8c41-0503e893225d) — current role `fullstack` from career, not guessed `backend`
   - [Yu (Joanne) Chiu](https://vetted-git-five-axis-subpr3-classify-matt-tahrtechs-projects.vercel.app/profile/25352d5e-d24d-4876-abe1-2b6bd0772f41) — no invented niche specialties (empty = correct)
   - [Aadhya P.](https://vetted-git-five-axis-subpr3-classify-matt-tahrtechs-projects.vercel.app/profile/6a60fd01-8581-4698-a419-8794b619418a) — Anduril roles `software_engineering`, no `mission_systems`. Specialty may be EMPTY (her About says "aspiring full-stack" = aspirational, excluded by the evidence bar) — Matt to say if the bar should loosen.
2. **Guard-strip judgment calls** (was the stripped specialty right → widen parents / wrong function, or correct strip?): [Guy Bitton](https://vetted-git-five-axis-subpr3-classify-matt-tahrtechs-projects.vercel.app/profile/5520d77d-ec55-4430-88e0-76a1053c523e) (autonomy under software), [SeJun Kim](https://vetted-git-five-axis-subpr3-classify-matt-tahrtechs-projects.vercel.app/profile/6d7e9bbd-1bae-466c-bdd0-0c538fcce2c9) (motor_drives under mechanical), [Nick Cahill](https://vetted-git-five-axis-subpr3-classify-matt-tahrtechs-projects.vercel.app/profile/bd62e412-a5ed-4ebc-94f5-799b91bd0fde) (integration_test under systems), [Makai M.](https://vetted-git-five-axis-subpr3-classify-matt-tahrtechs-projects.vercel.app/profile/5a4292f5-ed73-45fd-a154-870442ad53bb) (robotics specialties under software).
3. **Skills chips scan** — first render of this axis; junk/gaps feed the CAD + Simulation add decision (both hit multiple candidates).

Feedback format: candidate + role + what's wrong + what was expected (this drove the last batch).

**Then (queued on Matt's go):** extend the final-attempt repair to unknown SPECIALTY names (the guard covers skills + parent-mismatch but not out-of-vocab specialties — that's why 2 candidates val-failed) + a **~$0.04 targeted re-run** for the 2 stale candidates.

## What's in flight
- Branch **`five-axis-subpr3-classify`** — pushed, NOT merged, no PR yet. All session work committed (classifier 02a + guards, migration 090, skills CSVs, sync-reference hardening, docs).
- Migration **090 is DEV-ONLY** — joins 085/086/087 for prod application + cascade + full re-score AT MERGE.
- Skills dictionary: dev=188 active; **prod still has the old 14** (syncs at/after taxonomy merge — the `--dev`-aware sync + hint validation enforce the right order).

## Open questions (Matt to decide)
- Aadhya evidence bar: should "aspiring full-stack" + "prototyping SaaS apps" earn `fullstack_engineering`? (Recommend: keep conservative.)
- Parent-widening: `thermal_engineering` (+aerospace), `reliability_engineering` (+electrical) from the gap report, plus whatever the strip-review (item 2 above) surfaces.
- Add `CAD` + `Simulation` skill rows? (multi-candidate strips in the populate run.)
- After verification: freeze + holdout one-shot, or one more tuning batch?

## Watch-outs
- **Jessica Henson + Thomas A. show STALE cls-2026-07-01d preview data** (the 2 val-fails — out-of-vocab specialty names "ml_engineering" / "mechanism_design"). Don't report as new bugs; fixed by the queued specialty-repair extension + re-run.
- Sequencing after verification: holdout ONE-SHOT (locked until then) → full-corpus POOL → hardening-before-merge (BUGS.md) → prod taxonomy 085–087+090 + person-data cascade + full re-score → flip search/scoring to `_inferred` → PR + Vercel-preview-before-merge.
- `reference/eval/*` is PII, gitignored — never commit. Every LLM run: cost estimate FIRST, no auto-reruns; populate estimates ±30%.
- `classification_status` is the live queue key — previews only ever write `_inferred_preview`.
- tuning-trend.log: the three cls-2026-07-02a lines ran against different vocab sizes (4→187→188 skills) — compare within a vocab, not across.
- Scores/buckets remain STALE until the ship-time full re-score. Legacy drawer fields (seniority/progression/full-time, `employment_type` capture) = separate batch cleanup.
- New CLAUDE.md rule: **ALWAYS provide the exact URL unprompted** (prod / `vetted-git-<branch-slug>-matt-tahrtechs-projects.vercel.app` / localhost, deep-linked).
