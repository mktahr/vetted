# Larger Eval — hand-labeled ground truth (for Matt's review)

*Drafted 2026-05-03 prior to the eval scoring run.*
*Per the no-silent-GT-bugs rule (round-2 had 3 errors on NVIDIA/Tesla/Apple), this file goes through Matt's review BEFORE the eval grades anything.*

## Pull status: 70/70 resolved

Initial pull had 4 entity-disambiguation issues:
- **Hims & Hers** (hims.com) — identify_no_match. Fixed via name search → id=2927584.
- **Slingshot Aerospace** (slingshotaerospace.com) — identify_no_match. Fixed via name search → id=635487.
- **Zoom** (zoom.us) — Crust matched a random Nigerian bank ("Unity Bank Plc") whose LinkedIn profile had a Zoom meeting URL embedded. Fixed via zoom.com domain + LinkedIn URL → id=2247234 (the real Zoom).
- **Amazon** (amazon.com) — Crust returned the AWS subsidiary instead of the Amazon parent. Fixed via name search → id=6034577 (parent Amazon at aboutamazon.com).

All 4 verified with manual cross-check before patching. **0 Crust-misses on the final 70-co set** (better than the 28-co eval which had 1 unrecoverable).

The 4 fixed entries are marked with `[FIX]` in the Notes column below — Matt should know they're using corrected entity ids if the eval results look unusual on those companies.

## How to read this

For each company:
- **Expected category** — `hardware` or `non_hardware`. NEVER `null` (we picked companies that should classify).
- **Expected primary_industry** — single value from the V1 vocabulary's matching category list.
- **Expected industries[]** — primary first, plus secondary industries IF the company genuinely has separate businesses (Option B multi-industry).
- **Expected domain_tags[]** — tags from the matching category's domain-tag list. Per round-2 decision #5, AI tag is suppressed when industry='AI'.
- **`ambiguous: true`** — flagged as "your call" — won't fail-grade if Claude picks a defensible alternative.
- **`out_of_scope_note`** — V1 vocabulary gap; document the best-fit fallback.

## Hardware vocabulary reminder

- **Industries (15)**: Defense, Aerospace, Automotive, Robotics, Medical Devices, Biotech, Energy, Energy Storage, Climate, Semiconductors, Consumer Electronics, Industrial Manufacturing, Materials, Maritime, Other Hardware
- **Domain tags (9)**: Rockets, Satellites, Drones, eVTOL, Autonomous Driving, Automotive Manufacturing, EVs, Nuclear, AI

## Non-hardware vocabulary reminder

- **Industries (13)**: SaaS, AI, FinTech, Investment Banking, Quant/Trading, Blockchain & Web3, Consumer Tech, HealthTech, Biotech, Services, Legal, Defense, Aerospace
- **Domain tags (17)**: Consumer, Infrastructure, Mobile, Cybersecurity, DevTools, B2B, Data, Payments, Productivity, HR, Gaming, Social, Streaming, Marketplace, Analytics, Enterprise Software, AI

---

## HARDWARE (31 companies)

