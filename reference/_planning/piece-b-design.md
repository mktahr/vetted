> STATUS: AS-BUILT design record (Piece B execution session, 2026-07-08→09). This is the
> Codex-converged design (2 review rounds) with the round-1/round-2 revision annotations inline —
> preserved for history. The SHIPPED code is authoritative where they differ: branch
> `subpr4-person-skills` commits 5fde7d7 (build) / 6de0d0b (dictionary pass + backfill fixes) /
> 9d07be6 (InfoTip). Post-design deltas applied at build time: capture-bias corrections (cv alias
> KEPT, qualifier allowlist INVERTED to a contradiction blocklist, qualifier-merge step added —
> Codex round 2, Matt's governing principle); backfill grew a 4th source (legacy profiles.skills_tags)
> and the profile_snapshots bridge goes via profiles.id (people.legacy_profile_id is empty on prod).

---

# Piece B design — deterministic person-level skills matcher (taxonomy sub-PR 4, first PR)

## Problem
Scraped LinkedIn skills (`canonical_json.skills_tags`) are DISCARDED at ingest today — used only as a
hint to the legacy specialty resolver (lib/ingest/write-canonical.ts:541,607,644), never persisted to any
normalized table. Per-role `skills_inferred` (classifier) only sees role descriptions; candidates with
empty descriptions but rich LinkedIn skill sections (Pavlo, Aadhya, Guy) show zero skills.

## Storage — migration 098 (additive, dev-first then prod)
On `people`:
- `skills_scraped_raw TEXT[]` — verbatim latest non-empty `skills_tags` from ingest (deduped, order preserved)
- `skills_matched TEXT[]` — canonical `skills_dictionary.canonical_name` values produced by the matcher (GIN index)
- `skills_matched_at TIMESTAMPTZ` — when the matcher last ran for this person
- `skills_scraped_source TEXT` — ingest source that provided the raw tags (e.g. chrome_extension_voyager, crust_enrich)

Unmatched tags are NOT stored in their own column. Precision (Codex): "unmatched" is NOT derivable by
subtracting `skills_matched` from `skills_scraped_raw` (aliases cross-map — `golang` matches canonical
`Go`); it is derived by RE-RUNNING the matcher over `skills_scraped_raw`, which is cheap, in-memory, and
exactly what the --rematch flow does anyway. The raw column is the durable replay buffer — no
raw_ingest_events JSONB mining needed after the initial backfill.

## Matcher — `lib/skills/match.ts` (pure code, zero LLM)
LinkedIn skills are DISCRETE tags (each entry is a standalone string like "Go (Programming Language)",
"C++", "PyTorch"). The matcher NEVER does substring or fuzzy matching — whole-tag equality only.

normalize(token):
1. Unicode NFKC normalize
2. lowercase
3. trim + collapse internal whitespace
4. preserve ALL punctuation — "c++", "c#", ".net" stay intact

Match is TWO-STEP (revised post-Codex round 1):
1. exact lookup of the full normalized tag
2. if no hit AND the tag ends in a parenthetical qualifier: strip it ONLY when the qualifier is on a small
   ALLOWLIST (seed: "programming language", "software") and retry — "Go (Programming Language)" → "go" ✓;
   "Go (Game)" → qualifier not allowlisted → NO strip → unmatched (visible for allowlist review).
   This closes the false-positive lane Codex found in blind stripping.

Lookup: build Map<normalizedToken → canonical_name> from ACTIVE skills_dictionary rows over
(canonical_name ∪ aliases[]). match(tags) → { matched: canonical[], unmatched: rawTag[] }, deduped, stable order.

Short-token safety: "C", "R", "Go" are safe under whole-tag equality — a tag matches "C" only if the tag
IS "c" after normalization. No substring rule exists for it to misfire through.
AMBIGUOUS-ALIAS PASS (Codex): drop the `cv` alias from Computer Vision (bare "CV" can mean curriculum
vitae) — full form still matches. Audit all aliases ≤3 chars at build; `can` (CAN Bus), `ml`, `py`, `js`,
`ts` judged safe in an engineering corpus under whole-tag equality. Alias edits don't touch the vocab hash
(canonical names only) but still sync BOTH DBs dev-first.
Normalize parity: the same normalize() must run in the TS matcher and the .mjs sync gate — duplicated
implementations guarded by a shared fixture parity test (scripts/eval/test-skill-normalize.ts, tsx house pattern).

## Alias collisions — two layers
1. AUTHORITATIVE GATE in scripts/sync-reference.mjs (mirrors the existing primary_specialty hard gate,
   runs in --dry-run too). REVISED post-Codex: the gate validates the PROJECTED POST-SYNC END-STATE —
   current DB active rows with the in-memory CSV diff applied — across ALL categories, not just the CSV
   being processed (otherwise `--only=skills/tool.csv` misses a collision with an alias in another file).
   Same-row canonical/alias duplicate → dedupe silently; cross-row duplicate → hard fail before any write.
2. RUNTIME DEFENSE in the matcher: if the loaded dictionary still yields a colliding token (direct DB
   edit drift), drop that token from the map + console.error — fail-safe no-match, never a guess.

## Where it runs
1. INGEST — in writeCanonicalProfile, after the people upsert: if canonical.skills_tags is non-null AND
   non-empty → run matcher, write all four columns. If null/empty → DO NOT TOUCH existing columns.
   (Critical: Crust v2 person-search payloads always carry skills_tags: null — a bulk re-import must not
   wipe extension-scraped skills.) Overwrite policy when non-empty: latest-non-empty-wins (snapshot
   semantics, consistent with ingest's delete+reinsert philosophy); history stays in raw_ingest_events.
2. BACKFILL — scripts/backfill-person-skills.mjs, dry-run default + --apply.
   REVISED post-Codex (verified: app/api/ingest/route.ts:67 archives `payload.raw_json ||
   payload.canonical_json` — the archive is the RAW source blob, NOT reliably canonical_json; and the
   network projectConnection path never writes raw_ingest_events at all):
   - default mode: per person, newest-first across THREE sources with a multi-shape extractor:
     (a) raw_ingest_events payload — try payload.skills_tags (canonical-fallback archives),
         payload.canonical_json.skills_tags (defensive), payload.skills (Crust v1 raw),
         payload.skills.professional_network_skills (Crust enrich blob);
     (b) profile_snapshots.canonical_json.skills_tags — legacy extension scrapes (the profile page
         PROVES this data exists today: app/profile/[id]/page.tsx:141-151 renders skills from it);
     (c) network_enriched_profiles.enriched_profile — for network-projected people (no raw archive).
     Dry-run prints per-source hit counts so coverage is visible before --apply.
   - --rematch mode: re-run matcher from stored skills_scraped_raw (for after dictionary/alias growth).

## Display + search — three-tier provenance (BADGED, not silent)
- evidenced-in-role: per-role skills_inferred (existing chips)
- inherited-from-career: specialty only — skills are NEVER inherited (unchanged)
- mentioned-on-profile: NEW person-level "Profile skills" section (profile page + drawer), visually
  distinct (muted + ⓘ, same honesty pattern as inherited specialties). Tooltip: "From the candidate's
  LinkedIn skills section — not tied to a specific role."
Search: the skills filter reads the union (any role's skills_inferred ∪ skills_matched). B ships storage +
display; the search-union wiring + current/ever views ride Piece C (aggregated columns) to keep B small.

## Hard boundaries
- Person-level skills NEVER feed the per-role classifier (role attribution would be guessing —
  Codex-concurred 2026-07-07; decision stands).
- Not wired into scoring in this PR — sub-PR 6 decides whether/how person-level skills contribute
  (they carry no tenure/recency attribution, so intersection scoring can't use them as-is).
- CLASSIFIER LIFECYCLE ISOLATION (Codex): the skills write NEVER touches classification_status /
  classification_generation / classifier_version and NEVER calls bump_classification_generation —
  person-level skills don't feed the classifier, so a skills update is not a re-classification trigger.
- UI SUPERSESSION (Codex, verified): the profile page's existing skills section reads
  profile_snapshots.canonical_json (app/profile/[id]/page.tsx:141-151) — it gets REPLACED by the new
  people.skills_matched badged section, never rendered alongside it (no two conflicting skill lists).
- skills_scraped_source stays free TEXT — network projection writes sources outside the ingest route's
  VALID_SOURCES list (e.g. crust enrich), so no CHECK constraint against that list.

## Vocab-hash watch-out (verified)
The classifier vocab hash includes skill CANONICAL NAMES only, not aliases
(lib/candidates/classifier/index.ts:42,50). Alias-only CSV edits do NOT fork the frozen
cls-2026-07-08a/33c400c8 contract; adding NEW active skills changes the hash on subsequent runs (accepted
provenance behavior). Either way, ALL /reference/skills/*.csv edits sync to BOTH DBs dev-first (parity
invariant).
