-- Migration 014 — Track seniority inference source
ALTER TABLE person_experiences
  ADD COLUMN IF NOT EXISTS seniority_source TEXT DEFAULT 'title'
    CHECK (seniority_source IS NULL OR seniority_source IN ('title', 'description', 'internship_override', 'pre_graduation_override', 'fallback'));

COMMENT ON COLUMN person_experiences.seniority_source IS
  'Where seniority_normalized was resolved from: title (dictionary match), description (keyword scan), internship_override, pre_graduation_override, or fallback (no match → IC).';
