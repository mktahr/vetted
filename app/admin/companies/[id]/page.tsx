'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Company, CompanyBucket, CompanyStatus, CompanyYearScore } from '@/app/types'

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

export default function CompanyEditPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.id as string

  const [company, setCompany] = useState<Company | null>(null)
  const [yearScores, setYearScores] = useState<CompanyYearScore[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Edit form state (mirrors company; separate so we can have a Save button)
  const [form, setForm] = useState({
    company_name: '',
    primary_industry_tag: '',
    founding_year: '' as string,
    current_status: 'active' as CompanyStatus,
    company_bucket: '' as CompanyBucket | '',
  })

  // New year score input
  const [newYear, setNewYear] = useState<string>(String(new Date().getFullYear()))
  const [newScore, setNewScore] = useState<string>('3')

  useEffect(() => {
    async function fetchAll() {
      try {
        const { data: c, error: cErr } = await supabase
          .from('companies')
          .select('*')
          .eq('company_id', companyId)
          .single()
        if (cErr) throw cErr
        setCompany(c)
        setForm({
          company_name: c.company_name || '',
          primary_industry_tag: c.primary_industry_tag || '',
          founding_year: c.founding_year != null ? String(c.founding_year) : '',
          current_status: c.current_status,
          company_bucket: c.company_bucket || '',
        })

        const { data: ys } = await supabase
          .from('company_year_scores')
          .select('company_id, year, company_score, score_notes')
          .eq('company_id', companyId)
          .order('year', { ascending: false })
        setYearScores(ys || [])
      } catch (err: any) {
        console.error('Error fetching company:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [companyId])

  async function handleSaveCompany() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const updates: Partial<Company> = {
        company_name: form.company_name.trim(),
        primary_industry_tag: form.primary_industry_tag.trim() || null,
        founding_year: form.founding_year ? parseInt(form.founding_year, 10) : null,
        current_status: form.current_status,
        company_bucket: (form.company_bucket as CompanyBucket) || null,
      }
      const { error } = await supabase
        .from('companies')
        .update(updates)
        .eq('company_id', companyId)
      if (error) throw error
      setSaveMsg({ text: 'Saved', ok: true })
      // Refresh local state
      setCompany(prev => prev ? { ...prev, ...updates } as Company : prev)
    } catch (err: any) {
      setSaveMsg({ text: `Save failed: ${err.message}`, ok: false })
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 2500)
    }
  }

  async function upsertYearScore(year: number, score: number) {
    const { error } = await supabase
      .from('company_year_scores')
      .upsert(
        { company_id: companyId, year, company_score: score },
        { onConflict: 'company_id,year' }
      )
    if (error) {
      setSaveMsg({ text: `Failed: ${error.message}`, ok: false })
      setTimeout(() => setSaveMsg(null), 3000)
      return
    }
    // Update local
    setYearScores(prev => {
      const others = prev.filter(p => p.year !== year)
      return [...others, { company_id: companyId, year, company_score: score }].sort((a, b) => b.year - a.year)
    })
    setSaveMsg({ text: `Year ${year}: score ${score} saved`, ok: true })
    setTimeout(() => setSaveMsg(null), 2000)
  }

  async function deleteYearScore(year: number) {
    if (!confirm(`Delete score for ${year}?`)) return
    const { error } = await supabase
      .from('company_year_scores')
      .delete()
      .eq('company_id', companyId)
      .eq('year', year)
    if (error) {
      setSaveMsg({ text: `Delete failed: ${error.message}`, ok: false })
      setTimeout(() => setSaveMsg(null), 3000)
      return
    }
    setYearScores(prev => prev.filter(p => p.year !== year))
  }

  async function handleAddYearScore() {
    const y = parseInt(newYear, 10)
    const s = parseInt(newScore, 10)
    if (isNaN(y) || y < 1800 || y > 2100) {
      alert('Year must be a valid year')
      return
    }
    if (isNaN(s) || s < 1 || s > 5) {
      alert('Score must be 1–5')
      return
    }
    await upsertYearScore(y, s)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading company...</div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="p-6">
        <p className="text-red-600 mb-4">Company not found.</p>
        <button onClick={() => router.push('/admin/companies')} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
          Back to list
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => router.push('/admin/companies')}
        className="mb-6 text-blue-600 hover:text-blue-800"
      >
        ← Back to companies
      </button>

      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">{company.company_name}</h1>
          {saveMsg && (
            <span className={`text-sm px-3 py-1 rounded-full ${saveMsg.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
              {saveMsg.text}
            </span>
          )}
        </div>

        {/* Company fields */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Industry Tag</label>
              <input
                type="text"
                value={form.primary_industry_tag}
                onChange={(e) => setForm({ ...form, primary_industry_tag: e.target.value })}
                placeholder="e.g. FinTech, Consumer, SaaS"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Founding Year</label>
              <input
                type="number"
                min="1800"
                max="2100"
                value={form.founding_year}
                onChange={(e) => setForm({ ...form, founding_year: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={form.current_status}
                onChange={(e) => setForm({ ...form, current_status: e.target.value as CompanyStatus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Company Bucket</label>
              <select
                value={form.company_bucket}
                onChange={(e) => setForm({ ...form, company_bucket: e.target.value as CompanyBucket })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— none —</option>
                {BUCKET_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={handleSaveCompany}
            disabled={saving}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Details'}
          </button>
        </div>

        {/* Year scores */}
        <div className="mb-8 border-t pt-6">
          <h2 className="text-lg font-semibold mb-3">Year Scores</h2>
          <p className="text-xs text-gray-500 mb-3">Scale: 1 = weak, 2 = mixed, 3 = solid, 4 = excellent, 5 = elite</p>

          {yearScores.length === 0 ? (
            <p className="text-sm text-gray-500 mb-4">No year scores yet.</p>
          ) : (
            <div className="mb-4 bg-gray-50 rounded-lg divide-y divide-gray-200">
              {yearScores.map(ys => (
                <YearScoreRow
                  key={ys.year}
                  year={ys.year}
                  score={ys.company_score}
                  onSave={(s) => upsertYearScore(ys.year, s)}
                  onDelete={() => deleteYearScore(ys.year)}
                />
              ))}
            </div>
          )}

          {/* Add new year score */}
          <div className="flex items-end gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
              <input
                type="number"
                min="1800"
                max="2100"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Score (1-5)</label>
              <select
                value={newScore}
                onChange={(e) => setNewScore(e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded text-sm bg-white"
              >
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button
              onClick={handleAddYearScore}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Add / Update
            </button>
          </div>
        </div>

        {/* Metadata footer */}
        <div className="pt-6 border-t border-gray-200 text-xs text-gray-400">
          <p>company_id: {company.company_id}</p>
          <p>Created: {new Date(company.created_at).toLocaleString()}</p>
          <p>Updated: {new Date(company.updated_at).toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Inline editable row for a single year score ─────────────────────────

function YearScoreRow({
  year, score, onSave, onDelete,
}: {
  year: number
  score: number
  onSave: (newScore: number) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(score))

  return (
    <div className="flex items-center justify-between px-3 py-2">
      <div className="flex items-center gap-6">
        <span className="text-sm font-mono text-gray-700 w-16">{year}</span>
        {editing ? (
          <select
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
            autoFocus
          >
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        ) : (
          <span className="text-sm font-semibold text-gray-900">{score}</span>
        )}
      </div>
      <div className="flex gap-2">
        {editing ? (
          <>
            <button
              onClick={() => { onSave(parseInt(val, 10)); setEditing(false) }}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={() => { setVal(String(score)); setEditing(false) }}
              className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setEditing(true)}
              className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="px-2 py-1 text-xs text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  )
}
