-- Migration 025: Seed signal_dictionary across 11 categories
--
-- Idempotent: ON CONFLICT (canonical_name, category) DO UPDATE
-- Total: ~410 entries across fellowship, scholarship, hackathon,
-- greek_life, athletics, engineering_team, student_leadership,
-- academic_distinction, founder, competition, military.

-- ============================================================
-- FELLOWSHIP (37 entries)
-- ============================================================

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES

('Thiel Fellowship', 'fellowship', NULL, NULL,
 ARRAY['thiel fellowship', 'thiel fellow', '20 under 20 thiel', '20 under 20', 'thiel foundation fellowship'],
 ARRAY['activities_honors', 'education_description', 'experience_description'],
 'https://thielfellowship.org', 'Peter Thiel''s $100K fellowship for young entrepreneurs who skip or leave college to build.', TRUE, TRUE),

('Y Combinator', 'fellowship', NULL, NULL,
 ARRAY['y combinator', 'yc', 'ycombinator', 'yc batch', 'yc fellow', 'y combinator batch'],
 ARRAY['experience_description', 'title', 'company_name'],
 'https://www.ycombinator.com', 'Premier startup accelerator; participation treated as a fellowship-level signal.', TRUE, TRUE),

('Schmidt Futures', 'fellowship', NULL, NULL,
 ARRAY['schmidt futures', 'schmidt fellow', 'schmidt futures fellow', 'eric schmidt fellowship'],
 ARRAY['activities_honors', 'experience_description'],
 'https://www.schmidtfutures.com', 'Eric & Wendy Schmidt foundation supporting exceptional talent in science and technology.', TRUE, TRUE),

('Knight-Hennessy Scholars', 'fellowship', NULL, NULL,
 ARRAY['knight-hennessy', 'knight hennessy', 'knight-hennessy scholar', 'kh scholar', 'knight hennessy scholars'],
 ARRAY['activities_honors', 'education_description'],
 'https://knight-hennessy.stanford.edu', 'Stanford''s full-ride graduate fellowship for developing global leaders.', TRUE, TRUE),

