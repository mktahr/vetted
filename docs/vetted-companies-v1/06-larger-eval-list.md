# Larger eval — proposed company list (~70 cos) for Matt's review

*Drafted 2026-05-03 after round-3 expansion eval.*
*Architecture under test: Claude-primary + dict sanity check + C1+C2 fixes.*

## Sourcing approach

**Coverage matrix.** Every distinct (industry, category) cell in the V1 vocabulary gets at least one example, ideally 2-3:
- Hardware industries: 15 slots — 31 companies covering all 15
- Non-hardware industries: 13 slots — 29 companies covering all 13
- Cross-listed cells (Defense, Aerospace, Biotech) tested in BOTH branches

**Tier mix.** ~35 well-known / ~25 mid-tier / ~10 early-stage. Well-known tilt is intentional — they have the cleanest Crust enrich data, so failures are more attributable to tagger logic than data noise.

**Multi-industry.** ~20 deliberately multi-industry companies (~30%) to keep pressure on Option B output.

**Edge cases.** 9 deliberate cases that should expose remaining issues:
- 3 AI-feature-not-core (Asana / Zoom / Salesforce — should land at SaaS, NO AI tag)
- 3 extreme multi-industry (Amazon / Microsoft / Sony)
- 3 out-of-scope (Verizon=Telecom, Spotify=Streaming/Music, WeWork=RealEstate)

**Bias check.** I deliberately INCLUDED known-failure boundaries from round-3:
- Climate-vs-Energy boundary: Twelve, Charm, Mosaic Materials (3 more chances to misclassify like Climeworks did)
- Maritime-vs-Defense boundary: Saronic, ThayerMahan (more chances to misclassify like Saildrone did)
- AI-suppression: Asana, Zoom, Salesforce (more chances to over-tag AI like avoided in Notion)

If round-4 still hits 100% on these, those round-3 failures were one-off. If round-4 hits multiple, they're systemic and warrant fixes.

## Crust-availability risk

A few entries on this list may not exist in Crust's DB (Rebellion Defense was missing from the 27-co set). Marked `?Crust` next to higher-risk entries. If a company doesn't resolve, it gets dropped from scoring with a note — same pattern as Rebellion.

## Estimated cost

70 cos × 1 enrich credit = **~$7** in Crust credits. ~$1 in Anthropic Haiku. Wall clock: ~10 min eval + ~5 min pull = ~15 min.

---

## The list (70 companies)

### HARDWARE (31 companies)

#### Automotive (2 — additional to round-3's Tesla / Rivian / Slate Auto)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 1 | Lucid Motors | well-known | single | lucidmotors.com | Automotive | Pure EV |
| 2 | Hyundai | well-known | multi-industry | hyundai.com | Automotive | Owns Boston Dynamics — multi-industry stress (Auto + Robotics) |

#### Robotics (2 — additional to round-3's Boston Dynamics / Figure / 1X)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 3 | Skydio | mid-tier | multi-industry | skydio.com | Robotics | Drones — could land Defense (military USVs); industries=[Robotics, Defense] |
| 4 | Agility Robotics | mid-tier | single | agilityrobotics.com | Robotics | Humanoid (Digit) |

#### Medical Devices (4 — NEW, no prior coverage)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 5 | Intuitive Surgical | well-known | single | intuitive.com | Medical Devices | da Vinci robotic surgery |
| 6 | Stryker | well-known | single | stryker.com | Medical Devices | Orthopedics, neurotech — wide MedDev portfolio |
| 7 | Edwards Lifesciences | well-known | single | edwards.com | Medical Devices | Heart valves |
| 8 | iRhythm Technologies | mid-tier | single | irhythmtech.com | Medical Devices | Wearable cardiac monitors — MedDev vs HealthTech boundary |

#### Biotech / hardware (2 — NEW, no prior coverage)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 9 | Illumina | well-known | single | illumina.com | Biotech | Sequencing instruments — tests Biotech/hardware branch |
| 10 | 10x Genomics | mid-tier | single | 10xgenomics.com | Biotech | Single-cell instruments |

#### Energy (2 — additional to round-3's Commonwealth Fusion)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 11 | NextEra Energy | well-known | single | nexteraenergy.com | Energy | Utility-scale renewable |
| 12 | Helion Energy | early-stage | single | helionenergy.com | Energy | Fusion startup — domain_tag Nuclear test |

