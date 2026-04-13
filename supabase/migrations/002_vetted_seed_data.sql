-- ============================================================
-- Vetted — Phase 1 Seed Data
-- Core dictionary entries to bootstrap normalization
-- ============================================================

-- ============================================================
-- FUNCTIONS
-- ============================================================

INSERT INTO function_dictionary (function_normalized, description) VALUES
  ('engineering',         'Software engineering, infrastructure, data engineering'),
  ('product',             'Product management and strategy'),
  ('design',              'Product design, UX, visual design'),
  ('data_science',        'Data science, ML, AI research'),
  ('sales',               'Sales, account executive, business development'),
  ('marketing',           'Marketing, growth, brand, content'),
  ('operations',          'Operations, strategy, bizops, chief of staff'),
  ('finance',             'Finance, accounting, FP&A, accounting'),
  ('legal',               'Legal, compliance, counsel'),
  ('recruiting',          'Talent acquisition, recruiting, people ops'),
  ('people_hr',           'HR, people operations, culture'),
  ('customer_success',    'Customer success, account management, support'),
  ('research',            'Research (non-ML) — policy, market, academic'),
  ('communications',      'PR, communications, press'),
  ('founder',             'Founding role — may span multiple functions'),
  ('investing',           'VC, PE, angel investing'),
  ('consulting',          'Strategy consulting, advisory'),
  ('unknown',             'Could not determine function from available data');

-- ============================================================
-- SPECIALTIES (sample starter set — expand over time)
-- ============================================================

INSERT INTO specialty_dictionary (specialty_normalized, parent_function, description) VALUES
  -- Engineering
  ('backend',           'engineering', 'Backend / server-side engineering'),
  ('frontend',          'engineering', 'Frontend / client-side engineering'),
  ('fullstack',         'engineering', 'Full-stack engineering'),
  ('mobile_ios',        'engineering', 'iOS mobile development'),
  ('mobile_android',    'engineering', 'Android mobile development'),
  ('infrastructure',    'engineering', 'DevOps, SRE, platform, cloud infra'),
  ('ml_engineering',    'engineering', 'ML infrastructure, MLOps, model deployment'),
  ('data_engineering',  'engineering', 'Data pipelines, ETL, data platform'),
  ('security',          'engineering', 'Security engineering, appsec, infosec'),
  ('embedded',          'engineering', 'Embedded systems, firmware, hardware'),
  ('ai_research',       'data_science', 'AI / ML research, model development'),
  ('analytics',         'data_science', 'Data analytics, BI, insights'),
  -- Product
  ('product_b2b',       'product', 'B2B product management'),
  ('product_consumer',  'product', 'Consumer / B2C product management'),
  ('product_platform',  'product', 'Platform product management'),
  ('product_growth',    'product', 'Growth product management'),
  -- Design
  ('ux_design',         'design', 'User experience design'),
  ('product_design',    'design', 'Product design (UX + visual)'),
  ('brand_design',      'design', 'Brand and visual design'),
  -- Sales
  ('enterprise_sales',  'sales', 'Enterprise/large account sales'),
  ('smb_sales',         'sales', 'SMB / mid-market sales'),
  ('sales_engineering', 'sales', 'Sales engineering, solutions engineering'),
  ('partnerships',      'sales', 'Partnerships and business development'),
  -- Marketing
  ('growth_marketing',  'marketing', 'Growth, performance, paid marketing'),
  ('content_marketing', 'marketing', 'Content, editorial, SEO'),
  ('brand_marketing',   'marketing', 'Brand, campaigns, awareness');

-- ============================================================
-- TITLE DICTIONARY (starter set — most common patterns)
-- ============================================================

