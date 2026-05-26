-- 062_signal_dictionary_searchable_and_cleanup.sql
--
-- Post-PR #3 cleanup pass driven by Matt's preview-review feedback.
--
-- A. SCHEMA — add is_searchable BOOLEAN column.
--    Controls whether an INDIVIDUAL signal appears as a filter option in the
--    UI signals dropdown. Categories always show in the UI regardless of this
--    flag. Lets us keep granular dictionary entries (every fraternity, every
--    cum laude variant, Resident Assistant, Teaching Assistant) so the extractor
--    can recognize them, while keeping the UI filter dropdown clean.
--
-- B. DATA CLEANUP — drops/dedupes/reclassifies driven by audit.
--    • Drop 7 noise/duplicate rows
--    • Move 10 elite academic awards: fellowship → scholarship (in-place
--      UPDATE preserves UUIDs so any person_signals rows stay valid)
--    • Drop 3 additional fellowship rows that aren't real fellowships
--    • Drop 8 student_leadership rows that are participation-only
--    • Rename "Allen Institute" (fellowship) → "Allen Institute Research Fellowship"
--      + tighten aliases so it doesn't double-match with the research_institute
--      entry for "Allen Institute for AI"
--
-- C. TIER ASSIGNMENTS — academic_distinction, scholarship, student_leadership
--    get full tier_group coverage per the curated audit.
--
-- D. IS_SEARCHABLE flags — Resident Assistant + Teaching Assistant marked
--    extraction-only (is_searchable=FALSE). All other rows default to TRUE.

BEGIN;

-- ─── A. Schema: is_searchable column ────────────────────────────────────

ALTER TABLE signal_dictionary
  ADD COLUMN is_searchable BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN signal_dictionary.is_searchable IS
  'When TRUE, this individual signal appears as a filter option in the UI signals dropdown. When FALSE, the signal exists for extraction only (e.g. specific fraternities tag candidates as Greek Life but do not show as separate filter options). Categories always show in the UI regardless of this flag.';

-- ─── B1. Drops — noise + dups (7 from earlier-approved set + 3 from
--                  fellowship audit + 8 from student_leadership) ────────

-- Original 4 approved drops
DELETE FROM signal_dictionary WHERE canonical_name = 'Forbes 30 Under 30' AND category = 'fellowship';
DELETE FROM signal_dictionary WHERE canonical_name = 'Buick Achievers Scholarship' AND category = 'scholarship';
DELETE FROM signal_dictionary WHERE canonical_name = 'Burger King Scholars' AND category = 'scholarship';
DELETE FROM signal_dictionary WHERE canonical_name = 'Elks National Foundation Scholarship' AND category = 'scholarship';

-- Duplicate drops (3 — keep the other in each pair)
DELETE FROM signal_dictionary WHERE canonical_name = 'Gates Cambridge Scholarship' AND category = 'fellowship';
DELETE FROM signal_dictionary WHERE canonical_name = 'NSF Graduate Research Fellowship' AND category = 'fellowship';
DELETE FROM signal_dictionary WHERE canonical_name = 'Davidson Fellow' AND category = 'scholarship';

-- Fellowship audit drops (3 — not actually fellowships / unclear)
DELETE FROM signal_dictionary WHERE canonical_name = 'Apple Industrial Design' AND category = 'fellowship';
DELETE FROM signal_dictionary WHERE canonical_name = 'IDEO' AND category = 'fellowship';
DELETE FROM signal_dictionary WHERE canonical_name = 'AnitaB.org Pass-It-On Award' AND category = 'fellowship';

-- Student leadership drops (8 — participation-only or too broad)
DELETE FROM signal_dictionary WHERE category = 'student_leadership' AND canonical_name IN (
  'Admissions Tour Guide',
  'Orientation Leader',
  'Peer Mentor',
  'Student Council Member',
  'Student Senate Member',
  'Club President',
  'Yearbook Editor',
  'Radio Station Manager'
);

-- ─── B2. Reclassify 10 elite academic awards: fellowship → scholarship ──
--         In-place UPDATE preserves UUIDs (person_signals rows stay valid).

