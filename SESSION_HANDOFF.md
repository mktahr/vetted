# Session Handoff — for the next Claude Code session

_Last session: 2026-07-12 — docs-only. Investigated the hardcoded-locations concern and queued a near-term ROADMAP item (Global location filter via geocode-on-ingest). No code, no migrations, no build started._

## Where we left off
Light docs-only session. Traced the "hardcoded locations" problem to its real root (unnormalized free-text matching, not just the short hardcoded list) and queued a **near-term ROADMAP item**: Global location filter via geocode-on-ingest. No code touched, no build started.

Prior arc unchanged: five-axis sub-PR 3 is MERGED + live + re-scored (PR #16, 2026-07-08). Prod healthy.

## What's in flight
- Branch: `subpr4-person-skills` (docs commit `6db4236` pushed). **No open PR** — pre-PR, direct-to-branch.
- No build in flight. Next build is Matt's pick.

## Next thing to do
Matt picks the next build. Leading candidates:
1. **Global location filter via geocoding** (newly queued, near-term) — see ROADMAP "Next Up". Needs Matt's 3 decisions before build (scope / provider / US-only vs international).
2. **Taxonomy sub-PR 4** — per-experience `title_normalized` aggregation → `people.current_title_normalized` + `ever_titles` + person-level skills view (the extension skills-scrape + alias-matcher BACKLOG item slots in here). This is the current branch's namesake.
3. **Network list-building + CSV export** — the GTM unlock.

## Open questions
Location filter (answer before building):
- Scope: search-time normalization only, or also add radius search to the candidate table (mirroring the import side)?
- Provider: Mapbox / Google Places (best on messy LinkedIn metro strings; paid, cheap at once-per-candidate volume) vs Nominatim/OSM (free, weaker on vague metros). One new env var either way.
- US-only or international.

## Watch-outs
- The location fix's root cause is **unnormalized text**, not list length — do NOT "fix" it by adding more cities to `lib/locations/us-locations.ts`. The substring match against `people.location_name` (Crust's raw location string) is the actual defect. Crust's *structured* location fields are unreliable (documented), so geocoding must run on our side at ingest.
- Branch name is `subpr4-person-skills` but its recent commits were unrelated (InfoTip tooltips, then this docs session). If sub-PR 4 proper gets built, confirm the branch state is what you expect first.
- `BACKLOG.md` axis-4 "Company-derived environment / regulatory context attribution" entry was a pre-existing uncommitted change folded into this session's commit — it's now saved, not lost.
- Fast-follows still queued in BUGS from the July-8 merge arc: PostgREST 14.1→14.5 parity, ingest-time classify hook. Plus the companies-scoring coverage gap (SeJun-class candidates pinned by unscored employers) — the current scoring bottleneck.
