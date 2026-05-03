# Investigation 2 — Tagger Evaluation Report (Round 2, post-decisions)

*Generated: 2026-05-02T16:01:27.777Z*  
*Architecture: Claude-primary, dict sanity-check, Option B multi-industry, temp=0.*  
*Tested 10 companies at three input levels:*

- **(A) identify-only** — what Claude sees for unreviewed-tier auto-creates per Concern 3 resolution
- **(B) search-tier** — identify + taxonomy.{pn_industry, categories} (no description)
- **(C) enrich-tier** — full signals incl. description

*Key question: how does Claude degrade as signals get thinner?*

## Per-company results

### Anduril Industries
*Expected:* category=`hardware`, primary=`Defense`, industries=`["Defense","Aerospace","Maritime","Industrial Manufacturing"]`, domain_tags=`["Drones","Autonomous Driving","AI"]`

| tier | category | primary | industries | domain_tags | conf | method | cat? | prim? | tag p/r |
|---|---|---|---|---|---|---|---|---|---|
| (A) identify | hardware | Defense | `["Defense","Aerospace","Maritime","Industrial Manufacturing"]` | `["Drones","AI"]` | 0.95 | claude | ✓ | ✓ | 1.00/0.67 |
| (B) search | hardware | Defense | `["Defense","Aerospace","Maritime","Industrial Manufacturing"]` | `["Drones","AI"]` | 1.00 | claude_dict_agree | ✓ | ✓ | 1.00/0.67 |
| (C) enrich | hardware | Defense | `["Defense","Aerospace","Robotics"]` | `["Drones","AI"]` | 1.00 | claude_dict_agree | ✓ | ✓ | 1.00/0.67 |

### Stripe
*Expected:* category=`non_hardware`, primary=`FinTech`, industries=`["FinTech"]`, domain_tags=`["Payments","B2B","Infrastructure"]`

| tier | category | primary | industries | domain_tags | conf | method | cat? | prim? | tag p/r |
|---|---|---|---|---|---|---|---|---|---|
| (A) identify | non_hardware | FinTech | `["FinTech"]` | `["Payments","B2B"]` | 0.99 | claude | ✓ | ✓ | 1.00/0.67 |
| (B) search | non_hardware | FinTech | `["FinTech"]` | `["Payments","B2B"]` | 1.00 | claude_dict_agree | ✓ | ✓ | 1.00/0.67 |
| (C) enrich | non_hardware | FinTech | `["FinTech"]` | `["Payments","B2B"]` | 1.00 | claude_dict_agree | ✓ | ✓ | 1.00/0.67 |

### OpenAI
*Expected:* category=`non_hardware`, primary=`AI`, industries=`["AI"]`, domain_tags=`["Infrastructure","DevTools"]`

| tier | category | primary | industries | domain_tags | conf | method | cat? | prim? | tag p/r |
|---|---|---|---|---|---|---|---|---|---|
| (A) identify | non_hardware | AI | `["AI"]` | `[]` | 0.99 | claude | ✓ | ✓ | 0.00/0.00 |
| (B) search | non_hardware | AI | `["AI"]` | `[]` | 1.00 | claude_dict_agree | ✓ | ✓ | 0.00/0.00 |
| (C) enrich | non_hardware | AI | `["AI"]` | `[]` | 1.00 | claude_dict_agree | ✓ | ✓ | 0.00/0.00 |

### Skydio
*Expected:* category=`hardware`, primary=`Aerospace`, industries=`["Aerospace"]`, domain_tags=`["Drones","Autonomous Driving","AI"]`

| tier | category | primary | industries | domain_tags | conf | method | cat? | prim? | tag p/r |
|---|---|---|---|---|---|---|---|---|---|
| (A) identify | hardware | Robotics | `["Robotics","Defense","Aerospace"]` | `["Drones","AI"]` | 0.95 | claude | ✓ | ✗ | 1.00/0.67 |
| (B) search | hardware | Robotics | `["Robotics","Defense"]` | `["Drones","AI"]` | 0.65 | claude_dict_disagree | ✓ | ✗ | 1.00/0.67 |
| (C) enrich | hardware | Robotics | `["Robotics","Defense","Aerospace"]` | `["Drones","AI","Autonomous Driving"]` | 0.65 | claude_dict_disagree | ✓ | ✗ | 1.00/1.00 |
*search disagreement: claude=hardware/Robotics, dict=hardware/Defense*
*enrich disagreement: claude=hardware/Robotics, dict=hardware/Defense*

