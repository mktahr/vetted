-- 044_seed_hackathons_conferences_fellowships.sql
--
-- Seed signal_dictionary with three categories (UPSERT MERGE):
--   - hackathon (24 rows) — TreeHacks, PennApps, HackMIT, ICPC, etc.
--   - publication (49 rows) — top conferences (NeurIPS, ICML, OSDI, ...) + journals (Nature, Science, ...)
--   - fellowship (45 rows) — Hertz, KP Fellows, Thiel, YC, KH Scholars, etc.
--
-- UPSERT MERGE behavior: existing fellowship rows from migration 025
-- (Thiel Fellowship, Y Combinator, Schmidt Futures, Knight-Hennessy Scholars)
-- get their fields OVERWRITTEN by this seed's values per Matt's directive
-- ("Our list is the canonical source going forward").
--
-- ICPC: depending on outcome of migration 042's ACM ICPC DO block, either:
--   (a) New row inserted here (042 deleted the engineering_team duplicate), OR
--   (b) Existing row at 'ICPC' / category='hackathon' merged here (042 reclassified
--       and renamed the duplicate to 'ICPC' to preserve person_signals refs).
-- Either way, this migration's INSERT...ON CONFLICT handles it.
--
-- source_field_hints translation rules (same as migration 043):
--   activities_raw / honors_raw → activities_honors
--   description_raw → education_description + experience_description
--   summary_raw → about

BEGIN;

