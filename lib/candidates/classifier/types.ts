// lib/candidates/classifier/types.ts

/** One experience handed to the classifier (current stored state). */
export interface ExperienceForClassification {
  person_experience_id: string;
  company_name: string | null;
  title_raw: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description_raw: string | null;
}

/** Active controlled vocabulary the classifier is constrained to. */
export interface ActiveVocab {
  functions: string[];
  specialties: string[];
  skills: string[];
  /** Short hash of the sorted vocab — part of run provenance + a re-classify trigger. */
  version: string;
}

/** Per-experience five-axis tuple the LLM emits (and we publish). */
export interface ClassificationTuple {
  exp_id: string;
  function_inferred: string[];          // ordered, position 0 = primary, non-empty
  specialty_inferred: string[];         // ordered, position 0 = primary (may be empty)
  skills_inferred: string[];            // set (may be empty)
  title_normalized_inferred: string;    // cleaned canonical title
}

/** Raw model output shape (before validation). */
export interface ClassifierRawOutput {
  assignments: ClassificationTuple[];
}

export interface ClaudeCallResult {
  output: ClassifierRawOutput | null;
  rawText: string;
  inputTokens: number;
  outputTokens: number;
  error?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  tuples: ClassificationTuple[];
}

export type ClassifyAction =
  | 'committed'   // published successfully
  | 'capped'      // spend cap hit — released to pending, try later
  | 'failed'      // classifier produced an unusable result after retry (burns budget)
  | 'discarded'   // contention / infra (re-ingest, lease lost, network) — no budget burn
  | 'skipped'     // not eligible to claim
  | 'noop';       // nothing to classify (no experiences)

export interface ClassifyOutcome {
  personId: string;
  action: ClassifyAction;
  reason?: string;
  runId?: string;
  tokens?: number;
}

export interface ClassifyBatchSummary {
  attempted: number;
  committed: number;
  capped: number;
  failed: number;
  discarded: number;
  skipped: number;
  noop: number;
  results: ClassifyOutcome[];
}