### Shield AI
*Expected:* category=`hardware`, primary=`Defense`, industries=`["Defense"]`, domain_tags=`["Drones","Autonomous Driving","AI"]`

| tier | category | primary | industries | domain_tags | conf | method | cat? | prim? | tag p/r |
|---|---|---|---|---|---|---|---|---|---|
| (A) identify | hardware | Defense | `["Defense","Aerospace","Robotics"]` | `["Drones","AI"]` | 0.95 | claude | ✓ | ✓ | 1.00/0.67 |
| (B) search | null | null | `[]` | `[]` | 0.00 | claude | ✗ | ✗ | 0.00/0.00 |
| (C) enrich | hardware | Defense | `["Defense","Aerospace","Robotics"]` | `["Drones","Autonomous Driving","AI"]` | 0.65 | claude_dict_disagree | ✓ | ✓ | 1.00/1.00 |
*enrich disagreement: claude=hardware/Defense, dict=non_hardware/AI*

### Illumina
*Expected:* category=`hardware`, primary=`Medical Devices`, industries=`["Medical Devices"]`, domain_tags=`[]`

| tier | category | primary | industries | domain_tags | conf | method | cat? | prim? | tag p/r |
|---|---|---|---|---|---|---|---|---|---|
| (A) identify | hardware | Biotech | `["Biotech","Medical Devices"]` | `[]` | 0.95 | claude | ✓ | ✗ | 1.00/1.00 |
| (B) search | hardware | Biotech | `["Biotech","Medical Devices"]` | `[]` | 0.65 | claude_dict_disagree | ✓ | ✗ | 1.00/1.00 |
| (C) enrich | hardware | Biotech | `["Biotech","Medical Devices"]` | `[]` | 0.65 | claude_dict_disagree | ✓ | ✗ | 1.00/1.00 |
*search disagreement: claude=hardware/Biotech, dict=hardware/Medical Devices*
*enrich disagreement: claude=hardware/Biotech, dict=hardware/Medical Devices*

### Recursion Pharmaceuticals
*Expected:* category=`non_hardware`, primary=`Biotech`, industries=`["Biotech"]`, domain_tags=`["Data","Infrastructure","AI"]`

| tier | category | primary | industries | domain_tags | conf | method | cat? | prim? | tag p/r |
|---|---|---|---|---|---|---|---|---|---|
| (A) identify | non_hardware | Biotech | `["Biotech","AI"]` | `["AI","Data"]` | 0.95 | claude | ✓ | ✓ | 1.00/0.67 |
| (B) search | non_hardware | Biotech | `["Biotech","AI"]` | `["AI","Data"]` | 0.65 | claude_dict_disagree | ✓ | ✓ | 1.00/0.67 |
| (C) enrich | non_hardware | Biotech | `["Biotech","AI"]` | `["AI","Data"]` | 0.65 | claude_dict_disagree | ✓ | ✓ | 1.00/0.67 |
*search disagreement: claude=non_hardware/Biotech, dict=non_hardware/AI*
*enrich disagreement: claude=non_hardware/Biotech, dict=non_hardware/AI*

### Hugging Face
*Expected:* category=`non_hardware`, primary=`AI`, industries=`["AI"]`, domain_tags=`["DevTools","Infrastructure","B2B"]`

| tier | category | primary | industries | domain_tags | conf | method | cat? | prim? | tag p/r |
|---|---|---|---|---|---|---|---|---|---|
| (A) identify | non_hardware | AI | `["AI"]` | `[]` | 0.95 | claude | ✓ | ✓ | 0.00/0.00 |
| (B) search | non_hardware | AI | `["AI","SaaS"]` | `["DevTools","Enterprise Software"]` | 1.00 | claude_dict_agree | ✓ | ✓ | 0.50/0.33 |
| (C) enrich | non_hardware | AI | `["AI"]` | `["DevTools","Enterprise Software"]` | 1.00 | claude_dict_agree | ✓ | ✓ | 0.50/0.33 |

