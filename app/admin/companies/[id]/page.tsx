'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Company, CompanyBucket, CompanyStatus, CompanyCategory, CompanyReviewStatus, CompanyYearScore, CompanyFunctionScore } from '@/app/types'
import CompanyLogo, { guessDomain } from '@/app/components/CompanyLogo'
import { COMPANY_FUNCTIONS } from '@/app/constants'
import {
  HARDWARE_INDUSTRIES, NON_HARDWARE_INDUSTRIES,
  HARDWARE_DOMAIN_TAGS, NON_HARDWARE_DOMAIN_TAGS,
  REVIEW_STATUSES, FUNDING_STAGES, FUNDING_STAGE_LABELS,
  HEADCOUNT_RANGES, COMPANY_TYPES, COMPANY_TYPE_LABELS,
  taggingMethodLabel,
  dedupeDomainTagsAgainstIndustry,
} from '@/lib/companies/taxonomy'

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

const CATEGORY_OPTIONS: Array<{ value: '' | CompanyCategory; label: string }> = [
  { value: '',             label: '— unclassified (NULL) —' },
  { value: 'hardware',     label: 'Hardware' },
  { value: 'non_hardware', label: 'Non-hardware' },
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
    // V1 taxonomy
    category: '' as '' | CompanyCategory,
    primary_industry: '',
    industries: [] as string[],
    domain_tags: [] as string[],
    review_status: 'unreviewed' as CompanyReviewStatus,
    // Firmographics
    company_type: '',
    founding_year: '' as string,
    current_status: 'active' as CompanyStatus,
    company_bucket: '' as CompanyBucket | '',
    website_url: '',
    linkedin_url: '',
    funding_stage: '',
    headcount_range: '',
  })

  const [newYear, setNewYear] = useState<string>(String(new Date().getFullYear()))
  const [newScore, setNewScore] = useState<string>('3')
  const [tagging, setTagging] = useState(false)
  const [reEnriching, setReEnriching] = useState(false)
  const [tagMsg, setTagMsg] = useState<{ text: string; ok: boolean } | null>(null)

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
          category: (c.category as CompanyCategory) || '',
          primary_industry: c.primary_industry || '',
          industries: Array.isArray(c.industries) ? c.industries : [],
          domain_tags: Array.isArray(c.domain_tags) ? c.domain_tags : [],
          review_status: (c.review_status as CompanyReviewStatus) || 'unreviewed',
          company_type: c.company_type || '',
          founding_year: c.founding_year != null ? String(c.founding_year) : '',
          current_status: c.current_status,
          company_bucket: c.company_bucket || '',
          website_url: c.website_url || '',
          linkedin_url: c.linkedin_url || '',
          funding_stage: (c as any).funding_stage || '',
          headcount_range: (c as any).headcount_range || '',
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
      // V1 schema: when category=null, the CHECK constraint requires
      // primary_industry=null + empty industries[] + empty domain_tags[].
      // Also: ensure primary_industry is in industries[] (CHECK constraint).
      const cat = form.category || null
      let primaryIndustry: string | null = null
      let industries: string[] = []
      let domainTags: string[] = []
      if (cat) {
        primaryIndustry = form.primary_industry || null
        industries = primaryIndustry ? Array.from(new Set([primaryIndustry, ...form.industries])) : []
        domainTags = dedupeDomainTagsAgainstIndustry(primaryIndustry, form.domain_tags)
      }
      // Manual edits freeze the row from auto-tagger overwrite.
      const updates: Record<string, unknown> = {
        company_name: form.company_name.trim(),
        category: cat,
        primary_industry: primaryIndustry,
        industries,
        domain_tags: domainTags,
        review_status: form.review_status,
        company_type: form.company_type || null,
        founding_year: form.founding_year ? parseInt(form.founding_year, 10) : null,
        current_status: form.current_status,
        company_bucket: (form.company_bucket as CompanyBucket) || null,
        website_url: form.website_url.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        funding_stage: form.funding_stage.trim() || null,
        headcount_range: form.headcount_range.trim() || null,
        tagging_method: 'manual',
        tagging_confidence: 1.0,
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

  async function handleTagNow() {
    setTagging(true)
    setTagMsg(null)
    try {
      const resp = await fetch(`/api/admin/companies/${companyId}/tag`, { method: 'POST' })
      const data = await resp.json()
      if (!resp.ok) {
        setTagMsg({ text: data.error || `HTTP ${resp.status}`, ok: false })
      } else {
        setTagMsg({ text: 'Tagged. Reload to see updated values.', ok: true })
        // Reload company row to surface fresh values
        const { data: refreshed } = await supabase.from('companies').select('*').eq('company_id', companyId).single()
        if (refreshed) {
          setCompany(refreshed as Company)
        }
      }
    } catch (err: any) {
      setTagMsg({ text: err?.message || 'Network error', ok: false })
    } finally {
      setTagging(false)
      setTimeout(() => setTagMsg(null), 4000)
    }
  }

  async function handleReEnrich() {
    if (!confirm('Re-enrich from Crust? This costs 2 Crust credits + ~$0.005 in tagger spend, and may overwrite tagger fields.')) return
    setReEnriching(true)
    setTagMsg(null)
    try {
      const resp = await fetch(`/api/admin/companies/${companyId}/re-enrich`, { method: 'POST' })
      const data = await resp.json()
      if (!resp.ok) {
        setTagMsg({ text: data.error || `HTTP ${resp.status}`, ok: false })
      } else {
        setTagMsg({ text: 'Re-enriched. Reload to see updated values.', ok: true })
        const { data: refreshed } = await supabase.from('companies').select('*').eq('company_id', companyId).single()
        if (refreshed) {
          setCompany(refreshed as Company)
        }
      }
    } catch (err: any) {
      setTagMsg({ text: err?.message || 'Network error', ok: false })
    } finally {
      setReEnriching(false)
      setTimeout(() => setTagMsg(null), 4000)
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setDeleting(true)
    try {
      // Cascade clean-up — companies has FK references in people /
      // person_experiences / score tables. Without ON DELETE CASCADE in the
      // schema, we have to clear references manually before the DELETE.
      const { error: peopleErr } = await supabase
        .from('people')
        .update({ current_company_id: null })
        .eq('current_company_id', companyId)
      if (peopleErr) throw new Error(`people: ${peopleErr.message}`)

      const { error: expErr } = await supabase
        .from('person_experiences')
        .delete()
        .eq('company_id', companyId)
      if (expErr) throw new Error(`experiences: ${expErr.message}`)

      await supabase.from('company_year_scores').delete().eq('company_id', companyId)
      await supabase.from('company_function_scores').delete().eq('company_id', companyId)

      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('company_id', companyId)
      if (error) throw new Error(`company: ${error.message}`)
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
        <div style={{ color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)' }}>Loading company...</div>
      </div>
    )
  }

  if (!company) {
    return (
      <div style={{ padding: 24, background: 'var(--bg-canvas)', minHeight: '100vh', fontFamily: 'var(--font-sans)', color: 'var(--fg-primary)' }}>
        <p style={{ color: 'var(--red-400)', marginBottom: 16 }}>Company not found.</p>
        <button onClick={() => router.push('/admin/companies')} className="px-4 py-2 bg-primary text-white rounded-lg">
          Back to list
        </button>
      </div>
    )
  }

  const domain = company.website_url?.replace(/^https?:\/\//, '').replace(/\/+$/, '') || guessDomain(company.company_name)

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', background: 'var(--bg-canvas)', color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push('/admin/companies')}
          className="text-muted-foreground hover:text-foreground"
        >
          ← Back to companies
        </button>
        <button
          onClick={handleDelete}
          onBlur={() => setDeleteConfirm(false)}
          disabled={deleting}
          className={`px-3 py-1.5 text-sm rounded-lg border ${
            deleteConfirm
              ? 'bg-destructive text-white border-red-600 hover:bg-destructive'
              : 'text-destructive border-destructive/30 hover:bg-destructive/10'
          } disabled:opacity-50`}
        >
          {deleting ? 'Deleting…' : deleteConfirm ? 'Click again to confirm' : 'Delete Company'}
        </button>
      </div>

      <div className="bg-card rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CompanyLogo domain={domain} companyName={company.company_name} size={40} />
            <div>
              <h1 className="text-3xl font-bold">{company.company_name}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm">
                {company.linkedin_url && (
                  <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground hover:underline">
                    LinkedIn
                  </a>
                )}
                {(company.website_url || domain) && (
                  <a href={company.website_url || `https://${domain}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground hover:underline">
                    {domain}
                  </a>
                )}
              </div>
            </div>
          </div>
          {saveMsg && (
            <span className={`text-sm px-3 py-1 rounded-full ${saveMsg.ok ? 'bg-positive/20 text-positive' : 'bg-destructive/20 text-destructive'}`}>
              {saveMsg.text}
            </span>
          )}
        </div>

        {/* Company fields */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => {
                  const newCat = e.target.value as '' | CompanyCategory
                  // Reset industries/domain_tags when switching category (CHECK constraint)
                  setForm({ ...form, category: newCat, primary_industry: '', industries: [], domain_tags: [] })
                }}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Primary Industry
                {form.category && <span className="text-tertiary ml-1 normal-case font-normal">(from {form.category} list)</span>}
              </label>
              <select
                value={form.primary_industry}
                onChange={(e) => {
                  const newPrimary = e.target.value
                  // Make sure primary is in industries[]
                  const inds = newPrimary ? Array.from(new Set([newPrimary, ...form.industries])) : []
                  setForm({ ...form, primary_industry: newPrimary, industries: inds })
                }}
                disabled={!form.category}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              >
                <option value="">— pick —</option>
                {(form.category === 'hardware' ? HARDWARE_INDUSTRIES : form.category === 'non_hardware' ? NON_HARDWARE_INDUSTRIES : []).map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Industries (multi)
                <span className="text-tertiary ml-1 normal-case font-normal">— add secondary industries beyond primary</span>
              </label>
              <div className="flex flex-wrap gap-1 p-2 border border-border rounded-lg bg-card min-h-[40px]">
                {form.industries.map(i => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-secondary rounded">
                    {i}{i === form.primary_industry && <span className="text-tertiary">(primary)</span>}
                    {i !== form.primary_industry && (
                      <button onClick={() => setForm({ ...form, industries: form.industries.filter(x => x !== i) })} className="ml-1 text-tertiary hover:text-foreground">×</button>
                    )}
                  </span>
                ))}
                {form.category && (
                  <select
                    value=""
                    onChange={(e) => {
                      const v = e.target.value
                      if (v && !form.industries.includes(v)) setForm({ ...form, industries: [...form.industries, v] })
                    }}
                    className="text-xs bg-transparent border-none outline-none ml-1"
                  >
                    <option value="">+ add industry…</option>
                    {(form.category === 'hardware' ? HARDWARE_INDUSTRIES : NON_HARDWARE_INDUSTRIES).filter(i => !form.industries.includes(i)).map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Domain Tags (multi)
                {form.primary_industry === 'AI' && <span className="text-amber-600 ml-1 normal-case font-normal">— AI tag suppressed when primary industry is AI</span>}
              </label>
              <div className="flex flex-wrap gap-1 p-2 border border-border rounded-lg bg-card min-h-[40px]">
                {form.domain_tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-secondary rounded">
                    {t}
                    <button onClick={() => setForm({ ...form, domain_tags: form.domain_tags.filter(x => x !== t) })} className="ml-1 text-tertiary hover:text-foreground">×</button>
                  </span>
                ))}
                {form.category && (
                  <select
                    value=""
                    onChange={(e) => {
                      const v = e.target.value
                      if (v && !form.domain_tags.includes(v)) setForm({ ...form, domain_tags: [...form.domain_tags, v] })
                    }}
                    className="text-xs bg-transparent border-none outline-none ml-1"
                  >
                    <option value="">+ add tag…</option>
                    {(form.category === 'hardware' ? HARDWARE_DOMAIN_TAGS : NON_HARDWARE_DOMAIN_TAGS).filter(t => !form.domain_tags.includes(t)).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Review Status</label>
              <select
                value={form.review_status}
                onChange={(e) => setForm({ ...form, review_status: e.target.value as CompanyReviewStatus })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {REVIEW_STATUSES.map(rs => <option key={rs} value={rs}>{rs}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Website URL</label>
              <input
                type="text"
                value={form.website_url}
                onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">LinkedIn URL</label>
              <input
                type="text"
                value={form.linkedin_url}
                onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/company/example"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Funding Stage
                <span className="text-tertiary ml-1 normal-case font-normal">(priced equity rounds only)</span>
              </label>
              <select
                value={form.funding_stage}
                onChange={(e) => setForm({ ...form, funding_stage: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">— none —</option>
                {FUNDING_STAGES.map(s => <option key={s} value={s}>{FUNDING_STAGE_LABELS[s]}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Headcount Range</label>
              <select
                value={form.headcount_range}
                onChange={(e) => setForm({ ...form, headcount_range: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">— none —</option>
                {HEADCOUNT_RANGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {company?.headcount_latest != null && (() => {
                const at = company.headcount_latest_at ? new Date(company.headcount_latest_at) : null
                const isStale = at && (Date.now() - at.getTime()) > 90 * 24 * 60 * 60 * 1000
                return (
                  <div className={`mt-1 text-[11px] ${isStale ? 'text-tertiary' : 'text-muted-foreground'}`}>
                    Latest precise: <span className="font-mono">{company.headcount_latest.toLocaleString()}</span>
                    {at && <> &middot; as of {at.toLocaleDateString()}</>}
                    {isStale && <span className="ml-1 text-amber-700">(stale &gt; 90d)</span>}
                  </div>
                )
              })()}
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Company Type
                <span className="text-tertiary ml-1 normal-case font-normal">(corporate structure — distinct from lifecycle Status above)</span>
              </label>
              <select
                value={form.company_type}
                onChange={(e) => setForm({ ...form, company_type: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">— unknown —</option>
                {COMPANY_TYPES.map(t => <option key={t} value={t}>{COMPANY_TYPE_LABELS[t]}</option>)}
              </select>
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

          {/* Tagger metadata + on-demand actions */}
          {company && (
            <div className="mt-4 p-3 bg-background rounded-lg text-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="text-muted-foreground">Tagger metadata (auto-set; manual edits override)</div>
                <div className="flex items-center gap-2">
                  {company.tagging_method == null && (
                    <button
                      onClick={handleTagNow}
                      disabled={tagging}
                      className="px-2 py-1 text-xs border border-border rounded bg-card hover:bg-background disabled:opacity-50"
                      title="Run identify + tagCompany() now (instead of waiting for the 2-min cron)"
                    >
                      {tagging ? 'Tagging…' : 'Tag now'}
                    </button>
                  )}
                  {company.crustdata_company_id != null && company.review_status === 'vetted' && company.tagging_method !== 'manual' && (
                    <button
                      onClick={handleReEnrich}
                      disabled={reEnriching}
                      className="px-2 py-1 text-xs border border-amber-300 rounded bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                      title="Re-pull from Crust enrich (2 credits) and re-tag. Overwrites firmographics + tagger fields."
                    >
                      {reEnriching ? 'Re-enriching…' : 'Re-enrich from Crust'}
                    </button>
                  )}
                </div>
              </div>
              {tagMsg && (
                <div className={`mb-2 text-xs ${tagMsg.ok ? 'text-green-700' : 'text-red-700'}`}>{tagMsg.text}</div>
              )}
              {company.tagging_method ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-tertiary">Method:</span> {taggingMethodLabel(company.tagging_method)}
                    <span className="text-tertiary text-[10px] ml-1 font-mono">({company.tagging_method})</span>
                  </div>
                  <div><span className="text-tertiary">Confidence:</span> {company.tagging_confidence != null ? company.tagging_confidence.toFixed(2) : '—'}</div>
                  {company.tagging_notes && (
                    <div className="col-span-2 mt-1">
                      <span className="text-tertiary">Notes:</span>
                      <pre className="whitespace-pre-wrap text-[11px] mt-1 text-muted-foreground">{company.tagging_notes}</pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-tertiary">Not yet tagged. The daily cron picks this up automatically, or click Tag now.</div>
              )}
            </div>
          )}

          <button
            onClick={handleSaveCompany}
            disabled={saving}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-strong disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Details'}
          </button>
        </div>

        {/* Year scores */}
        <div className="mb-8 border-t pt-6">
          <h2 className="text-lg font-semibold mb-3">Year Scores</h2>
          <p className="text-xs text-tertiary mb-3">Scale: 1 = weak, 2 = mixed, 3 = solid, 4 = excellent, 5 = elite</p>

          {yearScores.length === 0 ? (
            <p className="text-sm text-tertiary mb-4">No year scores yet.</p>
          ) : (
            <div className="mb-4 bg-background rounded-lg divide-y divide-border">
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

          <div className="flex items-center gap-3 mt-4 p-3 bg-background rounded-lg">
            <div>
              <label className="block text-xs text-tertiary">Year</label>
              <input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                className="w-20 px-2 py-1 border border-border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-tertiary">Score (1-5)</label>
              <select
                value={newScore}
                onChange={(e) => setNewScore(e.target.value)}
                className="px-2 py-1 border border-border rounded text-sm bg-card"
              >
                {[1,2,3,4,5].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button
              onClick={handleAddYearScore}
              className="mt-3 px-4 py-1.5 bg-primary text-white rounded hover:bg-accent-strong text-sm"
            >
              Add / Update
            </button>
          </div>
        </div>

        {/* Function Scores */}
        <div className="mb-8 border-t pt-6">
          <h2 className="text-lg font-semibold mb-3">Function Scores</h2>
          <p className="text-xs text-tertiary mb-3">
            Per-function quality (0-5). Only set when a company is notably strong or weak for a specific function.
            When not set, the scoring engine falls back to the overall year score.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {COMPANY_FUNCTIONS.map(fn => {
              const existing = functionScores.find(fs => fs.function_normalized === fn.value)
              return (
                <div key={fn.value} className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <span className="text-sm font-medium text-muted-foreground">{fn.label}</span>
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
                      className="px-2 py-1 border border-border rounded text-sm bg-card w-20"
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
        <div className="pt-4 border-t text-xs text-tertiary">
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
          className="px-2 py-1 border border-border rounded text-sm bg-card"
        >
          {[1,2,3,4,5].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex gap-2">
          <button
            onClick={() => { onSave(parseInt(editScore, 10)); setEditing(false) }}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-xs text-tertiary hover:text-muted-foreground"
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
        <button onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground hover:underline">Edit</button>
        <button onClick={onDelete} className="text-xs text-destructive hover:text-destructive">Delete</button>
      </div>
    </div>
  )
}