UPDATE signal_dictionary
  SET category = 'scholarship', tier_group = 'tier_3'
  WHERE category = 'fellowship'
    AND canonical_name IN (
      'Rhodes Scholarship', 'Marshall Scholarship', 'Gates Cambridge',
      'Goldwater Scholarship', 'Churchill Scholarship', 'Truman Scholarship',
      'Fulbright STEM', 'Mitchell Scholarship', 'Knight-Hennessy Scholars',
      'Paul & Daisy Soros Fellowship'
    );

-- ─── B3. Allen Institute fellowship rename + alias scope (Option A) ─────
--         Rename canonical to clarify it's the fellowship-specific signal,
--         and strip the broad "allen institute for ai" alias to avoid
--         double-matching with the research_institute entry.

UPDATE signal_dictionary
  SET canonical_name = 'Allen Institute Research Fellowship',
      aliases = ARRAY['ai2 fellow', 'allen institute fellow', 'ai2 research fellow'],
      description = 'Allen Institute for AI (AI2) Research Fellowship — selective research-track program. Distinct from working at AI2 in any capacity (see research_institute).'
  WHERE canonical_name = 'Allen Institute' AND category = 'fellowship';

-- ─── C. Academic Distinction tier assignments (20 rows) ────────────────

UPDATE signal_dictionary SET tier_group = 'tier_3' WHERE category = 'academic_distinction' AND canonical_name IN
  ('Phi Beta Kappa', 'Sigma Xi', 'Summa Cum Laude', 'Valedictorian', 'Salutatorian');

UPDATE signal_dictionary SET tier_group = 'tier_2' WHERE category = 'academic_distinction' AND canonical_name IN
  ('Tau Beta Pi', 'Magna Cum Laude', 'Eta Kappa Nu', 'Phi Kappa Phi', 'Beta Gamma Sigma');

UPDATE signal_dictionary SET tier_group = 'tier_1' WHERE category = 'academic_distinction' AND canonical_name IN
  ('Cum Laude', 'Dean''s List', 'Honors College', 'Mortar Board', 'Pi Tau Sigma',
   'Order of Omega', 'Phi Theta Kappa', 'Golden Key', 'Alpha Lambda Delta', 'Tau Sigma');

-- ─── C. Scholarship tier assignments (28 existing + 10 just-moved) ─────

UPDATE signal_dictionary SET tier_group = 'tier_3' WHERE category = 'scholarship' AND canonical_name IN
  ('Astronaut Scholarship',
   'Morehead-Cain Scholar', 'Jefferson Scholar (UVA)', 'Robertson Scholar',
   'Stamps Scholar', 'Park Scholar (NCSU)', 'QuestBridge Match Scholar',
   'Jack Kent Cooke Graduate Scholarship', 'Jack Kent Cooke College Scholarship',
   'Roy & Diana Vagelos Scholars');

UPDATE signal_dictionary SET tier_group = 'tier_2' WHERE category = 'scholarship' AND canonical_name IN
  ('Boren Scholarship', 'Coca-Cola Scholar', 'National Merit Scholar',
   'Posse Scholar', 'Udall Scholarship', 'Ron Brown Scholar',
   'Daniels Fund Scholarship', 'Gates Scholarship', 'Gates Millennium Scholars',
   'Jack Kent Cooke Young Scholars');

UPDATE signal_dictionary SET tier_group = 'tier_1' WHERE category = 'scholarship' AND canonical_name IN
  ('Hispanic Scholarship Fund', 'UNCF Scholarship', 'QuestBridge College Scholar',
   'Reagan Foundation GE-Reagan Scholarship');

-- ─── C. Student Leadership tier assignments (kept rows) ────────────────

UPDATE signal_dictionary SET tier_group = 'tier_3' WHERE category = 'student_leadership' AND canonical_name IN
  ('MIT UA Innovation Committee', 'Harvard VIP Select Cohort',
   'Student Body President', 'Class President', 'Boys/Girls Nation Delegate');

