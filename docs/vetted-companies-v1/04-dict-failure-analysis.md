# Dictionary Failure Pattern Analysis

*Generated: 2026-05-03T14:13:54.351Z*  
*Sample: 10 companies (Inv1 dataset; enrich-tier signals).*  
*Pure offline analysis — no API calls.*

## Aggregate accuracy

- Category: 9/10 (90%)
- Primary industry: 9/10 (90%)
- Domain tags: precision=1.00, recall=0.39 (9/23 expected hit)

## Per-company dict output vs ground truth

| Company | Expected primary | Dict primary | Cat? | Pri? | Reasoning excerpt |
|---|---|---|---|---|---|
| Anduril Industries | Defense | Defense | ✓ | ✓ | PNI="Defense and Space Manufacturing" → hardware (+3); votes: hw=7, non_hw=1; ca... |
| Stripe | FinTech | FinTech | ✓ | ✓ | PNI="Technology, Information and Internet" → non_hardware (+3); votes: hw=0, non... |
| OpenAI | AI | AI | ✓ | ✓ | votes: hw=0, non_hw=10; category=non_hardware (margin 10, conf 0.90); industry=A... |
| Skydio | Aerospace | Aerospace | ✓ | ✓ | PNI="Robotics Engineering" → hardware (+3); votes: hw=7, non_hw=4; category=hard... |
| Shield AI | Defense | ∅ | ✗ | ✗ | PNI="Software Development" → non_hardware (+3); votes: hw=5, non_hw=8; M2: PNI=n... |
| Illumina | Medical Devices | Medical Devices | ✓ | ✓ | votes: hw=4, non_hw=0; category=hardware (margin 4, conf 0.90); industry=Medical... |
| Recursion Pharmaceuticals | Biotech | Biotech | ✓ | ✓ | votes: hw=1, non_hw=6; category=non_hardware (margin 5, conf 0.90); industry=Bio... |
| Hugging Face | AI | AI | ✓ | ✓ | PNI="Software Development" → non_hardware (+3); votes: hw=0, non_hw=13; category... |
| Inflection AI | AI | AI | ✓ | ✓ | PNI="Technology, Information and Internet" → non_hardware (+3); votes: hw=0, non... |
| Astra Space | Aerospace | Aerospace | ✓ | ✓ | PNI="Defense and Space Manufacturing" → hardware (+3); votes: hw=7, non_hw=4; ca... |

## Industry rule fire rates (which dict-rules over-fire)

| Industry rule | Times fired | Correct | Wrong | Wrong cases |
|---|---|---|---|---|
| AI | 3 | 3 | 0 | — |
| Aerospace | 2 | 2 | 0 | — |
| Biotech | 1 | 1 | 0 | — |
| Defense | 1 | 1 | 0 | — |
| FinTech | 1 | 1 | 0 | — |
| Medical Devices | 1 | 1 | 0 | — |

## Industry coverage (how often dict reaches the right industry)

| Expected industry | Sampled | Dict hit | Dict missed | Missed cases |
|---|---|---|---|---|
| AI | 3 | 3 | 0 | — |
| Aerospace | 2 | 2 | 0 | — |
| Biotech | 1 | 1 | 0 | — |
| Defense | 2 | 1 | 1 | Shield AI (got null) |
| FinTech | 1 | 1 | 0 | — |
| Medical Devices | 1 | 1 | 0 | — |

## Domain tag misses (expected tag not in dict output)

### `AI` missed (1 times)
- Shield AI — Crust categories=[National Security, Robotics, Artificial Intelligence, Software, Mechanical Engin...]

### `Autonomous Driving` missed (3 times)
- Anduril Industries — Crust categories=[National Security, Virtual Reality, Military, Augmented Reality, Artificial Inte...]
- Skydio — Crust categories=[Robotics, Artificial Intelligence, Software, Law Enforcement, Drone Management, ...]
- Shield AI — Crust categories=[National Security, Robotics, Artificial Intelligence, Software, Mechanical Engin...]

### `B2B` missed (2 times)
- Stripe — Crust categories=[Finance, InsurTech, SaaS, FinTech, Financial Services, Venture Capital, Mobile P...]
- Hugging Face — Crust categories=[Artificial Intelligence, Software, Foundational AI, Generative AI, Natural Langu...]

### `Consumer` missed (1 times)
- Inflection AI — Crust categories=[Information Technology, Chatbot, Artificial Intelligence, Generative AI, Artific...]

### `Data` missed (1 times)
- Recursion Pharmaceuticals — Crust categories=[Artificial Intelligence, Software, Biotechnology, Artificial Intelligence (AI), ...]

### `DevTools` missed (1 times)
- OpenAI — Crust categories=[Information Technology, Foundational AI, Software, Artificial Intelligence, Gene...]

### `Drones` missed (2 times)
- Anduril Industries — Crust categories=[National Security, Virtual Reality, Military, Augmented Reality, Artificial Inte...]
- Shield AI — Crust categories=[National Security, Robotics, Artificial Intelligence, Software, Mechanical Engin...]

### `Infrastructure` missed (3 times)
- Stripe — Crust categories=[Finance, InsurTech, SaaS, FinTech, Financial Services, Venture Capital, Mobile P...]
- OpenAI — Crust categories=[Information Technology, Foundational AI, Software, Artificial Intelligence, Gene...]
- Recursion Pharmaceuticals — Crust categories=[Artificial Intelligence, Software, Biotechnology, Artificial Intelligence (AI), ...]

## Failure deep-dive (per company that got primary wrong)

### Shield AI
- Expected: `Defense`
- Dict said: `null`
- Crust signals dict had to work with:
  - PNI: `"Software Development"`
  - industries[]: `["Software Development","Technology, Information and Internet","Technology, Information and Media"]`
  - categories[] (first 12): `["National Security","Robotics","Artificial Intelligence","Software","Mechanical Engineering","Security","Drones","Artificial Intelligence (AI)","Machine Learning","Autonomous Vehicles"]`
- Dict reasoning: `PNI="Software Development" → non_hardware (+3); votes: hw=5, non_hw=8; M2: PNI=non_hw but categories favor hw (cat-only votes hw=5/non_hw=5) → null`

## Structural patterns observed

### Domain tag recall is low (39%) primarily because Crust's categories[] field doesn't surface the right strings
Examples:
- Anduril makes drones; Crust categories does not include "Drones" → dict can't add the tag
- Stripe has B2B and Infrastructure as part of its product; Crust categories doesn't include those words → dict can't add the tags
- This is a STRUCTURAL limitation. Dict reads only Crust signals; if Crust doesn't say it, dict can't surface it. Claude reads description + can infer.

### Specific rule-order bugs:
- Defense rule fires too eagerly on broad signals (PNI="Defense and Space Manufacturing", categories including "Law Enforcement"). Drone/space cos that aren't actually defense get tagged Defense.
- AI rule fires before Biotech rule for biotech-with-AI cos (Recursion Pharmaceuticals).
- Aerospace rule doesn't trigger on "Drones"/"Drone Management" categories — drone makers fall through to Defense (Skydio).