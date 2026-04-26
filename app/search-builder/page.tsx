'use client'

// Build a Search — full-page search builder with temporal scope selectors.
//
// Every experience-backed filter gets a 3-option scope:
//   "Ever" (default) | "Currently" | "Previously, not currently"
//
// URL state: single JSON param `filters` (TODO: refactor to individual params later).

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, fetchAllRows } from '@/lib/supabase'
import { MultiSelect, MultiSelectOption } from '../components/MultiSelect'
import { buildLocationOptions } from '@/lib/locations/us-locations'

export default function SearchBuilderPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64vh', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)', background: 'var(--bg-canvas)' }}>Loading search builder...</div>}>
      <SearchBuilderInner />
    </Suspense>
  )
}

// ─── Constants ──────────────────────────────────────────────────────────────

type TemporalScope = 'ever' | 'currently' | 'previously'

const BUCKET_OPTIONS: MultiSelectOption[] = [
  { value: 'vetted_talent', label: 'Vetted Talent' }, { value: 'high_potential', label: 'High Potential' },
  { value: 'silver_medalist', label: 'Silver Medalist' }, { value: 'non_vetted', label: 'Non-Vetted' },
  { value: 'needs_review', label: 'Needs Review' },
]
const STAGE_OPTIONS: MultiSelectOption[] = [
  { value: 'pre_career', label: 'Pre-Career' }, { value: 'early_career', label: 'Early Career' },
  { value: 'mid_career', label: 'Mid Career' }, { value: 'senior_career', label: 'Senior Career' },
]
const CLEARANCE_OPTIONS: MultiSelectOption[] = [
  { value: 'none', label: 'None' }, { value: 'confidential', label: 'Confidential' },
  { value: 'secret', label: 'Secret' }, { value: 'top_secret', label: 'Top Secret' },
  { value: 'ts_sci', label: 'TS/SCI' }, { value: 'q_clearance', label: 'Q (DOE)' },
  { value: 'other', label: 'Other' }, { value: 'unknown', label: 'Unknown' },
]

const scopeBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '2px 8px', fontSize: 'var(--fs-11)', fontFamily: 'var(--font-sans)',
  border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-chip)',
  background: active ? 'var(--bg-surface-raised)' : 'transparent',
  color: active ? 'var(--fg-primary)' : 'var(--fg-tertiary)',
  fontWeight: active ? 'var(--fw-medium)' as any : 'normal',
  cursor: 'pointer', lineHeight: '1.5',
})

