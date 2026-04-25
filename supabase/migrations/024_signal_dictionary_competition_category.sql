-- Migration 024: Add 'competition' to the signal_dictionary category CHECK constraint

ALTER TABLE signal_dictionary
  DROP CONSTRAINT IF EXISTS signal_dictionary_category_check;

ALTER TABLE signal_dictionary
  ADD CONSTRAINT signal_dictionary_category_check
  CHECK (category IN (
    'fellowship', 'scholarship', 'hackathon', 'greek_life', 'athletics',
    'engineering_team', 'student_leadership', 'academic_distinction',
    'founder', 'open_source', 'publication', 'patent', 'speaking',
    'writing', 'military', 'hospitality', 'teaching', 'career_changer',
    'self_taught', 'language', 'competition', 'other'
  ));
