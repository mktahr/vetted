-- 048_rename_entry_to_junior_ic_and_add_incubator_category.sql
--
-- TWO INDEPENDENT CHANGES bundled because both are small + low-risk:
--
-- A. Rename seniority_level enum value 'entry' → 'junior_ic'.
--    Reason: "entry" implied career stage; we need pure level vocabulary so
--    seniority/stage/bucket are three orthogonal axes (V1 product framework).
--    PostgreSQL ALTER TYPE RENAME VALUE is fast and transparent — all
--    enum-typed columns (person_experiences.seniority_normalized,
--    people.highest_seniority_reached, etc.) get the new value automatically
--    without a backfill. Only the TEXT-typed seniority_dictionary needs an
--    explicit UPDATE.
--
-- B. Extend signal_dictionary CHECK constraint to add 'incubator' category.
--    Reason: YC, EF, Antler, CDL, SPC, Pioneer, On Deck were classified as
--    fellowship/founder_track. They're accelerators, not fellowships.
--    Migration 054 does the reclassification UPDATE + seeds new incubator
--    entries. This migration just opens the CHECK constraint to allow the
--    new category value.

BEGIN;

-- ─── A. Rename seniority_level value 'entry' → 'junior_ic' ────────────

ALTER TYPE seniority_level RENAME VALUE 'entry' TO 'junior_ic';

-- seniority_dictionary.seniority_normalized is typed as the seniority_level
-- enum (per migration 005 line 88-89, which converted it back to enum after
-- briefly making it TEXT). PostgreSQL ALTER TYPE RENAME VALUE automatically
-- cascades to enum-typed columns, so the row that had 'entry' now has
-- 'junior_ic' without needing an explicit UPDATE.
--
-- No other columns on seniority_dictionary need changes — actual schema is
-- (seniority_normalized PK, rank_order, description, active). The "Junior IC"
-- user-facing display label lives in UI code (label maps in ProfileDrawer,
-- ProfileTable, search-builder), added in the code refactor PR.

-- ─── B. Extend signal_dictionary CHECK with 'incubator' ───────────────

ALTER TABLE signal_dictionary DROP CONSTRAINT IF EXISTS signal_dictionary_category_check;

ALTER TABLE signal_dictionary
  ADD CONSTRAINT signal_dictionary_category_check
  CHECK (category IN (
    'fellowship', 'scholarship', 'hackathon', 'greek_life', 'athletics',
    'engineering_team', 'student_leadership', 'academic_distinction',
    'founder', 'open_source', 'publication', 'patent', 'speaking',
    'writing', 'military', 'hospitality', 'teaching', 'career_changer',
    'self_taught', 'language', 'competition',
    'olympiad', 'national_lab',
    'incubator',  -- NEW (this migration)
    'other'
  ));

-- ─── Verification ────────────────────────────────────────────────────

DO $$
DECLARE
  dict_rows_with_junior_ic INT;
BEGIN
  -- Confirm the renamed enum value lands in seniority_dictionary.
  -- (We cannot query for 'entry' anymore — that enum value no longer exists.)
  -- The ALTER TYPE RENAME VALUE earlier in this transaction cascades to all
  -- enum-typed columns automatically; the row that had 'entry' now has
  -- 'junior_ic' without an explicit UPDATE.
  SELECT count(*) INTO dict_rows_with_junior_ic
  FROM seniority_dictionary
  WHERE seniority_normalized = 'junior_ic';
  IF dict_rows_with_junior_ic = 0 THEN
    RAISE EXCEPTION 'Migration 048: seniority_dictionary has no row with seniority_normalized=''junior_ic''. Enum rename may not have cascaded; expected at least 1.';
  END IF;

  RAISE NOTICE 'Migration 048: seniority enum entry→junior_ic renamed (cascaded to enum-typed columns; % row(s) in seniority_dictionary). signal_dictionary CHECK extended with ''incubator''. User-facing label ''Junior IC'' will land in UI code (label maps) in the code refactor PR.', dict_rows_with_junior_ic;
END $$;

COMMIT;
