# Skills-dictionary expansion — kickoff prompt (Phase 2 expansion arc)

> Built 2026-07-09→12 in a dedicated planning session (Claude Code + Codex pressure-tested;
> Codex caught the exit-code-lies-for-the-hint-gate bug now encoded in the gate rules).
> USAGE: paste the ENTIRE block below into a fresh Claude Code session (model: Fable) in this repo.
> Sequencing context: this is step 1 of the agreed order — skills expansion → storage refactor →
> dept-vs-role design pass → non-eng taxonomy expansion → non-eng hint backfill.
> See skills-expansion-outline.md + taxonomy-tree-draft.md in this folder for the later steps.

---

Dedicated Claude Code session, one job: exhaustive, correct coverage of the SKILLS dictionary for Vetted, across every role a tech company hires. Nothing else happens in this session. Thoroughness over speed — take as long as you need per domain.

You are running INSIDE the vetted repo in VS Code. You have the files, the database, WebSearch, and the sync gate. Do NOT work from pasted attachments — read, query, and verify everything yourself.

=== COVERAGE DEFINITION — what "every role" means (the boundary of this entire initiative) ===
Vetted covers the TECH INDUSTRY: tech companies and tech startups — hardware, software, AI/ML, fintech, banking tech, biotech, defense, aerospace, climate, gaming, robotics, semiconductors, space, healthcare tech, and the subdomains inside them.
A function/domain/skill is IN SCOPE if and only if it belongs to a role that a venture-scale tech company or tech startup hires for. The test for any role or domain you're unsure about: "Would this role plausibly appear on the careers page of a tech company or tech startup?" If yes → in scope. If it only exists outside tech (retail floor operations, hospitality, food service, clinical practice at a hospital, construction trades) → OUT of scope, even if it's a real profession. Note the distinction: biotech/clinical COMPETENCIES at a biotech company (clinical trial ops, regulatory affairs) are IN; being a practicing nurse at a hospital is OUT.
This boundary governs every "…and anything I haven't named" instruction below — expansion is expected, but only WITHIN this boundary.

=== NOTHING IN THIS PROMPT IS AN EXHAUSTIVE LIST ===
Every list in this prompt — the domain sequences, the examples, the sub-category illustrations — is a STARTING SCAFFOLD, never the universe. Do not treat any of it as ground truth for what exists. That is why PHASE 0 (below) exists: YOU build the real coverage map through research, and Matt approves it before any rows are written. If your researched map disagrees with or exceeds the seed lists here, your map wins (within the coverage boundary above).

