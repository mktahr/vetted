-- 032_tag_spend_log.sql
--
-- Daily Anthropic spend log for the company auto-tagging cron.
-- One row per UTC day; the cron and ad-hoc tag routes increment the row
-- after each tagCompany() call to enforce a daily cap (MAX_DAILY_ANTHROPIC_CENTS).
--
-- Cap rationale: Haiku 4.5 ~2k input tokens + ~600 output tokens per
-- tagCompany() call ≈ $0.005. EST_CENTS_PER_TAG=1 (round up). At
-- MAX_DAILY_ANTHROPIC_CENTS=1000 ($10/day) the cron processes up to
-- ~1000 companies/day before throttling. Adjust if real spend differs.

BEGIN;

CREATE TABLE IF NOT EXISTS companies_tag_spend_log (
  log_date                  DATE        PRIMARY KEY,
  total_companies_tagged    INTEGER     NOT NULL DEFAULT 0,
  estimated_anthropic_cents INTEGER     NOT NULL DEFAULT 0,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE companies_tag_spend_log IS
  'Per-day rollup of Claude tagger spend. Enforces a daily cap on the auto-tagging cron + on-demand /tag routes.';

COMMENT ON COLUMN companies_tag_spend_log.log_date IS
  'UTC calendar day. Cron runs against current_date.';
COMMENT ON COLUMN companies_tag_spend_log.estimated_anthropic_cents IS
  'Sum of EST_CENTS_PER_TAG across the day. Compared against MAX_DAILY_ANTHROPIC_CENTS to gate further runs.';

COMMIT;
