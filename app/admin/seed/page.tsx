'use client'

import { useState } from 'react'

// ─── Test payloads matching IngestPayload exactly ─────────────────────────

const JUNIOR_PAYLOAD = {
  linkedin_url: 'https://www.linkedin.com/in/priya-nair-seed',
  full_name: 'Priya Nair',
  canonical_json: {
    full_name: 'Priya Nair',
    location_resolved: 'San Francisco, CA',
    current_company: 'Figma',
    current_title: 'Frontend Engineer',
    years_experience: 1.5,
    years_at_current_company: 1,
    undergrad_university: 'University of California, San Diego',
    secondary_university: null,
    phd_university: null,
    skills_tags: ['React', 'TypeScript', 'CSS', 'Figma API', 'GraphQL'],
    experiences: [
      {
        company_name: 'Figma',
        title: 'Frontend Engineer',
        start_date: 'Jan 2025',
        end_date: null,
        is_current: true,
        duration_months: 15,
        description: 'Building design system components and collaboration features on the Figma editor team.',
        employment_type: 'Full-time',
      },
      {
        company_name: 'Figma',
        title: 'Software Engineering Intern',
        start_date: 'Jun 2024',
        end_date: 'Sep 2024',
        is_current: false,
        duration_months: 3,
        description: 'Shipped a new plugin permissions system used by 10K+ plugins.',
        employment_type: 'Internship',
      },
      {
        company_name: 'Autodesk',
        title: 'Software Engineering Intern',
        start_date: 'Jun 2023',
        end_date: 'Sep 2023',
        is_current: false,
        duration_months: 3,
        description: 'Built real-time collaboration features for AutoCAD web.',
        employment_type: 'Internship',
      },
    ],
    education: [
      {
        school_name: 'University of California, San Diego',
        degree: 'Bachelor of Science',
        field_of_study: 'Computer Science',
        start_year: 2021,
        end_year: 2024,
      },
    ],
  },
  raw_json: {},
}

const MID_PAYLOAD = {
  linkedin_url: 'https://www.linkedin.com/in/marcus-webb-seed',
  full_name: 'Marcus Webb',
  canonical_json: {
    full_name: 'Marcus Webb',
    location_resolved: 'San Francisco, CA',
    current_company: 'Stripe',
    current_title: 'Senior Product Manager',
    years_experience: 6,
    years_at_current_company: 2,
    undergrad_university: 'Cornell University',
    secondary_university: 'The Wharton School',
    phd_university: null,
    skills_tags: ['Product Strategy', 'SQL', 'A/B Testing', 'Payments', 'Cross-functional Leadership'],
    experiences: [
      {
        company_name: 'Stripe',
        title: 'Senior Product Manager',
        start_date: 'Mar 2024',
        end_date: null,
        is_current: true,
        duration_months: 24,
        description: 'Leading the Billing & Invoicing product line. Shipped usage-based billing that drove $40M ARR in first year.',
        employment_type: 'Full-time',
      },
      {
        company_name: 'Airbnb',
        title: 'Product Manager',
        start_date: 'Aug 2022',
        end_date: 'Feb 2024',
        is_current: false,
        duration_months: 18,
        description: 'Owned the guest payments experience across 30+ countries. Launched local payment methods in 5 new markets.',
        employment_type: 'Full-time',
      },
      {
        company_name: 'McKinsey & Company',
        title: 'Associate',
        start_date: 'Jul 2020',
        end_date: 'Jul 2022',
        is_current: false,
        duration_months: 24,
        description: 'Technology practice — advised F500 clients on digital transformation, pricing strategy, and product-led growth.',
        employment_type: 'Full-time',
      },
      {
        company_name: 'Goldman Sachs',
        title: 'Summer Analyst',
        start_date: 'Jun 2017',
        end_date: 'Aug 2017',
        is_current: false,
        duration_months: 3,
        description: 'Investment Banking Division — TMT coverage group.',
        employment_type: 'Internship',
      },
    ],
    education: [
      {
        school_name: 'The Wharton School',
        degree: 'Master of Business Administration',
        field_of_study: 'Finance and Entrepreneurship',
        start_year: 2018,
        end_year: 2020,
      },
      {
        school_name: 'Cornell University',
        degree: 'Bachelor of Arts',
        field_of_study: 'Economics',
        start_year: 2014,
        end_year: 2018,
      },
    ],
  },
  raw_json: {},
}

