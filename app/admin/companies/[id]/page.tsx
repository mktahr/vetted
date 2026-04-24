'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Company, CompanyBucket, CompanyStatus, CompanyFocus, CompanyYearScore, CompanyFunctionScore } from '@/app/types'
import CompanyLogo, { guessDomain } from '@/app/components/CompanyLogo'
import { COMPANY_FUNCTIONS } from '@/app/constants'

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

const FOCUS_OPTIONS: Array<{ value: CompanyFocus; label: string }> = [
  { value: 'hard_tech',  label: 'Hard Tech' },
  { value: 'all_tech',   label: 'All Tech' },
  { value: 'unreviewed', label: 'Unreviewed' },
]

export default function CompanyEditPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.id as string

  const [company, setCompany] = useState<Company | null>(null)
  const [yearScores, setYearScores] = useState<CompanyYearScore[]>([])
  const [functionScores, setFunctionScores] = useState<CompanyFunctionScore[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [form, setForm] = useState({
    company_name: '',
    primary_industry_tag: '',
    founding_year: '' as string,
    current_status: 'active' as CompanyStatus,
    company_bucket: '' as CompanyBucket | '',
    focus: 'all_tech' as CompanyFocus,
    website_url: '',
    linkedin_url: '',
  })

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
          focus: (c.focus as CompanyFocus) || 'all_tech',
          website_url: c.website_url || '',
          linkedin_url: c.linkedin_url || '',
        })

        const { data: ys } = await supabase
          .from('company_year_scores')
          .select('company_id, year, company_score, score_notes')
          .eq('company_id', companyId)
          .order('year', { ascending: false })
        setYearScores(ys || [])

        const { data: fs } = await supabase
          .from('company_function_scores')
          .select('company_id, function_normalized, year, function_score')
          .eq('company_id', companyId)
        setFunctionScores(fs || [])
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
        focus: form.focus,
        website_url: form.website_url.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
      }
      const { error } = await supabase
        .from('companies')
        .update(updates)
        .eq('company_id', companyId)
      if (error) throw error
      setSaveMsg({ text: 'Saved', ok: true })
      setCompany(prev => prev ? { ...prev, ...updates } as Company : prev)
    } catch (err: any) {
      setSaveMsg({ text: `Save failed: ${err.message}`, ok: false })
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 2500)
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('company_id', companyId)
      if (error) throw error
      router.replace('/admin/companies')
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`)
      setDeleting(false)
      setDeleteConfirm(false)
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

  async function upsertFunctionScore(fn: string, score: number) {
    const { error } = await supabase
      .from('company_function_scores')
      .upsert(
        { company_id: companyId, function_normalized: fn, year: new Date().getFullYear(), function_score: score },
        { onConflict: 'company_id,function_normalized,year' }
      )
    if (error) {
      setSaveMsg({ text: `Failed: ${error.message}`, ok: false })
      setTimeout(() => setSaveMsg(null), 3000)
      return
    }
    setFunctionScores(prev => {
      const others = prev.filter(p => p.function_normalized !== fn)
      return [...others, { company_id: companyId, function_normalized: fn, year: new Date().getFullYear(), function_score: score }]
    })
    setSaveMsg({ text: `${fn}: score ${score} saved`, ok: true })
    setTimeout(() => setSaveMsg(null), 2000)
  }

  async function deleteFunctionScore(fn: string) {
    const { error } = await supabase
      .from('company_function_scores')
      .delete()
      .eq('company_id', companyId)
      .eq('function_normalized', fn)
    if (error) {
      setSaveMsg({ text: `Delete failed: ${error.message}`, ok: false })
      setTimeout(() => setSaveMsg(null), 3000)
      return
    }
    setFunctionScores(prev => prev.filter(p => p.function_normalized !== fn))
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

  const domain = company.website_url?.replace(/^https?:\/\//, '').replace(/\/+$/, '') || guessDomain(company.company_name)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push('/admin/companies')}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to companies
        </button>
        <button
          onClick={handleDelete}
          onBlur={() => setDeleteConfirm(false)}
          disabled={deleting}
          className={`px-3 py-1.5 text-sm rounded-lg border ${
            deleteConfirm
              ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
              : 'text-red-600 border-red-300 hover:bg-red-50'
          } disabled:opacity-50`}
        >
          {deleting ? 'Deleting…' : deleteConfirm ? 'Click again to confirm' : 'Delete Company'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CompanyLogo domain={domain} companyName={company.company_name} size={40} />
            <div>
              <h1 className="text-3xl font-bold">{company.company_name}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm">
                {company.linkedin_url && (
                  <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                    LinkedIn
                  </a>
                )}
                {(company.website_url || domain) && (
                  <a href={company.website_url || `https://${domain}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                    {domain}
                  </a>
                )}
              </div>
            </div>
          </div>
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Website URL</label>
              <input
                type="text"
                value={form.website_url}
                onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">LinkedIn URL</label>
              <input
                type="text"
                value={form.linkedin_url}
                onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/company/example"
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

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Focus
                <span className="ml-1 text-gray-400 font-normal normal-case">
                  (hard_tech = hardware/defense/aerospace/robotics; all_tech = default searchable universe)
                </span>
              </label>
              <select
                value={form.focus}
                onChange={(e) => setForm({ ...form, focus: e.target.value as CompanyFocus })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FOCUS_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
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

          <div className="flex items-center gap-3 mt-4 p-3 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-xs text-gray-500">Year</label>
              <input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Score (1-5)</label>
              <select
                value={newScore}
                onChange={(e) => setNewScore(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
              >
                {[1,2,3,4,5].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button
              onClick={handleAddYearScore}
              className="mt-3 px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Add / Update
            </button>
          </div>
        </div>

        {/* Function Scores */}
        <div className="mb-8 border-t pt-6">
          <h2 className="text-lg font-semibold mb-3">Function Scores</h2>
          <p className="text-xs text-gray-500 mb-3">
            Per-function quality (0-5). Only set when a company is notably strong or weak for a specific function.
            When not set, the scoring engine falls back to the overall year score.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {COMPANY_FUNCTIONS.map(fn => {
              const existing = functionScores.find(fs => fs.function_normalized === fn.value)
              return (
                <div key={fn.value} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">{fn.label}</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={existing?.function_score ?? ''}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '') {
                          if (existing) deleteFunctionScore(fn.value)
                        } else {
                          upsertFunctionScore(fn.value, parseInt(val, 10))
                        }
                      }}
                      className="px-2 py-1 border border-gray-300 rounded text-sm bg-white w-20"
                    >
                      <option value="">—</option>
                      {[1,2,3,4,5].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t text-xs text-gray-400">
          <p>company_id: {company.company_id}</p>
          <p>Created: {new Date(company.created_at).toLocaleString()}</p>
          <p>Updated: {new Date(company.updated_at).toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Year score row with inline edit ─────────────────────────────────────

function YearScoreRow({ year, score, onSave, onDelete }: {
  year: number
  score: number
  onSave: (score: number) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editScore, setEditScore] = useState(String(score))

  if (editing) {
    return (
      <div className="flex items-center justify-between px-4 py-2">
        <span className="font-mono text-sm w-16">{year}</span>
        <select
          value={editScore}
          onChange={(e) => setEditScore(e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
        >
          {[1,2,3,4,5].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex gap-2">
          <button
            onClick={() => { onSave(parseInt(editScore, 10)); setEditing(false) }}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between px-4 py-2">
      <span className="font-mono text-sm w-16">{year}</span>
      <span className="text-sm font-medium">{score}</span>
      <div className="flex gap-3">
        <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
        <button onClick={onDelete} className="text-xs text-red-600 hover:text-red-800">Delete</button>
      </div>
    </div>
  )
}