#### Energy Storage (1 — additional to round-3's Form / Antora)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 13 | Sila Nanotechnologies | mid-tier | single | silanano.com | Energy Storage | Anode materials — Materials boundary |

#### Climate (2 — additional to round-3's Climeworks / Heirloom; deliberate retest of round-3 failure boundary)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 14 | Twelve | early-stage | single | twelve.co | Climate | CO2-to-fuel — should NOT land at Energy (Climeworks failure pattern) |
| 15 | Charm Industrial | early-stage | single | charmindustrial.com | Climate | Bio-oil sequestration |

#### Semiconductors (2 — additional to round-3's NVIDIA / Cerebras / Tenstorrent)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 16 | AMD | well-known | single | amd.com | Semiconductors | CPUs/GPUs |
| 17 | Groq | mid-tier | single | groq.com | Semiconductors | AI inference chips — AI-as-domain-tag test |

#### Consumer Electronics (2 — additional to round-3's Apple / Humane)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 18 | Sonos | well-known | single | sonos.com | Consumer Electronics | Smart speakers |
| 19 | GoPro | well-known | single | gopro.com | Consumer Electronics | Action cameras |

#### Industrial Manufacturing (1 — additional to round-3's Hadrian / John Deere)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 20 | Built Robotics | early-stage | multi-industry | builtrobotics.com | Industrial Manufacturing | Autonomous construction equipment — Robotics edge |

#### Materials (2 — NEW as primary; was secondary on Boom Supersonic)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 21 | Boston Metal | early-stage | single | bostonmetal.com | Materials | Green steel — Materials primary test |
| 22 | Mosaic Materials | early-stage | single | mosaicmaterials.com | Materials | DAC sorbent materials — Materials vs Climate boundary `?Crust` |

#### Maritime (2 — additional to round-3's Saildrone; deliberate retest of round-3 failure boundary)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 23 | Saronic Technologies | mid-tier | multi-industry | saronic.com | Maritime | Autonomous USVs — should NOT land Defense (Saildrone failure pattern); industries=[Maritime, Defense] |
| 24 | ThayerMahan | early-stage | single | thayermahan.com | Maritime | Undersea sensing `?Crust` |

#### Defense / hardware (4 — re-include Anduril)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 25 | Anduril Industries | well-known | multi-industry | anduril.com | Defense | RE-INCLUDE — re-test Maritime industry firing in fresh pull |
| 26 | Lockheed Martin | well-known | multi-industry | lockheedmartin.com | Defense | Full conglomerate — industries=[Defense, Aerospace, Maritime] |
| 27 | Shield AI | mid-tier | multi-industry | shield.ai | Defense | Defense + AI core — industries=[Defense, Aerospace], domain_tags=[AI, Drones] |
| 28 | Northrop Grumman | well-known | multi-industry | northropgrumman.com | Defense | industries=[Defense, Aerospace] |

#### Aerospace / hardware (2 — additional to round-3's SpaceX / Boom / Stoke / Joby)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 29 | Astranis Space Technologies | mid-tier | single | astranis.com | Aerospace | Geo satellites — domain_tag Satellites test |
| 30 | Vast Space | early-stage | single | vastspace.com | Aerospace | Space stations `?Crust` |

#### Other Hardware (1 — NEW)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 31 | Carbon | mid-tier | single | carbon3d.com | Other Hardware | Industrial 3D printing — could also be Industrial Manufacturing; ambiguous |

### NON-HARDWARE (29 companies)

#### SaaS (4 — additional to round-3's Notion)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 32 | Datadog | well-known | single | datadoghq.com | SaaS | Observability — domain_tags=[Infrastructure, B2B, Enterprise Software, Analytics] |
| 33 | Snowflake | well-known | multi-industry | snowflake.com | SaaS | Data cloud — multi-element output test |
| 34 | MongoDB | well-known | single | mongodb.com | SaaS | Database |
| 35 | Cloudflare | well-known | multi-industry | cloudflare.com | SaaS | Edge + Security + AI — industries could be [SaaS] with domain_tags=[Infrastructure, Cybersecurity, AI] |

