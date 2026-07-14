> STATUS: UNVERIFIED FINDINGS (session-level audit). These findings were produced by inspection in a single session and have NOT been independently cross-checked against the live codebase or DB. A parallel sequencing session already found that some adjacent claims (e.g. what feeds the classifier vocab hash) were inaccurate. Therefore: any future session that acts on this audit — especially the Phase 1 storage refactor — MUST re-verify each finding against the actual files, migrations, and DB state before executing anything. Treat every item below as "believed true, confirm before relying on it," not as ground truth.

---

# Data-Structure / Taxonomy Audit

**Scope:** where all dictionary/taxonomy/reference data lives today, what is not best-practice, what should change (now vs later), the broken/orphaned scripts found, and the recommended department-layer structure for the roles expansion beyond engineering.

**Author's note on confidence:** Items in Part 3 (Broken / Orphaned) were spot-checked against the actual files during this session and are marked CONFIRMED where verified. The tier inventory (Part 1) was assembled by inspection and should still be re-confirmed file-by-file before any refactor. One earlier claim in this session was **wrong and is corrected here**: the inline seniority `RULES` array is **73 entries, not "400+"** — the "400+" figure came from CLAUDE.md's description of the DB table, not the seed script. This is exactly the kind of drift the header warns about.

---

## Part 1 — Inventory: where every reference dataset lives (Tiers A–E)

The root problem: reference data is spread across **four different storage mechanisms** with no single convention. The good pattern (Tier A) exists but only ~15% of datasets use it — and the data that matters most and changes most (the core people-taxonomy) sits in the **least accessible** tiers. Accessibility is inverted.

### Tier A — CSV-driven ✅ (the good pattern)
CSV in `/reference/` is the source of truth; `scripts/sync-reference.mjs` diffs and pushes to the DB. Human-viewable, human-editable, one sync path.

1. **Signals** → `/reference/signals/*.csv` (23 files: olympiads, fellowships, hackathons, national labs, athletics, greek life, competitions, etc.) → `signal_dictionary`
2. **Skills** → `/reference/skills/*.csv` (7 files by category: programming_language, framework, protocol, tool, domain, hardware, methodology) → `skills_dictionary` (~192 active)
3. **Investors** → `/reference/investors/investor_tiers.csv` (70 rows) → `investor_tiers`

*Only 3 of ~20 datasets use this pattern.*

### Tier B — CSV exists, but sync is a SEPARATE one-off script (half-good)
4. **Companies + year scores** → `/reference/companies/company_scores.csv` → loaded via `reseed-companies.mjs` / `import-company-scores.mjs` (deliberately not sync-reference; the company table is too large for row-by-row UPSERT)
5. **Teams + competitions** → `/reference/teams/teams.csv` + `competitions.csv` → loaded via `import-teams.mjs` **(⚠ this script is broken — see Part 3)**
6. **Field of study** → `/reference/dictionaries/field_of_study.csv` → but the actual seed was migration 064; the CSV is an **orphaned reference copy**, not the live sync source (see Part 3)
7. **Search intents** → `/reference/search_intents/intent_signal_map.csv` → reference-only, never loaded to DB (documented as such)

### Tier C — MIGRATION-ONLY 🔴 (SQL only, no CSV, cannot be viewed as a spreadsheet)
This tier holds the **most important, most-frequently-changed product axes** — the exact opposite of where they should be.

8. **Functions** → `function_dictionary` (18 active) → migrations 071/085/087
9. **Specialties** → `specialty_dictionary` (150 active, multi-parent `TEXT[]`) → migrations 072, 085–096
10. **Roles + role→specialty map** → `role_dictionary` (26) + `role_specialty_map` → migrations 017/094
11. **Seniority levels** → `seniority_dictionary` → migrations 005/059/067
12. **Degrees / employment types** → `degree_dictionary`, `employment_type_dictionary` → migration 002
13. **Scoring config** → `signal_scoring_weights`, `team_role_scoring_weights`, `career_stage_bucket_thresholds` → migrations 050–052

