// lib/scoring/index.ts
// Barrel export for the scoring engine.

export { scoreCandidate, writeBucketAssignment } from './score-candidate';
export type {
  ScoringStage,
  CandidateBucket,
  ScoreComponent,
  ScoreResult,
} from './score-candidate';