INSERT INTO title_dictionary (title_pattern, title_normalized, function_normalized, specialty_normalized, seniority_normalized, confidence) VALUES
  -- Engineering - IC
  ('software engineer',             'Software Engineer',            'engineering', 'backend',       'individual_contributor', 0.85),
  ('software developer',            'Software Engineer',            'engineering', 'backend',       'individual_contributor', 0.85),
  ('swe',                           'Software Engineer',            'engineering', NULL,            'individual_contributor', 0.90),
  ('frontend engineer',             'Frontend Engineer',            'engineering', 'frontend',      'individual_contributor', 0.95),
  ('frontend developer',            'Frontend Engineer',            'engineering', 'frontend',      'individual_contributor', 0.95),
  ('backend engineer',              'Backend Engineer',             'engineering', 'backend',       'individual_contributor', 0.95),
  ('backend developer',             'Backend Engineer',             'engineering', 'backend',       'individual_contributor', 0.95),
  ('full stack engineer',           'Full Stack Engineer',          'engineering', 'fullstack',     'individual_contributor', 0.95),
  ('full-stack engineer',           'Full Stack Engineer',          'engineering', 'fullstack',     'individual_contributor', 0.95),
  ('fullstack engineer',            'Full Stack Engineer',          'engineering', 'fullstack',     'individual_contributor', 0.95),
  ('ios engineer',                  'iOS Engineer',                 'engineering', 'mobile_ios',    'individual_contributor', 0.97),
  ('ios developer',                 'iOS Engineer',                 'engineering', 'mobile_ios',    'individual_contributor', 0.97),
  ('android engineer',              'Android Engineer',             'engineering', 'mobile_android','individual_contributor', 0.97),
  ('mobile engineer',               'Mobile Engineer',              'engineering', NULL,            'individual_contributor', 0.90),
  ('ml engineer',                   'ML Engineer',                  'engineering', 'ml_engineering','individual_contributor', 0.95),
  ('machine learning engineer',     'ML Engineer',                  'engineering', 'ml_engineering','individual_contributor', 0.97),
  ('data engineer',                 'Data Engineer',                'engineering', 'data_engineering','individual_contributor', 0.95),
  ('infrastructure engineer',       'Infrastructure Engineer',      'engineering', 'infrastructure','individual_contributor', 0.95),
  ('devops engineer',               'DevOps Engineer',              'engineering', 'infrastructure','individual_contributor', 0.95),
  ('platform engineer',             'Platform Engineer',            'engineering', 'infrastructure','individual_contributor', 0.95),
  ('site reliability engineer',     'Site Reliability Engineer',    'engineering', 'infrastructure','individual_contributor', 0.97),
  ('sre',                           'Site Reliability Engineer',    'engineering', 'infrastructure','individual_contributor', 0.92),
  ('security engineer',             'Security Engineer',            'engineering', 'security',      'individual_contributor', 0.97),
  -- Engineering - Senior IC
  ('senior software engineer',      'Senior Software Engineer',     'engineering', NULL,            'senior_ic', 0.92),
  ('senior engineer',               'Senior Engineer',              'engineering', NULL,            'senior_ic', 0.88),
  ('staff engineer',                'Staff Engineer',               'engineering', NULL,            'lead',      0.95),
  ('staff software engineer',       'Staff Software Engineer',      'engineering', NULL,            'lead',      0.95),
  ('principal engineer',            'Principal Engineer',           'engineering', NULL,            'senior_ic', 0.95),
  ('principal software engineer',   'Principal Software Engineer',  'engineering', NULL,            'senior_ic', 0.95),
  -- Engineering - Management
  ('engineering manager',           'Engineering Manager',          'engineering', NULL,            'manager',   0.97),
  ('em',                            'Engineering Manager',          'engineering', NULL,            'manager',   0.80),
  ('director of engineering',       'Director of Engineering',      'engineering', NULL,            'director',  0.97),
  ('vp of engineering',             'VP of Engineering',            'engineering', NULL,            'vp',        0.97),
  ('vp engineering',                'VP of Engineering',            'engineering', NULL,            'vp',        0.97),
  ('cto',                           'CTO',                          'engineering', NULL,            'c_suite',   0.95),
  ('chief technology officer',      'CTO',                          'engineering', NULL,            'c_suite',   0.97),
  -- Product
  ('product manager',               'Product Manager',              'product', NULL,                'individual_contributor', 0.95),
  ('pm',                            'Product Manager',              'product', NULL,                'individual_contributor', 0.85),
  ('senior product manager',        'Senior Product Manager',       'product', NULL,                'senior_ic', 0.95),
  ('senior pm',                     'Senior Product Manager',       'product', NULL,                'senior_ic', 0.90),
  ('principal product manager',     'Principal Product Manager',    'product', NULL,                'senior_ic', 0.95),
  ('director of product',           'Director of Product',          'product', NULL,                'director',  0.95),
  ('director of product management','Director of Product',          'product', NULL,                'director',  0.97),
  ('vp of product',                 'VP of Product',                'product', NULL,                'vp',        0.97),
  ('vp product',                    'VP of Product',                'product', NULL,                'vp',        0.95),
  ('chief product officer',         'CPO',                          'product', NULL,                'c_suite',   0.97),
  ('cpo',                           'CPO',                          'product', NULL,                'c_suite',   0.90),
  ('head of product',               'Head of Product',              'product', NULL,                'director',  0.88),
  -- Design
  ('product designer',              'Product Designer',             'design', 'product_design',    'individual_contributor', 0.97),
  ('ux designer',                   'UX Designer',                  'design', 'ux_design',         'individual_contributor', 0.97),
  ('ui designer',                   'UI Designer',                  'design', 'product_design',    'individual_contributor', 0.90),
  ('ui/ux designer',                'UI/UX Designer',               'design', 'ux_design',         'individual_contributor', 0.95),
  ('senior product designer',       'Senior Product Designer',      'design', 'product_design',    'senior_ic', 0.97),
  ('head of design',                'Head of Design',               'design', NULL,                'director',  0.90),
  ('vp of design',                  'VP of Design',                 'design', NULL,                'vp',        0.97),
  -- Data Science / ML / AI
  ('data scientist',                'Data Scientist',               'data_science', 'analytics',   'individual_contributor', 0.97),
  ('senior data scientist',         'Senior Data Scientist',        'data_science', 'analytics',   'senior_ic', 0.97),
  ('research scientist',            'Research Scientist',           'data_science', 'ai_research', 'senior_ic', 0.90),
  ('applied scientist',             'Applied Scientist',            'data_science', 'ai_research', 'individual_contributor', 0.92),
  ('research engineer',             'Research Engineer',            'data_science', 'ai_research', 'individual_contributor', 0.90),
  -- Internships
  ('software engineering intern',   'Software Engineering Intern',  'engineering', NULL,           'intern', 0.97),
  ('software engineer intern',      'Software Engineering Intern',  'engineering', NULL,           'intern', 0.97),
  ('product management intern',     'Product Management Intern',    'product', NULL,               'intern', 0.97),
  ('product manager intern',        'Product Management Intern',    'product', NULL,               'intern', 0.97),
  ('data science intern',           'Data Science Intern',          'data_science', NULL,          'intern', 0.97),
  -- Founder
  ('founder',                       'Founder',                      'founder', NULL,               'founder', 0.95),
  ('co-founder',                    'Co-Founder',                   'founder', NULL,               'founder', 0.97),
  ('cofounder',                     'Co-Founder',                   'founder', NULL,               'founder', 0.97),
  ('founder & ceo',                 'Founder & CEO',                'founder', NULL,               'founder', 0.97),
  ('co-founder & ceo',              'Co-Founder & CEO',             'founder', NULL,               'founder', 0.97),
  ('founder and ceo',               'Founder & CEO',                'founder', NULL,               'founder', 0.97),
  ('founder/ceo',                   'Founder & CEO',                'founder', NULL,               'founder', 0.97),
  ('founder/cto',                   'Founder & CTO',                'founder', NULL,               'founder', 0.97),
  -- Operations / BizOps
  ('chief of staff',                'Chief of Staff',               'operations', NULL,            'senior_ic', 0.92),
  ('head of operations',            'Head of Operations',           'operations', NULL,            'director',  0.90),
  ('vp of operations',              'VP of Operations',             'operations', NULL,            'vp',        0.97),
  ('coo',                           'COO',                          'operations', NULL,            'c_suite',   0.95),
  -- Sales
  ('account executive',             'Account Executive',            'sales', 'enterprise_sales',   'individual_contributor', 0.95),
  ('ae',                            'Account Executive',            'sales', NULL,                 'individual_contributor', 0.80),
  ('sales development representative', 'SDR',                       'sales', NULL,                 'individual_contributor', 0.97),
  ('sdr',                           'SDR',                          'sales', NULL,                 'individual_contributor', 0.92),
  ('business development representative', 'BDR',                    'sales', NULL,                 'individual_contributor', 0.95),
  ('bdr',                           'BDR',                          'sales', NULL,                 'individual_contributor', 0.90),
  ('vp of sales',                   'VP of Sales',                  'sales', NULL,                 'vp',        0.97),
  ('vp sales',                      'VP of Sales',                  'sales', NULL,                 'vp',        0.95),
  ('chief revenue officer',         'CRO',                          'sales', NULL,                 'c_suite',   0.97),
  ('cro',                           'CRO',                          'sales', NULL,                 'c_suite',   0.88),
  -- Finance
  ('cfo',                           'CFO',                          'finance', NULL,               'c_suite',   0.95),
  ('chief financial officer',       'CFO',                          'finance', NULL,               'c_suite',   0.97),
  ('vp of finance',                 'VP of Finance',                'finance', NULL,               'vp',        0.97),
  -- CEO / General
  ('ceo',                           'CEO',                          'operations', NULL,            'c_suite',   0.92),
  ('chief executive officer',       'CEO',                          'operations', NULL,            'c_suite',   0.97);

