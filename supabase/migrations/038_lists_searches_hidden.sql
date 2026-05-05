-- 038_lists_searches_hidden.sql
--
-- User-owned bookmarks and saved state. Three tables:
--   - lists           : named bookmark collections (kind: candidate | company)
--   - list_items      : polymorphic membership (item_id is a candidate or
--                       company UUID, parented by lists.kind)
--   - saved_searches  : re-runnable filter state per kind
--   - hidden_items    : per-user hidden candidates/companies (so they don't
--                       reappear in default search results)
--
-- All four tables use a string owner_id (defaulting to 'admin' until we
-- add real auth). Schema designed to support multi-user later — owner_id
-- is part of every UNIQUE constraint and index that needs scoping.
--
-- RLS disabled to match the rest of the admin tables. Will be re-enabled
-- with explicit per-owner policies when the recruiter-facing app ships.

BEGIN;

-- ─── Lists (named bookmark collections) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS lists (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    TEXT         NOT NULL DEFAULT 'admin',
  kind        TEXT         NOT NULL CHECK (kind IN ('candidate', 'company')),
  name        TEXT         NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, kind, name)
);

COMMENT ON TABLE lists IS
  'User-curated bookmark collections. kind=candidate references people.person_id; kind=company references companies.company_id. Membership in list_items.';

-- ─── List items (polymorphic membership) ────────────────────────────────

CREATE TABLE IF NOT EXISTS list_items (
  list_id    UUID         NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  item_id    UUID         NOT NULL,
  added_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  notes      TEXT,
  PRIMARY KEY (list_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_list_items_item ON list_items (item_id);

COMMENT ON TABLE list_items IS
  'Membership of an item in a list. item_id refers to people.person_id or companies.company_id depending on the parent list.kind. Cascade delete with the parent list.';

-- ─── Saved searches ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_searches (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      TEXT         NOT NULL DEFAULT 'admin',
  kind          TEXT         NOT NULL CHECK (kind IN ('candidate', 'company')),
  name          TEXT         NOT NULL,
  filter_state  JSONB        NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, kind, name)
);

COMMENT ON TABLE saved_searches IS
  'Re-runnable filter state. filter_state is the URL-encodable filter object the search page reads on load. Re-runs against current data so results auto-update as new rows land.';

-- ─── Hidden items (per-user "do not show me this again") ────────────────

CREATE TABLE IF NOT EXISTS hidden_items (
  owner_id    TEXT         NOT NULL DEFAULT 'admin',
  item_kind   TEXT         NOT NULL CHECK (item_kind IN ('candidate', 'company')),
  item_id     UUID         NOT NULL,
  hidden_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  reason      TEXT,
  PRIMARY KEY (owner_id, item_kind, item_id)
);

CREATE INDEX IF NOT EXISTS idx_hidden_items_owner_kind ON hidden_items (owner_id, item_kind);

COMMENT ON TABLE hidden_items IS
  'Per-user hidden candidates / companies. Hidden rows are filtered out of default search by the UI; "Show hidden" toggle exposes them. Default user is "admin" until real auth ships.';

-- ─── RLS off (admin tables, browser-readable via anon key) ───────────────

ALTER TABLE lists           DISABLE ROW LEVEL SECURITY;
ALTER TABLE list_items      DISABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches  DISABLE ROW LEVEL SECURITY;
ALTER TABLE hidden_items    DISABLE ROW LEVEL SECURITY;

COMMIT;
