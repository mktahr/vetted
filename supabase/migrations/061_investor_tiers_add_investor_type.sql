-- 061_investor_tiers_add_investor_type.sql
--
-- Extend investor_tiers with an `investor_type` column so VC firms and
-- individual angels can coexist in the same table.
--
-- Existing rows are all VC firms (Sequoia, a16z, Founders Fund, etc.) and
-- default to investor_type='vc_firm' on this migration. Angel rows (Naval,
-- Elad Gil, Lachy Groom, Alana Goyal, Balaji Srinivasan, Mike Vernal, Sahil
-- Lavingia, Sriram Krishnan, Charlie Cheever, Jack Altman, Daniel Gross,
-- Nat Friedman) get loaded via the sync-reference script from
-- /reference/investors/investor_tiers.csv after this migration lands.
--
-- Note on overlap: Daniel Gross and Nat Friedman run AI Grant (incubator
-- category in signal_dictionary). They appear here as angels — these are
-- separate signals. A candidate backed by them personally is an angel-signal;
-- a candidate who went through AI Grant cohort is an incubator-signal.

BEGIN;

ALTER TABLE investor_tiers
  ADD COLUMN investor_type TEXT NOT NULL DEFAULT 'vc_firm'
  CHECK (investor_type IN ('vc_firm', 'angel'));

COMMENT ON COLUMN investor_tiers.investor_type IS
  'Distinguishes VC firms from individual angels. Angels and firms coexist in the same table; type tags govern UI surfacing (e.g., "Notable Angels" callout vs "Notable Investors" for funds).';

DO $$
DECLARE
  total_rows INT;
BEGIN
  SELECT count(*) INTO total_rows FROM investor_tiers;
  RAISE NOTICE 'Migration 061: investor_type column added with default vc_firm. % existing rows default to vc_firm; angel rows load via sync-reference script.', total_rows;
END $$;

COMMIT;
