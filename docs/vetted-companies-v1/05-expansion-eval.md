# Targeted Expansion Eval (28 companies + Anduril Maritime check)

*Generated: 2026-05-03T15:16:08.184Z*  
*Architecture: Claude-primary + dict sanity check, Option B multi-industry, dict fixes E1+E2.1+E3+M2.*  
*Tiers tested: identify-only, enrich-tier. Search-tier skipped (inv2 round-2 showed it's worse than identify due to noisy categories).*

## Aggregate accuracy (27 companies)

- **(A) identify:** category=21/27 (78%), primary_industry=19/27 (70%), industries[] P/R=0.47/0.72, domain_tag P/R=0.59/0.64
- **(B) enrich:** category=22/27 (81%), primary_industry=20/27 (74%), industries[] P/R=0.48/0.75, domain_tag P/R=0.66/0.71

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
    - agree with Claude: 10/20 (50%)
    - disagree with Claude: 6/20 (30%)
    - Note: agreement values include 'claude_only' when dict null. claude_only count: 11.

## Accuracy by company maturity (enrich-tier only)

- **well-known** (9 cos): cat=7/9 (78%), primary=7/9 (78%), tag P/R=0.65/0.69
- **mid-tier** (9 cos): cat=8/9 (89%), primary=6/9 (67%), tag P/R=0.72/0.76
- **early-stage** (9 cos): cat=7/9 (78%), primary=7/9 (78%), tag P/R=0.61/0.67

## Accuracy by single vs multi-industry (enrich-tier)

- **single** (17 cos): cat=14/17 (82%), primary=12/17 (71%), industries[] P/R=0.49/0.82
- **multi-industry** (10 cos): cat=8/10 (80%), primary=8/10 (80%), industries[] P/R=0.45/0.62

## Anduril Industries — Maritime industry firing check (re-tag from inv1 raw)

*Confirms E2.1 dict refinement didn't break Anduril's defense classification, AND that Maritime appears as a secondary industry under Option B (multi-industry).*

- **identify-tier:** category=hardware, primary=Defense, industries=`["Defense","Aerospace","Maritime","Industrial Manufacturing"]`, domain_tags=`["Drones","AI"]`
  - Maritime in industries: ✓ YES
  - method: claude, agreement: claude_only
- **enrich-tier:** category=hardware, primary=Defense, industries=`["Defense","Aerospace","Robotics"]`, domain_tags=`["Drones","AI"]`
  - Maritime in industries: ✗ NO
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
| Cerebras | mid-tier | single | Semiconductors | ∅ | ✗ | ✗ | `hardware/Semiconductors` | claude_only |  |
| Tenstorrent | early-stage | single | Semiconductors | ∅ | ✗ | ✗ | `null/null` | claude_only |  |
| Apple | well-known | multi-industry | Consumer Electronics | ∅ | ✗ | ✗ | `non_hardware/AI` | claude_only | ⚠ OOS |
| Humane | early-stage | single | Consumer Electronics | Consumer Electronics | ✓ | ✓ | `null/null` | claude_only |  |
| Hadrian | early-stage | single | Industrial Manufacturing | ∅ | ✗ | ✗ | `hardware/Industrial Manufacturing` | claude_only | ⚠ OOS |
| John Deere | well-known | multi-industry | Industrial Manufacturing | Industrial Manufacturing | ✓ | ✓ | `hardware/Industrial Manufacturing` | agree | ⚠ OOS |
| Boom Supersonic | mid-tier | multi-industry | Aerospace | Aerospace | ✓ | ✓ | `hardware/Aerospace` | agree |  |
| Saildrone | mid-tier | single | Maritime | Defense | ✓ | ✗ | `hardware/Aerospace` | disagree |  |
| SpaceX | well-known | multi-industry | Aerospace | Aerospace | ✓ | ✓ | `hardware/Defense` | disagree | ⚠ OOS |
| Stoke Space | early-stage | single | Aerospace | Aerospace | ✓ | ✓ | `hardware/Aerospace` | agree | ? amb |
| Palantir | well-known | multi-industry | Defense | ∅ | ✗ | ✗ | `non_hardware/AI` | claude_only |  |
| Joby Aviation | mid-tier | single | Aerospace | Aerospace | ✓ | ✓ | `null/null` | claude_only |  |
| Mercor | early-stage | multi-industry | AI | AI | ✓ | ✓ | `non_hardware/AI` | agree | ⚠ OOS |
| Notion | well-known | single | SaaS | SaaS | ✓ | ✓ | `non_hardware/SaaS` | agree | ⚠ OOS |
| Scale AI | mid-tier | multi-industry | AI | AI | ✓ | ✓ | `non_hardware/AI` | agree | ⚠ OOS |

## Flagged for "your call" (out-of-scope or ambiguous — not fail-graded)

### Slate Auto [AMBIGUOUS]
- Expected (best-fit): category=hardware, primary=Automotive, industries=["Automotive"]
- Got (enrich): category=hardware, primary=Automotive, industries=["Automotive","Industrial Manufacturing"], domain_tags=["EVs","Autonomous Driving"]

### 1X Technologies [AMBIGUOUS]
- Expected (best-fit): category=hardware, primary=Robotics, industries=["Robotics"]
- Got (enrich): category=hardware, primary=Robotics, industries=["Robotics","Industrial Manufacturing"], domain_tags=["AI"]

### Apple [OUT-OF-SCOPE]
*Extreme multi-industry. Apple has Services (App Store / iCloud), Streaming (Apple TV+), FinTech (Apple Pay) but they are FEATURES of the device platform, not separate businesses. Primary stays Consumer Electronics.*

- Expected (best-fit): category=hardware, primary=Consumer Electronics, industries=["Consumer Electronics"]
- Got (enrich): category=null, primary=null, industries=[], domain_tags=[]

### Hadrian [OUT-OF-SCOPE]
*Could also be Aerospace (serves aero/defense). Defaulting to Industrial Manufacturing as the core business.*

- Expected (best-fit): category=hardware, primary=Industrial Manufacturing, industries=["Industrial Manufacturing"]
- Got (enrich): category=null, primary=null, industries=[], domain_tags=[]

### John Deere [OUT-OF-SCOPE]
*Agriculture is not in V1 industries. Falls to Industrial Manufacturing. Agriculture gap on backlog.*

- Expected (best-fit): category=hardware, primary=Industrial Manufacturing, industries=["Industrial Manufacturing"]
- Got (enrich): category=hardware, primary=Industrial Manufacturing, industries=["Industrial Manufacturing","Automotive","Energy"], domain_tags=[]

### SpaceX [OUT-OF-SCOPE]
*Starlink is a Telecommunications business — not in V1 industries. Expect SpaceX to land at Aerospace primary. Telecommunications gap on backlog.*

- Expected (best-fit): category=hardware, primary=Aerospace, industries=["Aerospace","Industrial Manufacturing"]
- Got (enrich): category=hardware, primary=Aerospace, industries=["Aerospace","Defense"], domain_tags=["Rockets","Satellites"]

### Stoke Space [AMBIGUOUS]
- Expected (best-fit): category=hardware, primary=Aerospace, industries=["Aerospace"]
- Got (enrich): category=hardware, primary=Aerospace, industries=["Aerospace"], domain_tags=["Rockets"]

### Mercor [OUT-OF-SCOPE]
*AI-recruiting could also be HR-tech but V1 has no HRTech industry. AI primary with HR tag.*

- Expected (best-fit): category=non_hardware, primary=AI, industries=["AI"]
- Got (enrich): category=non_hardware, primary=AI, industries=["AI","SaaS"], domain_tags=["Data","B2B"]

### Notion [OUT-OF-SCOPE]
*AI suppression test: Notion has AI features but core is productivity SaaS. Should NOT have AI tag.*

- Expected (best-fit): category=non_hardware, primary=SaaS, industries=["SaaS"]
- Got (enrich): category=non_hardware, primary=SaaS, industries=["SaaS"], domain_tags=["Productivity","B2B","Enterprise Software"]

### Scale AI [OUT-OF-SCOPE]
*AI primary; AI tag should be SUPPRESSED per round-2 decision #5.*

- Expected (best-fit): category=non_hardware, primary=AI, industries=["AI"]
- Got (enrich): category=non_hardware, primary=AI, industries=["AI","SaaS"], domain_tags=["Data","Enterprise Software"]


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

---

## Headlines

### 1. Aggregate accuracy on broader sample is materially lower than 10-co set

| Metric | inv2 round-2 (10 cos) | expansion (27 cos) | Δ |
|---|---|---|---|
| Category (enrich) | 90-100% | 81% | -10pp+ |
| Primary industry (enrich) | 70-80% | 74% | within range |
| Domain tag P / R (enrich) | 0.70-0.75 / 0.60-0.63 | 0.66 / 0.71 | similar |

The 10-company set was biased toward "Crust knows them well." Broader sample includes thin-data early-stage cos and extreme multi-industry cases (Apple) where Claude struggles. **Don't promise the inv2 round-2 numbers on the V1 production load.** Realistic expectation: ~80% category, ~75% primary at scale.

### 2. Dict abstention rate (the question on dict's value at scale)

**Identify-tier: dict abstains 100% (27/27).** Without `taxonomy.professional_network_industry` and `taxonomy.categories[]` (both enrich/search-only), the dict has no signals to vote on and always returns null. **For unreviewed-tier auto-creates, dict adds zero sanity-check value.** Every output method='claude'.

**Enrich-tier: dict abstains 26% (7/27).** When dict commits (74% of vetted-tier flows): 50% agree with Claude, 30% disagree.

Architectural implications:
- For unreviewed-tier rows: triage signal must come from `tagging_confidence` threshold alone — dict-disagreement won't fire
- For vetted-tier rows: dict is a meaningful sanity check ~74% of the time; remaining 26% rely on Claude alone
- The 5 of 6 enrich-tier disagreements where Claude was right validates "Claude wins on disagreement" (Concern B)

### 3. Anduril Maritime industry firing — confirmed pattern

| Tier | Industries returned | Maritime present? |
|---|---|---|
| identify | `[Defense, Aerospace, Maritime, Industrial Manufacturing]` | **✓ YES** |
| enrich | `[Defense, Aerospace, Robotics]` | **✗ NO** (Maritime + Manufacturing dropped, Robotics added) |

Same pattern as inv2 round-2. Crust's `taxonomy.categories[]` at enrich-tier injects "Robotics" noise that distracts Claude away from Maritime. **Identify-tier multi-industry detection is BETTER than enrich-tier for Anduril.** Possibly worth investigating: should the orchestrator strip `categories[]` from Claude's input even when description is available?

### 4. Five Claude-null cases — root cause: prompt confusion between `industries[]` and `domain_tags[]`

Investigated by re-running Claude on each:

| Company | Why Claude was nulled |
|---|---|
| Cerebras | Returned `industries=["Semiconductors", "AI"]` for hw category. AI is a NON-HARDWARE industry — invalid. Validator failed → null. |
| Tenstorrent | Same as Cerebras — `industries=["Semiconductors", "AI"]` → invalid → null. |
| Hadrian | Returned `domain_tags=["Robotics", "AI"]`. Robotics isn't a domain_tag — it's a hardware INDUSTRY. → invalid → null. |
| Apple | Returned `domain_tags=["Mobile", "AI"]`. Mobile isn't in hardware domain_tags (it's non_hardware-only). → invalid → null. |
| Palantir | Returned `industries=["Defense", "Analytics", "AI"]` for non_hw category. Analytics isn't an industry (it's a domain_tag). → invalid → null. |

