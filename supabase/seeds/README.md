# supabase/seeds/ — historical (CSVs moved 2026-05-20)

The eight signal CSVs that used to live in this folder (olympiads_signals, national_labs_signals, fellowships_signals, hackathons_signals, conferences_signals, tags_signals, vetted_competitions, vetted_teams) have been **moved to `/reference/`** as part of the reference data restructure on 2026-05-20.

**New location:**
- `supabase/seeds/olympiads_signals.csv` → `reference/signals/olympiad.csv`
- `supabase/seeds/national_labs_signals.csv` → `reference/signals/national_lab.csv`
- `supabase/seeds/fellowships_signals.csv` → `reference/signals/fellowship.csv`
- `supabase/seeds/hackathons_signals.csv` → `reference/signals/hackathon.csv`
- `supabase/seeds/conferences_signals.csv` → `reference/signals/publication.csv`
- `supabase/seeds/tags_signals.csv` → split into `reference/signals/military.csv` + `reference/signals/patent.csv` (the single publication-tag row landed in `reference/signals/publication.csv`)
- `supabase/seeds/vetted_competitions.csv` → `reference/teams/competitions.csv`
- `supabase/seeds/vetted_teams.csv` → `reference/teams/teams.csv`

**See:** the "Reference Data Convention" section in `CLAUDE.md` for the new flow (CSV → `node scripts/sync-reference.mjs` → DB).

This `supabase/seeds/` folder is retained for the migration ledger trail (the original migrations 040–047 still reference seed-document content from these files via inline SQL); future seed files would not land here — they'd land in `/reference/`.