### Automotive

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 1 | Lucid Motors | hardware | Automotive | [Automotive] | [EVs] | |
| 2 | Hyundai | hardware | Automotive | [Automotive] | [EVs, Automotive Manufacturing] | ambiguous (owns Boston Dynamics — Robotics could appear as 2nd industry but Hyundai's PRIMARY business is cars; not adding Robotics) |

### Robotics

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 3 | Skydio | hardware | Robotics | [Robotics, Defense] | [Drones, AI] | |
| 4 | Agility Robotics | hardware | Robotics | [Robotics] | [AI] | |

### Medical Devices

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 5 | Intuitive Surgical | hardware | Medical Devices | [Medical Devices] | [] | |
| 6 | Stryker | hardware | Medical Devices | [Medical Devices] | [] | |
| 7 | Edwards Lifesciences | hardware | Medical Devices | [Medical Devices] | [] | |
| 8 | iRhythm Technologies | hardware | Medical Devices | [Medical Devices] | [AI] | ambiguous (wearable cardiac monitors with AI analytics — could be HealthTech if Crust frames as software-led; expect Medical Devices primary) |

### Biotech (hardware branch — instruments / wet-lab)

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 9 | Illumina | hardware | Biotech | [Biotech] | [] | |
| 10 | 10x Genomics | hardware | Biotech | [Biotech] | [] | |

### Energy

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 11 | NextEra Energy | hardware | Energy | [Energy] | [] | |
| 12 | Helion Energy | hardware | Energy | [Energy] | [Nuclear] | |

### Energy Storage

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 13 | Sila Nanotechnologies | hardware | Energy Storage | [Energy Storage, Materials] | [] | ambiguous (Materials could be primary if Crust calls it materials science co; expect Energy Storage primary since the product is battery anodes) |

### Climate (deliberate retest of round-3 Climeworks failure)

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 14 | Twelve | hardware | Climate | [Climate] | [] | RETEST: should NOT land Energy. If Claude says Energy, the Climeworks failure is systemic. |
| 15 | Charm Industrial | hardware | Climate | [Climate] | [] | RETEST: same as Twelve. |

### Semiconductors

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 16 | AMD | hardware | Semiconductors | [Semiconductors] | [AI] | |
| 17 | Groq | hardware | Semiconductors | [Semiconductors] | [AI] | |

### Consumer Electronics

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 18 | Sonos | hardware | Consumer Electronics | [Consumer Electronics] | [] | |
| 19 | GoPro | hardware | Consumer Electronics | [Consumer Electronics] | [] | |

### Industrial Manufacturing

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 20 | Built Robotics | hardware | Industrial Manufacturing | [Industrial Manufacturing, Robotics] | [AI] | ambiguous (Robotics could swap with Industrial Manufacturing as primary; their product IS robots, but applied to construction/Industrial Mfg) |

### Materials

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 21 | Boston Metal | hardware | Materials | [Materials] | [] | |
| 22 | Mosaic Materials | hardware | Materials | [Materials, Climate] | [] | ambiguous (DAC sorbent — could be Climate primary; expect Materials since the IP is the material itself) — `?Crust` |

### Maritime (deliberate retest of round-3 Saildrone failure)

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 23 | Saronic Technologies | hardware | Maritime | [Maritime, Defense] | [Drones, Autonomous Driving] | RETEST: should NOT land Defense (Saildrone failed this way). |
| 24 | ThayerMahan | hardware | Maritime | [Maritime, Defense] | [] | RETEST: undersea sensing for Navy — same pattern. — `?Crust` |

### Defense (hardware branch)

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 25 | Anduril Industries | hardware | Defense | [Defense, Aerospace, Maritime, Industrial Manufacturing] | [Drones, AI] | RE-INCLUDE — confirms Maritime industry firing on fresh pull |
| 26 | Lockheed Martin | hardware | Defense | [Defense, Aerospace, Maritime, Industrial Manufacturing] | [Rockets, Satellites] | Industrial Manufacturing added per Matt — same logic as Anduril/Tesla/SpaceX (mfg at scale = real business) |
| 27 | Shield AI | hardware | Defense | [Defense, Aerospace] | [Drones, AI] | |
| 28 | Northrop Grumman | hardware | Defense | [Defense, Aerospace] | [Rockets, Satellites] | |

### Aerospace (hardware branch)

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 29 | Astranis Space Technologies | hardware | Aerospace | [Aerospace] | [Satellites] | |
| 30 | Vast Space | hardware | Aerospace | [Aerospace] | [] | — `?Crust` |

### Other Hardware

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 31 | Carbon | hardware | Other Hardware | [Other Hardware, Industrial Manufacturing] | [] | ambiguous (industrial 3D printing — could be Industrial Manufacturing primary; expect Other Hardware since they're a printer manufacturer) |

---

## NON-HARDWARE (29 companies)

### SaaS

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 32 | Datadog | non_hardware | SaaS | [SaaS] | [Infrastructure, B2B, Enterprise Software, Analytics] | |
| 33 | Snowflake | non_hardware | SaaS | [SaaS] | [Data, B2B, Enterprise Software, Analytics, Infrastructure] | |
| 34 | MongoDB | non_hardware | SaaS | [SaaS] | [Infrastructure, DevTools, B2B, Enterprise Software] | |
| 35 | Cloudflare | non_hardware | SaaS | [SaaS] | [Infrastructure, Cybersecurity, B2B, Enterprise Software, AI] | |

### AI

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 36 | Anthropic | non_hardware | AI | [AI] | [B2B, Infrastructure] | AI-suppression test: NO AI in domain_tags |
| 37 | OpenAI | non_hardware | AI | [AI] | [Consumer, B2B] | AI-suppression test |
| 38 | Mistral AI | non_hardware | AI | [AI] | [B2B, Infrastructure] | AI-suppression test |
| 39 | Perplexity | non_hardware | AI | [AI] | [Consumer] | AI-suppression test |

### FinTech

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 40 | Stripe | non_hardware | FinTech | [FinTech] | [Payments, Infrastructure, B2B] | |
| 41 | Plaid | non_hardware | FinTech | [FinTech] | [Infrastructure, B2B] | |
| 42 | Mercury | non_hardware | FinTech | [FinTech] | [B2B] | |

### Investment Banking

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 43 | Goldman Sachs | non_hardware | Investment Banking | [Investment Banking, Quant/Trading] | [] | ambiguous (asset management could justify other industries but V1 doesn't have asset mgmt as a slot) |

### Quant/Trading

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 44 | Citadel | non_hardware | Quant/Trading | [Quant/Trading] | [] | |
| 45 | Jane Street | non_hardware | Quant/Trading | [Quant/Trading] | [] | |

### Blockchain & Web3

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 46 | Coinbase | non_hardware | Blockchain & Web3 | [Blockchain & Web3, FinTech] | [Consumer, Marketplace] | ambiguous (could be FinTech primary if Crust frames as exchange/payments; expect Blockchain & Web3 primary since their entire value-prop is crypto) |
| 47 | Chainalysis | non_hardware | Blockchain & Web3 | [Blockchain & Web3] | [Analytics, Cybersecurity, B2B] | |

### Consumer Tech

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 48 | Airbnb | non_hardware | Consumer Tech | [Consumer Tech] | [Marketplace, Consumer] | |
| 49 | Discord | non_hardware | Consumer Tech | [Consumer Tech] | [Social, Consumer, Gaming] | |
| 50 | Roblox | non_hardware | Consumer Tech | [Consumer Tech] | [Gaming, Consumer, Social] | |

### HealthTech

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 51 | Hims & Hers | non_hardware | HealthTech | [HealthTech] | [Consumer] | [FIX] re-identified by name |
| 52 | Oscar Health | non_hardware | HealthTech | [HealthTech] | [Consumer, B2B] | |

### Biotech (non-hardware branch)

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 53 | Recursion Pharmaceuticals | non_hardware | Biotech | [Biotech] | [AI, Data] | |
| 54 | Tempus AI | non_hardware | Biotech | [Biotech, HealthTech] | [AI, Data] | ambiguous (Biotech vs HealthTech boundary — Tempus does both clinical + drug discovery; expect Biotech primary because they're TechBio in spirit) |

### Services

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 55 | Accenture | non_hardware | Services | [Services] | [B2B, Enterprise Software] | |
| 56 | McKinsey & Company | non_hardware | Services | [Services] | [B2B] | — `?Crust` |

### Legal

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 57 | Harvey AI | non_hardware | Legal | [Legal] | [AI, B2B, Enterprise Software] | ambiguous (could legitimately be AI primary since Legal+AI is the core product; expect Legal primary because the category they sell to is the salient identity) |

### Defense (non-hardware branch)

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 58 | Govini | non_hardware | Defense | [Defense] | [Analytics, Data, B2B] | — `?Crust` |

### Aerospace (non-hardware branch)

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 59 | Slingshot Aerospace | non_hardware | Aerospace | [Aerospace, Defense] | [Analytics, Data, B2B] | [FIX] re-identified by name |
| 60 | LeoLabs | non_hardware | Aerospace | [Aerospace, Defense] | [Analytics, Data, B2B] | — `?Crust` |

---

## EDGE CASES (10 companies — DELIBERATE STRESS TESTS)

### AI-feature-not-core (3 — should NOT get AI domain_tag)

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 61 | Asana | non_hardware | SaaS | [SaaS] | [Productivity, B2B, Enterprise Software] | OUT-OF-SCOPE NOTE: AI Companion is a feature, NOT the core product. NO AI tag. |
| 62 | Zoom | non_hardware | SaaS | [SaaS] | [B2B, Productivity, Enterprise Software] | OUT-OF-SCOPE NOTE: same as Asana. NO AI tag. [FIX] zoom.us domain matched a Nigerian bank; re-identified via zoom.com domain |
| 63 | Salesforce | non_hardware | SaaS | [SaaS] | [B2B, Enterprise Software] | OUT-OF-SCOPE NOTE: Agentforce is a feature, core is CRM. NO AI tag. |

### Extreme multi-industry stress (3)

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 64 | Amazon | non_hardware | Consumer Tech | [Consumer Tech, SaaS] | [Marketplace, Consumer, Streaming, Infrastructure] | OUT-OF-SCOPE NOTE: extreme multi-industry. Devices (Echo/Kindle) are feature, not separate industry slot. Whole Foods/Pharmacy out-of-scope. [FIX] amazon.com domain returned AWS subsidiary; re-identified by name as parent Amazon |
| 65 | Microsoft | non_hardware | SaaS | [SaaS, Consumer Electronics] | [B2B, Enterprise Software, Productivity, Infrastructure, Gaming, AI] | OUT-OF-SCOPE NOTE: Xbox + Surface = Consumer Electronics secondary. Could also justify Cybersecurity tag. |
| 66 | Sony | hardware | Consumer Electronics | [Consumer Electronics] | [] | OUT-OF-SCOPE NOTE: Gaming + Streaming + Music are NOT in V1 industries; primary stays Consumer Electronics. domain_tags Gaming/Streaming are non-hardware-only — INVALID for hardware company. So tags=[]. ambiguous. |

### Out-of-scope industries (3)

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 67 | Verizon | non_hardware | Services | [Services] | [Consumer, Infrastructure] | OUT-OF-SCOPE NOTE: Telecommunications gap. Best-fit Services. ambiguous (could also be Consumer Tech). |
| 68 | Spotify | non_hardware | Consumer Tech | [Consumer Tech] | [Streaming, Consumer, Mobile] | OUT-OF-SCOPE NOTE: Streaming/Music as primary not in V1; lands Consumer Tech with Streaming domain_tag. |
| 69 | WeWork | non_hardware | Services | [Services] | [B2B] | OUT-OF-SCOPE NOTE: Real Estate gap. Best-fit Services. ambiguous. |

### Buffer / re-include (1)

| # | Company | category | primary | industries | domain_tags | flags |
|---|---|---|---|---|---|---|
| 70 | Palantir | non_hardware | Defense | [Defense, AI] | [Data, Analytics, Infrastructure, AI] | RE-INCLUDE — same GT as round-3, confirms cross-listed Defense/non-hardware behavior is stable across runs |

---

## What I need from Matt (review checklist)

For each row, check:
1. **Category right?** (hardware/non_hardware)
2. **Primary industry right?** Does it match what a recruiter would search for first?
3. **Industries[] complete and not over-stuffed?** Multi-industry only when the company has separate businesses, not when something is a "feature".
4. **Domain tags right?** Don't include tags for capabilities that are just features. AI tag suppressed when primary=AI.
5. **Ambiguous flags fair?** I marked 11 as ambiguous (Hyundai, iRhythm, Sila, Built Robotics, Mosaic Materials, Carbon, Goldman, Coinbase, Tempus, Harvey, Sony, Verizon, WeWork, Roblox? — recount before sending). Defensible alternatives won't fail-grade.

**Specific flags to look at:**
- Skydio: I'm calling this Robotics primary even though they're drone-focused; alternative is Defense primary. Your call?
- Stryker: should they be multi-industry? Surgical + Endoscopy + Spine etc. — those are sub-MedDev categories, not separate V1 industries. Sticking with single industry.
- Helion: Nuclear domain_tag — should also fire on fusion (it's nuclear fusion). ✓
- Lockheed: I left out Industrial Manufacturing from the industries[] — they DO build aircraft/missiles industrially, but it's part of Defense/Aerospace business not separate. Your call?
- Sony as hardware: domain_tags has to be [], because Gaming/Streaming are non-hardware tags only. This is a known V1 vocabulary friction. Worth flagging in eval as a "future fix" if Claude legitimately wants to tag PlayStation as Gaming.
- Coinbase: Blockchain & Web3 primary OR FinTech primary? I went Blockchain & Web3.
- Harvey AI: Legal primary OR AI primary? I went Legal.

Once approved I'll convert this into the GROUND_TRUTH constant in `scripts/_inv2-larger-eval-grade.ts`, run the eval, and write the report.
