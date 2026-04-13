// lib/normalize/index.ts
// Unified export for all normalization modules.

export { normalizeTitle, normalizeForLookup } from './titles';
export type { TitleMatch } from './titles';

export { normalizeDegree, normalizeFieldOfStudy } from './degrees';
export type { DegreeMatch, FieldOfStudyMatch } from './degrees';

export { normalizeEmploymentType } from './employment';
export type { EmploymentTypeNorm, EmploymentTypeMatch } from './employment';
