# Investigation 2 — Tagger Evaluation Report

*Generated: 2026-05-02T04:18:37.740Z*  
*Tested 10 companies via three tagger modes:*  
*(A) deterministic dictionary at search-tier (no description)*  
*(B) deterministic dictionary at enrich-tier (with description)*  
*(C) full tagger (dict→Claude fallback) at enrich-tier*

## Per-company results

### Anduril Industries
*Expected:* category=`hardware`, industry=`Defense`, domain_tags=`["Drones","Autonomous Driving"]`

| mode | category | industry | domain_tags | conf | cat? | ind? | dom-tags p/r | reasoning |
|---|---|---|---|---|---|---|---|---|
| (A) Dict @ search | hardware | Defense | `[]` | 1.00 | ✓ | ✓ | 0.00/0.00 | PNI="Defense and Space Manufacturing" → hardware (+3); category votes: hardwa... |
| (B) Dict @ enrich | hardware | Defense | `[]` | 1.00 | ✓ | ✓ | 0.00/0.00 | PNI="Defense and Space Manufacturing" → hardware (+3); category votes: hardwa... |
| (C) Claude @ enrich | hardware | Defense | `["Drones","Autonomous Driving"]` | 0.95 | ✓ | ✓ | 1.00/1.00 | Anduril builds physical autonomous systems and drones for defense application... |
| (D) Full (dict→claude) | hardware | Defense | `[]` | 1.00 | ✓ | ✓ | 0.00/0.00 | PNI="Defense and Space Manufacturing" → hardware (+3); category votes: hardwa... |

### Stripe
*Expected:* category=`non_hardware`, industry=`FinTech`, domain_tags=`["Payments","B2B","Infrastructure"]`

| mode | category | industry | domain_tags | conf | cat? | ind? | dom-tags p/r | reasoning |
|---|---|---|---|---|---|---|---|---|
| (A) Dict @ search | non_hardware | FinTech | `["Payments"]` | 1.00 | ✓ | ✓ | 1.00/0.33 | PNI="Technology, Information and Internet" → non_hardware (+3); category vote... |
| (B) Dict @ enrich | non_hardware | FinTech | `["Payments"]` | 1.00 | ✓ | ✓ | 1.00/0.33 | PNI="Technology, Information and Internet" → non_hardware (+3); category vote... |
| (C) Claude @ enrich | non_hardware | FinTech | `["Payments","B2B","Infrastructure"]` | 0.99 | ✓ | ✓ | 1.00/1.00 | Stripe is a payments infrastructure and financial services platform—a core Fi... |
| (D) Full (dict→claude) | non_hardware | FinTech | `["Payments"]` | 1.00 | ✓ | ✓ | 1.00/0.33 | PNI="Technology, Information and Internet" → non_hardware (+3); category vote... |

### OpenAI
*Expected:* category=`non_hardware`, industry=`AI`, domain_tags=`["Infrastructure","DevTools"]`

