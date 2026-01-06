# Vetted - Recruiting Database

A Next.js web application for managing and searching recruiting profiles stored in Supabase.

## Features

- **Searchable Table**: Search profiles by name, company, title, or location
- **Tag Filters**: Filter by skills, focus areas, excellence tags, and domain tags
- **Sorting**: Sort by years of experience or years at current company
- **Profile Details**: Click any row to view details in a drawer
- **Full Profile Page**: Click a name to view the complete profile
- **Ingest API**: POST endpoint for ingesting profile data

## Setup Instructions

### 1. Environment Variables

#### Local Development (.env.local)

Create a `.env.local` file in the root directory with:

```env
NEXT_PUBLIC_SUPABASE_URL=https://nevppokoxkpcpuerzdlj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_jwt_key_here
```

#### Vercel Deployment

Add these environment variables in your Vercel project settings:

- `NEXT_PUBLIC_SUPABASE_URL` = `https://nevppokoxkpcpuerzdlj.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `your_anon_jwt_key_here`

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production

```bash
npm run build
npm start
```

## API Endpoint

### POST /api/ingest

Accepts JSON payload:
```json
{
  "linkedin_url": "https://linkedin.com/in/...",
  "raw_json": {...},
  "canonical_json": {...}
}
```

Forwards the request to the Supabase Edge Function at `/functions/v1/ingest`.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Supabase (client-side)
- Tailwind CSS

