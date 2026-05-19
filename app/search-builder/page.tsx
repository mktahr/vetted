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
import { ConditionRowList } from '../components/condition-rows'
import type { ConditionRow } from '../components/condition-rows/types'
import { conditionToCompact, compactToCondition } from '../components/condition-rows/types'
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
  { value: 'vetted', label: 'Vetted' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'flagged', label: 'Flagged' },
]
const DEGREE_OPTIONS: MultiSelectOption[] = [
  { value: 'bachelor', label: "Bachelor's" },
  { value: 'master',   label: "Master's" },
  { value: 'mba',      label: 'MBA' },
  { value: 'jd',       label: 'JD' },
  { value: 'md',       label: 'MD' },
  { value: 'phd',      label: 'PhD' },
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

type ScopedPillType = { value: string; scope: TemporalScope }

function PillScopeRow({ pills, setPills, options, formatLabel }: {
  pills: ScopedPillType[]
  setPills: (p: ScopedPillType[]) => void
  options?: Array<{ value: string; label: string }>
  formatLabel?: (v: string) => string
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
      {pills.map(pill => {
        const label = options?.find(o => o.value === pill.value)?.label || (formatLabel ? formatLabel(pill.value) : pill.value)
        return (
          <span key={pill.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 6px', fontSize: 'var(--fs-11)', fontFamily: 'var(--font-sans)', background: 'var(--bg-surface-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--r-chip)' }}>
            <span style={{ color: 'var(--fg-primary)' }}>{label}</span>
            <select value={pill.scope} onChange={e => setPills(pills.map(p => p.value === pill.value ? { ...p, scope: e.target.value as TemporalScope } : p))} style={{ background: 'none', border: 'none', color: 'var(--fg-tertiary)', fontSize: 'var(--fs-10)', fontFamily: 'var(--font-sans)', cursor: 'pointer', padding: 0 }}>
              <option value="ever">ever</option>
              <option value="currently">currently</option>
              <option value="previously">previously</option>
            </select>
          </span>
        )
      })}
    </div>
  )
}

function SearchBuilderInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)

  // ─── Filter state ───────────────────────────────────────────────────────
  type ScopedPill = { value: string; scope: TemporalScope }
  const [rolePills, setRolePills] = useState<ScopedPill[]>([])
  const [specialtyPills, setSpecialtyPills] = useState<ScopedPill[]>([])
  const [seniorityPills, setSeniorityPills] = useState<ScopedPill[]>([])
  // Derived for MultiSelect compat
  const roleSel = rolePills.map(p => p.value)
  const setRoleSel = (vals: string[]) => setRolePills(vals.map(v => rolePills.find(p => p.value === v) || { value: v, scope: 'ever' as TemporalScope }))
  const specialtySel = specialtyPills.map(p => p.value)
  const setSpecialtySel = (vals: string[]) => setSpecialtyPills(vals.map(v => specialtyPills.find(p => p.value === v) || { value: v, scope: 'ever' as TemporalScope }))
  const senioritySel = seniorityPills.map(p => p.value)
  const setSenioritySel = (vals: string[]) => setSeniorityPills(vals.map(v => seniorityPills.find(p => p.value === v) || { value: v, scope: 'ever' as TemporalScope }))
  const [bucketSel, setBucketSel] = useState<string[]>([])
  const [stageSel, setStageSel] = useState<string[]>([])
  const [yearsMin, setYearsMin] = useState('')
  const [yearsMax, setYearsMax] = useState('')
  const [clearanceSel, setClearanceSel] = useState<string[]>([])
  const [locationSel, setLocationSel] = useState<string[]>([])
  // V1 (post-migration 031): two independent scope filters, both default 'all' per Option C.
  const [categoryScope, setCategoryScope] = useState<'all' | 'hardware' | 'non_hardware'>('all')
  const [reviewStatusScope, setReviewStatusScope] = useState<'all' | 'vetted' | 'unreviewed' | 'excluded'>('all')
  const [compoundCompany, setCompoundCompany] = useState<string[]>([])
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
  const [degreeSel, setDegreeSel] = useState<string[]>([])
  const [schoolGroupScope, setSchoolGroupScope] = useState<TemporalScope>('ever')
  const [companyGroupSel, setCompanyGroupSel] = useState<string[]>([])
  const [companyGroupScope, setCompanyGroupScope] = useState<TemporalScope>('ever')
  const [acceleratorSel, setAcceleratorSel] = useState<string[]>([])
  const [currentTenureMin, setCurrentTenureMin] = useState('')
  const [currentTenureMax, setCurrentTenureMax] = useState('')
  const [avgTenureMin, setAvgTenureMin] = useState('')
  const [avgTenureMax, setAvgTenureMax] = useState('')
  const [avgTenureIncludeCurrent, setAvgTenureIncludeCurrent] = useState(true)

  // Condition rows (new model)
  const [companyConditions, setCompanyConditions] = useState<ConditionRow[]>([])
  const [schoolConditions, setSchoolConditions] = useState<ConditionRow[]>([])
  const [companyDefaultScope, setCompanyDefaultScope] = useState<TemporalScope>('currently')
  const [schoolDefaultScope, setSchoolDefaultScope] = useState<TemporalScope>('ever')

  // ─── Options ────────────────────────────────────────────────────────────
  const [roleOptions, setRoleOptions] = useState<MultiSelectOption[]>([])
  const [seniorityOptions, setSeniorityOptions] = useState<MultiSelectOption[]>([])
  const [companyOptions, setCompanyOptions] = useState<MultiSelectOption[]>([])
  const [schoolOptions, setSchoolOptions] = useState<MultiSelectOption[]>([])
  const [specialtyOptions, setSpecialtyOptions] = useState<MultiSelectOption[]>([])
  const [signalOptions, setSignalOptions] = useState<MultiSelectOption[]>([])
  const [schoolGroupOptions, setSchoolGroupOptions] = useState<MultiSelectOption[]>([])
  const [companyGroupOptions, setCompanyGroupOptions] = useState<MultiSelectOption[]>([])
  const [acceleratorOptions, setAcceleratorOptions] = useState<MultiSelectOption[]>([])
  const [industryOptions, setIndustryOptions] = useState<MultiSelectOption[]>([])
  const [categoryFilterOptions, setCategoryFilterOptions] = useState<MultiSelectOption[]>([])
  const [companyNameMap, setCompanyNameMap] = useState<Record<string, string>>({})
  const [schoolNameMap, setSchoolNameMap] = useState<Record<string, string>>({})
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
        fetchAllRows<any>('companies', 'company_id, company_name, primary_industry, industries, category, review_status, legacy_primary_industry_tag, company_groups', 'company_name').then(data => ({ data })),
        fetchAllRows<any>('schools', 'school_id, school_name, school_score, is_foreign, school_groups, school_type', 'school_name').then(data => ({ data })),
        supabase.from('specialty_dictionary').select('specialty_normalized, parent_function').eq('active', true).order('specialty_normalized'),
        supabase.from('person_signals_active').select('signal_id, canonical_name, category').order('confidence', { ascending: false }),
      ])

      setRoleOptions((roles || []).map((r: any) => ({ value: r.role_id, label: r.role_name })))
      setSeniorityOptions((srs || []).map(s => ({ value: s.seniority_normalized, label: s.seniority_normalized.replace(/_/g, ' ') })))
      // V1: include all non-excluded companies (vetted + unreviewed). Excluded are hidden.
      setCompanyOptions((companies || []).filter((c: any) => c.review_status !== 'excluded').map((c: any) => ({
        value: c.company_id,
        label: c.company_name,
        sublabel: c.primary_industry || c.legacy_primary_industry_tag || undefined,
      })))
      setSchoolOptions((schools || []).filter((s: any) => s.school_score != null).map((s: any) => ({ value: s.school_id, label: s.school_name, sublabel: s.is_foreign ? "Int'l" : undefined })))
      setAcceleratorOptions((schools || []).filter((s: any) => s.school_type === 'accelerator').map((s: any) => ({ value: s.school_id, label: s.school_name })))
      setSpecialtyOptions((specs || []).map((d: any) => ({ value: d.specialty_normalized, label: d.specialty_normalized.replace(/_/g, ' '), sublabel: (d.parent_function || '').replace(/_/g, ' ') })))

      // Signal options: category-level + individual
      const SIGNAL_CATEGORY_ORDER = ['founder','incubator','military','national_lab','fellowship','scholarship','academic_distinction','olympiad','competition','hackathon','athletics','engineering_team','student_leadership','greek_life']
      // Full audit: every signal_dictionary.category enum value must have a label.
      const SIGNAL_CATEGORY_LABELS: Record<string, string> = {
        founder:'Founder', incubator:'Incubator', military:'Military', national_lab:'National Lab',
        fellowship:'Fellowship', scholarship:'Scholarship',
        academic_distinction:'Academic', olympiad:'Olympiad',
        publication:'Publication', patent:'Patent', open_source:'Open Source',
        speaking:'Speaking', writing:'Writing',
        competition:'Competition', hackathon:'Hackathon',
        athletics:'Athletics', engineering_team:'Eng. Team', student_leadership:'Leadership', greek_life:'Greek Life',
        career_changer:'Career Changer', self_taught:'Self-Taught',
        teaching:'Teaching', hospitality:'Hospitality',
        language:'Language', other:'Other',
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

      // Name maps + attribute options for condition rows.
      // V1: industry options come from primary_industry, industries[], or fall back
      // to legacy_primary_industry_tag for un-tagged companies.
      const cnMap: Record<string, string> = {}
      const indVals = new Set<string>()
      for (const c of companies || []) {
        cnMap[c.company_id] = c.company_name
        if (c.primary_industry) indVals.add(c.primary_industry)
        if (Array.isArray(c.industries)) for (const i of c.industries) indVals.add(i)
        if (c.legacy_primary_industry_tag) indVals.add(c.legacy_primary_industry_tag)
      }
      setCompanyNameMap(cnMap)
      setIndustryOptions(Array.from(indVals).sort().map(v => ({ value: v, label: v })))
      setCategoryFilterOptions([{ value: 'hardware', label: 'Hardware' }, { value: 'non_hardware', label: 'Non-hardware' }])
      const snMap: Record<string, string> = {}
      for (const s of schools || []) snMap[s.school_id] = s.school_name
      setSchoolNameMap(snMap)

      // Parse incoming filter state from URL
      const raw = searchParams.get('filters')
      if (raw) {
        try {
          const f = JSON.parse(decodeURIComponent(raw))
          if (f.rolePills) setRolePills(f.rolePills)
          else if (f.roleSel) setRoleSel(f.roleSel)
          if (f.specialtyPills) setSpecialtyPills(f.specialtyPills)
          else if (f.specialtySel) setSpecialtySel(f.specialtySel)
          if (f.seniorityPills) setSeniorityPills(f.seniorityPills)
          else if (f.senioritySel) setSenioritySel(f.senioritySel)
          if (f.bucketSel) setBucketSel(f.bucketSel)
          if (f.stageSel) setStageSel(f.stageSel)
          if (f.yearsMin) setYearsMin(f.yearsMin)
          if (f.yearsMax) setYearsMax(f.yearsMax)
          if (f.clearanceSel) setClearanceSel(f.clearanceSel)
          if (f.locationSel) setLocationSel(f.locationSel)
          // V1 backward compat: legacy focusScope=hard_tech maps to categoryScope=hardware.
          if (f.focusScope === 'hard_tech') setCategoryScope('hardware')
          else if (f.focusScope) setCategoryScope('all')
          if (f.categoryScope) setCategoryScope(f.categoryScope)
          if (f.reviewStatusScope) setReviewStatusScope(f.reviewStatusScope)
          // Per-pill scope: new format from ProfileTable
          if (f.compoundCompanyPills && Array.isArray(f.compoundCompanyPills)) {
            setCompoundCompany(f.compoundCompanyPills.map((p: any) => p.value))
            // Use scope from first pill as filter-level scope (search builder doesn't do per-pill yet)
            if (f.compoundCompanyPills.length > 0) setCompoundCompanyScope(f.compoundCompanyPills[0].scope || 'ever')
          } else if (f.compoundCompany) {
            if (Array.isArray(f.compoundCompany)) setCompoundCompany(f.compoundCompany)
            else if (typeof f.compoundCompany === 'string') setCompoundCompany([f.compoundCompany])
            if (f.compoundCompanyScope) setCompoundCompanyScope(f.compoundCompanyScope)
            else if (f.compoundRelationship === 'current') setCompoundCompanyScope('currently')
            else if (f.compoundRelationship === 'previous') setCompoundCompanyScope('previously')
          }
          if (f.compoundSpecialties) setCompoundSpecialties(f.compoundSpecialties)
          if (f.compoundYearMin) setCompoundYearMin(f.compoundYearMin)
          if (f.compoundYearMax) setCompoundYearMax(f.compoundYearMax)
          if (f.schoolSel) setSchoolSel(f.schoolSel)
          if (f.schoolTemporalScope) setSchoolTemporalScope(f.schoolTemporalScope)
          if (f.degreeSel) setDegreeSel(f.degreeSel)
          if (f.titleBoolean) setTitleBoolean(f.titleBoolean)
          if (f.titleBooleanScope) setTitleBooleanScope(f.titleBooleanScope)
          if (f.experienceBoolean) setExperienceBoolean(f.experienceBoolean)
          if (f.signalSel) setSignalSel(f.signalSel)
          if (f.schoolGroupSel) setSchoolGroupSel(f.schoolGroupSel)
          if (f.schoolGroupScope) setSchoolGroupScope(f.schoolGroupScope)
          if (f.companyGroupSel) setCompanyGroupSel(f.companyGroupSel)
          if (f.companyGroupScope) setCompanyGroupScope(f.companyGroupScope)
          if (f.acceleratorSel) setAcceleratorSel(f.acceleratorSel)
          if (f.currentTenureMin) setCurrentTenureMin(f.currentTenureMin)
          if (f.currentTenureMax) setCurrentTenureMax(f.currentTenureMax)
          if (f.avgTenureMin) setAvgTenureMin(f.avgTenureMin)
          if (f.avgTenureMax) setAvgTenureMax(f.avgTenureMax)
          if (typeof f.avgTenureIncludeCurrent === 'boolean') setAvgTenureIncludeCurrent(f.avgTenureIncludeCurrent)
          // Condition rows
          if (f.cc && Array.isArray(f.cc)) setCompanyConditions(f.cc.map((c: any) => compactToCondition(c)))
          if (f.sc && Array.isArray(f.sc)) setSchoolConditions(f.sc.map((c: any) => compactToCondition(c)))
        } catch { /* ignore bad JSON */ }
      }
      setLoading(false)
    }
    load()
  }, [searchParams])

  function runSearch() {
    const state = {
      rolePills, specialtyPills, seniorityPills,
      bucketSel, stageSel, yearsMin, yearsMax, clearanceSel, locationSel, categoryScope, reviewStatusScope,
      compoundCompanyPills: compoundCompany.map(v => ({ value: v, scope: compoundCompanyScope })),
      compoundSpecialties, compoundYearMin, compoundYearMax,
      schoolSel, schoolTemporalScope, degreeSel, titleBoolean, titleBooleanScope, experienceBoolean,
      signalSel, schoolGroupSel, schoolGroupScope, companyGroupSel, companyGroupScope, acceleratorSel,
      currentTenureMin, currentTenureMax, avgTenureMin, avgTenureMax, avgTenureIncludeCurrent,
      cc: companyConditions.map(conditionToCompact),
      sc: schoolConditions.map(conditionToCompact),
    }
    router.push(`/?filters=${encodeURIComponent(JSON.stringify(state))}`)
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64vh', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)', background: 'var(--bg-canvas)' }}>Loading search builder...</div>

  const sectionStyle: React.CSSProperties = { background: 'var(--bg-surface)', borderRadius: 'var(--r-card, 8px)', border: '1px solid var(--border-subtle)', padding: 20 }
  const headingStyle: React.CSSProperties = { fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-medium)' as any, color: 'var(--fg-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--tr-eyebrow)', marginBottom: 12, fontFamily: 'var(--font-sans)' }
  const lblStyle: React.CSSProperties = { display: 'block', fontSize: 'var(--fs-11)', fontWeight: 'var(--fw-medium)' as any, color: 'var(--fg-tertiary)', marginBottom: 2, fontFamily: 'var(--font-sans)' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-button)', fontSize: 'var(--fs-13)', fontFamily: 'var(--font-sans)', background: 'var(--bg-surface)', color: 'var(--fg-primary)' }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', background: 'var(--bg-canvas)', color: 'var(--fg-primary)', fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>
      {/* Header: title + search scope inline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <a href="/" style={{ fontSize: 'var(--fs-13)', color: 'var(--fg-tertiary)', textDecoration: 'none' }}>← Back to results</a>
          <h1 style={{ fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-semibold)' as any, marginTop: 8 }}>Build a Search</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)' }}>Category:</span>
          <select value={categoryScope} onChange={e => setCategoryScope(e.target.value as any)} style={{ padding: '4px 8px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-button)', fontSize: 'var(--fs-12)', fontFamily: 'var(--font-sans)', background: 'var(--bg-surface)', color: 'var(--fg-primary)', cursor: 'pointer' }}>
            <option value="all">All</option>
            <option value="hardware">Hardware</option>
            <option value="non_hardware">Non-hardware</option>
          </select>
          <span style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)', marginLeft: 8 }}>Visibility:</span>
          <select value={reviewStatusScope} onChange={e => setReviewStatusScope(e.target.value as any)} style={{ padding: '4px 8px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-button)', fontSize: 'var(--fs-12)', fontFamily: 'var(--font-sans)', background: 'var(--bg-surface)', color: 'var(--fg-primary)', cursor: 'pointer' }}>
            <option value="all">All companies</option>
            <option value="vetted">Vetted only</option>
            <option value="unreviewed">Unreviewed only</option>
            <option value="excluded">Excluded only</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Who They Are — full width, 2-column grid */}
        <div style={sectionStyle}>
          <div style={headingStyle}>Who They Are</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lblStyle}>Role</label>
              <MultiSelect label="" options={roleOptions} selected={roleSel} onChange={setRoleSel} placeholder="Any role" />
              {rolePills.length > 0 && <PillScopeRow pills={rolePills} setPills={setRolePills} options={roleOptions} />}
            </div>
            <div>
              <label style={lblStyle}>Specialty</label>
              <MultiSelect label="" options={specialtyOptions} selected={specialtySel} onChange={setSpecialtySel} placeholder="Any specialty" />
              {specialtyPills.length > 0 && <PillScopeRow pills={specialtyPills} setPills={setSpecialtyPills} formatLabel={v => v.replace(/_/g, ' ')} />}
            </div>
            <div>
              <label style={lblStyle}>Seniority</label>
              <MultiSelect label="" options={seniorityOptions} selected={senioritySel} onChange={setSenioritySel} placeholder="Any seniority" />
              {seniorityPills.length > 0 && <PillScopeRow pills={seniorityPills} setPills={setSeniorityPills} formatLabel={v => v.replace(/_/g, ' ')} />}
            </div>
            <MultiSelect label="Bucket" options={BUCKET_OPTIONS} selected={bucketSel} onChange={setBucketSel} placeholder="Any bucket" />
            <MultiSelect label="Degree" options={DEGREE_OPTIONS} selected={degreeSel} onChange={setDegreeSel} placeholder="Any degree" />
            <MultiSelect label="Career Stage" options={STAGE_OPTIONS} selected={stageSel} onChange={setStageSel} placeholder="Any stage" />
            <div>
              <label style={lblStyle}>Years of Experience</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="number" min="0" step="0.5" value={yearsMin} onChange={e => setYearsMin(e.target.value)} placeholder="min" style={inputStyle} />
                <span style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)' }}>–</span>
                <input type="number" min="0" step="0.5" value={yearsMax} onChange={e => setYearsMax(e.target.value)} placeholder="max" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={lblStyle}>Current tenure (years)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="number" min="0" step="0.5" value={currentTenureMin} onChange={e => setCurrentTenureMin(e.target.value)} placeholder="min" style={inputStyle} />
                <span style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)' }}>–</span>
                <input type="number" min="0" step="0.5" value={currentTenureMax} onChange={e => setCurrentTenureMax(e.target.value)} placeholder="max" style={inputStyle} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={lblStyle}>Avg tenure (years)</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={avgTenureIncludeCurrent} onChange={e => setAvgTenureIncludeCurrent(e.target.checked)} style={{ accentColor: 'var(--accent-500)' }} />
                  Incl. current
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="number" min="0" step="0.5" value={avgTenureMin} onChange={e => setAvgTenureMin(e.target.value)} placeholder="min" style={inputStyle} />
                <span style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--fs-12)' }}>–</span>
                <input type="number" min="0" step="0.5" value={avgTenureMax} onChange={e => setAvgTenureMax(e.target.value)} placeholder="max" style={inputStyle} />
              </div>
            </div>
            <MultiSelect label="Clearance" options={CLEARANCE_OPTIONS} selected={clearanceSel} onChange={setClearanceSel} placeholder="Any clearance" />
            <MultiSelect label="Location (US)" options={locationOptions} selected={locationSel} onChange={setLocationSel} placeholder="State or city" />
            {signalOptions.length > 0 && (
              <MultiSelect label="Signals" options={signalOptions} selected={signalSel} onChange={setSignalSel} placeholder="Any signal" />
            )}
          </div>
        </div>

        {/* Where They Worked — full width */}
        <div style={sectionStyle}>
          <div style={headingStyle}>Where They Worked</div>
          {companyGroupOptions.length > 0 && (
            <div style={{ marginBottom: 12, maxWidth: 400 }}>
              <MultiSelect label="Company group" options={companyGroupOptions} selected={companyGroupSel} onChange={setCompanyGroupSel} placeholder="Any company group" />
            </div>
          )}
          <ConditionRowList
            rows={companyConditions}
            onChange={setCompanyConditions}
            entityType="company"
            entityOptions={companyOptions}
            entityNameMap={companyNameMap}
            specialtyOptions={specialtyOptions}
            seniorityOptions={seniorityOptions}
            defaultScope={companyDefaultScope}
            onDefaultScopeChange={setCompanyDefaultScope}
            industryOptions={industryOptions}
            categoryOptions={categoryFilterOptions}
            label="Company conditions"
          />
        </div>

        {/* Where They Studied — full width */}
        <div style={sectionStyle}>
          <div style={headingStyle}>Where They Studied</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            {schoolGroupOptions.length > 0 && (
              <div style={{ minWidth: 240, flex: 1, maxWidth: 400 }}>
                <MultiSelect label="School group" options={schoolGroupOptions} selected={schoolGroupSel} onChange={setSchoolGroupSel} placeholder="Any school group" />
              </div>
            )}
            {acceleratorOptions.length > 0 && (
              <div style={{ minWidth: 240, flex: 1, maxWidth: 400 }}>
                <MultiSelect label="Accelerator" options={acceleratorOptions} selected={acceleratorSel} onChange={setAcceleratorSel} placeholder="Any accelerator" />
              </div>
            )}
          </div>
          <ConditionRowList
            rows={schoolConditions}
            onChange={setSchoolConditions}
            entityType="school"
            entityOptions={schoolOptions}
            entityNameMap={schoolNameMap}
            specialtyOptions={[]}
            seniorityOptions={[]}
            defaultScope={schoolDefaultScope}
            onDefaultScopeChange={setSchoolDefaultScope}
            schoolGroupOptions={schoolGroupOptions}
            label="School conditions"
          />
        </div>

        {/* Keyword Search — compact */}
        <div style={{ ...sectionStyle, maxWidth: 500 }}>
          <div style={headingStyle}>Keyword Search</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <ScopeSelector label="Title keywords" value={titleBooleanScope} onChange={setTitleBooleanScope} />
              <input type="text" value={titleBoolean} onChange={e => setTitleBoolean(e.target.value)} placeholder='"staff engineer" OR principal' style={inputStyle} />
            </div>
            <div>
              <label style={lblStyle}>Experience & skills keywords</label>
              <input type="text" value={experienceBoolean} onChange={e => setExperienceBoolean(e.target.value)} placeholder='MATLAB OR Simulink' style={inputStyle} />
              <p style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-tertiary)', marginTop: 4, fontFamily: 'var(--font-sans)' }}>Use AND, OR, NOT, quotes.</p>
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
