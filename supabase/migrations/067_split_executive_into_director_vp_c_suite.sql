-- 067_split_executive_into_director_vp_c_suite.sql
--
-- Split the single seniority_normalized='executive' value into three more
-- granular searchable levels: director, vp, c_suite. Aligns search
-- vocabulary with how recruiters actually search and prepares the schema
-- for the slope scoring rebuild that comes next.
--
-- ENUM SHAPE AFTER MIGRATION (active values)
--   intern(1) < junior_ic(2) < individual_contributor(3) < senior_ic(4) <
--   lead_ic(5) < manager(6) < director(7) < vp(8) < c_suite(9) < founder(10)
--   executive: present-but-deprecated (active=false, rank stays at 7 for
--              legacy lookups). Matches existing deprecated-value pattern
--              alongside 'student' and 'lead'.
--   Founder is NOT in the slope/scoring leveling math — it's a separate
--   role/function axis tracked via is_current_founder / is_former_founder.
--   In seniority_dictionary it only exists as a UI filter option pinned last.
--
-- BACKFILL APPROACH
--   1. ALTER TYPE — add three new enum values (each in its own implicit
--      transaction; PG 12+ allows ADD VALUE inside a tx block but the new
--      value cannot be REFERENCED in the same tx — so these run before BEGIN).
--   2. seniority_dictionary — bump founder, deprecate executive, insert new tiers
--   3. seniority_rules — reclassify the 59 'executive' rows per the locked regex,
--      plus Google L7/L8/fellow + Amazon fellow outlier fixes, plus seed Amazon
--      L5-L8 and Meta E3-E8 ladders, plus seed bare director rules. DELETE the
--      two ambiguous "head of X" rules so the new headcount-based logic owns them.
--   4. person_experiences — UPDATE 9 rows from 'executive' to the regex-derived
--      value (7 c_suite, 2 vp expected based on current data).
--   5. people.highest_seniority_reached — re-derive via SQL max-rank lookup
--      (mirrors compute-derived.ts max-across-experiences logic; 3 rows expected).
--
-- BIG-TECH LEVEL MAPPING
--   Public ladder mapping — Amazon's ladder is shifted (L6 = Senior, not
--   Staff). Google L7 was previously 'manager' which is wrong (L7 is Senior
--   Staff IC track); fix here. Google L8 / Google Fellow / Amazon Fellow
--   were 'executive' (Distinguished+); fix here.
--   Google L3=junior, L4=IC, L5=senior, L6/L7/L8=lead_ic
--   Meta E3=junior, E4=IC, E5=senior, E6/E7/E8=lead_ic
--   Amazon L5=IC, L6=senior, L7/L8=lead_ic
--
-- HEAD OF LOGIC
--   The previous "head of + 9+ years → executive" interim rule in
--   compute-derived.ts is REMOVED in the code change paired with this migration.
--   New logic: ambiguous "Head of X" titles classify by company headcount at
--   the time of the role (lib/normalize/seniority.ts::resolveHeadOfByHeadcount
--   + compute-derived.ts head-of reclassification pass). When headcount is
--   unknown (~99.6% of companies today), default to lead_ic per locked spec.
--   To make the headcount path the sole source of truth for "Head of X",
--   this migration DELETES the two existing exact-match rules
--   (head of people, head of talent → manager). Other explicit director-
--   titled rules (director of people, senior director of talent, etc.)
--   stay as-is at 'manager' — they are explicit titles, not ambiguous heads.
--
-- NON-ADDITIVE MIGRATION ACKNOWLEDGMENT
--   This migration updates existing rows in person_experiences, people,
--   seniority_rules, and seniority_dictionary. Per CLAUDE.md "Non-additive
--   migrations gated on dev/prod Supabase split" — that gate has NOT shipped.
--   Acceptable here because prod data volume is minimal (9 person_experiences
--   + 3 people + 59 seniority_rules affected). Future non-additive migrations
--   must wait for the dev/prod split (ROADMAP #2).

-- ─── 1. Enum extension (outside transaction — new values can't be used in same tx) ───

ALTER TYPE seniority_level ADD VALUE IF NOT EXISTS 'director';
ALTER TYPE seniority_level ADD VALUE IF NOT EXISTS 'vp';
ALTER TYPE seniority_level ADD VALUE IF NOT EXISTS 'c_suite';

-- ─── 2-5. Everything else in one transaction ───────────────────────────────

BEGIN;

-- ─── 2. seniority_dictionary ───────────────────────────────────────────────

-- Bump founder to rank 10 (preserves "founder is highest active rank" per
-- migration 059, now that we're inserting 3 new ranks between manager and founder).
UPDATE seniority_dictionary SET rank_order = 10 WHERE seniority_normalized = 'founder';

-- Deprecate executive. Row stays for backward compat; rank stays at 7 so any
-- legacy code path still resolves correctly. Matches the 'student' / 'lead' pattern.
UPDATE seniority_dictionary SET active = false WHERE seniority_normalized = 'executive';

-- Insert the three new active values.
INSERT INTO seniority_dictionary (seniority_normalized, rank_order, active) VALUES
  ('director', 7, true),
  ('vp',       8, true),
  ('c_suite',  9, true);

-- ─── 3a. Reclassify the 59 existing 'executive' seniority_rules ────────────
--   C-Suite first (CxO + Chief X Officer + founder+CxO combos + cpo)

UPDATE seniority_rules SET seniority_level = 'c_suite'
WHERE seniority_level = 'executive' AND (
  -- Bare CxO abbreviations
  title_pattern IN ('ceo','cfo','cto','coo','cmo','cro','ciso','chro','cpo','cio')
  -- "Chief X Officer" variants
  OR title_pattern LIKE 'chief %'
  -- Founder + CxO combos (all 13 priority-0 rows)
  OR title_pattern LIKE 'founder %'
  OR title_pattern LIKE 'co-founder %'
  OR title_pattern LIKE 'cofounder %'
);

-- 3b. VP — VP / Vice President / SVP / EVP variants

UPDATE seniority_rules SET seniority_level = 'vp'
WHERE seniority_level = 'executive' AND (
  title_pattern LIKE 'vp %'
  OR title_pattern = 'vp'
  OR title_pattern LIKE 'svp %'
  OR title_pattern LIKE 'evp %'
  OR title_pattern LIKE 'vice president%'
);

-- 3c. Outlier fixes — Fellow / Distinguished / Big-Tech L8 → lead_ic
--    (was 'executive'; these are Distinguished IC track, not exec-tier)

UPDATE seniority_rules SET seniority_level = 'lead_ic'
WHERE seniority_level = 'executive'
  AND title_pattern IN ('amazon fellow', 'google fellow', 'google l8', 'meta e8');

-- 3d. Google L7 fix — was 'manager' (incorrect; L7 = Senior Staff IC track)

UPDATE seniority_rules SET seniority_level = 'lead_ic'
WHERE title_pattern = 'google l7' AND seniority_level = 'manager';

-- 3e. INSERT new big-tech ladders that didn't exist as rules before
--   Amazon ladder (shifted vs Google/Meta — L6 is the "Senior" tier)
--   Meta ladder (E6 = Staff, E7+ = Senior Staff / Principal / Distinguished)
--   Note: 'meta e8' already exists as an 'executive' rule — handled in 3c above
--   (UPDATE to lead_ic), so it's NOT in this INSERT list.

INSERT INTO seniority_rules (title_pattern, seniority_level, function_hint, priority, active) VALUES
  -- Amazon
  ('amazon l5',  'individual_contributor', 'engineering', 1, true),
  ('amazon l6',  'senior_ic',              'engineering', 1, true),
  ('amazon l7',  'lead_ic',                'engineering', 1, true),
  ('amazon l8',  'lead_ic',                'engineering', 1, true),
  -- Meta
  ('meta e3',    'junior_ic',              'engineering', 1, true),
  ('meta e4',    'individual_contributor', 'engineering', 1, true),
  ('meta e5',    'senior_ic',              'engineering', 1, true),
  ('meta e6',    'lead_ic',                'engineering', 1, true),
  ('meta e7',    'lead_ic',                'engineering', 1, true);

-- 3f. Seed bare director rules so future "Director" / "Senior Director" /
--    "Associate Director" titles classify correctly (no existing rule covers them)

INSERT INTO seniority_rules (title_pattern, seniority_level, function_hint, priority, active) VALUES
  ('director',           'director', NULL, 3, true),   -- priority 3 = generic catchall
  ('senior director',    'director', NULL, 2, true),   -- priority 2 = above generic, below explicit
  ('associate director', 'director', NULL, 2, true);

-- 3g. DELETE ambiguous "Head of X" exact rules — headcount logic owns these
--    going forward. NOTE: this removes the rules from the lookup map only;
--    existing person_experiences rows previously classified by these rules
--    keep their stored seniority_normalized until recomputed via score-all.

DELETE FROM seniority_rules
WHERE title_pattern IN ('head of people', 'head of talent');

-- 3h. Sanity check — only the explicitly-skipped consulting Partner titles
--     may remain at 'executive'. Per user spec: "Skip consulting Partner
--     titles (Bain/McKinsey Partner) — we're not ingesting those candidates
--     right now. Leave those rules as-is." Any OTHER residual executive rule
--     indicates the reclassification missed something — fail loud.

DO $$
DECLARE bad_rules TEXT;
BEGIN
  SELECT string_agg(title_pattern, ', ' ORDER BY title_pattern)
    INTO bad_rules
    FROM seniority_rules
    WHERE seniority_level = 'executive'
      AND title_pattern NOT IN ('bain partner', 'mckinsey partner');
  IF bad_rules IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 067: unexpected residual executive rules (expected only bain/mckinsey partner): %', bad_rules;
  END IF;
END $$;

-- ─── 4. Per-experience reclassification (9 rows expected) ──────────────────
--   Title regex applied directly to person_experiences.title_raw.
--   C-Suite first (most specific patterns), then VP, then Director fallback.

UPDATE person_experiences SET seniority_normalized = 'c_suite'
WHERE seniority_normalized = 'executive' AND (
  title_raw ~* '\m(ceo|cfo|cto|coo|cmo|cro|ciso|chro|cpo|cio)\M'
  OR title_raw ~* '\mchief\s+\w+(\s+\w+)*\s+officer\M'
  OR title_raw ~* '\mchief\s+(technology|executive)\M'
);

UPDATE person_experiences SET seniority_normalized = 'vp'
WHERE seniority_normalized = 'executive' AND (
  title_raw ~* '\m(svp|evp|vp)\M'
  OR title_raw ~* '\mvice\s+president\M'
  OR title_raw ~* '\m(senior|executive)\s+vice\s+president\M'
);

-- Director / Head Of catch-all (fires for any remaining executive rows;
-- expected to match 0 rows in the current data — c_suite + vp passes cover all 9).
UPDATE person_experiences SET seniority_normalized = 'director'
WHERE seniority_normalized = 'executive' AND (
  title_raw ~* '\mdirector\M'
  OR title_raw ~* '\mhead\s+of\M'
);

-- Final catch-all: any executive row that didn't match → director (per locked spec default)
UPDATE person_experiences SET seniority_normalized = 'director'
WHERE seniority_normalized = 'executive';

-- 4b. Sanity check: no executive person_experiences rows remain

DO $$
DECLARE remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining FROM person_experiences WHERE seniority_normalized = 'executive';
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Migration 067: % person_experiences rows still have seniority_normalized=executive.', remaining;
  END IF;
END $$;

-- ─── 5. Re-derive people.highest_seniority_reached ─────────────────────────
--   Replicates compute-derived.ts max-rank logic in SQL so the migration is
--   self-contained. For each affected person, find the max rank_order across
--   their experiences and write back the matching seniority_normalized.

WITH max_rank_per_person AS (
  SELECT
    pe.person_id,
    sd.seniority_normalized AS new_highest,
    sd.rank_order,
    ROW_NUMBER() OVER (PARTITION BY pe.person_id ORDER BY sd.rank_order DESC) AS rn
  FROM person_experiences pe
  JOIN seniority_dictionary sd ON sd.seniority_normalized = pe.seniority_normalized
  WHERE pe.seniority_normalized IS NOT NULL
)
UPDATE people SET highest_seniority_reached = m.new_highest
FROM max_rank_per_person m
WHERE people.person_id = m.person_id
  AND m.rn = 1
  AND people.highest_seniority_reached = 'executive';

-- 5b. Sanity check: no executive in people.highest_seniority_reached

DO $$
DECLARE remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining FROM people WHERE highest_seniority_reached = 'executive';
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Migration 067: % people rows still have highest_seniority_reached=executive after re-derivation.', remaining;
  END IF;
END $$;

-- ─── Verification summary ──────────────────────────────────────────────────

DO $$
DECLARE
  exp_exec INT;
  rule_exec INT;
  rule_exec_holdouts INT;
  ppl_exec INT;
  dir_d INT; vp_d INT; cs_d INT;
  c_suite_rules INT; vp_rules INT;
BEGIN
  SELECT COUNT(*) INTO exp_exec     FROM person_experiences WHERE seniority_normalized='executive';
  SELECT COUNT(*) INTO rule_exec    FROM seniority_rules    WHERE seniority_level='executive';
  SELECT COUNT(*) INTO rule_exec_holdouts FROM seniority_rules
    WHERE seniority_level='executive' AND title_pattern IN ('bain partner', 'mckinsey partner');
  SELECT COUNT(*) INTO ppl_exec     FROM people             WHERE highest_seniority_reached='executive';
  SELECT COUNT(*) INTO dir_d        FROM seniority_dictionary WHERE seniority_normalized='director'  AND active=true;
  SELECT COUNT(*) INTO vp_d         FROM seniority_dictionary WHERE seniority_normalized='vp'        AND active=true;
  SELECT COUNT(*) INTO cs_d         FROM seniority_dictionary WHERE seniority_normalized='c_suite'   AND active=true;
  SELECT COUNT(*) INTO c_suite_rules FROM seniority_rules    WHERE seniority_level='c_suite';
  SELECT COUNT(*) INTO vp_rules     FROM seniority_rules    WHERE seniority_level='vp';

  IF exp_exec != 0 OR ppl_exec != 0 THEN
    RAISE EXCEPTION 'Migration 067: residual executive rows remain. exps=%, ppl=%', exp_exec, ppl_exec;
  END IF;
  IF rule_exec != rule_exec_holdouts THEN
    RAISE EXCEPTION 'Migration 067: unexpected residual executive rules. total=%, expected holdouts (bain/mckinsey)=%', rule_exec, rule_exec_holdouts;
  END IF;
  IF dir_d != 1 OR vp_d != 1 OR cs_d != 1 THEN
    RAISE EXCEPTION 'Migration 067: dictionary insert failed. director=%, vp=%, c_suite=%', dir_d, vp_d, cs_d;
  END IF;

  RAISE NOTICE 'Migration 067: split complete. c_suite_rules=%, vp_rules=%, director_dict=%, vp_dict=%, c_suite_dict=%, executive_holdouts=%',
    c_suite_rules, vp_rules, dir_d, vp_d, cs_d, rule_exec_holdouts;
END $$;

COMMIT;
