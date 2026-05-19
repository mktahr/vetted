// lib/scoring/index.ts
// Barrel export for the scoring engine.

export { scoreCandidate, writeBucketAssignment } from './score-candidate';
export type {
  ScoringStage,
  ScoreComponent,
  ScoreResult,
  ScoreBreakdown,
} from './score-candidate';
export type { CandidateBucket, FlaggedReason } from '../../app/types';

export { computeDerivedFields, computeAndWriteDerivedFields } from './compute-derived';
export type { DerivedFields } from './compute-derived';