-- ============================================================
-- EMPLOYMENT TYPE PATTERNS
-- ============================================================

INSERT INTO employment_type_dictionary (employment_type_pattern, employment_type_normalized) VALUES
  ('full-time',       'full_time'),
  ('full time',       'full_time'),
  ('permanent',       'full_time'),
  ('contract',        'contract'),
  ('contractor',      'contract'),
  ('consulting',      'contract'),
  ('consultant',      'contract'),
  ('freelance',       'freelance'),
  ('freelancer',      'freelance'),
  ('part-time',       'part_time'),
  ('part time',       'part_time'),
  ('internship',      'internship'),
  ('intern',          'internship'),
  ('co-op',           'internship'),
  ('coop',            'internship'),
  ('advisory',        'advisory'),
  ('advisor',         'advisory'),
  ('board member',    'board'),
  ('board of directors', 'board');

-- ============================================================
-- DEGREE PATTERNS
-- ============================================================

INSERT INTO degree_dictionary (degree_pattern, degree_normalized, degree_level, is_real_degree, is_certificate, is_coursework) VALUES
  ('bachelor of science',       'BS',     'bachelor',    TRUE,  FALSE, FALSE),
  ('bachelor of arts',          'BA',     'bachelor',    TRUE,  FALSE, FALSE),
  ('bachelor of engineering',   'BEng',   'bachelor',    TRUE,  FALSE, FALSE),
  ('bachelor of applied science','BASc',  'bachelor',    TRUE,  FALSE, FALSE),
  ('bs',                        'BS',     'bachelor',    TRUE,  FALSE, FALSE),
  ('ba',                        'BA',     'bachelor',    TRUE,  FALSE, FALSE),
  ('b.s.',                      'BS',     'bachelor',    TRUE,  FALSE, FALSE),
  ('b.a.',                      'BA',     'bachelor',    TRUE,  FALSE, FALSE),
  ('master of science',         'MS',     'master',      TRUE,  FALSE, FALSE),
  ('master of arts',            'MA',     'master',      TRUE,  FALSE, FALSE),
  ('master of engineering',     'MEng',   'master',      TRUE,  FALSE, FALSE),
  ('ms',                        'MS',     'master',      TRUE,  FALSE, FALSE),
  ('ma',                        'MA',     'master',      TRUE,  FALSE, FALSE),
  ('m.s.',                      'MS',     'master',      TRUE,  FALSE, FALSE),
  ('master of business administration', 'MBA', 'mba',    TRUE,  FALSE, FALSE),
  ('mba',                       'MBA',    'mba',         TRUE,  FALSE, FALSE),
  ('m.b.a.',                    'MBA',    'mba',         TRUE,  FALSE, FALSE),
  ('doctor of philosophy',      'PhD',    'phd',         TRUE,  FALSE, FALSE),
  ('ph.d.',                     'PhD',    'phd',         TRUE,  FALSE, FALSE),
  ('phd',                       'PhD',    'phd',         TRUE,  FALSE, FALSE),
  ('juris doctor',              'JD',     'jd',          TRUE,  FALSE, FALSE),
  ('j.d.',                      'JD',     'jd',          TRUE,  FALSE, FALSE),
  ('jd',                        'JD',     'jd',          TRUE,  FALSE, FALSE),
  ('doctor of medicine',        'MD',     'md',          TRUE,  FALSE, FALSE),
  ('m.d.',                      'MD',     'md',          TRUE,  FALSE, FALSE),
  ('md',                        'MD',     'md',          TRUE,  FALSE, FALSE),
  ('certificate',               'Certificate', 'certificate', FALSE, TRUE, FALSE),
  ('certification',             'Certificate', 'certificate', FALSE, TRUE, FALSE),
  ('nanodegree',                'Nanodegree', 'certificate', FALSE, TRUE, FALSE),
  ('bootcamp',                  'Bootcamp',   'certificate', FALSE, TRUE, FALSE),
  ('coursework',                'Coursework', 'coursework',  FALSE, FALSE, TRUE),
  ('some college',              'Some College', 'other',     FALSE, FALSE, TRUE);
