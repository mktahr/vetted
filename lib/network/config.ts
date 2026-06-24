// lib/network/config.ts
//
// Tunable constants for the network module.

// Estimated Crust credits per single-profile /person/enrich call. Placeholder
// used for the pre-spend cost estimate; reconcile against real billing in the
// enrichment commit (Crust person-enrich add-on cost model, docs/crust/07).
export const CREDITS_PER_ENRICH = 1;

// LinkedIn CSV import guardrails (mirrors the Crust import caps' intent).
export const HARD_ROW_CAP = 50000;
