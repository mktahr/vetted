// GET /api/ats/jobs — server-side proxy for the ATS's job list.
//
// The browser's "Send to ATS" job picker calls this; the ATS ingest secret
// must never reach the client, so the fetch happens here. Mirrors the ATS's
// GET /api/jobs (non-closed jobs, newest first).
//
// Env: ATS_IMPORT_URL (e.g. https://vetted-ats.vercel.app) + ATS_INGEST_SECRET.

export const dynamic = 'force-dynamic'

export async function GET() {
  const base = process.env.ATS_IMPORT_URL
  const secret = process.env.ATS_INGEST_SECRET
  if (!base || !secret) {
    return Response.json(
      { error: 'ATS integration not configured (ATS_IMPORT_URL / ATS_INGEST_SECRET)' },
      { status: 500 },
    )
  }

  try {
    const resp = await fetch(`${base.replace(/\/+$/, '')}/api/jobs`, {
      headers: { 'x-ingest-secret': secret },
      cache: 'no-store',
    })
    const body = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      return Response.json(
        { error: `ATS returned ${resp.status}: ${body?.error ?? 'unknown error'}` },
        { status: 502 },
      )
    }
    return Response.json({ jobs: body.jobs ?? [] })
  } catch (err) {
    return Response.json(
      { error: `Could not reach the ATS: ${err instanceof Error ? err.message : 'unknown error'}` },
      { status: 502 },
    )
  }
}
