'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CompanyBucket, CompanyStatus } from '@/app/types'

const BUCKET_OPTIONS: Array<{ value: CompanyBucket; label: string }> = [
  { value: 'static_mature',    label: 'Static Mature' },
  { value: 'high_bar_tech',    label: 'High Bar Tech' },
  { value: 'growth_startup',   label: 'Growth Startup' },
  { value: 'emerging_startup', label: 'Emerging Startup' },
]

const STATUS_OPTIONS: Array<{ value: CompanyStatus; label: string }> = [
  { value: 'active',    label: 'Active' },
  { value: 'acquired',  label: 'Acquired' },
  { value: 'public',    label: 'Public' },
  { value: 'shut_down', label: 'Shut Down' },
]

export default function NewCompanyPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    company_name: '',
    primary_industry_tag: '',
    founding_year: '' as string,
    current_status: 'active' as CompanyStatus,
    company_bucket: '' as CompanyBucket | '',
  })

  async function handleCreate() {
    if (!form.company_name.trim()) {
      setError('Company name is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const insert = {
        company_name: form.company_name.trim(),
        primary_industry_tag: form.primary_industry_tag.trim() || null,
        founding_year: form.founding_year ? parseInt(form.founding_year, 10) : null,
        current_status: form.current_status,
        company_bucket: (form.company_bucket as CompanyBucket) || null,
        company_score_mode: 'manual' as const,
        manual_review_status: 'unreviewed' as const,
      }
      const { data, error } = await supabase
        .from('companies')
        .insert(insert)
        .select('company_id')
        .single()

      if (error) throw error
      router.push(`/admin/companies/${data.company_id}`)
    } catch (err: any) {
      setError(err?.message || 'Failed to create company')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto', background: 'var(--bg-canvas)', color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>
      <button
        onClick={() => router.push('/admin/companies')}
        className="mb-6 text-primary hover:text-accent-strong"
      >
        ← Back to companies
      </button>

      <div className="bg-card rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6">Add Company</h1>

        {error && (
          <div className="mb-4 bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Anthropic"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Industry Tag</label>
            <input
              type="text"
              value={form.primary_industry_tag}
              onChange={(e) => setForm({ ...form, primary_industry_tag: e.target.value })}
              placeholder="e.g. AI, FinTech, SaaS"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Founding Year</label>
            <input
              type="number"
              min="1800"
              max="2100"
              value={form.founding_year}
              onChange={(e) => setForm({ ...form, founding_year: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
            <select
              value={form.current_status}
              onChange={(e) => setForm({ ...form, current_status: e.target.value as CompanyStatus })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Company Bucket</label>
            <select
              value={form.company_bucket}
              onChange={(e) => setForm({ ...form, company_bucket: e.target.value as CompanyBucket })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">— none —</option>
              {BUCKET_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
        </div>

        <p className="text-xs text-tertiary mb-4">
          After creating the company, you can add year scores on the edit page.
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleCreate}
            disabled={submitting || !form.company_name.trim()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-strong disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Company'}
          </button>
          <button
            onClick={() => router.push('/admin/companies')}
            className="px-4 py-2 text-muted-foreground border border-border rounded-lg hover:bg-background"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