### Tier D — INLINE ARRAYS INSIDE `.mjs` SCRIPTS 🔴 (data trapped in code)
Not compiled into the live app, but the data lives as JavaScript arrays inside a program file — so it is not viewable/editable as data, and one bad comma breaks the file.

14. **Seniority rules** → `seed-seniority-rules.mjs` holds a `RULES = [...]` array inline — the title→seniority engine. **73 entries, not 400+** (corrected — see Part 3).
15. **Title levels** → `title_level_dictionary` → inline in `seed-title-levels.mjs`
16. **Recruiting titles** → inline in `seed-recruiting-titles.mjs`
17. **Schools + aliases** → inline / external-file in `seed-universities.mjs` + `seed-school-aliases.mjs` — **should be CSV** so rankings are viewable/editable (Matt explicitly wants this). `seed-universities.mjs` also has a broken hardcoded path — see Part 3.

### Tier E — HARDCODED IN TYPESCRIPT 🔴 (compiled into the LIVE app; change = code deploy; worst tier)
18. **Company taxonomy** → `lib/companies/taxonomy.ts` (~294 lines: categories, HARDWARE/NON_HARDWARE industries, domain tags)
19. **Company tagger vocab** → `lib/companies/tagger/dictionary.ts` (~389 lines: industry/tag list fed to the LLM company tagger)
20. **Degree-relevance dictionary** → hardcoded inside `lib/scoring/score-candidate.ts`
21. **Tenure logic data** → `lib/tenure/data/*.ts` (consulting-firms, oss-projects, self-employed-companies, oss-role-patterns)
22. **Education display filter** → `lib/education/data/*.ts` (blocklist-patterns, degree-allowlist, incubator-patterns)
23. **Locations** → `lib/locations/us-locations.ts` (US states + ~100 US cities)

**Tier D vs Tier E:** both share the same root problem — *"it's code, not data."* Tier E is worse only because it is compiled into the live running app (needs a deploy to change); Tier D is a standalone script (no deploy) but still stores data as code. Cure for both is identical: extract the list into a `.csv` and have one loader read it.

---

## Part 2 — The "spreadsheet test" and what it flags

**Best-practice rule for reference data:**
- **Reference/lookup data** (any list a non-engineer would ever want to view, review, or edit) → **CSV source of truth, ONE sync path to the DB, app reads the DB.**
- **Business logic** (how the lists are used; regex patterns) → **stays in code.**

**The test:** *"Would a non-engineer ever want to open this as a spreadsheet?"* If yes → it should be a CSV.

**What the test flags to MOVE to CSV (in rough priority order):**
- Functions, specialties, roles (Tier C) — **highest priority**, about to 5x for the roles expansion
- Schools + rankings + aliases (Tier D) — Matt explicitly wants to edit rankings
- Seniority rules (Tier D) — real product logic hidden in a JS array
- Title levels, recruiting titles (Tier D)
- Company industries + domain tags (Tier E) — later; harder because enforced by CHECK constraints + the LLM tagger prompt
- Company tagger vocab (Tier E) — later

**What should STAY as code (do NOT over-correct):**
- **Regex-based files** — `oss-role-patterns`, education `blocklist-patterns`, `incubator-patterns`, the `degree-allowlist` *patterns*. These are regular expressions (pattern-matching **code**, e.g. `/\bmaintainer\b/`), not values. They do not belong in a spreadsheet.
- **Small tenure/education value-lists** — `consulting-firms`, `oss-projects`, `self-employed-companies`, the degree-level allowlist. Tiny (a dozen-ish entries each), near-static, tightly coupled to logic in the same module, and no recruiter will ever edit them. "Nice to move, low priority" at most. Fine to leave.
- **Locations** — a real gap for a **global** platform (cannot search London/Bangalore today), BUT the correct fix is a **geocoding API**, not a hand-maintained CSV of every city on earth. Treat as its own separate conversation; do **not** fold it into the CSV refactor.