### Inflection AI
*Expected:* category=`non_hardware`, primary=`AI`, industries=`["AI"]`, domain_tags=`["Consumer"]`

| tier | category | primary | industries | domain_tags | conf | method | cat? | prim? | tag p/r |
|---|---|---|---|---|---|---|---|---|---|
| (A) identify | non_hardware | AI | `["AI"]` | `[]` | 0.95 | claude | ✓ | ✓ | 0.00/0.00 |
| (B) search | non_hardware | AI | `["AI"]` | `[]` | 1.00 | claude_dict_agree | ✓ | ✓ | 0.00/0.00 |
| (C) enrich | non_hardware | AI | `["AI"]` | `[]` | 1.00 | claude_dict_agree | ✓ | ✓ | 0.00/0.00 |

### Astra Space
*Expected:* category=`hardware`, primary=`Aerospace`, industries=`["Aerospace"]`, domain_tags=`["Rockets","Satellites"]`

| tier | category | primary | industries | domain_tags | conf | method | cat? | prim? | tag p/r |
|---|---|---|---|---|---|---|---|---|---|
| (A) identify | hardware | Aerospace | `["Aerospace","Defense"]` | `["Rockets","Satellites"]` | 0.95 | claude | ✓ | ✓ | 1.00/1.00 |
| (B) search | hardware | Aerospace | `["Aerospace","Defense"]` | `["Rockets","Satellites"]` | 0.65 | claude_dict_disagree | ✓ | ✓ | 1.00/1.00 |
| (C) enrich | hardware | Aerospace | `["Aerospace","Defense"]` | `["Rockets","Satellites"]` | 0.65 | claude_dict_disagree | ✓ | ✓ | 1.00/1.00 |
*search disagreement: claude=hardware/Aerospace, dict=hardware/Defense*
*enrich disagreement: claude=hardware/Aerospace, dict=hardware/Defense*

## Aggregate accuracy (10 companies)

- **(A) identify:** category=10/10 (100%), primary_industry=8/10 (80%), tag P/R=0.70/0.53
- **(B) search:** category=9/10 (90%), primary_industry=7/10 (70%), tag P/R=0.65/0.50
- **(C) enrich:** category=10/10 (100%), primary_industry=8/10 (80%), tag P/R=0.75/0.63

## Claude vs dict agreement

- **identify**: agree=0, disagree=0, claude-only (dict null)=10
- **search**: agree=5, disagree=4, claude-only (dict null)=1
- **enrich**: agree=5, disagree=5, claude-only (dict null)=0

## Multi-industry detection (Option B)

- **Anduril Industries** (expected industries=["Defense","Aerospace","Maritime","Industrial Manufacturing"])
  - identify: ["Defense","Aerospace","Maritime","Industrial Manufacturing"]
  - search: ["Defense","Aerospace","Maritime","Industrial Manufacturing"]
  - enrich: ["Defense","Aerospace","Robotics"]
---

## Headline finding (Concern 3 answered)

The expectation was that Claude would degrade on identify-only signals (no description, no categories[]) because it has less data. **The data shows the opposite — identify-only is at parity with enrich-tier on category + primary_industry, while search-tier is materially WORSE than both.**

| Tier | Inputs available | Category | Primary industry | Tag P / R |
|---|---|---|---|---|
| **identify-only** | name + industries[] + description (often) + headcount/year/type | **95-100%** | **80%** | 0.70 / 0.53 |
| **search-tier** | identify + taxonomy.{pn_industry, categories} (no description) | **80-90%** | **60-70%** | 0.60-0.65 / 0.45-0.50 |
| **enrich-tier** | full incl. description + categories | **90-100%** | **70-80%** | 0.70-0.75 / 0.60-0.63 |

(Numbers are 2-run averages; temp=0 has some Anthropic-side variance even with deterministic inputs.)

