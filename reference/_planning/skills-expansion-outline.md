# Storage Refactor + Taxonomy Expansion — Outline

Three related-but-separable initiatives. The skills expansion (running now) is independent of these.

Guiding principle (validated against the codebase): reference data a human reviews/edits → CSV + one sync path (`sync-reference.mjs`), app reads the DB. Business logic → stays in code. The test: "would a non-engineer ever want to open this as a spreadsheet?" Yes → CSV.

---

## Initiative A — Storage refactor (the foundation)

Collapse today's 4 storage mechanisms into 1 (CSV + sync-reference) for the reference data that matters and changes. Currently only ~15% of reference data (signals, skills, investors) uses the good pattern; the most important, most-changing data (core taxonomy) is in the least accessible tiers.

### MOVE to CSV + sync-reference (priority order)
1. **schools + school_aliases** (today: inline in seed-*.mjs) → `reference/schools/*.csv`. HIGH value — rankings + aliases must be human-editable. You flagged this explicitly and you're right.
2. **function_dictionary** → `reference/taxonomy/functions.csv`
3. **specialty_dictionary** (multi-parent `parent_function TEXT[]`) → `reference/taxonomy/specialties/*.csv`
4. **role_dictionary + role_specialty_map** → `reference/taxonomy/*.csv` — BUT resolve the role-vs-department question first (Initiative B).
5. **seniority_rules** (400+ patterns inline in seed-seniority-rules.mjs) → `reference/seniority/seniority_rules.csv` — already a BACKLOG item.
6. **title_level_dictionary** → `reference/taxonomy/title_levels.csv`

### STAY as code (correct as-is — do not over-correct)
- `lib/tenure/data/*.ts` (consulting firms, OSS projects, self-employed names, OSS role patterns) — small, logic-coupled; the pattern ones are regex = code. (Plain value-lists could ride into CSV cheaply if convenient, but low priority.)
- `lib/education/data/*.ts` (blocklist / degree-allowlist / incubator patterns) — mostly regex; a cosmetic display filter, NOT your school list.
- `lib/locations/us-locations.ts` — US-only today. FLAG: global expansion should use a geocoding service, NOT a hand-maintained CSV of every city on earth. Its own conversation, bigger than a CSV.
- `lib/companies/taxonomy.ts` + `tagger/dictionary.ts` — coupled to CHECK constraints + the LLM tagger prompt; CSV-able later, lower priority.
- degree-relevance dictionary inside `score-candidate.ts` — logic-coupled.

### HARD CHECKPOINT (highest risk in the whole refactor)
`function_dictionary` + `specialty_dictionary` feed the FROZEN classifier vocab hash `33c400c8`. Moving them to CSV must preserve EXACT names, parent arrays, and role-map — verify the hash is UNCHANGED (dev-first) before prod. Any drift silently breaks the frozen `cls-2026-07-08a` contract: every classification's provenance stamp diverges and you'd have to re-run + re-verify the whole classifier. Treat "hash unchanged" as the gate, not a footnote.

### Method
Extend `sync-reference.mjs` (handler-per-table pattern already exists) with a handler per table. For each: dump current DB rows → CSV (exact) → add handler → `--dry-run` verify byte-identical → done. Additive, non-destructive, dev-first.

---

## Initiative B — Taxonomy / roles expansion (on the refactored foundation)

Cover all tech roles (product, design, ops, finance, TA/recruiting, sales, marketing, legal, IT…), not just engineering. Do this as CSV edits AFTER Initiative A — expanding a SQL-migration-only taxonomy is painful and error-prone.

### DESIGN-PASS INPUT ARTIFACTS
- Matt's draft function→sub-function→specialty tree (2026-07-12, iterating with a separate chat; explicitly NOT exhaustive/final) — saved at `taxonomy-tree-draft.md` alongside this outline. Known open opinion inside it: Matt leans toward folding infra/SRE/platform under Software rather than a separate sub-function.
- The Phase-0 coverage map the skills session will produce (researched function/sub-function map of every tech-company role, Matt-approved) — the skills session is instructed to save it as a standalone file.

### UNRESOLVED DESIGN QUESTIONS — need a dedicated design pass BEFORE authoring any rows
1. **Department layer vs the existing role_dictionary.** The other audit proposed a new `departments` layer above functions + a fresh `role_specialty_map.csv`. But `role_dictionary` (26 roles) ALREADY spans departments (Software Engineer, PM, Designer, Operator, Sales/GTM, Recruiter/Talent, Finance, Legal, Founder…) and is STILL LIVE in search via the 094-remapped `role_specialty_map` — though CLAUDE.md says it's slated for retirement under the five-axis model. So the department proposal collides with an existing, live-but-being-retired layer. Does "department" REPLACE role_dictionary, REPURPOSE it, or sit above functions? Resolve before adding rows. (This is the one real gap in the other audit — not wrong, incomplete.)
2. **Naming/structure of non-eng specialties** relative to the frozen engineering set (the `_engineering` suffix convention, multi-parent arrays).
3. **Which inactive functions to ACTIVATE** (function_dictionary already holds inactive product/design/operations/finance/legal/recruiting/etc. rows as FK targets).

---

## Initiative C — Backfill non-eng skill hints

After B activates non-eng specialties, revisit the non-eng skills built in the skills initiative and fill their now-valid `primary_specialty` hints. Cheap, mechanical, semi-automatable. This is the only "second pass" — and it's the cheap part; the expensive alias research was done once.

---

## Recommended sequence
1. **Skills initiative** — NOW (unblocked, forward-compatible, immediate value).
2. **Initiative A** (storage refactor) — schools + core taxonomy to CSV; frozen-hash checkpoint.
3. **Design pass** on the department-vs-role_dictionary question.
4. **Initiative B** (taxonomy expansion) — authored as CSV on the clean foundation.
5. **Initiative C** (non-eng hint backfill).

Nothing is on fire — the app works. This is "build it like a scalable company," and the highest-leverage move is making CSV+sync the default for the core people-taxonomy before you 5x it.