**What these "leave as code" files actually do (plain-English, since the names are opaque):**
- *Tenure files — all four exist to count someone's REAL years of full-time experience and not be fooled by side-gigs:* `consulting-firms` = firms where "Consultant" counts as a real job; `oss-projects` = open-source projects people list as employers but are usually volunteer; `self-employed-companies` = placeholder "employers" like Freelance / Self-Employed / N/A / Various; `oss-role-patterns` = titles like Maintainer / Committer that signal contribution, not a day job.
- *Education display-filter files — cosmetic cleanup of the messy LinkedIn Education section for DISPLAY only (NOT the school list or rankings):* `blocklist-patterns` = hide junk (yoga, bootcamps, workshops, outdoor programs); `degree-allowlist` = only show real degrees; `incubator-patterns` = hide accelerators (YC/Techstars) that belong in Signals, not Education.

---

## Part 3 — Broken / orphaned items found (CONFIRMED this session)

These were spot-checked against the actual files.

1. **`import-teams.mjs` — DEAD PATH (CONFIRMED).** The script reads `resolve(__dirname, '../supabase/seeds/vetted_teams.csv')`. That file **does not exist** (`ls` returns "No such file or directory"). The real teams data lives at `reference/teams/teams.csv`. As written, the script would fail at read time. Anyone re-seeding teams from this script will hit a broken path. Fix: point it at `reference/teams/teams.csv` (and ideally fold teams into the sync-reference pattern).

2. **Orphaned `field_of_study.csv` (CONFIRMED).** `reference/dictionaries/field_of_study.csv` exists, but `sync-reference.mjs` only handles three tables (`signal_dictionary`, `investor_tiers`, `skills_dictionary`). `field_of_study_dictionary` was seeded by migration 064. So this CSV is wired to **nothing** — editing it changes nothing in the DB. It is a reference copy masquerading as a source of truth.

3. **`seed-universities.mjs` — hardcoded machine-specific path (CONFIRMED).** Line 18: `const CSV_PATH = '/Users/matt/Downloads/Vetted - Original Tech Startup Focus   - Uni (2).csv';`. This file is not in the repo and the path only exists on one machine. The script is not reproducible for anyone else, and the canonical school list is therefore not version-controlled. This is the strongest single argument for moving **schools + rankings** into a committed CSV under `/reference/`.

4. **Seniority rules: 73 vs "400+" discrepancy (CONFIRMED; corrects an earlier claim).** The inline `RULES` array in `seed-seniority-rules.mjs` contains **73 entries** (`{ pattern: ... }` count = 73). CLAUDE.md describes `seniority_rules` as "400+ patterns." Both cannot be the live truth. Possible explanations to reconcile before acting: (a) CLAUDE.md is stale/aspirational; (b) additional rules were added by migrations (005/010/067) and/or `seed-recruiting-titles.mjs` beyond this script; (c) prod has drifted from the script. **Risk:** `seed-seniority-rules.mjs` does a full `delete().gte('rule_id', 0)` then re-insert — so **running it would shrink the table to 73 rows**, potentially destroying rules added elsewhere. Do not run it blind. Reconcile the true DB row count first.

5. **Exit-code-lie gate in `sync-reference.mjs` (CONFIRMED).** In `main()`, each handler runs inside a `try/catch`; on failure it pushes `{ path, error }` into `results`, prints a `✗ … ERROR:` line, and **the loop continues**. `main()` then completes normally. The only thing that triggers `process.exit(1)` is an exception thrown **outside** the per-handler loop — i.e. the global skill-token-collision gate (`validateSkillTokenCollisions`, run before the loop) or an error in `main()` itself. Consequence: **an individual CSV's sync can fail while the process still exits 0 (success).** Any CI/automation checking the exit code will believe a partial-failure sync succeeded. Global gates fail loud and correctly (exit 1); per-handler failures do not. Fix: track whether any handler errored and `process.exit(1)` at the end if so.

---

## Part 4 — Roles/skills expansion beyond engineering: recommended structure

The product is expanding from engineering-only to every role a tech company hires (product, design, operations, finance, talent/recruiting, sales, marketing, legal, etc.). Functions and especially specialties will balloon (150 engineering specialties alone could become 500+).

