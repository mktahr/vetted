# Vetted — Getting Started on New Machine

## What's in this folder

| File/Folder | What it is |
|---|---|
| `CLAUDE.md` | **Read this first every Claude Code session.** Full project context. |
| `supabase/migrations/001_vetted_normalized_schema.sql` | All new Phase 1 tables — run this in Supabase |
| `supabase/migrations/002_vetted_seed_data.sql` | Dictionary seed data — run this after 001 |
| `app/api/ingest/route.ts` | Updated ingest API — replaces your existing one |
| `vetted-extension-main/` | Your existing Chrome extension (unchanged) |

---

## Step 1 — Set up your personal machine

1. Install VS Code: **code.visualstudio.com**
2. Install Node.js (LTS): **nodejs.org**
3. Install Git: **git-scm.com**
4. Open VS Code, install the **Claude Code** extension from the marketplace
5. Run `claude` in the terminal and sign in with your Anthropic account

---

## Step 2 — Clone your GitHub repo

In the VS Code terminal:
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

---

## Step 3 — Run the database migrations

1. Go to **supabase.com** → your project → SQL Editor
2. Copy and paste the contents of `001_vetted_normalized_schema.sql` → Run
3. Copy and paste the contents of `002_vetted_seed_data.sql` → Run
4. Verify tables were created in Table Editor

---

## Step 4 — Set up environment variables

Create a `.env.local` file in your project root:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
INGEST_SECRET=9f6e2b8d4c1a7e3f0a9d5b6c2e4f8a1d7c3b5e0f6a9d2c8e4b1a7d3f
```

Get these from: Supabase Dashboard → Settings → API

---

## Step 5 — Copy the new ingest API

Copy `app/api/ingest/route.ts` into your existing Next.js project at the same path, replacing the old file.

---

## Step 6 — Test everything

```bash
npm install
npm run dev
```

Then scrape one LinkedIn profile with your Chrome extension and verify:
- Profile appears in `profiles` table (existing — should still work)
- Profile appears in `people` table (new)
- Company appears in `companies` table (new)

---

## What to tell Claude Code each session

Start every Claude Code session with:
```
Read CLAUDE.md first, then let's continue building Vetted.
```

That gives Claude full context without you re-explaining everything.

---

## Current build status

- [x] CLAUDE.md master context file
- [x] Phase 1 database schema (all normalized tables)
- [x] Dictionary seed data (titles, functions, degrees)
- [x] Updated ingest API (writes to both old and new tables)
- [ ] Scoring functions (Phase 2)
- [ ] Bucket assignment logic (Phase 2)
- [ ] Search layer (Phase 3)
- [ ] UI for reviewing candidates (Phase 3)