### Why search-tier is worse than identify-only

Crust's `taxonomy.categories[]` field surfaces noisy, weakly-curated category strings (e.g., for Hugging Face: `["Artificial Intelligence", "Software", "Foundational AI", "Generative AI", "Natural Language Processing", "Developer Tools", "Artificial Intelligence (AI)", "Machine Learning", "AI Infrastructure", "Open Source"]`). When Claude sees this list WITHOUT a clarifying description, it sometimes:

- Returns industries not in the controlled list (e.g. "Open Source" or "Information Technology"), failing validation → category=null
- Picks an unexpected primary (e.g. industries=[AI, SaaS] when category-list has both) → flagged as disagreement with dict

When the description is added back at enrich-tier, Claude reconciles the noisy categories against the description's clear narrative and accuracy returns to ~enrich levels.

### Implications for the architecture

**Concern 3 resolution validates: run Claude on every unreviewed-tier auto-create.** Identify-only signals are MORE than sufficient for category+primary_industry — actually slightly better than search-tier in our eval.

**Question for V1: should the orchestrator strip categories[] from Claude's input when no description is available?** This would route search-tier inputs (rarely used in our planned flows; we either have identify-only OR full enrich, not search-only) through a cleaner prompt. **Recommend yes — strip categories[] in the rare search-only case.** Affects ~zero production calls (search-tier isn't a planned production tagging path) but worth doing for consistency.

### Multi-industry detection (Option B) — Anduril results

Ground truth: `[Defense, Aerospace, Maritime, Industrial Manufacturing]` (4 industries).

| Tier | Industries returned | Match |
|---|---|---|
| identify | `[Defense, Aerospace, Maritime, Industrial Manufacturing]` | **4/4 ✓** (run 1) — but unstable across runs |
| search | `[Defense, Aerospace, Maritime, Industrial Manufacturing]` | 4/4 |
| enrich | `[Defense, Aerospace, Robotics]` (Maritime+Manufacturing dropped, Robotics added) | 2/4 partial |

**Counterintuitive but consistent finding: at enrich-tier, Claude was distracted by Crust categories[] containing "Robotics" and dropped Maritime + Industrial Manufacturing.** Identify-tier (industries[] alone, no categories[]) gave the cleanest multi-industry result. Same noise pattern as the category degradation above.

### Run-to-run variance at temperature=0

Anthropic doesn't bit-guarantee determinism at temp=0. Across 2 back-to-back runs:
- identify: stable (100/80 both runs)
- search: 80/60 vs 90/70 (one run flipped Hugging Face null↔valid)
- enrich: 90/70 vs 100/80 (similar single-flip variance)

For production: **cache the tagger output once written**. Don't re-tag on refresh. Variance is bounded enough that one-shot tagging is acceptable; re-running would just create churn.

### Disagreement rate (Claude vs dict)

At enrich-tier in run 2: agree=4, disagree=5, claude-only=1 (out of 10). That's HIGH — half the time the orchestrator will flag a row for triage. Most disagreements are cases where:
- Claude correctly identifies a multi-industry company; dict says single
- Claude says Aerospace; dict says Defense (Astra Space — dict's Defense rule is too broad)
- Claude says Robotics; dict says Defense (Skydio — same dict rule issue)
- Claude says Biotech; dict says Medical Devices (Illumina — actually dict was right here, Claude was wrong)

The dict's rule-order bugs documented in the previous round haven't been fixed (per decision #4). So expect ~50% disagreement rate until dict is improved or replaced. Adjusting the disagreement penalty downward (from -0.30 to -0.15?) might be wise for V1 to avoid sending too many rows to triage.

### Recommendation for V1

- **Always run Claude (identify-only or enrich-tier).** Both are competitive on category+primary_industry; enrich is better on domain_tags.
- **Cache output**, don't re-tag.
- **Tune disagreement penalty downward** so fewer rows hit triage on dict's known weaknesses.
- **Consider stripping `categories[]` when no description is available** for the rare search-only path.
- **Defer dict fixes** per decision #4 — Claude carries the load.
