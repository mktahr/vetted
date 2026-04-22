// lib/normalize/index.ts
// Unified export for all normalization modules.

export { normalizeTitle, normalizeForLookup } from './titles';
export type { TitleMatch } from './titles';

export { normalizeDegree, normalizeFieldOfStudy } from './degrees';
export type { DegreeMatch, FieldOfStudyMatch } from './degrees';

export { normalizeEmploymentType } from './employment';
export type { EmploymentTypeNorm, EmploymentTypeMatch } from './employment';

export { loadTitleLevelRules, extractTitleLevel, extractTitleLevelFromDB } from './title-level';
export type { TitleLevelRule } from './title-level';

export { loadSpecialtyDictionary, resolveSpecialty, aggregatePersonSpecialties } from './specialty';
export type { SpecialtyDictionaryEntry, SpecialtyMatch, PersonSpecialties } from './specialty';

export {
  loadSeniorityRules,
  resolveSeniority,
  resolveSeniorityFromRules,
  matchesRule,
  graduationDateFromEducation,
} from './seniority';
export type {
  SeniorityLevel,
  SeniorityMatchType,
  SeniorityRule,
  SeniorityContext,
} from './seniority';
