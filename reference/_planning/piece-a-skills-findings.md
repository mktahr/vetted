> STATUS: UNVERIFIED FINDINGS (session-level investigation). These findings were produced by inspection in a single session (the Piece B execution session, 2026-07-12) and have NOT been independently cross-checked against the live codebase, the archived payloads, or LinkedIn's current API behavior. Items marked CONFIRMED were verified against real archived data during the session; everything else — especially the Voyager association-endpoint hypothesis — is "believed true, confirm before relying on it." Any session that acts on this doc (Piece A build, storage migration 099, Piece C tier display) MUST re-verify each finding first.

---

# Piece A / Piece C — Third Skills Source: Findings + Expanded Scope

**Context:** Matt's browser check of Reid Buzby's LinkedIn (2026-07-12) surfaced that skills appear in THREE structurally different places, and the middle one was uncaptured. This doc records the verified facts, the revised tier model, and the expanded Piece A scope. Everything here gates Piece C — the merged skills view shouldn't ship until Piece A answers the association question.

## The three sources

1. **Named in a role's description text** — e.g. Stripe: "Building Stripe's core compute infrastructure on Kubernetes, AWS and Linux." Extracted by the five-axis classifier → `person_experiences.skills_inferred`. LIVE today. Evidenced tier.
2. **Attached by the person to a specific role** — the pill under each experience ("TypeScript, PostgreSQL and +5 skills"). Structurally tied to that experience: role attribution AND dates. **UNCAPTURED ANYWHERE today** (CONFIRMED — see findings).
3. **The profile-level skills bucket** — the ~40 undated tags at the bottom of the profile → `people.skills_matched` (Piece B, migration 098). LIVE today. Mentioned tier.

## Verified findings (CONFIRMED against real data, 2026-07-12)

- **Source #2 is uncaptured at every layer:** the extension's extraction flattens skill entities into a `Set` of unique names (`vetted-extension/src/content.ts` ~lines 1144–1161 — association data, if present, is discarded); the canonical ingest payload has no per-experience skills field; Crust enrich returns a flat `skills.professional_network_skills` string list.
- **The extension has been discarding skill names it already fetched:** the `FullProfileWithEntities` decoration (actively fetched on every scrape) embeds resolved `com.linkedin.voyager.dash.identity.profile.Skill` entities in `included[]` — but extraction only ever read `voyagerCache.skills` (the PASSIVE interception slot, which fired in **0 of 100** archived scrapes). The names were in hand and thrown away.
- **49 of 100 archived scrapes (distinct profiles) have mineable Skill entities** in their archived `raw_ingest_events.payload.voyager_responses.fullProfile.included` — 11–20 skills each (the decoration appears to page/cap at ~top-20). These are profile-bucket skills (mentioned tier): sample entity carries ONLY `name` + `entityUrn` — **no position/association fields**. Position entities likewise carry no skill refs.
- Therefore: **nothing we currently fetch contains the skill→experience association.** LinkedIn's own UI proves the data exists server-side ("Terraform — 2 experiences at Ponto and 1 other company", rendered on the /details/skills/ surface).

## Hypothesis to verify FIRST in the Piece A browser loop (NOT confirmed)

The /details/skills/ surface is served by a richer decoration / GraphQL query that may return **structured position URNs** per skill (mappable to experiences) — or may only return display text ("2 experiences at …"). This single question determines whether declared-for-role skills are capturable with attribution, and therefore whether the evidenced tier has one sub-source or two. It is the FIRST item in the Piece A verification loop, ahead of "does the fetch work at all."

## Revised tier model (Piece C design — settled with Matt in-conversation, build blocked on the hypothesis above)

```
EVIDENCED (normal chips, role-attributed, dated, satisfies "currently uses X")
  ├─ extracted-from-description   → skills_inferred (classifier, live today)
  └─ declared-for-role            → NEW (person-asserted per role — Piece A capture)
MENTIONED (muted/italic + ⓘ, undated, "ever"-scope only)
  └─ profile-level bucket         → skills_matched (live today)
```

- Declared-for-role sits in the EVIDENCED family (role attribution + dates; trust comparable to extraction — both originate from the candidate, one as a structured claim, one as prose the classifier read).
- Display: one merged "Skills" section, evidenced sub-sources as normal chips distinguished only by tooltip ("Named in role description at X" / "Declared by candidate for role at X"); mentioned stays muted/italic. Overlap collapses upward (evidenced wins; dual-evidenced cites both in tooltip).
- Search: union across tiers + a "proven only" toggle (restricts to the evidenced family). **Mentioned skills participate only in "ever"-scoped predicates** — undated tags can't prove currency (same strict-current discipline as the sub-PR 3 flip). Declared-on-a-current-role DOES satisfy currency.
- Scoring: out of scope here — mentioned skills have no dates for recency decay; sub-PR 6's decision.

## Expanded Piece A scope (three changes)

1. **Fetch:** active skills fetch must use the association-bearing decoration (details-skills query), not a flat list. Fallback regardless of outcome: ALSO extract Skill entities from `fullProfile.included` (fixes the drop-on-the-floor bug even if the association endpoint fights us).
2. **Payload shape:** the extension resolves associations to its own parsed experiences (position URN → experience object) BEFORE POSTing — payload becomes `experiences[].skills_tags` per role + the person-level bucket for unassociated tags. URN mapping happens extension-side; ingest never sees URNs.
3. **Storage:** additive migration (099) — `person_experiences.skills_declared_raw TEXT[]` + `skills_declared TEXT[]` (matched canonicals), kept SEPARATE from `skills_inferred` (pristine classifier output stays pristine — same separation principle as `specialty_inherited`).

**Design problem flagged for the Piece A Codex loop:** ingest delete+reinserts experiences on every re-ingest, so a later Crust import (which carries no declared skills) would silently WIPE them. Needs a no-wipe analog keyed on experience identity `(company|title|start)` — same problem class as the dup-ingest race.

## Queued quick win (independent of the extension)

**Archive-mining backfill extension:** ~20-minute addition to `scripts/backfill-person-skills.mjs` — mine `fullProfile.included` Skill names from the 49 archived profiles → mentioned-tier columns (existing Piece B storage, no migration, no re-scraping). Extends person-level skills coverage from 9 → potentially ~50+ people. Awaiting Matt's go.

## Sequencing consequence

Piece A firmly precedes Piece C. Matt's phased order (2026-07-12): **Step 0 (fork-reconcile + reclassify + docs fix) → Piece A → Phase 1 storage refactor → Phase 2 skills expansion.** Piece C slots after Piece A answers the association question.
