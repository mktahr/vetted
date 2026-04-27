// Condition row types for compound filters (company, school, company group, school group).
//
// Each condition row represents one match against a candidate's experience/education
// trajectory. Rows AND together — a candidate must satisfy ALL rows.

export type TemporalScope = 'ever' | 'currently' | 'previously'

export type ConditionTargetType = 'specific' | 'attributes'

export interface CompanyAttributes {
  stage?: string[]
  focus?: string[]
  foundedAfter?: number
  foundedBefore?: number
  industry?: string[]
}

export interface SchoolAttributes {
  schoolGroups?: string[]
  schoolType?: string[]
}

export interface ConditionRow {
  id: string
  scope: TemporalScope
  target: {
    type: ConditionTargetType
    // For type='specific': one or more entity IDs
    companyIds?: string[]
    schoolIds?: string[]
    // For type='attributes': filter criteria resolved to IDs at query time
    companyAttributes?: CompanyAttributes
    schoolAttributes?: SchoolAttributes
  }
  yearFrom?: number
  yearTo?: number
  specialty?: string
  seniority?: string
}

// Entity context: determines which fields/options are shown in the editor
export type ConditionEntityType = 'company' | 'school'

// URL-compact serialization (short keys, omit defaults/nulls)
export interface CompactConditionRow {
  s: TemporalScope           // scope
  t?: ConditionTargetType    // target type (omit if 'specific')
  c?: string[]               // companyIds
  sc?: string[]              // schoolIds
  ca?: CompanyAttributes     // company attributes
  sa?: SchoolAttributes      // school attributes
  yf?: number                // yearFrom
  yt?: number                // yearTo
  sp?: string                // specialty
  sr?: string                // seniority
}

export function conditionToCompact(row: ConditionRow): CompactConditionRow {
  const compact: CompactConditionRow = { s: row.scope }
  if (row.target.type !== 'specific') compact.t = row.target.type
  if (row.target.companyIds?.length) compact.c = row.target.companyIds
  if (row.target.schoolIds?.length) compact.sc = row.target.schoolIds
  if (row.target.companyAttributes) compact.ca = row.target.companyAttributes
  if (row.target.schoolAttributes) compact.sa = row.target.schoolAttributes
  if (row.yearFrom) compact.yf = row.yearFrom
  if (row.yearTo) compact.yt = row.yearTo
  if (row.specialty) compact.sp = row.specialty
  if (row.seniority) compact.sr = row.seniority
  return compact
}

export function compactToCondition(compact: CompactConditionRow): ConditionRow {
  return {
    id: crypto.randomUUID(),
    scope: compact.s,
    target: {
      type: compact.t || 'specific',
      companyIds: compact.c,
      schoolIds: compact.sc,
      companyAttributes: compact.ca,
      schoolAttributes: compact.sa,
    },
    yearFrom: compact.yf,
    yearTo: compact.yt,
    specialty: compact.sp,
    seniority: compact.sr,
  }
}

// Backward compat: migrate old flat state to condition rows
export function migrateOldCompanyState(
  compoundCompany: string | string[] | undefined,
  compoundCompanyScope: TemporalScope | undefined,
  compoundSpecialties: string[] | undefined,
  compoundYearMin: string | undefined,
  compoundYearMax: string | undefined,
): ConditionRow[] {
  if (!compoundCompany) return []
  const ids = Array.isArray(compoundCompany) ? compoundCompany : [compoundCompany]
  if (ids.length === 0) return []
  const scope = compoundCompanyScope || 'ever'
  // One row per company (each had the same scope in old model)
  return ids.map(id => ({
    id: crypto.randomUUID(),
    scope,
    target: { type: 'specific' as const, companyIds: [id] },
    yearFrom: compoundYearMin ? parseInt(compoundYearMin) : undefined,
    yearTo: compoundYearMax ? parseInt(compoundYearMax) : undefined,
    specialty: compoundSpecialties?.[0],
  }))
}

export function migrateOldSchoolState(
  schoolSel: string[] | undefined,
  schoolTemporalScope: TemporalScope | undefined,
): ConditionRow[] {
  if (!schoolSel || schoolSel.length === 0) return []
  // One row with all schools (old model was OR across selected schools)
  return [{
    id: crypto.randomUUID(),
    scope: schoolTemporalScope || 'ever',
    target: { type: 'specific', schoolIds: schoolSel },
  }]
}

export function migrateOldGroupState(
  groupSel: string[] | undefined,
  groupScope: TemporalScope | undefined,
  entityType: 'company' | 'school',
): ConditionRow[] {
  if (!groupSel || groupSel.length === 0) return []
  if (entityType === 'company') {
    return [{
      id: crypto.randomUUID(),
      scope: groupScope || 'ever',
      target: { type: 'attributes', companyAttributes: { stage: undefined, focus: undefined, industry: undefined } },
      // Groups are stored separately in the old model — we'll handle via companyGroups field
    }]
  }
  return [{
    id: crypto.randomUUID(),
    scope: groupScope || 'ever',
    target: { type: 'attributes', schoolAttributes: { schoolGroups: groupSel } },
  }]
}