('Rhodes Scholarship', 'fellowship', NULL, NULL,
 ARRAY['rhodes scholarship', 'rhodes scholar', 'rhodes trust', 'cecil rhodes scholarship'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.rhodeshouse.ox.ac.uk', 'Oldest international fellowship for postgraduate study at Oxford.', TRUE, TRUE),

('Marshall Scholarship', 'fellowship', NULL, NULL,
 ARRAY['marshall scholarship', 'marshall scholar', 'marshall commission'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.marshallscholarship.org', 'British government fellowship for Americans to study in the UK.', TRUE, TRUE),

('Fulbright U.S. Student Program', 'fellowship', NULL, NULL,
 ARRAY['fulbright', 'fulbright scholar', 'fulbright student', 'fulbright us student', 'fulbright grant', 'fulbright fellowship', 'fulbright award'],
 ARRAY['activities_honors', 'education_description', 'experience_description'],
 'https://us.fulbrightonline.org', 'U.S. government program for international educational exchange — student grants.', TRUE, TRUE),

('Fulbright U.S. Scholar Program', 'fellowship', NULL, NULL,
 ARRAY['fulbright scholar program', 'fulbright us scholar', 'fulbright senior scholar'],
 ARRAY['activities_honors', 'experience_description'],
 'https://www.cies.org', 'U.S. government program for international educational exchange — faculty/professional grants.', TRUE, TRUE),

('Truman Scholarship', 'fellowship', NULL, NULL,
 ARRAY['truman scholarship', 'truman scholar', 'harry s truman scholarship', 'truman foundation'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.truman.gov', 'Federal scholarship for future public service leaders.', TRUE, TRUE),

('Gates Cambridge Scholarship', 'fellowship', NULL, NULL,
 ARRAY['gates cambridge', 'gates cambridge scholar', 'gates scholarship cambridge', 'gates cambridge scholarship'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.gatescambridge.org', 'Bill & Melinda Gates Foundation full scholarship for graduate study at Cambridge.', TRUE, TRUE),

('Mitchell Scholarship', 'fellowship', NULL, NULL,
 ARRAY['mitchell scholarship', 'mitchell scholar', 'george mitchell scholarship'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.us-irelandalliance.org/mitchellscholarship', 'Fellowship for graduate study in Ireland.', TRUE, TRUE),

('Churchill Scholarship', 'fellowship', NULL, NULL,
 ARRAY['churchill scholarship', 'churchill scholar', 'winston churchill scholarship', 'churchill college scholarship'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.churchillscholarship.org', 'Fellowship for STEM graduate study at Churchill College, Cambridge.', TRUE, TRUE),

('Goldwater Scholarship', 'fellowship', NULL, NULL,
 ARRAY['goldwater scholarship', 'goldwater scholar', 'barry goldwater scholarship', 'goldwater foundation'],
 ARRAY['activities_honors', 'education_description'],
 'https://goldwaterscholarship.gov', 'Premier undergraduate STEM scholarship in the U.S.', TRUE, TRUE),

('Paul & Daisy Soros Fellowship', 'fellowship', NULL, NULL,
 ARRAY['soros fellowship', 'paul and daisy soros', 'pd soros', 'soros fellow', 'paul & daisy soros fellowship'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.pdsoros.org', 'Graduate fellowship for New Americans — immigrants and children of immigrants.', TRUE, TRUE),

('Hertz Fellowship', 'fellowship', NULL, NULL,
 ARRAY['hertz fellowship', 'hertz fellow', 'hertz foundation', 'fannie and john hertz', 'fannie and john hertz foundation fellowship', 'hertz foundation fellowship'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.hertzfoundation.org', 'Highly selective STEM PhD fellowship from the Fannie and John Hertz Foundation.', TRUE, TRUE),

('Boren Fellowship', 'fellowship', NULL, NULL,
 ARRAY['boren fellowship', 'boren fellow', 'boren award', 'david l boren fellowship'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.borenawards.org', 'National security fellowship for graduate international study.', TRUE, TRUE),

('Critical Language Scholarship', 'fellowship', NULL, NULL,
 ARRAY['critical language scholarship', 'cls', 'cls program', 'critical language program'],
 ARRAY['activities_honors', 'education_description'],
 'https://clscholarship.org', 'State Department summer language program in critical-need languages.', TRUE, TRUE),

('Pickering Fellowship', 'fellowship', NULL, NULL,
 ARRAY['pickering fellowship', 'pickering fellow', 'thomas r pickering', 'pickering foreign affairs'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.twc.edu/programs/pickering-fellowship', 'State Department graduate fellowship for future Foreign Service Officers.', TRUE, TRUE),

('Rangel Fellowship', 'fellowship', NULL, NULL,
 ARRAY['rangel fellowship', 'rangel fellow', 'charles b rangel', 'rangel international affairs'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.twc.edu/programs/rangel-fellowship', 'State Department graduate fellowship promoting diversity in the Foreign Service.', TRUE, TRUE),

('Forbes 30 Under 30', 'fellowship', NULL, NULL,
 ARRAY['forbes 30 under 30', 'forbes 30u30', '30 under 30', 'forbes thirty under thirty'],
 ARRAY['activities_honors', 'headline', 'about', 'experience_description'],
 'https://www.forbes.com/30-under-30/', 'Annual Forbes list recognizing top young leaders across industries.', TRUE, TRUE),

('TED Fellow', 'fellowship', NULL, NULL,
 ARRAY['ted fellow', 'ted fellowship', 'ted fellows program'],
 ARRAY['activities_honors', 'experience_description', 'headline'],
 'https://www.ted.com/participate/ted-fellows-program', 'TED''s fellowship for emerging leaders with bold ideas.', TRUE, TRUE),

('MacArthur Fellowship', 'fellowship', NULL, NULL,
 ARRAY['macarthur fellowship', 'macarthur fellow', 'macarthur genius grant', 'genius grant', 'macarthur foundation fellowship'],
 ARRAY['activities_honors', 'experience_description', 'headline'],
 'https://www.macfound.org/programs/fellows/', 'Unrestricted $800K grant for exceptionally creative individuals (the "Genius Grant").', TRUE, TRUE),

('Echoing Green Fellowship', 'fellowship', NULL, NULL,
 ARRAY['echoing green', 'echoing green fellow', 'echoing green fellowship'],
 ARRAY['activities_honors', 'experience_description'],
 'https://echoinggreen.org', 'Fellowship and seed funding for social entrepreneurs.', TRUE, TRUE),

('Kauffman Fellows', 'fellowship', NULL, NULL,
 ARRAY['kauffman fellows', 'kauffman fellow', 'kauffman fellowship', 'kauffman fellows program'],
 ARRAY['activities_honors', 'experience_description'],
 'https://www.kauffmanfellows.org', 'Two-year fellowship for emerging venture capital leaders.', TRUE, TRUE),

('On Deck Fellowship', 'fellowship', NULL, NULL,
 ARRAY['on deck', 'on deck fellowship', 'on deck fellow', 'odf'],
 ARRAY['activities_honors', 'experience_description'],
 'https://www.beondeck.com', 'Community-based fellowship for founders, angels, and operators.', TRUE, TRUE),

('On Deck Founder Fellowship', 'fellowship', NULL, NULL,
 ARRAY['on deck founder fellowship', 'on deck founders', 'odf founder'],
 ARRAY['activities_honors', 'experience_description'],
 'https://www.beondeck.com', 'On Deck''s founder-specific fellowship cohort.', TRUE, TRUE),

('Coding It Forward Fellowship', 'fellowship', NULL, NULL,
 ARRAY['coding it forward', 'civic digital fellowship', 'coding it forward fellow'],
 ARRAY['activities_honors', 'experience_description'],
 'https://www.codingitforward.com', 'Fellowship placing early-career technologists in federal government agencies.', TRUE, TRUE),

('Coro Fellowship', 'fellowship', NULL, NULL,
 ARRAY['coro fellowship', 'coro fellow', 'coro fellows program'],
 ARRAY['activities_honors', 'experience_description'],
 'https://www.coro.org', 'Experiential leadership training fellowship in public affairs.', TRUE, TRUE),

('AnitaB.org Pass-It-On Award', 'fellowship', NULL, NULL,
 ARRAY['anitab pass it on', 'anita borg pass it on', 'pass-it-on award', 'anitab.org award'],
 ARRAY['activities_honors', 'education_description'],
 'https://anitab.org', 'AnitaB.org award for women in computing.', TRUE, TRUE),

('Pioneer', 'fellowship', NULL, NULL,
 ARRAY['pioneer', 'pioneer tournament', 'pioneer.app', 'pioneer fellow'],
 ARRAY['activities_honors', 'experience_description'],
 'https://pioneer.app', 'Online talent search and fellowship for ambitious builders worldwide.', TRUE, TRUE),

('South Park Commons Founder Fellowship', 'fellowship', NULL, NULL,
 ARRAY['south park commons', 'spc', 'spc fellowship', 'south park commons fellow', 'spc founder fellowship'],
 ARRAY['activities_honors', 'experience_description'],
 'https://www.southparkcommons.com', 'Community and fellowship for builders exploring their next company.', TRUE, TRUE),

('Antler', 'fellowship', NULL, NULL,
 ARRAY['antler', 'antler fellowship', 'antler residency', 'antler cohort'],
 ARRAY['experience_description', 'company_name'],
 'https://www.antler.co', 'Global day-zero investor and founder residency program.', TRUE, TRUE),

('Entrepreneur First', 'fellowship', NULL, NULL,
 ARRAY['entrepreneur first', 'ef', 'ef cohort', 'entrepreneur first cohort'],
 ARRAY['experience_description', 'company_name'],
 'https://www.joinef.com', 'Talent investor that builds companies from pre-team/pre-idea stage.', TRUE, TRUE),

('Alchemist Accelerator', 'fellowship', NULL, NULL,
 ARRAY['alchemist accelerator', 'alchemist', 'alchemist cohort'],
 ARRAY['experience_description', 'company_name'],
 'https://www.alchemistaccelerator.com', 'Enterprise-focused startup accelerator.', TRUE, TRUE),

('NSF Graduate Research Fellowship', 'fellowship', NULL, NULL,
 ARRAY['nsf grfp', 'nsf fellowship', 'nsf graduate research fellowship', 'grfp', 'national science foundation fellowship', 'nsf fellow'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.nsfgrfp.org', 'NSF''s premier fellowship supporting STEM graduate students ($37K/year stipend).', TRUE, TRUE),

('Ford Foundation Fellowship', 'fellowship', NULL, NULL,
 ARRAY['ford foundation fellowship', 'ford fellow', 'ford foundation fellow', 'ford dissertation fellowship'],
 ARRAY['activities_honors', 'education_description'],
 'https://sites.nationalacademies.org/PGA/FordFellowships/', 'Fellowship promoting diversity in academia for PhD students and postdocs.', TRUE, TRUE),

('AAAS Science & Technology Policy Fellowship', 'fellowship', NULL, NULL,
 ARRAY['aaas fellowship', 'aaas policy fellowship', 'aaas stpf', 'aaas science policy fellow', 'aaas fellow'],
 ARRAY['activities_honors', 'experience_description'],
 'https://www.aaas.org/programs/science-technology-policy-fellowships', 'Places scientists and engineers in federal policy roles for 1-2 years.', TRUE, TRUE)

ON CONFLICT (canonical_name, category) DO UPDATE SET
  subcategory = EXCLUDED.subcategory, tier_group = EXCLUDED.tier_group,
  aliases = EXCLUDED.aliases, source_field_hints = EXCLUDED.source_field_hints,
  canonical_url = EXCLUDED.canonical_url, description = EXCLUDED.description,
  is_positive = EXCLUDED.is_positive, is_active = EXCLUDED.is_active, updated_at = NOW();

-- ============================================================
-- SCHOLARSHIP (28 entries)
-- ============================================================

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES

('Coca-Cola Scholar', 'scholarship', NULL, NULL,
 ARRAY['coca-cola scholar', 'coca cola scholar', 'coca-cola scholarship', 'coca cola scholars foundation'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.coca-colascholarsfoundation.org', 'Achievement-based scholarship recognizing 150 high school seniors annually.', TRUE, TRUE),

('Jack Kent Cooke Young Scholars', 'scholarship', NULL, NULL,
 ARRAY['jack kent cooke young scholars', 'jkc young scholars', 'cooke young scholars'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.jkcf.org', 'Comprehensive pre-college program for high-achieving students with financial need.', TRUE, TRUE),

('Jack Kent Cooke College Scholarship', 'scholarship', NULL, NULL,
 ARRAY['jack kent cooke college scholarship', 'jkc college scholarship', 'cooke scholarship', 'jack kent cooke scholar'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.jkcf.org', 'Up to $55K/year for exceptional community college transfer students.', TRUE, TRUE),

('Jack Kent Cooke Graduate Scholarship', 'scholarship', NULL, NULL,
 ARRAY['jack kent cooke graduate scholarship', 'jkc graduate', 'cooke graduate scholarship'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.jkcf.org', 'Up to $75K/year for outstanding college seniors with financial need entering grad school.', TRUE, TRUE),

('Gates Millennium Scholars', 'scholarship', NULL, NULL,
 ARRAY['gates millennium', 'gates millennium scholar', 'gates millennium scholarship', 'gms scholar'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.gmsp.org', 'Bill & Melinda Gates Foundation full scholarship for minority students (now closed, alumni remain).', TRUE, TRUE),

('Gates Scholarship', 'scholarship', NULL, NULL,
 ARRAY['gates scholarship', 'gates scholar', 'the gates scholarship'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.thegatesscholarship.org', 'Full scholarship for Pell-eligible minority high school seniors (successor to GMS).', TRUE, TRUE),

('National Merit Scholar', 'scholarship', NULL, NULL,
 ARRAY['national merit', 'national merit scholar', 'national merit scholarship', 'national merit finalist', 'national merit semifinalist', 'nmsqt'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.nationalmerit.org', 'PSAT-based scholarship recognizing top ~1% of U.S. high school students.', TRUE, TRUE),

('Roy & Diana Vagelos Scholars', 'scholarship', NULL, NULL,
 ARRAY['vagelos scholars', 'vagelos scholar', 'roy and diana vagelos', 'vagelos program', 'vagelos scholars program in molecular life sciences'],
 ARRAY['activities_honors', 'education_description'],
 NULL, 'Selective interdisciplinary scholars program at UPenn blending science and liberal arts.', TRUE, TRUE),

('Stamps Scholar', 'scholarship', NULL, NULL,
 ARRAY['stamps scholar', 'stamps scholarship', 'stamps foundation scholar'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.stampsfoundation.org', 'Merit-based scholarship at 40+ partner universities covering full cost of attendance.', TRUE, TRUE),

('Robertson Scholar', 'scholarship', NULL, NULL,
 ARRAY['robertson scholar', 'robertson scholarship', 'robertson scholars leadership program'],
 ARRAY['activities_honors', 'education_description'],
 'https://robertsonscholars.org', 'Full scholarship at Duke or UNC with leadership development and summer experiences.', TRUE, TRUE),

('Morehead-Cain Scholar', 'scholarship', NULL, NULL,
 ARRAY['morehead-cain', 'morehead cain', 'morehead-cain scholar', 'morehead scholarship', 'morehead cain scholarship'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.moreheadcain.org', 'First merit scholarship in the U.S.; full ride to UNC-Chapel Hill.', TRUE, TRUE),

('Park Scholar (NCSU)', 'scholarship', NULL, NULL,
 ARRAY['park scholar', 'park scholarship', 'park scholars ncsu', 'nc state park scholar'],
 ARRAY['activities_honors', 'education_description'],
 'https://park.ncsu.edu', 'NC State''s premier merit scholarship — full ride with leadership programming.', TRUE, TRUE),

('Jefferson Scholar (UVA)', 'scholarship', NULL, NULL,
 ARRAY['jefferson scholar', 'jefferson scholarship', 'jefferson scholars foundation', 'uva jefferson scholar'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.jeffersonscholars.org', 'UVA''s most prestigious merit scholarship — full cost of attendance.', TRUE, TRUE),

('Reagan Foundation GE-Reagan Scholarship', 'scholarship', NULL, NULL,
 ARRAY['ge-reagan scholarship', 'reagan scholarship', 'reagan scholar', 'ge reagan scholar'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.reaganfoundation.org/education/scholarship-programs/', 'Renewable $10K scholarship for student leaders who exemplify Reagan''s leadership.', TRUE, TRUE),

('Hispanic Scholarship Fund', 'scholarship', NULL, NULL,
 ARRAY['hispanic scholarship fund', 'hsf', 'hsf scholar', 'hispanic scholarship'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.hsf.net', 'Largest Hispanic scholarship organization in the U.S.', TRUE, TRUE),

('UNCF Scholarship', 'scholarship', NULL, NULL,
 ARRAY['uncf', 'uncf scholarship', 'uncf scholar', 'united negro college fund'],
 ARRAY['activities_honors', 'education_description'],
 'https://uncf.org', 'United Negro College Fund scholarships supporting minority higher education.', TRUE, TRUE),

('Posse Scholar', 'scholarship', NULL, NULL,
 ARRAY['posse scholar', 'posse scholarship', 'posse foundation', 'posse fellow'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.possefoundation.org', 'Full-tuition leadership scholarship sending diverse cohorts to top colleges.', TRUE, TRUE),

('QuestBridge Match Scholar', 'scholarship', NULL, NULL,
 ARRAY['questbridge', 'questbridge match', 'questbridge scholar', 'questbridge national college match', 'questbridge finalist'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.questbridge.org', 'Matches high-achieving low-income students with full scholarships to top colleges.', TRUE, TRUE),

('QuestBridge College Scholar', 'scholarship', NULL, NULL,
 ARRAY['questbridge college scholar', 'questbridge college prep scholar'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.questbridge.org', 'QuestBridge''s college prep program for high school juniors.', TRUE, TRUE),

('Davidson Fellow', 'scholarship', NULL, NULL,
 ARRAY['davidson fellow', 'davidson fellows scholarship', 'davidson institute fellow'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.davidsongifted.org/gifted-programs/fellows-scholarship/', '$10K-$50K scholarship for students 18 and under with significant STEM/humanities projects.', TRUE, TRUE),

('Burger King Scholars', 'scholarship', NULL, NULL,
 ARRAY['burger king scholar', 'burger king scholarship', 'bk scholars'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.burgerkingscholarship.com', 'Need-based scholarship program for high school students.', TRUE, TRUE),

('Elks National Foundation Scholarship', 'scholarship', NULL, NULL,
 ARRAY['elks scholarship', 'elks national foundation', 'elks scholar', 'elks most valuable student'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.elks.org/scholars/', 'One of the largest private scholarship programs in the U.S.', TRUE, TRUE),

('Buick Achievers Scholarship', 'scholarship', NULL, NULL,
 ARRAY['buick achievers', 'buick achievers scholarship', 'gm buick scholarship'],
 ARRAY['activities_honors', 'education_description'],
 NULL, 'GM-funded STEM scholarship (program ended, alumni remain in profiles).', TRUE, TRUE),

('Ron Brown Scholar', 'scholarship', NULL, NULL,
 ARRAY['ron brown scholar', 'ron brown scholarship', 'ron brown scholar program'],
 ARRAY['activities_honors', 'education_description'],
 'https://ronbrown.org', 'Merit scholarship for African American high school seniors with community service leadership.', TRUE, TRUE),

('Boren Scholarship', 'scholarship', NULL, NULL,
 ARRAY['boren scholarship', 'boren scholar', 'boren award undergraduate', 'david l boren scholarship'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.borenawards.org', 'NSEP undergraduate scholarship for study abroad in underrepresented regions.', TRUE, TRUE),

('Udall Scholarship', 'scholarship', NULL, NULL,
 ARRAY['udall scholarship', 'udall scholar', 'morris k udall scholarship', 'udall foundation'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.udall.gov', 'Scholarship for undergrads committed to environment, tribal policy, or Native healthcare.', TRUE, TRUE),

('Astronaut Scholarship', 'scholarship', NULL, NULL,
 ARRAY['astronaut scholarship', 'astronaut scholar', 'astronaut scholarship foundation'],
 ARRAY['activities_honors', 'education_description'],
 'https://astronautscholarship.org', 'STEM scholarship from the Astronaut Scholarship Foundation for top undergrads.', TRUE, TRUE),

('Daniels Fund Scholarship', 'scholarship', NULL, NULL,
 ARRAY['daniels fund', 'daniels scholar', 'daniels fund scholarship', 'daniels scholarship program'],
 ARRAY['activities_honors', 'education_description'],
 'https://www.danielsfund.org', 'Full-ride scholarship for students in CO, NM, UT, WY with character + need.', TRUE, TRUE)

ON CONFLICT (canonical_name, category) DO UPDATE SET
  subcategory = EXCLUDED.subcategory, tier_group = EXCLUDED.tier_group,
  aliases = EXCLUDED.aliases, source_field_hints = EXCLUDED.source_field_hints,
  canonical_url = EXCLUDED.canonical_url, description = EXCLUDED.description,
  is_positive = EXCLUDED.is_positive, is_active = EXCLUDED.is_active, updated_at = NOW();

-- ============================================================
-- HACKATHON (39 entries, including 1 catchall)
-- ============================================================

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES

('HackMIT', 'hackathon', NULL, NULL, ARRAY['hackmit', 'hack mit', 'hack@mit', 'mit hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://hackmit.org', 'MIT''s annual flagship hackathon.', TRUE, TRUE),
('TreeHacks', 'hackathon', NULL, NULL, ARRAY['treehacks', 'tree hacks', 'stanford hackathon', 'treehacks stanford'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://www.treehacks.com', 'Stanford''s premier annual hackathon.', TRUE, TRUE),
('PennApps', 'hackathon', NULL, NULL, ARRAY['pennapps', 'penn apps', 'upenn hackathon', 'pennapps hack'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://pennapps.com', 'UPenn''s flagship hackathon — one of the original collegiate hackathons.', TRUE, TRUE),
('MHacks', 'hackathon', NULL, NULL, ARRAY['mhacks', 'm hacks', 'michigan hackathon', 'umich hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://mhacks.org', 'University of Michigan''s major hackathon.', TRUE, TRUE),
('CalHacks', 'hackathon', NULL, NULL, ARRAY['calhacks', 'cal hacks', 'berkeley hackathon', 'uc berkeley hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://calhacks.io', 'UC Berkeley''s largest collegiate hackathon.', TRUE, TRUE),
('HackPrinceton', 'hackathon', NULL, NULL, ARRAY['hackprinceton', 'hack princeton', 'princeton hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://hackprinceton.com', 'Princeton''s biannual hackathon.', TRUE, TRUE),
('HackHarvard', 'hackathon', NULL, NULL, ARRAY['hackharvard', 'hack harvard', 'harvard hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://hackharvard.io', 'Harvard''s annual hackathon.', TRUE, TRUE),
('HackYale', 'hackathon', NULL, NULL, ARRAY['hackyale', 'hack yale', 'yale hackathon', 'yhack'], ARRAY['projects', 'experience_description', 'activities_honors'], NULL, 'Yale''s annual hackathon.', TRUE, TRUE),
('HackNY', 'hackathon', NULL, NULL, ARRAY['hackny', 'hack ny', 'hackny fellowship', 'hack new york'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://hackny.org', 'NYC-based hackathon and fellows program.', TRUE, TRUE),
('HackUMass', 'hackathon', NULL, NULL, ARRAY['hackumass', 'hack umass', 'umass hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], NULL, 'UMass Amherst''s annual hackathon.', TRUE, TRUE),
('Bitcamp', 'hackathon', NULL, NULL, ARRAY['bitcamp', 'umd hackathon', 'bitcamp umd'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://bitcamp.org', 'University of Maryland''s annual hackathon.', TRUE, TRUE),
('HackTX', 'hackathon', NULL, NULL, ARRAY['hacktx', 'hack tx', 'ut austin hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], NULL, 'UT Austin''s annual hackathon.', TRUE, TRUE),
('HackDavis', 'hackathon', NULL, NULL, ARRAY['hackdavis', 'hack davis', 'uc davis hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://hackdavis.io', 'UC Davis social-good focused hackathon.', TRUE, TRUE),
('HackGT', 'hackathon', NULL, NULL, ARRAY['hackgt', 'hack gt', 'georgia tech hackathon', 'hackgt georgia tech'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://hack.gt', 'Georgia Tech''s annual hackathon.', TRUE, TRUE),
('TigerHacks', 'hackathon', NULL, NULL, ARRAY['tigerhacks', 'tiger hacks', 'mizzou hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], NULL, 'University of Missouri''s annual hackathon.', TRUE, TRUE),
('MakeHarvard', 'hackathon', NULL, NULL, ARRAY['makeharvard', 'make harvard', 'harvard makeathon'], ARRAY['projects', 'experience_description', 'activities_honors'], NULL, 'Harvard''s hardware-focused makeathon.', TRUE, TRUE),
('HackIllinois', 'hackathon', NULL, NULL, ARRAY['hackillinois', 'hack illinois', 'uiuc hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://hackillinois.org', 'UIUC''s open-source focused hackathon.', TRUE, TRUE),
('HackCMU', 'hackathon', NULL, NULL, ARRAY['hackcmu', 'hack cmu', 'cmu hackathon', 'carnegie mellon hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], NULL, 'Carnegie Mellon''s annual hackathon.', TRUE, TRUE),
('HackRU', 'hackathon', NULL, NULL, ARRAY['hackru', 'hack ru', 'rutgers hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://hackru.org', 'Rutgers University''s biannual hackathon.', TRUE, TRUE),
('HackPSU', 'hackathon', NULL, NULL, ARRAY['hackpsu', 'hack psu', 'penn state hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], NULL, 'Penn State''s annual hackathon.', TRUE, TRUE),
('Boilermake', 'hackathon', NULL, NULL, ARRAY['boilermake', 'boiler make', 'purdue hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://boilermake.org', 'Purdue University''s annual hackathon.', TRUE, TRUE),
('WildHacks', 'hackathon', NULL, NULL, ARRAY['wildhacks', 'wild hacks', 'northwestern hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], NULL, 'Northwestern University''s annual hackathon.', TRUE, TRUE),
('MakeUC', 'hackathon', NULL, NULL, ARRAY['makeuc', 'make uc', 'university of cincinnati hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], NULL, 'University of Cincinnati''s annual hackathon.', TRUE, TRUE),
('TechCrunch Disrupt Hackathon', 'hackathon', NULL, NULL, ARRAY['techcrunch disrupt hackathon', 'tc disrupt hackathon', 'techcrunch hackathon', 'disrupt hackathon'], ARRAY['projects', 'experience_description'], 'https://techcrunch.com/events/disrupt/', 'Hackathon at TechCrunch''s annual Disrupt conference.', TRUE, TRUE),
('MLH Local Hack Day', 'hackathon', NULL, NULL, ARRAY['mlh local hack day', 'local hack day', 'mlh lhd'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://localhackday.mlh.io', 'Major League Hacking''s distributed hackathon events.', TRUE, TRUE),
('Major League Hacking Event', 'hackathon', NULL, NULL, ARRAY['mlh', 'major league hacking', 'mlh hackathon', 'mlh event'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://mlh.io', 'Any hackathon sanctioned by Major League Hacking.', TRUE, TRUE),
('AthenaHacks', 'hackathon', NULL, NULL, ARRAY['athenahacks', 'athena hacks', 'usc women hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], NULL, 'USC''s women-focused hackathon.', TRUE, TRUE),
('SheHacks', 'hackathon', NULL, NULL, ARRAY['shehacks', 'she hacks', 'shehacks boston'], ARRAY['projects', 'experience_description', 'activities_honors'], NULL, 'Women-focused hackathon series.', TRUE, TRUE),
('Grace Hopper Hackathon', 'hackathon', NULL, NULL, ARRAY['grace hopper hackathon', 'ghc hackathon', 'grace hopper celebration hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], NULL, 'Hackathon events at the Grace Hopper Celebration conference.', TRUE, TRUE),
('Junction Helsinki', 'hackathon', NULL, NULL, ARRAY['junction', 'junction helsinki', 'junction hackathon'], ARRAY['projects', 'experience_description'], 'https://www.junction.tech', 'Europe''s largest hackathon, held annually in Helsinki.', TRUE, TRUE),
('HackZurich', 'hackathon', NULL, NULL, ARRAY['hackzurich', 'hack zurich', 'hackers at eth'], ARRAY['projects', 'experience_description'], 'https://hackzurich.com', 'Europe''s largest hackathon at ETH Zurich.', TRUE, TRUE),
('Global Game Jam', 'hackathon', NULL, NULL, ARRAY['global game jam', 'ggj', 'game jam'], ARRAY['projects', 'experience_description'], 'https://globalgamejam.org', 'World''s largest game creation event — 48-hour jam at 800+ locations.', TRUE, TRUE),
('Hack the North', 'hackathon', NULL, NULL, ARRAY['hack the north', 'hackthenorth', 'htn', 'waterloo hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://hackthenorth.com', 'Canada''s biggest hackathon, hosted at University of Waterloo.', TRUE, TRUE),
('uOttaHack', 'hackathon', NULL, NULL, ARRAY['uottahack', 'uotta hack', 'ottawa hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], NULL, 'University of Ottawa''s annual hackathon.', TRUE, TRUE),
('Cal Hacks Cubstart', 'hackathon', NULL, NULL, ARRAY['cubstart', 'cal hacks cubstart', 'calhacks cubstart'], ARRAY['projects', 'experience_description', 'activities_honors'], NULL, 'CalHacks'' beginner-friendly accelerator program.', TRUE, TRUE),
('HackSC', 'hackathon', NULL, NULL, ARRAY['hacksc', 'hack sc', 'usc hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], NULL, 'USC''s annual hackathon.', TRUE, TRUE),
('LAHacks', 'hackathon', NULL, NULL, ARRAY['lahacks', 'la hacks', 'ucla hackathon'], ARRAY['projects', 'experience_description', 'activities_honors'], 'https://lahacks.com', 'UCLA''s annual hackathon.', TRUE, TRUE),
('YHack', 'hackathon', NULL, NULL, ARRAY['yhack', 'y hack', 'yale hack'], ARRAY['projects', 'experience_description', 'activities_honors'], NULL, 'Yale''s annual hackathon (alternate branding).', TRUE, TRUE),

-- Catchall
('Hackathon (generic)', 'hackathon', NULL, NULL, ARRAY['hackathon', 'hackathon participant', 'hackathon winner', 'hackathon finalist', 'won a hackathon', 'hackathon project'], ARRAY['projects', 'experience_description', 'activities_honors'], NULL, 'Generic catch-all for hackathon participation when no specific event is identified.', TRUE, TRUE)

ON CONFLICT (canonical_name, category) DO UPDATE SET
  subcategory = EXCLUDED.subcategory, tier_group = EXCLUDED.tier_group,
  aliases = EXCLUDED.aliases, source_field_hints = EXCLUDED.source_field_hints,
  canonical_url = EXCLUDED.canonical_url, description = EXCLUDED.description,
  is_positive = EXCLUDED.is_positive, is_active = EXCLUDED.is_active, updated_at = NOW();

-- ============================================================
-- GREEK LIFE (78 entries)
-- ============================================================

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES

-- NPC Sororities (28)
('Alpha Chi Omega', 'greek_life', NULL, NULL, ARRAY['alpha chi omega', 'axo', 'a chi o'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.alphachiomega.org', 'NPC sorority founded 1885 at DePauw University.', TRUE, TRUE),
('Alpha Delta Pi', 'greek_life', NULL, NULL, ARRAY['alpha delta pi', 'adpi', 'ad pi'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.alphadeltapi.org', 'NPC sorority — first secret society for women (1851).', TRUE, TRUE),
('Alpha Epsilon Phi', 'greek_life', NULL, NULL, ARRAY['alpha epsilon phi', 'aephi', 'ae phi'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.aephi.org', 'NPC sorority founded 1909 at Barnard College.', TRUE, TRUE),
('Alpha Gamma Delta', 'greek_life', NULL, NULL, ARRAY['alpha gamma delta', 'agd', 'alpha gam'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.alphagammadelta.org', 'NPC sorority founded 1904 at Syracuse University.', TRUE, TRUE),
('Alpha Kappa Alpha', 'greek_life', NULL, NULL, ARRAY['alpha kappa alpha', 'aka', 'alpha kappa alpha sorority'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://aka1908.com', 'First historically African American sorority, founded 1908 at Howard.', TRUE, TRUE),
('Alpha Omicron Pi', 'greek_life', NULL, NULL, ARRAY['alpha omicron pi', 'aoii', 'a o pi'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.alphaomicronpi.org', 'NPC sorority founded 1897 at Barnard College.', TRUE, TRUE),
('Alpha Phi', 'greek_life', NULL, NULL, ARRAY['alpha phi', 'a phi', 'aphi'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.alphaphi.org', 'NPC sorority founded 1872 at Syracuse University.', TRUE, TRUE),
('Alpha Sigma Alpha', 'greek_life', NULL, NULL, ARRAY['alpha sigma alpha', 'asa'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.alphasigmaalpha.org', 'NPC sorority founded 1901.', TRUE, TRUE),
('Alpha Sigma Tau', 'greek_life', NULL, NULL, ARRAY['alpha sigma tau', 'ast'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.alphasigmatau.org', 'NPC sorority founded 1899.', TRUE, TRUE),
('Alpha Xi Delta', 'greek_life', NULL, NULL, ARRAY['alpha xi delta', 'axid', 'a xi d'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.alphaxidelta.org', 'NPC sorority founded 1893 at Lombard College.', TRUE, TRUE),
('Chi Omega', 'greek_life', NULL, NULL, ARRAY['chi omega', 'chi o', 'chio'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.chiomega.com', 'Largest NPC sorority — founded 1895 at University of Arkansas.', TRUE, TRUE),
('Delta Delta Delta', 'greek_life', NULL, NULL, ARRAY['delta delta delta', 'tri delta', 'tri-delta', 'ddd'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.tridelta.org', 'NPC sorority founded 1888 at Boston University.', TRUE, TRUE),
('Delta Gamma', 'greek_life', NULL, NULL, ARRAY['delta gamma', 'dg', 'dee gee'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.deltagamma.org', 'NPC sorority founded 1873.', TRUE, TRUE),
('Delta Phi Epsilon', 'greek_life', NULL, NULL, ARRAY['delta phi epsilon', 'dphie', 'd phi e'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.dphie.org', 'NPC sorority founded 1917.', TRUE, TRUE),
('Delta Sigma Theta', 'greek_life', NULL, NULL, ARRAY['delta sigma theta', 'dst', 'delta sigma theta sorority'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.deltasigmatheta.org', 'Historically African American sorority founded 1913 at Howard.', TRUE, TRUE),
('Delta Zeta', 'greek_life', NULL, NULL, ARRAY['delta zeta', 'dz', 'd zeta'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.deltazeta.org', 'NPC sorority founded 1902 at Miami University.', TRUE, TRUE),
('Gamma Phi Beta', 'greek_life', NULL, NULL, ARRAY['gamma phi beta', 'gpb', 'gamma phi'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.gammaphibeta.org', 'NPC sorority founded 1874 at Syracuse University.', TRUE, TRUE),
('Kappa Alpha Theta', 'greek_life', NULL, NULL, ARRAY['kappa alpha theta', 'kat', 'theta', 'ka theta'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.kappaalphatheta.org', 'First Greek-letter fraternity for women (1870).', TRUE, TRUE),
('Kappa Delta', 'greek_life', NULL, NULL, ARRAY['kappa delta', 'kd', 'kay dee'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.kappadelta.org', 'NPC sorority founded 1897.', TRUE, TRUE),
('Kappa Kappa Gamma', 'greek_life', NULL, NULL, ARRAY['kappa kappa gamma', 'kkg', 'kappa'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.kappakappagamma.org', 'NPC sorority founded 1870 at Monmouth College.', TRUE, TRUE),
('Phi Mu', 'greek_life', NULL, NULL, ARRAY['phi mu', 'phi mu sorority'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.phimu.org', 'NPC sorority founded 1852 — second-oldest sorority.', TRUE, TRUE),
('Phi Sigma Sigma', 'greek_life', NULL, NULL, ARRAY['phi sigma sigma', 'phi sig', 'phisig'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.phisigmasigma.org', 'NPC sorority founded 1913 at Hunter College.', TRUE, TRUE),
('Pi Beta Phi', 'greek_life', NULL, NULL, ARRAY['pi beta phi', 'pi phi', 'pbp'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.pibetaphi.org', 'First women''s fraternity founded as a national organization (1867).', TRUE, TRUE),
('Sigma Delta Tau', 'greek_life', NULL, NULL, ARRAY['sigma delta tau', 'sdt', 'sig delt'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.sigmadeltatau.org', 'NPC sorority founded 1917 at Cornell.', TRUE, TRUE),
('Sigma Kappa', 'greek_life', NULL, NULL, ARRAY['sigma kappa', 'sk', 'sig kap'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.sigmakappa.org', 'NPC sorority founded 1874 at Colby College.', TRUE, TRUE),
('Sigma Sigma Sigma', 'greek_life', NULL, NULL, ARRAY['sigma sigma sigma', 'tri sigma', 'tri-sigma'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.trisigma.org', 'NPC sorority founded 1898.', TRUE, TRUE),
('Theta Phi Alpha', 'greek_life', NULL, NULL, ARRAY['theta phi alpha', 'tpa', 'theta phi'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.thetaphialpha.org', 'NPC sorority founded 1912 at University of Michigan.', TRUE, TRUE),
('Zeta Tau Alpha', 'greek_life', NULL, NULL, ARRAY['zeta tau alpha', 'zta', 'zeta'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.zetataualpha.org', 'NPC sorority founded 1898 at Longwood University.', TRUE, TRUE),

-- Fraternities (44)
('Alpha Phi Alpha', 'greek_life', NULL, NULL, ARRAY['alpha phi alpha', 'alpha phi alpha fraternity'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://apa1906.net', 'First African American intercollegiate fraternity (1906, Cornell).', TRUE, TRUE),
('Alpha Epsilon Pi', 'greek_life', NULL, NULL, ARRAY['alpha epsilon pi', 'aepi', 'ae pi'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.aepi.org', 'Jewish fraternity founded 1913 at NYU.', TRUE, TRUE),
('Alpha Sigma Phi', 'greek_life', NULL, NULL, ARRAY['alpha sigma phi', 'alpha sig'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://alphasigmaphi.org', 'Fraternity founded 1845 at Yale.', TRUE, TRUE),
('Alpha Tau Omega', 'greek_life', NULL, NULL, ARRAY['alpha tau omega', 'ato'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.ato.org', 'First fraternity founded after the Civil War (1865).', TRUE, TRUE),
('Beta Theta Pi', 'greek_life', NULL, NULL, ARRAY['beta theta pi', 'beta', 'btp'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.beta.org', 'Fraternity founded 1839 at Miami University.', TRUE, TRUE),
('Chi Phi', 'greek_life', NULL, NULL, ARRAY['chi phi', 'chi phi fraternity'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.chiphi.org', 'Oldest fraternity, founded 1824.', TRUE, TRUE),
('Chi Psi', 'greek_life', NULL, NULL, ARRAY['chi psi', 'chi psi fraternity'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.chipsi.org', 'Fraternity founded 1841 at Union College.', TRUE, TRUE),
('Delta Chi', 'greek_life', NULL, NULL, ARRAY['delta chi', 'd chi', 'dchi'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.deltachi.org', 'Fraternity founded 1890 at Cornell.', TRUE, TRUE),
('Delta Kappa Epsilon', 'greek_life', NULL, NULL, ARRAY['delta kappa epsilon', 'dke', 'deke'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.dke.org', 'Fraternity founded 1844 at Yale — five U.S. presidents were members.', TRUE, TRUE),
('Delta Sigma Phi', 'greek_life', NULL, NULL, ARRAY['delta sigma phi', 'delta sig', 'dsig'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.deltasig.org', 'Fraternity founded 1899 at CCNY.', TRUE, TRUE),
('Delta Tau Delta', 'greek_life', NULL, NULL, ARRAY['delta tau delta', 'dtd', 'delt', 'delts'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.delts.org', 'Fraternity founded 1858 at Bethany College.', TRUE, TRUE),
('Delta Upsilon', 'greek_life', NULL, NULL, ARRAY['delta upsilon', 'du'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.deltau.org', 'Non-secret fraternity founded 1834 at Williams College.', TRUE, TRUE),
('Kappa Alpha Order', 'greek_life', NULL, NULL, ARRAY['kappa alpha order', 'ka', 'kappa alpha'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.kappaalphaorder.org', 'Southern fraternity founded 1865 at Washington and Lee.', TRUE, TRUE),
('Kappa Alpha Psi', 'greek_life', NULL, NULL, ARRAY['kappa alpha psi', 'kappa alpha psi fraternity', 'nupes'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://kappaalphapsi1911.com', 'Historically African American fraternity founded 1911 at Indiana University.', TRUE, TRUE),
('Kappa Sigma', 'greek_life', NULL, NULL, ARRAY['kappa sigma', 'kappa sig', 'ksig'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.kappasigma.org', 'One of the largest fraternities — founded 1869 at UVA.', TRUE, TRUE),
('Lambda Chi Alpha', 'greek_life', NULL, NULL, ARRAY['lambda chi alpha', 'lambda chi', 'lca'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.lambdachi.org', 'Fraternity founded 1909 at Boston University.', TRUE, TRUE),
('Omega Psi Phi', 'greek_life', NULL, NULL, ARRAY['omega psi phi', 'omega psi phi fraternity', 'ques'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.oppf.org', 'Historically African American fraternity founded 1911 at Howard.', TRUE, TRUE),
('Phi Beta Sigma', 'greek_life', NULL, NULL, ARRAY['phi beta sigma', 'phi beta sigma fraternity', 'sigmas'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://pbs1914.org', 'Historically African American fraternity founded 1914 at Howard.', TRUE, TRUE),
('Phi Delta Theta', 'greek_life', NULL, NULL, ARRAY['phi delta theta', 'phi delt', 'pdt'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.phideltatheta.org', 'Fraternity founded 1848 at Miami University (one of the Miami Triad).', TRUE, TRUE),
('Phi Gamma Delta', 'greek_life', NULL, NULL, ARRAY['phi gamma delta', 'fiji', 'phi gam'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.phigam.org', 'Fraternity known as FIJI — founded 1848 at Jefferson College.', TRUE, TRUE),
('Phi Kappa Psi', 'greek_life', NULL, NULL, ARRAY['phi kappa psi', 'phi psi', 'pkp'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.phikappapsi.com', 'Fraternity founded 1852 at Jefferson College.', TRUE, TRUE),
('Phi Kappa Sigma', 'greek_life', NULL, NULL, ARRAY['phi kappa sigma', 'phi kap', 'skulls'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.pks.org', 'Fraternity founded 1850 at UPenn.', TRUE, TRUE),
('Phi Kappa Tau', 'greek_life', NULL, NULL, ARRAY['phi kappa tau', 'phi tau', 'pkt'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.phikappatau.org', 'Fraternity founded 1906 at Miami University.', TRUE, TRUE),
('Phi Kappa Theta', 'greek_life', NULL, NULL, ARRAY['phi kappa theta', 'phi kap theta'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.phikaps.org', 'Catholic fraternity formed from 1959 merger.', TRUE, TRUE),
('Phi Sigma Kappa', 'greek_life', NULL, NULL, ARRAY['phi sigma kappa', 'phi sig k', 'psk'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://phisigmakappa.org', 'Fraternity founded 1873 at UMass Amherst.', TRUE, TRUE),
('Pi Kappa Alpha', 'greek_life', NULL, NULL, ARRAY['pi kappa alpha', 'pike', 'pka'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.pikes.org', 'One of the largest fraternities — founded 1868 at UVA.', TRUE, TRUE),
('Pi Kappa Phi', 'greek_life', NULL, NULL, ARRAY['pi kappa phi', 'pi kapp', 'pkp fraternity'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.pikapp.org', 'Fraternity founded 1904 at College of Charleston.', TRUE, TRUE),
('Pi Lambda Phi', 'greek_life', NULL, NULL, ARRAY['pi lambda phi', 'pi lam', 'pilam'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.pilambdaphi.org', 'First non-sectarian fraternity (1895, Yale).', TRUE, TRUE),
('Psi Upsilon', 'greek_life', NULL, NULL, ARRAY['psi upsilon', 'psi u'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.psiu.org', 'Fraternity founded 1833 at Union College.', TRUE, TRUE),
('Sigma Alpha Epsilon', 'greek_life', NULL, NULL, ARRAY['sigma alpha epsilon', 'sae', 'sig ep... no, sae'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.sae.net', 'Largest fraternity by initiated members — founded 1856 at University of Alabama.', TRUE, TRUE),
('Sigma Alpha Mu', 'greek_life', NULL, NULL, ARRAY['sigma alpha mu', 'sammy', 'sam'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://sam.org', 'Jewish fraternity founded 1909 at CCNY.', TRUE, TRUE),
('Sigma Chi', 'greek_life', NULL, NULL, ARRAY['sigma chi', 'sig chi', 'sigs'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://sigmachi.org', 'Fraternity founded 1855 at Miami University.', TRUE, TRUE),
('Sigma Nu', 'greek_life', NULL, NULL, ARRAY['sigma nu', 'sig nu', 'snu'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.sigmanu.org', 'Fraternity founded 1869 at VMI.', TRUE, TRUE),
('Sigma Phi Epsilon', 'greek_life', NULL, NULL, ARRAY['sigma phi epsilon', 'sig ep', 'sigep', 'spe'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://sigep.org', 'Largest fraternity by active chapters — founded 1901 at University of Richmond.', TRUE, TRUE),
('Sigma Pi', 'greek_life', NULL, NULL, ARRAY['sigma pi', 'sig pi'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.sigmapi.org', 'Fraternity founded 1897 at Vincennes University.', TRUE, TRUE),
('Sigma Tau Gamma', 'greek_life', NULL, NULL, ARRAY['sigma tau gamma', 'sig tau', 'stg'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.sigtau.org', 'Fraternity founded 1920.', TRUE, TRUE),
('Tau Epsilon Phi', 'greek_life', NULL, NULL, ARRAY['tau epsilon phi', 'tep'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Non-sectarian fraternity founded 1910 at Columbia.', TRUE, TRUE),
('Tau Kappa Epsilon', 'greek_life', NULL, NULL, ARRAY['tau kappa epsilon', 'tke', 'teke'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.tke.org', 'Largest fraternity by number of chapters — founded 1899.', TRUE, TRUE),
('Theta Chi', 'greek_life', NULL, NULL, ARRAY['theta chi', 'ox', 'theta chi fraternity'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.thetachi.org', 'Fraternity founded 1856 at Norwich University.', TRUE, TRUE),
('Theta Delta Chi', 'greek_life', NULL, NULL, ARRAY['theta delta chi', 'tdc', 'theta delt'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.tdx.org', 'Fraternity founded 1847 at Union College.', TRUE, TRUE),
('Theta Xi', 'greek_life', NULL, NULL, ARRAY['theta xi', 'tx', 'theta xi fraternity'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.thetaxi.org', 'Engineering fraternity founded 1864 at RPI.', TRUE, TRUE),
('Triangle Fraternity', 'greek_life', NULL, NULL, ARRAY['triangle fraternity', 'triangle', 'triangle engineering'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.triangle.org', 'STEM fraternity for engineers, architects, and scientists.', TRUE, TRUE),
('Zeta Beta Tau', 'greek_life', NULL, NULL, ARRAY['zeta beta tau', 'zbt'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.zbt.org', 'First Jewish fraternity (1898). Now non-sectarian and non-pledging.', TRUE, TRUE),
('Zeta Psi', 'greek_life', NULL, NULL, ARRAY['zeta psi', 'zete', 'zeta psi fraternity'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.zetapsi.org', 'Fraternity founded 1847 at NYU.', TRUE, TRUE),

-- Professional Greek + catchall (6)
('Alpha Kappa Psi', 'greek_life', NULL, NULL, ARRAY['alpha kappa psi', 'akpsi', 'akp'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://akpsi.org', 'Oldest and largest professional business fraternity.', TRUE, TRUE),
('Delta Sigma Pi', 'greek_life', NULL, NULL, ARRAY['delta sigma pi', 'dsp', 'deltasig'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.dsp.org', 'Professional business fraternity founded 1907 at NYU.', TRUE, TRUE),
('Phi Chi Theta', 'greek_life', NULL, NULL, ARRAY['phi chi theta', 'pct'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.phichitheta.org', 'Co-ed professional business fraternity.', TRUE, TRUE),
('Sigma Lambda Beta', 'greek_life', NULL, NULL, ARRAY['sigma lambda beta', 'slb', 'betas'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.sigmalambdabeta.com', 'Latino fraternity founded 1986 at University of Iowa.', TRUE, TRUE),
('Phi Beta Lambda', 'greek_life', NULL, NULL, ARRAY['phi beta lambda', 'pbl'], ARRAY['education_description', 'volunteer', 'activities_honors'], 'https://www.fbla-pbl.org', 'Collegiate division of FBLA — business and leadership org.', TRUE, TRUE),
('Greek Life (generic)', 'greek_life', NULL, NULL, ARRAY['greek life', 'fraternity', 'sorority', 'fraternity member', 'sorority member', 'greek organization'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Generic catch-all for Greek affiliation when specific org is not identified.', TRUE, TRUE)

ON CONFLICT (canonical_name, category) DO UPDATE SET
  subcategory = EXCLUDED.subcategory, tier_group = EXCLUDED.tier_group,
  aliases = EXCLUDED.aliases, source_field_hints = EXCLUDED.source_field_hints,
  canonical_url = EXCLUDED.canonical_url, description = EXCLUDED.description,
  is_positive = EXCLUDED.is_positive, is_active = EXCLUDED.is_active, updated_at = NOW();

-- ============================================================
-- ATHLETICS (30 entries)
-- ============================================================

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES

('NCAA Division 1 Athlete', 'athletics', NULL, NULL, ARRAY['ncaa division 1', 'ncaa d1', 'division 1 athlete', 'division i athlete', 'ncaa div 1', 'd1 athlete'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Competed in NCAA Division 1 athletics.', TRUE, TRUE),
('NCAA Division 2 Athlete', 'athletics', NULL, NULL, ARRAY['ncaa division 2', 'ncaa d2', 'division 2 athlete', 'division ii athlete', 'd2 athlete'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Competed in NCAA Division 2 athletics.', TRUE, TRUE),
('NCAA Division 3 Athlete', 'athletics', NULL, NULL, ARRAY['ncaa division 3', 'ncaa d3', 'division 3 athlete', 'division iii athlete', 'd3 athlete'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Competed in NCAA Division 3 athletics.', TRUE, TRUE),
('NAIA Athlete', 'athletics', NULL, NULL, ARRAY['naia', 'naia athlete', 'naia athletics'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Competed in NAIA athletics.', TRUE, TRUE),
('Junior Olympics Athlete', 'athletics', NULL, NULL, ARRAY['junior olympics', 'junior olympic', 'junior olympic athlete', 'jr olympics'], ARRAY['education_description', 'activities_honors'], NULL, 'Competed in Junior Olympics.', TRUE, TRUE),
('Olympic Athlete', 'athletics', NULL, NULL, ARRAY['olympic athlete', 'olympian', 'olympics', 'olympic team', 'olympic games'], ARRAY['experience_description', 'activities_honors', 'headline'], NULL, 'Competed in the Olympic Games.', TRUE, TRUE),
('Paralympic Athlete', 'athletics', NULL, NULL, ARRAY['paralympic athlete', 'paralympian', 'paralympics', 'paralympic games'], ARRAY['experience_description', 'activities_honors', 'headline'], NULL, 'Competed in the Paralympic Games.', TRUE, TRUE),
('Professional Athlete', 'athletics', NULL, NULL, ARRAY['professional athlete', 'pro athlete', 'professional sports'], ARRAY['experience_description', 'headline'], NULL, 'Competed as a professional athlete.', TRUE, TRUE),
('Club Sport Athlete', 'athletics', NULL, NULL, ARRAY['club sport', 'club team', 'club athlete', 'club sports'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Participated in collegiate club sports.', TRUE, TRUE),
('Football', 'athletics', NULL, NULL, ARRAY['football', 'varsity football', 'college football', 'ncaa football'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate football participation.', TRUE, TRUE),
('Men''s Basketball', 'athletics', NULL, NULL, ARRAY['men''s basketball', 'basketball', 'varsity basketball', 'college basketball'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate men''s basketball participation.', TRUE, TRUE),
('Women''s Basketball', 'athletics', NULL, NULL, ARRAY['women''s basketball', 'wbb', 'varsity women''s basketball'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate women''s basketball participation.', TRUE, TRUE),
('Baseball', 'athletics', NULL, NULL, ARRAY['baseball', 'varsity baseball', 'college baseball'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate baseball participation.', TRUE, TRUE),
('Softball', 'athletics', NULL, NULL, ARRAY['softball', 'varsity softball', 'college softball'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate softball participation.', TRUE, TRUE),
('Men''s Soccer', 'athletics', NULL, NULL, ARRAY['men''s soccer', 'soccer', 'varsity soccer'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate men''s soccer participation.', TRUE, TRUE),
('Women''s Soccer', 'athletics', NULL, NULL, ARRAY['women''s soccer', 'varsity women''s soccer'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate women''s soccer participation.', TRUE, TRUE),
('Men''s Lacrosse', 'athletics', NULL, NULL, ARRAY['men''s lacrosse', 'lacrosse', 'varsity lacrosse'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate men''s lacrosse participation.', TRUE, TRUE),
('Women''s Lacrosse', 'athletics', NULL, NULL, ARRAY['women''s lacrosse', 'varsity women''s lacrosse'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate women''s lacrosse participation.', TRUE, TRUE),
('Men''s Ice Hockey', 'athletics', NULL, NULL, ARRAY['men''s ice hockey', 'ice hockey', 'varsity hockey', 'college hockey'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate men''s ice hockey participation.', TRUE, TRUE),
('Women''s Ice Hockey', 'athletics', NULL, NULL, ARRAY['women''s ice hockey', 'varsity women''s hockey'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate women''s ice hockey participation.', TRUE, TRUE),
('Field Hockey', 'athletics', NULL, NULL, ARRAY['field hockey', 'varsity field hockey'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate field hockey participation.', TRUE, TRUE),
('Volleyball', 'athletics', NULL, NULL, ARRAY['volleyball', 'varsity volleyball', 'college volleyball'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate volleyball participation.', TRUE, TRUE),
('Tennis', 'athletics', NULL, NULL, ARRAY['tennis', 'varsity tennis', 'college tennis'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate tennis participation.', TRUE, TRUE),
('Golf', 'athletics', NULL, NULL, ARRAY['golf', 'varsity golf', 'college golf'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate golf participation.', TRUE, TRUE),
('Track and Field', 'athletics', NULL, NULL, ARRAY['track and field', 'track & field', 'varsity track', 'sprinter', 'distance runner', 'hurdler', 'thrower', 'jumper'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate track and field participation.', TRUE, TRUE),
('Cross Country', 'athletics', NULL, NULL, ARRAY['cross country', 'xc', 'varsity cross country', 'college xc'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate cross country participation.', TRUE, TRUE),
('Swimming and Diving', 'athletics', NULL, NULL, ARRAY['swimming', 'swimming and diving', 'varsity swimming', 'swim team', 'dive team'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate swimming and diving participation.', TRUE, TRUE),
('Rowing', 'athletics', NULL, NULL, ARRAY['rowing', 'crew', 'varsity rowing', 'heavyweight crew', 'lightweight crew', 'varsity crew'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate rowing/crew participation.', TRUE, TRUE),
('Wrestling', 'athletics', NULL, NULL, ARRAY['wrestling', 'varsity wrestling', 'college wrestling'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate wrestling participation.', TRUE, TRUE),
('Fencing', 'athletics', NULL, NULL, ARRAY['fencing', 'varsity fencing', 'college fencing', 'epee', 'foil', 'sabre'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Collegiate fencing participation.', TRUE, TRUE)

ON CONFLICT (canonical_name, category) DO UPDATE SET
  subcategory = EXCLUDED.subcategory, tier_group = EXCLUDED.tier_group,
  aliases = EXCLUDED.aliases, source_field_hints = EXCLUDED.source_field_hints,
  canonical_url = EXCLUDED.canonical_url, description = EXCLUDED.description,
  is_positive = EXCLUDED.is_positive, is_active = EXCLUDED.is_active, updated_at = NOW();

-- ============================================================
-- ENGINEERING TEAM (24 entries)
-- ============================================================

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES

('Formula SAE', 'engineering_team', NULL, NULL, ARRAY['formula sae', 'fsae', 'formula sae team', 'sae formula'], ARRAY['education_description', 'projects', 'activities_honors'], 'https://www.fsaeonline.com', 'Collegiate competition to design, build, and race a formula-style race car.', TRUE, TRUE),
('Formula Hybrid', 'engineering_team', NULL, NULL, ARRAY['formula hybrid', 'hybrid formula', 'formula hybrid competition'], ARRAY['education_description', 'projects'], NULL, 'Hybrid-electric variant of Formula SAE.', TRUE, TRUE),
('Formula Electric', 'engineering_team', NULL, NULL, ARRAY['formula electric', 'formula sae electric', 'fse', 'electric formula'], ARRAY['education_description', 'projects'], NULL, 'Electric variant of Formula SAE/Formula Student.', TRUE, TRUE),
('Formula Student', 'engineering_team', NULL, NULL, ARRAY['formula student', 'formula student team', 'fs team'], ARRAY['education_description', 'projects'], 'https://www.imeche.org/events/formula-student', 'International equivalent of Formula SAE.', TRUE, TRUE),
('Solar Car Team', 'engineering_team', NULL, NULL, ARRAY['solar car', 'solar car team', 'solar vehicle team', 'american solar challenge', 'world solar challenge'], ARRAY['education_description', 'projects'], NULL, 'Collegiate teams designing and racing solar-powered vehicles.', TRUE, TRUE),
('Concrete Canoe', 'engineering_team', NULL, NULL, ARRAY['concrete canoe', 'asce concrete canoe', 'concrete canoe competition'], ARRAY['education_description', 'projects', 'activities_honors'], NULL, 'ASCE student competition to design and race a canoe made of concrete.', TRUE, TRUE),
('Steel Bridge', 'engineering_team', NULL, NULL, ARRAY['steel bridge', 'asce steel bridge', 'steel bridge competition'], ARRAY['education_description', 'projects', 'activities_honors'], NULL, 'ASCE student competition to design and build a steel bridge.', TRUE, TRUE),
('Human Powered Vehicle', 'engineering_team', NULL, NULL, ARRAY['human powered vehicle', 'hpv', 'asme hpvc', 'human powered vehicle challenge'], ARRAY['education_description', 'projects'], NULL, 'ASME competition to design human-powered vehicles.', TRUE, TRUE),
('Baja SAE', 'engineering_team', NULL, NULL, ARRAY['baja sae', 'baja', 'mini baja', 'sae baja'], ARRAY['education_description', 'projects', 'activities_honors'], NULL, 'SAE competition to design and build an off-road vehicle.', TRUE, TRUE),
('AIAA Design/Build/Fly', 'engineering_team', NULL, NULL, ARRAY['aiaa dbf', 'design build fly', 'aiaa design build fly', 'dbf competition'], ARRAY['education_description', 'projects'], 'https://www.aiaa.org/dbf', 'AIAA competition to design and fly a radio-controlled aircraft.', TRUE, TRUE),
('NASA Student Launch', 'engineering_team', NULL, NULL, ARRAY['nasa student launch', 'nasa slp', 'student launch initiative', 'nasa student launch initiative'], ARRAY['education_description', 'projects'], NULL, 'NASA program for students to design, build, and launch high-powered rockets.', TRUE, TRUE),
('Battlebots Collegiate', 'engineering_team', NULL, NULL, ARRAY['battlebots', 'battle bots', 'combat robotics team', 'battlebots collegiate'], ARRAY['education_description', 'projects'], NULL, 'Collegiate combat robotics team competing in BattleBots-style events.', TRUE, TRUE),
('FIRST Robotics', 'engineering_team', NULL, NULL, ARRAY['first robotics', 'frc team', 'first frc', 'first robotics competition'], ARRAY['education_description', 'projects', 'activities_honors'], 'https://www.firstinspires.org', 'FIRST Robotics Competition — high school but frequently listed on college profiles.', TRUE, TRUE),
('VEX Robotics', 'engineering_team', NULL, NULL, ARRAY['vex robotics', 'vex', 'vex competition', 'vex robotics competition'], ARRAY['education_description', 'projects', 'activities_honors'], 'https://www.vexrobotics.com', 'VEX Robotics Competition — high school/collegiate robotics.', TRUE, TRUE),
('Rocket Team', 'engineering_team', NULL, NULL, ARRAY['rocket team', 'rocketry team', 'rocketry club', 'spaceport america cup'], ARRAY['education_description', 'projects'], NULL, 'Collegiate rocketry team competing in events like Spaceport America Cup.', TRUE, TRUE),
('Autonomous Vehicle Team', 'engineering_team', NULL, NULL, ARRAY['autonomous vehicle team', 'self-driving car team', 'av team', 'autonomous racing'], ARRAY['education_description', 'projects'], NULL, 'Collegiate autonomous vehicle development team.', TRUE, TRUE),
('Mars Rover Team', 'engineering_team', NULL, NULL, ARRAY['mars rover', 'university rover challenge', 'urc', 'mars rover team', 'rover team'], ARRAY['education_description', 'projects'], NULL, 'Collegiate teams building Mars rover prototypes for University Rover Challenge.', TRUE, TRUE),
('CubeSat Team', 'engineering_team', NULL, NULL, ARRAY['cubesat', 'cubesat team', 'cube satellite', 'small satellite team', 'smallsat'], ARRAY['education_description', 'projects'], NULL, 'Collegiate teams designing and building CubeSat nanosatellites.', TRUE, TRUE),
('Hyperloop Team', 'engineering_team', NULL, NULL, ARRAY['hyperloop', 'hyperloop team', 'hyperloop pod', 'hyperloop pod competition', 'spacex hyperloop'], ARRAY['education_description', 'projects'], NULL, 'Collegiate Hyperloop pod design and competition teams.', TRUE, TRUE),
('RoboSub', 'engineering_team', NULL, NULL, ARRAY['robosub', 'robo sub', 'auvsi robosub', 'autonomous underwater vehicle'], ARRAY['education_description', 'projects'], NULL, 'AUVSI competition for autonomous underwater vehicles.', TRUE, TRUE),
('RoboBoat', 'engineering_team', NULL, NULL, ARRAY['roboboat', 'robo boat', 'auvsi roboboat', 'autonomous surface vehicle'], ARRAY['education_description', 'projects'], NULL, 'AUVSI competition for autonomous surface vehicles.', TRUE, TRUE),
('Drone Team (SUAS)', 'engineering_team', NULL, NULL, ARRAY['suas', 'drone team', 'suas competition', 'auvsi suas', 'student uas'], ARRAY['education_description', 'projects'], NULL, 'AUVSI Student Unmanned Aerial Systems competition.', TRUE, TRUE),
('ACM ICPC', 'engineering_team', NULL, NULL, ARRAY['acm icpc', 'icpc', 'acm icpc team', 'icpc team', 'programming contest team'], ARRAY['education_description', 'projects', 'activities_honors'], 'https://icpc.global', 'ACM International Collegiate Programming Contest team.', TRUE, TRUE),
('iGEM', 'engineering_team', NULL, NULL, ARRAY['igem', 'international genetically engineered machine', 'igem team', 'synthetic biology team'], ARRAY['education_description', 'projects'], 'https://igem.org', 'International synthetic biology competition for student teams.', TRUE, TRUE)

ON CONFLICT (canonical_name, category) DO UPDATE SET
  subcategory = EXCLUDED.subcategory, tier_group = EXCLUDED.tier_group,
  aliases = EXCLUDED.aliases, source_field_hints = EXCLUDED.source_field_hints,
  canonical_url = EXCLUDED.canonical_url, description = EXCLUDED.description,
  is_positive = EXCLUDED.is_positive, is_active = EXCLUDED.is_active, updated_at = NOW();

-- ============================================================
-- STUDENT LEADERSHIP (22 entries)
-- ============================================================

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES

('Student Body President', 'student_leadership', NULL, NULL, ARRAY['student body president', 'student government president', 'sg president', 'student association president', 'student council president'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Elected president of student government at their university.', TRUE, TRUE),
('Student Senate Member', 'student_leadership', NULL, NULL, ARRAY['student senate', 'student senator', 'student government senator', 'undergraduate senate'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Elected or appointed member of student senate.', TRUE, TRUE),
('Student Council Member', 'student_leadership', NULL, NULL, ARRAY['student council', 'student council member', 'student government member'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Member of student council or student government.', TRUE, TRUE),
('Class President', 'student_leadership', NULL, NULL, ARRAY['class president', 'senior class president', 'junior class president', 'sophomore class president', 'freshman class president'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Elected president of their graduating class.', TRUE, TRUE),
('Resident Assistant', 'student_leadership', NULL, NULL, ARRAY['resident assistant', 'resident advisor', 'ra', 'resident adviser', 'community advisor'], ARRAY['education_description', 'experience_description', 'volunteer'], NULL, 'Resident Assistant — peer leader in university housing.', TRUE, TRUE),
('Orientation Leader', 'student_leadership', NULL, NULL, ARRAY['orientation leader', 'orientation mentor', 'o-leader', 'orientation counselor', 'freshman orientation leader'], ARRAY['education_description', 'volunteer'], NULL, 'Led orientation programming for incoming students.', TRUE, TRUE),
('Admissions Tour Guide', 'student_leadership', NULL, NULL, ARRAY['tour guide', 'admissions tour guide', 'campus tour guide', 'admissions ambassador', 'student ambassador'], ARRAY['education_description', 'volunteer', 'experience_description'], NULL, 'Represented the university as admissions tour guide or student ambassador.', TRUE, TRUE),
('Teaching Assistant', 'student_leadership', NULL, NULL, ARRAY['teaching assistant', 'ta', 'undergraduate ta', 'course assistant', 'lab assistant', 'grader'], ARRAY['education_description', 'experience_description'], NULL, 'Teaching or course assistant for a university course.', TRUE, TRUE),
('Peer Mentor', 'student_leadership', NULL, NULL, ARRAY['peer mentor', 'peer tutor', 'peer advisor', 'peer counselor', 'academic mentor'], ARRAY['education_description', 'volunteer'], NULL, 'Peer mentoring or tutoring role.', TRUE, TRUE),
('Honor Council Member', 'student_leadership', NULL, NULL, ARRAY['honor council', 'honor board', 'honor committee', 'judicial board', 'honor court'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Member of a university honor or judicial council.', TRUE, TRUE),
('Newspaper Editor-in-Chief', 'student_leadership', NULL, NULL, ARRAY['editor in chief', 'editor-in-chief', 'newspaper editor', 'student newspaper editor', 'eic'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Editor-in-Chief of a student newspaper or publication.', TRUE, TRUE),
('Yearbook Editor', 'student_leadership', NULL, NULL, ARRAY['yearbook editor', 'yearbook editor in chief', 'yearbook staff'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Editor of the university or school yearbook.', TRUE, TRUE),
('Radio Station Manager', 'student_leadership', NULL, NULL, ARRAY['radio station manager', 'college radio', 'station manager', 'radio station director'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Manager or director of a college radio station.', TRUE, TRUE),
('Club President', 'student_leadership', NULL, NULL, ARRAY['club president', 'president of club', 'organization president', 'society president'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'President of a student club or organization.', TRUE, TRUE),
('Club/Society Founder', 'student_leadership', NULL, NULL, ARRAY['founded club', 'club founder', 'society founder', 'started a club', 'co-founded club', 'organization founder'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Founded a student club, organization, or society.', TRUE, TRUE),
('Team Captain', 'student_leadership', NULL, NULL, ARRAY['team captain', 'captain', 'co-captain', 'varsity captain'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Captain or co-captain of a sports team or competitive team.', TRUE, TRUE),
('Eagle Scout', 'student_leadership', NULL, NULL, ARRAY['eagle scout', 'boy scout eagle', 'bsa eagle scout', 'eagle rank'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Highest rank in Boy Scouts of America — earned by ~6% of scouts.', TRUE, TRUE),
('Girl Scout Gold Award', 'student_leadership', NULL, NULL, ARRAY['gold award', 'girl scout gold award', 'girl scout gold', 'gsusa gold award'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Highest achievement in Girl Scouts — equivalent to Eagle Scout.', TRUE, TRUE),
('Order of the Arrow', 'student_leadership', NULL, NULL, ARRAY['order of the arrow', 'oa', 'bsa order of the arrow', 'ordeal member', 'brotherhood member', 'vigil honor'], ARRAY['education_description', 'volunteer', 'activities_honors'], NULL, 'Scouting''s national honor society for experienced campers.', TRUE, TRUE),
('Boys/Girls State Delegate', 'student_leadership', NULL, NULL, ARRAY['boys state', 'girls state', 'american legion boys state', 'american legion auxiliary girls state', 'boys state delegate', 'girls state delegate'], ARRAY['education_description', 'activities_honors'], NULL, 'Selected delegate to Boys State or Girls State mock-government program.', TRUE, TRUE),
('Boys/Girls Nation Delegate', 'student_leadership', NULL, NULL, ARRAY['boys nation', 'girls nation', 'boys nation delegate', 'girls nation delegate', 'boys nation senator'], ARRAY['education_description', 'activities_honors'], NULL, 'Selected for the national-level Boys Nation or Girls Nation program.', TRUE, TRUE),
('Model UN Award Winner', 'student_leadership', NULL, NULL, ARRAY['model un', 'model united nations', 'mun', 'best delegate', 'outstanding delegate', 'distinguished delegate mun'], ARRAY['education_description', 'activities_honors'], NULL, 'Award winner at Model United Nations conference (Best/Outstanding/Distinguished Delegate).', TRUE, TRUE)

ON CONFLICT (canonical_name, category) DO UPDATE SET
  subcategory = EXCLUDED.subcategory, tier_group = EXCLUDED.tier_group,
  aliases = EXCLUDED.aliases, source_field_hints = EXCLUDED.source_field_hints,
  canonical_url = EXCLUDED.canonical_url, description = EXCLUDED.description,
  is_positive = EXCLUDED.is_positive, is_active = EXCLUDED.is_active, updated_at = NOW();

-- ============================================================
-- ACADEMIC DISTINCTION (20 entries)
-- ============================================================

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES

('Valedictorian', 'academic_distinction', 'valedictorian', NULL, ARRAY['valedictorian', 'class valedictorian', 'graduated valedictorian'], ARRAY['activities_honors', 'education_description'], NULL, 'Graduated first in class.', TRUE, TRUE),
('Salutatorian', 'academic_distinction', 'salutatorian', NULL, ARRAY['salutatorian', 'class salutatorian', 'graduated salutatorian'], ARRAY['activities_honors', 'education_description'], NULL, 'Graduated second in class.', TRUE, TRUE),
('Summa Cum Laude', 'academic_distinction', 'summa_cum_laude', NULL, ARRAY['summa cum laude', 'summa', 'graduated summa cum laude', 'with highest honors'], ARRAY['activities_honors', 'education_description'], NULL, 'Graduated with highest Latin honors (typically top ~5% GPA).', TRUE, TRUE),
('Magna Cum Laude', 'academic_distinction', 'magna_cum_laude', NULL, ARRAY['magna cum laude', 'magna', 'graduated magna cum laude', 'with high honors'], ARRAY['activities_honors', 'education_description'], NULL, 'Graduated with high Latin honors (typically top ~10-15% GPA).', TRUE, TRUE),
('Cum Laude', 'academic_distinction', 'cum_laude', NULL, ARRAY['cum laude', 'graduated cum laude', 'with honors', 'graduated with honors'], ARRAY['activities_honors', 'education_description'], NULL, 'Graduated with Latin honors (typically top ~25-30% GPA).', TRUE, TRUE),
('Dean''s List', 'academic_distinction', 'deans_list', NULL, ARRAY['dean''s list', 'deans list', 'dean''s honor list', 'dean''s list scholar'], ARRAY['activities_honors', 'education_description'], NULL, 'Named to the Dean''s List for academic achievement during a semester.', TRUE, TRUE),
('Honors College', 'academic_distinction', 'honors_college', NULL, ARRAY['honors college', 'honors program', 'university honors', 'honors student', 'honors scholar'], ARRAY['activities_honors', 'education_description'], NULL, 'Member of the university Honors College or Honors Program.', TRUE, TRUE),
('Phi Beta Kappa', 'academic_distinction', 'phi_beta_kappa', NULL, ARRAY['phi beta kappa', 'pbk', 'phiBK'], ARRAY['activities_honors', 'education_description'], 'https://www.pbk.org', 'Most prestigious academic honor society — founded 1776. Top ~10% of arts & sciences.', TRUE, TRUE),
('Tau Beta Pi', 'academic_distinction', 'tau_beta_pi', NULL, ARRAY['tau beta pi', 'tbp', 'tau beta pi engineering'], ARRAY['activities_honors', 'education_description'], 'https://www.tbp.org', 'Oldest engineering honor society — top 1/8 of junior class or top 1/5 of senior class.', TRUE, TRUE),
('Eta Kappa Nu', 'academic_distinction', 'eta_kappa_nu', NULL, ARRAY['eta kappa nu', 'hkn', 'ieee-hkn', 'ieee eta kappa nu'], ARRAY['activities_honors', 'education_description'], 'https://hkn.ieee.org', 'IEEE''s honor society for electrical and computer engineering.', TRUE, TRUE),
('Sigma Xi', 'academic_distinction', 'sigma_xi', NULL, ARRAY['sigma xi', 'sigma xi research honor society'], ARRAY['activities_honors', 'education_description'], 'https://www.sigmaxi.org', 'Scientific research honor society — membership indicates significant research contribution.', TRUE, TRUE),
('Pi Tau Sigma', 'academic_distinction', 'pi_tau_sigma', NULL, ARRAY['pi tau sigma', 'pts', 'pi tau sigma mechanical'], ARRAY['activities_honors', 'education_description'], 'https://pitausigma.org', 'International mechanical engineering honor society.', TRUE, TRUE),
('Tau Sigma', 'academic_distinction', 'tau_sigma', NULL, ARRAY['tau sigma', 'tau sigma honor society', 'transfer student honor society'], ARRAY['activities_honors', 'education_description'], NULL, 'National honor society for transfer students with high academic achievement.', TRUE, TRUE),
('Phi Kappa Phi', 'academic_distinction', 'phi_kappa_phi', NULL, ARRAY['phi kappa phi', 'pkp honor society'], ARRAY['activities_honors', 'education_description'], 'https://www.phikappaphi.org', 'Oldest all-discipline honor society — top 7.5% of juniors, top 10% of seniors.', TRUE, TRUE),
('Mortar Board', 'academic_distinction', 'mortar_board', NULL, ARRAY['mortar board', 'mortar board honor society', 'mortar board national honor society'], ARRAY['activities_honors', 'education_description'], 'https://www.mortarboard.org', 'Senior honor society recognizing scholarship, leadership, and service.', TRUE, TRUE),
('Order of Omega', 'academic_distinction', 'order_of_omega', NULL, ARRAY['order of omega', 'order of omega honor society'], ARRAY['activities_honors', 'education_description'], 'https://www.orderofomega.org', 'Greek honor society recognizing top 3% of Greek-affiliated students.', TRUE, TRUE),
('Beta Gamma Sigma', 'academic_distinction', 'beta_gamma_sigma', NULL, ARRAY['beta gamma sigma', 'bgs', 'beta gamma sigma business'], ARRAY['activities_honors', 'education_description'], 'https://www.betagammasigma.org', 'Honor society for AACSB-accredited business schools — top 10% of class.', TRUE, TRUE),
('Phi Theta Kappa', 'academic_distinction', 'phi_theta_kappa', NULL, ARRAY['phi theta kappa', 'ptk', 'phi theta kappa honor society'], ARRAY['activities_honors', 'education_description'], 'https://www.ptk.org', 'Honor society for community college students — strong signal for transfer students.', TRUE, TRUE),
('Golden Key', 'academic_distinction', 'golden_key', NULL, ARRAY['golden key', 'golden key international', 'golden key honour society', 'golden key honor society'], ARRAY['activities_honors', 'education_description'], 'https://www.goldenkey.org', 'International honour society — top 15% of class across all disciplines.', TRUE, TRUE),
('Alpha Lambda Delta', 'academic_distinction', 'alpha_lambda_delta', NULL, ARRAY['alpha lambda delta', 'ald', 'alpha lambda delta honor society'], ARRAY['activities_honors', 'education_description'], 'https://www.nationalald.org', 'Freshman honor society — recognizes top academic achievement in first year.', TRUE, TRUE)

ON CONFLICT (canonical_name, category) DO UPDATE SET
  subcategory = EXCLUDED.subcategory, tier_group = EXCLUDED.tier_group,
  aliases = EXCLUDED.aliases, source_field_hints = EXCLUDED.source_field_hints,
  canonical_url = EXCLUDED.canonical_url, description = EXCLUDED.description,
  is_positive = EXCLUDED.is_positive, is_active = EXCLUDED.is_active, updated_at = NOW();

-- ============================================================
-- FOUNDER (4 entries)
-- ============================================================

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES

('Funded Founder', 'founder', 'funded', NULL, ARRAY['funded founder', 'venture-backed founder', 'vc-backed founder', 'raised funding'], ARRAY['title', 'experience_description'], NULL, 'Founded a company that received external investment (VC, angel, seed, etc.).', TRUE, TRUE),
('Bootstrapped Founder', 'founder', 'bootstrapped', NULL, ARRAY['bootstrapped founder', 'self-funded founder', 'bootstrapped company'], ARRAY['title', 'experience_description'], NULL, 'Founded and self-funded a company without external investment.', TRUE, TRUE),
('Non-Funded Founder', 'founder', 'non_funded', NULL, ARRAY['non-funded founder', 'unfunded founder', 'founder no funding'], ARRAY['title', 'experience_description'], NULL, 'Founded a company that did not receive significant funding.', TRUE, TRUE),
('Side Project Founder', 'founder', 'side_project', NULL, ARRAY['side project', 'side project founder', 'hobby project founder', 'personal project founder'], ARRAY['title', 'experience_description', 'projects'], NULL, 'Built a notable side project, app, or tool outside of primary employment.', TRUE, TRUE)

ON CONFLICT (canonical_name, category) DO UPDATE SET
  subcategory = EXCLUDED.subcategory, tier_group = EXCLUDED.tier_group,
  aliases = EXCLUDED.aliases, source_field_hints = EXCLUDED.source_field_hints,
  canonical_url = EXCLUDED.canonical_url, description = EXCLUDED.description,
  is_positive = EXCLUDED.is_positive, is_active = EXCLUDED.is_active, updated_at = NOW();

-- ============================================================
-- COMPETITION (98 entries: 91 named + 7 catchalls)
-- ============================================================

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES

-- Math (13)
('International Mathematical Olympiad (IMO)', 'competition', NULL, NULL, ARRAY['imo', 'international mathematical olympiad', 'international math olympiad', 'imo medalist'], ARRAY['activities_honors', 'education_description'], 'https://www.imo-official.org', 'Most prestigious pre-collegiate math competition worldwide. ~600 students from 100+ countries.', TRUE, TRUE),
('USA Mathematical Olympiad (USAMO)', 'competition', NULL, NULL, ARRAY['usamo', 'usa mathematical olympiad', 'us math olympiad', 'usamo qualifier'], ARRAY['activities_honors', 'education_description'], NULL, 'Top ~250 students in the U.S. qualifying through AMC/AIME.', TRUE, TRUE),
('USA Junior Mathematical Olympiad (USAJMO)', 'competition', NULL, NULL, ARRAY['usajmo', 'usa junior mathematical olympiad', 'junior math olympiad'], ARRAY['activities_honors', 'education_description'], NULL, 'Junior version of USAMO for students qualifying through AMC 10/AIME.', TRUE, TRUE),
('AMC 10', 'competition', NULL, NULL, ARRAY['amc 10', 'american mathematics competition 10', 'amc10'], ARRAY['activities_honors', 'education_description'], NULL, 'MAA math competition for students in grade 10 and below.', TRUE, TRUE),
('AMC 12', 'competition', NULL, NULL, ARRAY['amc 12', 'american mathematics competition 12', 'amc12'], ARRAY['activities_honors', 'education_description'], NULL, 'MAA math competition for students in grade 12 and below.', TRUE, TRUE),
('American Invitational Mathematics Examination (AIME)', 'competition', NULL, NULL, ARRAY['aime', 'american invitational mathematics examination', 'aime qualifier'], ARRAY['activities_honors', 'education_description'], NULL, 'Invitation-only exam for top AMC scorers — bridge to USAMO.', TRUE, TRUE),
('William Lowell Putnam Mathematical Competition', 'competition', NULL, NULL, ARRAY['putnam', 'putnam competition', 'putnam exam', 'putnam fellow', 'putnam math competition'], ARRAY['activities_honors', 'education_description'], NULL, 'Premier undergraduate math competition in North America. Putnam Fellow = top 5.', TRUE, TRUE),
('Mathcounts', 'competition', NULL, NULL, ARRAY['mathcounts', 'math counts', 'mathcounts national', 'mathcounts state'], ARRAY['activities_honors', 'education_description'], 'https://www.mathcounts.org', 'National middle school math competition. Nationals = top signal.', TRUE, TRUE),
('Harvard-MIT Mathematics Tournament (HMMT)', 'competition', NULL, NULL, ARRAY['hmmt', 'harvard-mit math tournament', 'harvard mit math tournament'], ARRAY['activities_honors', 'education_description'], 'https://www.hmmt.org', 'Prestigious invitational math competition run by Harvard and MIT students.', TRUE, TRUE),
('Princeton University Mathematics Competition (PUMaC)', 'competition', NULL, NULL, ARRAY['pumac', 'princeton math competition', 'princeton university mathematics competition'], ARRAY['activities_honors', 'education_description'], NULL, 'Princeton''s annual math competition for high school students.', TRUE, TRUE),
('Stanford Math Tournament', 'competition', NULL, NULL, ARRAY['stanford math tournament', 'smt', 'stanford math tournament smt'], ARRAY['activities_honors', 'education_description'], NULL, 'Stanford''s annual math competition for high school students.', TRUE, TRUE),
('American Regions Mathematics League (ARML)', 'competition', NULL, NULL, ARRAY['arml', 'american regions mathematics league', 'arml math'], ARRAY['activities_honors', 'education_description'], NULL, 'National math competition with regional teams.', TRUE, TRUE),
('Math Prize for Girls', 'competition', NULL, NULL, ARRAY['math prize for girls', 'mathprizeforgirls'], ARRAY['activities_honors', 'education_description'], 'https://mathprizeforgirls.org', 'Largest math competition for female-identifying students in the U.S.', TRUE, TRUE),

-- Physics (4)
('International Physics Olympiad (IPhO)', 'competition', NULL, NULL, ARRAY['ipho', 'international physics olympiad', 'physics olympiad international'], ARRAY['activities_honors', 'education_description'], 'https://www.ipho-new.org', 'Annual international physics competition for high school students from 80+ countries.', TRUE, TRUE),
('US Physics Olympiad (USAPhO)', 'competition', NULL, NULL, ARRAY['usapho', 'us physics olympiad', 'usa physics olympiad', 'physics team usa'], ARRAY['activities_honors', 'education_description'], NULL, 'National physics competition — top performers represent the U.S. at IPhO.', TRUE, TRUE),
('Physics Bowl', 'competition', NULL, NULL, ARRAY['physics bowl', 'aapt physics bowl'], ARRAY['activities_honors', 'education_description'], NULL, 'AAPT nationwide physics competition for high school students.', TRUE, TRUE),
('Princeton Physics Competition', 'competition', NULL, NULL, ARRAY['princeton physics competition', 'ppc'], ARRAY['activities_honors', 'education_description'], NULL, 'Princeton''s annual physics competition for high school teams.', TRUE, TRUE),

-- Chemistry (2)
('International Chemistry Olympiad (IChO)', 'competition', NULL, NULL, ARRAY['icho', 'international chemistry olympiad', 'chemistry olympiad international'], ARRAY['activities_honors', 'education_description'], 'https://www.icho.us', 'Annual international chemistry competition for high school students.', TRUE, TRUE),
('US National Chemistry Olympiad (USNCO)', 'competition', NULL, NULL, ARRAY['usnco', 'us national chemistry olympiad', 'national chemistry olympiad', 'acs chemistry olympiad'], ARRAY['activities_honors', 'education_description'], NULL, 'ACS-run national chemistry competition — top performers go to IChO.', TRUE, TRUE),

-- Biology (2)
('International Biology Olympiad (IBO)', 'competition', NULL, NULL, ARRAY['ibo', 'international biology olympiad', 'biology olympiad international'], ARRAY['activities_honors', 'education_description'], 'https://www.ibo-info.org', 'Annual international biology competition for high school students.', TRUE, TRUE),
('USA Biology Olympiad (USABO)', 'competition', NULL, NULL, ARRAY['usabo', 'usa biology olympiad', 'us biology olympiad', 'biology olympiad usa'], ARRAY['activities_honors', 'education_description'], NULL, 'National biology competition — top performers represent the U.S. at IBO.', TRUE, TRUE),

-- CS / Programming (7, after dropping HackTheBox and TryHackMe)
('USA Computing Olympiad (USACO)', 'competition', NULL, NULL, ARRAY['usaco', 'usa computing olympiad', 'usaco platinum', 'usaco gold', 'usaco silver'], ARRAY['activities_honors', 'education_description'], 'https://usaco.org', 'Premier U.S. pre-collegiate programming competition. Platinum division = top signal.', TRUE, TRUE),
('International Olympiad in Informatics (IOI)', 'competition', NULL, NULL, ARRAY['ioi', 'international olympiad in informatics', 'informatics olympiad'], ARRAY['activities_honors', 'education_description'], 'https://ioinformatics.org', 'Annual international programming competition for high school students.', TRUE, TRUE),
('ACM-ICPC', 'competition', NULL, NULL, ARRAY['acm-icpc', 'icpc', 'acm icpc', 'collegiate programming contest', 'icpc world finals', 'icpc regionals'], ARRAY['activities_honors', 'education_description', 'projects'], 'https://icpc.global', 'ACM International Collegiate Programming Contest — World Finals = elite signal.', TRUE, TRUE),
('Google Code Jam', 'competition', NULL, NULL, ARRAY['google code jam', 'code jam', 'gcj', 'google codejam'], ARRAY['activities_honors', 'experience_description'], NULL, 'Google''s annual global programming competition (discontinued 2023, alumni remain).', TRUE, TRUE),
('Meta Hacker Cup', 'competition', NULL, NULL, ARRAY['meta hacker cup', 'facebook hacker cup', 'hacker cup'], ARRAY['activities_honors', 'experience_description'], NULL, 'Meta''s annual programming competition.', TRUE, TRUE),
('Topcoder Open', 'competition', NULL, NULL, ARRAY['topcoder', 'topcoder open', 'tco', 'topcoder srm'], ARRAY['activities_honors', 'experience_description'], 'https://www.topcoder.com', 'Programming competition platform — Topcoder Open is the annual championship.', TRUE, TRUE),
('Codeforces Competition', 'competition', NULL, NULL, ARRAY['codeforces', 'codeforces grandmaster', 'codeforces master', 'codeforces candidate master', 'codeforces international master', 'codeforces rated', 'cf rating'], ARRAY['activities_honors', 'experience_description'], 'https://codeforces.com', 'Competitive programming platform. Real signal is rated rank (Grandmaster, International Master, etc.) not bare participation.', TRUE, TRUE),
('LeetCode Weekly Contest', 'competition', NULL, NULL, ARRAY['leetcode contest', 'leetcode weekly', 'leetcode biweekly', 'leetcode guardian', 'leetcode knight', 'leetcode top rated', 'leetcode ranking'], ARRAY['activities_honors', 'experience_description'], 'https://leetcode.com', 'LeetCode competitive contests. Real signal is rated rank (Guardian, Knight, top X%) not bare participation.', TRUE, TRUE),
('Kaggle Competition', 'competition', NULL, NULL, ARRAY['kaggle', 'kaggle competition', 'kaggle grandmaster', 'kaggle master', 'kaggle gold medal', 'kaggle winner'], ARRAY['activities_honors', 'experience_description', 'projects'], 'https://www.kaggle.com', 'Data science/ML competition platform. Grandmaster/Master rank = strong signal.', TRUE, TRUE),

-- Linguistics (2)
('International Linguistics Olympiad (IOL)', 'competition', NULL, NULL, ARRAY['iol', 'international linguistics olympiad', 'linguistics olympiad'], ARRAY['activities_honors', 'education_description'], 'https://ioling.org', 'Annual international linguistics competition for high school students.', TRUE, TRUE),
('North American Computational Linguistics Open (NACLO)', 'competition', NULL, NULL, ARRAY['naclo', 'north american computational linguistics', 'naclo linguistics'], ARRAY['activities_honors', 'education_description'], 'https://naclo.org', 'North American qualifier for the International Linguistics Olympiad.', TRUE, TRUE),

-- Astronomy (2)
('International Olympiad on Astronomy and Astrophysics (IOAA)', 'competition', NULL, NULL, ARRAY['ioaa', 'international olympiad on astronomy', 'astronomy olympiad international'], ARRAY['activities_honors', 'education_description'], NULL, 'Annual international astronomy and astrophysics competition.', TRUE, TRUE),
('USA Astronomy and Astrophysics Olympiad (USAAAO)', 'competition', NULL, NULL, ARRAY['usaaao', 'usa astronomy olympiad', 'us astronomy olympiad'], ARRAY['activities_honors', 'education_description'], NULL, 'U.S. national astronomy competition — qualifiers represent at IOAA.', TRUE, TRUE),

-- Earth Science (2)
('International Earth Science Olympiad (IESO)', 'competition', NULL, NULL, ARRAY['ieso', 'international earth science olympiad', 'earth science olympiad'], ARRAY['activities_honors', 'education_description'], NULL, 'Annual international earth science competition.', TRUE, TRUE),
('USA Earth Science Olympiad', 'competition', NULL, NULL, ARRAY['usa earth science olympiad', 'us earth science olympiad', 'earth science olympiad usa'], ARRAY['activities_honors', 'education_description'], NULL, 'U.S. national earth science competition.', TRUE, TRUE),

-- Research / Science Fair (7)
('Regeneron Science Talent Search', 'competition', NULL, NULL, ARRAY['regeneron sts', 'science talent search', 'sts', 'intel sts', 'westinghouse sts', 'regeneron science talent search'], ARRAY['activities_honors', 'education_description'], 'https://www.societyforscience.org/regeneron-sts/', 'Most prestigious pre-college science competition in the U.S. Top 40 finalists = elite signal.', TRUE, TRUE),
('Regeneron ISEF', 'competition', NULL, NULL, ARRAY['regeneron isef', 'isef', 'international science and engineering fair', 'intel isef', 'science fair isef'], ARRAY['activities_honors', 'education_description'], 'https://www.societyforscience.org/isef/', 'World''s largest pre-college science competition — ~1,800 finalists from 80+ countries.', TRUE, TRUE),
('Davidson Fellows', 'competition', NULL, NULL, ARRAY['davidson fellow', 'davidson fellows', 'davidson institute fellow'], ARRAY['activities_honors', 'education_description'], 'https://www.davidsongifted.org', '$10K-$50K scholarship for students 18 and under with significant STEM/humanities projects.', TRUE, TRUE),
('Junior Science and Humanities Symposium (JSHS)', 'competition', NULL, NULL, ARRAY['jshs', 'junior science and humanities symposium', 'junior science humanities'], ARRAY['activities_honors', 'education_description'], NULL, 'DoD-sponsored STEM research competition for high school students.', TRUE, TRUE),
('Siemens Competition', 'competition', NULL, NULL, ARRAY['siemens competition', 'siemens science competition', 'siemens foundation competition'], ARRAY['activities_honors', 'education_description'], NULL, 'Former STEM research competition for high school students (ended 2017, alumni remain).', TRUE, TRUE),
('Google Science Fair', 'competition', NULL, NULL, ARRAY['google science fair', 'gsf'], ARRAY['activities_honors', 'education_description'], NULL, 'Former global online science competition for teens (ended 2018, alumni remain).', TRUE, TRUE),
('Broadcom MASTERS', 'competition', NULL, NULL, ARRAY['broadcom masters', 'broadcom masters finalist', 'broadcom masters semifinalist'], ARRAY['activities_honors', 'education_description'], 'https://www.societyforscience.org/broadcom-masters/', 'Top middle school STEM competition — run by Society for Science.', TRUE, TRUE),

-- Cybersecurity / CTF (19, after dropping HackTheBox and TryHackMe)
('DEF CON CTF', 'competition', NULL, NULL, ARRAY['def con ctf', 'defcon ctf', 'def con capture the flag'], ARRAY['activities_honors', 'experience_description', 'projects'], NULL, 'Premier hacking competition at DEF CON — the "World Series" of CTFs.', TRUE, TRUE),
('picoCTF', 'competition', NULL, NULL, ARRAY['picoctf', 'pico ctf', 'carnegie mellon picoctf'], ARRAY['activities_honors', 'education_description', 'projects'], 'https://picoctf.org', 'CMU-run beginner-to-intermediate CTF for students.', TRUE, TRUE),
('CSAW CTF', 'competition', NULL, NULL, ARRAY['csaw ctf', 'csaw', 'nyu csaw', 'csaw security'], ARRAY['activities_honors', 'education_description', 'projects'], NULL, 'NYU Tandon''s annual cybersecurity awareness CTF.', TRUE, TRUE),
('CyberPatriot', 'competition', NULL, NULL, ARRAY['cyberpatriot', 'cyber patriot', 'air force cyberpatriot'], ARRAY['activities_honors', 'education_description'], 'https://www.uscyberpatriot.org', 'Air Force Association''s national youth cybersecurity competition.', TRUE, TRUE),
('National Cyber League (NCL)', 'competition', NULL, NULL, ARRAY['national cyber league', 'ncl', 'ncl cybersecurity'], ARRAY['activities_honors', 'education_description'], 'https://nationalcyberleague.org', 'Biannual collegiate cybersecurity competition with individual and team rounds.', TRUE, TRUE),
('US Cyber Open', 'competition', NULL, NULL, ARRAY['us cyber open', 'cyber open'], ARRAY['activities_honors', 'education_description'], NULL, 'Open cybersecurity competition as part of the U.S. Cyber Games pipeline.', TRUE, TRUE),
('US Cyber Combine', 'competition', NULL, NULL, ARRAY['us cyber combine', 'cyber combine'], ARRAY['activities_honors', 'education_description'], NULL, 'Skills assessment phase of the U.S. Cyber Games selection process.', TRUE, TRUE),
('US Cyber Team', 'competition', NULL, NULL, ARRAY['us cyber team', 'team usa cyber', 'us cyber games team'], ARRAY['activities_honors', 'education_description'], NULL, 'National team representing the U.S. in the International Cybersecurity Challenge.', TRUE, TRUE),
('International Cybersecurity Challenge (ICC)', 'competition', NULL, NULL, ARRAY['icc', 'international cybersecurity challenge'], ARRAY['activities_honors', 'education_description'], NULL, 'International competition between national cybersecurity teams.', TRUE, TRUE),
('Pwn2Own', 'competition', NULL, NULL, ARRAY['pwn2own', 'pwn to own', 'pwn2own winner'], ARRAY['activities_honors', 'experience_description'], NULL, 'Elite vulnerability discovery competition run by Trend Micro''s ZDI.', TRUE, TRUE),
('PlaidCTF', 'competition', NULL, NULL, ARRAY['plaidctf', 'plaid ctf', 'cmu plaid ctf'], ARRAY['activities_honors', 'experience_description', 'projects'], NULL, 'CTF run by CMU''s Plaid Parliament of Pwning team — top-tier difficulty.', TRUE, TRUE),
('TJCTF', 'competition', NULL, NULL, ARRAY['tjctf', 'tj ctf', 'thomas jefferson ctf'], ARRAY['activities_honors', 'education_description'], NULL, 'CTF run by Thomas Jefferson High School for Science and Technology.', TRUE, TRUE),
('ÅngstromCTF', 'competition', NULL, NULL, ARRAY['angstromctf', 'angstrom ctf', 'ångström ctf'], ARRAY['activities_honors', 'education_description'], NULL, 'High school CTF run by Montgomery Blair High School students.', TRUE, TRUE),
('DOE CyberForce Competition', 'competition', NULL, NULL, ARRAY['cyberforce', 'doe cyberforce', 'cyberforce competition'], ARRAY['activities_honors', 'education_description'], NULL, 'Department of Energy collegiate cybersecurity competition.', TRUE, TRUE),
('CCDC', 'competition', NULL, NULL, ARRAY['ccdc', 'collegiate cyber defense competition', 'nccdc', 'national ccdc'], ARRAY['activities_honors', 'education_description'], 'https://www.nationalccdc.org', 'National Collegiate Cyber Defense Competition — blue team defense exercise.', TRUE, TRUE),
('NSA Codebreaker Challenge', 'competition', NULL, NULL, ARRAY['nsa codebreaker', 'nsa codebreaker challenge', 'codebreaker challenge'], ARRAY['activities_honors', 'education_description'], NULL, 'NSA''s annual reverse engineering and cryptanalysis challenge for students.', TRUE, TRUE),
('MITRE CTF', 'competition', NULL, NULL, ARRAY['mitre ctf', 'mitre ctf competition'], ARRAY['activities_honors', 'education_description'], NULL, 'MITRE''s cybersecurity CTF competition.', TRUE, TRUE),
('MITRE eCTF', 'competition', NULL, NULL, ARRAY['mitre ectf', 'embedded ctf', 'mitre embedded ctf'], ARRAY['activities_honors', 'education_description'], NULL, 'MITRE''s embedded systems security CTF — hardware-focused.', TRUE, TRUE),
('NCAE Cyber Games', 'competition', NULL, NULL, ARRAY['ncae cyber games', 'ncae', 'national centers of academic excellence cyber games'], ARRAY['activities_honors', 'education_description'], NULL, 'NSA/CISA-sponsored cybersecurity games for CAE-designated institutions.', TRUE, TRUE),
('Maryland Cyber Challenge', 'competition', NULL, NULL, ARRAY['maryland cyber challenge', 'md cyber challenge'], ARRAY['activities_honors', 'education_description'], NULL, 'Annual cybersecurity competition hosted by the state of Maryland.', TRUE, TRUE),

-- Robotics (19)
('FIRST Robotics Competition (FRC)', 'competition', NULL, NULL, ARRAY['frc', 'first robotics competition', 'first frc competition'], ARRAY['activities_honors', 'education_description', 'projects'], 'https://www.firstinspires.org/robotics/frc', 'Premier high school robotics competition (also listed on college profiles).', TRUE, TRUE),
('FIRST Tech Challenge (FTC)', 'competition', NULL, NULL, ARRAY['ftc', 'first tech challenge', 'first ftc'], ARRAY['activities_honors', 'education_description', 'projects'], 'https://www.firstinspires.org/robotics/ftc', 'FIRST''s mid-level robotics competition.', TRUE, TRUE),
('FIRST Lego League', 'competition', NULL, NULL, ARRAY['first lego league', 'fll', 'lego robotics', 'first lego'], ARRAY['activities_honors', 'education_description'], 'https://www.firstinspires.org/robotics/fll', 'FIRST''s entry-level robotics competition using LEGO.', TRUE, TRUE),
('VEX Robotics World Championship', 'competition', NULL, NULL, ARRAY['vex worlds', 'vex world championship', 'vex robotics worlds', 'vex robotics world championship'], ARRAY['activities_honors', 'education_description', 'projects'], 'https://www.roboticseducation.org', 'World championship of VEX Robotics Competition.', TRUE, TRUE),
('VEX U', 'competition', NULL, NULL, ARRAY['vex u', 'vexu', 'vex university'], ARRAY['activities_honors', 'education_description', 'projects'], NULL, 'Collegiate division of VEX Robotics Competition.', TRUE, TRUE),
('BattleBots', 'competition', NULL, NULL, ARRAY['battlebots', 'battle bots', 'battlebots competition'], ARRAY['activities_honors', 'experience_description', 'projects'], 'https://battlebots.com', 'Combat robotics competition — featured on TV.', TRUE, TRUE),
('BotsIQ', 'competition', NULL, NULL, ARRAY['botsiq', 'bots iq', 'bots iq competition'], ARRAY['activities_honors', 'education_description'], NULL, 'Educational combat robotics program for high school students.', TRUE, TRUE),
('RoboCup', 'competition', NULL, NULL, ARRAY['robocup', 'robo cup', 'robocup competition'], ARRAY['activities_honors', 'education_description', 'projects'], 'https://www.robocup.org', 'International robotics competition with autonomous robot soccer and rescue divisions.', TRUE, TRUE),
('World Robot Olympiad', 'competition', NULL, NULL, ARRAY['world robot olympiad', 'wro', 'robot olympiad'], ARRAY['activities_honors', 'education_description'], 'https://wro-association.org', 'International robotics competition for students.', TRUE, TRUE),
('DARPA Grand Challenge', 'competition', NULL, NULL, ARRAY['darpa grand challenge', 'darpa challenge', 'darpa autonomous vehicle challenge'], ARRAY['activities_honors', 'experience_description', 'projects'], NULL, 'DARPA''s autonomous vehicle competition — launched the self-driving car industry.', TRUE, TRUE),
('DARPA Subterranean Challenge', 'competition', NULL, NULL, ARRAY['darpa subt', 'darpa subterranean challenge', 'subt challenge'], ARRAY['activities_honors', 'experience_description', 'projects'], NULL, 'DARPA''s challenge for autonomous underground exploration robots.', TRUE, TRUE),
('NASA Lunabotics', 'competition', NULL, NULL, ARRAY['nasa lunabotics', 'lunabotics', 'nasa robotics mining competition', 'lunar regolith excavation'], ARRAY['activities_honors', 'education_description', 'projects'], NULL, 'NASA competition for collegiate teams to design lunar mining robots.', TRUE, TRUE),
('NASA RASC-AL', 'competition', NULL, NULL, ARRAY['nasa rasc-al', 'rasc-al', 'revolutionary aerospace systems concepts'], ARRAY['activities_honors', 'education_description', 'projects'], NULL, 'NASA competition for advanced space architecture and mission concepts.', TRUE, TRUE),
('NASA Human Exploration Rover Challenge', 'competition', NULL, NULL, ARRAY['nasa rover challenge', 'human exploration rover challenge', 'great moonbuggy race'], ARRAY['activities_honors', 'education_description', 'projects'], NULL, 'NASA competition to design and build human-powered rovers.', TRUE, TRUE),
('AUVSI SUAS', 'competition', NULL, NULL, ARRAY['auvsi suas', 'suas competition', 'student unmanned aerial systems'], ARRAY['activities_honors', 'education_description', 'projects'], NULL, 'AUVSI Student Unmanned Aerial Systems competition.', TRUE, TRUE),
('AUVSI RoboBoat', 'competition', NULL, NULL, ARRAY['auvsi roboboat', 'roboboat competition'], ARRAY['activities_honors', 'education_description', 'projects'], NULL, 'AUVSI autonomous surface vehicle competition.', TRUE, TRUE),
('IEEE BEST Robotics', 'competition', NULL, NULL, ARRAY['best robotics', 'ieee best', 'boosting engineering science and technology'], ARRAY['activities_honors', 'education_description'], NULL, 'IEEE-affiliated robotics competition for high school students.', TRUE, TRUE),
('Botball', 'competition', NULL, NULL, ARRAY['botball', 'botball competition', 'botball robotics'], ARRAY['activities_honors', 'education_description'], 'https://www.botball.org', 'Educational robotics competition using KIPR controllers.', TRUE, TRUE),
('FIRA RoboWorld Cup', 'competition', NULL, NULL, ARRAY['fira roboworld cup', 'fira', 'fira robotics', 'roboworld cup'], ARRAY['activities_honors', 'education_description', 'projects'], NULL, 'International robot competition with multiple event categories.', TRUE, TRUE),

-- Speech / Debate (5)
('NSDA National Champion', 'competition', NULL, NULL, ARRAY['nsda national', 'nsda national champion', 'nsda finalist', 'national speech and debate', 'national forensics league', 'nfl nationals'], ARRAY['activities_honors', 'education_description'], 'https://www.speechanddebate.org', 'National Speech and Debate Association national tournament champion or finalist.', TRUE, TRUE),
('National Debate Tournament (NDT)', 'competition', NULL, NULL, ARRAY['ndt', 'national debate tournament', 'ndt champion', 'ndt finalist'], ARRAY['activities_honors', 'education_description'], NULL, 'Premier collegiate policy debate tournament.', TRUE, TRUE),
('Cross Examination Debate Association (CEDA)', 'competition', NULL, NULL, ARRAY['ceda', 'cross examination debate', 'ceda nationals', 'ceda champion'], ARRAY['activities_honors', 'education_description'], NULL, 'Major collegiate policy debate organization and tournament.', TRUE, TRUE),
('Model UN Distinguished Delegate', 'competition', NULL, NULL, ARRAY['model un delegate', 'model united nations award', 'mun best delegate', 'mun outstanding delegate', 'mun distinguished delegate'], ARRAY['activities_honors', 'education_description'], NULL, 'Best/Outstanding/Distinguished Delegate award at a Model UN conference.', TRUE, TRUE),
('National Academic Quiz Tournaments (NAQT)', 'competition', NULL, NULL, ARRAY['naqt', 'academic quiz', 'quizbowl national', 'quiz bowl', 'naqt national', 'hsnct', 'acf nationals'], ARRAY['activities_honors', 'education_description'], 'https://www.naqt.com', 'National quizbowl organization — HSNCT is the premier high school tournament.', TRUE, TRUE),

-- Business / Case (5)
('DECA ICDC', 'competition', NULL, NULL, ARRAY['deca', 'deca icdc', 'deca international', 'deca finalist', 'deca champion'], ARRAY['activities_honors', 'education_description'], 'https://www.deca.org', 'DECA International Career Development Conference — top signal for business students.', TRUE, TRUE),
('FBLA National Champion', 'competition', NULL, NULL, ARRAY['fbla', 'fbla national', 'fbla champion', 'future business leaders of america'], ARRAY['activities_honors', 'education_description'], 'https://www.fbla.org', 'Future Business Leaders of America national competition champion.', TRUE, TRUE),
('Diamond Challenge', 'competition', NULL, NULL, ARRAY['diamond challenge', 'udel diamond challenge', 'horn entrepreneurship diamond challenge'], ARRAY['activities_honors', 'education_description'], 'https://www.diamondchallenge.org', 'University of Delaware''s global entrepreneurship competition for high school students.', TRUE, TRUE),
('Hult Prize', 'competition', NULL, NULL, ARRAY['hult prize', 'hult prize finalist', 'hult prize winner'], ARRAY['activities_honors', 'experience_description'], 'https://www.hultprize.org', 'Global social entrepreneurship competition — $1M prize for social enterprises.', TRUE, TRUE),
('L''Oréal Brandstorm', 'competition', NULL, NULL, ARRAY['loreal brandstorm', 'l''oreal brandstorm', 'brandstorm', 'l''oréal brandstorm'], ARRAY['activities_honors', 'education_description'], NULL, 'L''Oréal''s global innovation competition for university students.', TRUE, TRUE),

-- Catchalls (7)
('Math Olympiad (generic)', 'competition', NULL, NULL, ARRAY['math olympiad', 'olympiad in mathematics', 'mathematics olympiad'], ARRAY['activities_honors', 'education_description'], NULL, 'Generic match for math olympiad participation when specific competition not identified.', TRUE, TRUE),
('Physics Olympiad (generic)', 'competition', NULL, NULL, ARRAY['physics olympiad', 'olympiad in physics'], ARRAY['activities_honors', 'education_description'], NULL, 'Generic match for physics olympiad participation when specific competition not identified.', TRUE, TRUE),
('Chemistry Olympiad (generic)', 'competition', NULL, NULL, ARRAY['chemistry olympiad', 'olympiad in chemistry'], ARRAY['activities_honors', 'education_description'], NULL, 'Generic match for chemistry olympiad participation when specific competition not identified.', TRUE, TRUE),
('Biology Olympiad (generic)', 'competition', NULL, NULL, ARRAY['biology olympiad', 'olympiad in biology'], ARRAY['activities_honors', 'education_description'], NULL, 'Generic match for biology olympiad participation when specific competition not identified.', TRUE, TRUE),
('CTF (generic)', 'competition', NULL, NULL, ARRAY['ctf', 'capture the flag', 'ctf competition'], ARRAY['activities_honors', 'experience_description', 'projects'], NULL, 'Generic match for CTF/capture-the-flag participation when specific event not identified.', TRUE, TRUE),
('Robotics Competition (generic)', 'competition', NULL, NULL, ARRAY['robotics competition', 'robotics contest'], ARRAY['activities_honors', 'education_description', 'projects'], NULL, 'Generic match for robotics competition participation when specific event not identified.', TRUE, TRUE),
('Combat Robotics (generic)', 'competition', NULL, NULL, ARRAY['combat robotics', 'battlebots competitor', 'fighting robot competition'], ARRAY['activities_honors', 'experience_description', 'projects'], NULL, 'Generic match for combat robotics participation.', TRUE, TRUE)

ON CONFLICT (canonical_name, category) DO UPDATE SET
  subcategory = EXCLUDED.subcategory, tier_group = EXCLUDED.tier_group,
  aliases = EXCLUDED.aliases, source_field_hints = EXCLUDED.source_field_hints,
  canonical_url = EXCLUDED.canonical_url, description = EXCLUDED.description,
  is_positive = EXCLUDED.is_positive, is_active = EXCLUDED.is_active, updated_at = NOW();

-- ============================================================
-- MILITARY (35 entries)
-- ============================================================

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES

-- Special Operations (12) — tier_group = 'special_operations'
('US Army Special Forces (Green Berets)', 'military', 'special_operations', 'special_operations', ARRAY['green berets', 'special forces', 'army special forces', 'de oppresso liber', '18x', 'sf tab', 'green beret'], ARRAY['experience_description', 'title'], NULL, 'U.S. Army Special Forces — unconventional warfare specialists.', TRUE, TRUE),
('US Navy SEAL Teams', 'military', 'special_operations', 'special_operations', ARRAY['navy seal', 'seal team', 'navy seals', 'buds graduate', 'seal trident', 'naval special warfare'], ARRAY['experience_description', 'title'], NULL, 'U.S. Navy Sea, Air, and Land Teams — maritime special operations.', TRUE, TRUE),
('US Naval Special Warfare Development Group (DEVGRU)', 'military', 'special_operations', 'special_operations', ARRAY['devgru', 'seal team 6', 'seal team six', 'nswdg', 'naval special warfare development group'], ARRAY['experience_description', 'title'], NULL, 'Tier 1 special operations unit (commonly known as SEAL Team 6).', TRUE, TRUE),
('1st Special Forces Operational Detachment-Delta (Delta Force)', 'military', 'special_operations', 'special_operations', ARRAY['delta force', '1st sfod-d', 'combat applications group', 'cag', 'army compartmented element', 'ace'], ARRAY['experience_description', 'title'], NULL, 'U.S. Army Tier 1 special operations unit.', TRUE, TRUE),
('US Army 75th Ranger Regiment', 'military', 'special_operations', 'special_operations', ARRAY['75th ranger regiment', 'army ranger', 'ranger regiment', 'ranger tab', 'ranger battalion', 'sua sponte'], ARRAY['experience_description', 'title'], NULL, 'U.S. Army''s premier light infantry and direct-action raid force.', TRUE, TRUE),
('US Marine Corps Force Reconnaissance', 'military', 'special_operations', 'special_operations', ARRAY['force recon', 'force reconnaissance', 'marine force recon', 'usmc force recon'], ARRAY['experience_description', 'title'], NULL, 'USMC deep reconnaissance and direct-action unit.', TRUE, TRUE),
('US Marine Corps MARSOC Raiders', 'military', 'special_operations', 'special_operations', ARRAY['marsoc', 'marine raiders', 'marsoc raider', 'marine special operations', 'critical skills operator'], ARRAY['experience_description', 'title'], NULL, 'USMC Special Operations Command — Marine Raiders.', TRUE, TRUE),
('US Air Force Pararescue (PJ)', 'military', 'special_operations', 'special_operations', ARRAY['pararescue', 'pj', 'air force pararescue', 'pararescueman', 'that others may live'], ARRAY['experience_description', 'title'], NULL, 'USAF special operations combat search and rescue specialists.', TRUE, TRUE),
('US Air Force Combat Controllers', 'military', 'special_operations', 'special_operations', ARRAY['combat controller', 'cct', 'air force combat controller', 'combat control team'], ARRAY['experience_description', 'title'], NULL, 'USAF special operations terminal attack controllers and air traffic control.', TRUE, TRUE),
('US Air Force Special Tactics', 'military', 'special_operations', 'special_operations', ARRAY['special tactics', 'afsoc special tactics', 'sto', 'special tactics officer', 'special tactics squadron'], ARRAY['experience_description', 'title'], NULL, 'USAF Special Tactics — umbrella for PJ, CCT, TACP, and SR.', TRUE, TRUE),
('US Navy SWCC', 'military', 'special_operations', 'special_operations', ARRAY['swcc', 'special warfare combatant-craft crewmen', 'special boat team', 'swcc operator'], ARRAY['experience_description', 'title'], NULL, 'U.S. Navy Special Warfare Combatant-craft Crewmen — maritime insertion specialists.', TRUE, TRUE),
('160th Special Operations Aviation Regiment (Night Stalkers)', 'military', 'special_operations', 'special_operations', ARRAY['160th soar', 'night stalkers', '160th special operations aviation', 'night stalkers don''t quit'], ARRAY['experience_description', 'title'], NULL, 'U.S. Army special operations aviation unit — flies for Tier 1 SOF units.', TRUE, TRUE),

-- Commissioned Officer (6)
('Commissioned Officer (Army)', 'military', 'commissioned_officer', NULL, ARRAY['army officer', 'commissioned officer army', 'army commissioned officer', 'us army officer'], ARRAY['experience_description', 'title'], NULL, 'Commissioned officer in the U.S. Army.', TRUE, TRUE),
('Commissioned Officer (Navy)', 'military', 'commissioned_officer', NULL, ARRAY['navy officer', 'commissioned officer navy', 'naval officer', 'us navy officer'], ARRAY['experience_description', 'title'], NULL, 'Commissioned officer in the U.S. Navy.', TRUE, TRUE),
('Commissioned Officer (Air Force)', 'military', 'commissioned_officer', NULL, ARRAY['air force officer', 'commissioned officer air force', 'usaf officer'], ARRAY['experience_description', 'title'], NULL, 'Commissioned officer in the U.S. Air Force.', TRUE, TRUE),
('Commissioned Officer (Marines)', 'military', 'commissioned_officer', NULL, ARRAY['marine officer', 'commissioned officer marines', 'marine corps officer', 'usmc officer'], ARRAY['experience_description', 'title'], NULL, 'Commissioned officer in the U.S. Marine Corps.', TRUE, TRUE),
('Commissioned Officer (Space Force)', 'military', 'commissioned_officer', NULL, ARRAY['space force officer', 'commissioned officer space force', 'ussf officer'], ARRAY['experience_description', 'title'], NULL, 'Commissioned officer in the U.S. Space Force.', TRUE, TRUE),
('Commissioned Officer (Coast Guard)', 'military', 'commissioned_officer', NULL, ARRAY['coast guard officer', 'commissioned officer coast guard', 'uscg officer'], ARRAY['experience_description', 'title'], NULL, 'Commissioned officer in the U.S. Coast Guard.', TRUE, TRUE),

-- Enlisted (6)
('Enlisted (Army)', 'military', 'enlisted', NULL, ARRAY['army enlisted', 'enlisted army', 'us army enlisted', 'army soldier'], ARRAY['experience_description', 'title'], NULL, 'Enlisted service member in the U.S. Army.', TRUE, TRUE),
('Enlisted (Navy)', 'military', 'enlisted', NULL, ARRAY['navy enlisted', 'enlisted navy', 'us navy enlisted', 'navy sailor'], ARRAY['experience_description', 'title'], NULL, 'Enlisted service member in the U.S. Navy.', TRUE, TRUE),
('Enlisted (Air Force)', 'military', 'enlisted', NULL, ARRAY['air force enlisted', 'enlisted air force', 'usaf enlisted', 'airman'], ARRAY['experience_description', 'title'], NULL, 'Enlisted service member in the U.S. Air Force.', TRUE, TRUE),
('Enlisted (Marines)', 'military', 'enlisted', NULL, ARRAY['marine enlisted', 'enlisted marines', 'usmc enlisted', 'enlisted marine'], ARRAY['experience_description', 'title'], NULL, 'Enlisted service member in the U.S. Marine Corps.', TRUE, TRUE),
('Enlisted (Space Force)', 'military', 'enlisted', NULL, ARRAY['space force enlisted', 'enlisted space force', 'ussf enlisted', 'guardian enlisted'], ARRAY['experience_description', 'title'], NULL, 'Enlisted service member in the U.S. Space Force.', TRUE, TRUE),
('Enlisted (Coast Guard)', 'military', 'enlisted', NULL, ARRAY['coast guard enlisted', 'enlisted coast guard', 'uscg enlisted'], ARRAY['experience_description', 'title'], NULL, 'Enlisted service member in the U.S. Coast Guard.', TRUE, TRUE),

-- Reserve / Guard (7)
('Reservist (Army)', 'military', 'reservist', NULL, ARRAY['army reserve', 'army reservist', 'us army reserve', 'usar'], ARRAY['experience_description', 'title'], NULL, 'U.S. Army Reserve service member.', TRUE, TRUE),
('Reservist (Navy)', 'military', 'reservist', NULL, ARRAY['navy reserve', 'navy reservist', 'us navy reserve', 'usnr'], ARRAY['experience_description', 'title'], NULL, 'U.S. Navy Reserve service member.', TRUE, TRUE),
('Reservist (Air Force)', 'military', 'reservist', NULL, ARRAY['air force reserve', 'air force reservist', 'usaf reserve', 'afrc'], ARRAY['experience_description', 'title'], NULL, 'U.S. Air Force Reserve service member.', TRUE, TRUE),
('Reservist (Marines)', 'military', 'reservist', NULL, ARRAY['marine reserve', 'marine reservist', 'usmc reserve', 'marine corps reserve'], ARRAY['experience_description', 'title'], NULL, 'U.S. Marine Corps Reserve service member.', TRUE, TRUE),
('Reservist (Space Force)', 'military', 'reservist', NULL, ARRAY['space force reserve', 'space force reservist', 'ussf reserve'], ARRAY['experience_description', 'title'], NULL, 'U.S. Space Force Reserve component service member.', TRUE, TRUE),
('Reservist (Coast Guard)', 'military', 'reservist', NULL, ARRAY['coast guard reserve', 'coast guard reservist', 'uscg reserve'], ARRAY['experience_description', 'title'], NULL, 'U.S. Coast Guard Reserve service member.', TRUE, TRUE),
('National Guard', 'military', 'reservist', NULL, ARRAY['national guard', 'army national guard', 'air national guard', 'arng', 'ang', 'guardsman'], ARRAY['experience_description', 'title'], NULL, 'Army or Air National Guard service member.', TRUE, TRUE),

-- ROTC (3)
('Army ROTC', 'military', 'rotc', NULL, ARRAY['army rotc', 'rotc army', 'arotc', 'reserve officers training corps army'], ARRAY['education_description', 'activities_honors', 'experience_description'], NULL, 'Army Reserve Officers'' Training Corps — college commissioning program.', TRUE, TRUE),
('Navy ROTC', 'military', 'rotc', NULL, ARRAY['navy rotc', 'nrotc', 'naval rotc', 'reserve officers training corps navy'], ARRAY['education_description', 'activities_honors', 'experience_description'], NULL, 'Navy Reserve Officers'' Training Corps — commissions Navy and Marine Corps officers.', TRUE, TRUE),
('Air Force ROTC', 'military', 'rotc', NULL, ARRAY['air force rotc', 'afrotc', 'af rotc', 'reserve officers training corps air force'], ARRAY['education_description', 'activities_honors', 'experience_description'], NULL, 'Air Force Reserve Officers'' Training Corps — also commissions Space Force officers.', TRUE, TRUE),

-- Catchall
('Veteran (generic)', 'military', NULL, NULL, ARRAY['veteran', 'us military veteran', 'military veteran', 'former military'], ARRAY['experience_description', 'title', 'headline'], NULL, 'Generic catch-all for military service when specific branch/unit not identified. Low confidence.', TRUE, TRUE)

ON CONFLICT (canonical_name, category) DO UPDATE SET
  subcategory = EXCLUDED.subcategory, tier_group = EXCLUDED.tier_group,
  aliases = EXCLUDED.aliases, source_field_hints = EXCLUDED.source_field_hints,
  canonical_url = EXCLUDED.canonical_url, description = EXCLUDED.description,
  is_positive = EXCLUDED.is_positive, is_active = EXCLUDED.is_active, updated_at = NOW();