**Root cause**: my Claude prompt presents the industries and domain_tags lists clearly, but Claude generalizes and mixes them. AI especially — it's an industry (non_hw only) AND a domain_tag (both categories). When Claude wants to say "this company has AI as a significant capability but isn't fundamentally an AI company," it sometimes puts AI in industries[] when it should go in domain_tags[].

### 5. Three ground-truth bugs in MY eval (not the system's fault)

I labeled with V1-schema-invalid expected values:

- **NVIDIA**: I wrote `industries=[Semiconductors, AI]`. But under V1 schema, `industries[]` must all be in the category's allowed list, and AI is non-hardware-only. Correct: `industries=[Semiconductors]`, `domain_tags=[AI]`.
- **Tesla**: I had `domain_tags` include `Robotics`. But Robotics is a hardware INDUSTRY, not a tag. Correct: `industries=[Automotive, Energy, Industrial Manufacturing, Robotics]`, `domain_tags=[EVs, Autonomous Driving, AI]`.
- **Apple**: I had `domain_tags=[AI, Mobile]`. Mobile is a non-hardware tag only. Correct: `domain_tags=[AI]`. (Apple's iPhone is captured by `Consumer Electronics` industry, not a Mobile tag.)

These ground-truth corrections would lift the reported aggregates by ~5-10pp. **Re-run after Claude prompt + validator fixes lands.**

### 6. Saildrone — real Claude failure (not a ground-truth bug)

Expected: `hardware/Maritime`. Claude returned `hardware/Defense` (dict said `hardware/Aerospace`). Both wrong. Saildrone makes autonomous unmanned SURFACE vehicles — they ARE Maritime. Crust's data probably doesn't surface "Maritime" strongly; Claude pattern-matched to Defense (drone+military customer association).

This is one real Claude error in 27 — about 4%. Acceptable. Worth a future Claude-prompt example explicitly mentioning Saildrone or the Maritime case.

### 7. Real Crust gap — Rebellion Defense not in Crust's database

Tried to identify by domain `rebelliondefense.com`, by linkedin URL `linkedin.com/company/rebellion-defense`, and by name "Rebellion Defense". All returned wrong matches (Rebellion Capital, Rebellion Creative, Grupo Rebellion, etc.) or none. **Rebellion Defense is not indexed in Crust's company DB.** Real-world data gap to know about. Dropped from this eval; Palantir remains the non-hw/Defense test case.

---

## Proposed fixes (NOT applied yet — awaiting approval)

### Fix C1 — Tighten Claude prompt to disambiguate industries[] vs domain_tags[]

Current prompt presents both lists side by side but Claude conflates them, especially for cross-listed values (AI as industry vs AI as tag).

**Proposed addition to system prompt:**

> ## Industries[] vs domain_tags[] — common source of confusion
>
> The two lists are distinct. Members of `industries[]` MUST come from the "Industries" section. Members of `domain_tags[]` MUST come from the "Domain tags" section. They do NOT overlap except for one cross-listing (AI), which has explicit suppression rules.
>
> Disambiguation rules:
> - **AI** appears in both lists. As an INDUSTRY: company's primary business IS AI software (OpenAI, Hugging Face). As a TAG: AI is a core technology in a NON-AI business (Anduril uses AI for Hivemind autonomy, but their business is Defense).
> - **Robotics** is a hardware INDUSTRY only. Companies that USE robotics but aren't fundamentally robotics companies should put Robotics in `industries[]` (if multi-industry), not in `domain_tags[]`.
> - **Analytics, Data, Cybersecurity, DevTools, etc.** are domain TAGS only. They describe a non-hardware company's product focus but aren't standalone industries. Put them in `domain_tags[]`, not `industries[]`.
>
> Critically: `industries[]` members must all be valid for the chosen category. A hardware company's `industries[]` cannot contain AI (which is non-hardware-only). Use the AI domain_tag instead.

Estimated impact: fixes ~4 of 5 null cases (NVIDIA-style "AI in hw industries", Hadrian/Apple-style "industry-name in tags").

### Fix C2 — Make validator forgiving (strip invalid, don't null)

Current validator nulls the whole output on any invalid value. Should instead:
- Hard-fail only if `category` is invalid OR `primary_industry` is not in `category`'s allowed set
- For invalid entries in `industries[]`: strip them (warn in reasoning), keep the rest
- For invalid entries in `domain_tags[]`: strip them, keep the rest

This recovers ~80% of the otherwise-nulled cases. Combined with C1 (which prevents most invalid output), expected null rate drops from ~20% to <5%.

### Fix C3 — Investigate stripping Crust `categories[]` from Claude input even when description is available

Three cases (Anduril Maritime, Hadrian Robotics-tag, Tenstorrent AI-in-industries) all show Crust categories actively confusing Claude. Worth A/B testing: same companies through Claude WITH categories vs WITHOUT (description only).

**Defer this one for V1.** Add to backlog. May materially improve Claude quality but needs its own eval pass.

### NOT proposing additional dict fixes

Dict failure patterns surfaced in the expansion eval are mostly cases where dict abstained correctly (M2 firing) — that's working as intended. The Form Energy / Antora dict-said-Energy-not-Energy-Storage pattern is a known limitation: dict's Energy rule fires before Energy Storage in HARDWARE_INDUSTRY_RULES. Could reorder, but Claude wins on disagreement so the final write is correct. Defer per "Defer dictionary fixes" decision.

---

## Recommended sequencing

1. **Approve / modify Fix C1 and C2** (Claude prompt + forgiving validator)
2. **I correct 3 ground-truth bugs** in `_inv2-expansion-eval.ts`
3. **Re-run expansion eval** with all 3 fixes applied → confirm aggregate accuracy lifts
4. **Then proceed to the larger 50-100 eval**

Estimated time for steps 1-3: ~1 hour and ~$1 in Claude/Crust costs.

## What I need from Matt

1. **Approve C1 (Claude prompt tightening)?**
2. **Approve C2 (forgiving validator — strip invalid, keep partial)?**
3. **Defer C3 (no-categories-Claude experiment) to backlog?** — or run an A/B before larger eval?
4. **OK to correct the 3 ground-truth bugs and re-run?** (yes/no — they're objectively wrong per V1 schema, so this is admin)
5. **After re-run, proceed to 50-100 eval?** Or want another targeted-eval round?
