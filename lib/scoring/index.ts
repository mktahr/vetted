// lib/scoring/index.ts
// Barrel export for the scoring engine.

export { scoreCandidate, writeBucketAssignment } from './score-candidate';
export type {
  ScoringStage,
  CandidateBucket,
  ScoreComponent,
  ScoreResult,
  ScoreBreakdown,
} from './score-candidate';

export { computeDerivedFields, computeAndWriteDerivedFields } from './compute-derived';
export type { DerivedFields } from './compute-derived';