const SENIOR_PAYLOAD = {
  linkedin_url: 'https://www.linkedin.com/in/jennifer-tran-seed',
  full_name: 'Jennifer Tran',
  canonical_json: {
    full_name: 'Jennifer Tran',
    location_resolved: 'Seattle, WA',
    current_company: 'Amazon',
    current_title: 'VP of Engineering',
    years_experience: 14,
    years_at_current_company: 3,
    undergrad_university: 'Massachusetts Institute of Technology',
    secondary_university: null,
    phd_university: 'Stanford University',
    skills_tags: ['Distributed Systems', 'Machine Learning', 'Engineering Leadership', 'System Design', 'AWS'],
    experiences: [
      {
        company_name: 'Amazon',
        title: 'VP of Engineering',
        start_date: 'Jan 2023',
        end_date: null,
        is_current: true,
        duration_months: 36,
        description: 'Leading a 400-person engineering org across AWS AI/ML services. Launched Bedrock fine-tuning and drove 3x YoY growth in enterprise adoption.',
        employment_type: 'Full-time',
      },
      {
        company_name: 'Amazon',
        title: 'Senior Director of Engineering',
        start_date: 'Mar 2021',
        end_date: 'Dec 2022',
        is_current: false,
        duration_months: 22,
        description: 'Built and scaled the SageMaker inference platform team from 30 to 120 engineers.',
        employment_type: 'Full-time',
      },
      {
        company_name: 'Google',
        title: 'Director of Engineering',
        start_date: 'Jan 2017',
        end_date: 'Feb 2021',
        is_current: false,
        duration_months: 50,
        description: 'Led the TensorFlow serving and ML infrastructure team. Shipped TF Serving 2.0 used by 50K+ production deployments.',
        employment_type: 'Full-time',
      },
      {
        company_name: 'Google',
        title: 'Senior Software Engineer',
        start_date: 'Aug 2014',
        end_date: 'Dec 2016',
        is_current: false,
        duration_months: 29,
        description: 'Core contributor to MapReduce successor (Flume/Dataflow). Designed the autoscaling pipeline scheduler.',
        employment_type: 'Full-time',
      },
      {
        company_name: 'Microsoft Research',
        title: 'Research Intern',
        start_date: 'Jun 2013',
        end_date: 'Sep 2013',
        is_current: false,
        duration_months: 3,
        description: 'Developed novel graph partitioning algorithms for distributed machine learning training.',
        employment_type: 'Internship',
      },
    ],
    education: [
      {
        school_name: 'Stanford University',
        degree: 'Doctor of Philosophy',
        field_of_study: 'Computer Science — Distributed Systems',
        start_year: 2010,
        end_year: 2014,
      },
      {
        school_name: 'Massachusetts Institute of Technology',
        degree: 'Bachelor of Science',
        field_of_study: 'Electrical Engineering and Computer Science',
        start_year: 2006,
        end_year: 2010,
      },
    ],
  },
  raw_json: {},
}

const PROFILES = [
  { label: 'Send Junior Profile (Priya Nair)', payload: JUNIOR_PAYLOAD, color: 'bg-green-600 hover:bg-green-700' },
  { label: 'Send Mid Profile (Marcus Webb)', payload: MID_PAYLOAD, color: 'bg-primary hover:bg-accent-strong' },
  { label: 'Send Senior Profile (Jennifer Tran)', payload: SENIOR_PAYLOAD, color: 'bg-purple-600 hover:bg-purple-700' },
]

// ─── Page ─────────────────────────────────────────────────────────────────

export default function SeedPage() {
  const [results, setResults] = useState<Array<{ label: string; status: number; body: string; ts: string }>>([])
  const [sending, setSending] = useState<string | null>(null)

  async function send(label: string, payload: Record<string, unknown>) {
    setSending(label)
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ingest-secret': '9f6e2b8d4c1a7e3f0a9d5b6c2e4f8a1d7c3b5e0f6a9d2c8e4b1a7d3f',
        },
        body: JSON.stringify(payload),
      })
      const body = await res.text()
      setResults(prev => [{ label, status: res.status, body, ts: new Date().toLocaleTimeString() }, ...prev])
    } catch (err: any) {
      setResults(prev => [{ label, status: 0, body: `Network error: ${err.message}`, ts: new Date().toLocaleTimeString() }, ...prev])
    } finally {
      setSending(null)
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 700, margin: '0 auto', background: 'var(--bg-canvas)', color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>
      <h1 className="text-2xl font-bold mb-2">Seed Test Profiles</h1>
      <p className="text-tertiary text-sm mb-6">
        Each button sends a realistic test payload to /api/ingest. Check the people table after sending.
      </p>

      <div className="flex flex-col gap-3 mb-8">
        {PROFILES.map(({ label, payload, color }) => (
          <button
            key={label}
            onClick={() => send(label, payload)}
            disabled={sending !== null}
            className={`px-4 py-3 text-white rounded-lg font-medium ${color} disabled:opacity-50`}
          >
            {sending === label ? 'Sending...' : label}
          </button>
        ))}
      </div>

      {results.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Responses</h2>
          <div className="space-y-3">
            {results.map((r, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border text-sm ${
                  r.status === 200 ? 'bg-green-50 border-green-200' : 'bg-destructive/10 border-destructive/30'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium">{r.label}</span>
                  <span className="text-xs text-tertiary">{r.ts}</span>
                </div>
                <div className="text-xs">
                  <span className={r.status === 200 ? 'text-green-700' : 'text-destructive'}>
                    HTTP {r.status}
                  </span>
                </div>
                <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap overflow-x-auto">{r.body}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
