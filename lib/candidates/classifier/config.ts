// lib/candidates/classifier/config.ts
//
// Tunables for the five-axis classify-pending job (sub-PR 3).

export const CLASSIFIER_MODEL = 'claude-haiku-4-5';

// Bumped when the prompt OR output contract changes — part of the run provenance
// and a re-classification trigger (a version change makes done rows eligible again,
// surfaced by re-queueing on deploy if desired). Keep in sync with prompt.ts.
export const PROMPT_VERSION = 'cls-2026-06-30b';

// Lease must exceed the worst case: two Haiku calls (initial + one validation
// retry) + the commit round-trip. 5 min is comfortably above that; a too-short
// lease only causes a wasted reclaim (the generation fence prevents corruption).
export const LEASE_MINUTES = 5;

// Failed-retry budget. Only the classifier producing an unusable result (invalid
// after one retry) increments failure_count; infra/DB errors discard without
// burning budget. A candidate at MAX_FAILURES stops being auto-eligible.
export const MAX_FAILURES = 3;

// One validation retry (feed the errors back), then fail.
export const MAX_VALIDATION_RETRIES = 1;

// Spend cap (mirrors the company tagger's $10/day). Reserved BEFORE each call via
// reserve_classification_spend(); a conservative over-estimate throttles early but
// never exceeds the cap.
export const EST_CENTS_PER_CALL = 1; // ~rounded up; reconcile-to-actual deferred
export const MAX_DAILY_CENTS = 1000;

// Over-context guard: if the serialized prompt input exceeds this, FAIL CLEANLY
// (never silently truncate experiences/descriptions and publish a partial result).
export const MAX_INPUT_CHARS = 80000;