function ScopeSelector({ value, onChange, label }: { value: TemporalScope; onChange: (v: TemporalScope) => void; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
      {label && <span style={{ fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-medium)' as any, color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)' }}>{label}</span>}
      <div style={{ display: 'flex', gap: 2 }}>
        <button style={scopeBtnStyle(value === 'ever')} onClick={() => onChange('ever')}>Ever</button>
        <button style={scopeBtnStyle(value === 'currently')} onClick={() => onChange('currently')}>Currently</button>
        <button style={scopeBtnStyle(value === 'previously')} onClick={() => onChange('previously')}>Previously</button>
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

function SearchBuilderInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)

  // ─── Filter state ───────────────────────────────────────────────────────
  const [roleSel, setRoleSel] = useState<string[]>([])
  const [specialtySel, setSpecialtySel] = useState<string[]>([])
  const [specialtyScope, setSpecialtyScope] = useState<TemporalScope>('ever')
  const [senioritySel, setSenioritySel] = useState<string[]>([])
  const [seniorityScope, setSeniorityScope] = useState<TemporalScope>('ever')
  const [bucketSel, setBucketSel] = useState<string[]>([])
  const [stageSel, setStageSel] = useState<string[]>([])
  const [yearsMin, setYearsMin] = useState('')
  const [yearsMax, setYearsMax] = useState('')
  const [clearanceSel, setClearanceSel] = useState<string[]>([])
  const [locationSel, setLocationSel] = useState<string[]>([])
  const [focusScope, setFocusScope] = useState<'all' | 'hard_tech' | 'all_tech'>('all')
  const [compoundCompany, setCompoundCompany] = useState('')
  const [compoundCompanyScope, setCompoundCompanyScope] = useState<TemporalScope>('ever')
  const [compoundSpecialties, setCompoundSpecialties] = useState<string[]>([])
  const [compoundYearMin, setCompoundYearMin] = useState('')
  const [compoundYearMax, setCompoundYearMax] = useState('')
  const [schoolSel, setSchoolSel] = useState<string[]>([])
  const [schoolTemporalScope, setSchoolTemporalScope] = useState<TemporalScope>('ever')
  const [titleBoolean, setTitleBoolean] = useState('')
  const [titleBooleanScope, setTitleBooleanScope] = useState<TemporalScope>('ever')
  const [experienceBoolean, setExperienceBoolean] = useState('')
  const [signalSel, setSignalSel] = useState<string[]>([])
  const [schoolGroupSel, setSchoolGroupSel] = useState<string[]>([])
  const [schoolGroupScope, setSchoolGroupScope] = useState<TemporalScope>('ever')
  const [companyGroupSel, setCompanyGroupSel] = useState<string[]>([])
  const [companyGroupScope, setCompanyGroupScope] = useState<TemporalScope>('ever')

  // ─── Options ────────────────────────────────────────────────────────────
  const [roleOptions, setRoleOptions] = useState<MultiSelectOption[]>([])
  const [seniorityOptions, setSeniorityOptions] = useState<MultiSelectOption[]>([])
  const [companyOptions, setCompanyOptions] = useState<MultiSelectOption[]>([])
  const [schoolOptions, setSchoolOptions] = useState<MultiSelectOption[]>([])
  const [specialtyOptions, setSpecialtyOptions] = useState<MultiSelectOption[]>([])
  const [signalOptions, setSignalOptions] = useState<MultiSelectOption[]>([])
  const [schoolGroupOptions, setSchoolGroupOptions] = useState<MultiSelectOption[]>([])
  const [companyGroupOptions, setCompanyGroupOptions] = useState<MultiSelectOption[]>([])
  const locationOptions = buildLocationOptions()

  // ─── Load data ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [
        { data: roles }, { data: srs }, { data: companies }, { data: schools },
        { data: specs }, { data: signalsData },
      ] = await Promise.all([
        supabase.from('role_dictionary').select('role_id, role_name, display_order').eq('active', true).order('display_order'),
        supabase.from('seniority_dictionary').select('seniority_normalized, rank_order').eq('active', true).order('rank_order'),
        fetchAllRows<any>('companies', 'company_id, company_name, primary_industry_tag, focus, company_groups', 'company_name').then(data => ({ data })),
        fetchAllRows<any>('schools', 'school_id, school_name, school_score, is_foreign, school_groups', 'school_name').then(data => ({ data })),
        supabase.from('specialty_dictionary').select('specialty_normalized, parent_function').eq('active', true).order('specialty_normalized'),
        supabase.from('person_signals_active').select('signal_id, canonical_name, category').order('confidence', { ascending: false }),
      ])

      setRoleOptions((roles || []).map((r: any) => ({ value: r.role_id, label: r.role_name })))
      setSeniorityOptions((srs || []).map(s => ({ value: s.seniority_normalized, label: s.seniority_normalized.replace(/_/g, ' ') })))
      setCompanyOptions((companies || []).filter((c: any) => c.focus === 'hard_tech' || c.focus === 'all_tech').map((c: any) => ({ value: c.company_id, label: c.company_name, sublabel: c.primary_industry_tag || undefined })))
      setSchoolOptions((schools || []).filter((s: any) => s.school_score != null).map((s: any) => ({ value: s.school_id, label: s.school_name, sublabel: s.is_foreign ? "Int'l" : undefined })))
      setSpecialtyOptions((specs || []).map((d: any) => ({ value: d.specialty_normalized, label: d.specialty_normalized.replace(/_/g, ' '), sublabel: (d.parent_function || '').replace(/_/g, ' ') })))

      // Signal options: category-level + individual
      const SIGNAL_CATEGORY_ORDER = ['founder','military','fellowship','scholarship','academic_distinction','competition','hackathon','athletics','engineering_team','student_leadership','greek_life']
      const SIGNAL_CATEGORY_LABELS: Record<string, string> = {
        founder:'Founder', military:'Military', fellowship:'Fellowship', scholarship:'Scholarship',
        academic_distinction:'Academic', competition:'Competition', hackathon:'Hackathon',
        athletics:'Athletics', engineering_team:'Eng. Team', student_leadership:'Leadership', greek_life:'Greek Life',
      }
      const catsWithSignals = new Set<string>()
      const allSignalIds = new Map<string, { name: string; cat: string }>()
      for (const s of signalsData || []) {
        catsWithSignals.add(s.category)
        if (!allSignalIds.has(s.signal_id)) allSignalIds.set(s.signal_id, { name: s.canonical_name, cat: s.category })
      }
      const sigOpts: MultiSelectOption[] = []
      for (const cat of SIGNAL_CATEGORY_ORDER) {
        if (!catsWithSignals.has(cat)) continue
        sigOpts.push({ value: `cat:${cat}`, label: `Any ${SIGNAL_CATEGORY_LABELS[cat] || cat}`, sublabel: 'Category' })
      }
      const sortedSigs = Array.from(allSignalIds.entries()).sort((a, b) => {
        const catA = SIGNAL_CATEGORY_ORDER.indexOf(a[1].cat), catB = SIGNAL_CATEGORY_ORDER.indexOf(b[1].cat)
        if (catA !== catB) return catA - catB
        return a[1].name.localeCompare(b[1].name)
      })
      for (const [id, info] of sortedSigs) {
        sigOpts.push({ value: id, label: info.name, sublabel: SIGNAL_CATEGORY_LABELS[info.cat] || info.cat })
      }
      setSignalOptions(sigOpts)

      // School groups
      const sgVals = new Set<string>()
      for (const s of schools || []) { for (const g of (s as any).school_groups || []) sgVals.add(g) }
      const sgLabels: Record<string, string> = { top_military_academy: 'Top Military Academy', top_mba: 'Top MBA Program', top_law_school: 'Top Law School' }
      setSchoolGroupOptions(Array.from(sgVals).sort().map(g => ({ value: g, label: sgLabels[g] || g.replace(/_/g, ' ') })))

      // Company groups
      const cgVals = new Set<string>()
      for (const c of companies || []) { for (const g of (c as any).company_groups || []) cgVals.add(g) }
      const cgLabels: Record<string, string> = { top_law_firm: 'Top Law Firm' }
      setCompanyGroupOptions(Array.from(cgVals).sort().map(g => ({ value: g, label: cgLabels[g] || g.replace(/_/g, ' ') })))

      // Parse incoming filter state from URL
      const raw = searchParams.get('filters')
      if (raw) {
        try {
          const f = JSON.parse(decodeURIComponent(raw))
          if (f.roleSel) setRoleSel(f.roleSel)
          if (f.specialtySel) setSpecialtySel(f.specialtySel)
          // Backward compat: old 'any'/'current' maps to 'ever'/'currently'
          if (f.specialtyScope === 'any') setSpecialtyScope('ever')
          else if (f.specialtyScope === 'current') setSpecialtyScope('currently')
          else if (f.specialtyScope) setSpecialtyScope(f.specialtyScope)
          if (f.senioritySel) setSenioritySel(f.senioritySel)
          if (f.seniorityScope) setSeniorityScope(f.seniorityScope)
          if (f.bucketSel) setBucketSel(f.bucketSel)
          if (f.stageSel) setStageSel(f.stageSel)
          if (f.yearsMin) setYearsMin(f.yearsMin)
          if (f.yearsMax) setYearsMax(f.yearsMax)
          if (f.clearanceSel) setClearanceSel(f.clearanceSel)
          if (f.locationSel) setLocationSel(f.locationSel)
          if (f.focusScope) setFocusScope(f.focusScope)
          if (f.compoundCompany) setCompoundCompany(f.compoundCompany)
          if (f.compoundCompanyScope) setCompoundCompanyScope(f.compoundCompanyScope)
          // Backward compat: old compoundRelationship maps to scope
          else if (f.compoundRelationship === 'current') setCompoundCompanyScope('currently')
          else if (f.compoundRelationship === 'previous') setCompoundCompanyScope('previously')
          if (f.compoundSpecialties) setCompoundSpecialties(f.compoundSpecialties)
          if (f.compoundYearMin) setCompoundYearMin(f.compoundYearMin)
          if (f.compoundYearMax) setCompoundYearMax(f.compoundYearMax)
          if (f.schoolSel) setSchoolSel(f.schoolSel)
          if (f.schoolTemporalScope) setSchoolTemporalScope(f.schoolTemporalScope)
          if (f.titleBoolean) setTitleBoolean(f.titleBoolean)
          if (f.titleBooleanScope) setTitleBooleanScope(f.titleBooleanScope)
          if (f.experienceBoolean) setExperienceBoolean(f.experienceBoolean)
          if (f.signalSel) setSignalSel(f.signalSel)
          if (f.schoolGroupSel) setSchoolGroupSel(f.schoolGroupSel)
          if (f.schoolGroupScope) setSchoolGroupScope(f.schoolGroupScope)
          if (f.companyGroupSel) setCompanyGroupSel(f.companyGroupSel)
          if (f.companyGroupScope) setCompanyGroupScope(f.companyGroupScope)
        } catch { /* ignore bad JSON */ }
      }
      setLoading(false)
    }
    load()
  }, [searchParams])

  function runSearch() {
    const state = {
      roleSel, specialtySel, specialtyScope, senioritySel, seniorityScope,
      bucketSel, stageSel, yearsMin, yearsMax, clearanceSel, locationSel, focusScope,
      compoundCompany, compoundCompanyScope, compoundSpecialties, compoundYearMin, compoundYearMax,
      schoolSel, schoolTemporalScope, titleBoolean, titleBooleanScope, experienceBoolean,
      signalSel, schoolGroupSel, schoolGroupScope, companyGroupSel, companyGroupScope,
    }
    // TODO: The home page doesn't currently read URL filters — this navigates back and the
    // user needs to re-apply. Full round-trip requires ProfileTable to read URL params on mount.
    router.push('/')
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64vh', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)', background: 'var(--bg-canvas)' }}>Loading search builder...</div>

  const sectionStyle: React.CSSProperties = { background: 'var(--bg-surface)', borderRadius: 'var(--r-card, 8px)', border: '1px solid var(--border-subtle)', padding: 20 }
  const headingStyle: React.CSSProperties = { fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-medium)' as any, color: 'var(--fg-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--tr-eyebrow)', marginBottom: 12, fontFamily: 'var(--font-sans)' }
  const lblStyle: React.CSSProperties = { display: 'block', fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-medium)' as any, color: 'var(--fg-tertiary)', marginBottom: 2, fontFamily: 'var(--font-sans)' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-button)', fontSize: 'var(--fs-13)', fontFamily: 'var(--font-sans)', background: 'var(--bg-surface)', color: 'var(--fg-primary)' }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', background: 'var(--bg-canvas)', color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>
      <div style={{ marginBottom: 24 }}>
        <a href="/" style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-tertiary)', textDecoration: 'none' }}>← Back to results</a>
        <h1 style={{ fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-semibold)' as any, marginTop: 8 }}>Build a Search</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>

        {/* Search Scope */}
        <div style={sectionStyle}>
          <div style={headingStyle}>Search Scope</div>
          <select value={focusScope} onChange={e => setFocusScope(e.target.value as any)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="all">All candidates</option>
            <option value="hard_tech">Hard tech experience</option>
            <option value="all_tech">All tech experience</option>
          </select>
        </div>

        {/* Who They Are */}
        <div style={{ ...sectionStyle, gridColumn: 'span 2' }}>
          <div style={headingStyle}>Who They Are</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <MultiSelect label="Role" options={roleOptions} selected={roleSel} onChange={setRoleSel} placeholder="Any role" />
            <div>
              <ScopeSelector label="Specialty" value={specialtyScope} onChange={setSpecialtyScope} />
              <MultiSelect label="" options={specialtyOptions} selected={specialtySel} onChange={setSpecialtySel} placeholder="Any specialty" />
            </div>
            <div>
              <ScopeSelector label="Seniority" value={seniorityScope} onChange={setSeniorityScope} />
              <MultiSelect label="" options={seniorityOptions} selected={senioritySel} onChange={setSenioritySel} placeholder="Any seniority" />
            </div>
            <MultiSelect label="Bucket" options={BUCKET_OPTIONS} selected={bucketSel} onChange={setBucketSel} placeholder="Any bucket" />
            <MultiSelect label="Career Stage" options={STAGE_OPTIONS} selected={stageSel} onChange={setStageSel} placeholder="Any stage" />
            <div>
              <label style={lblStyle}>Years of Experience</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="number" min="0" step="0.5" value={yearsMin} onChange={e => setYearsMin(e.target.value)} placeholder="min" style={inputStyle} />
                <span style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)' }}>–</span>
                <input type="number" min="0" step="0.5" value={yearsMax} onChange={e => setYearsMax(e.target.value)} placeholder="max" style={inputStyle} />
              </div>
            </div>
            <MultiSelect label="Clearance" options={CLEARANCE_OPTIONS} selected={clearanceSel} onChange={setClearanceSel} placeholder="Any clearance" />
            <MultiSelect label="Location (US)" options={locationOptions} selected={locationSel} onChange={setLocationSel} placeholder="State or city" />
            {signalOptions.length > 0 && (
              <MultiSelect label="Signals" options={signalOptions} selected={signalSel} onChange={setSignalSel} placeholder="Any signal" />
            )}
          </div>
        </div>

        {/* Where They Worked */}
        <div style={sectionStyle}>
          <div style={headingStyle}>Where They Worked</div>
          <ScopeSelector label="Company" value={compoundCompanyScope} onChange={setCompoundCompanyScope} />
          <MultiSelect label="" options={companyOptions} selected={compoundCompany ? [compoundCompany] : []} onChange={v => setCompoundCompany(v[0] || '')} placeholder="Search companies…" />
          {compoundCompany && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <MultiSelect label="Specialty there" options={specialtyOptions} selected={compoundSpecialties} onChange={setCompoundSpecialties} placeholder="Any" />
              <div>
                <label style={lblStyle}>Year range</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" min="1950" max="2100" value={compoundYearMin} onChange={e => setCompoundYearMin(e.target.value)} placeholder="from" style={inputStyle} />
                  <span style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)' }}>–</span>
                  <input type="number" min="1950" max="2100" value={compoundYearMax} onChange={e => setCompoundYearMax(e.target.value)} placeholder="to" style={inputStyle} />
                </div>
              </div>
            </div>
          )}
          {companyGroupOptions.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <ScopeSelector label="Company group" value={companyGroupScope} onChange={setCompanyGroupScope} />
              <MultiSelect label="" options={companyGroupOptions} selected={companyGroupSel} onChange={setCompanyGroupSel} placeholder="Any company group" />
            </div>
          )}
        </div>

        {/* Where They Studied */}
        <div style={sectionStyle}>
          <div style={headingStyle}>Where They Studied</div>
          <ScopeSelector label="School" value={schoolTemporalScope} onChange={setSchoolTemporalScope} />
          <MultiSelect label="" options={schoolOptions} selected={schoolSel} onChange={setSchoolSel} placeholder="Search ranked schools…" />
          {schoolGroupOptions.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <ScopeSelector label="School group" value={schoolGroupScope} onChange={setSchoolGroupScope} />
              <MultiSelect label="" options={schoolGroupOptions} selected={schoolGroupSel} onChange={setSchoolGroupSel} placeholder="Any school group" />
            </div>
          )}
        </div>

        {/* Keyword Search */}
        <div style={sectionStyle}>
          <div style={headingStyle}>Keyword Search</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <ScopeSelector label="Title keywords" value={titleBooleanScope} onChange={setTitleBooleanScope} />
              <input type="text" value={titleBoolean} onChange={e => setTitleBoolean(e.target.value)} placeholder='"staff engineer" OR principal' style={inputStyle} />
            </div>
            <div>
              <label style={lblStyle}>Experience & skills keywords</label>
              <input type="text" value={experienceBoolean} onChange={e => setExperienceBoolean(e.target.value)} placeholder='MATLAB OR Simulink' style={inputStyle} />
              <p style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)', marginTop: 4, fontFamily: 'var(--font-sans)' }}>Searches descriptions, headlines, skills. Use AND, OR, NOT, quotes.</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={runSearch} style={{ padding: '8px 24px', background: 'var(--accent)', color: 'white', borderRadius: 'var(--r-button)', border: 'none', fontWeight: 'var(--fw-medium)' as any, fontSize: 'var(--fs-14)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          Run Search
        </button>
        <a href="/" style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-tertiary)', textDecoration: 'none' }}>Cancel</a>
      </div>
    </div>
  )
}