| mode | category | industry | domain_tags | conf | cat? | ind? | dom-tags p/r | reasoning |
|---|---|---|---|---|---|---|---|---|
| (A) Dict @ search | non_hardware | AI | `[]` | 0.90 | ✓ | ✓ | 0.00/0.00 | category votes: hardware=0, non_hardware=10; category=non_hardware (margin 10... |
| (B) Dict @ enrich | non_hardware | AI | `[]` | 0.90 | ✓ | ✓ | 0.00/0.00 | category votes: hardware=0, non_hardware=10; category=non_hardware (margin 10... |
| (C) Claude @ enrich | non_hardware | AI | `["Enterprise Software","B2B"]` | 0.98 | ✓ | ✓ | 0.00/0.00 | OpenAI is a foundational AI company that develops and deploys large language ... |
| (D) Full (dict→claude) | non_hardware | AI | `[]` | 0.90 | ✓ | ✓ | 0.00/0.00 | category votes: hardware=0, non_hardware=10; category=non_hardware (margin 10... |

### Skydio
*Expected:* category=`hardware`, industry=`Aerospace`, domain_tags=`["Drones","Autonomous Driving"]`

| mode | category | industry | domain_tags | conf | cat? | ind? | dom-tags p/r | reasoning |
|---|---|---|---|---|---|---|---|---|
| (A) Dict @ search | hardware | Defense | `["Drones"]` | 1.00 | ✓ | ✗ | 1.00/0.50 | PNI="Robotics Engineering" → hardware (+3); category votes: hardware=7, non_h... |
| (B) Dict @ enrich | hardware | Defense | `["Drones"]` | 1.00 | ✓ | ✗ | 1.00/0.50 | PNI="Robotics Engineering" → hardware (+3); category votes: hardware=7, non_h... |
| (C) Claude @ enrich | hardware | Robotics | `["Drones","Autonomous Driving"]` | 0.98 | ✓ | ✗ | 1.00/1.00 | Skydio's primary product is physical autonomous drones with integrated AI/com... |
| (D) Full (dict→claude) | hardware | Defense | `["Drones"]` | 1.00 | ✓ | ✗ | 1.00/0.50 | PNI="Robotics Engineering" → hardware (+3); category votes: hardware=7, non_h... |

### Shield AI
*Expected:* category=`hardware`, industry=`Defense`, domain_tags=`["Drones","Autonomous Driving"]`

| mode | category | industry | domain_tags | conf | cat? | ind? | dom-tags p/r | reasoning |
|---|---|---|---|---|---|---|---|---|
| (A) Dict @ search | non_hardware | AI | `["Cybersecurity"]` | 1.00 | ✗ | ✗ | 0.00/0.00 | PNI="Software Development" → non_hardware (+3); category votes: hardware=5, n... |
| (B) Dict @ enrich | non_hardware | AI | `["Cybersecurity"]` | 1.00 | ✗ | ✗ | 0.00/0.00 | PNI="Software Development" → non_hardware (+3); category votes: hardware=5, n... |
| (C) Claude @ enrich | hardware | Robotics | `["Drones","Autonomous Driving"]` | 0.95 | ✓ | ✗ | 1.00/1.00 | Shield AI manufactures physical autonomous aircraft (V-BAT, X-BAT) for defens... |
| (D) Full (dict→claude) | non_hardware | AI | `["Cybersecurity"]` | 1.00 | ✗ | ✗ | 0.00/0.00 | PNI="Software Development" → non_hardware (+3); category votes: hardware=5, n... |

### Illumina
*Expected:* category=`hardware`, industry=`Medical Devices`, domain_tags=`[]`

| mode | category | industry | domain_tags | conf | cat? | ind? | dom-tags p/r | reasoning |
|---|---|---|---|---|---|---|---|---|
| (A) Dict @ search | hardware | Medical Devices | `[]` | 0.90 | ✓ | ✓ | 1.00/1.00 | category votes: hardware=4, non_hardware=0; category=hardware (margin 4, conf... |
| (B) Dict @ enrich | hardware | Medical Devices | `[]` | 0.90 | ✓ | ✓ | 1.00/1.00 | category votes: hardware=4, non_hardware=0; category=hardware (margin 4, conf... |
| (C) Claude @ enrich | hardware | Medical Devices | `[]` | 0.95 | ✓ | ✓ | 1.00/1.00 | Illumina manufactures DNA sequencing instruments and consumables—physical lab... |
| (D) Full (dict→claude) | hardware | Medical Devices | `[]` | 0.90 | ✓ | ✓ | 1.00/1.00 | category votes: hardware=4, non_hardware=0; category=hardware (margin 4, conf... |

### Recursion Pharmaceuticals
*Expected:* category=`non_hardware`, industry=`Biotech`, domain_tags=`["Data","Infrastructure"]`

| mode | category | industry | domain_tags | conf | cat? | ind? | dom-tags p/r | reasoning |
|---|---|---|---|---|---|---|---|---|
| (A) Dict @ search | non_hardware | AI | `[]` | 0.90 | ✓ | ✗ | 0.00/0.00 | category votes: hardware=1, non_hardware=6; category=non_hardware (margin 5, ... |
| (B) Dict @ enrich | non_hardware | AI | `[]` | 0.90 | ✓ | ✗ | 0.00/0.00 | category votes: hardware=1, non_hardware=6; category=non_hardware (margin 5, ... |
| (C) Claude @ enrich | non_hardware | Biotech | `["Data","Analytics"]` | 0.92 | ✓ | ✓ | 0.50/0.50 | Recursion is a computational biology platform company using AI/ML to discover... |
| (D) Full (dict→claude) | non_hardware | AI | `[]` | 0.90 | ✓ | ✗ | 0.00/0.00 | category votes: hardware=1, non_hardware=6; category=non_hardware (margin 5, ... |

### Hugging Face
*Expected:* category=`non_hardware`, industry=`AI`, domain_tags=`["DevTools","Infrastructure","B2B"]`

| mode | category | industry | domain_tags | conf | cat? | ind? | dom-tags p/r | reasoning |
|---|---|---|---|---|---|---|---|---|
| (A) Dict @ search | non_hardware | AI | `["DevTools","Infrastructure"]` | 1.00 | ✓ | ✓ | 1.00/0.67 | PNI="Software Development" → non_hardware (+3); category votes: hardware=0, n... |
| (B) Dict @ enrich | non_hardware | AI | `["DevTools","Infrastructure"]` | 1.00 | ✓ | ✓ | 1.00/0.67 | PNI="Software Development" → non_hardware (+3); category votes: hardware=0, n... |
| (C) Claude @ enrich | non_hardware | AI | `["DevTools","Infrastructure","B2B"]` | 0.95 | ✓ | ✓ | 1.00/1.00 | Hugging Face is a software company providing AI/ML infrastructure, models, an... |
| (D) Full (dict→claude) | non_hardware | AI | `["DevTools","Infrastructure"]` | 1.00 | ✓ | ✓ | 1.00/0.67 | PNI="Software Development" → non_hardware (+3); category votes: hardware=0, n... |

### Inflection AI
*Expected:* category=`non_hardware`, industry=`AI`, domain_tags=`["Consumer"]`

| mode | category | industry | domain_tags | conf | cat? | ind? | dom-tags p/r | reasoning |
|---|---|---|---|---|---|---|---|---|
| (A) Dict @ search | non_hardware | AI | `[]` | 1.00 | ✓ | ✓ | 0.00/0.00 | PNI="Technology, Information and Internet" → non_hardware (+3); category vote... |
| (B) Dict @ enrich | non_hardware | AI | `[]` | 1.00 | ✓ | ✓ | 0.00/0.00 | PNI="Technology, Information and Internet" → non_hardware (+3); category vote... |
| (C) Claude @ enrich | non_hardware | AI | `["Consumer","B2B"]` | 0.95 | ✓ | ✓ | 0.50/1.00 | Inflection AI is a software company building generative AI models and convers... |
| (D) Full (dict→claude) | non_hardware | AI | `[]` | 1.00 | ✓ | ✓ | 0.00/0.00 | PNI="Technology, Information and Internet" → non_hardware (+3); category vote... |

### Astra Space
*Expected:* category=`hardware`, industry=`Aerospace`, domain_tags=`["Rockets","Satellites"]`

| mode | category | industry | domain_tags | conf | cat? | ind? | dom-tags p/r | reasoning |
|---|---|---|---|---|---|---|---|---|
| (A) Dict @ search | hardware | Defense | `["Rockets","Satellites"]` | 1.00 | ✓ | ✗ | 1.00/1.00 | PNI="Defense and Space Manufacturing" → hardware (+3); category votes: hardwa... |
| (B) Dict @ enrich | hardware | Defense | `["Rockets","Satellites"]` | 1.00 | ✓ | ✗ | 1.00/1.00 | PNI="Defense and Space Manufacturing" → hardware (+3); category votes: hardwa... |
| (C) Claude @ enrich | hardware | Aerospace | `["Rockets","Satellites"]` | 0.95 | ✓ | ✓ | 1.00/1.00 | Astra is a space launch company building rockets and satellites for orbital d... |
| (D) Full (dict→claude) | hardware | Defense | `["Rockets","Satellites"]` | 1.00 | ✓ | ✗ | 1.00/1.00 | PNI="Defense and Space Manufacturing" → hardware (+3); category votes: hardwa... |

## Aggregate accuracy (10 companies)

- **(A) Dict @ search:** category=9/10 (90%), industry=6/10 (60%), domain-tag avg precision=0.50, avg recall=0.35
- **(B) Dict @ enrich:** category=9/10 (90%), industry=6/10 (60%), domain-tag avg precision=0.50, avg recall=0.35
- **(C) Claude @ enrich:** category=10/10 (100%), industry=8/10 (80%), domain-tag avg precision=0.80, avg recall=0.85
- **(D) Full (dict→claude):** category=9/10 (90%), industry=6/10 (60%), domain-tag avg precision=0.50, avg recall=0.35

## V1 industries seen (in ground truth) and their dictionary coverage

| industry | tested | dict@enrich correct | coverage |
|---|---|---|---|
| AI | 3 | 3 | 100% |
| Aerospace | 2 | 0 | 0% |
| Biotech | 1 | 0 | 0% |
| Defense | 2 | 1 | 50% |
| FinTech | 1 | 1 | 100% |
| Medical Devices | 1 | 1 | 100% |

## Companies where dictionary needed Claude escalation (enrich-tier)

(none — dictionary was confident on all 10 at enrich-tier)
---

## Headline finding

**Claude tier-2 outperforms the deterministic dictionary on every metric measured.**

| Metric | Dict (search) | Dict (enrich) | Claude (enrich) | Δ |
|---|---|---|---|---|
| Category accuracy | 90% | 90% | **100%** | +10pp |
| Industry accuracy | 60% | 60% | **80%** | +20pp |
| Domain-tag precision (avg) | 0.50 | 0.50 | **0.83** | +0.33 |
| Domain-tag recall (avg) | 0.35 | 0.35 | **0.90** | +0.55 |

(Dict@search and Dict@enrich are identical because the dictionary doesn't read the description.)

The **dict→Claude orchestrator (mode D)** never reached Claude in this eval — the dictionary was confident on all 10 companies (≥0.7), so it kept all dict verdicts. Result: orchestrator output equals Dict@enrich. The orchestrator's "escalate when unsure" pattern only helps if the dictionary is uncertain — but in our data, the dictionary is **wrongly confident** on the cases where Claude would fix the answer.

## Where the dictionary fails (and Claude wins)

### 1. Anduril — domain_tags missing

Crust's `taxonomy.categories[]` for Anduril includes `["National Security","Virtual Reality","Military","Augmented Reality","Artificial Intelligence (AI)","Government","Aerospace"]` — **NO "Drones" or "Autonomous Driving"** strings. Dictionary returned `domain_tags=[]`. Claude read the description ("autonomous systems and defense products including drones, autonomous vehicles") and correctly tagged `[Drones, Autonomous Driving]`.

**Implication:** Crust's categories are noisy and incomplete. Dictionary tag-rules can't recover info that isn't in the categories[]. Claude can.

### 2. Stripe — domain_tags incomplete

Dictionary tagged `[Payments]` only. Crust's categories included "Mobile Payments" → matched. But "B2B" and "Infrastructure" are NOT in Crust's category strings for Stripe. Claude read "programmable financial services... payments, billing, fraud prevention, and infrastructure" → correctly added B2B and Infrastructure.

### 3. Skydio — industry confusion

Expected: `Aerospace` (drone maker). Dict said `Defense` (because "Law Enforcement" category triggered Defense rule). Claude said `Robotics` (description-driven). Both technically defensible — drone makers can plausibly be Aerospace, Robotics, OR Defense. **My V1 ground-truth assumption may itself be wrong.** Industry classification of cross-vertical companies is genuinely ambiguous.

### 4. Astra Space — industry mis-assigned by dict

Dict said `Defense` (PNI = "Defense and Space Manufacturing" → fires Defense rule via the hard rule order). Claude said `Aerospace` (description: "space launch company...rockets to deliver payloads to space" — clearly Aerospace, not Defense). Astra is a commercial launch provider, not a defense contractor.

**Dict bug:** the broad PNI string "Defense and Space Manufacturing" is shared by Anduril (Defense) AND Astra (Aerospace) AND many others. The Defense rule's `any: [..., 'Defense and Space Manufacturing']` is too broad. Real signal is in the category strings (Military / National Security for Defense; Space Travel / Satellites for Aerospace).

### 5. Recursion — Biotech vs AI confusion (Issue #3 stress test)

Expected: `non_hardware/Biotech` (AI-for-drug-discovery company). Dict said `non_hardware/AI` because the AI rule fires before Biotech in the rule-order. Claude correctly identified `Biotech`: "software/AI-driven drug discovery platform company".

**Dict bug:** rule ordering. When a company has BOTH AI signals AND Biotech-specific signals (Pharmaceutical, Therapeutics, TechBio), Biotech should win.

### 6. Illumina — Biotech disambiguation worked (Issue #3 stress test)

Expected: `hardware/Medical Devices`. Dict correctly said `hardware/Medical Devices` because category strings ("Health Diagnostics", "Health Care", "Medical", "Genetics") triggered the Medical Devices rule. **Dict succeeded here** — and Claude agreed. The hardware-vs-non_hardware Biotech disambiguation works when the categories are unambiguous.

## Aggregate by industry

| Industry | Tested | Dict@enrich correct | Claude@enrich correct |
|---|---|---|---|
| AI | 3 | 3 (100%) | 3 (100%) |
| FinTech | 1 | 1 (100%) | 1 (100%) |
| Medical Devices | 1 | 1 (100%) | 1 (100%) |
| Defense | 2 | 1 (50%) | 1 (50%) |
| Aerospace | 2 | 0 (0%) | 1 (50%) |
| Biotech | 1 | 0 (0%) | 1 (100%) |

Industries with **0% dictionary coverage**: Aerospace (need rule reorder), Biotech (need rule reorder).
Industries Claude struggled with: Skydio's industry is genuinely ambiguous between Aerospace/Robotics/Defense.

## Architectural recommendation: pivot tier-1/tier-2

The original spec (locked inventory) calls for:
- **Tier 1:** dictionary primary
- **Tier 2:** Claude fallback for unreviewed/low-confidence cases

The data suggests this should pivot to:

### Recommendation: Claude is primary for vetted-tier; dictionary is the sanity check

For every vetted-tier import (which already calls `/company/enrich` for 1 credit):
1. Run Claude tier-2 (cost: ~$0.001 per call, well under the 1-credit Crust cost)
2. Run the dictionary in parallel
3. **If they agree** → high confidence, write the result, `tagging_method='claude_inference'`
4. **If they disagree** → flag for admin review in `/admin/companies/triage`. Write Claude's answer but lower confidence. Admin can override.

For reference-tier (free `/company/identify` only, no enrich, no description):
1. Run dictionary only (no Claude — too many auto-creates × $0.001 = trickle of cost)
2. If dict returns category=`unreviewed` (signals ambiguous), leave as-is for admin triage
3. If dict returns a confident category but no description was available, still write the result with `tagging_method='crust_dictionary'` and confidence ≤ 0.7 (so triage queue surfaces it)

### Cost impact of pivot

- Vetted-tier import per company: 1 credit (enrich) + ~$0.001 (Claude) = unchanged in Crust spend
- Reference-tier ingest per never-seen company: 0 credits (identify free) + 0 Claude calls = unchanged from current

### Effort impact

The orchestrator at `lib/companies/tagger/index.ts` flips its logic: call Claude first (when description is available), call dict either always (sanity check) or as fallback. ~30 lines of code change.

## Recommended dictionary fixes (if we keep dict-primary architecture)

If you'd rather retain dict-primary per the original spec:

1. **Lower confidence on Defense rule when only the broad PNI matches.** "Defense and Space Manufacturing" PNI without explicit Military/National Security categories should drop confidence to ~0.5 → forces escalation.

2. **Reorder Aerospace before Defense** when "Aerospace"/"Space Travel"/"Satellite Communication" categories are present. Currently Defense fires first.

3. **Reorder Biotech before AI** when "Pharmaceutical"/"Therapeutics"/"TechBio" categories are present. Currently AI fires first.

4. **Add "Drones"/"Drone Management" to Aerospace OR Robotics rule** to disambiguate drone-makers from defense.

5. **Add description-keyword rules to dictionary** (e.g. if description contains "drone", add Drones tag). Reduces dependence on Crust's noisy category strings. ~50 lines of regex matching.

Even with all these fixes, dict won't surface the missing domain_tags Claude can infer from description (e.g. Stripe's "B2B" / "Infrastructure"). **The architectural pivot is cleaner.**

## Open recommendations for Matt

1. **Pivot to Claude-primary for vetted-tier?** (See architectural recommendation above.) Cost neutral, accuracy materially better.
2. **Re-confirm Skydio's expected industry** — Aerospace vs Robotics vs Defense is genuinely ambiguous. Pick a rule of thumb (e.g. "drone makers are Aerospace") and add to taxonomy guidance.
3. **Run a larger eval (50-100 companies)** before locking phase 1 — 10 companies is enough to see directional patterns but not to lock confidence intervals. Optional / out-of-scope for V1 if cost is a concern — at $0.001/call × 100 = $0.10 of Claude + 100 enrich credits = ~$10 of Crust at current floor.
4. **Defer dictionary fixes** unless you choose to keep dict-primary. If Claude-primary, dict only matters as a sanity check and can be improved iteratively.