UPDATE signal_dictionary SET tier_group = 'tier_2' WHERE category = 'student_leadership' AND canonical_name IN
  ('Eagle Scout', 'Girl Scout Gold Award', 'Order of the Arrow',
   'Boys/Girls State Delegate', 'Honor Council Member', 'Team Captain',
   'Club/Society Founder', 'Model UN Award Winner');

UPDATE signal_dictionary SET tier_group = 'tier_1' WHERE category = 'student_leadership' AND canonical_name = 'Newspaper Editor-in-Chief';

-- ─── D. is_searchable=FALSE — extraction-only rows ─────────────────────

-- Per Matt: Resident Assistant + Teaching Assistant stay as extraction-only.
UPDATE signal_dictionary SET is_searchable = FALSE WHERE category = 'student_leadership' AND canonical_name IN
  ('Resident Assistant', 'Teaching Assistant');

-- Greek Life: all 78 specific fraternity/sorority entries are extraction-only.
-- Only the catch-all "Greek Life (generic)" stays searchable (which the UI uses
-- as the bucket fallback; the one-bucket filter pattern surfaces "Any Greek Life"
-- at the category level anyway).
UPDATE signal_dictionary SET is_searchable = FALSE WHERE category = 'greek_life'
  AND canonical_name != 'Greek Life (generic)';

-- Academic Distinction + Scholarship: granular dictionary entries stay
-- extraction-only. The UI's one-bucket "Academic Achievement" filter surfaces
-- the category-level option; individual signals like "Cum Laude" / "Phi Beta
-- Kappa" / "Morehead-Cain Scholar" don't need their own filter dropdown rows.
UPDATE signal_dictionary SET is_searchable = FALSE WHERE category IN ('academic_distinction', 'scholarship');

-- Athletics: only the 6 surviving tiered rows. All are extraction-only because
-- the UI shows a single "Athletics" filter option (one-bucket pattern).
UPDATE signal_dictionary SET is_searchable = FALSE WHERE category = 'athletics';

-- ─── Verification ──────────────────────────────────────────────────────

DO $$
DECLARE
  ac INT;
  sch INT;
  fellow INT;
  sl INT;
  athletics_count INT;
  searchable_false INT;
BEGIN
  SELECT count(*) INTO ac FROM signal_dictionary WHERE category = 'academic_distinction';
  SELECT count(*) INTO sch FROM signal_dictionary WHERE category = 'scholarship';
  SELECT count(*) INTO fellow FROM signal_dictionary WHERE category = 'fellowship';
  SELECT count(*) INTO sl FROM signal_dictionary WHERE category = 'student_leadership';
  SELECT count(*) INTO athletics_count FROM signal_dictionary WHERE category = 'athletics';
  SELECT count(*) INTO searchable_false FROM signal_dictionary WHERE is_searchable = FALSE;

  IF ac != 20 THEN RAISE EXCEPTION 'Migration 062: academic_distinction should be 20, got %', ac; END IF;
  IF sch != 34 THEN RAISE EXCEPTION 'Migration 062: scholarship should be 34 (28 - 3 drops - 1 dup + 10 moves), got %', sch; END IF;
  IF fellow != 47 THEN RAISE EXCEPTION 'Migration 062: fellowship should be 47 (63 - 10 moves to scholarship - 1 Forbes drop - 2 dup drops (Gates Cambridge, NSF GRFP) - 3 audit drops (Apple Industrial Design, IDEO, AnitaB.org)), got %. Investigate.', fellow; END IF;
  IF sl != 16 THEN RAISE EXCEPTION 'Migration 062: student_leadership should be 16 (24 - 8 drops), got %', sl; END IF;
  IF athletics_count != 6 THEN RAISE EXCEPTION 'Migration 062: athletics should be 6, got %', athletics_count; END IF;

  RAISE NOTICE 'Migration 062: cleanup complete. academic_distinction=%, scholarship=%, fellowship=%, student_leadership=%, athletics=%, is_searchable=FALSE: %', ac, sch, fellow, sl, athletics_count, searchable_false;
END $$;

COMMIT;
