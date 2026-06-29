// lib/network/config.ts
//
// Tunable constants for the network module.

// Estimated Crust credits per single-profile /person/enrich call. Used ONLY for
// the pre-spend admin estimate and the post-run "estimated credits" readout — it
// is NOT observed billing (we compute from attempted records, and we don't yet
// know whether Crust bills unmatched requests). Set conservatively to 3 (Matt's
// contract CSV rate in docs/crust/07) rather than the public-docs "1 base" so the
// estimate never UNDER-reports before a bulk enrich. We're on a test key with no
// signed contract; set the real rate once the contract lands. See docs/crust/05
// for the unresolved 1-vs-3 discrepancy.
export const CREDITS_PER_ENRICH = 3;

// LinkedIn CSV import guardrails (mirrors the Crust import caps' intent).
export const HARD_ROW_CAP = 50000;

// Enrichment cache freshness. A cached enrichment is reused (free) only if it
// was enriched within this many days; older hits are treated as stale and
// re-enriched so we don't serve years-old work history. Profiles change slowly,
// so this is deliberately generous to protect spend — tune against real billing.
// (Matt's "enriched 2 weeks ago -> don't re-pay" sits comfortably inside this.)
export const STALE_AFTER_DAYS = 90;
