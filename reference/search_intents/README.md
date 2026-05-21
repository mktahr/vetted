# Search Intents

Maps high-level recruiter search intents (e.g. "founder potential") to the signal_dictionary categories that carry weight for that intent. The **AI chat search workstream (deferred, not building now)** will consume these at query time to bias result ranking toward signal-matched candidates.

## intent_signal_map.csv schema (v1)

| Column | Notes |
|---|---|
| `intent` | slug — `founder_potential`, `founding_engineer_potential`, `ai_researcher`, `hardware_builder`, `deep_tech_research`, … |
| `category` | one of the signal_dictionary categories |
| `weight` | integer; higher = more weight for that category under this intent |
| `notes` | freeform; used today to express constraints the v1 schema can't yet encode (e.g. "subcategory filter needed at runtime") |

## v1 schema limitations (planned extensions for the AI chat workstream)

The current 4-column shape is intentionally simple. Known extensions the AI chat search workstream will likely need:

- **Subcategory targeting** — e.g. `founder_potential` cares about `fellowship` with `subcategory='operator_track'` only, not all fellowships. Today this lives in the `notes` column and must be applied at runtime by the consuming code.
- **Tier-weighted multipliers** — `tier_3` signals likely carry more weight than `tier_1` under any given intent. Could be a separate column or a multiplier convention.
- **Per-stage modulation** — `founder_potential` weights may differ for `pre_career` vs `senior_career` candidates.
- **Multi-signal interaction** — bonus when a candidate matches several categories under the same intent.

Defer extending the schema until the AI chat workstream has concrete ranking requirements. The notes column is the escape hatch for v1.

## Loading

This CSV is **NOT loaded into the DB today.** It's reference-only — meant to be read by the future AI chat search runtime (or a server-side scoring extension). When that workstream picks it up, the loading mechanism will be designed alongside.
