-- 043_seed_olympiads_national_labs_tags.sql
--
-- Seed signal_dictionary with three new categories:
--   - olympiad (17 rows) — math/physics/computing/biology/chemistry olympiads + research awards
--   - national_lab (24 rows) — NASA/DOE/DoD labs + NIST + DARPA + service-branch labs
--   - military / patent / publication tags (12 rows) — ROTC, veterans, patent holder, publication holder
--     (Clearance rows DROPPED per B4 — clearance lives on people.clearance_level)
--
-- NOTE on source_field_hints: CSVs use column-name-style hints
-- (activities_raw, description_raw, etc.). This migration translates to the
-- logical-name convention used by extractPatterns.ts (activities_honors,
-- education_description, experience_description, about, title, company_name).
-- The translation rules:
--   activities_raw / honors_raw → activities_honors (collapsed; honors_raw column doesn't exist)
--   description_raw → education_description + experience_description (both, context-agnostic)
--   summary_raw → about
--   title_raw / experience.title_raw → title
--   company_name_raw / experience.company_name_raw → company_name
--
-- Idempotent: ON CONFLICT (canonical_name, category) DO UPDATE merges aliases/URL/description.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────
-- Olympiads (17 rows, category='olympiad')
-- ────────────────────────────────────────────────────────────────────────

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES
('USAMO', 'olympiad', 'math', 'tier_3', ARRAY['usamo','usa mathematical olympiad','us math olympiad'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.maa.org/math-competitions/usamo', 'Top US high school math competition; ~250 qualifiers/yr from AMC/AIME chain', TRUE, TRUE),
('USAJMO', 'olympiad', 'math', 'tier_3', ARRAY['usajmo','usa junior math olympiad'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.maa.org/math-competitions/usamo', 'Junior version of USAMO for younger students', TRUE, TRUE),
('IMO', 'olympiad', 'math', 'tier_3', ARRAY['imo','international math olympiad','international mathematical olympiad'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.imo-official.org', 'Most prestigious math olympiad globally; team selection from USAMO', TRUE, TRUE),
('Putnam Competition', 'olympiad', 'math', 'tier_3', ARRAY['putnam','william lowell putnam','putnam mathematical competition'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.maa.org/math-competitions/putnam-competition', 'College-level math; top 500 / top 200 / top 100 are notable signals', TRUE, TRUE),
('AMC 10/12', 'olympiad', 'math', 'tier_2', ARRAY['amc 10','amc 12','american mathematics competition'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.maa.org/math-competitions/amc-1012', 'Entry into USAMO chain; AIME qualifier signal', TRUE, TRUE),
('AIME', 'olympiad', 'math', 'tier_2', ARRAY['aime','american invitational mathematics examination'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.maa.org/math-competitions/aime', 'Mid-tier qualifier between AMC and USAMO', TRUE, TRUE),
('USAPhO', 'olympiad', 'physics', 'tier_3', ARRAY['usapho','usa physics olympiad'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.aapt.org/physicsteam', 'US high school physics olympiad; semifinal/finalist signal', TRUE, TRUE),
('IPhO', 'olympiad', 'physics', 'tier_3', ARRAY['ipho','international physics olympiad'], ARRAY['activities_honors','education_description','experience_description'], 'https://ipho-new.org', 'International physics olympiad', TRUE, TRUE),
('USACO', 'olympiad', 'computing', 'tier_3', ARRAY['usaco','usa computing olympiad'], ARRAY['activities_honors','education_description','experience_description'], 'https://usaco.org', 'US computing olympiad; Bronze/Silver/Gold/Platinum/Camp tiers; Platinum+ is elite', TRUE, TRUE),
('IOI', 'olympiad', 'computing', 'tier_3', ARRAY['ioi','international olympiad in informatics'], ARRAY['activities_honors','education_description','experience_description'], 'https://ioinformatics.org', 'International computing olympiad', TRUE, TRUE),
('USABO', 'olympiad', 'biology', 'tier_2', ARRAY['usabo','usa biology olympiad'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.usabo-trc.org', 'US biology olympiad', TRUE, TRUE),
('IBO', 'olympiad', 'biology', 'tier_2', ARRAY['ibo','international biology olympiad'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.ibo-info.org', 'International biology olympiad', TRUE, TRUE),
('USNCO', 'olympiad', 'chemistry', 'tier_2', ARRAY['usnco','us national chemistry olympiad','chemistry olympiad'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.acs.org/education/students/highschool/olympiad.html', 'US chemistry olympiad', TRUE, TRUE),
('IChO', 'olympiad', 'chemistry', 'tier_3', ARRAY['icho','international chemistry olympiad'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.ichosc.org', 'International chemistry olympiad', TRUE, TRUE),
('Regeneron Science Talent Search', 'olympiad', 'research', 'tier_3', ARRAY['regeneron sts','intel sts','science talent search'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.societyforscience.org/regeneron-sts', 'Top US HS research competition; finalists are very high signal', TRUE, TRUE),
('Regeneron ISEF', 'olympiad', 'research', 'tier_3', ARRAY['isef','regeneron isef','international science and engineering fair','intel isef'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.societyforscience.org/isef', 'Largest international HS science fair', TRUE, TRUE),
('Davidson Fellows', 'olympiad', 'research', 'tier_3', ARRAY['davidson fellows','davidson fellowship'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.davidsongifted.org/gifted-programs/fellows-scholarship', '$50K research awards for under-18 work; very selective', TRUE, TRUE)
ON CONFLICT (canonical_name, category) DO UPDATE SET
  subcategory        = EXCLUDED.subcategory,
  tier_group         = EXCLUDED.tier_group,
  aliases            = EXCLUDED.aliases,
  source_field_hints = EXCLUDED.source_field_hints,
  canonical_url      = EXCLUDED.canonical_url,
  description        = EXCLUDED.description,
  is_positive        = EXCLUDED.is_positive,
  is_active          = EXCLUDED.is_active,
  updated_at         = NOW();

-- ────────────────────────────────────────────────────────────────────────
-- National Labs (24 rows, category='national_lab')
-- ────────────────────────────────────────────────────────────────────────

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES
('NASA Jet Propulsion Laboratory', 'national_lab', 'space', 'tier_3', ARRAY['jpl','nasa jpl','jet propulsion laboratory'], ARRAY['title','company_name'], 'https://www.jpl.nasa.gov', 'NASA spacecraft + planetary mission lab; Caltech-managed', TRUE, TRUE),
('MIT Lincoln Laboratory', 'national_lab', 'defense', 'tier_3', ARRAY['mit lincoln lab','lincoln laboratory','mit ll'], ARRAY['title','company_name'], 'https://www.ll.mit.edu', 'DoD-funded R&D; radar/comms/signals; clearance pipeline', TRUE, TRUE),
('Johns Hopkins Applied Physics Laboratory', 'national_lab', 'defense', 'tier_3', ARRAY['jhuapl','jhu apl','applied physics laboratory','johns hopkins apl'], ARRAY['title','company_name'], 'https://www.jhuapl.edu', 'DoD/NASA R&D; space + defense systems', TRUE, TRUE),
('Lawrence Livermore National Laboratory', 'national_lab', 'energy', 'tier_3', ARRAY['llnl','lawrence livermore'], ARRAY['title','company_name'], 'https://www.llnl.gov', 'DOE national security + fusion research', TRUE, TRUE),
('Los Alamos National Laboratory', 'national_lab', 'energy', 'tier_3', ARRAY['lanl','los alamos'], ARRAY['title','company_name'], 'https://www.lanl.gov', 'DOE national security + materials', TRUE, TRUE),
('Sandia National Laboratories', 'national_lab', 'energy', 'tier_3', ARRAY['sandia','sandia national labs'], ARRAY['title','company_name'], 'https://www.sandia.gov', 'DOE engineering + national security; large hardware programs', TRUE, TRUE),
('Oak Ridge National Laboratory', 'national_lab', 'energy', 'tier_3', ARRAY['ornl','oak ridge'], ARRAY['title','company_name'], 'https://www.ornl.gov', 'DOE materials + computing + nuclear', TRUE, TRUE),
('NREL', 'national_lab', 'energy', 'tier_3', ARRAY['nrel','national renewable energy laboratory'], ARRAY['title','company_name'], 'https://www.nrel.gov', 'DOE renewable energy R&D', TRUE, TRUE),
('Argonne National Laboratory', 'national_lab', 'energy', 'tier_3', ARRAY['argonne','anl'], ARRAY['title','company_name'], 'https://www.anl.gov', 'DOE multi-domain research', TRUE, TRUE),
('Brookhaven National Laboratory', 'national_lab', 'energy', 'tier_3', ARRAY['brookhaven','bnl'], ARRAY['title','company_name'], 'https://www.bnl.gov', 'DOE physics + materials', TRUE, TRUE),
('SLAC National Accelerator Laboratory', 'national_lab', 'energy', 'tier_3', ARRAY['slac','stanford linear accelerator'], ARRAY['title','company_name'], 'https://www.slac.stanford.edu', 'DOE particle physics + photon science', TRUE, TRUE),
('Pacific Northwest National Laboratory', 'national_lab', 'energy', 'tier_2', ARRAY['pnnl','pacific northwest'], ARRAY['title','company_name'], 'https://www.pnnl.gov', 'DOE energy + national security', TRUE, TRUE),
('Idaho National Laboratory', 'national_lab', 'energy', 'tier_2', ARRAY['inl','idaho national lab'], ARRAY['title','company_name'], 'https://inl.gov', 'DOE nuclear research', TRUE, TRUE),
('Fermilab', 'national_lab', 'energy', 'tier_3', ARRAY['fermilab','fermi national accelerator laboratory'], ARRAY['title','company_name'], 'https://www.fnal.gov', 'DOE particle physics', TRUE, TRUE),
('NASA Ames Research Center', 'national_lab', 'space', 'tier_3', ARRAY['nasa ames','ames research center'], ARRAY['title','company_name'], 'https://www.nasa.gov/ames', 'NASA aerospace + AI research', TRUE, TRUE),
('NASA Goddard Space Flight Center', 'national_lab', 'space', 'tier_3', ARRAY['nasa goddard','goddard space flight center'], ARRAY['title','company_name'], 'https://www.nasa.gov/goddard', 'NASA earth science + astrophysics + spacecraft', TRUE, TRUE),
('NASA Glenn Research Center', 'national_lab', 'space', 'tier_2', ARRAY['nasa glenn','glenn research center'], ARRAY['title','company_name'], 'https://www.nasa.gov/glenn', 'NASA aerospace propulsion + power', TRUE, TRUE),
('NASA Langley Research Center', 'national_lab', 'space', 'tier_3', ARRAY['nasa langley','langley research center'], ARRAY['title','company_name'], 'https://www.nasa.gov/langley', 'NASA aeronautics R&D', TRUE, TRUE),
('NASA Marshall Space Flight Center', 'national_lab', 'space', 'tier_3', ARRAY['nasa marshall','marshall space flight center'], ARRAY['title','company_name'], 'https://www.nasa.gov/marshall', 'NASA propulsion + launch vehicles', TRUE, TRUE),
('NIST', 'national_lab', 'science', 'tier_2', ARRAY['nist','national institute of standards and technology'], ARRAY['title','company_name'], 'https://www.nist.gov', 'Department of Commerce; metrology + standards', TRUE, TRUE),
('Air Force Research Laboratory', 'national_lab', 'defense', 'tier_3', ARRAY['afrl','air force research laboratory'], ARRAY['title','company_name'], 'https://www.afrl.af.mil', 'USAF R&D; aerospace + directed energy', TRUE, TRUE),
('Naval Research Laboratory', 'national_lab', 'defense', 'tier_3', ARRAY['nrl','naval research laboratory'], ARRAY['title','company_name'], 'https://www.nrl.navy.mil', 'US Navy R&D', TRUE, TRUE),
('Army Research Laboratory', 'national_lab', 'defense', 'tier_2', ARRAY['arl','army research laboratory'], ARRAY['title','company_name'], 'https://arl.devcom.army.mil', 'US Army R&D', TRUE, TRUE),
('DARPA', 'national_lab', 'defense', 'tier_3', ARRAY['darpa','defense advanced research projects agency'], ARRAY['title','company_name'], 'https://www.darpa.mil', 'DoD frontier R&D agency', TRUE, TRUE)
ON CONFLICT (canonical_name, category) DO UPDATE SET
  subcategory        = EXCLUDED.subcategory,
  tier_group         = EXCLUDED.tier_group,
  aliases            = EXCLUDED.aliases,
  source_field_hints = EXCLUDED.source_field_hints,
  canonical_url      = EXCLUDED.canonical_url,
  description        = EXCLUDED.description,
  is_positive        = EXCLUDED.is_positive,
  is_active          = EXCLUDED.is_active,
  updated_at         = NOW();

-- ────────────────────────────────────────────────────────────────────────
-- Tags (12 rows: 4 ROTC + 6 veteran + 1 patent + 1 publication)
-- 3 clearance rows DROPPED — handled by people.clearance_level column.
-- ────────────────────────────────────────────────────────────────────────

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES
('Army ROTC', 'military', 'rotc', 'tier_2', ARRAY['army rotc','reserve officers training corps'], ARRAY['activities_honors','education_description','experience_description','title'], 'https://www.goarmy.com/rotc.html', 'US Army ROTC; defense pipeline tag', TRUE, TRUE),
('Navy ROTC', 'military', 'rotc', 'tier_2', ARRAY['navy rotc','nrotc'], ARRAY['activities_honors','education_description','experience_description','title'], 'https://www.netc.navy.mil/NSTC/NROTC', 'US Navy ROTC', TRUE, TRUE),
('Air Force ROTC', 'military', 'rotc', 'tier_2', ARRAY['afrotc','air force rotc'], ARRAY['activities_honors','education_description','experience_description','title'], 'https://www.afrotc.com', 'US Air Force ROTC', TRUE, TRUE),
('Marine Corps PLC', 'military', 'rotc', 'tier_2', ARRAY['plc','platoon leaders class','marine corps plc'], ARRAY['activities_honors','education_description','experience_description','title'], 'https://www.marines.com/become-a-marine/officer/plc.html', 'USMC officer commissioning track', TRUE, TRUE),
('US Army Veteran', 'military', 'veteran', 'tier_2', ARRAY['us army','army veteran','former us army'], ARRAY['title','company_name'], 'https://www.army.mil', 'Active or prior US Army service; tag for defense fit', TRUE, TRUE),
('US Navy Veteran', 'military', 'veteran', 'tier_2', ARRAY['us navy','navy veteran','former us navy'], ARRAY['title','company_name'], 'https://www.navy.mil', 'Active or prior US Navy service', TRUE, TRUE),
('US Air Force Veteran', 'military', 'veteran', 'tier_2', ARRAY['usaf','air force veteran'], ARRAY['title','company_name'], 'https://www.airforce.com', 'Active or prior USAF service', TRUE, TRUE),
('US Marine Corps Veteran', 'military', 'veteran', 'tier_2', ARRAY['usmc','marine corps veteran','former marine'], ARRAY['title','company_name'], 'https://www.marines.mil', 'Active or prior USMC service', TRUE, TRUE),
('US Space Force', 'military', 'veteran', 'tier_2', ARRAY['us space force','ussf'], ARRAY['title','company_name'], 'https://www.spaceforce.mil', 'US Space Force service', TRUE, TRUE),
('US Coast Guard Veteran', 'military', 'veteran', 'tier_2', ARRAY['uscg','coast guard veteran'], ARRAY['title','company_name'], 'https://www.uscg.mil', 'Active or prior USCG service', TRUE, TRUE),
('US Patent Holder', 'patent', 'patent', 'tier_2', ARRAY['us patent','uspto','patent holder','inventor'], ARRAY['about','education_description','experience_description','activities_honors'], 'https://www.uspto.gov', 'Holds at least one US patent; deep tech signal', TRUE, TRUE),
('Has Conference Publication', 'publication', 'publication', 'tier_2', ARRAY['published at','paper accepted','first author','corresponding author'], ARRAY['education_description','experience_description','about'], NULL, 'Has published research at a notable conference (use conference dictionary for venue tier)', TRUE, TRUE)
ON CONFLICT (canonical_name, category) DO UPDATE SET
  subcategory        = EXCLUDED.subcategory,
  tier_group         = EXCLUDED.tier_group,
  aliases            = EXCLUDED.aliases,
  source_field_hints = EXCLUDED.source_field_hints,
  canonical_url      = EXCLUDED.canonical_url,
  description        = EXCLUDED.description,
  is_positive        = EXCLUDED.is_positive,
  is_active          = EXCLUDED.is_active,
  updated_at         = NOW();

COMMIT;