#### AI (4 — additional to round-3's Mercor / Scale AI)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 36 | Anthropic | well-known | single | anthropic.com | AI | Foundation models — AI-suppression test |
| 37 | OpenAI | well-known | multi-industry | openai.com | AI | Foundation models + ChatGPT consumer — industries=[AI] or [AI, Consumer Tech]? |
| 38 | Mistral AI | mid-tier | single | mistral.ai | AI | Open-weights foundation models |
| 39 | Perplexity | mid-tier | single | perplexity.ai | AI | AI search |

#### FinTech (3 — NEW)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 40 | Stripe | well-known | single | stripe.com | FinTech | Payments — domain_tags=[Payments, Infrastructure] |
| 41 | Plaid | well-known | single | plaid.com | FinTech | Bank account linking |
| 42 | Mercury | mid-tier | single | mercury.com | FinTech | Banking-as-a-service |

#### Investment Banking (1 — NEW)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 43 | Goldman Sachs | well-known | multi-industry | goldmansachs.com | Investment Banking | IB + Asset Mgmt + Trading; industries=[Investment Banking, Quant/Trading] |

#### Quant/Trading (2 — NEW)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 44 | Citadel | well-known | multi-industry | citadel.com | Quant/Trading | Quant + market-making (Citadel Securities sister co) |
| 45 | Jane Street | well-known | single | janestreet.com | Quant/Trading | Pure quant trading |

#### Blockchain & Web3 (2 — NEW)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 46 | Coinbase | well-known | single | coinbase.com | Blockchain & Web3 | Exchange — vs FinTech boundary |
| 47 | Chainalysis | mid-tier | single | chainalysis.com | Blockchain & Web3 | Compliance analytics — vs FinTech / Defense boundary |

#### Consumer Tech (3 — NEW)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 48 | Airbnb | well-known | single | airbnb.com | Consumer Tech | Marketplace |
| 49 | Discord | well-known | single | discord.com | Consumer Tech | Messaging |
| 50 | Roblox | well-known | multi-industry | roblox.com | Consumer Tech | Gaming + Consumer + AI; industries=[Consumer Tech]; domain_tags=[Gaming] |

#### HealthTech (2 — NEW)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 51 | Hims & Hers | well-known | single | hims.com | HealthTech | Telehealth + DTC pharma |
| 52 | Oscar Health | well-known | single | hioscar.com | HealthTech | Health insurance tech |

#### Biotech / non-hardware (2 — NEW)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 53 | Recursion Pharmaceuticals | mid-tier | single | recursion.com | Biotech | AI drug discovery — TechBio platform |
| 54 | Tempus AI | mid-tier | multi-industry | tempus.com | Biotech | AI clinical genomics — Biotech vs HealthTech vs AI |

#### Services (2 — NEW)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 55 | Accenture | well-known | single | accenture.com | Services | Consulting |
| 56 | McKinsey & Company | well-known | single | mckinsey.com | Services | Consulting `?Crust` |

#### Legal (1 — NEW)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 57 | Harvey AI | early-stage | single | harvey.ai | Legal | Legal AI — Legal vs AI boundary; expect Legal primary, AI domain_tag |

#### Defense / non-hardware (1 — additional to round-3's Palantir)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 58 | Govini | mid-tier | single | govini.com | Defense | Defense analytics SaaS `?Crust` |

#### Aerospace / non-hardware (2 — NEW)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 59 | Slingshot Aerospace | mid-tier | single | slingshotaerospace.com | Aerospace | Space domain awareness — expect non_hw Aerospace |
| 60 | LeoLabs | mid-tier | single | leolabs.space | Aerospace | Space situational awareness `?Crust` |

### EDGE CASES (10 companies — DELIBERATE STRESS TESTS)

#### AI-feature-not-core (3 — should NOT get AI domain_tag)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 61 | Asana | well-known | single | asana.com | SaaS | Productivity SaaS with AI features. Expect SaaS, domain_tags=[Productivity, B2B], NO AI tag. |
| 62 | Zoom | well-known | single | zoom.us | SaaS | Video + AI Companion. Expect SaaS, domain_tags=[B2B, Productivity], NO AI tag. |
| 63 | Salesforce | well-known | multi-industry | salesforce.com | SaaS | CRM + Cloud + Agentforce. Expect SaaS, domain_tags=[B2B, Enterprise Software], NO AI tag. |

