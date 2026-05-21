-- 060_extend_signal_dictionary_categories_universities.sql
--
-- Extend signal_dictionary.category CHECK to add 6 new categories for
-- university-affiliated and research-org signal coverage.
--
-- New categories:
--   • university_program              — selective undergrad programs (Berkeley M.E.T., Penn M&T, etc.)
--   • university_fellowship           — fellowships affiliated with a specific university
--                                       (Stanford Mayfield, Cornell Kessler, Penn ELITE Fellowship, etc.)
--   • university_incubator_accelerator — incubators/accelerators run by a university
--                                       (StartX, SkyDeck, MIT delta v, Northwestern Garage, etc.)
--   • university_lab                  — research labs at universities
--                                       (SAIL, BAIR, CSAIL, SISL, etc.)
--   • research_institute              — independent research orgs (Allen AI, Arc, Santa Fe, CSET, RAND)
--                                       Distinct from national_lab (federal R&D) and university_lab (academic)
--   • student_venture_fund            — student-run VC (Dorm Room Fund, RDV, Prospect, Harvard Ventures Alpha)
--
-- Total: 25 existing + 6 net-new = 31 categories.
--
-- IMPORTANT — category boundary clarifications enforced post-migration:
--   • national_lab        → federally funded R&D centers ONLY
--                           (Lincoln Lab, JPL, Sandia, Los Alamos, MITRE, JHU APL, SLAC, LBNL, AFRL, NREL, NRL)
--   • fellowship          → non-university-affiliated only
--                           (Thiel, Hertz, KP Fellows, Schmidt Futures, OpenAI Residency, etc.)
--   • incubator           → independent only (YC, Techstars, HAX, Antler, AI Grant, etc.)
--
-- These restrictions are enforced via the data reseed (via sync-reference.mjs)
-- after this migration lands. The CHECK constraint itself is permissive on
-- which entries go where — it just opens the door for the new category values.

BEGIN;

ALTER TABLE signal_dictionary DROP CONSTRAINT IF EXISTS signal_dictionary_category_check;

ALTER TABLE signal_dictionary
  ADD CONSTRAINT signal_dictionary_category_check
  CHECK (category IN (
    -- existing 25
    'fellowship', 'scholarship', 'hackathon', 'greek_life', 'athletics',
    'engineering_team', 'student_leadership', 'academic_distinction',
    'founder', 'open_source', 'publication', 'patent', 'speaking',
    'writing', 'military', 'hospitality', 'teaching', 'career_changer',
    'self_taught', 'language', 'competition',
    'olympiad', 'national_lab', 'incubator', 'other',
    -- 6 net-new (this migration)
    'university_program', 'university_fellowship', 'university_incubator_accelerator',
    'university_lab', 'research_institute', 'student_venture_fund'
  ));

DO $$
DECLARE
  cat_count INT;
BEGIN
  SELECT count(DISTINCT category) INTO cat_count FROM signal_dictionary;
  RAISE NOTICE 'Migration 060: CHECK constraint extended to 31 categories. % distinct categories present in signal_dictionary today (data reseed will populate the 6 new ones).', cat_count;
END $$;

COMMIT;