**Recommendation: MULTIPLE CSVs, split by department — mirror the existing `signals/` and `skills/` folder pattern. Do NOT use one giant file.**

**Add a DEPARTMENT layer ABOVE functions** (functions currently do double duty as both the discipline and the grouping). Recommended `/reference/` layout:

```
reference/taxonomy/
  departments.csv        # NEW top layer (~10-12 rows, ONE file):
                         #   engineering, product, design, operations,
                         #   finance, sales, marketing, g&a, legal, ...
  functions.csv          # ONE file, one row per function, with a `department`
                         #   column grouping them (~18 today -> ~60-80 across
                         #   all depts; still one file — small controlled list)
  specialties/           # ONE CSV PER DEPARTMENT (this is the file that explodes):
      engineering.csv
      operations.csv
      finance.csv
      sales_marketing.csv
      ...
  role_specialty_map.csv

reference/skills/        # KEEP existing per-CATEGORY split (skills are
                         #   cross-cutting, NOT department-bound):
      programming_language.csv, framework.csv, protocol.csv, tool.csv,
      domain.csv, hardware.csv, methodology.csv
      # + ADD non-eng categories: business_tool.csv, finance.csv,
      #   sales_methodology.csv, design_tool.csv, ...
```

**Rationale:**
- **departments + functions = one file each** — small controlled lists; a grouping column does the work.
- **specialties = one file per department** — volume explodes here; per-file review, natural ownership boundaries, fewer merge conflicts; mirrors `signals/` (23 files).
- **skills = keep per-category** — skills generalize across all departments (everyone "touches" tools and methodologies), so **category** is the right split axis, not department.
- **Key distinction to lock in up front:** skills stay a **flat, cross-cutting vocabulary**; specialties get the **departmental folder structure**. Getting this right now avoids a painful re-org later.

---

## Part 5 — Sequencing vs work in flight (summary; see the separate sequencing session for authority)

> The sequencing/phasing guidance is owned by the parallel session, which found some of this session's adjacent claims (e.g. exactly what feeds the classifier vocab hash) inaccurate. **Defer to that session on sequencing.** The summary below is this session's understanding only and must be reconciled.

- **The landmine:** functions/specialties/skills are consumed by the five-axis classifier, which is merged + live and pinned to a frozen vocab hash + PROMPT_VERSION. Any change to those dictionaries risks re-forking the hash and forcing a full re-classify + re-score. (⚠ The precise set of inputs to the hash was flagged as possibly mis-stated this session — confirm against `lib/candidates/classifier/index.ts::loadActiveVocab` before relying on it.)
- **Phase 0 — do nothing destructive yet.** Let in-flight branches (`subpr4-person-skills`, network-connections) land first; the refactor touches the same tables.
- **Phase 1 — plumbing only (non-destructive, safe to ship).** Move source-of-truth for Tier C/D tables into `/reference/` CSVs **without changing any values** — export current DB state to CSV, extend `sync-reference.mjs`, and prove `--dry-run` reports **zero diff**. Zero-diff = no vocab change = classifier contract intact. Also fix the Part 3 bugs here (import-teams path, orphaned field_of_study, seed-universities path, seniority reconciliation, exit-code gate).
- **Phase 2 — expansion (destructive to vocab; HOLD from prod).** The actual non-engineering expansion changes the vocab → requires a coordinated full re-classify + re-score, dev-first, simulated against prod's real rows, as one gated arc (like the 085–097 arc). Do the expansion on the CSV foundation, never on the raw SQL/migration foundation. Do **not** ship it piecemeal to prod.

**Hard rules that still apply (from CLAUDE.md):** non-additive migrations + anything touching prod data go dev-first then prod; Vercel preview + browser verification before any prod merge of user-visible/architecture changes; conditional mutations go through SQL RPCs (prod PostgREST 14.1 mishandles `PATCH + or=`); any vocab change must go to BOTH dev + prod or the hash forks.