#### Extreme multi-industry stress (3)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 64 | Amazon | well-known | multi-industry | amazon.com | Consumer Tech | Marketplace + AWS + Devices + Streaming. Expect industries=[Consumer Tech, SaaS]; primary=Consumer Tech |
| 65 | Microsoft | well-known | multi-industry | microsoft.com | SaaS | Cloud + Productivity + Gaming + Devices. Expect industries=[SaaS, Consumer Electronics] or [SaaS]; primary=SaaS |
| 66 | Sony | well-known | multi-industry | sony.com | Consumer Electronics | Devices + Gaming + Streaming + Music. Expect industries=[Consumer Electronics]; domain_tags=[Gaming, Streaming] |

#### Out-of-scope industries (3 — should fall to nearest V1 fit, NOT null)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 67 | Verizon | well-known | single | verizon.com | Services | OUT-OF-SCOPE: Telecommunications gap. Should fall to Services or null. |
| 68 | Spotify | well-known | single | spotify.com | Consumer Tech | OUT-OF-SCOPE: Streaming/Music as primary. Should land Consumer Tech with domain_tags=[Streaming, Consumer]. |
| 69 | WeWork | well-known | single | wework.com | Services | OUT-OF-SCOPE: Real Estate gap. Should fall to Services or null. |

#### Buffer slot (1)
| # | Company | Tier | Sub | Domain | Expected primary | Notes |
|---|---|---|---|---|---|---|
| 70 | Palantir | well-known | multi-industry | palantir.com | Defense | RE-INCLUDE — confirms cross-listed Defense/non-hardware behavior is stable across runs (round-3 disagree-but-correct outcome) |

---

## Coverage matrix summary

| Cell | This list | Round-3 set | Total |
|---|---|---|---|
| HW Defense | 4 | 0 (Anduril was inv1) | 4 |
| HW Aerospace | 2 | 4 | 6 |
| HW Automotive | 2 | 3 | 5 |
| HW Robotics | 2 | 3 | 5 |
| HW Medical Devices | 4 | 0 | 4 |
| HW Biotech | 2 | 0 | 2 |
| HW Energy | 2 | 1 | 3 |
| HW Energy Storage | 1 | 2 | 3 |
| HW Climate | 2 | 2 | 4 |
| HW Semiconductors | 2 | 3 | 5 |
| HW Consumer Electronics | 2 | 2 | 4 |
| HW Industrial Manufacturing | 1 | 2 | 3 |
| HW Materials | 2 | 0 (only secondary) | 2 |
| HW Maritime | 2 | 1 | 3 |
| HW Other Hardware | 1 | 0 | 1 |
| NH SaaS | 4+3 (incl. AI-feature) | 1 | 8 |
| NH AI | 4 | 2 | 6 |
| NH FinTech | 3 | 0 | 3 |
| NH Investment Banking | 1 | 0 | 1 |
| NH Quant/Trading | 2 | 0 | 2 |
| NH Blockchain & Web3 | 2 | 0 | 2 |
| NH Consumer Tech | 3+1 (Spotify) | 0 | 4 |
| NH HealthTech | 2 | 0 | 2 |
| NH Biotech | 2 | 0 | 2 |
| NH Services | 2+2 (Verizon/WeWork) | 0 | 4 |
| NH Legal | 1 | 0 | 1 |
| NH Defense | 1+1 (re-Palantir) | 1 | 3 |
| NH Aerospace | 2 | 0 | 2 |

All 28 distinct (industry, category) cells have ≥1 example after this list runs. ✓

---

## What I need from you (one decision)

1. **Approve this list as-is?** Or want any swaps / additions / removals?
2. **Want me to move companies between tiers?** (e.g., I marked Hyundai well-known/multi — you might call that single)
3. **Drop the `?Crust`-flagged risky entries** (Mosaic Materials, ThayerMahan, McKinsey, Govini, LeoLabs, Vast Space) **upfront**, or keep and let them surface as Crust-misses in the eval?

Once approved I'll:
1. Write `scripts/_inv2-larger-eval-pull.mjs` (mirror of the 27-co pull)
2. Run pull (~5 min, ~$7 Crust credits)
3. Hand-label ground truth in `scripts/_inv2-larger-eval-grade.ts`
4. **SHOW YOU GROUND TRUTH** for review before scoring (no silent GT bugs)
5. Run eval, write report to `docs/vetted-companies-v1/06-larger-eval.md`
6. Report back, await your final-eval review before merge to main
