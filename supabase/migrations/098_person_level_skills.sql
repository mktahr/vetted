-- 098_person_level_skills.sql
--
-- Taxonomy sub-PR 4, Piece B: person-level scraped-skills storage.
--
-- Scraped LinkedIn skills (canonical_json.skills_tags) were previously DISCARDED
-- at ingest — used only as a hint to the legacy specialty resolver, never
-- persisted. These columns store the raw tags plus their deterministic match
-- against skills_dictionary (canonical_name + aliases), computed by
-- lib/skills/match.ts at ingest and by scripts/backfill-person-skills.mjs
-- for historical payloads.
--
-- Design (Codex-reviewed 2026-07-08, 2 rounds, converged):
--   • skills_scraped_raw   — verbatim latest non-empty skills_tags (deduped).
--                            Durable replay buffer: re-matching after dictionary
--                            growth re-reads this column (--rematch), no
--                            raw_ingest_events mining needed after backfill.
--   • skills_matched       — canonical skills_dictionary names from the matcher.
--                            GIN-indexed for the (Piece C) search union.
--   • skills_matched_at    — when the matcher last ran for this person.
--   • skills_scraped_source— ingest source that provided the raw tags. Free TEXT,
--                            deliberately NOT constrained to the ingest route's
--                            VALID_SOURCES (network projection writes sources
--                            outside that list).
--
-- Hard boundaries:
--   • Person-level skills NEVER feed the per-role classifier and NEVER touch
--     classification lifecycle columns (classification_status / _generation /
--     classifier_version). A skills update is NOT a re-classification trigger.
--   • Not read by scoring (sub-PR 6 decides).
--
-- Additive only. Dev-first per workflow (npm run migrate:dev, then migrate:prod).

ALTER TABLE people ADD COLUMN IF NOT EXISTS skills_scraped_raw    TEXT[];
ALTER TABLE people ADD COLUMN IF NOT EXISTS skills_matched        TEXT[];
ALTER TABLE people ADD COLUMN IF NOT EXISTS skills_matched_at     TIMESTAMPTZ;
ALTER TABLE people ADD COLUMN IF NOT EXISTS skills_scraped_source TEXT;

COMMENT ON COLUMN people.skills_scraped_raw IS
  'Verbatim latest non-empty skills_tags from ingest (deduped, order preserved). Replay buffer for re-matching after skills_dictionary growth. Latest-non-empty-wins; null/empty ingest payloads never wipe it.';
COMMENT ON COLUMN people.skills_matched IS
  'Canonical skills_dictionary.canonical_name values matched from skills_scraped_raw by the deterministic whole-tag matcher (lib/skills/match.ts). Person-level provenance tier: mentioned-on-profile (weakest of evidenced-in-role / inherited-from-career / mentioned-on-profile). Never feeds the classifier or scoring.';
COMMENT ON COLUMN people.skills_matched_at IS
  'When the matcher last ran for this person (ingest hook or backfill/rematch script).';
COMMENT ON COLUMN people.skills_scraped_source IS
  'Ingest source that provided skills_scraped_raw (e.g. chrome_extension_voyager, crust_person_enrich). Free text — not constrained to the ingest route''s VALID_SOURCES.';

CREATE INDEX IF NOT EXISTS idx_people_skills_matched
  ON people USING GIN (skills_matched);

-- Verification (empty-DB tolerant per Development Rules): schema-level only.
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_name = 'people'
        AND column_name IN ('skills_scraped_raw','skills_matched','skills_matched_at','skills_scraped_source')) <> 4 THEN
    RAISE EXCEPTION 'migration 098: expected 4 new skills columns on people';
  END IF;
END $$;