=== READ FIRST (do this before proposing anything) ===
1. Read all 7 skills CSVs: reference/skills/{programming_language,framework,tool,domain,protocol,hardware,methodology}.csv — 196 rows today, schema:
   canonical_name, category, aliases, primary_specialty, description, is_active, is_searchable
   - aliases and primary_specialty are SEMICOLON-separated within the field.
   - The CSVs are the working copy; the DB has 192 active (CSVs are +4 ahead of the last sync — that's fine).
2. Read scripts/sync-reference.mjs — specifically the skills handler, validateSkillRows(), and validateSkillTokenCollisions(). These are the two hard gates you must satisfy (below).
3. Read lib/skills/match.ts — the person-level matcher. Its matching rules dictate how you build aliases (below).
4. Query the active specialty vocabulary yourself (this is the hint gate's source of truth):
   SELECT specialty_normalized FROM specialty_dictionary WHERE active = true;   -- 150 rows today, ALL engineering.
   (Use the same env/DB access pattern the repo's scripts use. Default sync target is PROD; hints must validate against the target you intend to sync.)

Then give me: a coverage summary of what exists, the obvious gaps, and an honest assessment of how thin the aliases actually are. THEN do PHASE 0 (the coverage map — see PROCESS). Only after Matt approves the map do you begin domain 1 (core software engineering).

=== DO NOT CHANGE ===
- The schema. The 7-file split (skills cross domains — category, not domain, is the right axis). The category CHECK constraint (7 values, locked by migration 069). New skills go into these SAME 7 files.
- Do NOT propose new functions, specialties, categories, or files. That is a separate, deliberate product decision. This session is SKILLS ONLY.

=== THE GOVERNING LINE: DID-IT vs WAS-THERE ===
A skill is a COMPETENCY the person has — something they DID or a credential they HOLD. That is the only thing that belongs in skills_dictionary.
- IN scope (competencies), across ALL functions: e.g. Python, CAD, Verilog — and non-eng competencies like AML analysis, KYC operations, sanctions screening, regulatory reporting, SOX auditing, financial modeling, technical recruiting, and certifications/licenses a person earns (Series 7/63/79, CAMS, CISSP, CPA, PMP).
- OUT of scope — do NOT put these in skills_dictionary: ENVIRONMENT / CONTEXT attributes of where someone worked — fintech, blockchain/web3, defense, climate as a sector, and regulatory-environment tags like "OCC-regulated," "FDIC-insured," "federally chartered." A software engineer at an OCC-regulated bank did NOT necessarily do compliance work; tagging them with "OCC" as a skill asserts a false competency. Those belong to a SEPARATE company-derived "industry context" axis (five-axis axis 4), not skills. Test each term: "Did the PERSON do/earn this (skill) or is it just TRUE OF WHERE THEY WORKED (environment)?" The same word can be a skill in one sense and environment in another (e.g. "HIPAA compliance" competency vs "HIPAA-regulated environment") — only the competency sense goes here. For these ambiguous cases, name the row so it implies DOING the work (canonical "HIPAA Compliance", not bare "HIPAA"), and do NOT add the bare environment acronym as an alias unless a bare LinkedIn tag of it reliably means the person practiced it. Bare "HIPAA"/"OCC"/"FDIC" as a LinkedIn skill tag is usually environment noise — leave it for axis 4.
- OPTIONAL byproduct: as you research finance/compliance/defense/etc., you'll naturally surface environment/regulatory terms. Collect those into a SEPARATE staging file (reference/_staging/environment_vocab_draft.csv or similar) — clearly labeled, NOT one of the 7 skills files, schema-TBD — as a head start for the future company-context workstream. Never mix them into the skills CSVs.

=== TWO HARD SYNC GATES — a batch is not "done" until both pass ===
Definition of done for every domain batch: run `node scripts/sync-reference.mjs --table=skills_dictionary --dry-run` (add `--dev` to target dev). Use `--table=skills_dictionary`, NOT `--only=<file>` shorthand — the collision gate must see all 7 files' tokens at once. Never run the live sync (no --dry-run) — that writes to the DB and is Matt's deliberate, dev-first call. --dry-run only. (Context you don't act on, but should know: the ACTIVE skills set is part of the frozen classifier vocab hash `33c400c8`. Expanding skills WILL move that hash — so Matt's live sync must hit BOTH dev and prod or they fork, and the classifier_version stamp will advance. The person-level skill MATCHER benefits from new rows immediately on sync; the classifier's inferred-skills only get richer on a re-classify. Not your concern for authoring — just don't be surprised the hash changes.)
⚠ CRITICAL — the exit code LIES for one gate. Read the OUTPUT, don't trust `$?`:
- The hint gate (GATE 1) throws INSIDE the per-handler catch, so an invalid hint prints a line `✗ … ERROR: …` and the script STILL EXITS 0. Definition of done therefore requires: ZERO lines containing "ERROR" in the output.
- The collision gate (GATE 2) aborts hard with `Sync failed:` and exit 1.
- So: a green batch = no "ERROR" line AND no "Sync failed". Check both by reading the printed report.

GATE 1 — primary_specialty hint validation (validateSkillRows):
Every primary_specialty value MUST be an ACTIVE specialty_dictionary name on the target DB, or it prints an ERROR line (see above — does NOT abort, so you must read for it). The 150 active specialties are ALL engineering (list at bottom for reference; the live query is authoritative).
- Engineering skills: assign hints ONLY from that active set. The hint is a SOFT DOMAIN HINT (informs sparse-profile inference + context-aware skill decay), never ownership — a skill can hint multiple specialties, or none.
- NON-ENGINEERING skills: there is NO valid specialty to point at (non-eng specialties don't exist in the active taxonomy yet). Leave primary_specialty EMPTY and note it in your batch report. NEVER invent a hint. (These hints get backfilled later, when the taxonomy expands — that's expected and cheap.)
- (FYI: the current 196 rows all validate today — clean base. Keep it clean.)

GATE 2 — global token uniqueness (validateSkillTokenCollisions):
Every canonical_name AND every alias, normalized, must be GLOBALLY UNIQUE across all 7 files combined. A CROSS-ROW duplicate token aborts the sync (exit 1) AND, worse, makes the matcher fail-safe-DROP that token (silently killing a real skill's matching). So: dedup as you build, and FLAG any collision you're unsure about (the cnc / dotnet / verilog class — a new canonical or alias colliding with an existing row). Don't assume — check against the other 6 files, not just the one you're editing. (Note: a redundant duplicate WITHIN the same row is harmless, just useless — the real hazard is the same token across two different rows.)

GATE 3 (not script-checked — you must self-enforce): CATEGORY is locked to the 7 values (programming_language, framework, tool, domain, protocol, hardware, methodology), DB-CHECK-enforced. But --dry-run returns BEFORE any write, so a bad category is NOT caught by the gate — a live sync would reject it. Never invent an 8th category. Certifications/licenses and regulatory competencies that don't fit cleanly → map to `methodology` (a process/credential) or `domain` (a field), and FLAG any that feel forced rather than inventing a category (a dedicated `certification` category is a deferred decision, not yours to make here).

=== HOW THE MATCHER WORKS (build aliases to fit it — lib/skills/match.ts) ===
- Matching is WHOLE-TAG EXACT only. No substring, no fuzzy. A LinkedIn tag matches "C" only if the entire tag normalizes to "c".
- normalizeSkillToken = NFKC → lowercase → collapse internal whitespace → trim. Punctuation is PRESERVED; case and whitespace are folded.
- Therefore: do NOT waste rows on case-only or whitespace-only variants (the matcher folds case + whitespace, so they collapse to the same token — redundant and useless, though harmless). DO exhaustively cover PUNCTUATION and WORD-JOINING variants, which ARE distinct tokens the matcher won't collapse: node.js / nodejs / node js ; ci/cd / cicd / ci-cd ; c++ / cpp / cplusplus.
- The matcher already handles trailing parenthetical qualifiers (react (native) → react native, and strips unknown qualifiers). Do NOT add parenthetical forms as separate aliases.

=== FORCED ALIAS CHECKLIST (per skill — the real weakness we're fixing) ===
Aliases are thin today; that's the failure. For every skill, consider each and fill what applies:
- official name
- abbreviations
- acronyms (CV, NLP, ML, RL, K8s)
- punctuation / word-joining variants (node.js / nodejs / node js)
- old or renamed forms (Twitter Bootstrap, Facebook React)
- LinkedIn's own tag phrasing (often differs from the official name)
No skill ships with an empty alias list unless genuinely nothing else exists. This is a DIFF-AND-EXPAND job against what's already there — not a regenerate-from-scratch.

=== SCOPE: EXHAUSTIVE, GOVERNED BY SIGNAL (not popularity) ===
Every domain list below is a STARTING POINT, never a ceiling. Enumerate EVERY skill/language/framework/tool/technology/methodology a real 2026 LinkedIn practitioner in that domain would tag. Use WebSearch to verify current (2026) tooling and naming.
Depth rule — go DEEP wherever a term DISCRIMINATES (that's Vetted's edge): specific regulatory frameworks, specific certifications, named tools/systems/protocols. Trim ONLY genuinely non-discriminating noise (generic soft skills — "communication," "leadership," "teamwork," "Microsoft Office," "problem solving"). NOTE: in finance/compliance, the regulatory-competency long tail (AML, KYC, BSA, Dodd-Frank reporting, sanctions screening, SOX) is HIGH-signal and one of the most valuable filters we can build — do NOT treat it as trimmable long-tail. Depth there is the point.

=== PROCESS — NON-NEGOTIABLE ===
0. PHASE 0 — BUILD THE COVERAGE MAP FIRST (before writing ANY skill rows). Research and produce the complete function → sub-function → specialty map of every role type tech companies and tech startups hire — engineering AND every non-engineering function. Research it properly with WebSearch: careers pages across company archetypes (big tech, AI lab, fintech, defense/hardware startup, biotech, marketplace, gaming, dev-tools), LinkedIn's own function/role taxonomy, and role-title corpora. The DOMAIN SEQUENCE below is SEED MATERIAL for this map, NOT the map — it is known to be incomplete; your researched map supersedes it. Present the full map to me for review and sign-off. Once approved, it becomes the MASTER CHECKLIST: every subsequent batch ticks off a node, and at the end every node must be either covered or explicitly marked skipped-with-reason. Nothing gets silently dropped. (This map does double duty: it is also the input artifact for the separate, later roles/specialties taxonomy expansion — so make it a clean standalone artifact, saved to a file.)
1. ONE DOMAIN AT A TIME. Never one-shot. I review each batch before you move on.
2. Enumerate the domain exhaustively (forced alias checklist per skill).
3. ADVERSARIAL SECOND PASS per domain: "What would a 2026 LinkedIn profile in this domain tag that I just missed?" Fill gaps before moving on.
4. Write the rows DIRECTLY into the correct CSV(s) — ADD new rows, UPDATE existing rows' aliases (don't duplicate a canonical that already exists — expand it). File conventions: keep each file ALPHABETIZED by canonical_name (insert in place — matches the existing files and keeps diffs reviewable); CSV-quote any field containing a comma; new rows get is_active=true and is_searchable=true (matching all existing rows) unless you flag a reason otherwise.
5. Fill the description column: terse one-liner, consistent with the existing style ("Low-level systems," "Vehicle bus").
5b. If a domain produces more than ~100 added/updated rows, SPLIT it into reviewable sub-batches (e.g. "backend — languages/frameworks" then "backend — datastores/messaging") — each sub-batch goes through steps 6–7 on its own. Never hand me a 200-row wall.
6. Run `node scripts/sync-reference.mjs --table=skills_dictionary --dry-run` and READ the output: zero "ERROR" lines AND no "Sync failed" (per the gate rules above — the exit code alone is not sufficient).
7. Report the batch: ADD count, UPDATE count, any flagged collisions, any non-eng rows left with empty hints, and the dry-run result. THEN STOP for my review before the next domain.

=== DOMAIN SEQUENCE (SEED MATERIAL for the Phase-0 map — known-incomplete, illustrative only) ===
ENGINEERING FIRST, to TRUE exhaustion (hints fire here; it's Vetted's core):
core software → frontend → backend → mobile → infra/devops/SRE/platform → security engineering (go deep on sub-categories: application security, cloud security, offensive/red team & pentest, detection/SOC, cryptography, identity/IAM) → ML/AI → research/R&D (AI/ML research scientists, applied research, research engineering) → data engineering → embedded/firmware → electrical → mechanical → robotics/controls → aerospace/space → chip/semiconductor → materials → optics/photonics → manufacturing → test/QA (BOTH kinds: test-automation/SDET engineers — including those who BUILD test infra & platforms — AND manual QA; plus software-in-the-loop and hardware-in-the-loop test engineering) → systems engineering → HYBRID/FIELD ENGINEERING — do not skip roles that straddle engineering and GTM: sales engineering, solutions engineering, forward-deployed engineering, developer relations / developer advocacy → any engineering domain not named that tech / hard-tech companies hire for (per the COVERAGE DEFINITION above).

THEN NON-ENGINEERING (competencies only, empty hints, flagged — Vetted's core DB is engineering today, but network-connection + CSV enrichment already ingest skills for every function, so these need coverage for search/filter NOW). Seed list — your Phase-0 map supersedes it:
recruiting/talent → people ops/HR → finance/banking/fintech competencies → compliance/regulatory COMPETENCIES + risk (credit/operational/model risk, GRC, underwriting) → legal → operations/supply chain (incl. BizOps, RevOps, program/project mgmt, fintech ops like payments/fraud/disputes/reconciliation) → design/product design/UX (incl. UX research, design systems, content design) → product management (core, platform, growth, technical, AI/ML PM, product ops) → data science & analytics (experimentation, decision science, BI) → IT/corporate engineering (helpdesk, sysadmin, business systems, endpoint) → GTM/sales (AE segments, SDR/BDR, enablement, deal desk) → partnerships/business development → marketing (PMM, demand gen, content, brand, comms/PR, lifecycle, paid, SEO, community, developer marketing) → customer success/support → professional services/implementation/solutions architecture/TAM → trust & safety (policy, moderation ops, platform integrity) → data operations/human data for AI companies (labeling/annotation, RLHF/human-eval ops, red-teaming ops) → public policy/government affairs → editorial/content/media → localization/i18n → corporate security/EHS → sustainability/ESG → executive support/chief of staff → any function not named THAT A TECH COMPANY OR TECH STARTUP HIRES FOR (per the COVERAGE DEFINITION above — the careers-page test; do NOT enumerate professions that only exist outside tech).

=== YOUR ROLE VS MINE ===
Be exhaustive without asking permission. Only stop and ask when something is genuinely ambiguous (a collision, a skill that could be two things, a term that's arguably environment-not-skill, a hint with no valid home). Otherwise: enumerate → alias → adversarial pass → write → dry-run → report the batch → wait for my review.

Start now: read the 7 CSVs + sync gate + matcher, query the 150 active specialties, and give me the coverage summary + gap assessment + alias-thinness read. Then PHASE 0: research and present the full coverage map for my sign-off. Only after I approve the map do you begin domain 1: core software engineering.

--- REFERENCE: the 150 active specialties (live query is authoritative; all engineering) ---
[Query them yourself with the SELECT above. Snapshot grouped by parent function, for orientation:]
aerospace_engineering: aerodynamics_engineering, aerospace_structures_engineering, avionics_engineering, flight_dynamics_engineering, flight_engineering, flight_test_engineering, fluid_dynamics_engineering, gnc_engineering, ground_engineering, ground_test_engineering, guidance_engineering, mission_engineering, mission_integration_engineering, mission_systems_engineering, navigation_engineering, orbital_mechanics_engineering, propulsion_engineering, satcom_engineering, space_systems_engineering
chip_engineering: asic_engineering, chip_architecture_engineering, chip_verification_engineering, digital_design_engineering, fpga_engineering, mixed_signal_design_engineering, physical_design_engineering, soc_design_engineering
controls_engineering: control_systems_engineering, controls_engineering, motor_control_engineering, servo_engineering
data_engineering: data_pipeline_engineering, data_platform_engineering
electrical_engineering: analog_design_engineering, antenna_design_engineering, battery_engineering, communications_engineering, dsp_engineering, electrical_engineering, microwave_engineering, motor_drives_engineering, pcb_design_engineering, power_electronics_engineering, power_systems_engineering, radar_engineering, rf_engineering, schematic_capture_engineering, signal_integrity_engineering, wireless_engineering
firmware_engineering: bootloader_engineering, driver_engineering, embedded_engineering, firmware_engineering, kernel_engineering, low_level_systems_engineering, real_time_systems_engineering, rtos_engineering
hardware_engineering: embedded_hardware_engineering, hardware_design_engineering, hardware_engineering, hardware_integration_engineering, hardware_product_design_engineering
manufacturing_engineering: assembly_engineering, automation_engineering, dfm_engineering, fabrication_engineering, industrial_engineering, manufacturing_engineering, process_engineering, production_engineering, supply_chain_engineering, tooling_engineering
materials_engineering: ceramics_engineering, composites_engineering, materials_characterization_engineering, materials_engineering, metallurgical_engineering, polymer_engineering
mechanical_engineering: cad_design_engineering, electromechanical_engineering, fea_analysis_engineering, mechanical_design_engineering, mechanical_engineering, mechanism_design_engineering, mechatronics_engineering, packaging_engineering, powertrain_engineering, stress_analysis_engineering, structural_engineering, thermal_engineering, vibration_analysis_engineering
ml_engineering: applied_ml_engineering, computer_vision_engineering, llm_engineering, ml_research_engineering, nlp_engineering, recommendation_ranking_engineering
optics_engineering: imaging_systems_engineering, laser_engineering, optical_design_engineering, optics_engineering, optomechanical_engineering, photonics_engineering
robotics_engineering: actuator_engineering, autonomous_systems_engineering, autonomy_engineering, motion_planning_engineering, perception_engineering, robotic_manipulation_engineering, robotic_navigation_engineering, robotic_perception_engineering, robotics_integration_engineering, robotics_software_engineering, ros_engineering, sensor_fusion_engineering, slam_engineering
software_engineering: ai_engineering, api_engineering, backend_engineering, devops_engineering, distributed_systems_engineering, forward_deployed_engineering, frontend_engineering, fullstack_engineering, infrastructure_engineering, ml_platform_engineering, mobile_android_engineering, mobile_ios_engineering, platform_engineering, security_engineering, simulation_engineering, solutions_engineering, sre_engineering
systems_engineering: human_factors_engineering, model_based_systems_engineering, requirements_engineering, systems_architecture_engineering, systems_engineering
test_engineering: certification_engineering, environmental_testing_engineering, failure_analysis_engineering, hardware_in_loop_engineering, integration_test_engineering, qualification_engineering, quality_engineering, reliability_engineering, software_in_loop_engineering, test_engineering, validation_engineering, verification_engineering
