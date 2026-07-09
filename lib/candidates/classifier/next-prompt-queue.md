# Next prompt version queue (post-cls-2026-07-08a)

`cls-2026-07-08a` is FROZEN (2026-07-08: holdout accepted at 82.1% raw / ~96%
rule-conformance). Rules below are Matt-approved (2026-07-08) and land in the
NEXT prompt version, bumped when the freeze lifts (after the POOL run + merge
sequencing). Every specialty named here verified ACTIVE in the dev dictionary.

## 1. Solutions Engineer / Solutions Architect — bimodal, route by EVIDENCE

Replaces Rule 5's blanket "Solutions/Forward-Deployed → software" (holdout
evidence: the blanket rule is the title-trap again — the title is bimodal).

- → `software_engineering[solutions_engineering]` ONLY with real engineering
  evidence: prior evidenced software-engineering roles in the career, AND/OR
  descriptions with genuine building language (built/implemented/shipped
  integrations, wrote code, APIs, technical implementations they created).
  Supporting (weaker, never decisive alone): CS/engineering degree.
- → `unknown` (excluded, like sales) on AFFIRMATIVE counter-evidence only:
  presales / demo / POC-support / quota / customer-call language in the role's
  own text or the career. A language name-drop (e.g. Python in passing) does NOT
  clear the engineering bar without prior SWE roles or real dev descriptions.
- → no evidence either way — including the common "Solutions title + empty
  description + no prior evidenced SWE roles" shape — ABSTAIN (fails safe to
  needs_review). ABSENCE of engineering proof is NOT counter-evidence; only
  affirmative sales signals earn `unknown`. (Codex-flagged ambiguity, fixed
  2026-07-08.)
- CANONICAL COUNTER-CASE (Lucas U., holdout): Solutions Architect @ Anthropic +
  Solutions Engineer ×2 @ Retool, all descriptions empty, career = Project
  Engineer / UCSD RA-TA / Event Manager → ABSTAIN on all three. Neither
  force-classify (old blanket rule) nor exclude (no affirmative sales signal).

Rationale: `solutions_engineering` is for the ENGINEERING kind of solutions
person (Palantir/Retool-style builders); the sales kind was never meant to be
in the pool — exclusion handles them, no separate function needed.

Holdout validation (2026-07-08): Lucas U.'s three abstentions (Solutions
Architect @ Anthropic, Solutions Engineer ×2 @ Retool) were CORRECT under this
reading — all descriptions empty, no prior evidenced SWE roles (career: Project
Engineer @ General Atomics, UCSD RA/TA, Event Manager). The old blanket rule
would have force-classified on zero evidence.

## 2. Forward-Deployed Engineer → software_engineering[forward_deployed_engineering]

Consistent real archetype (ships code at customer sites). Candidate for a
DETERMINISTIC title rule (exact FDE-titled roles only) — Claude concurs it is
safe on the exact title; implement prompt-side at the next bump (a code rule
would duplicate what the prompt owns; revisit only if the next holdout shows
the prompt missing it). Title variants (Codex): match BOTH "Forward Deployed
Engineer" and "Forward-Deployed Engineer" (fixture data uses the unhyphenated
form); "Forward Deployed Software Engineer" also counts.

## 3. Architect — never a blanket route; disambiguate by domain word + work

- Systems Architect (requirements/integration/MBSE work) →
  `systems_engineering[systems_architecture_engineering]`
- Software / Cloud / AWS Architect (designs software or cloud infra) →
  `software_engineering` [infrastructure_engineering / platform_engineering /
  distributed_systems_engineering per the work]
- Data Architect → `data_engineering[data_platform_engineering]`
  (specialty is multi-parent [data, software] — parent guard satisfied either way)
- Chip/Hardware Architect → `chip_engineering[chip_architecture_engineering]` /
  `hardware_engineering` per the work
- Presales "Solutions Architect" with no building evidence → `unknown` (rule 1)
- Building/construction Architect (real-estate domain) → `unknown` (not in pool)
- Bare "Architect", no evidence → ABSTAIN

## 4. Frontier-lab research titles — the POOL run's biggest miss class (6 cases)

"Research Engineer @ Anthropic" (×2), "Research Fellow @ Anthropic", "Member of
Technical Staff @ OpenAI", "AI Alignment Researcher @ MATS" → Haiku abstained
to `unknown` (ref: ml_engineering). With empty descriptions, Rule 5's
"Research Scientist building models vs paper-only → unknown" pushes to
abstention — but "Research Engineer" at a frontier AI lab is a clearly-
engineering title (the don't-abstain corollary SHOULD fire) and these
candidates are exactly Vetted's target pool. Next version: an explicit
frontier-lab clarifier — Research Engineer / MTS / Research Fellow at an
AI-lab employer (Anthropic/OpenAI/DeepMind/MATS-style) → `ml_engineering`
unless the role's own text shows otherwise. ("Co-Founder and Chief Architect"
stays leadership/founder-routed.)

## 5. Robotics carve-out boundary — AV/sensor companies (POOL, ~4 cases)

"Lidar Software Engineer @ Aurora", "SWE Intern @ Blackmore (lidar)",
"SDE Intern @ Amazon Robotics" → Haiku routed robotics_engineering (refs:
software, pre-carve-out). Arguable both ways — described perception/sensor
work IS robot-stack under the carve-out's "or the role's own described work"
clause. One likely REAL bleed: "Embedded Software Engineer II @ Blackmore" →
robotics (should be firmware_engineering[embedded] per the embedded rule —
embedded beats the carve-out). Next version: state the precedence explicitly
(embedded/firmware rule > robotics carve-out).

## Also queued (noted 2026-07-08, non-blocking pool-boundary calls — Matt decides)

- Sysadmin / IT-infrastructure / GTM Engineer / Prompt Engineer: holdout
  abstentions accepted as fail-safe for now; explicit routing TBD.
- "Structures Test Engineering Intern" pull (aerospace vs test_engineering
  function routing) — 2 holdout cases, same person, arguable.
- COBOL app-dev abstention ("Developed Insurance Application in COBOL" →
  unknown) — a real miss; consider an explicit "legacy-language app development
  IS software_engineering" clarifier.
