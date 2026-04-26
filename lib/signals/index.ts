// lib/signals/index.ts — barrel exports

export { loadSignalDictionary, extractSignalsFromText, refreshDictionary } from './extractPatterns'
export type { PatternMatch } from './extractPatterns'
export { processCandidateSignals } from './processCandidate'
export type { ProcessResult } from './processCandidate'
