# Targeted Expansion Eval (28 companies + Anduril Maritime check)

*Generated: 2026-05-03T16:00:53.285Z*  
*Architecture: Claude-primary + dict sanity check, Option B multi-industry, dict fixes E1+E2.1+E3+M2 + Claude fixes C1 (prompt tightening) + C2 (forgiving validator) + 3 ground-truth corrections.*  
*Tiers tested: identify-only, enrich-tier. Search-tier skipped (inv2 round-2 showed it's worse than identify due to noisy categories).*

## Headlines (round-3 — after C1 + C2 + GT fixes)

**Major lift across the board.** Aggregate accuracy at enrich-tier moved from 81% category / 74% primary (round-2) to **100% category / 93% primary** (round-3). All 5 previously-nulled Claude outputs (Cerebras, Tenstorrent, Hadrian, Apple, Palantir) now return valid, correct verdicts.

### Round-3 vs Round-2 (enrich-tier)

| Metric | Round-2 | Round-3 | Δ |
|---|---|---|---|
| Category accuracy | 81% (22/27) | **100% (27/27)** | +19 pp |
| Primary-industry accuracy | 74% (20/27) | **93% (25/27)** | +19 pp |
| Claude-null rate | 19% (5/27) | **0%** | −19 pp |
| Dict-Claude agreement (when dict committed) | ~50% | **60% (12/20)** | +10 pp |
| Dict-Claude disagreement | ~30% | **40% (8/20)** | (Claude won 7/8) |

### Identify-tier (unreviewed-tier auto-create simulation)

- **Category 100%, primary 96%** (only miss: Climeworks → Energy)
- **Dict abstains 100%** — same architectural insight as round-2: dict provides zero sanity-check value at identify-tier. The cron-driven async tagger relies on Claude alone for unreviewed-tier auto-creates.

### Real Claude failures (enrich-tier — 2/27 = 7.4%)

1. **Climeworks** — expected `Climate`, got `Energy`. Claude treats DAC (direct air capture) as energy infrastructure rather than climate-tech. Defensible domain confusion; not systemic.
2. **Saildrone** — expected `Maritime`, got `Defense`. Claude over-indexed on Saildrone's military customer base (USVs sold to Navy/NOAA) over the company's primary platform. Both Claude and dict miss this — see Disagreements section.

Both failures are domain-edge cases, not validator/prompt bugs. **Not proposing additional fixes** — would risk over-fitting on 2 cases.

### Critical wins to call out

- **Anduril Maritime industry NOW FIRES at enrich-tier** (was failing in round-2). Multi-industry multi-element output: `[Defense, Aerospace, Maritime, Industrial Manufacturing]` — exactly the round-2 spec.
- **Notion AI-suppression test passes**: `domain_tags=[Productivity, B2B, Enterprise Software]`, no AI tag despite Notion having AI features.
- **Scale AI / Mercor AI-industry-self-suppression**: both correctly omit `AI` from `domain_tags` when industry is already AI.
- **Apple, Cerebras, Tenstorrent, Hadrian, Palantir** — all 5 round-2 nulls now correctly classified.
- **Out-of-scope flags work as designed**: SpaceX (Telecom gap → Aerospace primary), John Deere (Agriculture gap → Industrial Manufacturing), Notion (no false AI tag).

### Dictionary value confirmed at enrich-tier only

Of 8 disagreements at enrich-tier: Claude won 7 (correct), both wrong on 1 (Saildrone). Dictionary still adds triage signal (lowering confidence on disagreement) but never overrides Claude. Architecture validated.

### Decision: proceed to 50-100 eval

Accuracy is comfortably in "reasonable range" per the agreed threshold (100% category, 93% primary, 0% Claude-null, 7.4% real failure rate). Per Matt's instruction, proceeding directly to larger eval — no additional targeted rounds.

The 50-100 sample needs to be sourced before the pull (one $5-10 Crust credit hit). I'll draft a stratified list for Matt's review before pulling — see "What I need from Matt" at end.

---


## Aggregate accuracy (27 companies)

- **(A) identify:** category=27/27 (100%), primary_industry=26/27 (96%), industries[] P/R=0.76/0.96, domain_tag P/R=0.78/0.85
- **(B) enrich:** category=27/27 (100%), primary_industry=25/27 (93%), industries[] P/R=0.76/0.96, domain_tag P/R=0.77/0.85

## Dict abstention + agreement (the question on dict's value)

- **identify-tier:**
  - Dict abstained (null): 27/27 (100%)
  - Dict committed: 0/27
    - agree with Claude: 0/0 (0%)
    - disagree with Claude: 0/0 (0%)
    - Note: agreement values include 'claude_only' when dict null. claude_only count: 27.
- **enrich-tier:**
  - Dict abstained (null): 7/27 (26%)
  - Dict committed: 20/27
    - agree with Claude: 12/20 (60%)
    - disagree with Claude: 8/20 (40%)
    - Note: agreement values include 'claude_only' when dict null. claude_only count: 7.

## Accuracy by company maturity (enrich-tier only)

- **well-known** (9 cos): cat=9/9 (100%), primary=9/9 (100%), tag P/R=0.84/0.92
- **mid-tier** (9 cos): cat=9/9 (100%), primary=7/9 (78%), tag P/R=0.70/0.76
- **early-stage** (9 cos): cat=9/9 (100%), primary=9/9 (100%), tag P/R=0.78/0.89

## Accuracy by single vs multi-industry (enrich-tier)

- **single** (17 cos): cat=17/17 (100%), primary=15/17 (88%), industries[] P/R=0.72/1.00
- **multi-industry** (10 cos): cat=10/10 (100%), primary=10/10 (100%), industries[] P/R=0.82/0.90

## Anduril Industries — Maritime industry firing check (re-tag from inv1 raw)

*Confirms E2.1 dict refinement didn't break Anduril's defense classification, AND that Maritime appears as a secondary industry under Option B (multi-industry).*

- **identify-tier:** category=hardware, primary=Defense, industries=`["Defense","Aerospace","Maritime","Industrial Manufacturing"]`, domain_tags=`["Drones","AI"]`
  - Maritime in industries: ✓ YES
  - method: claude, agreement: claude_only
- **enrich-tier:** category=hardware, primary=Defense, industries=`["Defense","Aerospace","Maritime","Industrial Manufacturing"]`, domain_tags=`["Drones","AI"]`
  - Maritime in industries: ✓ YES
  - method: claude_dict_agree, agreement: agree

## Per-company results (enrich-tier)

| Company | Tier | Sub | Expected primary | Got primary | Cat? | Pri? | dict_verdict | agreement | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Tesla | well-known | multi-industry | Automotive | Automotive | ✓ | ✓ | `hardware/Energy` | disagree |  |
| Rivian | well-known | single | Automotive | Automotive | ✓ | ✓ | `hardware/Automotive` | agree |  |
| Slate Auto | early-stage | single | Automotive | Automotive | ✓ | ✓ | `hardware/Automotive` | agree | ? amb |
| Boston Dynamics | well-known | single | Robotics | Robotics | ✓ | ✓ | `null/null` | claude_only |  |
| Figure AI | mid-tier | multi-industry | Robotics | Robotics | ✓ | ✓ | `hardware/Robotics` | agree |  |
| 1X Technologies | early-stage | single | Robotics | Robotics | ✓ | ✓ | `hardware/Robotics` | agree | ? amb |
| Form Energy | mid-tier | single | Energy Storage | Energy Storage | ✓ | ✓ | `hardware/Energy` | disagree |  |
| Commonwealth Fusion Systems | mid-tier | single | Energy | Energy | ✓ | ✓ | `null/null` | claude_only |  |
| Antora Energy | early-stage | single | Energy Storage | Energy Storage | ✓ | ✓ | `hardware/Energy` | disagree |  |
| Climeworks | mid-tier | single | Climate | Energy | ✓ | ✗ | `null/null` | claude_only |  |
| Heirloom Carbon | early-stage | single | Climate | Climate | ✓ | ✓ | `null/null` | claude_only |  |
| NVIDIA | well-known | multi-industry | Semiconductors | Semiconductors | ✓ | ✓ | `non_hardware/AI` | disagree |  |
| Cerebras | mid-tier | single | Semiconductors | Semiconductors | ✓ | ✓ | `hardware/Semiconductors` | agree |  |
| Tenstorrent | early-stage | single | Semiconductors | Semiconductors | ✓ | ✓ | `null/null` | claude_only |  |
| Apple | well-known | multi-industry | Consumer Electronics | Consumer Electronics | ✓ | ✓ | `non_hardware/AI` | disagree | ⚠ OOS |
| Humane | early-stage | single | Consumer Electronics | Consumer Electronics | ✓ | ✓ | `null/null` | claude_only |  |
| Hadrian | early-stage | single | Industrial Manufacturing | Industrial Manufacturing | ✓ | ✓ | `hardware/Industrial Manufacturing` | agree | ⚠ OOS |
| John Deere | well-known | multi-industry | Industrial Manufacturing | Industrial Manufacturing | ✓ | ✓ | `hardware/Industrial Manufacturing` | agree | ⚠ OOS |
| Boom Supersonic | mid-tier | multi-industry | Aerospace | Aerospace | ✓ | ✓ | `hardware/Aerospace` | agree |  |
| Saildrone | mid-tier | single | Maritime | Defense | ✓ | ✗ | `hardware/Aerospace` | disagree |  |
| SpaceX | well-known | multi-industry | Aerospace | Aerospace | ✓ | ✓ | `hardware/Defense` | disagree | ⚠ OOS |
| Stoke Space | early-stage | single | Aerospace | Aerospace | ✓ | ✓ | `hardware/Aerospace` | agree | ? amb |
| Palantir | well-known | multi-industry | Defense | Defense | ✓ | ✓ | `non_hardware/AI` | disagree |  |
| Joby Aviation | mid-tier | single | Aerospace | Aerospace | ✓ | ✓ | `null/null` | claude_only |  |
| Mercor | early-stage | multi-industry | AI | AI | ✓ | ✓ | `non_hardware/AI` | agree | ⚠ OOS |
| Notion | well-known | single | SaaS | SaaS | ✓ | ✓ | `non_hardware/SaaS` | agree | ⚠ OOS |
| Scale AI | mid-tier | multi-industry | AI | AI | ✓ | ✓ | `non_hardware/AI` | agree | ⚠ OOS |

## Flagged for "your call" (out-of-scope or ambiguous — not fail-graded)

### Slate Auto [AMBIGUOUS]
- Expected (best-fit): category=hardware, primary=Automotive, industries=["Automotive"]
- Got (enrich): category=hardware, primary=Automotive, industries=["Automotive"], domain_tags=["EVs"]

### 1X Technologies [AMBIGUOUS]
- Expected (best-fit): category=hardware, primary=Robotics, industries=["Robotics"]
- Got (enrich): category=hardware, primary=Robotics, industries=["Robotics"], domain_tags=["AI"]

### Apple [OUT-OF-SCOPE]
*Extreme multi-industry. Apple has Services (App Store / iCloud), Streaming (Apple TV+), FinTech (Apple Pay) but they are FEATURES of the device platform, not separate businesses. Primary stays Consumer Electronics.*

- Expected (best-fit): category=hardware, primary=Consumer Electronics, industries=["Consumer Electronics"]
- Got (enrich): category=hardware, primary=Consumer Electronics, industries=["Consumer Electronics","Semiconductors"], domain_tags=["AI"]

### Hadrian [OUT-OF-SCOPE]
*Could also be Aerospace (serves aero/defense). Defaulting to Industrial Manufacturing as the core business.*

- Expected (best-fit): category=hardware, primary=Industrial Manufacturing, industries=["Industrial Manufacturing"]
- Got (enrich): category=hardware, primary=Industrial Manufacturing, industries=["Industrial Manufacturing","Aerospace","Defense"], domain_tags=["AI"]

### John Deere [OUT-OF-SCOPE]
*Agriculture is not in V1 industries. Falls to Industrial Manufacturing. Agriculture gap on backlog.*

- Expected (best-fit): category=hardware, primary=Industrial Manufacturing, industries=["Industrial Manufacturing"]
- Got (enrich): category=hardware, primary=Industrial Manufacturing, industries=["Industrial Manufacturing","Automotive"], domain_tags=[]

### SpaceX [OUT-OF-SCOPE]
*Starlink is a Telecommunications business — not in V1 industries. Expect SpaceX to land at Aerospace primary. Telecommunications gap on backlog.*

- Expected (best-fit): category=hardware, primary=Aerospace, industries=["Aerospace","Industrial Manufacturing"]
- Got (enrich): category=hardware, primary=Aerospace, industries=["Aerospace"], domain_tags=["Rockets","Satellites"]

### Stoke Space [AMBIGUOUS]
- Expected (best-fit): category=hardware, primary=Aerospace, industries=["Aerospace"]
- Got (enrich): category=hardware, primary=Aerospace, industries=["Aerospace"], domain_tags=["Rockets"]

### Mercor [OUT-OF-SCOPE]
*AI-recruiting could also be HR-tech but V1 has no HRTech industry. AI primary with HR tag.*

- Expected (best-fit): category=non_hardware, primary=AI, industries=["AI"]
- Got (enrich): category=non_hardware, primary=AI, industries=["AI"], domain_tags=["Data","B2B"]

### Notion [OUT-OF-SCOPE]
*AI suppression test: Notion has AI features but core is productivity SaaS. Should NOT have AI tag.*

- Expected (best-fit): category=non_hardware, primary=SaaS, industries=["SaaS"]
- Got (enrich): category=non_hardware, primary=SaaS, industries=["SaaS"], domain_tags=["Productivity","B2B","Enterprise Software"]

### Scale AI [OUT-OF-SCOPE]
*AI primary; AI tag should be SUPPRESSED per round-2 decision #5.*

- Expected (best-fit): category=non_hardware, primary=AI, industries=["AI"]
- Got (enrich): category=non_hardware, primary=AI, industries=["AI"], domain_tags=["Data","Enterprise Software"]


## Disagreements (Claude vs dict, enrich-tier)

### Tesla
- Claude: hardware/Automotive
- Dict:   hardware/Energy
- Expected (ground truth): hardware/Automotive
- Verdict written (Claude wins): hardware/Automotive
- ✓ Claude was right, dict wrong → Claude wins, correct outcome

### Form Energy
- Claude: hardware/Energy Storage
- Dict:   hardware/Energy
- Expected (ground truth): hardware/Energy Storage
- Verdict written (Claude wins): hardware/Energy Storage
- ✓ Claude was right, dict wrong → Claude wins, correct outcome

### Antora Energy
- Claude: hardware/Energy Storage
- Dict:   hardware/Energy
- Expected (ground truth): hardware/Energy Storage
- Verdict written (Claude wins): hardware/Energy Storage
- ✓ Claude was right, dict wrong → Claude wins, correct outcome

### NVIDIA
- Claude: hardware/Semiconductors
- Dict:   non_hardware/AI
- Expected (ground truth): hardware/Semiconductors
- Verdict written (Claude wins): hardware/Semiconductors
- ✓ Claude was right, dict wrong → Claude wins, correct outcome

### Apple
- Claude: hardware/Consumer Electronics
- Dict:   non_hardware/AI
- Expected (ground truth): hardware/Consumer Electronics
- Verdict written (Claude wins): hardware/Consumer Electronics
- ✓ Claude was right, dict wrong → Claude wins, correct outcome

### Saildrone
- Claude: hardware/Defense
- Dict:   hardware/Aerospace
- Expected (ground truth): hardware/Maritime
- Verdict written (Claude wins): hardware/Defense
- ✗ Both wrong (or expected ambiguous)

### SpaceX
- Claude: hardware/Aerospace
- Dict:   hardware/Defense
- Expected (ground truth): hardware/Aerospace
- Verdict written (Claude wins): hardware/Aerospace
- ✓ Claude was right, dict wrong → Claude wins, correct outcome

### Palantir
- Claude: non_hardware/Defense
- Dict:   non_hardware/AI
- Expected (ground truth): non_hardware/Defense
- Verdict written (Claude wins): non_hardware/Defense
- ✓ Claude was right, dict wrong → Claude wins, correct outcome

---

## What I need from Matt (before kicking off the 50-100 eval)

Round-3 results are above the "reasonable range" bar. Per your instruction I'm proceeding directly — but the 50-100 list itself isn't yet defined. Two options for sourcing:

**Option A — I draft a stratified list (target 70 cos), you approve before pull.**
Stratification target:
- ~3-5 companies per V1 industry (covers all 28 V1 industry slots = ~100 cells; sample to 70)
- Mix of well-known / mid-tier / early-stage in each industry
- ~30% multi-industry to keep pressure on Option B
- Include 5-10 deliberate edge cases (out-of-scope industries that should fall to nearest V1 fit, AI-feature-not-core companies, defense+software cross-listings)

**Option B — You hand-pick the list yourself.** I run the pull + tag + eval against your list with the same hand-labeling pattern.

Either way, hand-labeled ground truth gets reviewed by you before final scoring (so no silent ground-truth bugs like NVIDIA/Tesla/Apple round-2).

Estimated cost: ~$7 in Crust credits for 70 cos × 2 calls + ~$1 in Claude. Wall clock ~15 min eval run.

**Recommendation: A.** Faster, and the stratification targets give us a defensible "this covers V1's vocabulary" claim. I can draft the list in ~10 min.

Nothing merges to main until you review the 50-100 results.