-- ────────────────────────────────────────────────────────────────────────
-- Hackathons (24 rows, category='hackathon')
-- ────────────────────────────────────────────────────────────────────────

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES
('TreeHacks', 'hackathon', 'student', 'tier_3', ARRAY['treehacks','treehacks stanford'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.treehacks.com', 'Stanford flagship; product + startup bias; very selective', TRUE, TRUE),
('PennApps', 'hackathon', 'student', 'tier_3', ARRAY['pennapps','penn apps'], ARRAY['activities_honors','education_description','experience_description'], 'https://pennapps.com', 'UPenn; oldest college hackathon; prestigious', TRUE, TRUE),
('HackMIT', 'hackathon', 'student', 'tier_3', ARRAY['hackmit','hack mit'], ARRAY['activities_honors','education_description','experience_description'], 'https://hackmit.org', 'MIT; strong engineering rigor', TRUE, TRUE),
('CalHacks', 'hackathon', 'student', 'tier_3', ARRAY['calhacks','cal hacks','berkeley hackathon'], ARRAY['activities_honors','education_description','experience_description'], 'https://calhacks.io', 'UC Berkeley; largest US student hackathon', TRUE, TRUE),
('MHacks', 'hackathon', 'student', 'tier_3', ARRAY['mhacks','michigan hackathon'], ARRAY['activities_honors','education_description','experience_description'], 'https://mhacks.org', 'Michigan; strong systems and ME focus', TRUE, TRUE),
('Hack the North', 'hackathon', 'student', 'tier_3', ARRAY['hackthenorth','hack the north'], ARRAY['activities_honors','education_description','experience_description'], 'https://hackthenorth.com', 'Waterloo (Canada); MIT/Stanford-tier global pull', TRUE, TRUE),
('LA Hacks', 'hackathon', 'student', 'tier_2', ARRAY['lahacks','la hacks','ucla hackathon'], ARRAY['activities_honors','education_description','experience_description'], 'https://lahacks.com', 'UCLA; product + design focus', TRUE, TRUE),
('TartanHacks', 'hackathon', 'student', 'tier_2', ARRAY['tartanhacks','cmu hackathon'], ARRAY['activities_honors','education_description','experience_description'], 'https://tartanhacks.com', 'CMU; robotics + HCI + systems', TRUE, TRUE),
('BigRed Hacks', 'hackathon', 'student', 'tier_2', ARRAY['bigred hacks','bigred//hacks','cornell hackathon'], ARRAY['activities_honors','education_description','experience_description'], 'https://bigredhacks.com', 'Cornell; product + applied engineering', TRUE, TRUE),
('DubHacks', 'hackathon', 'student', 'tier_2', ARRAY['dubhacks','uw hackathon'], ARRAY['activities_honors','education_description','experience_description'], 'https://dubhacks.co', 'University of Washington; PNW flagship', TRUE, TRUE),
('HackHarvard', 'hackathon', 'student', 'tier_2', ARRAY['hackharvard','hack harvard'], ARRAY['activities_honors','education_description','experience_description'], 'https://hackharvard.io', 'Harvard; mid-Atlantic strong', TRUE, TRUE),
('HackPrinceton', 'hackathon', 'student', 'tier_2', ARRAY['hackprinceton','hack princeton'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.hackprinceton.com', 'Princeton hackathon', TRUE, TRUE),
('HackTX', 'hackathon', 'student', 'tier_2', ARRAY['hacktx','hack tx','ut austin hackathon'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.hacktx.com', 'UT Austin hackathon', TRUE, TRUE),
('HackIllinois', 'hackathon', 'student', 'tier_2', ARRAY['hackillinois','hack illinois','uiuc hackathon'], ARRAY['activities_honors','education_description','experience_description'], 'https://hackillinois.org', 'UIUC hackathon', TRUE, TRUE),
('HackGT', 'hackathon', 'student', 'tier_2', ARRAY['hackgt','hack gt','georgia tech hackathon'], ARRAY['activities_honors','education_description','experience_description'], 'https://hack.gt', 'Georgia Tech hackathon', TRUE, TRUE),
('NASA Space Apps Challenge', 'hackathon', 'applied', 'tier_3', ARRAY['nasa space apps','space apps challenge'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.spaceappschallenge.org', 'Largest applied science hackathon; finals-level signal', TRUE, TRUE),
('YC AI Startup Hackathon', 'hackathon', 'industry', 'tier_3', ARRAY['yc ai hackathon','y combinator ai hackathon'], ARRAY['activities_honors','education_description','experience_description'], 'https://www.ycombinator.com', 'Recent YC-sponsored AI hackathons; founder pipeline', TRUE, TRUE),
('AGI House Hackathon', 'hackathon', 'industry', 'tier_2', ARRAY['agi house','agi house hackathon'], ARRAY['activities_honors','education_description','experience_description'], 'https://agihouse.org', 'SF Bay Area AI hackathon hub', TRUE, TRUE),
('Anthropic Builder Hackathons', 'hackathon', 'industry', 'tier_2', ARRAY['anthropic hackathon','anthropic builder'], ARRAY['activities_honors','education_description','experience_description'], 'https://anthropic.com', 'Anthropic-sponsored builder events', TRUE, TRUE),
('OpenAI Hackathon', 'hackathon', 'industry', 'tier_2', ARRAY['openai hackathon'], ARRAY['activities_honors','education_description','experience_description'], 'https://openai.com', 'OpenAI-sponsored events', TRUE, TRUE),
('Kaggle Competition Winner', 'hackathon', 'ml', 'tier_3', ARRAY['kaggle','kaggle competition','kaggle grandmaster','kaggle master'], ARRAY['activities_honors','education_description','experience_description','about'], 'https://www.kaggle.com', 'Kaggle competition top placements; Grandmaster/Master are elite signals', TRUE, TRUE),
('Topcoder', 'hackathon', 'competitive_programming', 'tier_2', ARRAY['topcoder','topcoder srm'], ARRAY['activities_honors','education_description','experience_description','about'], 'https://www.topcoder.com', 'Algorithmic competitive programming; SRM ratings', TRUE, TRUE),
('Codeforces', 'hackathon', 'competitive_programming', 'tier_2', ARRAY['codeforces','codeforces grandmaster','codeforces red'], ARRAY['activities_honors','education_description','experience_description','about'], 'https://codeforces.com', 'Competitive programming; ratings color-coded; red/legendary = elite', TRUE, TRUE),
('ICPC', 'hackathon', 'competitive_programming', 'tier_3', ARRAY['icpc','international collegiate programming contest','acm icpc'], ARRAY['activities_honors','education_description','experience_description'], 'https://icpc.global', 'Premier college programming competition; World Finals = elite', TRUE, TRUE)
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
-- Conferences + Journals (49 rows, category='publication')
-- ────────────────────────────────────────────────────────────────────────

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES
('NeurIPS', 'publication', 'ai_ml', 'tier_3', ARRAY['neurips','nips','neural information processing systems'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://neurips.cc', 'Top global ML conference', TRUE, TRUE),
('ICML', 'publication', 'ai_ml', 'tier_3', ARRAY['icml','international conference on machine learning'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://icml.cc', 'Top ML theory + applied conference', TRUE, TRUE),
('ICLR', 'publication', 'ai_ml', 'tier_3', ARRAY['iclr','international conference on learning representations'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://iclr.cc', 'Top deep learning conference', TRUE, TRUE),
('AAAI', 'publication', 'ai_ml', 'tier_2', ARRAY['aaai','association for the advancement of artificial intelligence'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://aaai.org', 'Broad AI conference', TRUE, TRUE),
('IJCAI', 'publication', 'ai_ml', 'tier_2', ARRAY['ijcai','international joint conference on artificial intelligence'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.ijcai.org', 'International AI conference', TRUE, TRUE),
('MLSys', 'publication', 'ai_ml', 'tier_3', ARRAY['mlsys','mlsys conference','machine learning systems'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://mlsys.org', 'ML systems venue; fast-rising; production ML signal', TRUE, TRUE),
('OSDI', 'publication', 'systems', 'tier_3', ARRAY['osdi','operating systems design and implementation'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.usenix.org/conferences/osdi', 'Top OS systems conference', TRUE, TRUE),
('SOSP', 'publication', 'systems', 'tier_3', ARRAY['sosp','symposium on operating systems principles'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://sosp.org', 'Top OS conference', TRUE, TRUE),
('NSDI', 'publication', 'systems', 'tier_3', ARRAY['nsdi','networked systems design and implementation'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.usenix.org/conferences/nsdi', 'Top distributed systems conference', TRUE, TRUE),
('SIGCOMM', 'publication', 'systems', 'tier_3', ARRAY['sigcomm'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.sigcomm.org', 'Top networking conference', TRUE, TRUE),
('ASPLOS', 'publication', 'systems', 'tier_3', ARRAY['asplos','architectural support for programming languages'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.asplos-conference.org', 'Architecture + systems crossover', TRUE, TRUE),
('MICRO', 'publication', 'architecture', 'tier_3', ARRAY['micro','international symposium on microarchitecture'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.microarch.org', 'Top computer architecture conference', TRUE, TRUE),
('ISCA', 'publication', 'architecture', 'tier_3', ARRAY['isca','international symposium on computer architecture'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://iscaconf.org', 'Top computer architecture conference', TRUE, TRUE),
('HPCA', 'publication', 'architecture', 'tier_3', ARRAY['hpca','high performance computer architecture'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://hpca-conf.org', 'Top high-perf architecture conference', TRUE, TRUE),
('IEEE S&P', 'publication', 'security', 'tier_3', ARRAY['ieee s&p','oakland','ieee security and privacy'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.ieee-security.org/TC/SP', 'Top security conference (aka Oakland)', TRUE, TRUE),
('USENIX Security', 'publication', 'security', 'tier_3', ARRAY['usenix security','usenix security symposium'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.usenix.org/conferences', 'Top applied security conference', TRUE, TRUE),
('CCS', 'publication', 'security', 'tier_3', ARRAY['ccs','acm ccs','computer and communications security'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.sigsac.org/ccs', 'Top security conference', TRUE, TRUE),
('NDSS', 'publication', 'security', 'tier_2', ARRAY['ndss','network and distributed system security'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.ndss-symposium.org', 'Network security conference', TRUE, TRUE),
('CRYPTO', 'publication', 'security', 'tier_3', ARRAY['crypto','international cryptology conference'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.iacr.org/conferences/crypto', 'Top cryptography conference', TRUE, TRUE),
('SIGMOD', 'publication', 'databases', 'tier_3', ARRAY['sigmod','acm sigmod'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://sigmod.org', 'Top database conference', TRUE, TRUE),
('VLDB', 'publication', 'databases', 'tier_3', ARRAY['vldb','very large data bases'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://vldb.org', 'Top database conference', TRUE, TRUE),
('KDD', 'publication', 'databases', 'tier_2', ARRAY['kdd','acm sigkdd'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.kdd.org', 'Data mining + industry crossover', TRUE, TRUE),
('ICDE', 'publication', 'databases', 'tier_2', ARRAY['icde','international conference on data engineering'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://icde2024.github.io', 'Data engineering conference', TRUE, TRUE),
('CVPR', 'publication', 'vision', 'tier_3', ARRAY['cvpr','computer vision and pattern recognition'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://cvpr.thecvf.com', 'Top computer vision conference', TRUE, TRUE),
('ICCV', 'publication', 'vision', 'tier_3', ARRAY['iccv','international conference on computer vision'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://iccv.thecvf.com', 'Top computer vision conference', TRUE, TRUE),
('ECCV', 'publication', 'vision', 'tier_3', ARRAY['eccv','european conference on computer vision'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://eccv2024.ecva.net', 'Top European vision venue', TRUE, TRUE),
('ACL', 'publication', 'nlp', 'tier_3', ARRAY['acl','association for computational linguistics'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.aclweb.org', 'Top NLP conference', TRUE, TRUE),
('EMNLP', 'publication', 'nlp', 'tier_3', ARRAY['emnlp','empirical methods in natural language processing'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://2024.emnlp.org', 'Top applied NLP conference', TRUE, TRUE),
('NAACL', 'publication', 'nlp', 'tier_2', ARRAY['naacl','north american chapter of the acl'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://naacl.org', 'Strong regional NLP conference', TRUE, TRUE),
('RSS', 'publication', 'robotics', 'tier_3', ARRAY['rss','robotics science and systems'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://roboticsconference.org', 'Very selective robotics conference', TRUE, TRUE),
('ICRA', 'publication', 'robotics', 'tier_3', ARRAY['icra','international conference on robotics and automation'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.icra2024.org', 'Largest broad robotics conference', TRUE, TRUE),
('IROS', 'publication', 'robotics', 'tier_3', ARRAY['iros','intelligent robots and systems'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://iros2024-abudhabi.org', 'Industry-heavy robotics conference', TRUE, TRUE),
('CoRL', 'publication', 'robotics', 'tier_3', ARRAY['corl','conference on robot learning'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://corl.org', 'Robotics + ML; fast-rising', TRUE, TRUE),
('CHI', 'publication', 'hci', 'tier_3', ARRAY['chi','sigchi','conference on human factors'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://chi.acm.org', 'Top HCI conference', TRUE, TRUE),
('UIST', 'publication', 'hci', 'tier_3', ARRAY['uist','user interface software and technology'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://uist.acm.org', 'Elite interface research conference', TRUE, TRUE),
('ISMB', 'publication', 'bio', 'tier_3', ARRAY['ismb','intelligent systems for molecular biology'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.iscb.org', 'Top computational biology venue', TRUE, TRUE),
('RECOMB', 'publication', 'bio', 'tier_3', ARRAY['recomb','research in computational molecular biology'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.recomb.org', 'Computational biology theory', TRUE, TRUE),
('Nature', 'publication', 'journal', 'tier_3', ARRAY['nature','nature journal'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.nature.com', 'Top general science journal', TRUE, TRUE),
('Science', 'publication', 'journal', 'tier_3', ARRAY['science','science journal','science magazine'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.science.org', 'Top general science journal', TRUE, TRUE),
('Cell', 'publication', 'journal', 'tier_3', ARRAY['cell','cell journal'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.cell.com', 'Top life sciences journal', TRUE, TRUE),
('PNAS', 'publication', 'journal', 'tier_3', ARRAY['pnas','proceedings of the national academy of sciences'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.pnas.org', 'Broad elite research journal', TRUE, TRUE),
('Nature Biotechnology', 'publication', 'journal', 'tier_3', ARRAY['nature biotechnology','nature biotech'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.nature.com/nbt', 'Industry-impact biotech journal', TRUE, TRUE),
('JMLR', 'publication', 'journal', 'tier_3', ARRAY['jmlr','journal of machine learning research'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://jmlr.org', 'ML journal gold standard', TRUE, TRUE),
('Communications of the ACM', 'publication', 'journal', 'tier_2', ARRAY['cacm','communications of the acm'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://cacm.acm.org', 'CS recognition', TRUE, TRUE),
('ISSCC', 'publication', 'hardware', 'tier_3', ARRAY['isscc','international solid state circuits'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.isscc.org', 'Top circuits conference (Chip Olympics)', TRUE, TRUE),
('DAC', 'publication', 'hardware', 'tier_3', ARRAY['dac','design automation conference'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.dac.com', 'Top design automation conference', TRUE, TRUE),
('Hot Chips', 'publication', 'hardware', 'tier_3', ARRAY['hot chips','hotchips'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://hotchips.org', 'Industry + academia hardware showcase', TRUE, TRUE),
('VLSI Symposium', 'publication', 'hardware', 'tier_3', ARRAY['vlsi symposium','symposium on vlsi'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.vlsisymposium.org', 'Elite semiconductor conference', TRUE, TRUE),
('CICC', 'publication', 'hardware', 'tier_3', ARRAY['cicc','custom integrated circuits conference'], ARRAY['education_description','experience_description','about','activities_honors'], 'https://www.cicc.ieee.org', 'Top custom IC design conference', TRUE, TRUE)
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
-- Fellowships (45 rows, category='fellowship') — UPSERT MERGE
-- Existing seeded rows (Thiel, YC, Schmidt Futures, Knight-Hennessy from
-- migration 025) get OVERWRITTEN by these values per Matt's directive.
-- ────────────────────────────────────────────────────────────────────────

INSERT INTO signal_dictionary (canonical_name, category, subcategory, tier_group, aliases, source_field_hints, canonical_url, description, is_positive, is_active) VALUES
('Hertz Fellowship', 'fellowship', 'research_phd', 'tier_3', ARRAY['hertz','hertz fellow','fannie and john hertz','hertz foundation'], ARRAY['activities_honors','experience_description','education_description'], 'https://hertzfoundation.org', 'Top deep-tech PhD fellowship in applied physical sciences; ~15 awarded annually', TRUE, TRUE),
('Kleiner Perkins Fellows', 'fellowship', 'operator_track', 'tier_3', ARRAY['kp fellows','kpf','kleiner perkins fellow','kleiner perkins fellowship','kp fellow'], ARRAY['activities_honors','experience_description','education_description'], 'https://fellows.kleinerperkins.com', 'KP-sponsored summer engineering/design/PM fellowship at portfolio companies', TRUE, TRUE),
('OpenAI Residency', 'fellowship', 'ai_residency', 'tier_3', ARRAY['openai resident','openai research residency','openai residency program'], ARRAY['activities_honors','experience_description','education_description'], 'https://openai.com/residency', 'OpenAI''s research residency program; selective AI research path', TRUE, TRUE),
('DeepMind Scholars', 'fellowship', 'ai_residency', 'tier_3', ARRAY['deepmind scholar','deepmind scholarship','deepmind research scholar'], ARRAY['activities_honors','experience_description','education_description'], 'https://deepmind.google', 'DeepMind''s PhD scholarship program for AI research', TRUE, TRUE),
('Anthropic Fellows', 'fellowship', 'ai_residency', 'tier_3', ARRAY['anthropic fellow','anthropic fellowship','anthropic ai safety fellow'], ARRAY['activities_honors','experience_description','education_description'], 'https://anthropic.com', 'Anthropic''s research fellowship program focused on AI safety', TRUE, TRUE),
('HHMI', 'fellowship', 'research_phd', 'tier_3', ARRAY['hhmi','hhmi investigator','howard hughes medical institute','hhmi fellow'], ARRAY['activities_honors','experience_description','education_description'], 'https://hhmi.org', 'Howard Hughes Medical Institute investigator/fellow program; elite biomedical research', TRUE, TRUE),
('Bell Labs Fellow', 'fellowship', 'research_phd', 'tier_3', ARRAY['bell labs fellow','bell labs fellowship','nokia bell labs fellow'], ARRAY['activities_honors','experience_description','education_description'], 'https://bell-labs.com', 'Bell Labs research fellowship; legendary industrial research lab', TRUE, TRUE),
('Thiel Fellowship', 'fellowship', 'founder_track', 'tier_3', ARRAY['thiel fellowship','thiel fellow','20 under 20 thiel','20 under 20','thiel foundation fellowship'], ARRAY['activities_honors','experience_description','education_description'], 'https://thielfellowship.org', 'Peter Thiel''s $100K fellowship for young entrepreneurs who skip or leave college to build', TRUE, TRUE),
('Neo Scholars', 'fellowship', 'founder_track', 'tier_3', ARRAY['neo scholar','neo scholars','neo fellowship','neo accelerator'], ARRAY['activities_honors','experience_description','education_description'], 'https://neo.com', 'Ali Partovi''s program for elite undergraduate engineers; founder + engineer track', TRUE, TRUE),
('Entrepreneur First', 'fellowship', 'founder_track', 'tier_3', ARRAY['ef','entrepreneur first','ef fellowship','ef cohort'], ARRAY['activities_honors','experience_description','education_description'], 'https://joinef.com', 'Pre-team founder fellowship; matches technical co-founders globally', TRUE, TRUE),
('Y Combinator', 'fellowship', 'founder_track', 'tier_3', ARRAY['yc','y combinator','ycombinator','y-combinator','yc batch','yc startup school'], ARRAY['activities_honors','experience_description','education_description'], 'https://ycombinator.com', 'Premier startup accelerator; W/S batch alumni signal', TRUE, TRUE),
('Greylock Edge', 'fellowship', 'founder_track', 'tier_3', ARRAY['greylock edge','greylock fellows','greylock fellowship'], ARRAY['activities_honors','experience_description','education_description'], 'https://greylock.com', 'Greylock''s emerging founder/operator program', TRUE, TRUE),
('Knight-Hennessy Scholars', 'fellowship', 'academic_scholar', 'tier_3', ARRAY['knight-hennessy','knight hennessy','kh scholar','knight hennessy scholars'], ARRAY['activities_honors','experience_description','education_description'], 'https://knight-hennessy.stanford.edu', 'Stanford full-funding graduate scholarship; ~100 scholars per cohort', TRUE, TRUE),
('NDSEG Fellowship', 'fellowship', 'research_phd', 'tier_3', ARRAY['ndseg','national defense science and engineering graduate','ndseg fellow'], ARRAY['activities_honors','experience_description','education_description'], 'https://ndseg.org', 'DoD STEM PhD fellowship; defense-relevant research', TRUE, TRUE),
('Nvidia Graduate Fellowship', 'fellowship', 'research_phd', 'tier_2', ARRAY['nvidia graduate fellowship','nvidia grad fellow','nvidia phd fellowship'], ARRAY['activities_honors','experience_description','education_description'], 'https://nvidia.com/research/graduate-fellowship', 'Small elite ML/systems PhD fellowship sponsored by Nvidia', TRUE, TRUE),
('Apple Scholars in AI/ML', 'fellowship', 'research_phd', 'tier_2', ARRAY['apple scholar','apple scholars','apple ai ml scholar','apple ml scholar'], ARRAY['activities_honors','experience_description','education_description'], 'https://machinelearning.apple.com', 'Apple''s selective AI/ML PhD fellowship program', TRUE, TRUE),
('Google AI Residency', 'fellowship', 'ai_residency', 'tier_2', ARRAY['google ai residency','google brain residency','google research residency'], ARRAY['activities_honors','experience_description','education_description'], 'https://research.google/careers/ai-residency', 'Google''s AI research residency program (one-year)', TRUE, TRUE),
('Meta FAIR Residency', 'fellowship', 'ai_residency', 'tier_2', ARRAY['meta fair residency','fair residency','meta ai residency','facebook ai residency'], ARRAY['activities_honors','experience_description','education_description'], 'https://ai.meta.com', 'Meta FAIR''s AI research residency program', TRUE, TRUE),
('Microsoft AI Residency', 'fellowship', 'ai_residency', 'tier_2', ARRAY['microsoft ai residency','microsoft research ai resident'], ARRAY['activities_honors','experience_description','education_description'], 'https://microsoft.com/research/academic-program/ai-residency-program', 'Microsoft Research AI residency program', TRUE, TRUE),
('Cohere Labs', 'fellowship', 'ai_residency', 'tier_2', ARRAY['cohere labs','cohere for ai','cohere c4ai','cohere labs scholar'], ARRAY['activities_honors','experience_description','education_description'], 'https://cohere.com/research', 'Cohere''s research community fellowship (formerly Cohere For AI)', TRUE, TRUE),
('Allen Institute', 'fellowship', 'research_phd', 'tier_2', ARRAY['allen institute','allen institute fellow','ai2 fellow','allen institute for ai'], ARRAY['activities_honors','experience_description','education_description'], 'https://allenai.org', 'Allen Institute for AI research fellowship', TRUE, TRUE),
('Flatiron Institute', 'fellowship', 'research_phd', 'tier_2', ARRAY['flatiron institute','flatiron fellow','simons foundation flatiron'], ARRAY['activities_honors','experience_description','education_description'], 'https://simonsfoundation.org/flatiron', 'Simons Foundation''s computational science research fellowship', TRUE, TRUE),
('X (Alphabet)', 'fellowship', 'research_phd', 'tier_2', ARRAY['x company','x alphabet','x moonshot','google x','alphabet x'], ARRAY['activities_honors','experience_description','education_description'], 'https://x.company', 'Alphabet''s moonshot factory; high-signal R&D program', TRUE, TRUE),
('IDEO', 'fellowship', 'design', 'tier_2', ARRAY['ideo','ideo fellow','ideo fellowship','ideo design fellow'], ARRAY['activities_honors','experience_description','education_description'], 'https://ideo.com', 'IDEO design fellowship; elite product/industrial design pipeline', TRUE, TRUE),
('Apple Industrial Design', 'fellowship', 'design', 'tier_2', ARRAY['apple design fellow','apple industrial design fellow','apple design program'], ARRAY['activities_honors','experience_description','education_description'], 'https://apple.com', 'Apple industrial design fellowship/program', TRUE, TRUE),
('CZI Fellowship', 'fellowship', 'research_phd', 'tier_2', ARRAY['czi','chan zuckerberg initiative','czi fellow','czi fellowship'], ARRAY['activities_honors','experience_description','education_description'], 'https://chanzuckerberg.com', 'Chan Zuckerberg Initiative fellowship across science and education', TRUE, TRUE),
('CDL', 'fellowship', 'operator_track', 'tier_2', ARRAY['cdl','creative destruction lab','cdl fellow','cdl associate'], ARRAY['activities_honors','experience_description','education_description'], 'https://creativedestructionlab.com', 'Creative Destruction Lab; deep tech accelerator with fellowship roles', TRUE, TRUE),
('South Park Commons', 'fellowship', 'founder_track', 'tier_2', ARRAY['spc','south park commons','spc fellow','spc founder fellowship'], ARRAY['activities_honors','experience_description','education_description'], 'https://southparkcommons.com', 'SPC''s founder fellowship; pre-idea founder community', TRUE, TRUE),
('Pioneer', 'fellowship', 'founder_track', 'tier_2', ARRAY['pioneer','pioneer fellowship','daniel gross pioneer','pioneer.app'], ARRAY['activities_honors','experience_description','education_description'], 'https://pioneer.app', 'Daniel Gross''s remote founder fellowship', TRUE, TRUE),
('Interact Fellowship', 'fellowship', 'founder_track', 'tier_2', ARRAY['interact','interact fellow','interact fellowship','interact tech'], ARRAY['activities_honors','experience_description','education_description'], 'https://joininteract.com', 'Selective community of mission-driven young tech leaders', TRUE, TRUE),
('Emergent Ventures', 'fellowship', 'founder_track', 'tier_2', ARRAY['emergent ventures','ev fellow','tyler cowen emergent ventures','mercatus emergent ventures'], ARRAY['activities_honors','experience_description','education_description'], 'https://mercatus.org/emergent-ventures', 'Tyler Cowen''s grant program for ambitious early-career projects', TRUE, TRUE),
('Schmidt Futures', 'fellowship', 'research_phd', 'tier_2', ARRAY['schmidt futures','schmidt science fellows','schmidt futures fellow'], ARRAY['activities_honors','experience_description','education_description'], 'https://schmidtfutures.com', 'Eric Schmidt''s research and talent program', TRUE, TRUE),
('Rhodes Scholarship', 'fellowship', 'academic_scholar', 'tier_2', ARRAY['rhodes scholar','rhodes scholarship','rhodes fellow'], ARRAY['activities_honors','experience_description','education_description'], 'https://rhodesscholar.org', 'Oxford graduate scholarship; oldest international fellowship', TRUE, TRUE),
('Marshall Scholarship', 'fellowship', 'academic_scholar', 'tier_2', ARRAY['marshall scholar','marshall scholarship','marshall fellow'], ARRAY['activities_honors','experience_description','education_description'], 'https://marshallscholarship.org', 'UK graduate scholarship for American students', TRUE, TRUE),
('Gates Cambridge', 'fellowship', 'academic_scholar', 'tier_2', ARRAY['gates cambridge','gates scholar','gates cambridge scholar'], ARRAY['activities_honors','experience_description','education_description'], 'https://gatescambridge.org', 'Cambridge graduate scholarship funded by Gates Foundation', TRUE, TRUE),
('Churchill Scholarship', 'fellowship', 'academic_scholar', 'tier_2', ARRAY['churchill scholar','churchill scholarship','winston churchill foundation'], ARRAY['activities_honors','experience_description','education_description'], 'https://churchillscholarship.org', 'Cambridge STEM-focused graduate scholarship for Americans', TRUE, TRUE),
('Soros Fellowship', 'fellowship', 'academic_scholar', 'tier_2', ARRAY['soros fellowship','paul and daisy soros','new americans fellowship','pd soros'], ARRAY['activities_honors','experience_description','education_description'], 'https://pdsoros.org', 'Paul & Daisy Soros Fellowship for New Americans (graduate)', TRUE, TRUE),
('On Deck', 'fellowship', 'founder_track', 'tier_1', ARRAY['on deck','on deck fellow','on deck fellowship','odf'], ARRAY['activities_honors','experience_description','education_description'], 'https://beondeck.com', 'On Deck founder/operator community fellowships', TRUE, TRUE),
('Z Fellows', 'fellowship', 'founder_track', 'tier_1', ARRAY['z fellows','z fellowship','cory levy z fellows'], ARRAY['activities_honors','experience_description','education_description'], 'https://zfellows.com', 'Cory Levy''s $10K weekend fellowship for young founders', TRUE, TRUE),
('Antler', 'fellowship', 'founder_track', 'tier_1', ARRAY['antler','antler fellow','antler residency','antler program'], ARRAY['activities_honors','experience_description','education_description'], 'https://antler.co', 'Antler''s pre-team founder residency program (top hubs only)', TRUE, TRUE),
('NSF GRFP', 'fellowship', 'research_phd', 'tier_1', ARRAY['nsf grfp','nsf graduate research fellowship','nsf fellow'], ARRAY['activities_honors','experience_description','education_description'], 'https://nsfgrfp.org', 'NSF''s graduate research fellowship; broad STEM PhD funding', TRUE, TRUE),
('DOE CSGF', 'fellowship', 'research_phd', 'tier_1', ARRAY['doe csgf','computational science graduate fellowship','doe fellow'], ARRAY['activities_honors','experience_description','education_description'], 'https://krellinst.org/csgf', 'DOE Computational Science Graduate Fellowship', TRUE, TRUE),
('Fulbright STEM', 'fellowship', 'academic_scholar', 'tier_1', ARRAY['fulbright','fulbright stem','fulbright fellow','fulbright scholar'], ARRAY['activities_honors','experience_description','education_description'], 'https://fulbrightprogram.org', 'US State Department international exchange program (STEM track)', TRUE, TRUE),
('Sigma Squared', 'fellowship', 'founder_track', 'tier_1', ARRAY['sigma squared','sigma squared society','s2','s squared'], ARRAY['activities_honors','experience_description','education_description'], 'https://sigmasquared.org', 'Young entrepreneur society fellowship', TRUE, TRUE),
('Goldwater Scholarship', 'fellowship', 'academic_scholar', 'tier_2', ARRAY['goldwater','goldwater scholar','barry goldwater scholarship'], ARRAY['activities_honors','experience_description','education_description'], 'https://goldwater.scholarsapply.org', 'Undergraduate STEM research scholarship', TRUE, TRUE)
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
