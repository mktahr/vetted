# Seeds — competitions / teams / signal_dictionary expansion

Source data for migrations 040–047. Eight CSVs.

## Files

| File | Rows | Used by |
|---|---|---|
| `olympiads_signals.csv` | 17 | Migration 043 (category=olympiad) |
| `national_labs_signals.csv` | 24 | Migration 043 (category=national_lab) + scripts/seed-national-labs-company-group.mjs |
| `tags_signals.csv` | 12 | Migration 043 (category=military / patent / publication; clearance rows DROPPED — see B4 in PR) |
| `hackathons_signals.csv` | 24 | Migration 044 (category=hackathon) |
| `conferences_signals.csv` | 49 | Migration 044 (category=publication) |
| `fellowships_signals.csv` | 45 | Migration 044 (category=fellowship; UPSERT MERGE — overwrites existing seeded rows from migration 025) |
| `vetted_competitions.csv` | 21 | Migration 045 (competitions table) |
| `vetted_teams.csv` | 142 | scripts/import-teams.mjs (drives migration 046's data load) |

## Run order

The migration sequence (040 → 047) is the **schema and SQL-driven** changes. The team data load is **script-driven** (post-migration 040, can run any time after).

```bash
# 1. Apply schema migrations 040–047 via Supabase migration system (psql / supabase-cli):
#    These are SQL files; they run in numeric order.
#    040 — schema scaffolding (competitions, teams, team_competition_map, team_domain_tag_dictionary, person_signals new cols)
#    041 — RLS off on the 4 new tables
#    042 — reclassify 23 engineering_team rows + ACM ICPC DO block (auto-handles delete/reclass)
#    043 — seed olympiads + national_labs + tags (53 INSERTs)
#    044 — seed hackathons + conferences + fellowships (118 INSERTs, UPSERT MERGE)
#    045 — seed competitions (21 rows + 10 new signal_dictionary rows)
#    046 — marker only (NOTICE that import-teams.mjs needs to run)
#    047 — extend person_signals_active view (LATERAL subquery; no row multiplication)

# 2. Dry-run the team importer to verify school matching:
node scripts/import-teams.mjs --dry-run

# 3. Review unmatched schools in stdout. Resolve via:
#    - Add school to schools table (preferred), OR
#    - Add alias to school_aliases pointing at existing school, OR
#    - Edit vetted_teams.csv to use canonical school_name

# 4. Apply team import:
node scripts/import-teams.mjs

# 5. Apply national-labs company group (re-runnable as new lab companies land):
node scripts/seed-national-labs-company-group.mjs --dry-run
node scripts/seed-national-labs-company-group.mjs
```

## App-code dependency (must ship in same PR)

Migration 043 adds two new categories (`olympiad`, `national_lab`) to `signal_dictionary`. The UI rendering files reference category lists for chip display. Three files have been updated to include the new categories:

- `app/components/ProfileTable.tsx` — main candidate row chip filter
- `app/components/ProfileDrawer.tsx` — drawer signals section
- `app/search-builder/page.tsx` — full filter UI

Without these edits, signals with category=`olympiad` or `national_lab` would not appear in filter chip lists (their evidence_metadata still gets stored, but the UI silently omits them).

## Diagnostics gated on prod DB access

Two outputs you'll want in the PR description before merge:

### 1. Migration 042 grep (already captured pre-PR)
```
$ grep -rEn "'engineering_team'" lib/ app/
app/components/ProfileDrawer.tsx:95: in SIGNAL_CATEGORY_ORDER
app/components/ProfileDrawer.tsx:108: in SIGNAL_CATEGORY_LABELS
app/components/ProfileTable.tsx:484: in SIGNAL_CATEGORY_ORDER
app/components/ProfileTable.tsx:488: in SIGNAL_CATEGORY_LABELS
app/search-builder/page.tsx:188: in SIGNAL_CATEGORY_ORDER
app/search-builder/page.tsx:192: in SIGNAL_CATEGORY_LABELS

All 3 files already include 'competition' in their order arrays.
After 042 reclassification: 23 signals shift from "Eng. Team" chip group to "Competition" chip group.
No app-code breakage. Updated 3 files to add olympiad + national_lab labels alongside.
```

### 2. ACM ICPC `person_signals` count (auto-handled by 042 DO block)

Pre-run query (optional, for visibility):
```sql
SELECT count(*) AS acm_icpc_person_signals
FROM person_signals
WHERE signal_id = (
  SELECT id FROM signal_dictionary
  WHERE canonical_name = 'ACM ICPC' AND category = 'engineering_team'
);
```

Migration 042's `RAISE NOTICE` will show in the migration log:
- `0`: row hard-deleted; migration 044 creates ICPC.
- `>0`: row reclassified to category=hackathon, subcategory=competitive_programming, renamed to 'ICPC'. Migration 044's UPSERT merges seed values.

### 3. Unmatched schools from team importer

Run `node scripts/import-teams.mjs --dry-run` after migration 040 lands. The script logs unmatched school names to stdout. Include the list in the PR description.

## Idempotency

All migrations + scripts are idempotent. Re-running:
- Migrations 040, 041, 047: structural (will fail if already applied — Supabase migration tracker prevents this).
- Migrations 042, 043, 044, 045, 046: data-bearing with UPSERT semantics; safe to re-run.
- Scripts: ON CONFLICT DO UPDATE (or DO NOTHING for join tables). Safe to re-run.

## Convention reminders

- **Slug derivation** for teams (locked in import-teams.mjs): lowercase team_name, replace non-alphanumerics with hyphen, drop article words (a/an/the/of/at/in), collapse hyphens.
- **source_field_hints translation** at import time: column-name-style (`activities_raw`, `description_raw`) → logical-name-style (`activities_honors`, `education_description`, `experience_description`, `about`, `title`, `company_name`).
- **tier_group format**: `tier_3`, `tier_2`, `tier_1` (with `tier_` prefix) for consistency across all categories. Older free-form values may exist in pre-migration-043 rows.
