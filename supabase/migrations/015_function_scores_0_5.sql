-- Migration 015 — Update company_function_scores scale from 0-3 to 0-5
-- Aligns with company_year_scores (also 0-5) for consistency.

ALTER TABLE company_function_scores DROP CONSTRAINT IF EXISTS company_function_scores_function_score_check;
ALTER TABLE company_function_scores ADD CONSTRAINT company_function_scores_function_score_check
  CHECK (function_score BETWEEN 0 AND 5);

COMMENT ON COLUMN company_function_scores.function_score IS
  'Function-specific company score (0-5). 0=not meaningful, 1=weak, 5=elite for this function. When absent, scoring falls back to company_year_scores.';
